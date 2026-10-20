//! Crear, renombrar y borrar notas y carpetas de la bóveda.

use crate::links::{all_notes, resolve_link, rewrite_links, stem};
use crate::vault::{self, VaultState, write_atomic};
use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::path::Path;

/// Nombre válido para una nota o carpeta en cualquier sistema operativo.
pub(crate) fn valid_name(name: &str) -> bool {
    !name.is_empty()
        && name == name.trim()
        && !name.starts_with('.')
        && !name.chars().any(|c| {
            c.is_control() || matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|')
        })
}

/// Ruta relativa de una nota nueva a partir de `carpeta/Nombre`.
fn new_note_path(target: &str) -> Result<String, String> {
    let target = target.trim();
    let target = target.strip_suffix(".md").unwrap_or(target).trim();
    if !target.split('/').all(valid_name) {
        return Err(format!("«{target}» no es un nombre válido"));
    }
    Ok(format!("{target}.md"))
}

/// Crea una nota (por ejemplo `Proyectos/Plan`) y devuelve su ruta.
#[tauri::command]
pub fn create_note(target: String, state: tauri::State<VaultState>) -> Result<String, String> {
    let root = vault::current_root(&state)?;
    let rel = new_note_path(&target)?;
    let file = vault::resolve(&root, &rel)?;
    if file.exists() {
        return Err("Ya existe una nota con ese nombre".into());
    }
    if let Some(parent) = file.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("No se pudo crear la carpeta: {e}"))?;
    }
    fs::write(&file, format!("# {}\n", stem(&rel)))
        .map_err(|e| format!("No se pudo crear la nota: {e}"))?;
    vault::sync_index(&state)?;
    Ok(rel)
}

#[tauri::command]
pub fn create_folder(path: String, state: tauri::State<VaultState>) -> Result<String, String> {
    let root = vault::current_root(&state)?;
    let path = path.trim().to_string();
    if !path.split('/').all(valid_name) {
        return Err(format!("«{path}» no es un nombre válido"));
    }
    let dir = vault::resolve(&root, &path)?;
    if dir.exists() {
        return Err("Ya existe una carpeta con ese nombre".into());
    }
    fs::create_dir_all(&dir).map_err(|e| format!("No se pudo crear la carpeta: {e}"))?;
    Ok(path)
}

#[derive(Debug, Serialize)]
pub struct Renamed {
    /// Nueva ruta de la nota o carpeta.
    pub path: String,
    /// Notas cuyos enlaces se han actualizado.
    pub updated_notes: usize,
}

/// Cambia el nombre de una nota o carpeta (sin moverla de carpeta) y
/// actualiza los enlaces `[[...]]` que apuntaban a ella.
pub fn rename(root: &Path, path: &str, new_name: &str) -> Result<Renamed, String> {
    let from = vault::resolve(root, path)?;
    let is_dir = from.is_dir();
    if !is_dir && !vault::is_markdown(&from) {
        return Err("Solo se pueden renombrar notas .md y carpetas".into());
    }
    let new_name = new_name.trim();
    let new_name = if is_dir {
        new_name
    } else {
        new_name.strip_suffix(".md").unwrap_or(new_name).trim()
    };
    if !valid_name(new_name) {
        return Err(format!("«{new_name}» no es un nombre válido"));
    }

    let parent = path.rsplit_once('/').map_or("", |(dir, _)| dir);
    let file_name = if is_dir {
        new_name.to_string()
    } else {
        format!("{new_name}.md")
    };
    let new_path = if parent.is_empty() {
        file_name
    } else {
        format!("{parent}/{file_name}")
    };
    relocate(root, path, &new_path)
}

/// Mueve una nota o carpeta a otra carpeta (`""` es la raíz de la bóveda)
/// y actualiza los enlaces.
pub fn move_to(root: &Path, path: &str, folder: &str) -> Result<Renamed, String> {
    let folder = folder.trim_matches('/');
    if folder == path || folder.starts_with(&format!("{path}/")) {
        return Err("No se puede mover una carpeta dentro de sí misma".into());
    }
    vault::resolve_dir(root, folder)?;
    let name = path.rsplit('/').next().unwrap_or(path);
    let new_path = if folder.is_empty() {
        name.to_string()
    } else {
        format!("{folder}/{name}")
    };
    relocate(root, path, &new_path)
}

