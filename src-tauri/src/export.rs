//! Exportar notas: el HTML lo genera la interfaz; aquí se pide dónde
//! guardarlo (diálogo del sistema) y se escribe. También se abre el diálogo
//! de imprimir, que permite guardar como PDF.

use std::fs;
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;

/// Pregunta dónde guardar y escribe el fichero. Devuelve la ruta elegida,
/// o `None` si se cancela.
#[tauri::command(async)]
pub fn export_html(app: AppHandle, name: String, html: String) -> Result<Option<String>, String> {
    let file_name = format!("{}.html", name.trim().trim_end_matches(".html"));
    let Some(path) = app
        .dialog()
        .file()
        .set_title("Exportar a HTML")
        .set_file_name(&file_name)
        .add_filter("Página web", &["html"])
        .blocking_save_file()
    else {
        return Ok(None);
    };
    let path = path
        .into_path()
        .map_err(|e| format!("Ruta no válida: {e}"))?;
    fs::write(&path, html).map_err(|e| format!("No se pudo guardar: {e}"))?;
    Ok(Some(path.to_string_lossy().into_owned()))
}

/// Abre el diálogo de imprimir de la ventana (con «Guardar como PDF»).
#[tauri::command]
pub fn print_page(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or("No se encontró la ventana")?;
    window
        .print()
        .map_err(|e| format!("No se pudo imprimir: {e}"))
}
