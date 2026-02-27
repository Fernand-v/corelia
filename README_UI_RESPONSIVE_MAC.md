# Corelia - Guía UI Responsive (Estilo Mac)

Este documento define cómo debe verse y comportarse la interfaz de Corelia en escritorio y móvil, con una dirección visual inspirada en macOS.

---

## Objetivo

Diseñar una intranet moderna, clara y consistente, con:

- Experiencia **responsive real** (móvil, tablet, desktop).
- Estética **mac-like** (limpia, sobria, con profundidad sutil).
- Interacciones fluidas sin sacrificar rendimiento ni accesibilidad.

---

## Principios Visuales (Mac-like)

- Superficies claras, jerarquía limpia y poco ruido visual.
- Bordes redondeados suaves (`10px` a `16px`).
- Sombras sutiles, sin contraste agresivo.
- Uso moderado de efecto vidrio (`backdrop-blur`) solo en barras, modales y paneles flotantes.
- Tipografía legible y neutral.
- Espaciado amplio para sensación de orden.

---

## Sistema de Diseño Base

### Tipografía

- Primaria: `SF Pro Display/Text` (si está disponible).
- Fallback: `-apple-system`, `BlinkMacSystemFont`, `"Segoe UI"`, `sans-serif`.

Escala sugerida:

- Título principal: `32`
- Título sección: `24`
- Subtítulo: `18`
- Texto base: `15` o `16`
- Texto secundario: `13`

### Colores

- Fondo app: gris claro neutro.
- Superficies: blanco con leve transparencia en paneles flotantes.
- Texto principal: gris muy oscuro.
- Texto secundario: gris medio.
- Acento primario: azul tipo sistema.
- Estados: verde (ok), amarillo (warning), rojo (error), gris (deshabilitado).

### Componentes clave

- Sidebar flotante en desktop, colapsable.
- Topbar compacta con búsqueda global y acciones rápidas.
- Tarjetas de contenido con bordes suaves.
- Botones con variantes: primario, secundario, ghost, peligro.
- Modales tipo hoja/sheet.
- Tablas con encabezado fijo y acciones por fila.
- Calendario con vista mensual/semanal y bloques de disponibilidad.

---

## Reglas Responsive (Obligatorias)

### Breakpoints de referencia

- `360-639`: móvil
- `640-1023`: tablet
- `1024-1439`: laptop
- `1440+`: desktop amplio

### Comportamiento por tamaño

- Móvil:
  - Sidebar se convierte en menú drawer.
  - Priorizar una columna.
  - Acciones secundarias dentro de menú contextual.
- Tablet:
  - Vista de dos paneles cuando aplique (lista + detalle).
  - Navegación simplificada.
- Desktop:
  - Sidebar fija o semicolapsada.
  - Vistas densas (tablas, calendario, Gantt) con filtros avanzados visibles.

### Reglas de layout

- Grid de 12 columnas en desktop, 4 en móvil.
- Márgenes laterales mínimos: `16px` móvil, `24px` tablet, `32px` desktop.
- Área táctil mínima para controles: `44x44`.
- Sin scroll horizontal en vistas críticas.

---

## Interacciones y Microcomportamiento

- Transiciones cortas (`120ms` a `220ms`) con easing suave.
- Estados de carga claros (skeletons/spinners).
- Feedback inmediato en acciones críticas (asignar, reasignar, guardar, aprobar).
- Confirmaciones obligatorias en acciones destructivas.
- Drag & drop en calendario y tablero con fallback por menú en móvil.

---

## Accesibilidad y Usabilidad

- Contraste mínimo WCAG AA.
- Navegación por teclado en vistas clave.
- Focus visible en todos los componentes interactivos.
- Soporte para zoom del navegador hasta `200%`.
- Etiquetas claras en formularios y errores con mensaje accionable.

---

## Rendimiento UI

- Primera carga optimizada en vistas principales.
- División por rutas y carga diferida de módulos pesados (Gantt, editor colaborativo, videollamadas).
- Imágenes e íconos optimizados.
- Evitar animaciones que bloqueen interacción.

---

## Criterios de Aceptación por Fase

### Fase 1

- Tablero, tareas, calendario y mensajería 100% usables en móvil y desktop.
- Sin desbordes horizontales en vistas críticas.
- Navegación principal accesible en 3 clics o menos.

### Fase 2A

- Módulo de reuniones y calendario compartido responsive.
- Controles de videollamada accesibles en pantallas pequeñas.

### Fase 2B

- Editor de documentos colaborativos usable en tablet y desktop.
- Permisos y acciones de documentos claramente visibles sin saturar interfaz.

### Fase 3

- Dashboards y planificación avanzada con versión responsive funcional.
- Vistas ejecutivas legibles en laptop y proyectables en pantallas grandes.

---

## Checklist de Revisión UI (Antes de Liberar)

- Responsive validado en móvil, tablet y desktop.
- Tipografía, color y espaciado consistentes.
- Estados vacíos, carga y error definidos.
- Acciones críticas con confirmación y feedback.
- Pruebas rápidas de accesibilidad (teclado, contraste, foco).
- Rendimiento aceptable en red y hardware estándar de la organización.

