# Rumbo · Centro de aprendizaje

Tercera fase funcional: inicio Hoy, panel de cursos/habilidades/proyectos, planificador semanal, avances parciales con tiempo y notas, revisión semanal, cuentas, sincronización en la nube y acceso familiar de solo lectura. Interfaz en español adaptable a móviles con el sistema visual Warehouse SaaS UI.

## Ejecutar

Se necesita Node.js. No requiere instalar dependencias.

```sh
npm run dev
```

Abrir http://localhost:5173. Comprobar con `npm test` y `npm run check`.

## Datos y privacidad

La primera apertura muestra ejemplos identificados como demo. Sin una cuenta, los datos se guardan en este navegador. Con Supabase configurado, la cuenta del propietario sincroniza un estado privado y una copia compartida separada. La copia compartida elimina las notas de sesiones y los obstáculos de la revisión antes de enviarlos; además, las políticas de la base de datos impiden que un familiar lea o modifique el estado privado. Los códigos de invitación viven en una tabla exclusiva del propietario y no se entregan a familiares.

Aplicar `supabase/schema.sql` en un proyecto Supabase y completar `public/config.js` con la URL y la clave pública anon. La clave anon es pública por diseño; nunca incluir la clave service role.

## GitHub y Vercel

Repositorio privado: https://github.com/gabrielfrancog0800-stack/rumbo-aprendizaje, rama main. Para desplegar en Vercel, importar el repositorio, elegir el preset Other, sin instalación ni compilación, y directorio de salida public (incluido en vercel.json).

Validación: pruebas automatizadas del progreso, serialización, privacidad y estructura de datos; comprobación sintáctica; vista previa HTTP; y revisión visual e interactiva en escritorio y teléfono. La autenticación y las políticas por rol se validarán de extremo a extremo al conectar el proyecto de Supabase.

## Próximas fases

4. Ajustes basados en uso real y mejoras opcionales de la vista familiar.

El repositorio contiene solamente el código, nunca los aprendizajes personales guardados en el navegador.
