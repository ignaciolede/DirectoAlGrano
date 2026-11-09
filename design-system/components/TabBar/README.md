# TabBar

Navegación inferior flotante: Ranking, Mapa, "+" (nueva review), Wishlist y Diario.

**Qué provee quien lo usa:** la sección actual (`aria-current="page"` en su `.dag-tab`).

- Flota a 14px de los lados y 26px del borde inferior (más el safe area), pastilla de 68px con `shadow-float`.
- El "+" central (`dag-fab`, 56px, `brand`) abre la Nueva review desde cualquier sección.
- Tab activa: ícono y texto `brand` con un punto debajo; las demás `ink-muted`.
- Etiquetas siempre visibles en `caption`.
