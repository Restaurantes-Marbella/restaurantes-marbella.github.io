// Fusiona coordenadas de calle con cada local y aplica jitter determinista anti-solape
const fs = require('fs');
const rest = JSON.parse(fs.readFileSync('restaurantes.json', 'utf8'));
const coords = JSON.parse(fs.readFileSync('_streetcoords.json', 'utf8'));

// Agrupar por calle para repartir en círculo
const groups = {};
rest.forEach((r, i) => {
  const key = r.zona + '||' + r.calle;
  (groups[key] = groups[key] || []).push(i);
});

const out = rest.map(r => ({ ...r }));
for (const key in groups) {
  const idxs = groups[key];
  const base = coords[key] || [36.5100, -4.8850];
  const n = idxs.length;
  idxs.forEach((idx, k) => {
    if (n === 1) {
      out[idx].lat = base[0];
      out[idx].lng = base[1];
    } else {
      // Reparto en espiral pequeña (~8-16 m) alrededor del punto de la calle
      const ang = (k / n) * Math.PI * 2 + (idx % 3);
      const rad = 0.00010 + 0.00006 * (k % 3); // ~11–20 m
      out[idx].lat = +(base[0] + rad * Math.cos(ang)).toFixed(6);
      out[idx].lng = +(base[1] + rad * Math.sin(ang) / Math.cos(base[0] * Math.PI / 180)).toFixed(6);
    }
  });
}

// id estable
out.forEach((r, i) => r.id = i + 1);

fs.writeFileSync('data.json', JSON.stringify(out));
console.log('data.json escrito con', out.length, 'locales.');
console.log('Ejemplo:', JSON.stringify(out[0]));
console.log('Sin coords:', out.filter(r => r.lat == null).length);
