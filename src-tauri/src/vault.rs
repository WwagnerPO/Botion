use notify_debouncer_mini::notify::{RecommendedWatcher, RecursiveMode};
use notify_debouncer_mini::{DebounceEventResult, Debouncer, new_debouncer};
use serde::Serialize;
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

use crate::index::Index;

/// Carpeta abierta actualmente como bóveda, su índice y el vigilante de
/// sus cambios.
#[derive(Default)]
pub struct VaultState {
    root: Mutex<Option<PathBuf>>,
    pub(crate) index: Arc<Mutex<Option<Index>>>,
    watcher: Mutex<Option<Debouncer<RecommendedWatcher>>>,
}

/// Nodo del árbol de la bóveda: una carpeta o una nota `.md`.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum TreeNode {
    Folder {
        name: String,
        path: String,
        children: Vec<TreeNode>,
    },
    Note {
        name: String,
        path: String,
    },
}

#[derive(Debug, Serialize)]
pub struct Vault {
    pub name: String,
    pub root: String,
    pub tree: Vec<TreeNode>,
}

fn is_hidden(name: &str) -> bool {
    name.starts_with('.')
}

pub(crate) fn is_markdown(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .is_some_and(|e| e.eq_ignore_ascii_case("md"))
}

/// Ruta relativa a la raíz, siempre con `/` como separador.
fn relative(root: &Path, path: &Path) -> String {
    path.strip_prefix(root)
        .unwrap_or(path)
        .components()
        .map(|c| c.as_os_str().to_string_lossy())
        .collect::<Vec<_>>()
        .join("/")
}

/// Lee una carpeta de forma recursiva. Ignora ficheros y carpetas ocultos
/// (`.git`, `.obsidian`...) y cualquier fichero que no sea `.md`.
pub fn read_tree(root: &Path, dir: &Path) -> std::io::Result<Vec<TreeNode>> {
    let mut folders = Vec::new();
    let mut notes = Vec::new();

    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if is_hidden(&name) {
            continue;
        }
        let path = entry.path();
        let file_type = entry.file_type()?;

        if file_type.is_dir() {
            folders.push(TreeNode::Folder {
                children: read_tree(root, &path)?,
                path: relative(root, &path),
                name,
            });
        } else if file_type.is_file() && is_markdown(&path) {
            notes.push(TreeNode::Note {
                name: name[..name.len() - 3].to_string(),
                path: relative(root, &path),
            });
        }
    }

    let key = |n: &TreeNode| match n {
        TreeNode::Folder { name, .. } | TreeNode::Note { name, .. } => name.to_lowercase(),
    };
    folders.sort_by_key(key);
    notes.sort_by_key(key);
    folders.extend(notes);
    Ok(folders)
}

/// Todas las notas del árbol, como rutas relativas.
pub fn flatten(tree: &[TreeNode], out: &mut Vec<String>) {
    for node in tree {
        match node {
            TreeNode::Folder { children, .. } => flatten(children, out),
            TreeNode::Note { path, .. } => out.push(path.clone()),
        }
    }
}

/// Une `rel` a la raíz sin permitir salir de ella (`..`, rutas absolutas).
pub fn resolve(root: &Path, rel: &str) -> Result<PathBuf, String> {
    let rel = Path::new(rel);
    if !rel.components().all(|c| matches!(c, Component::Normal(_))) {
        return Err("Ruta no válida".into());
    }
    Ok(root.join(rel))
}

pub(crate) fn current_root(state: &VaultState) -> Result<PathBuf, String> {
    state
        .root
        .lock()
        .map_err(|_| "Estado bloqueado".to_string())?
        .clone()
        .ok_or_else(|| "No hay ninguna bóveda abierta".into())
}

pub(crate) fn tree_of(root: &Path) -> Result<Vec<TreeNode>, String> {
    read_tree(root, root).map_err(|e| format!("No se pudo leer la carpeta: {e}"))
}

/// Avisa a la interfaz con el evento `vault-changed` cuando cambian las
/// notas o carpetas desde fuera de la app (otro editor, el explorador...).
fn watch(
    app: AppHandle,
    root: PathBuf,
    initial: Vec<TreeNode>,
    index: Arc<Mutex<Option<Index>>>,
) -> Option<Debouncer<RecommendedWatcher>> {
    let watch_root = root.clone();
    let mut last = initial;
    let mut debouncer = new_debouncer(
        Duration::from_millis(300),
        move |result: DebounceEventResult| {
            let Ok(events) = result else { return };
            // Ignora ficheros ocultos: .git, temporales de guardado...
            let relevant = events.iter().any(|e| {
                e.path.strip_prefix(&root).is_ok_and(|rel| {
                    !rel.components()
                        .any(|c| c.as_os_str().to_string_lossy().starts_with('.'))
                })
            });
            if !relevant {
                return;
            }
            if let Ok(mut guard) = index.lock()
                && let Some(index) = guard.as_mut()
            {
                let _ = index.sync();
            }
            if let Ok(tree) = read_tree(&root, &root)
                && tree != last
            {
                let _ = app.emit("vault-changed", &tree);
                last = tree;
            }
        },
    )
    .ok()?;
    debouncer
        .watcher()
        .watch(&watch_root, RecursiveMode::Recursive)
        .ok()?;
    Some(debouncer)
}

