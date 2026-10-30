//! Bases de datos: una carpeta con un fichero `.botion-db.json` se ve como
//! una tabla. Cada nota de la carpeta es una fila y sus propiedades
//! (frontmatter) son las columnas.
//!
//! El fichero solo guarda la configuración (columnas, tipos, vistas con sus
//! filtros y orden); los datos siempre están en las notas. Las columnas
//! calculadas (fórmulas, rollups, fechas del fichero) se calculan en la
//! interfaz y no se escriben en las notas.

use crate::props::{self, Props};
use crate::vault::{self, VaultState, write_atomic};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;
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
    Url,
    Email,
    Phone,
    /// Lista de enlaces a adjuntos.
    Files,
    /// Lista de enlaces `[[nota]]` a filas de otra base de datos.
    Relation,
    /// Calculadas: no se guardan en las notas.
    Rollup,
    Formula,
    Created,
    Edited,
}

/// Valor que se saca de las filas relacionadas (Notion lo llama «rollup»).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Rollup {
    /// Columna de relación de esta base de datos.
    pub relation: String,
    /// Propiedad de la base de datos relacionada.
    pub property: String,
    /// Cómo se resumen los valores: `count`, `sum`, `average`...
    pub function: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Column {
    pub name: String,
    pub kind: Kind,
    /// Expresión de las columnas de tipo fórmula.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub formula: Option<String>,
    /// Carpeta de la base de datos a la que apunta una relación.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub relation: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rollup: Option<Rollup>,
}

impl Column {
    fn new(name: String, kind: Kind) -> Self {
        Column {
            name,
            kind,
            formula: None,
            relation: None,
            rollup: None,
        }
    }
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
    Gallery,
    List,
    Timeline,
    Chart,
}

impl View {
    fn label(self) -> &'static str {
        match self {
            View::Table => "Tabla",
            View::Board => "Kanban",
            View::Calendar => "Calendario",
            View::Gallery => "Galería",
            View::List => "Lista",
            View::Timeline => "Cronograma",
            View::Chart => "Gráfico",
        }
    }
}

/// Condición de un filtro: `column` `op` `value` («estado es Hecho»).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Filter {
    pub column: String,
    pub op: String,
    #[serde(default)]
    pub value: Value,
}

/// Gráfico de una vista: barras, líneas o tarta.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(default)]
pub struct Chart {
    /// `bar`, `line` o `pie`.
    pub kind: String,
    /// Columna de las categorías (eje X o porciones).
    pub x: Option<String>,
    /// Columna numérica que se resume (sin ella, se cuentan filas).
    pub y: Option<String>,
    /// `count`, `sum`, `average`, `min` o `max`.
    pub function: String,
}

/// Formato condicional: las filas que cumplen la condición se colorean.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ColorRule {
    pub column: String,
    pub op: String,
    #[serde(default)]
    pub value: Value,
    pub color: String,
}

/// Tareas que se repiten: al marcar `done`, la fecha avanza según la regla
/// de la columna `repeat` y la fila vuelve a estar pendiente.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(default)]
pub struct Recurrence {
    pub repeat: String,
    pub date: String,
    pub done: String,
    /// Para una selección: el valor que cuenta como hecho y al que se vuelve.
    pub done_value: Option<String>,
    pub todo_value: Option<String>,
}

