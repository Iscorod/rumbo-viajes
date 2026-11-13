# Rumbo

App web para organizar varios viajes. Puedes crear viajes, cambiar entre ellos, añadir vuelos y eventos, calcular el tiempo libre y guardar los cambios en este navegador. También exporta un viaje como JSON.

## Copia de viajes en GitHub

La app guarda cada viaje como un archivo independiente en `data/trips/<id>.json` usando la API de GitHub Contents. Cada JSON se cifra en el servidor con AES-256-GCM antes de llegar a GitHub, porque el repositorio configurado es público. Al guardar se crea un commit. La opción **Guardar todos** sincroniza todos los viajes del navegador; **Cargar lista** permite recuperarlos en otro dispositivo.

El token de GitHub solo se usa desde la función de servidor `api/trips.js`. No lo pegues en el navegador ni lo añadas al repositorio.

### Preparar el repositorio

1. Crea un repositorio en GitHub, público o privado. La cuenta del token debe tener acceso de escritura.
2. Crea un token fine-grained limitado a ese repositorio con permiso **Contents: Read and write**.
3. En los ajustes del proyecto de Vercel, añade estas variables para Production y Preview:

   - `GITHUB_TOKEN`: el token fine-grained.
   - `GITHUB_REPO`: `propietario/nombre-del-repositorio`.
   - `GITHUB_SYNC_KEY`: una clave aleatoria larga (recomendado: 32 caracteres o más) que usarás en la ventana de sincronización. También cifra los JSON.
   - `GITHUB_BRANCH`: nombre de la rama, normalmente `main` (opcional).

4. Vuelve a desplegar el proyecto.
5. En Rumbo, pulsa el icono de sincronización, introduce la `GITHUB_SYNC_KEY` y guarda los viajes. En otro dispositivo, introduce la misma clave y pulsa **Cargar lista**.

La clave adicional protege la función de servidor frente a escrituras de terceros. No es el token de GitHub; puedes generar una aleatoria con un gestor de contraseñas.

Guarda esta clave en un gestor de contraseñas: si se pierde, no se podrán descifrar las copias existentes.

## Ejecución local

La persistencia en este navegador funciona abriendo `index.html`. La sincronización con GitHub necesita el endpoint de servidor. Para probar ambas cosas en local, usa Vercel CLI y coloca las variables en `.env.local` (archivo ignorado por Git). Nunca subas `.env.local`.

## Estructura

- `index.html`, `styles.css`, `app.js`: interfaz de Rumbo.
- `api/trips.js`: API privada de lectura/escritura de archivos JSON en GitHub.
- `data/trips/`: carpeta que GitHub crea al guardar el primer viaje.
