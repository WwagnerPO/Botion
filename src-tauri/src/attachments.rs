//! Imágenes y otros ficheros adjuntos a las notas. Se guardan en la carpeta
//! `adjuntos/` de la bóveda y la nota los enlaza con una ruta relativa, así
//! que también se ven en Obsidian o en cualquier visor de Markdown.

use crate::vault::{self, VaultState};
use percent_encoding::percent_decode_str;
use std::fs;
use std::path::Path;

pub const FOLDER: &str = "adjuntos";

/// Nombre de fichero sin espacios ni símbolos raros, para que el enlace en
/// Markdown no necesite escaparse.
fn safe_name(name: &str) -> String {
    let name = name.rsplit(['/', '\\']).next().unwrap_or(name);
    let (stem, ext) = match name.rsplit_once('.') {
        Some((s, e)) if !s.is_empty() => (s, e.to_lowercase()),
        _ => (name, String::new()),
    };
    let clean = |s: &str| {
        let out: String = s
            .chars()
            .map(|c| {
                if c.is_alphanumeric() || c == '-' || c == '_' {
                    c
                } else {
                    '-'
                }
            })
            .collect();
        out.trim_matches('-').to_string()
    };
    let stem = match clean(stem) {
        s if s.is_empty() => "adjunto".to_string(),
        s => s,
    };
    let ext = clean(&ext);
    if ext.is_empty() {
        stem
    } else {
        format!("{stem}.{ext}")
    }
}

/// Primer nombre libre: `foto.png`, `foto-2.png`, `foto-3.png`...
fn unique(dir: &Path, name: &str) -> String {
    if !dir.join(name).exists() {
        return name.to_string();
    }
    let (stem, ext) = name.rsplit_once('.').map_or((name, ""), |(s, e)| (s, e));
    (2..)
        .map(|n| {
            if ext.is_empty() {
                format!("{stem}-{n}")
            } else {
                format!("{stem}-{n}.{ext}")
            }
        })
        .find(|candidate| !dir.join(candidate).exists())
        .expect("siempre hay un nombre libre")
}

/// Ruta del adjunto vista desde la carpeta de la nota (`../adjuntos/x.png`).
fn link_from(note: &str, file: &str) -> String {
    let depth = note.matches('/').count();
    format!("{}{FOLDER}/{file}", "../".repeat(depth))
}

/// Guarda `bytes` como adjunto de la nota `note` y devuelve el enlace
/// relativo para el Markdown.
pub fn save(root: &Path, note: &str, name: &str, bytes: &[u8]) -> Result<String, String> {
    vault::resolve(root, note)?;
    let dir = root.join(FOLDER);
    fs::create_dir_all(&dir)
        .map_err(|e| format!("No se pudo crear la carpeta de adjuntos: {e}"))?;
    let file = unique(&dir, &safe_name(name));
    fs::write(dir.join(&file), bytes).map_err(|e| format!("No se pudo guardar el adjunto: {e}"))?;
    Ok(link_from(note, &file))
}

/// El fichero llega como cuerpo binario de la petición; la nota y el nombre,
/// en las cabeceras `x-note` y `x-name` (codificadas como URL).
#[tauri::command(async)]
pub fn save_attachment(
    request: tauri::ipc::Request<'_>,
    state: tauri::State<'_, VaultState>,
) -> Result<String, String> {
    let header = |key: &str| -> Result<String, String> {
        let raw = request
            .headers()
            .get(key)
            .and_then(|v| v.to_str().ok())
            .ok_or_else(|| format!("Falta la cabecera {key}"))?;
        Ok(percent_decode_str(raw).decode_utf8_lossy().into_owned())
    };
    let tauri::ipc::InvokeBody::Raw(bytes) = request.body() else {
        return Err("El adjunto debe enviarse como datos binarios".into());
    };
    let root = vault::current_root(&state)?;
    save(&root, &header("x-note")?, &header("x-name")?, bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn nombres_seguros_y_unicos() {
        assert_eq!(
            safe_name("Captura de pantalla 2026.PNG"),
            "Captura-de-pantalla-2026.png"
        );
        assert_eq!(safe_name("../../etc/passwd"), "passwd");
        assert_eq!(safe_name("año ñu.jpg"), "año-ñu.jpg");
        assert_eq!(safe_name(".png"), "png");
        assert_eq!(safe_name("???.gif"), "adjunto.gif");

        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("foto.png"), "").unwrap();
        fs::write(dir.path().join("foto-2.png"), "").unwrap();
        assert_eq!(unique(dir.path(), "foto.png"), "foto-3.png");
        assert_eq!(unique(dir.path(), "otra.png"), "otra.png");
    }

    #[test]
    fn guarda_y_devuelve_el_enlace_relativo() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        fs::create_dir_all(root.join("Proyectos/Botion")).unwrap();

        assert_eq!(
            save(root, "Nota.md", "foto.png", b"x").unwrap(),
            "adjuntos/foto.png"
        );
        assert_eq!(
            save(root, "Proyectos/Botion/Plan.md", "foto.png", b"y").unwrap(),
            "../../adjuntos/foto-2.png"
        );
        assert_eq!(fs::read(root.join("adjuntos/foto-2.png")).unwrap(), b"y");
        assert!(save(root, "../fuera.md", "x.png", b"z").is_err());
    }
}