/// Hay en su carpeta una entrada con exactamente ese nombre (con las mismas
/// mayúsculas), no solo una que el sistema considera igual.
fn exact_entry_exists(path: &Path) -> bool {
    let (Some(dir), Some(name)) = (path.parent(), path.file_name()) else {
        return false;
    };
    fs::read_dir(dir).is_ok_and(|entries| entries.flatten().any(|e| e.file_name() == name))
}

/// Une `dir` y `rel` resolviendo «.» y «..» (rutas de la bóveda con «/»).
fn join_rel(dir: &str, rel: &str) -> Option<String> {
    let mut out: Vec<&str> = dir.split('/').filter(|p| !p.is_empty()).collect();
    for part in rel.split('/') {
        match part {
            "" | "." => {}
            ".." => {
                out.pop()?;
            }
            p => out.push(p),
        }
    }
    Some(out.join("/"))
}

/// Ruta relativa desde la carpeta `dir` hasta el fichero `target`.
fn relative_to(dir: &str, target: &str) -> String {
    let from: Vec<&str> = dir.split('/').filter(|p| !p.is_empty()).collect();
    let to: Vec<&str> = target.split('/').collect();
    let common = from.iter().zip(&to).take_while(|(a, b)| a == b).count();
    let mut parts = vec![".."; from.len() - common];
    parts.extend(&to[common..]);
    parts.join("/")
}

/// Enlace relativo nuevo para `url` (escrito en una nota de `old_dir`) si la
/// nota pasa a `new_dir`. `locate` dice dónde está ahora un fichero de la
/// bóveda que estaba en una ruta, o `None` si no existe.
fn rebase_url(
    url: &str,
    old_dir: &str,
    new_dir: &str,
    locate: &impl Fn(&str) -> Option<String>,
) -> Option<String> {
    if url.is_empty() || url.starts_with(['#', '/']) || url.split('/').next()?.contains(':') {
        return None;
    }
    let decoded = percent_encoding::percent_decode_str(url)
        .decode_utf8()
        .ok()?;
    let target = locate(&join_rel(old_dir, &decoded)?)?;
    let new = relative_to(new_dir, &target);
    (new != decoded).then_some(new)
}

/// Arregla los enlaces relativos `](ruta)` de una nota (imágenes, adjuntos)
/// cuando la nota cambia de carpeta. No toca los bloques de código.
fn rebase_markdown_links(
    content: &str,
    old_dir: &str,
    new_dir: &str,
    locate: &impl Fn(&str) -> Option<String>,
) -> String {
    let mut out = String::with_capacity(content.len());
    let mut in_fence = false;
    for line in content.split_inclusive('\n') {
        if line.trim_start().starts_with("```") {
            in_fence = !in_fence;
        }
        if in_fence || !line.contains("](") {
            out.push_str(line);
            continue;
        }
        let mut rest = line;
        while let Some(i) = rest.find("](") {
            out.push_str(&rest[..i + 2]);
            rest = &rest[i + 2..];
            let (url, len, angle) = if let Some(inner) = rest.strip_prefix('<') {
                match inner.find('>') {
                    Some(end) => (&inner[..end], end + 2, true),
                    None => continue,
                }
            } else {
                let end = rest.find([')', ' ', '\t', '\n']).unwrap_or(rest.len());
                (&rest[..end], end, false)
            };
            match rebase_url(url, old_dir, new_dir, locate) {
                Some(new) if angle || new.contains([' ', '(', ')']) => {
                    out.push_str(&format!("<{new}>"))
                }
                Some(new) => out.push_str(&new),
                None => out.push_str(&rest[..len]),
            }
            rest = &rest[len..];
        }
        out.push_str(rest);
    }
    out
}

/// Lo mismo con las propiedades que guardan rutas a ficheros (tipo
/// Archivos): solo se cambian los textos que apuntan a un fichero existente.
fn rebase_property_links(
    content: &str,
    old_dir: &str,
    new_dir: &str,
    locate: &impl Fn(&str) -> Option<String>,
) -> String {
    use serde_json::Value;
    let Ok(props) = crate::props::read(content) else {
        return content.to_string();
    };
    let mut out = content.to_string();
    for (key, value) in props {
        let fix = |v: &Value| match v {
            Value::String(s) => rebase_url(s, old_dir, new_dir, locate).map(Value::String),
            _ => None,
        };
        let new_value = match &value {
            Value::String(_) => fix(&value),
            Value::Array(items) if items.iter().any(|v| fix(v).is_some()) => Some(Value::Array(
                items
                    .iter()
                    .map(|v| fix(v).unwrap_or_else(|| v.clone()))
                    .collect(),
            )),
            _ => None,
        };
        if let Some(v) = new_value
            && let Ok(updated) = crate::props::set(&out, &key, Some(v))
        {
            out = updated;
        }
    }
    out
}

