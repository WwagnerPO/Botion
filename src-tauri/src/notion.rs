//! Importar una exportación de Notion («Markdown y CSV», en .zip o ya
//! descomprimida). Las páginas pasan a notas, los enlaces a `[[nota]]`, y
//! cada tabla (CSV) a una base de datos con sus columnas en el frontmatter.

use crate::props;
use crate::vault::{self, VaultState};
use percent_encoding::{AsciiSet, CONTROLS, percent_decode_str, utf8_percent_encode};
use serde::Serialize;
use serde_json::Value;
use std::collections::{BTreeMap, HashMap};
use std::fs;
use std::io::{Cursor, Read};
use std::path::{Path, PathBuf};

const DEST: &str = "Importado de Notion";
const PATH_CHARS: &AsciiSet = &CONTROLS
    .add(b' ')
    .add(b'(')
    .add(b')')
    .add(b'<')
    .add(b'>')
    .add(b'#')
    .add(b'%');

#[derive(Debug, Serialize, PartialEq)]
pub struct Imported {
    pub folder: String,
    pub notes: usize,
    pub databases: usize,
    pub files: usize,
}

/// Quita el identificador que Notion pone al final: «Tareas 1a2b…(32)» → «Tareas».
pub fn strip_id(name: &str) -> String {
    let (stem, ext) = match name.rfind('.') {
        Some(i) if i > 0 => (&name[..i], &name[i..]),
        _ => (name, ""),
    };
    let stem = stem.strip_suffix("_all").unwrap_or(stem);
    let clean = match stem.rsplit_once(' ') {
        Some((base, id)) if id.len() == 32 && id.chars().all(|c| c.is_ascii_hexdigit()) => base,
        _ => stem,
    };
    format!("{}{ext}", clean.trim())
}

/// Ficheros de la exportación (ruta relativa con `/` → bytes). Abre los .zip, también los anidados.
fn collect(source: &Path) -> Result<Vec<(String, Vec<u8>)>, String> {
    let mut out = Vec::new();
    if source.is_dir() {
        let mut stack = vec![source.to_path_buf()];
        while let Some(dir) = stack.pop() {
            for entry in fs::read_dir(&dir).map_err(|e| e.to_string())?.flatten() {
                let p = entry.path();
                if p.is_dir() {
                    stack.push(p);
                } else if let Ok(bytes) = fs::read(&p) {
                    let rel = p
                        .strip_prefix(source)
                        .unwrap()
                        .to_string_lossy()
                        .replace('\\', "/");
                    out.push((rel, bytes));
                }
            }
        }
    } else {
        let bytes =
            fs::read(source).map_err(|e| format!("No se pudo leer «{}»: {e}", source.display()))?;
        unzip(&bytes, "", &mut out)?;
    }
    Ok(out)
}

fn unzip(bytes: &[u8], prefix: &str, out: &mut Vec<(String, Vec<u8>)>) -> Result<(), String> {
    let mut archive = zip::ZipArchive::new(Cursor::new(bytes))
        .map_err(|e| format!("El fichero no es un .zip válido: {e}"))?;
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        if file.is_dir() {
            continue;
        }
        let Some(name) = file.enclosed_name() else {
            continue;
        };
        let name = name.to_string_lossy().replace('\\', "/");
        let mut data = Vec::new();
        file.read_to_end(&mut data).map_err(|e| e.to_string())?;
        // Notion mete a veces la exportación en otro .zip («Part-1.zip»).
        if name.to_lowercase().ends_with(".zip") {
            unzip(&data, prefix, out)?;
        } else {
            out.push((format!("{prefix}{name}"), data));
        }
    }
    Ok(())
}

/// Ruta final de cada fichero, sin identificadores y sin chocar entre sí.
fn rename_all(paths: &[String]) -> HashMap<String, String> {
    let mut used = std::collections::HashSet::new();
    let mut map = HashMap::new();
    for old in paths {
        let parts: Vec<String> = old.split('/').map(strip_id).collect();
        let mut new = parts.join("/");
        if !used.insert(new.to_lowercase()) {
            let (stem, ext) = new
                .rsplit_once('.')
                .map_or((new.clone(), String::new()), |(s, e)| {
                    (s.to_string(), format!(".{e}"))
                });
            let mut n = 2;
            loop {
                let candidate = format!("{stem} {n}{ext}");
                if used.insert(candidate.to_lowercase()) {
                    new = candidate;
                    break;
                }
                n += 1;
            }
        }
        map.insert(old.clone(), new);
    }
    map
}

fn parent(path: &str) -> &str {
    path.rsplit_once('/').map_or("", |(d, _)| d)
}

