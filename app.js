/* Mesas de Marbella — mapa gastronómico del Casco Antiguo */
(function () {
  'use strict';

  const TIPO_COLOR = {
    'Restaurante': '#1E4E8C',
    'Bar': '#C4552B',
    'Cafetería': '#C08A2A',
    'Para llevar': '#6E7A55',
    'Otro': '#4A5568',
  };
  const TIPOS = ['Restaurante', 'Bar', 'Cafetería', 'Para llevar'];

  let DATA = [];
  const state = { q: '', tipo: '', cocina: '', zona: '', acc: '' };
  let map, cluster;
  const markers = {}; // id -> marker
  const cards = {};    // id -> card element

  const $ = s => document.querySelector(s);
  const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  function pinIcon(tipo, accesible) {
    const color = TIPO_COLOR[tipo] || TIPO_COLOR.Otro;
    const acc = accesible === 'si' ? ' acc' : '';
    return L.divIcon({
      className: 'pin-wrap',
      html: `<div class="pin${acc}" style="background:${color}"></div>`,
      iconSize: [26, 26], iconAnchor: [13, 26], popupAnchor: [0, -24],
    });
  }

  function accLabel(a) {
    if (a === 'si') return { cls: 'si', txt: 'Accesible', icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="4" r="1.6"/><path d="M6 8h12M12 8v6M8 21l4-7 4 7"/></svg>' };
    if (a === 'no') return { cls: 'no', txt: 'No accesible', icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="9"/><path d="M8 12h8"/></svg>' };
    return { cls: 'no', txt: 'Sin datos', icon: '' };
  }

  function addr(r) {
    let a = r.calle;
    if (r.num && !/^s\/?n$/i.test(r.num)) a += ', ' + r.num;
    return a;
  }

  function popupHTML(r) {
    const color = TIPO_COLOR[r.tipo] || TIPO_COLOR.Otro;
    const a = accLabel(r.accesible);
    const cuis = r.cocinas.map(c => `<span class="pcuis">${c}</span>`).join('');
    const obs = r.obs ? `<div class="pobs">${r.obs}</div>` : '';
    const query = encodeURIComponent(r.nombre + ', ' + addr(r) + ', Marbella');
    return `<div class="pop">
      <div class="pt">${r.nombre}</div>
      <div class="paddr">${addr(r)} · ${r.zona}</div>
      <div class="prow">
        <span class="ptag" style="background:${color}">${r.tipo}</span>${cuis}
      </div>
      <div class="pacc" style="color:${r.accesible === 'si' ? '#6E7A55' : '#B08A8A'}">${a.icon} ${a.txt}</div>
      ${obs}
      <a class="maps" href="https://www.google.com/maps/search/?api=1&query=${query}" target="_blank" rel="noopener">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>
        Ver en Google Maps
      </a>
    </div>`;
  }

  function cardHTML(r) {
    const color = TIPO_COLOR[r.tipo] || TIPO_COLOR.Otro;
    const a = accLabel(r.accesible);
    const cuis = r.cocinas.slice(0, 3).map(c => `<span>${c}</span>`).join('');
    const el = document.createElement('div');
    el.className = 'card';
    el.dataset.id = r.id;
    el.innerHTML = `
      <div class="tnum mono">${String(r.id).padStart(3, '0')}</div>
      <div class="name">${r.nombre}</div>
      <span class="tipo-tag" style="background:${color}">${r.tipo}</span>
      <div class="addr">${addr(r)} · ${r.zona}</div>
      <div class="cuis">${cuis}</div>
      <div class="acc ${a.cls}">${a.icon} ${r.accesible === 'si' ? 'Accesible' : r.accesible === 'no' ? 'No' : '—'}</div>`;
    return el;
  }

  function matches(r) {
    if (state.q && !norm(r.nombre).includes(norm(state.q))) return false;
    if (state.tipo && r.tipo !== state.tipo) return false;
    if (state.cocina && !r.cocinas.includes(state.cocina)) return false;
    if (state.zona && r.zona !== state.zona) return false;
    if (state.acc && r.accesible !== state.acc) return false;
    return true;
  }

  function render() {
    const list = $('#list');
    list.innerHTML = '';
    cluster.clearLayers();
    let n = 0;
    const layers = [];
    const frag = document.createDocumentFragment();

    DATA.forEach(r => {
      const ok = matches(r);
      const mk = markers[r.id];
      if (ok) {
        n++;
        layers.push(mk);
        const c = cards[r.id] || (cards[r.id] = cardHTML(r));
        frag.appendChild(c);
      }
    });
    cluster.addLayers(layers);
    if (n === 0) {
      list.innerHTML = '<div class="empty"><b>Sin resultados</b>Prueba a quitar algún filtro o cambiar la búsqueda.</div>';
    } else {
      list.appendChild(frag);
    }
    $('#c-num').textContent = n;
    $('#c-sub').textContent = 'de ' + DATA.length + ' en total';
  }

  function focus(id) {
    const r = DATA.find(x => x.id === id);
    if (!r) return;
    Object.values(cards).forEach(c => c.classList.remove('active'));
    if (cards[id]) {
      cards[id].classList.add('active');
      cards[id].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    const mk = markers[id];
    map.setView([r.lat, r.lng], Math.max(map.getZoom(), 17), { animate: true });
    cluster.zoomToShowLayer(mk, () => mk.openPopup());
  }

  function buildFilters() {
    // Tipo chips
    const tc = $('#tipoChips');
    const mkChip = (label, val, color) => {
      const b = document.createElement('button');
      b.className = 'chip'; b.setAttribute('aria-pressed', val === state.tipo);
      b.dataset.tipo = val;
      b.innerHTML = (color ? `<span class="dot" style="background:${color}"></span>` : '') + label;
      b.addEventListener('click', () => {
        state.tipo = state.tipo === val ? '' : val;
        [...tc.children].forEach(c => c.setAttribute('aria-pressed', c.dataset.tipo === state.tipo));
        render();
      });
      return b;
    };
    tc.appendChild(mkChip('Todos', '', null));
    TIPOS.forEach(t => tc.appendChild(mkChip(t, t, TIPO_COLOR[t])));
    tc.firstChild.setAttribute('aria-pressed', 'true');

    // Cocina select
    const counts = {};
    DATA.forEach(r => r.cocinas.forEach(c => counts[c] = (counts[c] || 0) + 1));
    const cocSel = $('#cocina');
    Object.entries(counts).sort((a, b) => b[1] - a[1]).forEach(([c, k]) => {
      const o = document.createElement('option'); o.value = c; o.textContent = `${c} (${k})`; cocSel.appendChild(o);
    });
    cocSel.addEventListener('change', () => { state.cocina = cocSel.value; render(); });

    // Zona select
    const zonas = [...new Set(DATA.map(r => r.zona))];
    const zoSel = $('#zona');
    zonas.forEach(z => { const o = document.createElement('option'); o.value = z; o.textContent = z; zoSel.appendChild(o); });
    zoSel.addEventListener('change', () => { state.zona = zoSel.value; render(); });

    // Accesibilidad
    const seg = $('#accSeg');
    seg.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      state.acc = b.dataset.acc;
      seg.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
      render();
    }));

    // Búsqueda
    $('#q').addEventListener('input', e => { state.q = e.target.value; render(); });

    // Reset
    $('#reset').addEventListener('click', () => {
      state.q = ''; state.tipo = ''; state.cocina = ''; state.zona = ''; state.acc = '';
      $('#q').value = ''; cocSel.value = ''; zoSel.value = '';
      [...tc.children].forEach((c, i) => c.setAttribute('aria-pressed', i === 0));
      seg.querySelectorAll('button').forEach((x, i) => x.setAttribute('aria-pressed', i === 0));
      render();
    });
  }

  function initMap() {
    map = L.map('map', { zoomControl: true, scrollWheelZoom: true }).setView([36.5095, -4.8855], 16);
    const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/';
    const callejero = L.tileLayer(ESRI + 'World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, OpenStreetMap', maxZoom: 19,
    }).addTo(map);
    const satelite = L.layerGroup([
      L.tileLayer(ESRI + 'World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Esri, Maxar, Earthstar Geographics', maxZoom: 19,
      }),
      L.tileLayer(ESRI + 'Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }),
      L.tileLayer(ESRI + 'Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }),
    ]);
    L.control.layers({ 'Callejero': callejero, 'Satélite': satelite }, null, { position: 'topright', collapsed: false }).addTo(map);

    cluster = L.markerClusterGroup({
      maxClusterRadius: 42, spiderfyOnMaxZoom: true, showCoverageOnHover: false,
      disableClusteringAtZoom: 18,
    });
    map.addLayer(cluster);

    DATA.forEach(r => {
      const mk = L.marker([r.lat, r.lng], { icon: pinIcon(r.tipo, r.accesible), title: r.nombre });
      mk.bindPopup(popupHTML(r), { maxWidth: 300, minWidth: 220 });
      mk.on('popupopen', () => { Object.values(cards).forEach(c => c.classList.remove('active')); if (cards[r.id]) cards[r.id].classList.add('active'); });
      markers[r.id] = mk;
    });
  }

  function initStats() {
    $('#s-total').textContent = DATA.length;
    $('#f-count').textContent = DATA.length;
    $('#s-acc').textContent = DATA.filter(r => r.accesible === 'si').length;
    $('#s-zonas').textContent = new Set(DATA.map(r => r.zona)).size;
  }

  function initMobile() {
    const panel = $('#panel'), btn = $('#mtoggle');
    let showingMap = false;
    btn.addEventListener('click', () => {
      showingMap = !showingMap;
      panel.classList.toggle('hide', showingMap);
      btn.textContent = showingMap ? 'Ver lista' : 'Ver mapa';
      if (showingMap) setTimeout(() => map.invalidateSize(), 60);
    });
  }

  document.addEventListener('click', e => {
    const card = e.target.closest('.card');
    if (card) focus(+card.dataset.id);
  });

  fetch('data.json')
    .then(r => r.json())
    .then(data => {
      DATA = data;
      initStats();
      initMap();
      buildFilters();
      render();
      initMobile();
    })
    .catch(err => {
      document.getElementById('list').innerHTML = '<div class="empty"><b>No se pudieron cargar los datos</b>' + err + '</div>';
    });
})();
