//! Sincronización opcional de la bóveda con Git.
//!
//! Usa el `git` instalado en el sistema, así que aprovecha las credenciales
//! que ya tenga configuradas la persona (SSH, gestor de credenciales...).
//! Nunca pide contraseñas: si hacen falta, falla con un mensaje claro.

use crate::vault::{self, VaultState};
use serde::Serialize;
use std::fs;
use std::path::Path;
use std::process::{Command, Output};

/// Ficheros temporales de guardado de Botion que nunca deben subirse.
const IGNORE_LINE: &str = ".*.botion-tmp";

#[derive(Debug, Serialize, PartialEq)]
pub struct GitStatus {
    /// Git está instalado.
    pub available: bool,
    /// La bóveda está dentro de un repositorio.
    pub repo: bool,
    pub branch: Option<String>,
    pub remote: Option<String>,
    /// Ficheros con cambios sin guardar en Git.
    pub changes: usize,
    /// Commits locales que faltan por subir.
    pub ahead: usize,
    /// Commits del remoto que faltan por bajar.
    pub behind: usize,
}

#[derive(Debug, Serialize, PartialEq, Default)]
pub struct SyncResult {
    pub committed: bool,
    pub pulled: bool,
    pub pushed: bool,
    /// Notas que han cambiado al bajar cambios del remoto.
    pub changed: Vec<String>,
    /// Notas que chocan con el remoto. Si hay alguna, no se ha bajado ni
    /// subido nada: hay que elegir cómo resolverlo con [`resolve`].
    pub conflicts: Vec<String>,
}

/// Cómo resolver un conflicto con el remoto.
#[derive(Debug, Clone, Copy, serde::Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Strategy {
    /// En las partes que chocan, gana la versión de este ordenador.
    Mine,
    /// En las partes que chocan, gana la versión del remoto.
    Theirs,
    /// Como `Mine`, pero guarda la versión del remoto en una copia
    /// «nota (remoto).md» junto a cada nota en conflicto.
    Both,
}

fn git(root: &Path, args: &[&str]) -> Result<Output, String> {
    let mut cmd = Command::new("git");
    cmd.current_dir(root)
        .args(["-c", "core.quotepath=false"])
        .args(args)
        // Sin preguntas interactivas: la app no tiene terminal.
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("LC_ALL", "C");
    if std::env::var_os("GIT_SSH_COMMAND").is_none() {
        cmd.env("GIT_SSH_COMMAND", "ssh -o BatchMode=yes");
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd.output().map_err(|e| {
        if e.kind() == std::io::ErrorKind::NotFound {
            "Git no está instalado. Descárgalo en https://git-scm.com".to_string()
        } else {
            format!("No se pudo ejecutar Git: {e}")
        }
    })
}

/// Ejecuta Git y devuelve su salida, o el error que haya escrito.
fn git_ok(root: &Path, args: &[&str]) -> Result<String, String> {
    let out = git(root, args)?;
    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
    } else {
        let err = String::from_utf8_lossy(&out.stderr).trim().to_string();
        Err(if err.is_empty() {
            format!("git {} falló", args.join(" "))
        } else {
            err
        })
    }
}

fn is_repo(root: &Path) -> bool {
    git_ok(root, &["rev-parse", "--is-inside-work-tree"]).is_ok_and(|s| s == "true")
}

fn has_upstream(root: &Path) -> bool {
    git_ok(root, &["rev-parse", "--abbrev-ref", "@{upstream}"]).is_ok()
}

fn first_remote(root: &Path) -> Option<String> {
    git_ok(root, &["remote"])
        .ok()?
        .lines()
        .next()
        .map(str::to_string)
}

