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
- Vistas de tabla, kanban, calendario, galería, lista, cronograma y gráfico, con filtros, fórmulas, relaciones y colores.
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
| Botion | Página (crea una nota y la enlaza), Mención, Nota de hoy, Imagen, Vídeo, Audio, Archivo (los PDF se ven en la nota), YouTube, Emoji, Icono de la página, Portada, Incrustar nota, Bloque sincronizado, Vista de base de datos, Botón, Enlace a nota, Propiedad, Base de datos, Plantilla, Aviso (nota, consejo, aviso, peligro), Desplegable, Índice, Resaltar, Color, Comentario, Nota al pie, 2 columnas, 3 columnas, Diagrama, Exportar a PDF, Exportar a HTML, Fecha de hoy, Hora actual, Fecha de vencimiento, Recordatorio, Repetir tarea, Ancho completo, Texto pequeño, Fuente (normal, serif, monoespaciada), Índice lateral, Modo sin distracciones |

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
| YouTube | `![YouTube](https://youtu.be/…)` (miniatura; se abre en el navegador) |
| Icono y portada | `icono: 🚀` y `portada: violeta` en el frontmatter |
| Estilo de la página | `fuente: serif`, `ancho_completo: true`, `texto_pequeño: true` en el frontmatter |
| Color de texto o fondo | `<span style="color: #d44c47">texto</span>` (también `background-color`) |
| Comentario | `%%texto del comentario%%` (Obsidian no lo enseña al leer) |
| Nota al pie | `texto[^1]` y `[^1]: nota` al final |
| Columnas | `> [!multi-column]` con `> > [!blank]` dentro (como el fragmento «Modular CSS Layout») |
| Tarea con fecha | `- [ ] Pagar 📅 2026-10-31 ⏰ 2026-10-30 09:00 🔁 cada mes` (como el plugin Tasks) |
| Bloque sincronizado | `![[Nota#^abc123]]`; el bloque original acaba en ` ^abc123` |
| Botón | bloque de código `boton` con `texto:`, `base:`, `plantilla:`, `abrir:` y propiedades |

### Atajos

| Atajo | Acción |
|-------|--------|
| `Ctrl+K` | Buscar notas |
| `Ctrl+P` | Paleta de comandos |
| `Ctrl+F` | Buscar en la nota (`Enter` / `Mayús+Enter` para moverse) |
| `Ctrl+N` | Nueva nota |
| `Ctrl+Mayús+H` | Resaltar |
| `Ctrl+.` | Modo sin distracciones |
| `@` | Mencionar una nota o una fecha |
| `Ctrl+clic` | Abrir en pestaña nueva |
| `Alt+clic` | Abrir a la derecha (dos notas lado a lado) |
| `Ctrl+W` | Cerrar pestaña |
| `Ctrl+Tab` / `Ctrl+Mayús+Tab` | Pestaña siguiente / anterior |

En macOS, `Cmd` en lugar de `Ctrl`.

### Navegación

- **Pestañas:** `Ctrl+clic` en una nota (o clic derecho → «Abrir en pestaña nueva»). El clic normal cambia la pestaña activa.
- **Dos notas lado a lado:** `Alt+clic` o clic derecho → «Abrir a la derecha». Cada una se guarda sola.
- **Favoritas y recientes:** la estrella de arriba a la derecha de la nota la añade a «Favoritas»; las últimas abiertas salen en «Recientes».
- **Grafo:** en la barra lateral. Cada nota es un punto y cada enlace una línea; «Solo alrededor de la nota abierta» muestra su entorno.
- **Historial:** el reloj de arriba a la derecha. Muestra las versiones guardadas con Git (al sincronizar o con «Guardar versión ahora») y permite restaurar una.
- **Convertir en…:** pulsa el asa ⋮⋮ a la izquierda de un bloque para convertirlo (texto, títulos, listas, cita, código), duplicarlo o eliminarlo. Arrástrala para moverlo.

### Escribir

