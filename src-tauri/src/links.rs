//! Enlaces entre notas con la sintaxis `[[nota]]`, como en Obsidian:
//! `[[nota|texto]]` cambia el texto mostrado y `[[nota#sección]]` apunta a
//! una sección (de momento se abre la nota entera).

use crate::vault::{self, VaultState};
use serde::Serialize;
use std::fs;
use std::path::Path;

/// Destinos de todos los enlaces `[[...]]` de una nota, sin alias ni sección.
/// Ignora los bloques de código y el código en línea.
pub fn parse_links(content: &str) -> Vec<String> {
    let mut links = Vec::new();
    let mut in_fence = false;

    for line in content.lines() {
        if line.trim_start().starts_with("```") {
            in_fence = !in_fence;
            continue;
        }
        if in_fence {
            continue;
        }
        for (i, segment) in line.split('`').enumerate() {
            // Los segmentos impares están dentro de `código`.
            if i % 2 == 1 {
                continue;
            }
            let mut rest = segment;
            while let Some(start) = rest.find("[[") {
                let after = &rest[start + 2..];
                let Some(end) = after.find("]]") else { break };
                let target = link_target(&after[..end]);
                if !target.is_empty() {
                    links.push(target.to_string());
                }
                rest = &after[end + 2..];
            }
        }
    }
    links
}

fn link_target(inner: &str) -> &str {
    let inner = inner.split('|').next().unwrap_or("");
    inner.split('#').next().unwrap_or("").trim()
}

fn stem(path: &str) -> &str {
    let name = path.rsplit('/').next().unwrap_or(path);
    name.strip_suffix(".md").unwrap_or(name)
}

fn folder(path: &str) -> &str {
    path.rsplit_once('/').map_or("", |(dir, _)| dir)
}

/// Busca la nota a la que apunta `target`, escrito desde la nota `from`.
///
/// - `[[Nombre]]` busca una nota con ese nombre en cualquier carpeta.
/// - `[[carpeta/Nombre]]` busca por ruta.
///
/// Sin distinguir mayúsculas. Si hay varias, gana la de la misma carpeta
/// que `from` y después la de ruta más corta.
pub fn resolve_link<'a>(target: &str, from: &str, notes: &'a [String]) -> Option<&'a str> {
    let target = target.trim().trim_end_matches(".md").to_lowercase();
    if target.is_empty() {
        return None;
    }
    let from_dir = folder(from);

    notes
        .iter()
        .filter(|path| {
            let no_ext = path.strip_suffix(".md").unwrap_or(path).to_lowercase();
            if target.contains('/') {
                no_ext == target || no_ext.ends_with(&format!("/{target}"))
            } else {
                stem(path).to_lowercase() == target
            }
        })
        .min_by_key(|path| {
            (
                folder(path) != from_dir,
                path.matches('/').count(),
                path.to_lowercase(),
            )
        })
        .map(String::as_str)
}

#[derive(Debug, Serialize, PartialEq)]
pub struct Backlink {
    pub path: String,
    pub name: String,
    /// Línea donde aparece el enlace, para dar contexto.
    pub snippet: String,
}

/// Notas que enlazan a `target_path`.
pub fn backlinks(root: &Path, notes: &[String], target_path: &str) -> Vec<Backlink> {
    let mut result = Vec::new();

    for path in notes {
        if path == target_path {
            continue;
        }
        let Ok(content) = fs::read_to_string(root.join(path)) else {
            continue;
        };
        let links_here = |line: &str| {
            parse_links(line)
                .iter()
                .any(|t| resolve_link(t, path, notes) == Some(target_path))
        };
        if let Some(line) = content.lines().find(|l| links_here(l)) {
            result.push(Backlink {
                path: path.clone(),
                name: stem(path).to_string(),
                snippet: snippet(line),
            });
        }
    }
    result.sort_by_key(|b| b.name.to_lowercase());
    result
}

fn snippet(line: &str) -> String {
    const MAX: usize = 160;
    let line = line.trim();
    if line.chars().count() <= MAX {
        line.to_string()
    } else {
        line.chars().take(MAX).collect::<String>() + "…"
    }
}

fn all_notes(root: &Path) -> Result<Vec<String>, String> {
    let tree =
        vault::read_tree(root, root).map_err(|e| format!("No se pudo leer la bóveda: {e}"))?;
    let mut notes = Vec::new();
    vault::flatten(&tree, &mut notes);
    Ok(notes)
}

