//! Bases de datos: una carpeta con un fichero `.botion-db.json` se ve como
//! una tabla. Cada nota de la carpeta es una fila y sus propiedades
//! (frontmatter) son las columnas.
//!
//! El fichero solo guarda la configuración de la vista (columnas, tipos y
//! orden); los datos siempre están en las notas.

use crate::props::{self, Props};
use crate::vault::{self, VaultState, write_atomic};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::Path;

pub const CONFIG_FILE: &str = ".botion-db.json";

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Kind {
    Text,
    Number,
    Checkbox,
    Date,
    Select,
    Tags,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Column {
    pub name: String,
    pub kind: Kind,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Sort {
    pub column: String,
    pub desc: bool,
}

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum View {
    #[default]
    Table,
    Board,
    Calendar,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(default)]
pub struct Config {
    pub columns: Vec<Column>,
    pub sort: Option<Sort>,
    /// Vista con la que se abre: tabla, kanban o calendario.
    pub view: View,
    /// Columna de selección que agrupa las tarjetas del kanban.
    pub group_by: Option<String>,
    /// Columna de fecha que coloca las notas en el calendario.
    pub date_by: Option<String>,
    /// Incluir también las notas de las subcarpetas.
    pub subfolders: bool,
}

#[derive(Debug, Serialize, PartialEq)]
pub struct Row {
    pub path: String,
    pub name: String,
    /// Subcarpeta dentro de la base de datos (`""` si está directamente).
    pub subfolder: String,
    pub props: Props,
    /// Si el frontmatter no se puede leer, la fila se muestra sin editar.
    pub error: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct Database {
    pub path: String,
    pub name: String,
    pub columns: Vec<Column>,
    pub sort: Option<Sort>,
    pub view: View,
    pub group_by: Option<String>,
    pub date_by: Option<String>,
    pub subfolders: bool,
    pub rows: Vec<Row>,
}

pub fn is_database(dir: &Path) -> bool {
    dir.join(CONFIG_FILE).is_file()
}

/// Tipo de columna más probable a partir de un valor.
fn infer(value: &Value) -> Kind {
    match value {
        Value::Bool(_) => Kind::Checkbox,
        Value::Number(_) => Kind::Number,
        Value::Array(_) => Kind::Tags,
        Value::String(s) if is_date(s) => Kind::Date,
        _ => Kind::Text,
    }
}

fn is_date(s: &str) -> bool {
    let b = s.as_bytes();
    b.len() == 10
        && b[4] == b'-'
        && b[7] == b'-'
        && b.iter()
            .enumerate()
            .all(|(i, c)| i == 4 || i == 7 || c.is_ascii_digit())
}

fn read_config(dir: &Path) -> Config {
    fs::read_to_string(dir.join(CONFIG_FILE))
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn write_config(dir: &Path, config: &Config) -> Result<(), String> {
    let json = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    write_atomic(&dir.join(CONFIG_FILE), &(json + "\n"))
        .map_err(|e| format!("No se pudo guardar la base de datos: {e}"))
}

/// Notas que están directamente dentro de la carpeta (no en subcarpetas).
/// Notas de la base de datos: las de la carpeta y, si se pide, las de sus
/// subcarpetas (sin ficheros ni carpetas ocultos).
fn row_paths(root: &Path, folder: &str, subfolders: bool) -> Result<Vec<String>, String> {
    let dir = vault::resolve_dir(root, folder)?;
    if subfolders {
        let tree =
            vault::read_tree(root, &dir).map_err(|e| format!("No se pudo leer la carpeta: {e}"))?;
        let mut paths = Vec::new();
        vault::flatten(&tree, &mut paths);
        paths.sort_by_key(|p| p.to_lowercase());
        return Ok(paths);
    }
    let mut paths: Vec<String> = fs::read_dir(&dir)
        .map_err(|e| format!("No se pudo leer la carpeta: {e}"))?
        .filter_map(Result::ok)
        .filter(|e| e.file_type().is_ok_and(|t| t.is_file()))
        .map(|e| e.file_name().to_string_lossy().into_owned())
        .filter(|name| !name.starts_with('.') && vault::is_markdown(Path::new(name)))
        .map(|name| join(folder, &name))
        .collect();
    paths.sort_by_key(|p| p.to_lowercase());
    Ok(paths)
}

fn join(folder: &str, name: &str) -> String {
    if folder.is_empty() {
        name.to_string()
    } else {
        format!("{folder}/{name}")
    }
}

fn stem(path: &str) -> String {
    crate::links::stem(path).to_string()
}

pub fn load(root: &Path, folder: &str) -> Result<Database, String> {
    let dir = vault::resolve_dir(root, folder)?;
    let config = read_config(&dir);

    let rows: Vec<Row> = row_paths(root, folder, config.subfolders)?
        .into_iter()
        .map(|path| {
            let (props, error) = match fs::read_to_string(root.join(&path))
                .map_err(|e| e.to_string())
                .and_then(|c| props::read(&c))
            {
                Ok(p) => (p, None),
                Err(e) => (Props::new(), Some(e)),
            };
            let inside = if folder.is_empty() {
                path.as_str()
            } else {
                path.strip_prefix(&format!("{folder}/")).unwrap_or(&path)
            };
            Row {
                subfolder: inside.rsplit_once('/').map_or("", |(d, _)| d).to_string(),
                name: stem(&path),
                path,
                props,
                error,
            }
        })
        .collect();

    // Columnas guardadas y, detrás, las propiedades nuevas que aparezcan en
    // las notas, con el tipo deducido de su primer valor.
    let mut columns = config.columns.clone();
    for row in &rows {
        for (key, value) in &row.props {
            if !columns.iter().any(|c| &c.name == key) {
                columns.push(Column {
                    name: key.clone(),
                    kind: infer(value),
                });
            }
        }
    }

    Ok(Database {
        path: folder.to_string(),
        name: folder.rsplit('/').next().unwrap_or(folder).to_string(),
        columns,
        sort: config.sort,
        view: config.view,
        group_by: config.group_by,
        date_by: config.date_by,
        subfolders: config.subfolders,
        rows,
    })
}

fn valid_property(name: &str) -> Result<&str, String> {
    let name = name.trim();
    if name.is_empty() || name.chars().any(char::is_control) {
        return Err(format!("«{name}» no es un nombre de propiedad válido"));
    }
    Ok(name)
}

/// Aplica `f` a cada nota de la carpeta y guarda las que cambien.
fn update_rows(
    root: &Path,
    folder: &str,
    mut f: impl FnMut(&str) -> Result<Option<String>, String>,
) -> Result<Vec<String>, String> {
    let mut changed = Vec::new();
    let subfolders = read_config(&vault::resolve_dir(root, folder)?).subfolders;
    for path in row_paths(root, folder, subfolders)? {
        let file = root.join(&path);
        let content = fs::read_to_string(&file).map_err(|e| e.to_string())?;
        // Las notas con frontmatter no válido se dejan como están.
        if let Ok(Some(updated)) = f(&content)
            && updated != content
        {
            write_atomic(&file, &updated).map_err(|e| format!("No se pudo guardar {path}: {e}"))?;
            changed.push(path);
        }
    }
    Ok(changed)
}

pub fn rename_property(root: &Path, folder: &str, old: &str, new: &str) -> Result<(), String> {
    let new = valid_property(new)?;
    let dir = vault::resolve_dir(root, folder)?;
    let mut config = read_config(&dir);
    if old != new && config.columns.iter().any(|c| c.name == new) {
        return Err(format!("Ya existe la propiedad «{new}»"));
    }
    update_rows(root, folder, |c| props::rename(c, old, new))?;
    for col in &mut config.columns {
        if col.name == old {
            col.name = new.to_string();
        }
    }
    if let Some(sort) = &mut config.sort
        && sort.column == old
    {
        sort.column = new.to_string();
    }
    for col in [&mut config.group_by, &mut config.date_by] {
        if col.as_deref() == Some(old) {
            *col = Some(new.to_string());
        }
    }
    write_config(&dir, &config)
}

pub fn delete_property(root: &Path, folder: &str, key: &str) -> Result<(), String> {
    let dir = vault::resolve_dir(root, folder)?;
    let mut config = read_config(&dir);
    update_rows(root, folder, |c| {
        if props::read(c)?.contains_key(key) {
            props::set(c, key, None).map(Some)
        } else {
            Ok(None)
        }
    })?;
    config.columns.retain(|c| c.name != key);
    if config.sort.as_ref().is_some_and(|s| s.column == key) {
        config.sort = None;
    }
    for col in [&mut config.group_by, &mut config.date_by] {
        if col.as_deref() == Some(key) {
            *col = None;
        }
    }
    write_config(&dir, &config)
}

fn sync_index(state: &VaultState) -> Result<(), String> {
    vault::sync_index(state)
}

#[tauri::command(async)]
pub fn get_database(path: String, state: tauri::State<'_, VaultState>) -> Result<Database, String> {
    load(&vault::current_root(&state)?, &path)
}

#[tauri::command]
pub fn save_database_config(
    path: String,
    config: Config,
    state: tauri::State<VaultState>,
) -> Result<(), String> {
    let root = vault::current_root(&state)?;
    write_config(&vault::resolve_dir(&root, &path)?, &config)
}

/// Convierte una carpeta en base de datos, creándola si no existe.
#[tauri::command]
pub fn create_database(path: String, state: tauri::State<VaultState>) -> Result<String, String> {
    let root = vault::current_root(&state)?;
    let path = path.trim().trim_matches('/').to_string();
    if path.is_empty() || !path.split('/').all(crate::files::valid_name) {
        return Err(format!("«{path}» no es un nombre válido"));
    }
    let dir = vault::resolve(&root, &path)?;
    fs::create_dir_all(&dir).map_err(|e| format!("No se pudo crear la carpeta: {e}"))?;
    if !is_database(&dir) {
        write_config(&dir, &Config::default())?;
    }
    Ok(path)
}

/// Cambia una propiedad de una nota (`null` la quita).
#[tauri::command(async)]
pub fn set_property(
    path: String,
    key: String,
    value: Option<Value>,
    state: tauri::State<'_, VaultState>,
) -> Result<(), String> {
    let root = vault::current_root(&state)?;
    let key = valid_property(&key)?;
    let file = vault::resolve(&root, &path)?;
    if !vault::is_markdown(&file) {
        return Err("Solo las notas .md tienen propiedades".into());
    }
    let content = fs::read_to_string(&file).map_err(|e| format!("No se pudo leer la nota: {e}"))?;
    let updated = props::set(&content, key, value)?;
    write_atomic(&file, &updated).map_err(|e| format!("No se pudo guardar la nota: {e}"))?;
    crate::index::with_index(&state, |i| i.update(&path))
}

/// Propiedades de una nota, para el panel de encima del editor.
#[tauri::command]
pub fn get_properties(path: String, state: tauri::State<VaultState>) -> Result<Props, String> {
    let root = vault::current_root(&state)?;
    let content = fs::read_to_string(vault::resolve(&root, &path)?)
        .map_err(|e| format!("No se pudo leer la nota: {e}"))?;
    props::read(&content)
}

#[tauri::command(async)]
pub fn rename_database_property(
    path: String,
    old: String,
    new: String,
    state: tauri::State<'_, VaultState>,
) -> Result<(), String> {
    rename_property(&vault::current_root(&state)?, &path, &old, &new)?;
    sync_index(&state)
}

#[tauri::command(async)]
pub fn delete_database_property(
    path: String,
    key: String,
    state: tauri::State<'_, VaultState>,
) -> Result<(), String> {
    delete_property(&vault::current_root(&state)?, &path, &key)?;
    sync_index(&state)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn write(root: &Path, rel: &str, content: &str) {
        let path = root.join(rel);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, content).unwrap();
    }

    fn read(root: &Path, rel: &str) -> String {
        fs::read_to_string(root.join(rel)).unwrap()
    }

    fn vault() -> tempfile::TempDir {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        write(
            root,
            "Tareas/.botion-db.json",
            r#"{"columns":[{"name":"estado","kind":"select"}]}"#,
        );
        write(
            root,
            "Tareas/Comprar pan.md",
            "---\nestado: Hecho\nhecho: true\n---\n\nTexto.\n",
        );
        write(
            root,
            "Tareas/Arreglar bici.md",
            "---\nprioridad: 2\nfecha: 2026-10-20\netiquetas: [casa]\n---\n",
        );
        write(root, "Tareas/Sin propiedades.md", "# Nada\n");
        write(root, "Tareas/Rota.md", "---\n: : mal\n  - x\n---\n");
        write(root, "Tareas/Sub/Otra.md", "---\nno: cuenta\n---\n");
        dir
    }

    #[test]
    fn carga_filas_y_columnas() {
        let dir = vault();
        let db = load(dir.path(), "Tareas").unwrap();

        let names: Vec<_> = db.rows.iter().map(|r| r.name.as_str()).collect();
        assert_eq!(
            names,
            ["Arreglar bici", "Comprar pan", "Rota", "Sin propiedades"]
        );
        assert!(db.rows[2].error.is_some());

        let cols: Vec<_> = db
            .columns
            .iter()
            .map(|c| (c.name.as_str(), c.kind))
            .collect();
        assert_eq!(
            cols,
            [
                ("estado", Kind::Select),
                ("prioridad", Kind::Number),
                ("fecha", Kind::Date),
                ("etiquetas", Kind::Tags),
                ("hecho", Kind::Checkbox),
            ]
        );
        assert!(is_database(&dir.path().join("Tareas")));
        assert!(!is_database(&dir.path().join("Tareas/Sub")));
    }

    #[test]
    fn renombra_y_borra_propiedades_en_todas_las_filas() {
        let dir = vault();
        let root = dir.path();

        rename_property(root, "Tareas", "estado", "situación").unwrap();
        assert!(read(root, "Tareas/Comprar pan.md").starts_with("---\nsituación: Hecho\n"));
        assert_eq!(
            read_config(&root.join("Tareas")).columns[0].name,
            "situación"
        );
        // La nota con frontmatter roto no se toca.
        assert_eq!(read(root, "Tareas/Rota.md"), "---\n: : mal\n  - x\n---\n");

        delete_property(root, "Tareas", "situación").unwrap();
        let p = props::read(&read(root, "Tareas/Comprar pan.md")).unwrap();
        assert_eq!(serde_json::Value::Object(p), json!({ "hecho": true }));
        assert!(read_config(&root.join("Tareas")).columns.is_empty());
    }

    #[test]
    fn no_renombra_a_una_propiedad_existente() {
        let dir = vault();
        assert!(rename_property(dir.path(), "Tareas", "prioridad", "estado").is_err());
        assert!(rename_property(dir.path(), "Tareas", "prioridad", " ").is_err());
    }

    #[test]
    fn la_vista_sigue_a_la_columna_renombrada() {
        let dir = vault();
        let root = dir.path();
        let tareas = root.join("Tareas");
        let mut config = read_config(&tareas);
        config.view = View::Board;
        config.group_by = Some("estado".into());
        write_config(&tareas, &config).unwrap();

        rename_property(root, "Tareas", "estado", "fase").unwrap();
        let config = read_config(&tareas);
        assert_eq!(config.view, View::Board);
        assert_eq!(config.group_by.as_deref(), Some("fase"));

        delete_property(root, "Tareas", "fase").unwrap();
        assert_eq!(read_config(&tareas).group_by, None);
    }

    #[test]
    fn configuracion_antigua_sigue_valiendo() {
        let config: Config = serde_json::from_str(r#"{"columns":[]}"#).unwrap();
        assert_eq!(config.view, View::Table);
    }

    #[test]
    fn incluye_subcarpetas_si_se_pide() {
        let dir = vault();
        let root = dir.path();
        let names = |db: &Database| -> Vec<String> {
            db.rows
                .iter()
                .map(|r| format!("{}|{}", r.subfolder, r.name))
                .collect()
        };
        assert!(!names(&load(root, "Tareas").unwrap()).contains(&"Sub|Otra".to_string()));

        let tareas = root.join("Tareas");
        let mut config = read_config(&tareas);
        config.subfolders = true;
        write_config(&tareas, &config).unwrap();
        let db = load(root, "Tareas").unwrap();
        assert!(names(&db).contains(&"Sub|Otra".to_string()));
        assert!(names(&db).contains(&"|Comprar pan".to_string()));
        assert!(db.columns.iter().any(|c| c.name == "no"));

        // Renombrar también llega a las de las subcarpetas.
        rename_property(root, "Tareas", "no", "sí").unwrap();
        assert!(read(root, "Tareas/Sub/Otra.md").contains("sí: cuenta"));
    }

    #[test]
    fn detecta_fechas() {
        assert!(is_date("2026-10-20"));
        assert!(!is_date("2026/10/20"));
        assert!(!is_date("hoy"));
    }
}
