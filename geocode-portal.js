// Geocodificación por portal (calle + número) con CartoCiudad (IGN), sin API key.
// Si no hay número o la coincidencia cae fuera del centro, se usa el punto de calle anterior.
const fs = require('fs');
const rest = JSON.parse(fs.readFileSync('restaurantes.json', 'utf8'));
const street = JSON.parse(fs.readFileSync('_streetcoords.json', 'utf8'));
const BBOX = { minLat: 36.500, maxLat: 36.520, minLon: -4.900, maxLon: -4.868 };
const inBox = (a, o) => a >= BBOX.minLat && a <= BBOX.maxLat && o >= BBOX.minLon && o <= BBOX.maxLon;
const API = 'https://www.cartociudad.es/geocoder/api/geocoder/';
const clean = s => s.trim().replace(/\s+/g, ' ');
const parse = t => JSON.parse(t.replace(/^callback\(|\)$/g, ''));

async function get(path) {
  for (let i = 0; i < 3; i++) {
    try { return parse(await (await fetch(API + path)).text()); } catch (e) { await new Promise(r => setTimeout(r, 800)); }
  }
  return null;
}

// OpenStreetMap (Nominatim) con número, como último recurso
async function osm(calle, n) {
  await new Promise(r => setTimeout(r, 1100)); // límite de uso: 1 petición/s
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=es&street=${encodeURIComponent(n + ' ' + clean(calle))}&city=Marbella`;
  try {
    const j = await (await fetch(url, { headers: { 'User-Agent': 'MesasDeMarbella/1.0' } })).json();
    const h = j[0];
    if (h && ['house', 'building'].includes(h.addresstype) && inBox(+h.lat, +h.lon)) return [+h.lat, +h.lon, 'OSM ' + h.display_name.split(',').slice(0, 2).join(',')];
  } catch (e) {}
  return null;
}

async function geocode(calle, num) {
  // Solo vale un número al principio ("3", "5b"); "Edificio X, local 8" no es portal
  const n = (num.match(/^\s*(\d+)/) || [])[1];
  if (!n) return null;
  const sinTipo = clean(calle).replace(/^(Calle|Avenida|Plaza|Paseo|Callejón|Travesía)( de la| de los| de| del)? /i, '');
  return (await cartociudad(clean(calle), n)) || (await cartociudad(sinTipo, n)) || (await osm(calle, n));
}

async function cartociudad(calle, n) {
  const q = `${calle} ${n}, Marbella`;
  const best = await get('findJsonp?q=' + encodeURIComponent(q));
  if (best && best.type === 'portal' && best.muni === 'Marbella' && inBox(best.lat, best.lng)) return [best.lat, best.lng, best.address + ' ' + best.portalNumber];
  // Probar entre candidatos el primero dentro del centro
  const cands = await get('candidatesJsonp?limit=15&q=' + encodeURIComponent(q)) || [];
  for (const c of cands) {
    if (c.muni !== 'Marbella' || !['portal', 'callejero'].includes(c.type)) continue;
    const f = await get(`findJsonp?id=${encodeURIComponent(c.id)}&type=${c.type}&portal=${n}`);
    if (f && f.type === 'portal' && inBox(f.lat, f.lng)) return [f.lat, f.lng, f.address + ' ' + f.portalNumber];
  }
  return null;
}

(async () => {
  const cache = {}, out = [], log = { portal: 0, calle: 0 }, fallos = [];
  for (const r of rest) {
    const key = clean(r.calle) + '|' + r.num;
    if (!(key in cache)) cache[key] = await geocode(r.calle, r.num || '');
    const g = cache[key];
    if (g) { out.push({ ...r, lat: g[0], lng: g[1], precision: 'portal' }); log.portal++; }
    else {
      const b = street[r.zona + '||' + r.calle] || [36.5100, -4.8850];
      out.push({ ...r, lat: b[0], lng: b[1], precision: 'calle' }); log.calle++;
      fallos.push(`${r.nombre} — ${r.calle} ${r.num}`);
    }
  }
  // Separar levemente (~4 m) locales con el mismo punto exacto
  const seen = {};
  out.forEach(r => {
    const k = r.lat.toFixed(6) + ',' + r.lng.toFixed(6);
    const i = seen[k] = (seen[k] || 0) + 1;
    if (i > 1) { const a = i * 2.4; r.lat += 0.00004 * Math.cos(a); r.lng += 0.00005 * Math.sin(a); }
    r.lat = +r.lat.toFixed(6); r.lng = +r.lng.toFixed(6);
  });
  out.forEach((r, i) => r.id = i + 1);
  fs.writeFileSync('data.json', JSON.stringify(out));
  fs.writeFileSync('_sin-portal.txt', fallos.join('\n'));
  console.log(log); console.log(fallos.join('\n'));
})();
