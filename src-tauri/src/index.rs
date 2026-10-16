//! Índice local de la bóveda en SQLite: texto completo (FTS5) para la
//! búsqueda y enlaces `[[...]]` para los backlinks.
//!
//! Se guarda en la caché de la app, no dentro de la bóveda, así que se
//! puede borrar sin perder nada: se reconstruye al abrir la bóveda.

use crate::links::{Backlink, links_with_lines, resolve_link, stem};
use crate::vault::{self, VaultState};
use rusqlite::{Connection, params};
use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

/// Súbelo al cambiar el esquema: el índice se reconstruye solo.
const SCHEMA_VERSION: i32 = 1;

const SCHEMA: &str = "
    CREATE TABLE notes (
        path  TEXT PRIMARY KEY,
        mtime INTEGER NOT NULL,
        size  INTEGER NOT NULL
    );
    CREATE VIRTUAL TABLE notes_fts USING fts5(
        path UNINDEXED,
        name,
        body,
        tokenize = 'unicode61 remove_diacritics 2'
    );
    CREATE TABLE links (
        source    TEXT NOT NULL,
        target    TEXT NOT NULL,
        target_lc TEXT NOT NULL,
        line      TEXT NOT NULL
    );
    CREATE INDEX links_source ON links(source);
    CREATE INDEX links_target ON links(target_lc);
";

/// Separadores de las coincidencias en los fragmentos de búsqueda. Son
/// caracteres de control para que nunca choquen con el texto de una nota.
pub const MARK_START: char = '\u{2}';
pub const MARK_END: char = '\u{3}';

#[derive(Debug, Serialize, PartialEq)]
pub struct SearchHit {
    pub path: String,
    pub name: String,
    /// Fragmento del texto con las coincidencias entre `\u{2}` y `\u{3}`.
    pub snippet: String,
}

pub struct Index {
    conn: Connection,
    root: PathBuf,
}

type Res<T> = rusqlite::Result<T>;

/// Fecha de modificación (ns) y tamaño de un fichero.
fn stamp(file: &Path) -> Option<(i64, i64)> {
    let meta = fs::metadata(file).ok()?;
    let mtime = meta
        .modified()
        .ok()?
        .duration_since(UNIX_EPOCH)
        .ok()?
        .as_nanos() as i64;
    Some((mtime, meta.len() as i64))
}

/// Destino de enlace normalizado para buscarlo en el índice.
fn normalize_target(target: &str) -> String {
    let t = target.trim();
    t.strip_suffix(".md").unwrap_or(t).to_lowercase()
}

/// Convierte lo que escribe la persona en una consulta FTS5 segura:
/// cada palabra entre comillas y como prefijo (`"pal"*`).
fn fts_query(query: &str) -> Option<String> {
    let terms: Vec<String> = query
        .split_whitespace()
        .map(|w| format!("\"{}\"*", w.replace('"', "\"\"")))
        .collect();
    (!terms.is_empty()).then(|| terms.join(" "))
}

impl Index {
    pub fn open(db: &Path, root: &Path) -> Res<Self> {
        let conn = Connection::open(db)?;
        Self::with_connection(conn, root)
    }

