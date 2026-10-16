# Botion

App de escritorio local para tomar notas, inspirada en [Notion](https://www.notion.so) y [Obsidian](https://obsidian.md). Tus notas son ficheros `.md` normales en una carpeta de tu ordenador, con funciones tipo Notion: editor visual, enlaces entre notas y bases de datos con varias vistas.

> Estado: **en desarrollo inicial**.

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

1. [x] Preparar el proyecto (Tauri + React + TypeScript + Tailwind).
2. [ ] Abrir una bóveda y mostrar el árbol de ficheros `.md`.
3. [ ] Editor visual de Markdown con autoguardado.
4. [ ] Enlaces `[[nota]]` y backlinks.
5. [ ] Índice SQLite y búsqueda rápida.
6. [ ] Bases de datos: frontmatter + vista de tabla.
7. [ ] Vistas kanban y calendario, plantillas.
8. [ ] Sincronización opcional con Git.

## Desarrollo local

### Requisitos

1. [Node.js](https://nodejs.org) 20 o superior.
2. [pnpm](https://pnpm.io/installation).
3. [Rust](https://www.rust-lang.org/tools/install) (estable).
4. Dependencias de sistema de Tauri para tu sistema operativo: [guía oficial](https://tauri.app/start/prerequisites/).
   - Windows: Microsoft C++ Build Tools y WebView2 (ya viene en Windows 10/11).
   - macOS: `xcode-select --install`.
   - Linux (Debian/Ubuntu): `sudo apt install libwebkit2gtk-4.1-dev build-essential libssl-dev librsvg2-dev libxdo-dev libayatana-appindicator3-dev`.

### Arrancar

1. Instalar dependencias: `pnpm install`
2. Abrir la app en modo desarrollo: `pnpm tauri dev`
3. Generar el instalador: `pnpm tauri build`

### Estructura

```
src/              Interfaz (React + TypeScript + Tailwind)
  components/     Componentes de la interfaz
src-tauri/        Parte nativa (Rust + Tauri)
  src/            Código Rust
  tauri.conf.json Configuración de la app
```

## Licencia

Botion tiene doble licencia; puedes elegir la que prefieras:

- [MIT](LICENSE-MIT)
- [Apache 2.0](LICENSE-APACHE)

### Contribuciones

Salvo que indiques lo contrario, cualquier contribución que envíes para incluirla en Botion se publicará bajo esta misma doble licencia (MIT o Apache 2.0), sin términos adicionales.

Botion es un proyecto independiente y no está afiliado a Notion Labs, Inc. ni a Obsidian.
