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
            let conflicts =
                git_ok(root, &["diff", "--name-only", "--diff-filter=U"]).unwrap_or_default();
            let _ = git(root, &["rebase", "--abort"]);
            if !conflicts.is_empty() {
                let files: Vec<&str> = conflicts.lines().collect();
                return Err(format!(
                    "Conflicto con los cambios del remoto en: {}. Tus cambios están guardados \
                     en Git; resuelve el conflicto con Git y vuelve a sincronizar.",
                    files.join(", ")
                ));
            }
            return Err(format!("No se pudieron bajar los cambios: {e}"));
        }
        let after = git_ok(root, &["rev-parse", "HEAD"])?;
        if before != after {
            result.changed = git_ok(
                root,
                &["diff", "--name-only", "--relative", &before, &after],
            )?
            .lines()
            .map(str::to_string)
            .collect();
            // Si solo se reaplicaron nuestros commits, no ha llegado nada.
            result.pulled = !result.changed.is_empty();
        }
    }

    let st = status(root);
    if st.ahead > 0 || !has_upstream(root) {
        let push = if has_upstream(root) {
            git_ok(root, &["push", "--quiet"])
        } else {
            git_ok(root, &["push", "--quiet", "-u", &remote, "HEAD"])
        };
        push.map_err(|e| format!("No se pudieron subir los cambios: {e}"))?;
        result.pushed = true;
    }
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

    #[test]
    fn conflicto_avisa_y_no_pierde_nada() {
        let (_dir, a, b) = setup();
        fs::write(a.join("Ideas.md"), "# Ideas\n\nDesde A\n").unwrap();
        sync(&a).unwrap();
        fs::write(b.join("Ideas.md"), "# Ideas\n\nDesde B\n").unwrap();

        let err = sync(&b).unwrap_err();
        assert!(
            err.contains("Conflicto") && err.contains("Ideas.md"),
            "{err}"
        );
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
