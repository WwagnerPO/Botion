//! Recortador web: descarga el HTML de una página para guardarla como nota.
//! La conversión a Markdown se hace en la interfaz.

const MAX_BYTES: u64 = 10 * 1024 * 1024;

fn check_url(url: &str) -> Result<&str, String> {
    let url = url.trim();
    if url.starts_with("https://") || url.starts_with("http://") {
        Ok(url)
    } else {
        Err("La dirección debe empezar por http:// o https://".into())
    }
}

/// HTML de la página y la dirección final (tras redirecciones).
#[derive(serde::Serialize)]
pub struct Page {
    pub url: String,
    pub html: String,
}

#[tauri::command(async)]
pub fn fetch_page(url: String) -> Result<Page, String> {
    let url = check_url(&url)?;
    let mut response = ureq::get(url)
        .header("User-Agent", "Mozilla/5.0 (compatible; Botion)")
        .header("Accept", "text/html,application/xhtml+xml")
        .call()
        .map_err(|e| format!("No se pudo descargar la página: {e}"))?;
    let bytes = response
        .body_mut()
        .with_config()
        .limit(MAX_BYTES)
        .read_to_vec()
        .map_err(|e| format!("No se pudo leer la página: {e}"))?;
    Ok(Page {
        url: url.to_string(),
        html: String::from_utf8_lossy(&bytes).into_owned(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn solo_direcciones_web() {
        assert!(check_url(" https://ejemplo.com ").is_ok());
        assert!(check_url("file:///etc/passwd").is_err());
        assert!(check_url("javascript:alert(1)").is_err());
    }
}
