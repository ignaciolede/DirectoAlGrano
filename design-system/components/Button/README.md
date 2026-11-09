# Button

Botón de acción: principal en tostado, secundario con borde, fantasma solo texto.

**Qué provee quien lo usa:** el texto (verbo en voseo o infinitivo corto: "Guardar review", "Cómo llegar"), un ícono opcional como `<span data-icon>` antes del texto, y `aria-label` si es solo ícono.

| Clase | Uso |
| --- | --- |
| `dag-btn` | Una sola acción principal por pantalla. Alto 52px, `radius-md`. |
| `dag-btn--block` | Ancho completo, al pie de formularios. |
| `dag-btn--secondary` | Acciones de apoyo (Cómo llegar, Editar). Borde `line-strong`. |
| `dag-btn--ghost` | Cancelar, Ver todo. Texto `brand`. |
| `dag-btn--sm` | Pastilla de 40px dentro de tarjetas (Ya fui). |
| `dag-btn--icon` | Cuadrado 44px, solo ícono. |

- No poner dos `dag-btn` principales lado a lado.