- **Estilo de la página:** el botón «…» de arriba a la derecha cambia la fuente (normal, serif, mono), el texto pequeño y el ancho completo. Ahí también están el recuento de palabras y el tiempo de lectura.
- **Índice lateral:** en «…» o `/Índice lateral`. Muestra los títulos de la nota y marca por dónde vas.
- **Modo sin distracciones:** `Ctrl+.` oculta la barra lateral, las pestañas y los enlaces; la barra de arriba aparece al pasar el ratón.
- **Nota de hoy:** en la barra lateral o la paleta de comandos. Crea `Diario/2026-10-30.md` con la plantilla «Diario» si existe (`Plantillas/Diario.md`). `/Nota de hoy` la enlaza.
- **Colores:** selecciona texto y pulsa el botón de color de la barra (o `/Color` para todo el párrafo).
- **Comentarios:** botón «Comentar» de la barra o `/Comentario`. Se ven como 💬 en el texto y, si hay sitio, en el margen derecho.
- **Bloques sincronizados:** asa ⋮⋮ → «Copiar como bloque sincronizado» y pega en otra nota, o `/Bloque sincronizado` para elegir nota y bloque. Al editarlo en cualquier sitio cambia en la nota original.
- **PDF:** `/Archivo` con un PDF lo muestra en la nota. Selecciona texto y pulsa «Subrayar»; los subrayados se guardan en «nombre (subrayados).md», junto al PDF, y cada uno se puede incrustar en otra nota.
- **Fechas en lenguaje natural:** en `@`, `/Fecha de vencimiento` y `/Recordatorio` vale escribir «mañana», «el viernes», «dentro de 3 días», «15 de noviembre a las 18:30»…

### Tareas y recordatorios

- `/Fecha de vencimiento`, `/Recordatorio` y `/Repetir tarea` añaden la marca al final de una tarea (`- [ ]`).
- «Tareas» en la barra lateral junta las tareas con fecha de toda la bóveda: vencidas, hoy, próximos 7 días y más adelante. Se pueden marcar desde ahí.
- Los recordatorios avisan con una notificación del sistema mientras Botion está abierto (sin hora, a las 9:00).
- Al marcar una tarea con 🔁 se apunta cuándo se hizo (`✅ fecha`) y se crea encima la siguiente, con las fechas movidas. Reglas: «cada día», «cada día laborable», «cada semana», «cada 2 semanas», «cada mes», «cada año», «cada lunes y jueves»…

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

Cualquier carpeta puede ser una base de datos (clic derecho → «Convertir en base de datos», o `/Base de datos` desde una nota):

- Cada nota de la carpeta es una fila; sus propiedades (frontmatter) son las columnas.
- Los datos están en las notas. La carpeta solo guarda la configuración en un fichero oculto `.botion-db.json`.
- Pulsa el nombre de una fila para abrirla en un **panel lateral** (propiedades editables y texto de la nota) o «Abrir» para ir a la página.

#### Vistas

Cada base de datos puede tener varias vistas guardadas (pestañas encima de la tabla), cada una con sus filtros, orden, grupos y columnas visibles. Pulsa la pestaña activa para renombrarla, cambiar su tipo, duplicarla o eliminarla.

| Vista | Qué muestra |
|-------|-------------|
| Tabla | Edición directa de cada celda, grupos plegables y totales al pie |
| Kanban | Una columna por valor de una propiedad; arrastra para cambiarlo |
| Calendario | Las notas en el día de una fecha; arrastra para moverlas |
| Galería | Tarjetas con la portada o el icono de cada nota |
| Lista | Una línea por nota con sus propiedades a la derecha |
| Cronograma | Barras entre una fecha de inicio y otra de fin; arrastra la barra o su borde |
| Gráfico | Barras, líneas o tarta: filas agrupadas por una propiedad (las fechas, por mes), contadas o con la suma, media, mínimo o máximo de otra |

En la barra de la vista:

- **Filtro:** condiciones por propiedad («estado es Hecho», «precio > 10», «fecha en la próxima semana»…). Se cumplen todas a la vez.
- **Ordenar** y **Agrupar** por cualquier propiedad.
- **Colores:** formato condicional; colorea las filas que cumplen una condición («estado es Hecho» → verde).
- **Repetir:** tareas que se repiten. Al marcar una fila como hecha, su fecha avanza según la regla de otra columna («cada semana») y vuelve a quedar pendiente.
- **Propiedades:** mostrar u ocultar columnas en esta vista, e «Incluir subcarpetas».
- En la tabla, arrastra el borde de una cabecera para cambiar el ancho y la cabecera entera para reordenar. Pulsa el pie de una columna para elegir un total (contar, suma, media, mediana, mínimo, máximo, % marcadas…).

#### Tipos de propiedad

Texto, Número, Casilla, Fecha, Selección, Etiquetas, URL, Email, Teléfono, Archivos (adjuntos en `adjuntos/`), Relación, Rollup, Fórmula, Fecha de creación y Última edición. Pulsa la cabecera de una columna para cambiar su nombre o su tipo.