/// Cambia la ruta de una nota o carpeta y arregla los enlaces `[[...]]`:
/// los que apuntaban a lo movido y los que, desde lo movido, dejarían de
/// apuntar a la misma nota (porque se buscan primero en la misma carpeta).
fn relocate(root: &Path, path: &str, new_path: &str) -> Result<Renamed, String> {
    let from = vault::resolve(root, path)?;
    let is_dir = from.is_dir();
    if !is_dir && !vault::is_markdown(&from) {
        return Err("Solo se pueden mover notas .md y carpetas".into());
    }
    let new_path = new_path.to_string();
    if new_path == path {
        return Ok(Renamed {
            path: new_path,
            updated_notes: 0,
        });
    }
    let to = vault::resolve(root, &new_path)?;
    // Permite cambiar solo mayúsculas/minúsculas en sistemas que no las
    // distinguen; si existe otra entrada con ese nombre exacto (Linux), no.
    if to.exists() && (new_path.to_lowercase() != path.to_lowercase() || exact_entry_exists(&to)) {
        return Err("Ya existe una nota o carpeta con ese nombre".into());
    }

    let old_notes = all_notes(root)?;
    fs::rename(&from, &to).map_err(|e| format!("No se pudo mover: {e}"))?;
    let new_notes = all_notes(root)?;

    // Ruta antigua -> nueva de cada nota afectada.
    let moved: HashMap<&str, String> = old_notes
        .iter()
        .filter_map(|old| {
            let new = if is_dir {
                old.strip_prefix(&format!("{path}/"))
                    .map(|rest| format!("{new_path}/{rest}"))?
            } else if old == path {
                new_path.clone()
            } else {
                return None;
            };
            Some((old.as_str(), new))
        })
        .collect();
    let old_path_of: HashMap<&str, &str> = moved.iter().map(|(o, n)| (n.as_str(), *o)).collect();

    let mut updated_notes = 0;
    for note in &new_notes {
        let old_note = old_path_of.get(note.as_str()).copied().unwrap_or(note);
        let Ok(content) = fs::read_to_string(root.join(note)) else {
            continue;
        };
        let updated = rewrite_links(&content, |target| {
            let old = resolve_link(target, old_note, &old_notes)?;
            let new = moved.get(old).cloned().unwrap_or_else(|| old.to_string());
            // Si sigue apuntando a la misma nota, no se toca.
            if resolve_link(target, note, &new_notes) == Some(new.as_str()) {
                return None;
            }
            let new = &new;
            // Se mantiene el estilo del enlace: por nombre si sigue siendo
            // inequívoco, si no por ruta.
            let by_name = stem(new);
            let replacement = if !target.contains('/')
                && resolve_link(by_name, note, &new_notes) == Some(new.as_str())
            {
                by_name
            } else {
                new.strip_suffix(".md").unwrap_or(new)
            };
            (replacement != target).then(|| replacement.to_string())
        });
        // Las notas movidas a otra carpeta conservan sus imágenes y adjuntos.
        let mut updated = updated;
        if let Some(old_note) = old_path_of.get(note.as_str()) {
            let (old_dir, new_dir) = (folder_of(old_note), folder_of(note));
            if old_dir != new_dir {
                let locate = |old: &str| {
                    // Un fichero que estaba dentro de lo movido también se ha movido.
                    let now = if is_dir {
                        old.strip_prefix(&format!("{path}/"))
                            .map_or_else(|| old.to_string(), |rest| format!("{new_path}/{rest}"))
                    } else {
                        old.to_string()
                    };
                    root.join(&now).is_file().then_some(now)
                };
                updated = rebase_markdown_links(&updated, old_dir, new_dir, &locate);
                updated = rebase_property_links(&updated, old_dir, new_dir, &locate);
            }
        }
        if updated != content {
            write_atomic(&root.join(note), &updated)
                .map_err(|e| format!("No se pudieron actualizar los enlaces de {note}: {e}"))?;
            updated_notes += 1;
        }
    }

    Ok(Renamed {
        path: new_path,
        updated_notes,
    })
}

