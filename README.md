# Botion

App de escritorio local para tomar notas, inspirada en [Notion](https://www.notion.so) y [Obsidian](https://obsidian.md). Tus notas son ficheros `.md` normales en una carpeta de tu ordenador, con funciones tipo Notion: editor visual, enlaces entre notas y bases de datos con varias vistas.

- **Local:** sin cuenta, sin servidor y sin internet. Para Windows, macOS y Linux.
- **Tus datos son tuyos:** notas Markdown normales, compatibles con Obsidian.
- **Descargar:** última versión en [Releases](https://github.com/WwagnerPO/Botion/releases/latest).

[![Invítame a un café](https://img.shields.io/badge/Inv%C3%ADtame%20a%20un%20caf%C3%A9-%E2%98%95-FFDD00?style=flat&logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/wwagnerpo)

![Una nota con portada, icono, avisos y tareas con fecha](docs/capturas/nota.png)

## Índice

- [Capturas](#capturas)
- [Qué hace](#qué-hace)
- [Uso](#uso)
  - [macOS: «Botion está dañado y no se puede abrir»](#macos-botion-está-dañado-y-no-se-puede-abrir)
  - [Guía completa](#guía-completa)
- [Desarrollo](#desarrollo)
- [Apoyar el proyecto](#apoyar-el-proyecto)
- [Licencia](#licencia)
  - [Contribuciones](#contribuciones)

## Capturas

| | |
|---|---|
| ![Base de datos en tabla con colores por prioridad y total de horas](docs/capturas/tabla.png) | ![Vista kanban agrupada por estado](docs/capturas/kanban.png) |
| **Tabla** con formato condicional y totales | **Kanban**: arrastra para cambiar el estado |
| ![Gráfico de barras con las horas por responsable](docs/capturas/grafico.png) | ![Panel de tareas con vencidas, hoy y próximas](docs/capturas/tareas.png) |
| **Gráfico** a partir de la base de datos | **Tareas** con fecha de toda la bóveda |
| ![Tema oscuro con el índice lateral](docs/capturas/oscuro.png) | ![Grafo de enlaces entre notas](docs/capturas/grafo.png) |
| **Tema oscuro** e índice lateral | **Grafo** de enlaces |

## Qué hace

- Editor visual con comandos `/`, enlaces `[[nota]]`, menciones `@`, backlinks, pestañas, vista dividida y grafo.
- Bases de datos: cada carpeta es una tabla y cada nota una fila. Vistas de tabla, kanban, calendario, galería, lista, cronograma y gráfico, con filtros, fórmulas, relaciones y colores.
- Tareas con fecha, recordatorios y repeticiones; nota diaria; fechas en lenguaje natural.
- PDF con subrayados, bloques sincronizados, comentarios, colores, columnas y notas al pie.
- Notas cifradas, recortador web, atajos de Vim, importar desde Notion.
- Sincronización con Git, WebDAV o una carpeta en la nube, con historial y conflictos resueltos en la app.
- Se actualiza sola. Versión y enlaces en «Acerca de» (icono ⓘ al pie de la barra lateral).

## Uso

### macOS: «Botion está dañado y no se puede abrir»

Pasa con las apps descargadas que no tienen certificado de Apple. No está dañada: macOS la bloquea por venir de internet.

1. Mueve `Botion.app` a **Aplicaciones**.
2. Abre **Terminal** y ejecuta: `xattr -cr /Applications/Botion.app`
3. Ábrela normalmente.

La app va firmada «ad hoc» (sin certificado): si aun así avisa, clic derecho en Botion → **Abrir** → **Abrir**.

### Guía completa

Comandos `/`, atajos, bases de datos, plantillas, sincronización y todo lo demás: ver la [Guía de uso](GUIA.md).

## Desarrollo

Compilar, probar, publicar versiones, actualizaciones automáticas y firma de instaladores: ver [DESARROLLO.md](DESARROLLO.md).

Tareas e ideas para próximas versiones: ver [PENDIENTE.md](PENDIENTE.md).

## Apoyar el proyecto

Botion es gratis y lo hago en mi tiempo libre. Si te resulta útil, puedes [invitarme a un café ☕](https://buymeacoffee.com/wwagnerpo). También ayuda dar una ⭐ al repositorio o [avisar de fallos e ideas](https://github.com/WwagnerPO/Botion/issues).

## Licencia

Botion tiene doble licencia; puedes elegir la que prefieras:

- [MIT](LICENSE-MIT)
- [Apache 2.0](LICENSE-APACHE)

Incluye la fuente [Inter](https://rsms.me/inter/) (SIL Open Font License 1.1) y los iconos de [Lucide](https://lucide.dev) (ISC).

### Contribuciones

Salvo que indiques lo contrario, cualquier contribución que envíes para incluirla en Botion se publicará bajo esta misma doble licencia (MIT o Apache 2.0), sin términos adicionales.

Botion es un proyecto independiente y no está afiliado a Notion Labs, Inc. ni a Obsidian.
