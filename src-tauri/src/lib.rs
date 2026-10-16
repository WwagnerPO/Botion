mod files;
mod index;
mod links;
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
            files::delete_entry,
            vault::refresh_tree,
        ])
        .run(tauri::generate_context!())
        .expect("error al iniciar Botion");
}
