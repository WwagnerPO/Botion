//! Propiedades de las notas: el frontmatter YAML del principio del fichero.
//!
//! ```markdown
//! ---
//! estado: En curso
//! etiquetas: [botion, diseño]
//! ---
//! ```

use serde_json::{Map, Value};

pub type Props = Map<String, Value>;

/// Posición del frontmatter: el YAML de dentro y dónde empieza el cuerpo.
struct Frontmatter<'a> {
    yaml: &'a str,
    body_start: usize,
}

fn find(content: &str) -> Option<Frontmatter<'_>> {
    let rest = content
        .strip_prefix("---\n")
        .or_else(|| content.strip_prefix("---\r\n"))?;
    let open_len = content.len() - rest.len();

    let mut pos = 0;
    for line in rest.split_inclusive('\n') {
        if line.trim_end() == "---" {
            return Some(Frontmatter {
                yaml: &rest[..pos],
                body_start: open_len + pos + line.len(),
            });
        }
        pos += line.len();
    }
    None
}

/// Lee las propiedades de una nota. Sin frontmatter, devuelve un mapa vacío.
pub fn read(content: &str) -> Result<Props, String> {
    let Some(fm) = find(content) else {
        return Ok(Props::new());
    };
    if fm.yaml.trim().is_empty() {
        return Ok(Props::new());
    }
    match serde_yaml_ng::from_str::<Value>(fm.yaml) {
        Ok(Value::Object(map)) => Ok(map),
        Ok(Value::Null) => Ok(Props::new()),
        Ok(_) => Err("El frontmatter no es una lista de propiedades".into()),
        Err(e) => Err(format!("El frontmatter no es YAML válido: {e}")),
    }
}

/// Devuelve la nota con estas propiedades, sin tocar el cuerpo. Sin
/// propiedades, quita el frontmatter.
pub fn write(content: &str, props: &Props) -> Result<String, String> {
    let body = match find(content) {
        Some(fm) => content[fm.body_start..].trim_start_matches(['\n', '\r']),
        None => content,
    };
    if props.is_empty() {
        return Ok(body.to_string());
    }
    let yaml = serde_yaml_ng::to_string(props)
        .map_err(|e| format!("No se pudieron escribir las propiedades: {e}"))?;
    let sep = if body.is_empty() { "" } else { "\n" };
    Ok(format!("---\n{yaml}---\n{sep}{body}"))
}

/// Una propiedad de primer nivel dentro del YAML: su nombre y las líneas
/// que ocupa (la del nombre y las de su valor, si sigue en varias líneas).
struct Entry {
    key: String,
    lines: std::ops::Range<usize>,
}

fn entries(lines: &[&str]) -> Vec<Entry> {
    let mut out: Vec<Entry> = Vec::new();
    for (i, line) in lines.iter().enumerate() {
        let continues = line.starts_with([' ', '\t']) || line.starts_with("- ") || *line == "-";
        if continues {
            if let Some(last) = out.last_mut()
                && last.lines.end == i
            {
                last.lines.end = i + 1;
            }
            continue;
        }
        if line.trim().is_empty() || line.starts_with('#') {
            continue;
        }
        if let Some((key, _)) = line.split_once(':') {
            let key = key.trim().trim_matches(['"', '\'']).to_string();
            out.push(Entry {
                key,
                lines: i..i + 1,
            });
        }
    }
    out
}

/// YAML de una sola propiedad, tal como lo escribiría serde.
fn snippet(key: &str, value: &Value) -> Result<String, String> {
    let mut one = Props::new();
    one.insert(key.to_string(), value.clone());
    serde_yaml_ng::to_string(&one).map_err(|e| format!("No se pudo escribir la propiedad: {e}"))
}