#[tauri::command]
pub fn resolve_note_link(
    target: String,
    from: String,
    state: tauri::State<VaultState>,
) -> Result<Option<String>, String> {
    let root = vault::current_root(&state)?;
    let notes = all_notes(&root)?;
    Ok(resolve_link(&target, &from, &notes).map(str::to_string))
}

#[tauri::command]
pub fn get_backlinks(
    path: String,
    state: tauri::State<VaultState>,
) -> Result<Vec<Backlink>, String> {
    let root = vault::current_root(&state)?;
    let notes = all_notes(&root)?;
    Ok(backlinks(&root, &notes, &path))
}

/// Ruta de la nota nueva para un enlace que aún no existe.
fn new_note_path(target: &str) -> Result<String, String> {
    let target = target.trim().trim_end_matches(".md").trim();
    let invalid = |part: &str| {
        part.is_empty()
            || part.starts_with('.')
            || part
                .chars()
                .any(|c| matches!(c, '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|'))
    };
    if target.split('/').any(invalid) {
        return Err(format!("«{target}» no es un nombre de nota válido"));
    }
    Ok(format!("{target}.md"))
}

/// Crea la nota de un enlace `[[...]]` que aún no existe y devuelve su ruta.
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
    Ok(rel)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn notes() -> Vec<String> {
        [
            "Ideas.md",
            "Proyectos/Botion.md",
            "Proyectos/Ideas.md",
            "Archivo/Viejo/Botion.md",
        ]
        .map(String::from)
        .to_vec()
    }

    #[test]
    fn extrae_enlaces() {
        let md = "Ver [[Ideas]] y [[Proyectos/Botion|el proyecto]].\n\
                  Sección: [[Botion#Plan]]. Vacío: [[ ]].\n\
                  `[[no es enlace]]` y [[Sin cerrar\n\
                  ```\n[[en código]]\n```\n\
                  Fin [[Último]]";
        assert_eq!(
            parse_links(md),
            ["Ideas", "Proyectos/Botion", "Botion", "Último"]
        );
    }

    #[test]
    fn resuelve_por_nombre_y_por_ruta() {
        let n = notes();
        // Misma carpeta primero.
        assert_eq!(
            resolve_link("Ideas", "Proyectos/Botion.md", &n),
            Some("Proyectos/Ideas.md")
        );
        // Si no, la ruta más corta.
        assert_eq!(resolve_link("ideas", "Otra/Nota.md", &n), Some("Ideas.md"));
        assert_eq!(
            resolve_link("Botion", "Ideas.md", &n),
            Some("Proyectos/Botion.md")
        );
        // Por ruta, completa o parcial.
        assert_eq!(
            resolve_link("Viejo/Botion", "Ideas.md", &n),
            Some("Archivo/Viejo/Botion.md")
        );
        assert_eq!(resolve_link("No existe", "Ideas.md", &n), None);
    }

    #[test]
    fn calcula_backlinks() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        fs::create_dir(root.join("Proyectos")).unwrap();
        fs::write(root.join("Ideas.md"), "# Ideas\n\nTrabajo en [[Botion]].\n").unwrap();
        fs::write(root.join("Diario.md"), "Hoy nada que ver con [[Otra]].\n").unwrap();
        fs::write(root.join("Proyectos/Botion.md"), "Ver [[Ideas]].\n").unwrap();
        let notes = all_notes(root).unwrap();

        assert_eq!(
            backlinks(root, &notes, "Proyectos/Botion.md"),
            vec![Backlink {
                path: "Ideas.md".into(),
                name: "Ideas".into(),
                snippet: "Trabajo en [[Botion]].".into(),
            }]
        );
    }

    #[test]
    fn valida_nombres_de_notas_nuevas() {
        assert_eq!(new_note_path("Nueva idea").unwrap(), "Nueva idea.md");
        assert_eq!(
            new_note_path("Proyectos/Plan.md").unwrap(),
            "Proyectos/Plan.md"
        );
        assert!(new_note_path("../fuera").is_err());
        assert!(new_note_path(".oculta").is_err());
        assert!(new_note_path("a:b").is_err());
        assert!(new_note_path("").is_err());
    }
}
