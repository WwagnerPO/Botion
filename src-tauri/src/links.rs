//! Enlaces entre notas con la sintaxis `[[nota]]`, como en Obsidian:
//! `[[nota|texto]]` cambia el texto mostrado y `[[nota#sección]]` apunta a
//! una sección (de momento se abre la nota entera).

use crate::vault;
use serde::Serialize;
use std::path::Path;

/// Recorre los enlaces `[[...]]` de una nota, ignorando los bloques de
/// código y el código en línea. Llama a `f` con la posición (en bytes) del
/// texto de dentro de los corchetes.
fn scan_links(content: &str, mut f: impl FnMut(std::ops::Range<usize>)) {
    let mut in_fence = false;
    let mut line_start = 0;

    for line in content.split_inclusive('\n') {
        let offset = line_start;
        line_start += line.len();
        if line.trim_start().starts_with("```") {
            in_fence = !in_fence;
            continue;
        }
        if in_fence {
            continue;
        }
        let mut seg_start = offset;
        for (i, segment) in line.split('`').enumerate() {
            let base = seg_start;
            seg_start += segment.len() + 1;
            // Los segmentos impares están dentro de `código`.
            if i % 2 == 1 {
                continue;
            }
            let mut pos = 0;
            while let Some(start) = segment[pos..].find("[[") {
                let inner_start = pos + start + 2;
                let Some(len) = segment[inner_start..].find("]]") else {
                    break;
                };
                let inner_end = inner_start + len;
                if !segment[inner_start..inner_end].contains('\n') {
                    f(base + inner_start..base + inner_end);
                }
                pos = inner_end + 2;
            }
        }
    }
}

/// Destinos de todos los enlaces `[[...]]` de una nota, sin alias ni sección.
#[cfg(test)]
pub fn parse_links(content: &str) -> Vec<String> {
    let mut links = Vec::new();
    scan_links(content, |range| {
        let target = link_target(&content[range]);
        if !target.is_empty() {
            links.push(target.to_string());
        }
    });
    links
}

/// Como [`parse_links`], pero junto a cada destino devuelve la línea donde
/// aparece, para mostrarla como contexto.
pub fn links_with_lines(content: &str) -> Vec<(String, String)> {
    let mut links = Vec::new();
    scan_links(content, |range| {
        let target = link_target(&content[range.clone()]);
        if target.is_empty() {
            return;
        }
        let start = content[..range.start].rfind('\n').map_or(0, |i| i + 1);
        let end = content[range.end..]
            .find('\n')
            .map_or(content.len(), |i| range.end + i);
        links.push((target.to_string(), snippet(&content[start..end])));
    });
    links
}

/// Cambia el destino de los enlaces de una nota. `f` recibe el destino
/// actual y devuelve el nuevo, o `None` para dejarlo igual. El alias y la
/// sección se conservan.
pub fn rewrite_links(content: &str, mut f: impl FnMut(&str) -> Option<String>) -> String {
    let mut edits = Vec::new();
    scan_links(content, |range| {
        let inner = &content[range.clone()];
        let target_len = inner.find(['|', '#']).unwrap_or(inner.len());
        let target = inner[..target_len].trim();
        if target.is_empty() {
            return;
        }
        if let Some(new_target) = f(target) {
            edits.push((range.start..range.start + target_len, new_target));
        }
    });

    let mut out = content.to_string();
    for (range, new_target) in edits.into_iter().rev() {
        out.replace_range(range, &new_target);
    }
    out
}

fn link_target(inner: &str) -> &str {
    let inner = inner.split('|').next().unwrap_or("");
    inner.split('#').next().unwrap_or("").trim()
}

pub(crate) fn stem(path: &str) -> &str {
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

fn snippet(line: &str) -> String {
    const MAX: usize = 160;
    let line = line.trim();
    if line.chars().count() <= MAX {
        line.to_string()
    } else {
        line.chars().take(MAX).collect::<String>() + "…"
    }
}

pub(crate) fn all_notes(root: &Path) -> Result<Vec<String>, String> {
    let tree =
        vault::read_tree(root, root).map_err(|e| format!("No se pudo leer la bóveda: {e}"))?;
    let mut notes = Vec::new();
    vault::flatten(&tree, &mut notes);
    Ok(notes)
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
    fn reescribe_enlaces_conservando_alias() {
        let md = "Ver [[Ideas]], [[Ideas|mis ideas]] y [[ideas#Plan]].\n\
                  `[[Ideas]]` no cambia, [[Otra]] tampoco.\n";
        let out = rewrite_links(md, |t| {
            t.eq_ignore_ascii_case("ideas")
                .then(|| "Proyectos/Lluvia".to_string())
        });
        assert_eq!(
            out,
            "Ver [[Proyectos/Lluvia]], [[Proyectos/Lluvia|mis ideas]] y \
             [[Proyectos/Lluvia#Plan]].\n`[[Ideas]]` no cambia, [[Otra]] tampoco.\n"
        );
    }
}
