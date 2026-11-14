# Rumbo

Rumbo organiza viajes en una aplicación web estática, sin framework ni base de datos externa. La vista principal es un itinerario de tres columnas: selector de días, cronología y resumen del día. En móvil, el selector de viajes y los días se desplazan horizontalmente, la navegación se simplifica y las tarjetas y formularios se adaptan a pantallas pequeñas.

## Funciones

- Crear, cambiar, editar y borrar varios viajes.
- Conservar la información antigua guardada en rumbo-trips-v1 y migrar viajes del formato anterior al leerlos.
- Ver los días del viaje generados entre las fechas de inicio y fin.
- Guardar el número de viajeros, destino, zona horaria del destino y horario útil.
- Añadir varios vuelos, incluidas conexiones, con origen, destino, número de vuelo, matrícula del avión, fecha y hora de cada aeropuerto y zona horaria IANA.
- Indicar la antelación al aeropuerto en horas o minutos y los traslados por vuelo.
- Añadir traslados independientes en bus, coche, tren, taxi, ferry o metro, con origen, destino, horario, compañía, referencia, observaciones y adjuntos.
- Añadir varios hoteles con ubicación, fechas y horas de entrada/salida, duración de los trámites y traslados por sentido.
- Añadir, editar y borrar actividades con horario, ubicación, categoría y descripción.
- Señalar actividades que se solapan.
- Calcular el tiempo libre dentro del horario útil, sin contar automáticamente la madrugada ni duplicar bloques ocupados que se superponen.
- Adjuntar entradas y otros archivos a vuelos, hoteles, traslados y actividades.
- Conservar los datos en el navegador, exportar un viaje a JSON y sincronizar los cambios con GitHub.
- Usar el botón Guardar para sincronizar todos los viajes; cada cambio individual guardado también se sincroniza automáticamente.

Los cambios de las fechas de viaje generan el nuevo selector de días sin borrar los vuelos, hoteles o actividades que queden fuera del rango. Esos datos se conservan y se pueden editar desde sus secciones.

## Almacenamiento y sincronización

El navegador guarda el estado actual con la clave rumbo-trips-v1; también se siguen leyendo los datos de la versión anterior rumbo-trip-v1. El backend de Vercel escribe cada viaje como un JSON cifrado en data/trips/<id>.json. Los adjuntos se cifran por separado en data/attachments/. Cada adjunto admite hasta 1 MB y el máximo por viaje es 1,5 MB.

La sincronización automática se activa después de introducir la clave una vez y guardar los viajes. El botón Guardar de la parte superior sincroniza todos los viajes. Cada cambio guardado en la interfaz también se escribe en GitHub después de una pausa breve. El token de GitHub se queda en el servidor y nunca se envía al navegador.

## Configurar Vercel y GitHub

1. Usa un repositorio GitHub al que el token tenga permiso Contents: Read and write.
2. En las variables de entorno del proyecto de Vercel, configura para Production y Preview:
   - GITHUB_TOKEN: token fine-grained limitado al repositorio.
   - GITHUB_REPO: propietario/nombre-del-repositorio.
   - GITHUB_SYNC_KEY: una clave aleatoria larga. Protege el endpoint y cifra los JSON y adjuntos.
   - GITHUB_BRANCH: la rama de datos, normalmente main.
3. Vuelve a desplegar Rumbo para que la función de Vercel lea las variables.
4. En Rumbo, pulsa Guardar, introduce la misma GITHUB_SYNC_KEY y pulsa Guardar todos una vez. Después puedes usar Guardar en la parte superior; en otros navegadores, introduce la clave y carga la lista.

No pegues GITHUB_TOKEN en la aplicación, en el navegador ni en GitHub. Guarda GITHUB_SYNC_KEY en un gestor de contraseñas: sin ella no se podrán descifrar las copias existentes.

## Ejecutar en local

La interfaz puede abrirse con un servidor estático. Para probar también el endpoint de GitHub, instala y autentica Vercel CLI, coloca las variables en .env.local y ejecuta vercel dev desde la carpeta del proyecto. .env.local está excluido de Git. Nunca subas secretos al repositorio.

Este proyecto no tiene un paso de compilación: Vercel publica index.html, styles.css y app.js, y ejecuta api/trips.js como función Node. No necesita rewrites porque toda la interfaz vive en la ruta raíz.

## Verificaciones

No hay una suite de pruebas ni dependencias de construcción en el proyecto. Comprueba la sintaxis con node --check app.js y node --check api/trips.js.

## Archivos principales

- index.html: estructura accesible y pestañas de la aplicación.
- styles.css: diseño responsive de escritorio y móvil.
- app.js: gestión de viajes, migración de datos, cálculos horarios, tiempo libre y sincronización.
- api/trips.js: función de servidor para cifrar JSON y adjuntos y guardarlos en GitHub.
- .env.example: nombres de variables esperadas; no contiene secretos.
