# Directo al grano

**App publicada:** https://ignaciolede.github.io/DirectoAlGrano/ (GitHub Pages, rama `main`). Se instala en el teléfono desde el navegador: en iPhone, Safari → Compartir → *Agregar a inicio*; en Android, Chrome → menú → *Instalar app*.

Sistema de diseño (marca, colores, tipografía, componentes y pantallas mobile) de la app personal de reviews de cafeterías.

## Ver la vista previa

Desde esta carpeta, en la terminal de VS Code:

```bash
npx serve preview
```

Abrí la dirección que muestra (normalmente http://localhost:3000). Si no tenés Node, con Python:

```bash
python -m http.server 8000 --directory preview
```

y entrá a http://localhost:8000.

## Qué hay

- `design-system/README.md`: el brand book, con reglas de marca, voz y qué se puntúa.
- `design-system/tokens.json` y `tokens.css`: colores (tema Crema y Espresso), tipografía, espaciado, radios y sombras.
- `design-system/components/bundle.css` y `bundle.js`: los componentes (clases `dag-`) y los íconos.
- `design-system/components/<Componente>/`: guía de uso (`README.md`) y ejemplo (`preview.html`) de cada uno.
- `design-system/assets/`: logo, ícono de la app y los 21 íconos en SVG.
- `preview/`: las mismas pantallas listas para abrir en el navegador.

## Con Claude Code

Abrí esta carpeta en VS Code, iniciá `claude` en la terminal y pedile algo como:
"Leé design-system/README.md y armá la app Directo al grano usando ese sistema de diseño."
