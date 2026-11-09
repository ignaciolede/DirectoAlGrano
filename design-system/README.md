*Tu ranking personal de cafeterías. Sin vueltas.*

Directo al grano es una app personal, mobile-first, para puntuar cafeterías, armar un ranking propio, verlas en un mapa y guardar las que faltan probar. El nombre juega con el grano de café y con ir al punto: cada pantalla responde una sola pregunta y nada más.

## La marca

**El grano recto.** El logo es un grano de café cuyo surco no es la S de siempre sino una línea recta: el grano que va al punto. Usá `assets/Logos/mark-tostado.svg` sobre `surface` y `surface-raised`, `mark-crema.svg` sobre `brand` o en el tema Espresso, y `mark-espresso.svg` solo para impresión a una tinta. El ícono de la app es `app-icon.svg` (grano crema sobre tostado, esquina de 16/64).

**Wordmark.** No hay archivo: se compone en vivo con el componente Logo. "Directo" y "grano" en `display` (Fraunces 600), "al" en Fraunces itálica 500 en `brand`. Nunca en mayúsculas, nunca en otra fuente, nunca separado del grano en el header principal.

**Área de respeto.** Dejá alrededor del grano un espacio igual a la mitad de su ancho. Tamaño mínimo: 20px de alto.

## Voz y contenido

- Español rioplatense, voseo, segunda persona: "¿Qué tomaste?", "Guardala para después", "Ya fuiste".
- Frases cortas. Un título de pantalla es una palabra: **Ranking**, **Mapa**, **Wishlist**, **Diario**.
- Mayúscula solo al inicio (sentence case). Los rótulos de sección van en `label` (mayúsculas, espaciado 0,8px): ORIGEN DEL GRANO, ¿COMISTE?.
- Puntajes con coma decimal argentina: **8,5**, nunca 8.5.
- Sin emoji en la interfaz. El humor va en las palabras, no en dibujitos.
- Vacíos con personalidad, en una línea: "Todavía no reseñaste nada. El primer cortado corre por tu cuenta."

### Las cuatro bandas del puntaje

Cada nota 1–10 cae en una banda. La banda **siempre** se muestra con su palabra además del color.

| Nota | Palabra | Badge |
| --- | --- | --- |
| 9–10 | Directo al grano | relleno `brand`, número en `on-brand` |
| 7–8 | Vuelvo seguro | relleno `accent`, número en `on-accent` |
| 5–6 | Zafa | relleno `surface-sunk`, número en `ink` |
| 1–4 | No vuelvo | `surface-raised` con borde y número en `danger` |

`DirectoAlGrano.band(n)` y `DirectoAlGrano.bandWord(n)` devuelven la banda y su palabra.

## Qué se puntúa en una review

La review se arma de arriba hacia abajo, en este orden:

1. **Nota general 1–10** (obligatoria) — ScorePicker. Es lo que ordena el Ranking.
2. **Aspectos en granos 1–5** (opcionales) — AspectRating: Café, Lugar, Atención, Precio/calidad, Para trabajar (wifi, enchufes, ruido). No suman a la nota: la explican.
3. **El grano** — BeanSelector: qué tomaste (espresso, cortado, flat white, filtro…), origen (Etiopía, Colombia, Brasil, Blend, No sé), tueste (claro, medio, oscuro) y método (máquina, V60, Chemex, Aeropress, Cold brew).
4. **La review** — texto libre, ReviewField.
5. **¿Comiste?** — FoodReview: interruptor; si está prendido, qué comiste, nota 1–10 propia y comentario.
6. **Ubicación** — buscador de dirección con mapa y pin.

Cada vuelta a una cafetería es una **visita**: la nota del ranking es el promedio de las visitas, mostrado con una decimal (8,5).

## Fundamentos visuales

**Color.** Dos temas: **Crema** (claro, el principal) y **Espresso** (oscuro). La app vive sobre `surface`; todo lo que se toca o se lee como objeto va en `surface-raised` con `shadow-card`. El tostado (`brand`) es el único color de acción: botón principal, tab activa, pin, nota 9–10. El miel (`accent`) es solo relleno para la banda 7–8, nunca texto. El verde de grano crudo (`bean-green`, `bean-green-tint`) significa **pendiente**: todo lo de la Wishlist y nada más. `danger` aparece solo en "No vuelvo", borrar y errores.

**Tipografía.** Dos familias. Fraunces (`display`) para nombres de cafeterías, títulos y todos los números de puntaje: `score-xl` para el puntaje del detalle, `display` para el título de pantalla, `title-lg` para el nombre en el detalle, `title` para nombres en tarjetas. Instrument Sans (`sans`) para todo lo demás: `body` en la review, `body-strong` en preguntas y botones, `body-sm` para barrio y fecha, `label` para rótulos, `caption` en la tab bar. Los puntajes siempre en cifras tabulares.

**Espaciado.** Margen lateral de pantalla `space-4` (16px). Entre secciones del formulario `space-6`. Entre chips `space-2`. Padding de tarjeta `space-4`.

**Forma.** `radius-md` para tarjetas y botones, `radius-lg` para el mapa, sheets y el destacado #1, `radius-pill` para chips, tab bar y botón "+", `radius-sm` para inputs y badges chicos. Sin bordes de color a un costado de las tarjetas.

**Sombras.** `shadow-card` separa tarjetas del fondo; `shadow-float` solo para lo que flota (tab bar, "+", sheet del mapa).

**Estados.** Presionado: escala 0,98. Foco: anillo sólido `focus` de 2px con 2px de separación. Seleccionado: chip en `brand-tint` con borde `brand`; opción de nota en `brand` lleno.

**Touch.** Todo objetivo táctil mide al menos 44px de alto. La tab bar flota a 26px del borde inferior con el "+" central de 56px: nueva review siempre a un pulgar de distancia.

**Movimiento.** Corto y funcional (120–180ms): presionar, prender un switch, subir un sheet. Nada decorativo.

**Mapa.** Estilizado con los tokens `map-land`, `map-road`, `map-water` (en producción, un estilo de tiles teñido con esos colores). Los pines llevan la nota adentro con el color de su banda; los de Wishlist son círculos verdes con el ícono de marcador. "Vos" es un punto `ink` con halo.

## Iconografía

Set propio de 21 íconos en `assets/Icons/` (grilla 24px, trazo 1,75, puntas y uniones redondeadas), dibujados para esta marca. En la interfaz usalos inline con `DirectoAlGrano.icon(nombre)` o `<span data-icon="nombre">` + `DirectoAlGrano.hydrate()`, que toman `currentColor`. Los SVG sueltos vienen en tinta `ink` (#24170f) para usar en `<img>`. El ícono `bean` es el grano de la marca y sirve como unidad de los aspectos 1–5. No mezclar con otros sets ni con emoji.

## Navegación

Cuatro secciones más acción central: **Ranking** · **Mapa** · **+ Nueva review** · **Wishlist** · **Diario** (historial de visitas por fecha). Una cafetería se abre desde cualquier lado en su Detalle.

## Componentes

Todo es CSS puro (`components/bundle.css`, clases `dag-`) más un script chico sin dependencias (`components/bundle.js`, `window.DirectoAlGrano`) que dibuja íconos e hidrata la interacción. Las pantallas de la sección **Pantallas** muestran cómo se combinan.
