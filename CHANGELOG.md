# Novedades

Cambios de cada versión de Botion. Descargas en [Releases](https://github.com/WwagnerPO/Botion/releases).

## Próxima versión

- Los Mac con procesador Intel dejan de tener instalador: solo Apple Silicon (M1 o posterior).

## v0.2.1

### Arreglos
- Los enlaces de «Acerca de», de YouTube y de las propiedades URL vuelven a abrirse en el navegador.
- `/Recordatorio`, `/Fecha de vencimiento` y `/Repetir tarea` en una línea normal la convierten en tarea, para que salga en el panel de tareas.
- Git: si una carpeta de la bóveda tiene su propio repositorio dentro, Botion lo dice claramente en vez de dar un error de Git; y ya no salen avisos de CRLF en Windows.
- Recortador web: se queda con el texto principal de la página (por ejemplo, en GitHub) y deja fuera menús, avisos y elementos ocultos.

> Esta es la primera versión que llega sola: si tienes la v0.2.0, Botion te avisará para instalarla.

## v0.2.0

### Editor
- Comandos `/` nuevos: página, mención, imagen, vídeo, audio, archivo, YouTube, emoji, aviso, desplegable, índice, resaltar, color, comentario, nota al pie, 2 y 3 columnas, diagrama (Mermaid), botón, propiedad, plantilla, fecha y hora.
- Menciones `@`, «Convertir en…» y menú de bloque.
- Colores de texto y fondo, comentarios al margen, notas al pie y columnas.
- Imágenes pegadas o arrastradas se guardan en `adjuntos/`.
- PDF dentro de la nota con subrayados.
- Bloques sincronizados: incrusta una parte de otra nota y edítala desde aquí.
- Botones que crean notas, insertan texto o abren enlaces.
- Página: ancho completo, texto pequeño, fuente (normal, serif, monoespaciada), índice lateral y modo sin distracciones.
- Contador de palabras, buscar en la nota (Ctrl+F) y paleta de comandos (Ctrl+P).
- Atajos de Vim (opcional).

### Navegación
- Pestañas, vista dividida, favoritas y recientes.
- Grafo de enlaces entre notas.
- Arrastrar notas y carpetas en el árbol; los enlaces se actualizan solos.
- Nota diaria.

### Tareas
- Tareas con fecha de vencimiento, recordatorios y repeticiones.
- Fechas en lenguaje natural («mañana», «el viernes»).
- Panel de tareas de toda la bóveda: vencidas, hoy y próximas.

### Bases de datos
- Vistas de tabla, kanban, calendario, galería, lista, cronograma y gráfico, con varias vistas por base de datos.
- Filtros, agrupar, ordenar, totales, fórmulas, relaciones y rollups.
- Tipos nuevos: URL, email, teléfono, archivos, relación, fechas de creación y edición.
- Formato condicional (colores por fila), plantillas y filas que se repiten.
- Las notas de subcarpetas también aparecen en la tabla.

### Sincronizar e importar
- Sincronizar con WebDAV (Nextcloud y otros) sin Git.
- Historial de cada nota y conflictos de Git resueltos dentro de la app.
- Importar desde Notion (.zip o carpeta exportada).
- Recortador web: guarda una página como nota.

### Seguridad
- Notas cifradas con contraseña (AES-GCM). La contraseña no se guarda.

### App
- Lavado de cara completo: fuente Inter, iconos, tema claro y oscuro, portada e icono por nota.
- Exportar a PDF y HTML.
- Se actualiza sola (a partir de esta versión).
- Ventana «Acerca de»: versión, ayuda, avisar de fallos, copiar información para soporte e «Invítame a un café».
- macOS firmado «ad hoc»; YouTube se ve como miniatura.

### Arreglos
- Varias pérdidas de datos al cambiar de panel, de bóveda o al sincronizar.
- Enlaces a `#sección`, renombrar con mayúsculas, adjuntos al mover notas, archivos binarios en Git.

> **Si tienes la v0.1.0:** esa versión no se actualiza sola. Descarga e instala esta a mano; desde aquí las siguientes llegarán solas.

## v0.1.0

Primera versión: editor visual tipo Notion sobre archivos Markdown, enlaces `[[nota]]`, backlinks, búsqueda, bases de datos con tabla, kanban y calendario, sincronización con Git e instaladores para Windows, macOS y Linux.
