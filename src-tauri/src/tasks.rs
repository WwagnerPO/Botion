//! Tareas de todas las notas: líneas `- [ ] texto` con fecha de vencimiento
//! `📅 2026-10-31`, recordatorio `⏰ 2026-10-31 09:00` o repetición
//! `🔁 cada semana` (la misma sintaxis que el plugin Tasks de Obsidian).

use crate::vault::{self, VaultState};
use serde::Serialize;
use std::fs;

#[derive(Debug, Serialize, PartialEq)]
pub struct Task {
    pub path: String,
    /// Línea (desde 0) dentro del fichero.
    pub line: usize,
    /// Texto sin la casilla ni las marcas de fecha.
    pub text: String,
    pub done: bool,
    pub due: Option<String>,
    /// `2026-10-31` o `2026-10-31 09:00`.
    pub remind: Option<String>,
    pub repeat: Option<String>,
}

const DUE: &str = "📅";
const REMIND: &str = "⏰";
const REPEAT: &str = "🔁";
const DONE: &str = "✅";
const MARKS: [&str; 4] = [DUE, REMIND, REPEAT, DONE];

/// `- [ ] texto`, `* [x] texto`, `1. [ ] texto` → (hecha, texto).
fn checkbox(line: &str) -> Option<(bool, &str)> {
    let t = line.trim_start();
    let rest = if let Some(r) = t
        .strip_prefix("- ")
        .or_else(|| t.strip_prefix("* "))
        .or_else(|| t.strip_prefix("+ "))
    {
        r
    } else {
        let digits = t.find(|c: char| !c.is_ascii_digit())?;
        if digits == 0 {
            return None;
        }
        t[digits..]
            .strip_prefix(". ")
            .or_else(|| t[digits..].strip_prefix(") "))?
    };
    let done = match rest.get(..3)? {
        "[ ]" => false,
        "[x]" | "[X]" => true,
        _ => return None,
    };
    Some((done, rest[3..].trim()))
}

fn is_date(s: &str) -> bool {
    let b = s.as_bytes();
    b.len() == 10
        && b.iter().enumerate().all(|(i, c)| {
            if i == 4 || i == 7 {
                *c == b'-'
            } else {
                c.is_ascii_digit()
            }
        })
}

fn is_time(s: &str) -> bool {
    let b = s.as_bytes();
    b.len() == 5
        && b[2] == b':'
        && b.iter()
            .enumerate()
            .all(|(i, c)| i == 2 || c.is_ascii_digit())
}

/// Lo que va detrás de una marca, hasta la siguiente marca.
fn after<'a>(text: &'a str, mark: &str) -> Option<&'a str> {
    let start = text.find(mark)? + mark.len();
    let rest = &text[start..];
    let end = MARKS
        .iter()
        .filter_map(|m| rest.find(m))
        .min()
        .unwrap_or(rest.len());
    Some(rest[..end].trim())
}

/// Lee las marcas de una tarea. Sin fecha ni recordatorio no cuenta.
pub fn parse_task(path: &str, line_no: usize, line: &str) -> Option<Task> {
    let (done, body) = checkbox(line)?;
    let due = after(body, DUE)
        .and_then(|v| v.get(..10))
        .filter(|d| is_date(d))
        .map(str::to_string);
    let remind = after(body, REMIND).and_then(|v| {
        let date = v.get(..10).filter(|d| is_date(d))?;
        let time = v.get(11..16).filter(|t| is_time(t));
        Some(match time {
            Some(t) => format!("{date} {t}"),
            None => date.to_string(),
        })
    });
    if due.is_none() && remind.is_none() {
        return None;
    }
    let repeat = after(body, REPEAT)
        .filter(|r| !r.is_empty())
        .map(str::to_string);
    let first = MARKS
        .iter()
        .filter_map(|m| body.find(m))
        .min()
        .unwrap_or(body.len());
    Some(Task {
        path: path.to_string(),
        line: line_no,
        text: body[..first].trim().to_string(),
        done,
        due,
        remind,
        repeat,
    })
}

/// Tareas con fecha de un texto, sin mirar dentro de los bloques de código.
pub fn tasks_in(path: &str, content: &str) -> Vec<Task> {
    let mut fence: Option<&str> = None;
    let mut out = Vec::new();
    for (i, line) in content.lines().enumerate() {
        let t = line.trim_start();
        let marker = if t.starts_with("```") {
            Some("```")
        } else if t.starts_with("~~~") {
            Some("~~~")
        } else {
            None
        };
        if let Some(m) = marker {
            match fence {
                None => fence = Some(m),
                Some(open) if open == m => fence = None,
                _ => {}
            }
            continue;
        }
        if fence.is_none()
            && let Some(task) = parse_task(path, i, line)
        {
            out.push(task);
        }
    }
    out
}

#[tauri::command(async)]
pub fn list_tasks(state: tauri::State<'_, VaultState>) -> Result<Vec<Task>, String> {
    let root = vault::current_root(&state)?;
    let mut notes = Vec::new();
    vault::flatten(&vault::tree_of(&root)?, &mut notes);
    let mut out = Vec::new();
    for path in notes {
        let file = root.join(&path);
        // Las notas enormes (exportaciones, registros) no se miran.
        if fs::metadata(&file)
            .map(|m| m.len() > 2_000_000)
            .unwrap_or(true)
        {
            continue;
        }
        if let Ok(content) = fs::read_to_string(&file)
            && content.contains("[")
        {
            out.extend(tasks_in(&path, &content));
        }
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lee_fechas_recordatorios_y_repeticion() {
        let t = parse_task(
            "a.md",
            3,
            "  - [ ] Pagar luz 📅 2026-10-31 🔁 cada mes ⏰ 2026-10-30 09:00",
        )
        .unwrap();
        assert_eq!(t.text, "Pagar luz");
        assert!(!t.done);
        assert_eq!(t.due.as_deref(), Some("2026-10-31"));
        assert_eq!(t.remind.as_deref(), Some("2026-10-30 09:00"));
        assert_eq!(t.repeat.as_deref(), Some("cada mes"));
        let hecha = parse_task("a.md", 0, "* [x] Hecha ⏰ 2026-01-02 ✅ 2026-01-02").unwrap();
        assert!(hecha.done);
        assert_eq!(hecha.remind.as_deref(), Some("2026-01-02"));
        assert!(parse_task("a.md", 0, "- [ ] Sin fecha").is_none());
        assert!(parse_task("a.md", 0, "- Texto 📅 2026-10-31").is_none());
        assert!(parse_task("a.md", 0, "1. [ ] Numerada 📅 2026-10-31").is_some());
    }

    #[test]
    fn ignora_bloques_de_codigo() {
        let md = "- [ ] Una 📅 2026-10-31\n```\n- [ ] Código 📅 2026-10-31\n```\n- [ ] Dos 📅 2026-11-01\n";
        let tasks = tasks_in("n.md", md);
        assert_eq!(tasks.iter().map(|t| t.line).collect::<Vec<_>>(), vec![0, 4]);
    }
}
