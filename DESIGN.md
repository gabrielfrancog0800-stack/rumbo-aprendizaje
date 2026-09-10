---
name: Rumbo
description: Centro de control cálido y práctico para convertir aprendizajes en avances diarios.
colors:
  action-orange: "#ff4f05"
  action-orange-hover: "#e84500"
  action-orange-soft: "#ffe4d6"
  focus-indigo: "#4c3fd9"
  focus-indigo-soft: "#edebfc"
  progress-green: "#08783e"
  progress-green-soft: "#e4f9ee"
  information-blue: "#245cae"
  information-blue-soft: "#eaf1fe"
  attention-pink: "#d92d64"
  warm-ink: "#222222"
  muted-ink: "#667085"
  warm-canvas: "#fffefb"
  surface-white: "#ffffff"
  quiet-line: "#ecece8"
typography:
  display:
    fontFamily: "Plus Jakarta Sans, sans-serif"
    fontSize: "clamp(30px, 3.3vw, 48px)"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Plus Jakarta Sans, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Inter, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  field: "13px"
  inner: "14px"
  panel: "20px"
  dialog: "24px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.action-orange}"
    textColor: "{colors.warm-ink}"
    rounded: "{rounded.pill}"
    padding: "11px 18px"
  button-primary-hover:
    backgroundColor: "{colors.action-orange-hover}"
    textColor: "{colors.warm-ink}"
    rounded: "{rounded.pill}"
    padding: "11px 18px"
  card:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.warm-ink}"
    rounded: "{rounded.panel}"
    padding: "23px"
  input:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.warm-ink}"
    rounded: "{rounded.field}"
    padding: "11px 13px"
---

# Design System: Rumbo

## Overview

**Creative North Star: "El escritorio de avance"**

Rumbo se siente como un espacio de trabajo cálido, ordenado y optimista. La base crema reduce el ruido visual; el naranja concentra las acciones que hacen avanzar y el índigo identifica orientación, cuenta e información destacada.

La interfaz mantiene una densidad práctica: la siguiente acción aparece primero, los datos se agrupan en superficies blancas y las formas redondeadas hacen que registrar progreso se sienta ligero.

**Key Characteristics:**

- Base clara y cálida con contraste fuerte.
- Naranja reservado para acciones y énfasis de avance.
- Navegación estable en escritorio y compacta en teléfono.
- Información visible en segundos, con edición rápida.

## Colors

La paleta combina un lienzo crema con acentos vivos y estados semánticos suaves.

### Primary

- **Naranja de avance:** concentra botones principales, énfasis y el día activo.

### Secondary

- **Índigo de orientación:** identifica marca, cuenta, foco y paneles informativos.

### Tertiary

- **Verde de progreso:** confirma tareas completadas y sincronización correcta.
- **Azul informativo:** comunica estados neutrales y avances registrados.
- **Rosa de atención:** señala errores, retrasos y contenido privado.

### Neutral

- **Lienzo cálido:** fondo general de la aplicación.
- **Superficie blanca:** tarjetas, formularios y controles.
- **Tinta cálida:** títulos y contenido principal.
- **Tinta silenciosa:** texto secundario y metadatos.
- **Línea tranquila:** divisores y bordes discretos.

**The One Action Rule.** El naranja identifica la acción principal de cada vista y no compite con acciones secundarias.

## Typography

**Display Font:** Plus Jakarta Sans (con respaldo sans-serif)  
**Body Font:** Inter (con respaldo sans-serif)

**Character:** Plus Jakarta Sans aporta una voz segura y amable a títulos y cifras. Inter mantiene formularios, listas y notas compactos y legibles.

### Hierarchy

- **Display:** peso 700, tamaño fluido y altura de línea compacta para el título principal.
- **Headline:** peso 700 y escala media para secciones y diálogos.
- **Title:** peso 600–700 para nombres de aprendizajes y acciones.
- **Body:** peso 400, 16px y medida máxima cercana a 70 caracteres.
- **Label:** peso 600–700 para estados, metadatos y botones breves.

**The Clear Step Rule.** Cada pantalla usa una sola frase dominante y deja que las tareas y controles lleven el resto de la información.

## Layout

En escritorio, una barra lateral fija de 272px deja el área principal libre para tareas, indicadores y tarjetas. Las cuadrículas usan espacios de 12–16px y los grupos principales se separan por 28–38px. A 1120px la navegación se compacta; a 780px pasa a una franja superior y las cuadrículas reducen columnas; a 560px el contenido se apila en una sola columna. El planificador semanal conserva desplazamiento horizontal dentro de su propio panel.

## Elevation & Depth

El sistema usa una profundidad ambiental: las superficies se separan con sombras suaves y poco contraste. Los diálogos y mensajes temporales reciben una elevación mayor para mantener el foco.

### Shadow Vocabulary

- **Reposo:** sombra corta y difusa para tarjetas, navegación activa y perfiles.
- **Flotante:** sombra amplia para diálogos y avisos temporales.
- **Acción:** halo cálido discreto bajo botones naranjas.

**The Quiet Depth Rule.** La sombra organiza capas; nunca sustituye el contenido ni crea bordes duros.

## Shapes

Las superficies principales usan esquinas de 20px, los diálogos 24px y los campos 13px. Botones, filtros y estados usan forma de píldora. Los iconos son SVG lineales con trazo consistente; el símbolo de marca usa una forma índigo ligeramente inclinada.

## Components

### Buttons

- **Shape:** píldora completa para acciones principales y secundarias.
- **Primary:** naranja con texto blanco y espacio interno compacto.
- **Hover / Focus:** naranja más profundo al pasar el cursor y anillo índigo visible con teclado.
- **Secondary:** superficie blanca con borde tenue; enlaces de texto usan índigo y subrayado separado.

### Chips

- **Style:** fondos semánticos suaves con texto de la misma familia cromática.
- **State:** la selección se reconoce por color, peso y contexto textual.

### Cards / Containers

- **Corner Style:** curvas amplias de 20px.
- **Background:** blanco sobre lienzo crema.
- **Shadow Strategy:** profundidad ambiental baja y elevación adicional solo al interactuar.
- **Border:** divisores claros en listas; las tarjetas principales prescinden de borde.
- **Internal Padding:** 22–28px según densidad.

### Inputs / Fields

- **Style:** fondo blanco, borde gris cálido y radio medio.
- **Focus:** borde índigo y anillo translúcido.
- **Error / Disabled:** mensajes explican cómo recuperarse; los controles deshabilitados reducen opacidad y cambian el cursor.

### Navigation

La sección activa aparece sobre una píldora clara con peso alto. En teléfono, los iconos conservan el acceso a las cuatro áreas y la etiqueta se muestra en la sección activa.

### Progress

Las barras horizontales expresan progreso verificable. El color coincide con el aprendizaje y el porcentaje siempre aparece como texto cercano.

## Do's and Don'ts

### Do:

- **Do** mostrar la siguiente acción antes que información secundaria.
- **Do** usar naranja para la acción principal e índigo para orientación.
- **Do** mantener campos de al menos 16px en teléfono y foco visible con teclado.
- **Do** calcular y acompañar el progreso con cifras legibles.

### Don't:

- **Don't** usar degradados, texto decorativo o sombras duras.
- **Don't** convertir todas las acciones en botones naranjas.
- **Don't** sustituir los iconos SVG por emojis o caracteres Unicode.
- **Don't** mostrar notas privadas en superficies familiares o compartidas.
