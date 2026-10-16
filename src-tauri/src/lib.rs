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
            links::resolve_note_link,
            links::get_backlinks,
            links::create_note,
        ])
        .run(tauri::generate_context!())
        .expect("error al iniciar Botion");
}
