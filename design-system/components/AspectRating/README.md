# AspectRating

Puntaje por aspecto en granos del 1 al 5: Café, Lugar, Atención, Precio/calidad y Para trabajar.

**Qué provee quien lo usa:** la lista de aspectos (ícono + nombre) y el valor de cada uno; cada `.dag-bean` lleva `data-on`.

- Editable: cada grano es un botón de 30×44px; tocar el tercero llena los tres primeros.
- Lectura en listas: `dag-beans--read` (granos de 16px).
- En el detalle de la cafetería, mostrá los aspectos como barras `dag-bar` (relleno `brand` sobre `surface-sunk`).
- Los aspectos son opcionales y no alteran la nota general: la explican.
- Grano lleno = relleno `brand` con surco en `surface-raised`; vacío = contorno `line-strong`.
