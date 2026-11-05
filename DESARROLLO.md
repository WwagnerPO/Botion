# Desarrollo de Botion

Cómo compilar, probar y publicar la app. Para usarla, ver el [README](README.md). Tareas e ideas: [PENDIENTE.md](PENDIENTE.md).

## Índice

- [Requisitos](#requisitos)
- [Arrancar](#arrancar)
- [Publicar una versión](#publicar-una-versión)
- [Actualizaciones automáticas](#actualizaciones-automáticas)
- [Firmar los instaladores (opcional)](#firmar-los-instaladores-opcional)
- [Estructura](#estructura)

## Requisitos

1. [Node.js](https://nodejs.org) 20 o superior.
2. [pnpm](https://pnpm.io/installation).
3. [Rust](https://www.rust-lang.org/tools/install) (estable).
4. Dependencias de sistema de Tauri para tu sistema operativo: [guía oficial](https://tauri.app/start/prerequisites/).
   - Windows: Microsoft C++ Build Tools y WebView2 (ya viene en Windows 10/11).
   - macOS: `xcode-select --install`.
   - Linux (Debian/Ubuntu): `sudo apt install libwebkit2gtk-4.1-dev build-essential libssl-dev librsvg2-dev libxdo-dev libayatana-appindicator3-dev`.

## Arrancar

1. Instalar dependencias: `pnpm install`
2. Abrir la app en modo desarrollo: `pnpm tauri dev`
3. Pruebas: `pnpm test` (interfaz) y `cargo test` en `src-tauri` (Rust).
4. Generar el instalador: `pnpm tauri build`

Hecha con [Tauri](https://tauri.app) (Rust), React, TypeScript, Tailwind CSS y [Milkdown](https://milkdown.dev). La búsqueda usa un índice SQLite en la caché del sistema (se puede borrar; se rehace solo).

## Publicar una versión

1. Sube el número de versión en `package.json`, `src-tauri/Cargo.toml` y `src-tauri/tauri.conf.json`.
2. Crea y sube una etiqueta (`git tag v0.2.0 && git push origin v0.2.0`) o lanza a mano el workflow «Versión» en **Actions**.
3. GitHub Actions compila los instaladores de Windows, macOS y Linux y los deja en un borrador en **Releases**.
4. Revisa el borrador y pulsa **Publish release**.

## Actualizaciones automáticas

Al abrirse, Botion mira si hay una versión nueva en GitHub y ofrece «Actualizar y reiniciar» (también «Buscar actualizaciones» en la paleta). Las actualizaciones van firmadas: la clave pública está en `tauri.conf.json` y la privada tiene que estar en el secreto `TAURI_SIGNING_PRIVATE_KEY` del repositorio (**Settings → Secrets and variables → Actions**). Con él, el flujo «Versión» firma los instaladores y sube `latest.json`.

Si se pierde la clave privada, las versiones ya instaladas no podrán actualizarse solas: guárdala en un sitio seguro.

## Firmar los instaladores (opcional)

Sin firma, Windows (SmartScreen) y macOS (Gatekeeper) avisan la primera vez que se abre la app. Para quitar el aviso hace falta un certificado de pago; el workflow de versiones ya lo usa si se añaden estos secretos en **Settings → Secrets and variables → Actions**:

1. **macOS** (cuenta de Apple Developer, 99 $/año):
   - `APPLE_CERTIFICATE` (el `.p12` en base64) y `APPLE_CERTIFICATE_PASSWORD`.
   - `APPLE_SIGNING_IDENTITY` (p. ej. `Developer ID Application: Tu Nombre (EQUIPO)`).
   - Para notarizar: `APPLE_ID`, `APPLE_PASSWORD` (contraseña de app) y `APPLE_TEAM_ID`.
2. **Windows** (certificado de firma de código de una autoridad reconocida):
   - Configura `bundle.windows.certificateThumbprint` en `tauri.conf.json` o una firma en la nube; ver la [guía de Tauri](https://tauri.app/distribute/sign/windows/).

Guía completa: [firmar con Tauri](https://tauri.app/distribute/sign/).

## Estructura

```
src/              Interfaz (React + TypeScript + Tailwind)
  components/     Componentes de la interfaz
  lib/            Comunicación con Rust y utilidades
src-tauri/        Parte nativa (Rust + Tauri)
  src/            Código Rust
  tauri.conf.json Configuración de la app
```
