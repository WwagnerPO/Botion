//! Sincronización con un servidor WebDAV (Nextcloud, ownCloud, Synology,
//! Fastmail…), sin Git. Se compara cada fichero con cómo estaba en la última
//! sincronización: lo cambiado aquí se sube, lo cambiado allí se baja y, si
//! cambió en los dos sitios, se guarda la versión del servidor como copia
//! «(conflicto WebDAV)» para elegir después.

use crate::vault::{self, VaultState};
use percent_encoding::{AsciiSet, NON_ALPHANUMERIC, percent_decode_str, utf8_percent_encode};
use quick_xml::events::Event;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;

const SEGMENT: &AsciiSet = &NON_ALPHANUMERIC
    .remove(b'-')
    .remove(b'.')
    .remove(b'_')
    .remove(b'~');

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(default)]
pub struct Settings {
    pub url: String,
    pub user: String,
    pub password: String,
    /// Sincronizar sola cada 5 minutos.
    pub auto: bool,
}

#[derive(Debug, Default, Serialize, PartialEq)]
pub struct SyncReport {
    pub uploaded: usize,
    pub downloaded: usize,
    pub deleted: usize,
    /// Copias «(conflicto WebDAV)» creadas.
    pub conflicts: Vec<String>,
    /// Notas que han cambiado aquí al bajar del servidor.
    pub changed: Vec<String>,
}

/// Cómo estaba un fichero en la última sincronización.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
struct Known {
    etag: String,
    mtime: u64,
    size: u64,
}

#[derive(Debug, Clone, PartialEq)]
struct Local {
    mtime: u64,
    size: u64,
}

fn auth_header(user: &str, password: &str) -> String {
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let input = format!("{user}:{password}").into_bytes();
    let mut out = String::new();
    for chunk in input.chunks(3) {
        let b = [
            chunk[0],
            *chunk.get(1).unwrap_or(&0),
            *chunk.get(2).unwrap_or(&0),
        ];
        let n = (u32::from(b[0]) << 16) | (u32::from(b[1]) << 8) | u32::from(b[2]);
        for i in 0..4 {
            if i <= chunk.len() {
                out.push(CHARS[(n >> (18 - 6 * i) & 63) as usize] as char);
            } else {
                out.push('=');
            }
        }
    }
    format!("Basic {out}")
}

pub struct Client {
    agent: ureq::Agent,
    base: String,
    base_path: String,
    auth: Option<String>,
}

fn err(e: impl std::fmt::Display) -> String {
    format!("Error de WebDAV: {e}")
}

impl Client {
    pub fn new(s: &Settings) -> Result<Self, String> {
        let url = s.url.trim();
        if !(url.starts_with("https://") || url.starts_with("http://")) {
            return Err("La dirección WebDAV debe empezar por https://".into());
        }
        let base = format!("{}/", url.trim_end_matches('/'));
        let after_scheme = &base[base.find("://").unwrap() + 3..];
        let base_path = after_scheme
            .find('/')
            .map_or("/".to_string(), |i| after_scheme[i..].to_string());
        let agent = ureq::Agent::config_builder()
            .allow_non_standard_methods(true)
            .http_status_as_error(false)
            .build()
            .into();
        Ok(Client {
            agent,
            base,
            base_path: percent_decode_str(&base_path)
                .decode_utf8_lossy()
                .to_string(),
            auth: (!s.user.is_empty()).then(|| auth_header(&s.user, &s.password)),
        })
    }

    fn url(&self, rel: &str) -> String {
        let encoded: Vec<String> = rel
            .split('/')
            .map(|p| utf8_percent_encode(p, SEGMENT).to_string())
            .collect();
        format!("{}{}", self.base, encoded.join("/"))
    }

    fn send(
        &self,
        method: &str,
        rel: &str,
        body: Vec<u8>,
        depth: Option<&str>,
    ) -> Result<(u16, Option<String>, Vec<u8>), String> {
        let mut req = ureq::http::Request::builder()
            .method(method)
            .uri(self.url(rel));
        if let Some(a) = &self.auth {
            req = req.header("Authorization", a);
        }
        if let Some(d) = depth {
            req = req
                .header("Depth", d)
                .header("Content-Type", "application/xml");
        }
        let req = req.body(body).map_err(err)?;
        let mut res = self.agent.run(req).map_err(err)?;
        let status = res.status().as_u16();
        if status == 401 {
            return Err("El servidor WebDAV no acepta el usuario o la contraseña".into());
        }
        let etag = res
            .headers()
            .get("etag")
            .and_then(|v| v.to_str().ok())
            .map(str::to_string);
        let bytes = res
            .body_mut()
            .with_config()
            .limit(200 * 1024 * 1024)
            .read_to_vec()
            .map_err(err)?;
        Ok((status, etag, bytes))
    }

