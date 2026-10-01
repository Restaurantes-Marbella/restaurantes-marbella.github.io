// Coordenadas del pin de Google Maps para cada local (nombre + dirección).
// Uso: node gmaps.js [desde] [hasta]   → escribe/actualiza _gmaps.json
const { chromium } = require('playwright-core');
const fs = require('fs');
const EXE = require('os').homedir() + '/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const data = JSON.parse(fs.readFileSync(process.env.ONE || 'data.json', 'utf8'));
const OUT = process.env.ONE ? process.env.TEMP + '/one-out.json' : '_gmaps.json';
const res = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
const BBOX = { minLat: 36.500, maxLat: 36.520, minLon: -4.900, maxLon: -4.868 };
const inBox = (a, o) => a >= BBOX.minLat && a <= BBOX.maxLat && o >= BBOX.minLon && o <= BBOX.maxLon;
const addr = r => r.calle + (r.num && !/^s\/?n$/i.test(r.num) ? ' ' + r.num : '');

(async () => {
  const [from = 0, to = data.length] = process.argv.slice(2).map(Number);
  const b = await chromium.launch({ executablePath: EXE });
  const ctx = await b.newContext({ locale: 'es-ES', viewport: { width: 1200, height: 800 } });
  const p = await ctx.newPage();
  // Aviso de cookies de Google: rechazar cuando aparezca
  async function consent() {
    if (!p.url().includes('consent.google')) return;
    await p.getByRole('button', { name: /Rechazar todo/i }).first().click();
    await p.waitForURL(/google\.com\/maps/, { timeout: 15000 }).catch(() => {});
    await p.waitForTimeout(2000);
  }

  for (const r of data.slice(from, to)) {
    if (res[r.id] && res[r.id].estado) continue;
    const q = `${r.nombre}, ${addr(r)}, Marbella`;
    let out = { q, estado: 'no_encontrado' };
    try {
      await p.goto('https://www.google.com/maps/search/' + encodeURIComponent(q) + '?hl=es', { waitUntil: 'domcontentloaded' });
      await consent();
      // Esperar a la ficha del local (URL /place/ con !3d!4d) o a una lista de resultados
      const listo = () => /!3d-?\d/.test(p.url());
      for (let t = 0; t < 24 && !listo() && !(await p.locator('a.hfpxzc').count()); t++) await p.waitForTimeout(500);
      if (!listo()) {
        const first = p.locator('a.hfpxzc').first();
        if (await first.count()) {
          await first.click();
          for (let t = 0; t < 20 && !listo(); t++) await p.waitForTimeout(500);
        }
      }
      const url = p.url();
      if (process.env.DEBUG) { console.log('URL', url); await p.screenshot({ path: process.env.TEMP + '/g-' + r.id + '.png' }); }
      const m = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
      const titulo = await p.locator('h1.DUwDvf').first().textContent({ timeout: 3000 }).catch(() => '');
      if (m) {
        const lat = +m[1], lng = +m[2];
        out = { q, titulo: (titulo || '').trim(), lat, lng, estado: inBox(lat, lng) ? 'ok' : 'fuera_de_zona', url };
      }
    } catch (e) { out.error = e.message.slice(0, 120); }
    res[r.id] = out;
    fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
    console.log(r.id, out.estado, '|', r.nombre, '→', out.titulo || '', out.lat || '', out.lng || '');
  }
  await b.close();
})();