/// Une una ruta relativa a una carpeta, resolviendo `..` y `.`.
fn join(dir: &str, rel: &str) -> String {
    let mut parts: Vec<&str> = if dir.is_empty() {
        vec![]
    } else {
        dir.split('/').collect()
    };
    for p in rel.split('/') {
        match p {
            "" | "." => {}
            ".." => {
                parts.pop();
            }
            _ => parts.push(p),
        }
    }
    parts.join("/")
}

/// Ruta de `to` vista desde la carpeta `from_dir`.
fn relative(from_dir: &str, to: &str) -> String {
    let a: Vec<&str> = if from_dir.is_empty() {
        vec![]
    } else {
        from_dir.split('/').collect()
    };
    let b: Vec<&str> = to.split('/').collect();
    let common = a.iter().zip(&b).take_while(|(x, y)| x == y).count();
    let mut out: Vec<&str> = std::iter::repeat_n("..", a.len() - common).collect();
    out.extend(&b[common..]);
    out.join("/")
}

fn note_name(path: &str) -> String {
    let file = path.rsplit('/').next().unwrap_or(path);
    file.strip_suffix(".md").unwrap_or(file).to_string()
}

/// Cambia los enlaces de Notion `[texto](Página%20id.md)` por `[[Página]]`
/// y las rutas de imágenes y adjuntos por las nuevas.
fn rewrite_links(markdown: &str, old_path: &str, map: &HashMap<String, String>) -> String {
    let old_dir = parent(old_path);
    let new_dir = parent(&map[old_path]);
    let mut out = String::with_capacity(markdown.len());
    let mut rest = markdown;
    while let Some(start) = rest.find("](") {
        let Some(end) = rest[start + 2..].find(')') else {
            break;
        };
        let url = &rest[start + 2..start + 2 + end];
        let open = rest[..start].rfind('[');
        let decoded = percent_decode_str(url).decode_utf8_lossy().to_string();
        let target = (!url.contains("://") && !url.starts_with('#') && !url.starts_with("mailto:"))
            .then(|| join(old_dir, &decoded))
            .and_then(|t| map.get(&t));
        match (target, open) {
            (Some(new), Some(open)) if new.ends_with(".md") => {
                let image = open > 0 && rest[..open].ends_with('!');
                let text = &rest[open + 1..start];
                let name = note_name(new);
                let before = if image {
                    &rest[..open - 1]
                } else {
                    &rest[..open]
                };
                out.push_str(before);
                if text.trim() == name || text.trim().is_empty() {
                    out.push_str(&format!("[[{name}]]"));
                } else {
                    out.push_str(&format!("[[{name}|{}]]", text.replace(['[', ']', '|'], "")));
                }
            }
            (Some(new), _) => {
                out.push_str(&rest[..start + 2]);
                out.push_str(&utf8_percent_encode(&relative(new_dir, new), PATH_CHARS).to_string());
                out.push(')');
            }
            _ => out.push_str(&rest[..start + 2 + end + 1]),
        }
        rest = &rest[start + 2 + end + 1..];
    }
    out.push_str(rest);
    out
}

/// Valor de una celda del CSV de Notion como propiedad.
fn cell_value(raw: &str) -> Option<Value> {
    let v = raw.trim();
    if v.is_empty() {
        return None;
    }
    match v {
        "Yes" | "Sí" | "Si" => return Some(Value::Bool(true)),
        "No" => return Some(Value::Bool(false)),
        _ => {}
    }
    if let Ok(n) = v.parse::<f64>()
        && let Some(n) = serde_json::Number::from_f64(n)
    {
        return Some(Value::Number(n));
    }
    if let Some(date) = notion_date(v) {
        return Some(Value::String(date));
    }
    // Relaciones: «Web (Proyectos/Web%201a2b.md), App (…)».
    if v.contains(".md)") {
        let links: Vec<Value> = v
            .split("), ")
            .filter_map(|part| {
                part.split_once(" (")
                    .map(|(name, _)| Value::String(format!("[[{}]]", name.trim())))
            })
            .collect();
        if !links.is_empty() {
            return Some(Value::Array(links));
        }
    }
    Some(Value::String(v.to_string()))
}

/// «October 1, 2026» o «October 1, 2026 9:00 AM» → «2026-10-01».
fn notion_date(v: &str) -> Option<String> {
    const MONTHS: [&str; 12] = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
    ];
    let first = v.split(" → ").next()?;
    let mut words = first.split_whitespace();
    let word = words.next()?;
    let month = MONTHS.iter().position(|m| *m == word)? + 1;
    let day: u32 = words.next()?.trim_end_matches(',').parse().ok()?;
    let year: u32 = words.next()?.parse().ok()?;
    (1..=31)
        .contains(&day)
        .then(|| format!("{year:04}-{month:02}-{day:02}"))
}

