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

/// Cambia una propiedad (`None` la quita) y devuelve la nota nueva.
pub fn set(content: &str, key: &str, value: Option<Value>) -> Result<String, String> {
    let mut props = read(content)?;
    match value {
        Some(v) => {
            props.insert(key.to_string(), v);
        }
        None => {
            props.shift_remove(key);
        }
    }
    write(content, &props)
}

/// Renombra una propiedad conservando su posición. Si no existe, no cambia
/// nada.
pub fn rename(content: &str, old: &str, new: &str) -> Result<Option<String>, String> {
    let props = read(content)?;
    if !props.contains_key(old) || old == new {
        return Ok(None);
    }
    let renamed: Props = props
        .into_iter()
        .filter(|(k, _)| k != new)
        .map(|(k, v)| {
            if k == old {
                (new.to_string(), v)
            } else {
                (k, v)
            }
        })
        .collect();
    write(content, &renamed).map(Some)
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
    fn textos_que_parecen_otro_tipo_siguen_siendo_texto() {
        let out = set("", "codigo", Some(json!("true"))).unwrap();
        assert_eq!(read(&out).unwrap()["codigo"], json!("true"));
        let out = set("", "version", Some(json!("1.0"))).unwrap();
        assert_eq!(read(&out).unwrap()["version"], json!("1.0"));
    }
}
