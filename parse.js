// Parseo y limpieza de la barrida de restaurantes del Casco Antiguo de Marbella
const fs = require('fs');

function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\r') { /* skip */ }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const raw = fs.readFileSync('barrida.csv', 'utf8');
const rows = parseCSV(raw);

// La cabecera real está en la fila índice 1: ["", "Zona","Calle","nº","Nombre","Tipo","Categoria","¿Es accesible?","Observaciones"]
const clean = s => (s || '').replace(/\s+/g, ' ').trim();

const records = [];
for (let i = 2; i < rows.length; i++) {
  const r = rows[i];
  const zona = clean(r[1]);
  const calle = clean(r[2]);
  const num = clean(r[3]);
  const nombre = clean(r[4]);
  const tipo = clean(r[5]);
  const categoria = clean(r[6]);
  const acc = clean(r[7]);
  const obs = clean(r[8]);
  // Descartar filas de secciones vacías (Puerto Deportivo sin locales, separadores)
  if (!nombre || !tipo) continue;
  if (!zona || !calle) continue;
  records.push({ zona, calle, num, nombre, tipo, categoria, acc, obs });
}

// Normalizar accesibilidad -> boolean/null
function normAcc(v) {
  const s = v.toLowerCase();
  if (s.startsWith('si') || s.startsWith('sí')) return 'si';
  if (s.startsWith('no')) return 'no';
  return 'nd'; // no determinado
}

// Normalizar Tipo a un conjunto cerrado
function normTipo(v) {
  const s = v.toLowerCase();
  if (s.includes('restaurante')) return 'Restaurante';
  if (s.includes('cafeter')) return 'Cafetería';
  if (s.includes('bar')) return 'Bar';
  if (s.includes('llevar') || s.includes('para llevar')) return 'Para llevar';
  return 'Otro';
}

// Derivar etiquetas de cocina/categoría a partir del texto libre "Categoria"
const CUISINE_MAP = [
  [/mediterr/i, 'Mediterránea'],
  [/espa[nñ]ola/i, 'Española'],
  [/\btapas\b/i, 'Tapas'],
  [/italian/i, 'Italiana'],
  [/pizz/i, 'Pizzería'],
  [/japon/i, 'Japonesa'],
  [/\bsushi\b/i, 'Japonesa'],
  [/ramen/i, 'Japonesa'],
  [/izakaya/i, 'Japonesa'],
  [/asi[aá]tic/i, 'Asiática'],
  [/\bchin[ao]\b/i, 'China'],
  [/tailand/i, 'Tailandesa'],
  [/india?o/i, 'India'],
  [/\bindio\b/i, 'India'],
  [/persa/i, 'Persa'],
  [/pescado|marisco|marisquer|ostrer/i, 'Pescado y marisco'],
  [/asad(or|o)/i, 'Asador / Carnes'],
  [/hamburgues|burger/i, 'Hamburguesería'],
  [/kebab/i, 'Kebab'],
  [/helad/i, 'Heladería'],
  [/pastel|panad|churrer|crep|teter|caf[eé]ter[ií]a|bubble|sandwich|chimney/i, 'Cafetería y dulces'],
  [/brunch/i, 'Brunch'],
  [/healthy|vegan|vegetari|poke|hawaian|a[cç]ai|a[cç]a[ií]/i, 'Saludable / Poké'],
  [/gourmet/i, 'Gourmet'],
  [/argentin|colombian|paraguay|mexican|catalana|gallega|asturiana|peruan|latina/i, 'Latina / Regional'],
  [/griega/i, 'Griega'],
  [/chiringuito/i, 'Chiringuito'],
  [/\bpub\b/i, 'Pub'],
  [/cockt|c[oó]ctel/i, 'Cócteles'],
  [/cata de vino|vino|charcut|ib[eé]ric/i, 'Vinos y bodega'],
  [/internacional/i, 'Internacional'],
  [/precocinad/i, 'Precocinados'],
];

function deriveCuisines(cat, tipo) {
  const tags = new Set();
  for (const [re, tag] of CUISINE_MAP) if (re.test(cat)) tags.add(tag);
  if (tags.size === 0) {
    if (tipo === 'Cafetería') tags.add('Cafetería y dulces');
    else if (tipo === 'Bar') tags.add('Tapas');
    else tags.add('Internacional');
  }
  return [...tags];
}

const out = records.map(r => ({
  zona: r.zona,
  calle: r.calle,
  num: r.num,
  nombre: r.nombre,
  tipo: normTipo(r.tipo),
  categoria: r.categoria,
  cocinas: deriveCuisines(r.categoria, normTipo(r.tipo)),
  accesible: normAcc(r.acc),
  obs: r.obs,
}));

fs.writeFileSync('restaurantes.json', JSON.stringify(out, null, 2), 'utf8');

// Resumen
const byZona = {}, byTipo = {}, byAcc = {}, cuisines = {};
const streets = new Set();
for (const r of out) {
  byZona[r.zona] = (byZona[r.zona] || 0) + 1;
  byTipo[r.tipo] = (byTipo[r.tipo] || 0) + 1;
  byAcc[r.accesible] = (byAcc[r.accesible] || 0) + 1;
  r.cocinas.forEach(c => cuisines[c] = (cuisines[c] || 0) + 1);
  streets.add(r.zona + '||' + r.calle);
}
console.log('TOTAL locales:', out.length);
console.log('\nPor zona:', byZona);
console.log('\nPor tipo:', byTipo);
console.log('\nAccesibilidad:', byAcc);
console.log('\nCocinas:', Object.fromEntries(Object.entries(cuisines).sort((a,b)=>b[1]-a[1])));
console.log('\nCalles únicas (zona||calle):', streets.size);
fs.writeFileSync('_streets.json', JSON.stringify([...streets], null, 2));
