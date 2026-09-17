# Rumbo · Centro de aprendizaje

Centro de aprendizaje con inicio Hoy, cursos/habilidades/proyectos, planificación semanal, avances parciales, revisión, cuentas y sincronización. Incluye un panel de equipo para que un administrador consulte el progreso compartido de sus colaboradores sin acceder a notas privadas.

## Ejecutar

Se necesita Node.js. No requiere instalar dependencias.

```sh
npm run dev
```

Abrir http://localhost:5173. Comprobar con `npm test` y `npm run check`.

## Datos y privacidad

La primera apertura muestra ejemplos identificados como demo. Sin una cuenta, los datos se guardan en este navegador. Cada colaborador sincroniza un estado privado y una copia compartida separada. La copia compartida elimina las notas de sesiones y los obstáculos de la revisión antes de enviarlos. El administrador solo consulta esa copia y no puede modificar los aprendizajes.

Las invitaciones se comparten mediante enlaces privados de un solo uso. Al aceptarlas, la relación con el equipo queda guardada y no se requieren códigos ni nuevos enlaces para volver a consultar el progreso.

Aplicar `supabase/schema.sql` en un proyecto Supabase y completar `public/config.js` con la URL y la clave pública anon. La clave anon es pública por diseño; nunca incluir la clave service role.

## GitHub y Vercel

Repositorio privado: https://github.com/gabrielfrancog0800-stack/rumbo-aprendizaje, rama main. Para desplegar en Vercel, importar el repositorio, elegir el preset Other, sin instalación ni compilación, y directorio de salida public (incluido en vercel.json).

Validación: pruebas automatizadas del progreso, resumen administrativo, serialización, privacidad y estructura de datos; comprobación sintáctica; vista previa HTTP; y revisión visual e interactiva.

## Próximas fases

4. Ajustes basados en el uso real del colaborador y del administrador.

El repositorio contiene solamente el código, nunca los aprendizajes personales guardados en el navegador.