    fn with_connection(mut conn: Connection, root: &Path) -> Res<Self> {
        // Si otra conexión está escribiendo (p. ej. dos aperturas seguidas
        // de la misma bóveda), espera en lugar de fallar.
        conn.busy_timeout(std::time::Duration::from_secs(10))?;

        // Crear el esquema dentro de una transacción exclusiva, volviendo a
        // mirar la versión dentro, para que dos aperturas a la vez no choquen.
        let tx = conn.transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)?;
        let version: i32 = tx.pragma_query_value(None, "user_version", |r| r.get(0))?;
        if version != SCHEMA_VERSION {
            tx.execute_batch(
                "DROP TABLE IF EXISTS notes;
                 DROP TABLE IF EXISTS notes_fts;
                 DROP TABLE IF EXISTS links;",
            )?;
            tx.execute_batch(SCHEMA)?;
            tx.pragma_update(None, "user_version", SCHEMA_VERSION)?;
        }
        tx.commit()?;
        Ok(Self {
            conn,
            root: root.to_path_buf(),
        })
    }

    /// Pone el índice al día con el disco: añade, actualiza o quita notas
    /// comparando fecha y tamaño. Solo lee las notas que han cambiado.
    pub fn sync(&mut self) -> Res<()> {
        let on_disk = vault::read_tree(&self.root, &self.root)
            .map(|tree| {
                let mut notes = Vec::new();
                vault::flatten(&tree, &mut notes);
                notes
            })
            .unwrap_or_default();

        let tx = self
            .conn
            .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)?;
        let indexed: HashMap<String, (i64, i64)> = tx
            .prepare("SELECT path, mtime, size FROM notes")?
            .query_map([], |r| Ok((r.get(0)?, (r.get(1)?, r.get(2)?))))?
            .collect::<Res<_>>()?;

        for path in &on_disk {
            let file = self.root.join(path);
            let Some(current) = stamp(&file) else {
                continue;
            };
            if indexed.get(path) != Some(&current)
                && let Ok(content) = fs::read_to_string(&file)
            {
                Self::put(&tx, path, current, &content)?;
            }
        }
        let on_disk: HashSet<&String> = on_disk.iter().collect();
        for path in indexed.keys().filter(|p| !on_disk.contains(p)) {
            Self::remove(&tx, path)?;
        }
        tx.commit()
    }

    /// Actualiza una sola nota (después de guardarla desde la app).
    pub fn update(&mut self, path: &str) -> Res<()> {
        let file = self.root.join(path);
        let tx = self
            .conn
            .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)?;
        match (stamp(&file), fs::read_to_string(&file)) {
            (Some(current), Ok(content)) => Self::put(&tx, path, current, &content)?,
            _ => Self::remove(&tx, path)?,
        }
        tx.commit()
    }

    fn put(tx: &Connection, path: &str, (mtime, size): (i64, i64), content: &str) -> Res<()> {
        Self::remove(tx, path)?;
        tx.execute(
            "INSERT INTO notes (path, mtime, size) VALUES (?1, ?2, ?3)",
            params![path, mtime, size],
        )?;
        tx.execute(
            "INSERT INTO notes_fts (path, name, body) VALUES (?1, ?2, ?3)",
            params![path, stem(path), content],
        )?;
        let mut insert = tx.prepare_cached(
            "INSERT INTO links (source, target, target_lc, line) VALUES (?1, ?2, ?3, ?4)",
        )?;
        for (target, line) in links_with_lines(content) {
            insert.execute(params![path, target, normalize_target(&target), line])?;
        }
        Ok(())
    }

    fn remove(tx: &Connection, path: &str) -> Res<()> {
        tx.execute("DELETE FROM notes WHERE path = ?1", [path])?;
        tx.execute("DELETE FROM notes_fts WHERE path = ?1", [path])?;
        tx.execute("DELETE FROM links WHERE source = ?1", [path])?;
        Ok(())
    }

    pub fn notes(&self) -> Res<Vec<String>> {
        self.conn
            .prepare("SELECT path FROM notes ORDER BY path")?
            .query_map([], |r| r.get(0))?
            .collect()
    }

    /// Busca en el título y el texto de las notas. Sin consulta, devuelve
    /// las notas modificadas más recientemente.
    pub fn search(&self, query: &str, limit: usize) -> Res<Vec<SearchHit>> {
        let Some(fts) = fts_query(query) else {
            return self
                .conn
                .prepare("SELECT path FROM notes ORDER BY mtime DESC LIMIT ?1")?
                .query_map([limit as i64], |r| {
                    let path: String = r.get(0)?;
                    Ok(SearchHit {
                        name: stem(&path).to_string(),
                        path,
                        snippet: String::new(),
                    })
                })?
                .collect();
        };

        // El título pesa 10 veces más que el texto.
        let mut hits: Vec<SearchHit> = self
            .conn
            .prepare(
                "SELECT path, name, snippet(notes_fts, 2, ?2, ?3, '…', 12)
                 FROM notes_fts WHERE notes_fts MATCH ?1
                 ORDER BY bm25(notes_fts, 0.0, 10.0, 1.0) LIMIT ?4",
            )?
            .query_map(
                params![
                    fts,
                    MARK_START.to_string(),
                    MARK_END.to_string(),
                    limit as i64
                ],
                |r| {
                    Ok(SearchHit {
                        path: r.get(0)?,
                        name: r.get(1)?,
                        snippet: r.get(2)?,
                    })
                },
            )?
            .collect::<Res<_>>()?;

        // Coincidencias en mitad del nombre ("uta" en "Hoja de ruta"), que
        // FTS no encuentra porque busca por inicio de palabra.
        if hits.len() < limit {
            let q = query.trim().to_lowercase();
            let seen: HashSet<String> = hits.iter().map(|h| h.path.clone()).collect();
            let extra: Vec<String> = self
                .notes()?
                .into_iter()
                .filter(|p| !seen.contains(p) && stem(p).to_lowercase().contains(&q))
                .take(limit - hits.len())
                .collect();
            hits.extend(extra.into_iter().map(|path| SearchHit {
                name: stem(&path).to_string(),
                path,
                snippet: String::new(),
            }));
        }
        Ok(hits)
    }

    /// Notas que enlazan a `target_path`, con la línea del primer enlace.
    pub fn backlinks(&self, target_path: &str) -> Res<Vec<Backlink>> {
        let notes = self.notes()?;
        let by_name = stem(target_path).to_lowercase();
        let suffix = format!("/{by_name}");

        // Candidatos baratos por nombre; luego se comprueba con las mismas
        // reglas que al hacer clic en el enlace.
        let mut stmt = self.conn.prepare(
            "SELECT source, target, line FROM links
             WHERE target_lc = ?1 OR substr(target_lc, -length(?2)) = ?2
             ORDER BY rowid",
        )?;
        let rows = stmt.query_map(params![by_name, suffix], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
            ))
        })?;

        let mut seen = HashSet::new();
        let mut result = Vec::new();
        for row in rows {
            let (source, target, line) = row?;
            if source == target_path || seen.contains(&source) {
                continue;
            }
            if resolve_link(&target, &source, &notes) == Some(target_path) {
                seen.insert(source.clone());
                result.push(Backlink {
                    name: stem(&source).to_string(),
                    path: source,
                    snippet: line,
                });
            }
        }
        result.sort_by_key(|b| b.name.to_lowercase());
        Ok(result)
    }
}

