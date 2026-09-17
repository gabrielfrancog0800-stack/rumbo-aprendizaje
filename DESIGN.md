# Rumbo · Guía de diseño

Rumbo sigue principios inspirados en las Human Interface Guidelines de Apple: claridad, jerarquía, familiaridad y divulgación progresiva. No replica activos ni interfaces propietarias.

## Estructura

- Colaborador: **Hoy**, **Aprendizajes** y **Cuenta**.
- Administrador: **Equipo** y **Cuenta**.
- En teléfono, la navegación permanece abajo con icono y etiqueta.
- La primera pantalla muestra la siguiente acción antes que métricas o contenido secundario.

## Apariencia

- Fuente nativa del sistema: `system-ui` y `-apple-system`.
- Fondo gris suave `#f5f5f7`, superficies blancas y texto `#1d1d1f`.
- Azul `#007aff` como único acento de interacción.
- Verde y rojo se reservan para éxito y error.
- Radios de 10–22 px y sombras discretas solo para separar superficies.

## Jerarquía

- Un título grande por pantalla.
- Una sola acción principal visible.
- Texto secundario breve y gris.
- Métricas solo cuando ayudan a tomar una decisión.
- Contenido detallado aparece al abrir un aprendizaje, no antes.

## Componentes

- Botones primarios azules; acciones secundarias neutrales.
- Aprendizajes en filas compactas con nombre, siguiente paso y progreso.
- Tareas con completar, registrar y mover a mañana.
- Formularios nativos y diálogos para Cuenta, Aprendizaje y Avance.
- Estados vacíos explican una sola acción siguiente.

## Reglas

- No repetir contenido entre Hoy y Aprendizajes.
- No mostrar la sincronización salvo mientras guarda o cuando falla.
- No usar avisos persistentes para información de una sola lectura.
- No añadir una función hasta que el uso real demuestre que hace falta.
- Las notas privadas nunca aparecen en el panel administrativo.
