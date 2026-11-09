# MapView

Mapa estilizado con pines por nota, pines de wishlist, tu ubicación y un sheet con la cafetería elegida.

**Qué provee quien lo usa:** el mapa base (en producción: tiles teñidos con `map-land`, `map-road`, `map-water`, p. ej. MapLibre con un estilo propio), y por cada pin su posición y su nota.

- Pin de cafetería: pastilla con la nota y el color de su banda (`data-score`). El pin `ok` lleva contorno `line-strong`.
- Pin de wishlist: `dag-pin--wish`, círculo `bean-green-tint` con borde `bean-green` e ícono `wishlist`.
- Seleccionado: `aria-pressed="true"`, crece 18% con anillo `ink`; abre `dag-sheet` abajo.
- Tu ubicación: `dag-me`.
- Filtros arriba como chips sólidos: Todas · 9+ · Wishlist.
- En la review, el mismo mapa en chico (alto 160px) confirma la ubicación elegida.