/// Ruta del índice de una bóveda dentro de la caché de la app.
pub fn db_path(cache_dir: &Path, root: &Path) -> PathBuf {
    use std::hash::{Hash, Hasher};
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    root.hash(&mut hasher);
    cache_dir.join(format!("index-{:016x}.sqlite", hasher.finish()))
}

fn err(e: rusqlite::Error) -> String {
    format!("Error en el índice: {e}")
}

/// Ejecuta `f` con el índice de la bóveda abierta.
pub(crate) fn with_index<T>(
    state: &VaultState,
    f: impl FnOnce(&mut Index) -> Res<T>,
) -> Result<T, String> {
    let mut guard = state.index.lock().map_err(|_| "Índice bloqueado")?;
    let index = guard.as_mut().ok_or("No hay ninguna bóveda abierta")?;
    f(index).map_err(err)
}

#[tauri::command(async)]
pub fn search_notes(
    query: String,
    state: tauri::State<'_, VaultState>,
) -> Result<Vec<SearchHit>, String> {
    with_index(&state, |i| i.search(&query, 30))
}

#[tauri::command(async)]
pub fn get_backlinks(
    path: String,
    state: tauri::State<'_, VaultState>,
) -> Result<Vec<Backlink>, String> {
    with_index(&state, |i| i.backlinks(&path))
}

