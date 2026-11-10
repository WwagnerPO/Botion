# Pendiente

Tareas e ideas para próximas versiones. Para el día a día del desarrollo, ver [DESARROLLO.md](DESARROLLO.md).

## Índice

- [Probar](#probar)
- [Próximas versiones](#próximas-versiones)
- [Trabajo en equipo](#trabajo-en-equipo)
- [Opcional](#opcional)

## Probar

- [ ] Probar en Windows (v0.2.0 → v0.2.1):
  - [x] «Acerca de»: versión, copiar información para soporte, buscar actualizaciones.
  - [x] Tabla, avisos, columnas, diagrama.
  - [x] PDF, YouTube.
  - [x] Notas cifradas.
  - [x] Exportar a PDF.
  - [x] Recortador web.
  - [x] Actualización automática de v0.2.0 a v0.2.1.
  - [ ] Recordatorio con aviso del sistema a su hora.
  - [ ] Exportar a HTML (con «Exportar», no guardando la página).
  - [ ] Git con remoto: sincronizar entre dos equipos.
  - [ ] Importar desde Notion.
- [ ] Probar en un Mac de verdad:
  - [ ] Vídeo, audio y YouTube.
  - [ ] Recordatorios (notificaciones del sistema).
  - [ ] PDF con subrayados.
  - [ ] Recortador web.
  - [ ] Notas cifradas.
  - [ ] Atajos de Vim.
  - [ ] Sincronizar con WebDAV.
  - [ ] Importar desde Notion.
  - [ ] Actualización automática (de una versión a la siguiente).
  - [ ] Ventana «Acerca de»: versión y «Copiar información para soporte».

## Próximas versiones

- [ ] App para el móvil que abra la misma bóveda.

## Trabajo en equipo

Varias personas sobre la misma bóveda. Por orden de esfuerzo:

1. **Bóveda compartida** (bajo). Ya funciona con Git o WebDAV y el panel de conflictos. Falta:
   - [ ] Nombre de usuario en ajustes.
   - [ ] Autor en comentarios e historial.
2. **Edición en tiempo real** (medio). Yjs + `@milkdown/plugin-collab`, cursores de los demás. Necesita un servidor pequeño de retransmisión (propio en un VPS, o integrado en Botion para la red local). El `.md` sigue siendo la fuente.
3. **Equipo con permisos** (alto). Servidor central con cuentas y permisos por carpeta. Cambia la idea de la app (deja de ser solo local) y complica las notas cifradas.

Recomendado: 1, luego 2 con servidor opcional. El 3 solo si Botion pasa a ser un servicio.

## Opcional

- [ ] Firmar los instaladores (certificados de pago; ver [DESARROLLO.md](DESARROLLO.md#firmar-los-instaladores-opcional)).
