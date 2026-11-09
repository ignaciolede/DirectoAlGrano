# Logo

El grano recto más el wordmark compuesto en Fraunces: la firma de la app.

**Qué provee quien lo usa:** nada; es marcado fijo.

```html
<a class="dag-logo" href="/"><span class="dag-logo__mark" data-mark></span>
  <span class="dag-logo__word">Directo <em>al</em> grano</span></a>
```

- `dag-logo--lg` para splash y onboarding (grano 64px, texto 40px).
- `data-mark` dibuja el grano en `currentColor` (tostado por defecto). Sobre `brand`, poné el color en `on-brand` y también el `<em>`.
- `dag-appicon` es el ícono de la app (72px, esquina 18px). Para el archivo, `assets/Logos/app-icon.svg`.
- No: girar el grano, curvar el surco, cambiar la fuente, poner "al" en otro color que no sea `brand` u `on-brand`.
