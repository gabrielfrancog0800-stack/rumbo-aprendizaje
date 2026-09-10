# Rumbo · Centro de aprendizaje

Primera fase funcional: inicio Hoy, panel de cursos/habilidades/proyectos, creación de aprendizajes, pasos, progreso calculado, fechas, duración estimada y reprogramación a mañana. Interfaz en español adaptable a móviles.

## Ejecutar

Se necesita Node.js. No requiere instalar dependencias.

```sh
npm run dev
```

Abrir http://localhost:5173. Comprobar con `npm test` y `npm run check`.

## Datos de esta fase

La primera apertura muestra ejemplos identificados como demo. «Empezar con mis datos» permite quitarlos con confirmación. Los datos se guardan en localStorage de este navegador y origen; no están sincronizados ni respaldados en la nube. No usar aún como único archivo de información importante. No hay cuentas, acceso familiar ni publicación realizada.

## GitHub y Vercel

Repositorio privado: https://github.com/gabrielfrancog0800-stack/rumbo-aprendizaje, rama main. Para desplegar en Vercel, importar el repositorio, elegir el preset Other, sin instalación ni compilación, y directorio de salida public (incluido en vercel.json). La app actual es estática y no necesita secretos.

Validación: pruebas automatizadas del progreso, serialización y estructura de datos, y respuesta HTTP de la vista previa. Todavía no se han realizado pruebas visuales o de interacción en navegador. La consulta WebMCP es opcional y no se ha validado en un navegador compatible.

## Próximas fases

2. Planificador semanal, registro parcial y revisión de viernes.
3. Autenticación, base de datos compartida, permisos de solo lectura y privacidad de notas. La persistencia local debe migrarse antes de habilitar acceso familiar.
4. Validación de los flujos reales en navegador y móvil, y despliegue en Vercel desde GitHub.

El guardado es local por diseño para esta fase. El repositorio contiene solamente el código, nunca los aprendizajes personales guardados en el navegador.