pub fn status(root: &Path) -> GitStatus {
    let available = git(root, &["--version"]).is_ok_and(|o| o.status.success());
    if !available || !is_repo(root) {
        return GitStatus {
            available,
            repo: false,
            branch: None,
            remote: None,
            changes: 0,
            ahead: 0,
            behind: 0,
        };
    }
    let changes = git_ok(root, &["status", "--porcelain", "--", "."])
        .map(|s| s.lines().count())
        .unwrap_or(0);
    let (ahead, behind) = git_ok(
        root,
        &["rev-list", "--left-right", "--count", "HEAD...@{upstream}"],
    )
    .ok()
    .and_then(|s| {
        let mut parts = s.split_whitespace().map(|n| n.parse().unwrap_or(0));
        Some((parts.next()?, parts.next()?))
    })
    .unwrap_or((0, 0));

    GitStatus {
        available,
        repo: true,
        branch: git_ok(root, &["branch", "--show-current"])
            .ok()
            .filter(|b| !b.is_empty()),
        remote: first_remote(root),
        changes,
        ahead,
        behind,
    }
}

/// Añade a `.gitignore` los temporales de Botion si aún no están.
fn ensure_gitignore(root: &Path) -> Result<(), String> {
    let path = root.join(".gitignore");
    let current = fs::read_to_string(&path).unwrap_or_default();
    if current.lines().any(|l| l.trim() == IGNORE_LINE) {
        return Ok(());
    }
    let sep = if current.is_empty() || current.ends_with('\n') {
        ""
    } else {
        "\n"
    };
    fs::write(
        &path,
        format!("{current}{sep}# Temporales de guardado de Botion\n{IGNORE_LINE}\n"),
    )
    .map_err(|e| format!("No se pudo escribir .gitignore: {e}"))
}

/// Si no hay nombre y correo configurados, Git no deja hacer commits.
fn identity_args(root: &Path) -> Vec<&'static str> {
    if git_ok(root, &["config", "user.email"]).is_ok_and(|e| !e.is_empty()) {
        vec![]
    } else {
        vec![
            "-c",
            "user.name=Botion",
            "-c",
            "user.email=botion@localhost",
        ]
    }
}

/// Una versión guardada de una nota.
#[derive(Debug, Serialize, PartialEq)]
pub struct Version {
    pub hash: String,
    /// Segundos desde 1970.
    pub date: i64,
    pub author: String,
    pub message: String,
    /// Ruta de la nota en esa versión (cambia si se renombró).
    pub path: String,
}

/// Versiones de una nota, de la más nueva a la más antigua (sigue los
/// cambios de nombre).
pub fn history(root: &Path, path: &str) -> Result<Vec<Version>, String> {
    if !is_repo(root) {
        return Ok(Vec::new());
    }
    let out = git_ok(
        root,
        &[
            "log",
            "--follow",
            "--relative",
            "-n",
            "200",
            "--name-only",
            "--format=%x1e%H%x1f%at%x1f%an%x1f%s",
            "--",
            path,
        ],
    )
    .unwrap_or_default();
    Ok(out
        .split('\u{1e}')
        .filter_map(|record| {
            let mut lines = record.lines().filter(|l| !l.trim().is_empty());
            let mut fields = lines.next()?.split('\u{1f}');
            let hash = fields.next()?.to_string();
            let date = fields.next()?.parse().ok()?;
            let author = fields.next()?.to_string();
            let message = fields.next().unwrap_or("").to_string();
            let path = lines.next().unwrap_or(path).trim().to_string();
            Some(Version {
                hash,
                date,
                author,
                message,
                path,
            })
        })
        .collect())
}

/// Contenido de una nota en una versión.
pub fn file_at(root: &Path, hash: &str, path: &str) -> Result<String, String> {
    if hash.is_empty() || !hash.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err("Versión no válida".into());
    }
    vault::resolve(root, path)?;
    let out = git(root, &["show", &format!("{hash}:./{path}")])?;
    if !out.status.success() {
        return Err("No se pudo leer esa versión de la nota".into());
    }
    Ok(String::from_utf8_lossy(&out.stdout).into_owned())
}

