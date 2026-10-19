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

Escribe `/` al principio de una línea vacía para abrir el menú de bloques. Puedes seguir escribiendo para filtrar, con o sin tildes (por ejemplo `/fecha` o `/titulo`).

| Grupo | Comandos |
|-------|----------|
| Texto | Texto, Título 1–6, Cita, Separador |
| Listas | Lista con viñetas, Lista numerada, Lista de tareas |
| Avanzado | Código, Tabla, Fórmula |
| Botion | Página (crea una nota y la enlaza), Imagen, Vídeo, Audio, Archivo, YouTube, Emoji, Icono de la página, Portada, Incrustar nota, Vista de base de datos, Enlace a nota, Propiedad, Base de datos, Plantilla, Aviso (nota, consejo, aviso, peligro), Desplegable, Índice, Resaltar, Diagrama, Exportar a PDF, Exportar a HTML, Fecha de hoy, Hora actual |

Todo se guarda con sintaxis compatible con Obsidian:

| Función | Markdown |
|---------|----------|
| Aviso / desplegable | `> [!tip] Título` / `> [!note]- Título` |
| Índice | lista de `[[#título]]` |
| Resaltar | `==texto==` (también `Ctrl+Mayús+H` o el botón de la barra de formato) |
| Incrustar nota | `![[nota]]` en una línea propia |
| Vista de base de datos | `![[Carpeta/]]` (con barra final; solo Botion la dibuja) |
| Diagrama | bloque de código `mermaid`, con vista previa |
| Imagen | `![texto](adjuntos/foto.png)` |
| Vídeo, audio o archivo | `![[adjuntos/clip.mp4]]` (se reproduce o se abre con su programa) |
| YouTube | `![YouTube](https://youtu.be/…)` |
| Icono y portada | `icono: 🚀` y `portada: violeta` en el frontmatter |

### Atajos

| Atajo | Acción |
|-------|--------|
| `Ctrl+K` | Buscar notas |
| `Ctrl+P` | Paleta de comandos |
| `Ctrl+F` | Buscar en la nota (`Enter` / `Mayús+Enter` para moverse) |
| `Ctrl+N` | Nueva nota |
| `Ctrl+Mayús+H` | Resaltar |

En macOS, `Cmd` en lugar de `Ctrl`.

### Icono y portada

Pasa el ratón sobre la cabecera de la nota y pulsa «Añadir icono» o «Añadir portada» (o usa `/Icono de la página` y `/Portada`). El icono también se ve en la barra lateral.

- **Icono:** cualquier emoji; el selector busca en español («cohete», «libro»…).
- **Portada:** un color (`violeta`, `atardecer`, `océano`, `bosque`, `arena`, `noche`, `rosa`, `niebla`) o una imagen subida a `adjuntos/`.

### Imágenes, archivos y exportar

- Pega o arrastra una imagen en la nota (o usa `/Imagen`): se guarda en la carpeta `adjuntos/` de la bóveda y se enlaza con una ruta relativa.
- Igual con vídeos, audios y otros archivos (`/Vídeo`, `/Audio`, `/Archivo`): los vídeos y audios se reproducen en la nota; el resto se abre con su programa.
- «Exportar» (arriba a la derecha de la nota) o `/Exportar a…`:
  - **HTML:** un único fichero con las imágenes y los diagramas dentro.
  - **PDF:** abre el diálogo de imprimir; elige «Guardar como PDF».

### Organizar

- Arrastra notas o carpetas sobre otra carpeta para moverlas (o a una zona vacía para llevarlas a la raíz). Los enlaces se actualizan solos.
- Al pasar el ratón por una carpeta, `+` crea una nota dentro y `…` abre el mismo menú que el clic derecho (también «Mostrar en el explorador»).

### Bases de datos

Cualquier carpeta puede ser una base de datos (clic derecho → «Convertir en base de datos», o `/Base de datos` desde una nota). Se abre como una tabla:

- Cada nota de la carpeta es una fila; sus propiedades son las columnas.
- Tipos de columna: Texto, Número, Casilla, Fecha, Selección y Etiquetas.
- Ordenar, filtrar, añadir, renombrar y eliminar propiedades desde la cabecera.
- «Incluir subcarpetas» muestra también las notas de las carpetas de dentro.
- Los datos están en el frontmatter de cada nota. La carpeta solo guarda la configuración de la vista en un fichero oculto `.botion-db.json`.

Cada base de datos tiene tres vistas, y recuerda la última que usaste:

- **Tabla:** edición directa de cada celda.
- **Kanban:** una columna por cada valor de una propiedad de selección; arrastra las tarjetas para cambiar el valor.
- **Calendario:** las notas en el día de una propiedad de fecha; arrastra para cambiar la fecha o pulsa `+` en un día para crear una nota con esa fecha.

Las notas muestran sus propiedades encima del texto y se pueden editar ahí también. Al editarlas se conservan los comentarios y el formato del resto del frontmatter.