#[tauri::command(async)]
pub fn resolve_note_link(
    target: String,
    from: String,
    state: tauri::State<'_, VaultState>,
) -> Result<Option<String>, String> {
    let notes = with_index(&state, |i| i.notes())?;
    Ok(resolve_link(&target, &from, &notes).map(str::to_string))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write(root: &Path, rel: &str, content: &str) {
        let path = root.join(rel);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, content).unwrap();
    }

    fn index(root: &Path) -> Index {
        let mut i = Index::with_connection(Connection::open_in_memory().unwrap(), root).unwrap();
        i.sync().unwrap();
        i
    }

    fn paths(hits: &[SearchHit]) -> Vec<&str> {
        hits.iter().map(|h| h.path.as_str()).collect()
    }

    #[test]
    fn busca_por_titulo_y_texto_sin_tildes() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        write(
            root,
            "Recetas/Paella.md",
            "Arroz con azafrán, rápido de hacer.",
        );
        write(root, "Ideas.md", "Una paella para el domingo.");
        write(root, "Hoja de ruta.md", "Plan del proyecto.");
        let i = index(root);

        // El título pesa más que el texto.
        assert_eq!(
            paths(&i.search("paella", 10).unwrap()),
            ["Recetas/Paella.md", "Ideas.md"]
        );
        // Prefijos y sin tildes.
        assert_eq!(
            paths(&i.search("azafr rapido", 10).unwrap()),
            ["Recetas/Paella.md"]
        );
        let hit = &i.search("domingo", 10).unwrap()[0];
        assert!(hit.snippet.contains("\u{2}domingo\u{3}"));
        // En mitad del nombre.
        assert_eq!(paths(&i.search("ruta", 10).unwrap()), ["Hoja de ruta.md"]);
        assert_eq!(paths(&i.search("uta", 10).unwrap()), ["Hoja de ruta.md"]);
        // Comillas y símbolos no rompen la consulta.
        assert!(i.search("\"(*", 10).is_ok());
    }

    #[test]
    fn se_mantiene_al_dia() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        write(root, "A.md", "uno");
        write(root, "B.md", "dos");
        let mut i = index(root);

        write(root, "A.md", "tres y algo más");
        fs::remove_file(root.join("B.md")).unwrap();
        write(root, "C.md", "cuatro");
        i.sync().unwrap();

        assert_eq!(i.notes().unwrap(), ["A.md", "C.md"]);
        assert_eq!(paths(&i.search("tres", 10).unwrap()), ["A.md"]);
        assert!(i.search("uno", 10).unwrap().is_empty());

        write(root, "C.md", "cinco");
        i.update("C.md").unwrap();
        assert_eq!(paths(&i.search("cinco", 10).unwrap()), ["C.md"]);
    }

    #[test]
    fn calcula_backlinks() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        write(
            root,
            "Ideas.md",
            "# Ideas\n\nTrabajo en [[Botion]].\nY otra vez [[botion]].\n",
        );
        write(root, "Diario.md", "Hoy nada que ver con [[Otra]].\n");
        write(root, "Plan.md", "Ver [[Proyectos/Botion|el proyecto]].\n");
        write(root, "Proyectos/Botion.md", "Ver [[Ideas]].\n");
        // Mismo nombre, pero más profunda: `[[Botion]]` apunta a la otra.
        write(
            root,
            "Archivo/Viejo/Botion.md",
            "Una nota con el mismo nombre.\n",
        );
        let i = index(root);

        assert_eq!(
            i.backlinks("Proyectos/Botion.md").unwrap(),
            vec![
                Backlink {
                    path: "Ideas.md".into(),
                    name: "Ideas".into(),
                    snippet: "Trabajo en [[Botion]].".into(),
                },
                Backlink {
                    path: "Plan.md".into(),
                    name: "Plan".into(),
                    snippet: "Ver [[Proyectos/Botion|el proyecto]].".into(),
                },
            ]
        );
        assert!(i.backlinks("Archivo/Viejo/Botion.md").unwrap().is_empty());
    }

    #[test]
    fn dos_aperturas_a_la_vez_no_chocan() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("boveda");
        write(&root, "A.md", "hola");
        let db = dir.path().join("indice.sqlite");

        let handles: Vec<_> = (0..4)
            .map(|_| {
                let (db, root) = (db.clone(), root.clone());
                std::thread::spawn(move || {
                    let mut i = Index::open(&db, &root)?;
                    i.sync()?;
                    i.notes()
                })
            })
            .collect();
        for h in handles {
            assert_eq!(h.join().unwrap().unwrap(), ["A.md"]);
        }
    }

    #[test]
    fn sin_consulta_devuelve_recientes() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        write(root, "Vieja.md", "");
        std::thread::sleep(std::time::Duration::from_millis(20));
        write(root, "Nueva.md", "");
        let i = index(root);
        assert_eq!(
            paths(&i.search("  ", 10).unwrap()),
            ["Nueva.md", "Vieja.md"]
        );
    }
}