/// Guarda en Git todos los cambios de la bóveda. Devuelve si hubo commit.
pub fn commit_all(root: &Path, message: &str) -> Result<bool, String> {
    ensure_gitignore(root)?;
    git_ok(root, &["add", "-A", "--", "."])?;
    let staged = git(root, &["diff", "--cached", "--quiet"])?;
    if staged.status.success() {
        return Ok(false);
    }
    let mut args = identity_args(root);
    args.extend(["commit", "--quiet", "-m", message]);
    git_ok(root, &args)?;
    Ok(true)
}

pub fn init(root: &Path) -> Result<(), String> {
    if !is_repo(root) {
        git_ok(root, &["init", "--quiet"])?;
    }
    commit_all(root, "Botion: primera versión")?;
    Ok(())
}

/// Guarda los cambios, baja los del remoto y sube los locales.
///
/// Si al bajar hay conflictos, se deja el repositorio como estaba antes de
/// intentarlo (con los cambios locales guardados) y se avisa de qué notas
/// chocan.
pub fn sync(root: &Path) -> Result<SyncResult, String> {
    let mut result = SyncResult {
        committed: commit_all(root, "Botion: guardar cambios")?,
        ..Default::default()
    };
    let Some(remote) = first_remote(root) else {
        return Ok(result);
    };

    if has_upstream(root) {
        let before = git_ok(root, &["rev-parse", "HEAD"])?;
        let mut args = identity_args(root);
        args.extend(["pull", "--rebase", "--quiet"]);
        if let Err(e) = git_ok(root, &args) {
            let conflicts = git_ok(
                root,
                &["diff", "--name-only", "--relative", "--diff-filter=U"],
            )
            .unwrap_or_default();
            let _ = git(root, &["rebase", "--abort"]);
            if conflicts.is_empty() {
                return Err(format!("No se pudieron bajar los cambios: {e}"));
            }
            // Los cambios locales siguen guardados en Git; se elige después.
            result.conflicts = conflicts.lines().map(str::to_string).collect();
            return Ok(result);
        }
        record_changes(root, &before, &mut result)?;
    }
    push(root, &remote, &mut result)?;
    Ok(result)
}

/// Apunta qué ha llegado del remoto entre `before` y el commit actual.
fn record_changes(root: &Path, before: &str, result: &mut SyncResult) -> Result<(), String> {
    let after = git_ok(root, &["rev-parse", "HEAD"])?;
    if before != after {
        result.changed = git_ok(root, &["diff", "--name-only", "--relative", before, &after])?
            .lines()
            .map(str::to_string)
            .collect();
        // Si solo se reaplicaron nuestros commits, no ha llegado nada.
        result.pulled = !result.changed.is_empty();
    }
    Ok(())
}

fn push(root: &Path, remote: &str, result: &mut SyncResult) -> Result<(), String> {
    let st = status(root);
    if st.ahead > 0 || !has_upstream(root) {
        let out = if has_upstream(root) {
            git_ok(root, &["push", "--quiet"])
        } else {
            git_ok(root, &["push", "--quiet", "-u", remote, "HEAD"])
        };
        out.map_err(|e| format!("No se pudieron subir los cambios: {e}"))?;
        result.pushed = true;
    }
    Ok(())
}

/// «Proyectos/Ideas.md» → «Proyectos/Ideas (remoto).md», sin pisar nada.
fn copy_name(root: &Path, path: &str) -> String {
    let (base, ext) = path.rsplit_once('.').unwrap_or((path, "md"));
    let mut candidate = format!("{base} (remoto).{ext}");
    let mut n = 2;
    while root.join(&candidate).exists() {
        candidate = format!("{base} (remoto {n}).{ext}");
        n += 1;
    }
    candidate
}