/// Una vista guardada: tipo, filtros, orden y cómo se ven las columnas.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(default)]
pub struct ViewConfig {
    pub id: String,
    pub name: String,
    pub kind: View,
    pub filters: Vec<Filter>,
    pub sort: Option<Sort>,
    /// Agrupar (kanban, tabla, lista, galería).
    pub group_by: Option<String>,
    /// Fecha del calendario, o inicio en el cronograma.
    pub date_by: Option<String>,
    /// Fecha de fin en el cronograma.
    pub end_by: Option<String>,
    /// Columnas ocultas en esta vista.
    pub hidden: Vec<String>,
    /// Ancho de las columnas de la tabla, en píxeles.
    pub widths: BTreeMap<String, u32>,
    /// Total al pie de cada columna (`count`, `sum`...).
    pub totals: BTreeMap<String, String>,
    /// Ajustes de la vista de gráfico.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub chart: Option<Chart>,
    /// Colores de las filas (formato condicional).
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub colors: Vec<ColorRule>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(default)]
pub struct Config {
    pub columns: Vec<Column>,
    pub views: Vec<ViewConfig>,
    /// Vista con la que se abre.
    pub active_view: Option<String>,
    /// Incluir también las notas de las subcarpetas.
    pub subfolders: bool,
    /// Tareas que se repiten.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub recurrence: Option<Recurrence>,
    // Formato antiguo (una sola vista): se lee y se pasa a `views`.
    #[serde(skip_serializing)]
    sort: Option<Sort>,
    #[serde(skip_serializing)]
    view: View,
    #[serde(skip_serializing)]
    group_by: Option<String>,
    #[serde(skip_serializing)]
    date_by: Option<String>,
}

impl Config {
    /// Pasa el formato antiguo a vistas y asegura que hay al menos una.
    fn normalize(mut self) -> Self {
        if self.views.is_empty() {
            self.views.push(ViewConfig {
                id: "vista-1".into(),
                name: self.view.label().into(),
                kind: self.view,
                sort: self.sort.take(),
                group_by: self.group_by.take(),
                date_by: self.date_by.take(),
                ..Default::default()
            });
        }
        if !self
            .active_view
            .as_ref()
            .is_some_and(|id| self.views.iter().any(|v| &v.id == id))
        {
            self.active_view = Some(self.views[0].id.clone());
        }
        self
    }

    /// Cambia (o quita, con `None`) las referencias a una columna.
    fn rename_refs(&mut self, old: &str, new: Option<&str>) {
        let swap = |slot: &mut Option<String>| {
            if slot.as_deref() == Some(old) {
                *slot = new.map(str::to_string);
            }
        };
        for view in &mut self.views {
            swap(&mut view.group_by);
            swap(&mut view.date_by);
            swap(&mut view.end_by);
            if view.sort.as_ref().is_some_and(|s| s.column == old) {
                view.sort = new.map(|n| Sort {
                    column: n.to_string(),
                    desc: view.sort.as_ref().is_some_and(|s| s.desc),
                });
            }
            view.filters.retain_mut(|f| {
                if f.column != old {
                    return true;
                }
                new.map(|n| f.column = n.to_string()).is_some()
            });
            view.hidden.retain_mut(|h| {
                if h != old {
                    return true;
                }
                new.map(|n| *h = n.to_string()).is_some()
            });
            for map in [&mut view.widths as &mut dyn RenameKey, &mut view.totals] {
                map.rename_key(old, new);
            }
            view.colors.retain_mut(|r| {
                if r.column != old {
                    return true;
                }
                new.map(|n| r.column = n.to_string()).is_some()
            });
            if let Some(chart) = &mut view.chart {
                swap(&mut chart.x);
                swap(&mut chart.y);
            }
        }
        if let Some(r) = &mut self.recurrence {
            let mut gone = false;
            for slot in [&mut r.repeat, &mut r.date, &mut r.done] {
                if slot == old {
                    match new {
                        Some(n) => *slot = n.to_string(),
                        None => gone = true,
                    }
                }
            }
            if gone {
                self.recurrence = None;
            }
        }
        for col in &mut self.columns {
            if let Some(rollup) = &mut col.rollup
                && rollup.relation == old
                && let Some(n) = new
            {
                rollup.relation = n.to_string();
            }
            if let (Some(formula), Some(n)) = (&mut col.formula, new) {
                for quote in ['"', '\''] {
                    *formula = formula.replace(
                        &format!("prop({quote}{old}{quote})"),
                        &format!("prop({quote}{n}{quote})"),
                    );
                }
            }
        }
    }
}

trait RenameKey {
    fn rename_key(&mut self, old: &str, new: Option<&str>);
}

impl<V> RenameKey for BTreeMap<String, V> {
    fn rename_key(&mut self, old: &str, new: Option<&str>) {
        if let Some(v) = self.remove(old)
            && let Some(n) = new
        {
            self.insert(n.to_string(), v);
        }
    }
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
    /// Creación y última modificación del fichero, en milisegundos.
    pub created: Option<u64>,
    pub modified: Option<u64>,
}