/// Quita las líneas «Propiedad: valor» que Notion escribe tras el título.
fn drop_inline_props(markdown: &str, keys: &[String]) -> String {
    let mut lines: Vec<&str> = markdown.lines().collect();
    let Some(title) = lines.iter().position(|l| l.starts_with("# ")) else {
        return markdown.to_string();
    };
    let mut i = title + 1;
    while i < lines.len() && lines[i].trim().is_empty() {
        i += 1;
    }
    let start = i;
    while i < lines.len() && keys.iter().any(|k| lines[i].starts_with(&format!("{k}: "))) {
        i += 1;
    }
    if i > start {
        lines.drain(start..i);
    }
    let mut out = lines.join("\n");
    if markdown.ends_with('\n') {
        out.push('\n');
    }
    out
}

/// Importa en `root/Importado de Notion…` y devuelve el resumen.
pub fn import(root: &Path, source: &Path) -> Result<Imported, String> {
    let files = collect(source)?;
    if !files.iter().any(|(p, _)| p.ends_with(".md")) {
        return Err("No hay páginas .md: exporta desde Notion en formato «Markdown y CSV»".into());
    }
    // Una carpeta común (Export-…) no hace falta conservarla.
    let common = files[0].0.split('/').next().unwrap_or("").to_string();
    let strip = files.len() > 1
        && files
            .iter()
            .all(|(p, _)| p.starts_with(&format!("{common}/")));
    let files: Vec<(String, Vec<u8>)> = files
        .into_iter()
        .map(|(p, b)| {
            (
                if strip {
                    p[common.len() + 1..].to_string()
                } else {
                    p
                },
                b,
            )
        })
        .collect();

    let mut folder = DEST.to_string();
    let mut n = 2;
    while root.join(&folder).exists() {
        folder = format!("{DEST} {n}");
        n += 1;
    }
    let paths: Vec<String> = files.iter().map(|(p, _)| p.clone()).collect();
    let map = rename_all(&paths);

    // CSV de cada tabla: el «_all» (con todas las filas) si lo hay.
    let mut tables: BTreeMap<String, &[u8]> = BTreeMap::new();
    for (p, bytes) in &files {
        if p.to_lowercase().ends_with(".csv") {
            let key = map[p].trim_end_matches(".csv").to_string();
            if p.contains("_all.csv") || !tables.contains_key(&key) {
                tables.insert(key, bytes);
            }
        }
    }

    let mut written: HashMap<String, String> = HashMap::new();
    let mut summary = Imported {
        folder: folder.clone(),
        notes: 0,
        databases: 0,
        files: 0,
    };
    for (old, bytes) in &files {
        let new = &map[old];
        if new.ends_with(".csv") {
            continue;
        }
        if new.ends_with(".md") {
            let text = rewrite_links(&String::from_utf8_lossy(bytes), old, &map);
            written.insert(new.clone(), text);
        } else {
            let dest = vault::resolve(root, &format!("{folder}/{new}"))?;
            fs::create_dir_all(dest.parent().unwrap()).map_err(|e| e.to_string())?;
            fs::write(&dest, bytes).map_err(|e| e.to_string())?;
            summary.files += 1;
        }
    }

    // Tablas: carpeta con base de datos y las columnas en el frontmatter.
    for (table, bytes) in &tables {
        let mut reader = csv::ReaderBuilder::new()
            .flexible(true)
            .from_reader(bytes.strip_prefix(b"\xEF\xBB\xBF").unwrap_or(bytes));
        let headers: Vec<String> = reader
            .headers()
            .map_err(|e| e.to_string())?
            .iter()
            .map(|h| h.trim().to_string())
            .collect();
        if headers.is_empty() {
            continue;
        }
        let keys: Vec<String> = headers[1..].to_vec();
        for record in reader.records().flatten() {
            let name = record.get(0).unwrap_or("").trim();
            if name.is_empty() {
                continue;
            }
            let wanted = format!("{table}/{}.md", strip_id(name).trim_end_matches(".md"));
            let path = written
                .keys()
                .find(|k| k.to_lowercase() == wanted.to_lowercase())
                .cloned()
                .unwrap_or_else(|| {
                    written.insert(wanted.clone(), format!("# {name}\n"));
                    wanted.clone()
                });
            let mut content = drop_inline_props(&written[&path], &keys);
            for (i, key) in keys.iter().enumerate() {
                if let Some(value) = record.get(i + 1).and_then(cell_value) {
                    content = props::set(&content, key, Some(value))?;
                }
            }
            written.insert(path, content);
        }
        let dir = vault::resolve(root, &format!("{folder}/{table}"))?;
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        fs::write(dir.join(crate::database::CONFIG_FILE), "{}\n").map_err(|e| e.to_string())?;
        summary.databases += 1;
    }

    for (path, content) in &written {
        let dest: PathBuf = vault::resolve(root, &format!("{folder}/{path}"))?;
        fs::create_dir_all(dest.parent().unwrap()).map_err(|e| e.to_string())?;
        fs::write(&dest, content).map_err(|e| e.to_string())?;
        summary.notes += 1;
    }
    Ok(summary)
}