/// Resuelve un conflicto de [`sync`] uniendo los cambios del remoto con los
/// locales; en las partes que chocan decide `strategy`. Después sube.
pub fn resolve(root: &Path, strategy: Strategy) -> Result<SyncResult, String> {
    let remote = first_remote(root).ok_or("La bóveda no tiene remoto")?;
    let mut result = SyncResult {
        committed: commit_all(root, "Botion: guardar cambios")?,
        ..Default::default()
    };
    git_ok(root, &["fetch", "--quiet"]).map_err(|e| format!("No se pudo bajar: {e}"))?;

    if strategy == Strategy::Both {
        // Qué notas chocarían: las cambiadas a los dos lados.
        let base = git_ok(root, &["merge-base", "HEAD", "@{upstream}"])?;
        let mine = git_ok(root, &["diff", "--name-only", "--relative", &base, "HEAD"])?;
        let theirs = git_ok(
            root,
            &["diff", "--name-only", "--relative", &base, "@{upstream}"],
        )?;
        let theirs: Vec<&str> = theirs.lines().collect();
        for path in mine.lines().filter(|p| theirs.contains(p)) {
            // Bytes tal cual: puede ser una imagen, y los textos no se recortan.
            let out = git(root, &["show", &format!("@{{upstream}}:./{path}")])?;
            if out.status.success() {
                let copy = copy_name(root, path);
                fs::write(root.join(&copy), &out.stdout)
                    .map_err(|e| format!("No se pudo guardar la copia del remoto: {e}"))?;
            }
        }
        commit_all(root, "Botion: copia de la versión del remoto")?;
    }

    let before = git_ok(root, &["rev-parse", "HEAD"])?;
    let side = if strategy == Strategy::Theirs {
        "theirs"
    } else {
        "ours"
    };
    let mut args = identity_args(root);
    args.extend(["merge", "--quiet", "--no-edit", "-X", side, "@{upstream}"]);
    if let Err(e) = git_ok(root, &args) {
        let _ = git(root, &["merge", "--abort"]);
        return Err(format!("No se pudo unir con el remoto: {e}"));
    }
    record_changes(root, &before, &mut result)?;
    push(root, &remote, &mut result)?;
    Ok(result)
}

#[tauri::command(async)]
pub fn git_status(state: tauri::State<'_, VaultState>) -> Result<GitStatus, String> {
    Ok(status(&vault::current_root(&state)?))
}

#[tauri::command(async)]
pub fn git_init(state: tauri::State<'_, VaultState>) -> Result<GitStatus, String> {
    let root = vault::current_root(&state)?;
    init(&root)?;
    Ok(status(&root))
}

#[tauri::command(async)]
pub fn git_resolve(
    strategy: Strategy,
    state: tauri::State<'_, VaultState>,
) -> Result<SyncResult, String> {
    let root = vault::current_root(&state)?;
    let result = resolve(&root, strategy)?;
    vault::sync_index(&state)?;
    Ok(result)
}

#[tauri::command(async)]
pub fn git_history(
    path: String,
    state: tauri::State<'_, VaultState>,
) -> Result<Vec<Version>, String> {
    history(&vault::current_root(&state)?, &path)
}

#[tauri::command(async)]
pub fn git_file_at(
    hash: String,
    path: String,
    state: tauri::State<'_, VaultState>,
) -> Result<String, String> {
    file_at(&vault::current_root(&state)?, &hash, &path)
}

/// Guarda ahora una versión de toda la bóveda.
#[tauri::command(async)]
pub fn git_save_version(
    message: String,
    state: tauri::State<'_, VaultState>,
) -> Result<bool, String> {
    let root = vault::current_root(&state)?;
    if !is_repo(&root) {
        init(&root)?;
    }
    let message = message.trim();
    commit_all(
        &root,
        if message.is_empty() {
            "Versión guardada en Botion"
        } else {
            message
        },
    )
}