/// Edita solo las líneas de una propiedad y deja igual el resto del YAML
/// (comentarios, orden, comillas...). `edit` recibe las líneas y devuelve
/// las nuevas, o `None` si no sabe hacerlo.
fn edit_lines(
    content: &str,
    edit: impl FnOnce(&[&str], &[Entry]) -> Option<Vec<String>>,
) -> Option<String> {
    let fm = find(content)?;
    let lines: Vec<&str> = fm.yaml.lines().collect();
    let new_lines = edit(&lines, &entries(&lines))?;
    let yaml: String = new_lines.iter().map(|l| format!("{l}\n")).collect();
    let body = &content[fm.body_start..];
    if yaml.trim().is_empty() {
        // Sin nada dentro, se quita el frontmatter entero.
        return Some(body.trim_start_matches(['\n', '\r']).to_string());
    }
    Some(format!("---\n{yaml}---\n{body}"))
}

/// Comprueba que la edición línea a línea da exactamente lo esperado; si
/// no, se reescribe todo el frontmatter (pierde comentarios, pero es seguro).
fn checked(edited: Option<String>, expected: &Props, content: &str) -> Result<String, String> {
    if let Some(out) = edited
        && read(&out).ok().as_ref() == Some(expected)
    {
        return Ok(out);
    }
    write(content, expected)
}

/// Cambia una propiedad (`None` la quita) y devuelve la nota nueva. Solo se
/// tocan las líneas de esa propiedad: los comentarios y el formato del resto
/// del YAML se conservan.
pub fn set(content: &str, key: &str, value: Option<Value>) -> Result<String, String> {
    let mut expected = read(content)?;
    match &value {
        Some(v) => {
            expected.insert(key.to_string(), v.clone());
        }
        None => {
            expected.shift_remove(key);
        }
    }
    let new_snippet = value.as_ref().map(|v| snippet(key, v)).transpose()?;

    let edited = edit_lines(content, |lines, entries| {
        let mut out: Vec<String> = lines.iter().map(|l| l.to_string()).collect();
        let replacement: Vec<String> = new_snippet
            .as_deref()
            .map(|s| s.lines().map(str::to_string).collect())
            .unwrap_or_default();
        match entries.iter().find(|e| e.key == key) {
            Some(e) => {
                out.splice(e.lines.clone(), replacement);
            }
            None if new_snippet.is_some() => out.extend(replacement),
            None => {}
        }
        Some(out)
    });
    checked(edited, &expected, content)
}

