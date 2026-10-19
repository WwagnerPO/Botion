# Botion

App de escritorio local para tomar notas, inspirada en [Notion](https://www.notion.so) y [Obsidian](https://obsidian.md). Tus notas son ficheros `.md` normales en una carpeta de tu ordenador, con funciones tipo Notion: editor visual, enlaces entre notas y bases de datos con varias vistas.

> Estado: **primera versión completa** (todas las fases de la hoja de ruta).

## Principios

- **Local primero:** funciona sin internet, sin servidor y sin cuenta.
- **Tus datos son tuyos:** todo se guarda en ficheros Markdown que puedes abrir con cualquier editor.
- **Ligera:** app de escritorio pequeña y rápida para Windows, macOS y Linux.

## Funciones previstas

- Bóveda: abrir una carpeta y navegar por su árbol de notas.
- Crear, renombrar y borrar notas y carpetas; al renombrar se actualizan los enlaces.
- Editor visual de Markdown con autoguardado.
- Enlaces entre notas `[[nota]]` y backlinks.
- Búsqueda rápida en todas las notas (`Ctrl+K`), sin distinguir tildes.
- Bases de datos: una carpeta es una base de datos, cada nota es una fila y sus propiedades van en el frontmatter YAML.
- Vistas de tabla, kanban y calendario.
- Plantillas.
- Tema claro, oscuro o el del sistema.
- Sincronización opcional con Git.

### Comandos `/`

Escribe `/` al principio de una línea vacía para abrir el menú de bloques. Puedes seguir escribiendo para filtrar (por ejemplo `/fecha`).

| Grupo | Comandos |
|-------|----------|
| Texto | Texto, Título 1–6, Cita, Separador |
| Listas | Lista con viñetas, Lista numerada, Lista de tareas |
| Avanzado | Imagen, Código, Tabla, Fórmula |
| Botion | Enlace a nota (busca o crea la nota e inserta `[[nota]]`), Propiedad, Base de datos, Plantilla, Fecha de hoy, Hora actual |

### Bases de datos

Cualquier carpeta puede ser una base de datos (clic derecho → «Convertir en base de datos», o `/Base de datos` desde una nota). Se abre como una tabla:

- Cada nota de la carpeta es una fila; sus propiedades son las columnas.
- Tipos de columna: Texto, Número, Casilla, Fecha, Selección y Etiquetas.
- Ordenar, filtrar, añadir, renombrar y eliminar propiedades desde la cabecera.
- Los datos están en el frontmatter de cada nota. La carpeta solo guarda la configuración de la vista en un fichero oculto `.botion-db.json`.

Cada base de datos tiene tres vistas, y recuerda la última que usaste:

- **Tabla:** edición directa de cada celda.
- **Kanban:** una columna por cada valor de una propiedad de selección; arrastra las tarjetas para cambiar el valor.
- **Calendario:** las notas en el día de una propiedad de fecha; arrastra para cambiar la fecha o pulsa `+` en un día para crear una nota con esa fecha.

Las notas muestran sus propiedades encima del texto y se pueden editar ahí también.

### Plantillas

Las plantillas son notas normales de la carpeta `Plantillas`. Úsalas con `/Plantilla` (inserta el contenido en la nota abierta y le añade las propiedades que falten) o con clic derecho → «Nueva nota desde plantilla».

Variables que se sustituyen al usarlas: `{{titulo}}`, `{{fecha}}` y `{{hora}}`.

### Sincronización con Git

Opcional. Al pie de la barra lateral:

1. «Activar historial con Git» convierte la bóveda en un repositorio (si no lo era) y guarda una primera versión.
2. Para sincronizar entre ordenadores, añade un remoto con Git (por ejemplo `git remote add origin git@github.com:tu-usuario/notas.git`).
3. «Sincronizar» guarda los cambios, baja los del remoto y sube los tuyos. También puede hacerse solo cada 5 minutos.

Usa el `git` instalado en tu sistema y sus credenciales (SSH o gestor de credenciales); Botion nunca pide contraseñas. Si dos ordenadores cambian la misma parte de una nota, avisa del conflicto sin perder nada: tus cambios quedan guardados en Git para resolverlo.

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
| Editor | [Milkdown](https://milkdown.dev) (Crepe) |
| Índice y búsqueda | SQLite local |
| Bases de datos | Frontmatter YAML + vistas propias |

## Hoja de ruta

1. [x] Preparar el proyecto (Tauri + React + TypeScript + Tailwind).
2. [x] Abrir una bóveda y mostrar el árbol de ficheros `.md`.
3. [x] Editor visual de Markdown con autoguardado.
4. [x] Enlaces `[[nota]]` y backlinks.
5. [x] Gestionar notas: crear, renombrar (actualizando enlaces), borrar y detectar cambios externos.
6. [x] Índice SQLite y búsqueda rápida.
7. [x] Bases de datos: frontmatter + vista de tabla.
8. [x] Vistas kanban y calendario, plantillas.
9. [x] Sincronización opcional con Git.

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

### Índice de búsqueda

Botion guarda un índice SQLite de cada bóveda en la carpeta de caché del sistema (no dentro de tus notas). Se puede borrar sin perder nada: se reconstruye solo al abrir la bóveda.

### Estructura

```
src/              Interfaz (React + TypeScript + Tailwind)
  components/     Componentes de la interfaz
  lib/            Comunicación con Rust y utilidades
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
