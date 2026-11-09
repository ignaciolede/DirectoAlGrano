# ScoreBadge

El número de la nota (1–10) con el color de su banda; siempre acompañado por la palabra de banda cuando está solo.

**Qué provee quien lo usa:** la nota en `data-score` (punto decimal en el dato; se muestra con coma). `DirectoAlGrano.hydrate()` pone `data-band` y el texto.

```html
<span class="dag-score" data-score="8.5"></span>
<span class="dag-band-word" data-band-of="8.5"></span>
```

| Banda | Nota | Palabra |
| --- | --- | --- |
| `top` | 9–10 | Directo al grano |
| `good` | 7–8 | Vuelvo seguro |
| `ok` | 5–6 | Zafa |
| `low` | 1–4 | No vuelvo |

- Tamaños: `--sm` 34px (listas densas), base 44px (tarjeta del ranking), `--lg` 64px, `--xl` para el detalle (`score-xl`).
- El color nunca va solo: en el detalle y en el formulario mostrá también `dag-band-word`.