/// Renombra una propiedad conservando su posición y el resto del YAML. Si
/// no existe, no cambia nada.
pub fn rename(content: &str, old: &str, new: &str) -> Result<Option<String>, String> {
    let props = read(content)?;
    if !props.contains_key(old) || old == new {
        return Ok(None);
    }
    let expected: Props = props
        .iter()
        .filter(|(k, _)| k.as_str() != new)
        .map(|(k, v)| {
            (
                if k == old { new.to_string() } else { k.clone() },
                v.clone(),
            )
        })
        .collect();
    let new_key = snippet(new, &Value::Null)?;
    let new_key = new_key
        .trim_end()
        .trim_end_matches("null")
        .trim_end()
        .trim_end_matches(':');

    let edited = edit_lines(content, |lines, entries| {
        // Si ya había otra con el nombre nuevo, mejor reescribir todo.
        if entries.iter().any(|e| e.key == new) {
            return None;
        }
        let e = entries.iter().find(|e| e.key == old)?;
        let line = lines[e.lines.start];
        let (_, rest) = line.split_once(':')?;
        let mut out: Vec<String> = lines.iter().map(|l| l.to_string()).collect();
        out[e.lines.start] = format!("{new_key}:{rest}");
        Some(out)
    });
    checked(edited, &expected, content).map(Some)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    const NOTA: &str = "---\nestado: En curso\nprioridad: 2\nhecho: false\nfecha: 2026-10-20\netiquetas: [botion, diseño]\n---\n\n# Plan\n\nTexto.\n";

    #[test]
    fn lee_tipos() {
        let p = read(NOTA).unwrap();
        assert_eq!(
            Value::Object(p),
            json!({
                "estado": "En curso",
                "prioridad": 2,
                "hecho": false,
                "fecha": "2026-10-20",
                "etiquetas": ["botion", "diseño"]
            })
        );
        // El orden se conserva.
        let keys: Vec<_> = read(NOTA).unwrap().keys().cloned().collect();
        assert_eq!(keys, ["estado", "prioridad", "hecho", "fecha", "etiquetas"]);
    }

    #[test]
    fn sin_frontmatter_o_vacio() {
        assert!(read("# Hola\n").unwrap().is_empty());
        assert!(read("---\n---\n# Hola\n").unwrap().is_empty());
        // Un separador que no está al principio no es frontmatter.
        assert!(read("# Hola\n---\nno: es\n---\n").unwrap().is_empty());
        assert!(read("---\n: : mal\n  - x\n---\n").is_err());
    }

    #[test]
    fn cambia_una_propiedad_sin_tocar_el_cuerpo() {
        let out = set(NOTA, "estado", Some(json!("Hecho"))).unwrap();
        assert!(out.ends_with("---\n\n# Plan\n\nTexto.\n"));
        let p = read(&out).unwrap();
        assert_eq!(p["estado"], "Hecho");
        assert_eq!(p["fecha"], "2026-10-20");
        assert_eq!(p.keys().next().unwrap(), "estado");

        let out = set(&out, "estado", None).unwrap();
        assert!(!read(&out).unwrap().contains_key("estado"));
    }

    #[test]
    fn crea_y_quita_el_frontmatter() {
        let out = set("# Hola\n", "nueva", Some(json!(true))).unwrap();
        assert_eq!(out, "---\nnueva: true\n---\n\n# Hola\n");
        assert_eq!(set(&out, "nueva", None).unwrap(), "# Hola\n");
        assert_eq!(set("", "a", Some(json!(1))).unwrap(), "---\na: 1\n---\n");
    }

    #[test]
    fn renombra_conservando_posicion() {
        let out = rename(NOTA, "prioridad", "importancia").unwrap().unwrap();
        let keys: Vec<_> = read(&out).unwrap().keys().cloned().collect();
        assert_eq!(
            keys,
            ["estado", "importancia", "hecho", "fecha", "etiquetas"]
        );
        assert!(rename(NOTA, "no-existe", "x").unwrap().is_none());
    }

    #[test]
    fn conserva_comentarios_y_formato() {
        let nota = "---\n# Datos del proyecto\nestado: 'En curso'   # cambia a Hecho al terminar\netiquetas:\n  - casa\n  - taller\nfecha: 2026-10-20\n---\n\nTexto.\n";

        let out = set(nota, "fecha", Some(json!("2026-11-01"))).unwrap();
        assert!(out.contains("# Datos del proyecto\n"));
        assert!(out.contains("estado: 'En curso'   # cambia a Hecho al terminar\n"));
        assert!(out.contains("etiquetas:\n  - casa\n  - taller\n"));
        assert_eq!(read(&out).unwrap()["fecha"], "2026-11-01");
        assert!(out.ends_with("---\n\nTexto.\n"));

        // Cambiar una lista de varias líneas sustituye todas sus líneas.
        let out = set(&out, "etiquetas", Some(json!(["casa"]))).unwrap();
        assert_eq!(read(&out).unwrap()["etiquetas"], json!(["casa"]));
        assert!(!out.contains("taller"));
        assert!(out.contains("# Datos del proyecto\n"));

        // Añadir va al final; quitar borra solo sus líneas.
        let out = set(&out, "nueva", Some(json!(true))).unwrap();
        let out = set(&out, "estado", None).unwrap();
        assert!(out.contains("# Datos del proyecto\n"));
        assert!(!out.contains("estado"));
        let keys: Vec<_> = read(&out).unwrap().keys().cloned().collect();
        assert_eq!(keys, ["etiquetas", "fecha", "nueva"]);

        let out = rename(&out, "fecha", "entrega").unwrap().unwrap();
        assert!(out.contains("# Datos del proyecto\n"));
        assert_eq!(read(&out).unwrap()["entrega"], "2026-11-01");
    }

    #[test]
    fn textos_que_parecen_otro_tipo_siguen_siendo_texto() {
        let out = set("", "codigo", Some(json!("true"))).unwrap();
        assert_eq!(read(&out).unwrap()["codigo"], json!("true"));
        let out = set("", "version", Some(json!("1.0"))).unwrap();
        assert_eq!(read(&out).unwrap()["version"], json!("1.0"));
    }
}