- **Relación:** enlaza filas de otra base de datos. Se guarda como en Obsidian: `proyectos: ["[[Web]]", "[[App]]"]`.
- **Rollup:** resume una propiedad de las filas relacionadas (contar, suma, media, mínimo, máximo, fechas…).
- **Fórmula:** se calcula para cada fila y no se guarda en las notas. Ejemplos:

  ```text
  prop("precio") * prop("cantidad")
  if(prop("hecha"), "✅", "⏳")
  dateBetween(prop("fin"), today(), "days")
  concat(upper(prop("estado")), " · ", formatDate(prop("fecha")))
  ```

  Funciones: `if`, `and`, `or`, `not`, `empty`, `length`, `concat`, `join`, `contains`, `lower`, `upper`, `trim`, `replace`, `replaceAll`, `substring`, `format`, `toNumber`, `round`, `floor`, `ceil`, `abs`, `sqrt`, `pow`, `min`, `max`, `sum`, `average`, `now`, `today`, `dateAdd`, `dateSubtract`, `dateBetween`, `formatDate`, `year`, `month`, `day`, `weekday`. Operadores: `+ - * / %`, `== != < <= > >=`, `and`/`&&`, `or`/`||`, `not`/`!`.

#### Plantillas y botones

- La flecha de «Nueva» abre las plantillas de la base de datos: «Nueva plantilla» crea una nota (en la carpeta oculta `.plantillas`) con el texto y las propiedades de partida; el lápiz la edita.
- `/Botón` en cualquier nota añade un botón que crea una fila en una base de datos, con propiedades ya puestas o desde una plantilla:

  ```boton
  texto: Nueva tarea
  base: Tareas
  plantilla: Tarea
  abrir: sí
  estado: Pendiente
  ```

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
- [ ] Probar en la app real las notificaciones de los recordatorios y el visor de PDF.

**Bases de datos**

- [x] Vistas de galería, lista y cronograma.
- [x] Varias vistas guardadas por base de datos, cada una con sus filtros.
- [x] Filtros por propiedad («estado es Hecho») y agrupar en la tabla.
- [x] Fórmulas, relaciones entre bases de datos y rollups.
- [x] Más tipos de propiedad: URL, email, teléfono, archivos, fecha de creación y de edición.
- [x] Abrir una fila en un panel lateral sin salir de la tabla.
- [x] Columnas: cambiar ancho, reordenar y ocultar.
- [x] Totales al pie (contar, sumar, media).

**Editor y navegación**

- [x] Menciones con `@` (nota o fecha).
- [x] Pestañas o dos notas lado a lado.
- [x] Grafo de enlaces entre notas.
- [x] Historial de una nota con Git: ver y restaurar versiones.
- [x] Notas favoritas y recientes en la barra lateral.
- [x] Arrastrar bloques para reordenarlos y «Convertir en…».

**Ideas (lo que más se pide a Notion y aún no tiene)**

- [x] Modo sin distracciones: ancho completo, tipografía (serif/mono) y texto pequeño por nota.
- [x] Índice lateral de la nota (esquema de títulos siempre visible) y contador de palabras.
- [x] Notas diarias con un clic (`Diario/2026-10-19.md`) y plantilla propia.
- [x] Tareas con fecha de vencimiento y recordatorios (notificaciones del sistema).
- [x] Tareas recurrentes (cada semana, cada mes…) en las bases de datos.
- [x] Fechas en lenguaje natural («el viernes», «dentro de 3 días»).
- [x] Colores de texto y de fondo, y columnas dentro de una nota.
- [x] Notas al pie y comentarios en el margen.
- [x] Gráficos a partir de una base de datos (barras, líneas, tarta).
- [x] Formato condicional en tablas (colorear filas según un valor).
- [x] Plantillas por base de datos y botones que crean filas.
- [x] Bloques sincronizados (el mismo bloque en varias notas).
- [x] Ver PDFs dentro de la nota y subrayarlos.
- [ ] Recortador web: guardar una página como nota.
- [ ] Notas cifradas con contraseña.
- [ ] Atajos de Vim opcionales.
- [ ] Sincronización sin Git (carpeta en la nube, WebDAV, Syncthing) con avisos de conflicto.
- [ ] App para el móvil que abra la misma bóveda.

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

### macOS: «Botion está dañado y no se puede abrir»

Pasa con las apps descargadas que no tienen certificado de Apple. No está dañada: macOS la bloquea por venir de internet.

1. Mueve `Botion.app` a **Aplicaciones**.
2. Abre **Terminal** y ejecuta: `xattr -cr /Applications/Botion.app`
3. Ábrela normalmente.

La app va firmada «ad hoc» (sin certificado): si aun así avisa, clic derecho en Botion → **Abrir** → **Abrir**.

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
