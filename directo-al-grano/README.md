# Directo al grano — la app

Tu ranking personal de cafeterías, armado con el sistema de diseño de `../design-system/`.
HTML, CSS y JS sin build. Dependencias por CDN con hash SRI: Leaflet para el mapa y Supabase JS para la cuenta y la base de datos. Cada persona entra con mail y contraseña y sus datos viven en Supabase.

## Configurar Supabase (una vez)

1. Creá un proyecto en [supabase.com](https://supabase.com).
2. En **SQL Editor**, pegá y corré `supabase/schema.sql`. Crea las tablas `cafes`, `visits` y `wishlist` con Row Level Security: cada usuario ve y toca solo lo suyo.
   Después corré `supabase/comunidad.sql`: activa Personas y el ranking Global (perfil con @usuario único y funciones que comparten solo nombre de cafetería, ubicación y notas; nunca mails ni textos de reviews).
   Opcional, para pegar links cortos de Google Maps (`maps.app.goo.gl`): en **Edge Functions → Deploy a new function → Via Editor**, creá una función llamada `maps-link`, pegá `supabase/functions/maps-link/index.ts` y tocá Deploy (o `supabase functions deploy maps-link` con la CLI). Es gratis: solo sigue el redirect del link, y solo a dominios de Google.
3. En **Project Settings → API**, copiá la *Project URL* y la *anon public key* a `js/config.js`. La anon key es pública por diseño; nunca pongas la `service_role`.
4. En **Authentication → URL Configuration**, poné como *Site URL* la dirección donde abrís la app (por ejemplo `http://localhost:3000/directo-al-grano/`) y agregala también en *Redirect URLs*. Ahí vuelven los links de confirmación y de nueva contraseña.
5. Opcional: en **Authentication → Providers → Email** podés apagar *Confirm email* para entrar sin confirmar el mail (cómodo para probar). Con eso prendido, el mail de Supabase tiene un límite bajo de envíos por hora; para usuarios reales configurá un SMTP propio.
6. Recomendado: en el mismo lugar, poné el largo mínimo de contraseña en 8, igual que la app.

## Abrirla

Desde la carpeta raíz del proyecto (`DirectoAlGrano/`, no desde esta), porque la app usa `../design-system/`:

```bash
npx serve .
# o
python -m http.server 8000
```

y entrá a `http://localhost:3000/directo-al-grano/` (o `:8000`). Usá un servidor: si abrís `index.html` con doble clic, los tiles de OpenStreetMap pueden no cargar, porque piden saber desde qué sitio se los pide.

## Publicada en GitHub Pages

https://ignaciolede.github.io/DirectoAlGrano/ (la raíz redirige a `directo-al-grano/`). Cada push a `main` se publica solo en uno o dos minutos.

En Supabase, **Authentication → URL Configuration** tiene que tener como *Site URL* `https://ignaciolede.github.io/DirectoAlGrano/directo-al-grano/`, y en *Redirect URLs* esa misma y la de desarrollo (`http://localhost:3000/directo-al-grano/`).

## En la pantalla de inicio

- **iPhone**: abrila en Safari → Compartir → *Agregar a inicio*. Abre a pantalla completa con el ícono del grano.
- **Android**: Chrome → menú ⋮ → *Instalar app* (o *Agregar a pantalla principal*).
- `manifest.webmanifest` define nombre, colores e íconos (`icons/`, PNG generados desde `design-system/assets/Logos/app-icon.svg`). `sw.js` guarda la cáscara para que abra sin señal; pide siempre primero a la red, así que lo publicado llega al toque. Solo se activa en https (no en localhost).
- En iPhone, la app instalada tiene su propia sesión: la primera vez hay que entrar de nuevo. Los links de mail (confirmar, nueva contraseña) se abren en Safari, no en la app instalada.

## Qué hay

- **Cuenta**: entrar, registrarse (nombre opcional), recuperar la contraseña por mail y cerrar sesión desde Ajustes. Sin sesión solo se ven esas pantallas. Si en el navegador había datos de la versión anterior, con la cuenta vacía aparece "Subir lo que tenías en este navegador".
- **Ranking**: orden por nota promedio de las visitas. Se puede filtrar por aspecto o por comida, y buscar. El #1 va destacado.
- **Detalle**: nota con su banda, aspectos en barras, lo último que tomaste, la review, la comida, la dirección con "Cómo llegar" y todas las visitas.
- **Nueva review**: sigue el orden del brand book (nota → aspectos → grano → review → ¿comiste? → ubicación). La nota es lo único obligatorio. Al escribir el nombre (por ejemplo "Negro cafe") te muestra las que ya tenés y los lugares reales del mapa. Si elegís uno, completa barrio, dirección y pin. En Ubicación también podés buscar una dirección, tocar el mapa o arrastrar el pin, y la dirección se completa sola.
- **Mapa**: mapa real (OpenStreetMap) teñido en Crema o Espresso, con pines con la nota y el color de su banda, y los de la Wishlist en verde. El buscador encuentra tus lugares y cualquier cafetería o dirección real. Al elegir un lugar nuevo podés reseñarlo o guardarlo en la Wishlist.
- **Wishlist**: pendientes con su porqué. Al agregar una, se busca por nombre igual que en la review. "Ya fui" abre la review con los datos cargados y saca la cafetería de la lista al guardar.
- **Diario**: visitas por mes.
- **Ajustes** (botón ··· en Ranking y Diario): cuenta y cerrar sesión, tema Crema, Espresso o el del sistema (queda en el dispositivo), exportar e importar en JSON (importar reemplaza todo lo de la cuenta), y empezar de cero.

## Archivos

- `index.html`: entrada y tab bar.
- `app.css`: solo la cáscara (columna, sheets, toast, mapa y resultados de búsqueda). Los componentes son los `dag-` de `bundle.css`.
- `js/config.js`: URL y anon key de Supabase.
- `js/store.js`: sesión (Supabase Auth), datos, promedios, y ranking. Al entrar trae todo a memoria; cada cambio se aplica al instante y se sube a Supabase en una cola ordenada.
- `supabase/schema.sql`: tablas y políticas RLS.
- `supabase/functions/maps-link/index.ts`: abre links cortos de Google Maps y devuelve el link largo con la ubicación.
- `supabase/comunidad.sql`: perfiles con @usuario único (`username_available` para el registro), `place_id` en cafeterías y las funciones `search_users`, `user_ranking` y `global_ranking`.
- `js/geo.js`: búsqueda de lugares y búsqueda inversa con [Photon](https://photon.komoot.io), el buscador de OpenStreetMap: no pide clave y prioriza lo cercano y las cafeterías.
- `js/map.js`: Leaflet con tiles de OpenStreetMap, filtro de color por tema y pines `dag-pin`.
- `js/app.js`: router por hash (`#/entrar`, `#/registro`, `#/recuperar`, `#/ranking`, `#/cafe/:id`, `#/nueva`, `#/editar/:visita`, `#/mapa`, `#/wishlist`, `#/diario`) y pantallas.

## Límites conocidos

- La búsqueda depende de lo que esté cargado en OpenStreetMap. Si una cafetería no figura, o figura sin altura (por ejemplo, solo "Suipacha"), buscá la dirección o tocá el mapa, y corregí el pin arrastrándolo.
- Photon y los tiles de OpenStreetMap son servicios gratuitos de uso razonable: alcanzan para una app personal, pero no para muchos usuarios. Para eso conviene un proveedor con clave (MapTiler, Stadia o Mapbox): se cambia `TILE_URL` en `js/map.js` y `API` en `js/geo.js`.
- El tono del mapa sale de un filtro CSS (`--map-tiles-filter` en `app.css`) que aproxima los tokens `map-*`. Un estilo de tiles propio con esos colores exactos requiere un proveedor con estilos personalizados.
- Hace falta conexión para entrar y para cargar los datos. Si un cambio no se puede subir, aparece un aviso; ese cambio se ve hasta que recargás, pero no quedó guardado.
- Los cambios se guardan "el último gana": si editás lo mismo en dos dispositivos a la vez, queda la última versión, y el otro dispositivo lo ve al recargar.
- Las ubicaciones de la versión anterior (mapa ilustrado) no se pueden pasar a coordenadas reales. Se conserva la dirección; para volver a ponerla en el mapa, editá la visita y marcá el lugar.
