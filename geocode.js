// Geocodificación de calles del Casco Antiguo de Marbella vía Nominatim (OSM)
const fs = require('fs');

const streets = JSON.parse(fs.readFileSync('_streets.json', 'utf8'));

// BBox aproximado del Casco Antiguo + Centro de Marbella (lat/lon)
const BBOX = { minLat: 36.503, maxLat: 36.518, minLon: -4.898, maxLon: -4.872 };
// viewbox para Nominatim: lon1,lat1,lon2,lat2 (esquina superior izq, inferior der)
const VIEWBOX = `${BBOX.minLon},${BBOX.maxLat},${BBOX.maxLon},${BBOX.minLat}`;

// Centros de zona (fallback si falla o cae fuera de bbox)
const ZONE_CENTER = {
  'Casco Antiguo': [36.5103, -4.8852],
  'Mercado': [36.5138, -4.8878],
  'Centro - Alameda': [36.5068, -4.8840],
  'Casco Antiguo Este - Amare': [36.5083, -4.8792],
  'Centro - Oeste': [36.5088, -4.8898],
};

// Correcciones manuales para plazas/lugares conocidos (lat, lon)
const MANUAL = {
  'Plaza de los Naranjos': [36.51000, -4.88516],
  'Plaza de los Naranjos ': [36.51000, -4.88516],
  'Plaza de la Iglesia': [36.51043, -4.88437],
  'Plaza de la Victoria': [36.51100, -4.88370],
  'Plaza Altamirano': [36.50930, -4.88430],
  'Plaza Santo Cristo': [36.51070, -4.88350],
  'Plaza General Chinchilla': [36.50960, -4.88540],
  'Plaza José Palomo': [36.50975, -4.88600],
  'Plaza Practicante Manuel Cantos': [36.50920, -4.88580],
  'Plaza Puente de Ronda': [36.50890, -4.88500],
  'Plaza Puente Málaga': [36.50870, -4.88470],
  'Plaza Fernando Alcalá': [36.50990, -4.88650],
  'Plaza África': [36.50960, -4.88680],
  'Plaza Blas Infante': [36.50820, -4.88120],
  'Plaza José Luque Manzano': [36.50840, -4.87950],
  'Mercado Municipal': [36.51400, -4.88770],
  'Avenida de Nabeul': [36.51150, -4.88560],
  'Avenida del Mercado': [36.51260, -4.88680],
  'Avenida Ramon y Cajal': [36.51080, -4.88760],
  'Avenida del Mar': [36.50780, -4.88450],
  'Avenida del Mar - Paseo Marítimo': [36.50600, -4.88400],
  'Avenida Duque de Ahumada': [36.50680, -4.88520],
  'Avenida Miguel Cano': [36.50760, -4.88650],
  'Avenida Puerta del Mar': [36.50720, -4.88560],
  'Avenida Antonio Belón': [36.50840, -4.88880],
  'Avenida Severo Ochoa': [36.50880, -4.87850],
  'Paseo Alfonso Cañas Nogueras': [36.50600, -4.87900],
  'Calle Jacinto Benavente': [36.51330, -4.88760],
  'Calle Jacinto Benavente ': [36.51330, -4.88760],
};

async function nominatim(q) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=es&bounded=1&viewbox=${VIEWBOX}&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'MarbellaGastroMap/1.0 (jose contact)' } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

const inBox = (lat, lon) => lat >= BBOX.minLat && lat <= BBOX.maxLat && lon >= BBOX.minLon && lon <= BBOX.maxLon;
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const result = {};
  const report = [];
  for (const key of streets) {
    const [zona, calle] = key.split('||');
    let coord = null, source = '';

    if (MANUAL[calle]) { coord = MANUAL[calle]; source = 'manual'; }

    if (!coord) {
      const queries = [
        `${calle}, Marbella`,
        `${calle}, Casco Antiguo, Marbella`,
        `${calle}, 29601 Marbella, Málaga`,
      ];
      for (const q of queries) {
        try {
          const data = await nominatim(q);
          await sleep(1100);
          if (data && data.length) {
            const lat = parseFloat(data[0].lat), lon = parseFloat(data[0].lon);
            if (inBox(lat, lon)) { coord = [lat, lon]; source = 'nominatim:' + data[0].type; break; }
          }
        } catch (e) { await sleep(1100); }
      }
    }

    if (!coord) {
      coord = ZONE_CENTER[zona] || [36.5100, -4.8850];
      source = 'zone-fallback';
    }

    result[key] = coord;
    report.push(`${source.padEnd(22)} ${calle}  ->  ${coord[0].toFixed(5)}, ${coord[1].toFixed(5)}`);
    console.log(report[report.length - 1]);
  }
  fs.writeFileSync('_streetcoords.json', JSON.stringify(result, null, 2));
  const fb = report.filter(r => r.startsWith('zone-fallback')).length;
  console.log(`\nHecho. ${streets.length} calles. Fallback de zona: ${fb}`);
})();
