mod attachments;
mod database;
mod export;
mod files;
mod git;
mod index;
mod links;
mod notion;
mod props;
mod tasks;
mod vault;
mod web;
mod webdav;

/// Si esta versión puede actualizarse sola (tiene la clave pública en tauri.conf.json).
/// Sistema y arquitectura, para el informe de «Acerca de».
#[tauri::command]
fn system_info() -> String {
    format!(
        "{} {} ({})",
        std::env::consts::OS,
        std::env::consts::ARCH,
        std::env::consts::FAMILY
    )
}

#[tauri::command]
fn updater_enabled(app: tauri::AppHandle) -> bool {
    app.config()
        .plugins
        .0
        .get("updater")
        .and_then(|u| u.get("pubkey"))
        .and_then(|k| k.as_str())
        .is_some_and(|k| !k.trim().is_empty())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        // Actualizaciones firmadas (ver README): la clave pública está en tauri.conf.json.
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(vault::VaultState::default())
        .invoke_handler(tauri::generate_handler![
            updater_enabled,
            system_info,
            vault::open_vault,
            vault::read_note,
            vault::write_note,
            index::resolve_note_link,
            index::get_backlinks,
            index::search_notes,
            files::create_note,
            files::create_folder,
            files::rename_entry,
            files::move_entry,
            files::delete_entry,
            vault::refresh_tree,
            database::get_database,
            database::save_database_config,
            database::create_database,
            database::set_property,
            database::get_properties,
            database::parse_properties,
            database::create_db_template,
            database::rename_database_property,
            database::delete_database_property,
            git::git_status,
            git::git_init,
            git::git_sync,
            git::git_resolve,
            git::git_history,
            git::git_file_at,
            git::git_save_version,
            index::get_graph,
            tasks::list_tasks,
            web::fetch_page,
            notion::import_notion,
            webdav::webdav_settings,
            webdav::webdav_save,
            webdav::webdav_sync,
            attachments::save_attachment,
            attachments::open_in_system,
            attachments::read_attachment,
            attachments::reveal_in_system,
            export::export_html,
            export::print_page,
        ])
        .run(tauri::generate_context!())
        .expect("error al iniciar Botion");
}
