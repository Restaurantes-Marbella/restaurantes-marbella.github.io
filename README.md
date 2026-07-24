# Mesas de Marbella

Guía gastronómica interactiva del **Casco Antiguo y centro de Marbella**: un mapa con todos los restaurantes, bares y cafeterías de la zona, filtrables por **tipo**, **cocina**, **zona** y **accesibilidad**.

🔗 **Web:** https://restaurantes-marbella.github.io/

## Contenido
- **285 establecimientos** censados sobre el terreno (barrida de campo).
- 5 zonas: Casco Antiguo, Mercado, Centro-Alameda, Centro-Oeste y Casco Antiguo Este (Amare).
- Mapa con marcadores agrupados, coloreados por tipo de local y con indicador de accesibilidad.
- Buscador por nombre y ficha con enlace a Google Maps.

## Estructura
| Archivo | Descripción |
|---------|-------------|
| `index.html` | Página y estilos |
| `app.js` | Lógica de mapa (Leaflet), filtros y listado |
| `data.json` | Datos de los locales con coordenadas |
| `parse.js`, `geocode.js`, `build-data.js` | Scripts de preparación de datos (no necesarios en producción) |

## Créditos
Cartografía © OpenStreetMap · CARTO. Datos: barrida de campo del Casco Antiguo de Marbella.
