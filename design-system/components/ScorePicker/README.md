# ScorePicker

Selector de nota del 1 al 10 en una fila de diez botones, pensado para el pulgar.

**Qué provee quien lo usa:** la nota inicial (el botón con `aria-pressed="true"`) y escuchar el click de `.dag-picker__opt` para leer el valor.

- Diez opciones de 44px de alto que entran en 358px (pantalla de 390 con margen `space-4`).
- Arriba, la lectura grande en Fraunces 64px con "/10" y la palabra de banda que se actualiza al tocar.
- Las notas por debajo de la elegida se tiñen de `brand-tint` para que se lea como escala.
- `dag-picker--compact` sin lectura para la nota de la comida dentro de FoodReview.
- No usar slider: con el pulgar es impreciso para elegir un número exacto.
