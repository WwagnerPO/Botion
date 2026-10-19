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
    // Permite cambiar solo mayúsculas/minúsculas en sistemas que no las distinguen.
    if to.exists() && new_path.to_lowercase() != path.to_lowercase() {
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
