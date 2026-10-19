# Instrucciones para Claude

## Commits

- No añadir líneas `Claude-Session:` ni `Co-Authored-By:` en los mensajes de commit.
- No añadir enlaces de sesión en descripciones de PR.

## Editor

- Cada función nueva que se pueda insertar o usar desde una nota debe tener
  su comando en el menú «/» del editor (grupo «Botion», en
  `src/lib/slashCommands.ts`), y aparecer en la sección «Comandos /» del README.

## Respuestas

- Usar siempre el estilo de la skill `ahorro-tokens-cavernicola`: frases
  cortas, sin saludos ni cierres, directo al grano y pasos numerados.
- Responder siempre en español.