    /// Ficheros del servidor (ruta relativa → etag), recorriendo las carpetas.
    pub fn list(&self) -> Result<BTreeMap<String, String>, String> {
        let body = br#"<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:getetag/><d:resourcetype/><d:getlastmodified/><d:getcontentlength/></d:prop></d:propfind>"#.to_vec();
        let mut files = BTreeMap::new();
        let mut pending = vec![String::new()];
        while let Some(dir) = pending.pop() {
            let (status, _, xml) = self.send("PROPFIND", &dir, body.clone(), Some("1"))?;
            if status == 404 && dir.is_empty() {
                // La carpeta aún no existe en el servidor: se crea al subir.
                self.send("MKCOL", "", Vec::new(), None)?;
                return Ok(files);
            }
            if status != 207 {
                return Err(format!(
                    "El servidor WebDAV respondió {status} al listar «{dir}»"
                ));
            }
            for (href, etag, is_dir) in parse_multistatus(&xml) {
                let Some(rel) = self.relative(&href) else {
                    continue;
                };
                if rel.is_empty() || rel == dir || skip(&rel) {
                    continue;
                }
                if is_dir {
                    pending.push(rel);
                } else {
                    files.insert(rel, etag);
                }
            }
        }
        Ok(files)
    }

    fn relative(&self, href: &str) -> Option<String> {
        let path = match href.find("://") {
            Some(i) => href[i + 3..].find('/').map_or("/", |j| &href[i + 3 + j..]),
            None => href,
        };
        let decoded = percent_decode_str(path).decode_utf8_lossy().to_string();
        decoded
            .strip_prefix(&self.base_path)
            .map(|r| r.trim_end_matches('/').to_string())
    }

    fn get(&self, rel: &str) -> Result<Vec<u8>, String> {
        let (status, _, bytes) = self.send("GET", rel, Vec::new(), None)?;
        if !(200..300).contains(&status) {
            return Err(format!("No se pudo bajar «{rel}» ({status})"));
        }
        Ok(bytes)
    }

    fn put(&self, rel: &str, bytes: Vec<u8>, made: &mut BTreeSet<String>) -> Result<(), String> {
        // Las carpetas de la ruta tienen que existir antes.
        let parts: Vec<&str> = rel.split('/').collect();
        for i in 1..parts.len() {
            let dir = parts[..i].join("/");
            if made.insert(dir.clone()) {
                self.send("MKCOL", &dir, Vec::new(), None)?;
            }
        }
        let (status, _, _) = self.send("PUT", rel, bytes, None)?;
        if !(200..300).contains(&status) {
            return Err(format!("No se pudo subir «{rel}» ({status})"));
        }
        Ok(())
    }

    fn delete(&self, rel: &str) -> Result<(), String> {
        let (status, _, _) = self.send("DELETE", rel, Vec::new(), None)?;
        if !(200..300).contains(&status) && status != 404 {
            return Err(format!("No se pudo borrar «{rel}» del servidor ({status})"));
        }
        Ok(())
    }
}

/// (href, etag, es carpeta) de cada respuesta de un PROPFIND.
fn parse_multistatus(xml: &[u8]) -> Vec<(String, String, bool)> {
    let mut reader = quick_xml::Reader::from_reader(xml);
    let mut out = Vec::new();
    let (mut href, mut etag, mut is_dir) = (String::new(), String::new(), false);
    let mut field = String::new();
    let mut buf = Vec::new();
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) => {
                let name = String::from_utf8_lossy(e.local_name().as_ref()).to_string();
                match name.as_str() {
                    "response" => (href, etag, is_dir) = (String::new(), String::new(), false),
                    "collection" => is_dir = true,
                    _ => {}
                }
                field = name;
            }
            Ok(Event::Empty(e)) => {
                if e.local_name().as_ref() == b"collection" {
                    is_dir = true;
                }
            }
            Ok(Event::Text(t)) => {
                let text = t.unescape().map(|c| c.to_string()).unwrap_or_default();
                match field.as_str() {
                    "href" => href.push_str(text.trim()),
                    // El etag, más tamaño y fecha por si el servidor da etags poco fiables.
                    "getetag" => etag.insert_str(0, text.trim().trim_matches('"')),
                    "getcontentlength" | "getlastmodified" => {
                        etag.push('|');
                        etag.push_str(text.trim());
                    }
                    _ => {}
                }
            }
            Ok(Event::End(e)) => {
                if e.local_name().as_ref() == b"response" && !href.is_empty() {
                    out.push((std::mem::take(&mut href), std::mem::take(&mut etag), is_dir));
                }
                field.clear();
            }
            Ok(Event::Eof) | Err(_) => break,
            _ => {}
        }
        buf.clear();
    }
    out
}

