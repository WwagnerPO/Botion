# Botion

Espacio de trabajo web inspirado en [Notion](https://www.notion.so): páginas anidadas, editor por bloques y bases de datos con varias vistas.

> Estado: **en desarrollo inicial** (sin código todavía).

## Objetivos

- Editor por bloques con menú `/`, arrastrar y soltar y anidación.
- Árbol de páginas infinito (páginas dentro de páginas).
- Bases de datos con vistas: tabla, tablero (kanban) y calendario.
- Autenticación y páginas compartidas.
- Colaboración en tiempo real (fase final).

## Stack previsto

| Capa | Tecnología |
|------|------------|
| Frontend | Next.js, TypeScript, Tailwind CSS |
| Editor | TipTap o BlockNote |
| Base de datos | PostgreSQL + Prisma (o Supabase) |
| Autenticación | NextAuth o Supabase Auth |
| Tiempo real | Yjs + Hocuspocus o Liveblocks |

## Modelo de datos (borrador)

```
pages   id, parent_id, title, icon, owner_id, created_at, updated_at
blocks  id, page_id, parent_block_id, type, content (JSON), position
users   id, email, name, avatar
```

## Hoja de ruta

1. [ ] Preparar el proyecto (Next.js + TypeScript + Tailwind).
2. [ ] Integrar el editor por bloques.
3. [ ] Definir el modelo de datos y las migraciones.
4. [ ] MVP: barra lateral con el árbol de páginas, crear, editar y borrar páginas, autoguardado.
5. [ ] Autenticación de usuarios.
6. [ ] Bases de datos con vistas, búsqueda, plantillas y compartir páginas.
7. [ ] Colaboración en tiempo real.

## Desarrollo local

Las instrucciones de instalación se añadirán cuando exista el paso 1.

## Licencia

Por definir.
