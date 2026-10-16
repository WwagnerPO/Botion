# Botion

App de escritorio local para tomar notas, inspirada en [Notion](https://www.notion.so) y [Obsidian](https://obsidian.md). Tus notas son ficheros `.md` normales en una carpeta de tu ordenador, con funciones tipo Notion: editor visual, enlaces entre notas y bases de datos con varias vistas.

> Estado: **en desarrollo inicial** (sin código todavía).

## Principios

- **Local primero:** funciona sin internet, sin servidor y sin cuenta.
- **Tus datos son tuyos:** todo se guarda en ficheros Markdown que puedes abrir con cualquier editor.
- **Ligera:** app de escritorio pequeña y rápida para Windows, macOS y Linux.

## Funciones previstas

- Bóveda: abrir una carpeta y navegar por su árbol de notas.
- Editor visual de Markdown con autoguardado.
- Enlaces entre notas `[[nota]]` y backlinks.
- Búsqueda rápida en todas las notas.
- Bases de datos: una carpeta es una base de datos, cada nota es una fila y sus propiedades van en el frontmatter YAML.
- Vistas de tabla, kanban y calendario.
- Plantillas.
- Sincronización opcional con Git.

### Ejemplo de nota con propiedades

```markdown
---
estado: En curso
prioridad: Alta
fecha: 2026-10-20
etiquetas: [botion, diseño]
---

# Diseñar la vista kanban

Contenido normal en Markdown...
```

## Stack previsto

| Capa | Tecnología |
|------|------------|
| App de escritorio | [Tauri](https://tauri.app) (Rust) |
| Interfaz | React, TypeScript, Tailwind CSS |
| Editor | Milkdown o TipTap (con Markdown) |
| Índice y búsqueda | SQLite local |
| Bases de datos | Frontmatter YAML + vistas propias |

## Hoja de ruta

1. [ ] Preparar el proyecto (Tauri + React + TypeScript + Tailwind).
2. [ ] Abrir una bóveda y mostrar el árbol de ficheros `.md`.
3. [ ] Editor visual de Markdown con autoguardado.
4. [ ] Enlaces `[[nota]]` y backlinks.
5. [ ] Índice SQLite y búsqueda rápida.
6. [ ] Bases de datos: frontmatter + vista de tabla.
7. [ ] Vistas kanban y calendario, plantillas.
8. [ ] Sincronización opcional con Git.

## Desarrollo local

Las instrucciones de instalación se añadirán cuando exista el paso 1.

## Licencia

Botion tiene doble licencia; puedes elegir la que prefieras:

- [MIT](LICENSE-MIT)
- [Apache 2.0](LICENSE-APACHE)

### Contribuciones

Salvo que indiques lo contrario, cualquier contribución que envíes para incluirla en Botion se publicará bajo esta misma doble licencia (MIT o Apache 2.0), sin términos adicionales.

Botion es un proyecto independiente y no está afiliado a Notion Labs, Inc. ni a Obsidian.
