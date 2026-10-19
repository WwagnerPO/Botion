mod attachments;
mod database;
mod files;
mod git;
mod index;
mod links;
mod props;
mod vault;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(vault::VaultState::default())
        .invoke_handler(tauri::generate_handler![
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
            database::rename_database_property,
            database::delete_database_property,
            git::git_status,
            git::git_init,
            git::git_sync,
            git::git_resolve,
            attachments::save_attachment,
        ])
        .run(tauri::generate_context!())
        .expect("error al iniciar Botion");
}