/// Lo que no se sincroniza: Git, papeleras, temporales y ficheros del sistema.
fn skip(rel: &str) -> bool {
    rel.split('/').any(|p| {
        matches!(
            p,
            ".git" | ".trash" | ".Trash" | ".DS_Store" | "Thumbs.db" | ".stfolder" | ".stversions"
        ) || p.ends_with(".botion-tmp")
            || p.starts_with(".~")
    })
}

fn millis(t: std::io::Result<std::time::SystemTime>) -> u64 {
    t.ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map_or(0, |d| d.as_millis() as u64)
}

fn walk(root: &Path) -> BTreeMap<String, Local> {
    let mut out = BTreeMap::new();
    let mut stack = vec![root.to_path_buf()];
    while let Some(dir) = stack.pop() {
        let Ok(entries) = fs::read_dir(&dir) else {
            continue;
        };
        for e in entries.flatten() {
            let p = e.path();
            let rel = p
                .strip_prefix(root)
                .unwrap()
                .to_string_lossy()
                .replace('\\', "/");
            if skip(&rel) {
                continue;
            }
            if p.is_dir() {
                stack.push(p);
            } else if let Ok(meta) = e.metadata() {
                out.insert(
                    rel,
                    Local {
                        mtime: millis(meta.modified()),
                        size: meta.len(),
                    },
                );
            }
        }
    }
    out
}

/// «Notas/plan.md» → «Notas/plan (conflicto WebDAV).md» (sin pisar otra).
fn conflict_name(root: &Path, rel: &str) -> String {
    let (stem, ext) = match rel.rfind('.') {
        Some(i) if !rel[i..].contains('/') => (&rel[..i], &rel[i..]),
        _ => (rel, ""),
    };
    let mut name = format!("{stem} (conflicto WebDAV){ext}");
    let mut n = 2;
    while root.join(&name).exists() {
        name = format!("{stem} (conflicto WebDAV {n}){ext}");
        n += 1;
    }
    name
}

fn write_local(root: &Path, rel: &str, bytes: &[u8]) -> Result<(), String> {
    let file = vault::resolve(root, rel)?;
    if let Some(parent) = file.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&file, bytes).map_err(|e| format!("No se pudo guardar «{rel}»: {e}"))
}

/// Sincroniza la carpeta `root` con el servidor. `state` es cómo quedó la última vez.
fn sync_with(
    client: &Client,
    root: &Path,
    state: &mut BTreeMap<String, Known>,
) -> Result<SyncReport, String> {
    let remote = client.list()?;
    let local = walk(root);
    let mut report = SyncReport::default();
    let mut made = BTreeSet::new();
    let paths: BTreeSet<String> = remote
        .keys()
        .chain(local.keys())
        .chain(state.keys())
        .cloned()
        .collect();
    for path in &paths {
        let (l, r, k) = (local.get(path), remote.get(path), state.get(path));
        let l_changed = match (l, k) {
            (Some(l), Some(k)) => l.mtime != k.mtime || l.size != k.size,
            (Some(_), None) => true,
            _ => false,
        };
        let r_changed = match (r, k) {
            (Some(r), Some(k)) => *r != k.etag,
            (Some(_), None) => true,
            _ => false,
        };
        let read = || fs::read(root.join(path)).map_err(|e| e.to_string());
        match (l, r) {
            (Some(_), Some(_)) if l_changed && r_changed => {
                let theirs = client.get(path)?;
                let mine = read()?;
                if theirs != mine {
                    // Gana lo de aquí; lo del servidor queda en una copia.
                    let copy = conflict_name(root, path);
                    write_local(root, &copy, &theirs)?;
                    client.put(path, mine, &mut made)?;
                    report.conflicts.push(copy);
                    report.uploaded += 1;
                }
            }
            (Some(_), Some(_)) if l_changed => {
                client.put(path, read()?, &mut made)?;
                report.uploaded += 1;
            }
            (Some(_), Some(_)) if r_changed => {
                write_local(root, path, &client.get(path)?)?;
                report.downloaded += 1;
                report.changed.push(path.clone());
            }
            (Some(_), None) if k.is_some() && !l_changed => {
                // Se borró en el servidor y aquí no se ha tocado.
                trash::delete(root.join(path))
                    .map_err(|e| format!("No se pudo borrar «{path}»: {e}"))?;
                report.deleted += 1;
                report.changed.push(path.clone());
            }
            (Some(_), None) => {
                client.put(path, read()?, &mut made)?;
                report.uploaded += 1;
            }
            (None, Some(_)) if k.is_some() && !r_changed => {
                client.delete(path)?;
                report.deleted += 1;
            }
            (None, Some(_)) => {
                write_local(root, path, &client.get(path)?)?;
                report.downloaded += 1;
                report.changed.push(path.clone());
            }
            _ => {}
        }
    }
    // Cómo queda todo ahora, para la próxima vez.
    let remote = client.list()?;
    let local = walk(root);
    state.clear();
    for (path, etag) in remote {
        if let Some(l) = local.get(&path) {
            state.insert(
                path,
                Known {
                    etag,
                    mtime: l.mtime,
                    size: l.size,
                },
            );
        }
    }
    Ok(report)
}