#[tauri::command(async)]
pub fn import_notion(
    source: String,
    state: tauri::State<'_, VaultState>,
) -> Result<Imported, String> {
    let root = vault::current_root(&state)?;
    let result = import(&root, Path::new(&source))?;
    vault::sync_index(&state)?;
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    const ID: &str = "0123456789abcdef0123456789abcdef";

    #[test]
    fn quita_identificadores() {
        assert_eq!(strip_id(&format!("Tareas {ID}.md")), "Tareas.md");
        assert_eq!(strip_id(&format!("Tareas {ID}_all.csv")), "Tareas.csv");
        assert_eq!(strip_id(&format!("Mi página {ID}")), "Mi página");
        assert_eq!(strip_id("foto.png"), "foto.png");
    }

    #[test]
    fn fechas_y_valores() {
        assert_eq!(notion_date("October 1, 2026"), Some("2026-10-01".into()));
        assert_eq!(
            notion_date("March 5, 2026 → March 9, 2026"),
            Some("2026-03-05".into())
        );
        assert_eq!(cell_value("Yes"), Some(Value::Bool(true)));
        assert_eq!(cell_value("12"), Some(serde_json::json!(12.0)));
        assert_eq!(
            cell_value(&format!(
                "Web (Proyectos/Web%20{ID}.md), App (Proyectos/App%20{ID}.md)"
            )),
            Some(serde_json::json!(["[[Web]]", "[[App]]"]))
        );
        assert_eq!(cell_value(""), None);
    }

    #[test]
    fn importa_paginas_tablas_y_adjuntos() {
        let tmp = tempfile::tempdir().unwrap();
        let src = tmp.path().join("export");
        let vault = tmp.path().join("vault");
        fs::create_dir_all(&vault).unwrap();
        let write = |rel: &str, content: &str| {
            let p = src.join(rel);
            fs::create_dir_all(p.parent().unwrap()).unwrap();
            fs::write(p, content).unwrap();
        };
        write(
            &format!("Export/Inicio {ID}.md"),
            &format!(
                "# Inicio\n\nVer [Comprar pan](Tareas%20{ID}/Comprar%20pan%20{ID}.md) y ![foto](Inicio%20{ID}/foto%20bonita.png). [Web](https://notion.so)\n"
            ),
        );
        write(&format!("Export/Inicio {ID}/foto bonita.png"), "PNG");
        write(
            &format!("Export/Tareas {ID}.csv"),
            "\u{feff}Name,Estado,Fecha,Hecha\nComprar pan,Hecho,\"October 1, 2026\",Yes\nLlamar,Pendiente,,No\n",
        );
        write(
            &format!("Export/Tareas {ID}/Comprar pan {ID}.md"),
            "# Comprar pan\n\nEstado: Hecho\nFecha: October 1, 2026\n\nIr a la panadería.\n",
        );

        let r = import(&vault, &src).unwrap();
        assert_eq!(
            r,
            Imported {
                folder: DEST.into(),
                notes: 3,
                databases: 1,
                files: 1
            }
        );
        let base = vault.join(DEST);
        let inicio = fs::read_to_string(base.join("Inicio.md")).unwrap();
        assert!(
            inicio.contains(
                "Ver [[Comprar pan]] y ![foto](Inicio/foto%20bonita.png). [Web](https://notion.so)"
            ),
            "{inicio}"
        );
        assert!(base.join("Inicio/foto bonita.png").is_file());
        assert!(
            base.join("Tareas")
                .join(crate::database::CONFIG_FILE)
                .is_file()
        );
        let pan = fs::read_to_string(base.join("Tareas/Comprar pan.md")).unwrap();
        let p = props::read(&pan).unwrap();
        assert_eq!(p["Estado"], "Hecho");
        assert_eq!(p["Fecha"], "2026-10-01");
        assert_eq!(p["Hecha"], true);
        let body = pan.rsplit("---\n").next().unwrap();
        assert!(!body.contains("Estado: Hecho"), "{pan}");
        assert!(pan.contains("Ir a la panadería."));
        // Una fila sin página se crea.
        assert!(base.join("Tareas/Llamar.md").is_file());
        // Otra importación no pisa la primera.
        assert_eq!(import(&vault, &src).unwrap().folder, format!("{DEST} 2"));
    }

    #[test]
    fn rutas_relativas() {
        assert_eq!(relative("A/B", "A/C/d.png"), "../C/d.png");
        assert_eq!(relative("", "A/d.png"), "A/d.png");
        assert_eq!(join("A/B", "../C/x.md"), "A/C/x.md");
    }
}