### Plantillas

Las plantillas son notas normales de la carpeta `Plantillas`. Úsalas con `/Plantilla` (inserta el contenido en la nota abierta y le añade las propiedades que falten) o con clic derecho → «Nueva nota desde plantilla».

Variables que se sustituyen al usarlas: `{{titulo}}`, `{{fecha}}` y `{{hora}}`.

### Sincronización con Git

Opcional. Al pie de la barra lateral:

1. «Activar historial con Git» convierte la bóveda en un repositorio (si no lo era) y guarda una primera versión.
2. Para sincronizar entre ordenadores, añade un remoto con Git (por ejemplo `git remote add origin git@github.com:tu-usuario/notas.git`).
3. «Sincronizar» guarda los cambios, baja los del remoto y sube los tuyos. También puede hacerse solo cada 5 minutos.

Usa el `git` instalado en tu sistema y sus credenciales (SSH o gestor de credenciales); Botion nunca pide contraseñas.

Si dos ordenadores cambian la misma parte de una nota, Botion pregunta qué hacer:

- **Guardar las dos:** mantiene la tuya y guarda la otra como «nota (remoto).md».
- **Quedarme con la mía** o **usar la del otro ordenador**.
- **Decidir más tarde:** tus cambios quedan guardados en Git y no se pierde nada.

Lo que no choca se une solo.

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

### Pendiente

Lo que falta respecto a Notion. Se marca al terminarlo y se quita en la versión siguiente.

**Versión y pruebas**

- [ ] Publicar la v0.2.0.
- [ ] Probar en la app real el vídeo, el audio y YouTube.

**Bases de datos**

- [ ] Vistas de galería, lista y cronograma.
- [ ] Varias vistas guardadas por base de datos, cada una con sus filtros.
- [ ] Filtros por propiedad («estado es Hecho») y agrupar en la tabla.
- [ ] Fórmulas, relaciones entre bases de datos y rollups.
- [ ] Más tipos de propiedad: URL, email, teléfono, archivos, fecha de creación y de edición.
- [ ] Abrir una fila en un panel lateral sin salir de la tabla.
- [ ] Columnas: cambiar ancho, reordenar y ocultar.
- [ ] Totales al pie (contar, sumar, media).

**Editor y navegación**

- [ ] Menciones con `@` (nota o fecha).
- [ ] Pestañas o dos notas lado a lado.
- [ ] Grafo de enlaces entre notas.
- [ ] Historial de una nota con Git: ver y restaurar versiones.
- [ ] Notas favoritas y recientes en la barra lateral.
- [ ] Arrastrar bloques para reordenarlos y «Convertir en…».

**Extras**

- [ ] Importar desde Notion (export en Markdown/CSV).
- [ ] Firmar los instaladores (necesita certificados de pago; ver más abajo).
- [ ] Actualización automática de la app.

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

### Publicar una versión

1. Sube el número de versión en `package.json`, `src-tauri/Cargo.toml` y `src-tauri/tauri.conf.json`.
2. Crea y sube una etiqueta (`git tag v0.2.0 && git push origin v0.2.0`) o lanza a mano el workflow «Versión» en **Actions**.
3. GitHub Actions compila los instaladores de Windows, macOS y Linux y los deja en un borrador en **Releases**.
4. Revisa el borrador y pulsa **Publish release**.

### Firmar los instaladores (opcional)

Sin firma, Windows (SmartScreen) y macOS (Gatekeeper) avisan la primera vez que se abre la app. Para quitar el aviso hace falta un certificado de pago; el workflow de versiones ya lo usa si se añaden estos secretos en **Settings → Secrets and variables → Actions**:

1. **macOS** (cuenta de Apple Developer, 99 $/año):
   - `APPLE_CERTIFICATE` (el `.p12` en base64) y `APPLE_CERTIFICATE_PASSWORD`.
   - `APPLE_SIGNING_IDENTITY` (p. ej. `Developer ID Application: Tu Nombre (EQUIPO)`).
   - Para notarizar: `APPLE_ID`, `APPLE_PASSWORD` (contraseña de app) y `APPLE_TEAM_ID`.
2. **Windows** (certificado de firma de código de una autoridad reconocida):
   - Configura `bundle.windows.certificateThumbprint` en `tauri.conf.json` o una firma en la nube; ver la [guía de Tauri](https://tauri.app/distribute/sign/windows/).

Guía completa: [firmar con Tauri](https://tauri.app/distribute/sign/).

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

Incluye la fuente [Inter](https://rsms.me/inter/) (SIL Open Font License 1.1) y los iconos de [Lucide](https://lucide.dev) (ISC).

### Contribuciones

Salvo que indiques lo contrario, cualquier contribución que envíes para incluirla en Botion se publicará bajo esta misma doble licencia (MIT o Apache 2.0), sin términos adicionales.

Botion es un proyecto independiente y no está afiliado a Notion Labs, Inc. ni a Obsidian.