// --- Ajustes y estado, fuera de la bóveda (en la carpeta de la app) ---

fn key(root: &Path) -> String {
    use std::hash::{Hash, Hasher};
    let mut h = std::collections::hash_map::DefaultHasher::new();
    root.hash(&mut h);
    format!("{:016x}", h.finish())
}

fn config_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn read_json<T: for<'de> Deserialize<'de> + Default>(file: &Path) -> T {
    fs::read_to_string(file)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn all_settings(app: &tauri::AppHandle) -> Result<(PathBuf, BTreeMap<String, Settings>), String> {
    let file = config_dir(app)?.join("webdav.json");
    let map = read_json(&file);
    Ok((file, map))
}

#[tauri::command]
pub fn webdav_settings(
    app: tauri::AppHandle,
    state: tauri::State<'_, VaultState>,
) -> Result<Option<Settings>, String> {
    let root = vault::current_root(&state)?;
    Ok(all_settings(&app)?.1.remove(&key(&root)))
}

/// Guarda (o quita, con `None`) los ajustes de la bóveda abierta.
#[tauri::command]
pub fn webdav_save(
    settings: Option<Settings>,
    app: tauri::AppHandle,
    state: tauri::State<'_, VaultState>,
) -> Result<(), String> {
    let root = vault::current_root(&state)?;
    let (file, mut map) = all_settings(&app)?;
    match settings {
        Some(s) => {
            Client::new(&s)?;
            map.insert(key(&root), s);
        }
        None => {
            map.remove(&key(&root));
            let _ = fs::remove_file(
                config_dir(&app)?.join(format!("webdav-estado-{}.json", key(&root))),
            );
        }
    }
    let json = serde_json::to_string_pretty(&map).map_err(|e| e.to_string())?;
    vault::write_atomic(&file, &json).map_err(|e| e.to_string())
}

#[tauri::command(async)]
pub fn webdav_sync(
    app: tauri::AppHandle,
    state: tauri::State<'_, VaultState>,
) -> Result<SyncReport, String> {
    let root = vault::current_root(&state)?;
    let settings = all_settings(&app)?
        .1
        .remove(&key(&root))
        .ok_or("WebDAV no está configurado para esta bóveda")?;
    let client = Client::new(&settings)?;
    let state_file = config_dir(&app)?.join(format!("webdav-estado-{}.json", key(&root)));
    let mut known: BTreeMap<String, Known> = read_json(&state_file);
    let report = sync_with(&client, &root, &mut known);
    // El estado se guarda también si algo falló a medias: lo hecho, hecho está.
    let json = serde_json::to_string(&known).map_err(|e| e.to_string())?;
    vault::write_atomic(&state_file, &json).map_err(|e| e.to_string())?;
    let report = report?;
    vault::sync_index(&state)?;
    Ok(report)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cabecera_basica() {
        assert_eq!(
            auth_header("Aladdin", "open sesame"),
            "Basic QWxhZGRpbjpvcGVuIHNlc2FtZQ=="
        );
        assert_eq!(auth_header("a", "b"), "Basic YTpi");
    }

    #[test]
    fn lee_multistatus() {
        let xml = br#"<?xml version="1.0"?><d:multistatus xmlns:d="DAV:"><d:response><d:href>/dav/Notas/</d:href><d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat></d:response><d:response><d:href>/dav/Notas/Mi%20nota.md</d:href><d:propstat><d:prop><d:getetag>"abc"</d:getetag><d:resourcetype/></d:prop></d:propstat></d:response></d:multistatus>"#;
        let items = parse_multistatus(xml);
        assert_eq!(
            items,
            vec![
                ("/dav/Notas/".into(), "".into(), true),
                ("/dav/Notas/Mi%20nota.md".into(), "abc".into(), false)
            ]
        );
        let with_size = br#"<multistatus xmlns="DAV:"><response><href>/a.md</href><propstat><prop><getcontentlength>3</getcontentlength><getetag>"e1"</getetag></prop></propstat></response></multistatus>"#;
        assert_eq!(parse_multistatus(with_size)[0].1, "e1|3");
        let c = Client::new(&Settings {
            url: "https://x.com/dav/Notas".into(),
            ..Default::default()
        })
        .unwrap();
        assert_eq!(
            c.relative("/dav/Notas/Mi%20nota.md").as_deref(),
            Some("Mi nota.md")
        );
        assert_eq!(
            c.relative("https://x.com/dav/Notas/A/").as_deref(),
            Some("A")
        );
        assert_eq!(c.url("A b/ñ.md"), "https://x.com/dav/Notas/A%20b/%C3%B1.md");
    }

    #[test]
    fn nombres_de_conflicto_y_omitidos() {
        let tmp = tempfile::tempdir().unwrap();
        assert_eq!(
            conflict_name(tmp.path(), "A/plan.md"),
            "A/plan (conflicto WebDAV).md"
        );
        assert!(skip(".git/config") && skip("a/.DS_Store") && !skip("Tareas/.botion-db.json"));
    }

    /// Prueba contra un servidor de verdad si se indica uno (BOTION_WEBDAV_TEST=url).
    #[test]
    fn sincroniza_con_servidor() {
        let Ok(url) = std::env::var("BOTION_WEBDAV_TEST") else {
            return;
        };
        let client = Client::new(&Settings {
            url,
            ..Default::default()
        })
        .unwrap();
        let a = tempfile::tempdir().unwrap();
        let b = tempfile::tempdir().unwrap();
        let (mut sa, mut sb) = (BTreeMap::new(), BTreeMap::new());
        fs::create_dir_all(a.path().join("Ideas")).unwrap();
        fs::write(a.path().join("Ideas/Mi nota.md"), "uno").unwrap();
        fs::write(a.path().join("borrar.md"), "x").unwrap();
        assert_eq!(sync_with(&client, a.path(), &mut sa).unwrap().uploaded, 2);
        let r = sync_with(&client, b.path(), &mut sb).unwrap();
        assert_eq!((r.downloaded, r.uploaded), (2, 0));
        assert_eq!(
            fs::read_to_string(b.path().join("Ideas/Mi nota.md")).unwrap(),
            "uno"
        );
        // Cambio en B y borrado en A.
        std::thread::sleep(std::time::Duration::from_millis(1100));
        fs::write(b.path().join("Ideas/Mi nota.md"), "dos").unwrap();
        fs::remove_file(a.path().join("borrar.md")).unwrap();
        sync_with(&client, b.path(), &mut sb).unwrap();
        let r = sync_with(&client, a.path(), &mut sa).unwrap();
        assert_eq!(
            fs::read_to_string(a.path().join("Ideas/Mi nota.md")).unwrap(),
            "dos"
        );
        assert_eq!(r.deleted, 1);
        sync_with(&client, b.path(), &mut sb).unwrap();
        assert!(!b.path().join("borrar.md").exists());
        // Conflicto: los dos cambian la misma nota.
        std::thread::sleep(std::time::Duration::from_millis(1100));
        fs::write(a.path().join("Ideas/Mi nota.md"), "de A").unwrap();
        fs::write(b.path().join("Ideas/Mi nota.md"), "de B").unwrap();
        sync_with(&client, a.path(), &mut sa).unwrap();
        let r = sync_with(&client, b.path(), &mut sb).unwrap();
        assert_eq!(
            r.conflicts,
            vec!["Ideas/Mi nota (conflicto WebDAV).md".to_string()]
        );
        assert_eq!(
            fs::read_to_string(b.path().join("Ideas/Mi nota.md")).unwrap(),
            "de B"
        );
        assert_eq!(
            fs::read_to_string(b.path().join("Ideas/Mi nota (conflicto WebDAV).md")).unwrap(),
            "de A"
        );
    }
}
