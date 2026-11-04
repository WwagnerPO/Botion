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

/// Clave pública para comprobar las actualizaciones (variable de la compilación).
const UPDATER_PUBKEY: Option<&str> = option_env!("BOTION_UPDATER_PUBKEY");

/// Si esta versión puede actualizarse sola.
#[tauri::command]
fn updater_enabled() -> bool {
    UPDATER_PUBKEY.is_some_and(|k| !k.trim().is_empty())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        // Actualizaciones: la clave pública llega al compilar (ver README).
        .plugin(
            tauri_plugin_updater::Builder::new()
                .pubkey(UPDATER_PUBKEY.unwrap_or(""))
                .build(),
        )
        .plugin(tauri_plugin_process::init())
        .manage(vault::VaultState::default())
        .invoke_handler(tauri::generate_handler![
            updater_enabled,
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