fn folder_of(path: &str) -> &str {
    path.rsplit_once('/').map_or("", |(dir, _)| dir)
}

#[tauri::command(async)]
pub fn rename_entry(
    path: String,
    new_name: String,
    state: tauri::State<'_, VaultState>,
) -> Result<Renamed, String> {
    let renamed = rename(&vault::current_root(&state)?, &path, &new_name)?;
    vault::sync_index(&state)?;
    Ok(renamed)
}

#[tauri::command(async)]
pub fn move_entry(
    path: String,
    folder: String,
    state: tauri::State<'_, VaultState>,
) -> Result<Renamed, String> {
    let moved = move_to(&vault::current_root(&state)?, &path, &folder)?;
    vault::sync_index(&state)?;
    Ok(moved)
}

/// Mueve una nota o carpeta a la papelera del sistema.
#[tauri::command]
pub fn delete_entry(path: String, state: tauri::State<VaultState>) -> Result<(), String> {
    let root = vault::current_root(&state)?;
    if path.trim().is_empty() {
        return Err("Ruta no válida".into());
    }
    let target = vault::resolve(&root, &path)?;
    if !target.exists() {
        return Err("Ya no existe".into());
    }
    trash::delete(&target).map_err(|e| format!("No se pudo mover a la papelera: {e}"))?;
    vault::sync_index(&state)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write(root: &Path, rel: &str, content: &str) {
        let path = root.join(rel);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, content).unwrap();
    }

    fn read(root: &Path, rel: &str) -> String {
        fs::read_to_string(root.join(rel)).unwrap()
    }

    #[test]
    fn valida_nombres() {
        assert_eq!(new_note_path("Nueva idea").unwrap(), "Nueva idea.md");
        assert_eq!(
            new_note_path("Proyectos/Plan.md").unwrap(),
            "Proyectos/Plan.md"
        );
        assert!(new_note_path("../fuera").is_err());
        assert!(new_note_path(".oculta").is_err());
        assert!(new_note_path("a:b").is_err());
        assert!(new_note_path("").is_err());
        assert!(!valid_name("a/b"));
    }

    #[test]
    fn renombrar_nota_actualiza_enlaces() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        write(root, "Ideas.md", "# Ideas\n");
        write(
            root,
            "Diario.md",
            "Ver [[Ideas]] y [[ideas|mis ideas]]. `[[Ideas]]`\n",
        );
        write(root, "Proyectos/Plan.md", "Desde [[Ideas#Lista]].\n");
        write(root, "Otra.md", "Nada que ver.\n");

        let r = rename(root, "Ideas.md", "Lluvia de ideas").unwrap();

        assert_eq!(r.path, "Lluvia de ideas.md");
        assert_eq!(r.updated_notes, 2);
        assert!(!root.join("Ideas.md").exists());
        assert_eq!(
            read(root, "Diario.md"),
            "Ver [[Lluvia de ideas]] y [[Lluvia de ideas|mis ideas]]. `[[Ideas]]`\n"
        );
        assert_eq!(
            read(root, "Proyectos/Plan.md"),
            "Desde [[Lluvia de ideas#Lista]].\n"
        );
    }

    #[test]
    fn renombrar_usa_ruta_si_el_nombre_es_ambiguo() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        write(root, "A/Nota.md", "");
        write(root, "B/Plan.md", "");
        write(root, "Inicio.md", "[[Plan]]\n");

        rename(root, "B/Plan.md", "Nota").unwrap();

        assert_eq!(read(root, "Inicio.md"), "[[B/Nota]]\n");
    }

    #[test]
    fn renombrar_carpeta_actualiza_enlaces_por_ruta() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        write(root, "Proyectos/Botion.md", "Ver [[Proyectos/Ideas]].\n");
        write(root, "Proyectos/Ideas.md", "");
        write(root, "Inicio.md", "[[Proyectos/Botion]] y [[Ideas]]\n");

        let r = rename(root, "Proyectos", "Trabajo").unwrap();

        assert_eq!(r.path, "Trabajo");
        assert_eq!(read(root, "Inicio.md"), "[[Trabajo/Botion]] y [[Ideas]]\n");
        assert_eq!(read(root, "Trabajo/Botion.md"), "Ver [[Trabajo/Ideas]].\n");
    }

    #[test]
    fn mover_nota_actualiza_enlaces_en_los_dos_sentidos() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        write(root, "Proyectos/Plan.md", "Ver [[Ideas]] y [[Inicio]].\n");
        write(root, "Proyectos/Ideas.md", "# Ideas del proyecto\n");
        write(root, "Ideas.md", "# Otras ideas\n");
        write(root, "Inicio.md", "Ir a [[Proyectos/Plan]] o [[Plan]].\n");
        fs::create_dir(root.join("Archivo")).unwrap();

        let r = move_to(root, "Proyectos/Plan.md", "Archivo").unwrap();

        assert_eq!(r.path, "Archivo/Plan.md");
        assert!(root.join("Archivo/Plan.md").exists());
        // Desde Inicio: el enlace por ruta cambia; el de nombre sigue valiendo.
        assert_eq!(
            read(root, "Inicio.md"),
            "Ir a [[Archivo/Plan]] o [[Plan]].\n"
        );
        // Desde Plan: [[Ideas]] apuntaba a la de su carpeta; ahora se escribe
        // con ruta para no acabar en la otra «Ideas».
        assert_eq!(
            read(root, "Archivo/Plan.md"),
            "Ver [[Proyectos/Ideas]] y [[Inicio]].\n"
        );
    }

    #[test]
    fn mover_nota_conserva_imagenes_y_adjuntos() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        write(
            root,
            "Inicio.md",
            "---\narchivos: [\"adjuntos/informe.pdf\"]\nweb: \"https://x.com/a\"\n---\n\n![foto](adjuntos/foto.png) y ![otra](<adjuntos/mi foto.png>)\n[web](https://x.com) [falta](adjuntos/no.png)\n\n```\n![código](adjuntos/foto.png)\n```\n",
        );
        write(root, "adjuntos/foto.png", "x");
        write(root, "adjuntos/mi foto.png", "x");
        write(root, "adjuntos/informe.pdf", "x");
        fs::create_dir(root.join("Proyectos")).unwrap();

        move_to(root, "Inicio.md", "Proyectos").unwrap();
        let moved = read(root, "Proyectos/Inicio.md");
        assert!(moved.contains("![foto](../adjuntos/foto.png)"), "{moved}");
        assert!(
            moved.contains("![otra](<../adjuntos/mi foto.png>)"),
            "{moved}"
        );
        assert!(
            moved.contains("[web](https://x.com) [falta](adjuntos/no.png)"),
            "{moved}"
        );
        assert!(moved.contains("![código](adjuntos/foto.png)"), "{moved}");
        assert!(moved.contains("../adjuntos/informe.pdf"), "{moved}");
        assert!(moved.contains("https://x.com/a"), "{moved}");

        // Y al volver, otra vez como al principio.
        move_to(root, "Proyectos/Inicio.md", "").unwrap();
        assert!(read(root, "Inicio.md").contains("![foto](adjuntos/foto.png)"));
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn cambiar_mayusculas_no_pisa_otra_nota() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        write(root, "nota.md", "una");
        write(root, "Nota.md", "otra");
        assert!(rename(root, "nota.md", "Nota").is_err());
        assert_eq!(read(root, "Nota.md"), "otra");
    }

    #[test]
    fn mover_carpeta_y_errores() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        write(root, "A/Nota.md", "");
        write(root, "B/Otra.md", "");
        assert!(move_to(root, "A", "A").is_err());
        write(root, "A/Sub/x.md", "");
        assert!(move_to(root, "A", "A/Sub").is_err());
        assert!(move_to(root, "A/Nota.md", "NoExiste").is_err());

        let r = move_to(root, "A", "B").unwrap();
        assert_eq!(r.path, "B/A");
        assert!(root.join("B/A/Nota.md").exists());
        // A la raíz.
        let r = move_to(root, "B/A/Nota.md", "").unwrap();
        assert_eq!(r.path, "Nota.md");
        // Encima de otra nota con el mismo nombre, no.
        write(root, "B/Otra2.md", "");
        write(root, "Otra2.md", "");
        assert!(move_to(root, "B/Otra2.md", "").is_err());
    }

    #[test]
    fn no_renombra_encima_de_otra_nota() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        write(root, "A.md", "a");
        write(root, "B.md", "b");
        assert!(rename(root, "A.md", "B").is_err());
        assert_eq!(read(root, "B.md"), "b");
        assert!(rename(root, "A.md", "x/y").is_err());
    }
}