#[derive(Debug, Serialize)]
pub struct Database {
    pub path: String,
    pub name: String,
    pub columns: Vec<Column>,
    pub views: Vec<ViewConfig>,
    pub active_view: Option<String>,
    pub subfolders: bool,
    pub recurrence: Option<Recurrence>,
    /// Plantillas de la base de datos (notas de `.plantillas/`).
    pub templates: Vec<Template>,
    pub rows: Vec<Row>,
}

#[derive(Debug, Serialize, PartialEq)]
pub struct Template {
    pub name: String,
    pub path: String,
}

/// Carpeta oculta con las plantillas de una base de datos.
pub const TEMPLATES_DIR: &str = ".plantillas";

fn templates(root: &Path, folder: &str) -> Vec<Template> {
    let rel = if folder.is_empty() {
        TEMPLATES_DIR.to_string()
    } else {
        format!("{folder}/{TEMPLATES_DIR}")
    };
    let Ok(entries) = fs::read_dir(root.join(&rel)) else {
        return Vec::new();
    };
    let mut out: Vec<Template> = entries
        .flatten()
        .map(|e| e.path())
        .filter(|p| p.is_file() && vault::is_markdown(p))
        .filter_map(|p| {
            let file = p.file_name()?.to_str()?.to_string();
            Some(Template {
                name: stem(&file),
                path: format!("{rel}/{file}"),
            })
        })
        .collect();
    out.sort_by_key(|a| a.name.to_lowercase());
    out
}

fn millis(time: std::io::Result<std::time::SystemTime>) -> Option<u64> {
    let since = time.ok()?.duration_since(std::time::UNIX_EPOCH).ok()?;
    u64::try_from(since.as_millis()).ok()
}

pub fn is_database(dir: &Path) -> bool {
    dir.join(CONFIG_FILE).is_file()
}

/// Tipo de columna más probable a partir de un valor.
fn infer(value: &Value) -> Kind {
    match value {
        Value::Bool(_) => Kind::Checkbox,
        Value::Number(_) => Kind::Number,
        // Una lista de enlaces `[[nota]]` es una relación (como en Obsidian).
        Value::Array(items) if !items.is_empty() && items.iter().all(is_link) => Kind::Relation,
        Value::Array(_) => Kind::Tags,
        Value::String(s) if is_date(s) => Kind::Date,
        _ => Kind::Text,
    }
}

fn is_link(value: &Value) -> bool {
    value
        .as_str()
        .is_some_and(|s| s.trim().starts_with("[[") && s.trim().ends_with("]]"))
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
        .and_then(|s| serde_json::from_str::<Config>(&s).ok())
        .unwrap_or_default()
        .normalize()
}