#[tauri::command(async)]
pub fn open_vault(
    path: String,
    app: AppHandle,
    state: tauri::State<'_, VaultState>,
) -> Result<Vault, String> {
    let root = fs::canonicalize(&path).map_err(|e| format!("No se pudo abrir la carpeta: {e}"))?;
    if !root.is_dir() {
        return Err("La ruta no es una carpeta".into());
    }
    let tree = tree_of(&root)?;
    let vault = Vault {
        name: root
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_else(|| root.to_string_lossy().into_owned()),
        root: root.to_string_lossy().into_owned(),
        tree,
    };
    // Se deja de vigilar la bóveda anterior antes de cambiar de índice.
    *state.watcher.lock().map_err(|_| "Estado bloqueado")? = None;
    let cache = app
        .path()
        .app_cache_dir()
        .map_err(|e| format!("No se encontró la carpeta de caché: {e}"))?;
    fs::create_dir_all(&cache).map_err(|e| format!("No se pudo crear la caché: {e}"))?;
    let mut index = Index::open(&crate::index::db_path(&cache, &root), &root)
        .map_err(|e| format!("No se pudo abrir el índice: {e}"))?;
    index
        .sync()
        .map_err(|e| format!("No se pudo indexar la bóveda: {e}"))?;
    *state.index.lock().map_err(|_| "Índice bloqueado")? = Some(index);

    let watcher = watch(app, root.clone(), vault.tree.clone(), state.index.clone());
    *state.watcher.lock().map_err(|_| "Estado bloqueado")? = watcher;
    *state.root.lock().map_err(|_| "Estado bloqueado")? = Some(root);
    Ok(vault)
}

/// Vuelve a leer el árbol de la bóveda abierta.
#[tauri::command]
pub fn refresh_tree(state: tauri::State<VaultState>) -> Result<Vec<TreeNode>, String> {
    tree_of(&current_root(&state)?)
}

#[tauri::command]
pub fn read_note(path: String, state: tauri::State<VaultState>) -> Result<String, String> {
    let root = current_root(&state)?;
    let file = resolve(&root, &path)?;
    if !is_markdown(&file) {
        return Err("Solo se pueden abrir ficheros .md".into());
    }
    fs::read_to_string(&file).map_err(|e| format!("No se pudo leer la nota: {e}"))
}

/// Escribe el contenido en un fichero temporal oculto y luego lo renombra,
/// para que la nota nunca quede a medio escribir si algo falla.
pub fn write_atomic(file: &Path, content: &str) -> std::io::Result<()> {
    let name = file
        .file_name()
        .ok_or_else(|| std::io::Error::other("Ruta sin nombre de fichero"))?
        .to_string_lossy();
    let tmp = file.with_file_name(format!(".{name}.botion-tmp"));
    fs::write(&tmp, content)?;
    fs::rename(&tmp, file).inspect_err(|_| {
        let _ = fs::remove_file(&tmp);
    })
}

#[tauri::command]
pub fn write_note(
    path: String,
    content: String,
    state: tauri::State<VaultState>,
) -> Result<(), String> {
    let root = current_root(&state)?;
    let file = resolve(&root, &path)?;
    if !is_markdown(&file) {
        return Err("Solo se pueden guardar ficheros .md".into());
    }
    if !file.is_file() {
        return Err("La nota ya no existe".into());
    }
    write_atomic(&file, &content).map_err(|e| format!("No se pudo guardar la nota: {e}"))?;
    // Al momento, sin esperar al vigilante, para que la búsqueda y los
    // backlinks vean el cambio enseguida.
    crate::index::with_index(&state, |i| i.update(&path))
}

/// Pone el índice al día tras crear, renombrar o borrar desde la app.
pub(crate) fn sync_index(state: &VaultState) -> Result<(), String> {
    crate::index::with_index(state, |i| i.sync())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn touch(path: &Path) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, "# hola").unwrap();
    }

    #[test]
    fn arbol_ordenado_y_filtrado() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        touch(&root.join("zeta.md"));
        touch(&root.join("Alfa.md"));
        touch(&root.join("imagen.png"));
        touch(&root.join(".obsidian/config.md"));
        touch(&root.join("Proyectos/botion.md"));
        fs::create_dir(root.join("Vacía")).unwrap();

        let tree = read_tree(root, root).unwrap();
        assert_eq!(
            tree,
            vec![
                TreeNode::Folder {
                    name: "Proyectos".into(),
                    path: "Proyectos".into(),
                    children: vec![TreeNode::Note {
                        name: "botion".into(),
                        path: "Proyectos/botion.md".into(),
                    }],
                },
                TreeNode::Folder {
                    name: "Vacía".into(),
                    path: "Vacía".into(),
                    children: vec![],
                },
                TreeNode::Note {
                    name: "Alfa".into(),
                    path: "Alfa.md".into(),
                },
                TreeNode::Note {
                    name: "zeta".into(),
                    path: "zeta.md".into(),
                },
            ]
        );
    }

    #[test]
    fn escritura_atomica() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("nota.md");
        fs::write(&file, "viejo").unwrap();

        write_atomic(&file, "nuevo").unwrap();

        assert_eq!(fs::read_to_string(&file).unwrap(), "nuevo");
        assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 1);
    }

    #[test]
    fn resolve_no_sale_de_la_raiz() {
        let root = Path::new("/boveda");
        assert_eq!(
            resolve(root, "a/b.md").unwrap(),
            PathBuf::from("/boveda/a/b.md")
        );
        assert!(resolve(root, "../secreto.md").is_err());
        assert!(resolve(root, "a/../../secreto.md").is_err());
        assert!(resolve(root, "/etc/passwd").is_err());
    }
}