#[tauri::command(async)]
pub fn git_sync(state: tauri::State<'_, VaultState>) -> Result<SyncResult, String> {
    let root = vault::current_root(&state)?;
    let result = sync(&root)?;
    if result.pulled {
        vault::sync_index(&state)?;
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn run(dir: &Path, args: &[&str]) {
        let out = Command::new("git")
            .current_dir(dir)
            .args(args)
            .output()
            .unwrap();
        assert!(
            out.status.success(),
            "git {args:?}: {}",
            String::from_utf8_lossy(&out.stderr)
        );
    }

    #[test]
    fn historial_de_una_nota_aunque_se_renombre() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        fs::write(root.join("Idea.md"), "uno\n").unwrap();
        init(root).unwrap();
        fs::write(root.join("Idea.md"), "dos\n").unwrap();
        commit_all(root, "Segunda").unwrap();
        run(root, &["mv", "Idea.md", "Plan.md"]);
        commit_all(root, "Renombrada").unwrap();

        let versions = history(root, "Plan.md").unwrap();
        let msgs: Vec<_> = versions
            .iter()
            .map(|v| (v.message.as_str(), v.path.as_str()))
            .collect();
        assert_eq!(msgs[0], ("Renombrada", "Plan.md"));
        assert_eq!(msgs[1], ("Segunda", "Idea.md"));
        assert_eq!(versions.len(), 3);
        assert_eq!(
            file_at(root, &versions[1].hash, &versions[1].path).unwrap(),
            "dos\n"
        );
        assert_eq!(
            file_at(root, &versions[2].hash, &versions[2].path).unwrap(),
            "uno\n"
        );
        assert!(file_at(root, "zzz", "Plan.md").is_err());
        assert!(
            history(tempfile::tempdir().unwrap().path(), "x.md")
                .unwrap()
                .is_empty()
        );
    }

    /// Un remoto vacío y dos copias de la bóveda (como dos ordenadores).
    fn setup() -> (tempfile::TempDir, PathBuf, PathBuf) {
        let dir = tempfile::tempdir().unwrap();
        let remote = dir.path().join("remoto.git");
        run(
            dir.path(),
            &[
                "init",
                "--quiet",
                "--bare",
                "-b",
                "main",
                remote.to_str().unwrap(),
            ],
        );

        let a = dir.path().join("a");
        fs::create_dir(&a).unwrap();
        fs::write(a.join("Ideas.md"), "# Ideas\n").unwrap();
        init(&a).unwrap();
        run(&a, &["branch", "-M", "main"]);
        run(&a, &["remote", "add", "origin", remote.to_str().unwrap()]);
        sync(&a).unwrap();

        let b = dir.path().join("b");
        run(
            dir.path(),
            &[
                "clone",
                "--quiet",
                remote.to_str().unwrap(),
                b.to_str().unwrap(),
            ],
        );
        (dir, a, b)
    }

    #[test]
    fn init_crea_repositorio_e_ignora_temporales() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        fs::write(root.join("Nota.md"), "hola").unwrap();
        assert!(!status(root).repo);

        init(root).unwrap();
        fs::write(root.join(".Nota.md.botion-tmp"), "temporal").unwrap();

        let st = status(root);
        assert!(st.repo);
        assert_eq!(st.changes, 0, "el temporal debe estar ignorado");
        assert!(
            fs::read_to_string(root.join(".gitignore"))
                .unwrap()
                .contains(IGNORE_LINE)
        );

        // Sin cambios no hay commit; con cambios, sí.
        assert!(!commit_all(root, "x").unwrap());
        fs::write(root.join("Nota.md"), "adiós").unwrap();
        assert_eq!(status(root).changes, 1);
        assert!(commit_all(root, "x").unwrap());
    }

    #[test]
    fn sincroniza_entre_dos_copias() {
        let (_dir, a, b) = setup();
        assert_eq!(fs::read_to_string(b.join("Ideas.md")).unwrap(), "# Ideas\n");

        fs::write(a.join("Nueva.md"), "# Nueva\n").unwrap();
        let r = sync(&a).unwrap();
        assert!(r.committed && r.pushed && !r.pulled);

        let r = sync(&b).unwrap();
        assert!(r.pulled);
        assert_eq!(r.changed, ["Nueva.md"]);
        assert!(b.join("Nueva.md").exists());
        assert_eq!(status(&b).ahead, 0);
    }

    #[test]
    fn cambios_en_notas_distintas_se_combinan() {
        let (_dir, a, b) = setup();
        fs::write(a.join("DesdeA.md"), "a").unwrap();
        sync(&a).unwrap();
        fs::write(b.join("DesdeB.md"), "b").unwrap();

        let r = sync(&b).unwrap();
        assert!(r.committed && r.pulled && r.pushed);
        sync(&a).unwrap();
        assert!(a.join("DesdeB.md").exists());
    }

    /// Las dos copias cambian la misma línea de Ideas.md; devuelve la copia
    /// B ya con el conflicto detectado.
    fn conflicto() -> (tempfile::TempDir, PathBuf, PathBuf) {
        let (dir, a, b) = setup();
        fs::write(a.join("Ideas.md"), "# Ideas\n\nDesde A\n").unwrap();
        fs::write(a.join("SoloA.md"), "a").unwrap();
        sync(&a).unwrap();
        fs::write(b.join("Ideas.md"), "# Ideas\n\nDesde B\n").unwrap();
        (dir, a, b)
    }

    #[test]
    fn conflicto_avisa_y_no_pierde_nada() {
        let (_dir, _a, b) = conflicto();
        let r = sync(&b).unwrap();
        assert_eq!(r.conflicts, ["Ideas.md"]);
        assert!(!r.pushed);
        // El cambio local sigue en el fichero y guardado en Git.
        assert_eq!(
            fs::read_to_string(b.join("Ideas.md")).unwrap(),
            "# Ideas\n\nDesde B\n"
        );
        let st = status(&b);
        assert_eq!(st.changes, 0);
        assert_eq!((st.ahead, st.behind), (1, 1));
    }

    #[test]
    fn resolver_con_la_mia() {
        let (_dir, a, b) = conflicto();
        sync(&b).unwrap();
        let r = resolve(&b, Strategy::Mine).unwrap();
        assert!(r.pushed && r.changed.contains(&"SoloA.md".to_string()));
        assert_eq!(
            fs::read_to_string(b.join("Ideas.md")).unwrap(),
            "# Ideas\n\nDesde B\n"
        );
        assert!(b.join("SoloA.md").exists());
        // La otra copia recibe la versión elegida.
        sync(&a).unwrap();
        assert_eq!(
            fs::read_to_string(a.join("Ideas.md")).unwrap(),
            "# Ideas\n\nDesde B\n"
        );
    }

    #[test]
    fn resolver_con_la_del_remoto() {
        let (_dir, _a, b) = conflicto();
        sync(&b).unwrap();
        resolve(&b, Strategy::Theirs).unwrap();
        assert_eq!(
            fs::read_to_string(b.join("Ideas.md")).unwrap(),
            "# Ideas\n\nDesde A\n"
        );
        assert_eq!(status(&b).ahead, 0);
    }

    #[test]
    fn resolver_guardando_las_dos() {
        let (_dir, _a, b) = conflicto();
        sync(&b).unwrap();
        resolve(&b, Strategy::Both).unwrap();
        assert_eq!(
            fs::read_to_string(b.join("Ideas.md")).unwrap(),
            "# Ideas\n\nDesde B\n"
        );
        assert_eq!(
            fs::read_to_string(b.join("Ideas (remoto).md")).unwrap(),
            "# Ideas\n\nDesde A\n"
        );
        assert_eq!(status(&b).changes, 0);
    }

    #[test]
    fn sin_remoto_solo_guarda_en_local() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        init(root).unwrap();
        fs::write(root.join("Nota.md"), "hola").unwrap();
        let r = sync(root).unwrap();
        assert_eq!(
            r,
            SyncResult {
                committed: true,
                ..Default::default()
            }
        );
    }
}