fn write_config(dir: &Path, config: &Config) -> Result<(), String> {
    let json = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    write_atomic(&dir.join(CONFIG_FILE), &(json + "\n"))
        .map_err(|e| format!("No se pudo guardar la base de datos: {e}"))
}

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
            let meta = fs::metadata(root.join(&path)).ok();
            let modified = meta.as_ref().and_then(|m| millis(m.modified()));
            Row {
                created: meta.as_ref().and_then(|m| millis(m.created())).or(modified),
                modified,
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
                columns.push(Column::new(key.clone(), infer(value)));
            }
        }
    }

    Ok(Database {
        path: folder.to_string(),
        name: folder.rsplit('/').next().unwrap_or(folder).to_string(),
        columns,
        views: config.views,
        active_view: config.active_view,
        subfolders: config.subfolders,
        recurrence: config.recurrence,
        templates: templates(root, folder),
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
) -> Result<(Vec<String>, Vec<String>), String> {
    let mut changed = Vec::new();
    let mut failed = Vec::new();
    let subfolders = read_config(&vault::resolve_dir(root, folder)?).subfolders;
    // Si una nota falla se sigue con las demás, para no dejar el cambio a
    // medias, y se avisa al final de cuáles no se pudieron tocar.
    for path in row_paths(root, folder, subfolders)? {
        let file = root.join(&path);
        let Ok(content) = fs::read_to_string(&file) else {
            failed.push(path);
            continue;
        };
        // Las notas con frontmatter no válido se dejan como están.
        if let Ok(Some(updated)) = f(&content)
            && updated != content
        {
            if write_atomic(&file, &updated).is_ok() {
                changed.push(path);
            } else {
                failed.push(path);
            }
        }
    }
    Ok((changed, failed))
}

/// Error con las notas que no se pudieron cambiar, si hay alguna.
fn report(failed: Vec<String>) -> Result<(), String> {
    if failed.is_empty() {
        Ok(())
    } else {
        Err(format!(
            "No se pudieron cambiar estas notas: {}",
            failed.join(", ")
        ))
    }
}

pub fn rename_property(root: &Path, folder: &str, old: &str, new: &str) -> Result<(), String> {
    let new = valid_property(new)?;
    let dir = vault::resolve_dir(root, folder)?;
    let mut config = read_config(&dir);
    if old != new && config.columns.iter().any(|c| c.name == new) {
        return Err(format!("Ya existe la propiedad «{new}»"));
    }
    let (_, failed) = update_rows(root, folder, |c| props::rename(c, old, new))?;
    for col in &mut config.columns {
        if col.name == old {
            col.name = new.to_string();
        }
    }
    config.rename_refs(old, Some(new));
    write_config(&dir, &config)?;
    report(failed)
}

pub fn delete_property(root: &Path, folder: &str, key: &str) -> Result<(), String> {
    let dir = vault::resolve_dir(root, folder)?;
    let mut config = read_config(&dir);
    let (_, failed) = update_rows(root, folder, |c| {
        if props::read(c)?.contains_key(key) {
            props::set(c, key, None).map(Some)
        } else {
            Ok(None)
        }
    })?;
    config.columns.retain(|c| c.name != key);
    config.rename_refs(key, None);
    write_config(&dir, &config)?;
    report(failed)
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
    write_config(&vault::resolve_dir(&root, &path)?, &config.normalize())
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

/// Propiedades de un texto con frontmatter (p. ej. una plantilla ya con las
/// variables sustituidas).
/// Crea una plantilla vacía para la base de datos y devuelve su ruta.
#[tauri::command]
pub fn create_db_template(
    path: String,
    name: String,
    state: tauri::State<VaultState>,
) -> Result<String, String> {
    let root = vault::current_root(&state)?;
    let dir = vault::resolve_dir(&root, &path)?;
    let name = name.trim();
    if !crate::files::valid_name(name) {
        return Err(format!("«{name}» no es un nombre válido"));
    }
    let folder = dir.join(TEMPLATES_DIR);
    fs::create_dir_all(&folder).map_err(|e| format!("No se pudo crear la carpeta: {e}"))?;
    let file = folder.join(format!("{name}.md"));
    if file.exists() {
        return Err("Ya existe una plantilla con ese nombre".into());
    }
    fs::write(&file, "# {{titulo}}\n\n")
        .map_err(|e| format!("No se pudo crear la plantilla: {e}"))?;
    Ok(if path.is_empty() {
        format!("{TEMPLATES_DIR}/{name}.md")
    } else {
        format!("{path}/{TEMPLATES_DIR}/{name}.md")
    })
}

#[tauri::command]
pub fn parse_properties(content: String) -> Result<Props, String> {
    props::read(&content)
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
        let view = &mut config.views[0];
        view.kind = View::Board;
        view.group_by = Some("estado".into());
        view.hidden = vec!["estado".into()];
        view.widths.insert("estado".into(), 200);
        view.totals.insert("estado".into(), "count".into());
        view.sort = Some(Sort {
            column: "estado".into(),
            desc: true,
        });
        view.filters.push(Filter {
            column: "estado".into(),
            op: "is".into(),
            value: json!("Hecho"),
        });
        config.columns.push(Column {
            formula: Some(r#"concat(prop("estado"), "!")"#.into()),
            ..Column::new("grito".into(), Kind::Formula)
        });
        write_config(&tareas, &config).unwrap();

        rename_property(root, "Tareas", "estado", "fase").unwrap();
        let config = read_config(&tareas);
        let view = &config.views[0];
        assert_eq!(view.kind, View::Board);
        assert_eq!(view.group_by.as_deref(), Some("fase"));
        assert_eq!(view.hidden, ["fase"]);
        assert_eq!(view.widths.get("fase"), Some(&200));
        assert_eq!(view.totals.get("fase").map(String::as_str), Some("count"));
        assert_eq!(
            view.sort.as_ref().map(|s| (s.column.as_str(), s.desc)),
            Some(("fase", true))
        );
        assert_eq!(view.filters[0].column, "fase");
        assert_eq!(
            config
                .columns
                .iter()
                .find(|c| c.name == "grito")
                .unwrap()
                .formula
                .as_deref(),
            Some(r#"concat(prop("fase"), "!")"#)
        );

        delete_property(root, "Tareas", "fase").unwrap();
        let view = &read_config(&tareas).views[0];
        assert_eq!(view.group_by, None);
        assert!(view.hidden.is_empty() && view.filters.is_empty() && view.sort.is_none());
        assert!(view.widths.is_empty() && view.totals.is_empty());
    }

    #[test]
    fn configuracion_antigua_pasa_a_vistas() {
        let config = serde_json::from_str::<Config>(r#"{"columns":[]}"#)
            .unwrap()
            .normalize();
        assert_eq!(config.views.len(), 1);
        assert_eq!(config.views[0].kind, View::Table);
        assert_eq!(config.active_view.as_deref(), Some("vista-1"));

        let old = r#"{"columns":[],"view":"board","group_by":"estado","sort":{"column":"x","desc":false}}"#;
        let config = serde_json::from_str::<Config>(old).unwrap().normalize();
        let view = &config.views[0];
        assert_eq!((view.kind, view.name.as_str()), (View::Board, "Kanban"));
        assert_eq!(view.group_by.as_deref(), Some("estado"));
        assert_eq!(view.sort.as_ref().map(|s| s.column.as_str()), Some("x"));
        // Al guardar ya no se escribe el formato antiguo.
        let json = serde_json::to_value(&config).unwrap();
        assert!(json.get("view").is_none() && json.get("group_by").is_none());
    }

    #[test]
    fn filas_con_fechas_del_fichero() {
        let dir = vault();
        let db = load(dir.path(), "Tareas").unwrap();
        assert!(
            db.rows
                .iter()
                .all(|r| r.created.is_some() && r.modified.is_some())
        );
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
    fn listas_de_enlaces_son_relaciones() {
        assert_eq!(infer(&json!(["[[Web]]", "[[App|la app]]"])), Kind::Relation);
        assert_eq!(infer(&json!(["casa", "[[Web]]"])), Kind::Tags);
        assert_eq!(infer(&json!([])), Kind::Tags);
    }

    #[test]
    fn detecta_fechas() {
        assert!(is_date("2026-10-20"));
        assert!(!is_date("2026/10/20"));
        assert!(!is_date("hoy"));
    }

    #[test]
    fn renombrar_cambia_colores_grafico_y_repeticion() {
        let mut config: Config = serde_json::from_str(
            r#"{"views":[{"id":"v","name":"G","kind":"chart","chart":{"kind":"bar","x":"estado","y":"horas","function":"sum"},
            "colors":[{"column":"estado","op":"is","value":"Hecho","color":"verde"}]}],
            "recurrence":{"repeat":"repetir","date":"fecha","done":"estado","done_value":"Hecho"}}"#,
        )
        .unwrap();
        config.rename_refs("estado", Some("fase"));
        let v = &config.views[0];
        assert_eq!(v.chart.as_ref().unwrap().x.as_deref(), Some("fase"));
        assert_eq!(v.colors[0].column, "fase");
        assert_eq!(config.recurrence.as_ref().unwrap().done, "fase");
        config.rename_refs("fecha", None);
        assert!(config.recurrence.is_none());
        config.rename_refs("fase", None);
        assert!(config.views[0].colors.is_empty());
        let json = serde_json::to_string(&config).unwrap();
        assert!(
            json.contains("\"chart\"")
                && !json.contains("\"colors\"")
                && !json.contains("recurrence")
        );
    }
}
