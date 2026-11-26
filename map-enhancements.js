/* Boraí — mapa próprio, com Leaflet + OpenStreetMap.
 * Carregamento sob demanda; sem interceptação global de fetch ou dependência de mapas externos.
 */
(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const CONFIG = {
    tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    photon: 'https://photon.komoot.io/api/',
    nominatim: 'https://nominatim.openstreetmap.org/search',
    overpass: 'https://overpass-api.de/api/interpreter',
    cityCache: 'borai-map-city-centers-v2',
    searchCache: 'borai-map-search-cache-v2',
    transitCache: 'borai-map-transit-cache-v2',
    nominatimLast: 'borai-nominatim-last-request-v2',
    overpassLast: 'borai-overpass-last-request-v2',
    searchTtl: 7 * 24 * 60 * 60 * 1000,
    transitTtl: 8 * 60 * 60 * 1000,
    overpassInterval: 35 * 1000,
    nominatimInterval: 1100
  };

  let map = null;
  let leafletPromise = null;
  let activationPromise = null;
  let cityMarker = null;
  let userMarker = null;
  let searchLayer = null;
  let transitLayer = null;
  let searchBusy = false;
  let transitBusy = false;
  let lastPhotonAt = 0;

  function readStore(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (_) { return fallback; }
  }

  function writeStore(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (_) { return false; }
  }

  function region() {
    if (window.BoraiApp && typeof window.BoraiApp.getRegion === 'function') return window.BoraiApp.getRegion();
    const city = readStore('borai-city', 'Mogi das Cruzes');
    const uf = readStore('borai-state', 'SP');
    return {
      city: typeof city === 'string' && city.trim() ? city.trim() : 'Mogi das Cruzes',
      state: typeof uf === 'string' && uf.trim() ? uf.trim().toUpperCase() : 'SP'
    };
  }

  function addStyles() {
    if ($('#borai-map-style')) return;
    const style = document.createElement('style');
    style.id = 'borai-map-style';
    style.textContent = `
      .borai-map-tools{padding:14px 16px 13px;background:#fffaf4;border-top:1px solid #f1e0cf;border-bottom:1px solid #f1e0cf}
      .borai-map-search{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px}
      .borai-map-search input{width:100%;min-width:0;min-height:46px;border:1px solid #e7c8a9;border-radius:12px;padding:0 13px;background:#fff;color:#352a21;font-size:14px;outline:none}
      .borai-map-search input:focus{border-color:#ef7800;box-shadow:0 0 0 3px #ef780021}
      .borai-map-search button,.borai-map-tool-button{min-height:44px;border:0;border-radius:12px;padding:0 14px;background:#ef7800;color:#fff;font-size:13px;font-weight:800;cursor:pointer}
      .borai-map-tool-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:9px}
      .borai-map-tool-button{background:#fff1e3;border:1px solid #edc49f;color:#994b0d}
      .borai-map-tool-button:disabled,.borai-map-search button:disabled{opacity:.55;cursor:wait}
      .map-canvas.borai-map-ready{height:clamp(340px,58vw,520px);min-height:340px;padding:0;overflow:hidden;background:#e9e4d8;touch-action:pan-x pan-y}
      #boraiLeafletMap{width:100%;height:100%;min-height:340px;background:#e9e4d8;z-index:1}
      .borai-map-status{padding:10px 15px;background:#fffaf4;color:#75685b;font-size:12px;line-height:1.5;border-top:1px solid #f1e0cf}
      .borai-map-status[data-kind="error"]{color:#9a3f20;background:#fff2eb}
      .borai-map-status[data-kind="success"]{color:#4c6b35}
      .borai-map-results{display:grid;gap:6px;padding:10px 13px;background:#fffaf4;max-height:230px;overflow:auto}
      .borai-map-results:empty{display:none}
      .borai-map-results-heading{margin:0 0 2px;color:#8c4b17;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.45px}
      .borai-map-result{display:flex;align-items:flex-start;gap:9px;width:100%;padding:9px 10px;border:1px solid #f0dfce;border-radius:11px;background:#fff;color:#392f27;text-align:left;cursor:pointer}
      .borai-map-result:active{background:#fff2e5}
      .borai-map-result-icon{width:28px;height:28px;flex:none;display:grid;place-items:center;border-radius:9px;background:#fff0df;color:#a44d0a;font-size:16px}
      .borai-map-result-copy{min-width:0;display:grid;gap:2px}
      .borai-map-result-copy strong{font-size:13px;line-height:1.3}
      .borai-map-result-copy span{color:#81766b;font-size:11px;line-height:1.35}
      .borai-transit-pin{background:transparent;border:0}
      .borai-transit-pin span{display:grid;place-items:center;width:29px;height:29px;border:2px solid #fff;border-radius:50% 50% 50% 7px;background:#e87500;color:#fff;font-size:15px;font-weight:900;box-shadow:0 2px 8px #3d271e52;transform:rotate(-45deg)}
      .borai-transit-pin span b{font-size:14px;font-weight:900;transform:rotate(45deg)}
      .borai-map-popup{min-width:150px;max-width:230px;color:#302820;font:13px/1.4 Arial,Helvetica,sans-serif}
      .borai-map-popup strong{display:block;margin-bottom:4px;color:#8f470d}
      .borai-map-popup p{margin:0 0 5px}
      .borai-map-popup a{color:#a64d00;font-weight:700}
      .borai-map-legend{display:flex;gap:12px;flex-wrap:wrap;padding:9px 14px;background:#fffaf4;color:#7c7166;font-size:11px;border-top:1px solid #f1e0cf}
      .borai-map-legend span{display:inline-flex;align-items:center;gap:5px}
      .borai-map-legend i{width:9px;height:9px;display:inline-block;border-radius:50%;background:#e87500}
      .borai-map-attribution-note{padding:7px 14px;color:#83776c;background:#fffaf4;font-size:10px;line-height:1.4}
      .borai-map-attribution-note a{color:#94500e}
      #boraiLeafletMap .leaflet-control-attribution{font-size:10px}
      #boraiLeafletMap .leaflet-popup-content-wrapper{border-radius:12px}
      #boraiLeafletMap .leaflet-popup-content{margin:11px 13px}
      @media(max-width:600px){.borai-map-tools{padding:12px}.map-canvas.borai-map-ready{height:56vh;min-height:330px}#boraiLeafletMap{min-height:330px}.borai-map-tool-button{flex:1 1 calc(50% - 8px);padding:0 9px;font-size:12px}.borai-map-search button{padding:0 12px}}
      @media(prefers-reduced-motion:reduce){.borai-map-result{transition:none}}
    `;
    document.head.append(style);
  }

  function setStatus(message, kind = 'info') {
    const status = $('#boraiMapStatus');
    if (!status) return;
    status.textContent = message;
    status.dataset.kind = kind;
  }

  function setBusy(button, busy, label) {
    if (!button) return;
    if (busy) {
      if (!button.dataset.originalLabel) button.dataset.originalLabel = button.textContent;
      button.textContent = label || 'Carregando…';
      button.disabled = true;
    } else {
      button.textContent = button.dataset.originalLabel || button.textContent;
      button.disabled = false;
      delete button.dataset.originalLabel;
    }
  }

  function buildInterface() {
    const view = $('#mapView');
    const card = $('.map-preview-card', view);
    const canvas = $('.map-canvas', card);
    if (!view || !card || !canvas) return false;
    if ($('#boraiLeafletMap', canvas)) return true;

    const current = region();
    const label = $('#mapCityLabel', card);
    if (label) label.textContent = `${current.city} - ${current.state}`;
    const tag = $('.map-preview-tag', card);
    if (tag) tag.innerHTML = '<i></i> Mapa interativo';

    const tools = document.createElement('div');
    tools.className = 'borai-map-tools';
    tools.innerHTML = `
      <form class="borai-map-search" id="boraiMapSearchForm" role="search">
        <label class="visually-hidden" for="boraiMapSearchInput">Pesquisar endereço, estação ou estabelecimento</label>
        <input id="boraiMapSearchInput" type="search" maxlength="120" placeholder="Pesquisar endereço, estação ou local…" autocomplete="off">
        <button type="submit" id="boraiMapSearchButton">Pesquisar</button>
      </form>
      <div class="borai-map-tool-row">
        <button type="button" class="borai-map-tool-button" id="boraiMapLocateButton">⌖ Minha localização</button>
        <button type="button" class="borai-map-tool-button" id="boraiMapCenterButton">◎ Centralizar cidade</button>
        <button type="button" class="borai-map-tool-button" id="boraiMapTransitButton">🚏 Pontos de transporte</button>
      </div>`;
    const results = document.createElement('div');
    results.className = 'borai-map-results'; results.id = 'boraiMapResults';
    results.setAttribute('aria-live', 'polite');
    canvas.classList.add('borai-map-ready');
    canvas.setAttribute('aria-label', 'Mapa geográfico interativo do Boraí');
    canvas.replaceChildren();
    const mapElement = document.createElement('div');
    mapElement.id = 'boraiLeafletMap'; mapElement.setAttribute('role', 'application');
    mapElement.setAttribute('aria-label', 'Mapa OpenStreetMap do Boraí');
    canvas.append(mapElement);
    const status = document.createElement('div');
    status.className = 'borai-map-status'; status.id = 'boraiMapStatus';
    status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    status.textContent = 'Carregue o mapa para visualizar a região selecionada.';
    const legend = document.createElement('div');
    legend.className = 'borai-map-legend';
    legend.innerHTML = '<span><i></i> Locais pesquisados</span><span>🚏 Pontos de transporte mapeados</span><span>🔵 Sua localização</span>';
    const note = document.createElement('div');
    note.className = 'borai-map-attribution-note';
    note.innerHTML = 'Mapa e dados cartográficos: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>. Os pontos de transporte são dados colaborativos e podem estar incompletos ou desatualizados; não representam horários ou veículos em tempo real.';
    const oldStatus = $('.map-status', card);
    card.insertBefore(tools, canvas);
    canvas.after(results, status, legend, note);
    if (oldStatus) oldStatus.remove();
    const demoNote = $('.map-view > .demo-note', view);
    if (demoNote) demoNote.textContent = 'O mapa usa dados do OpenStreetMap. A cobertura de endereços e pontos de transporte varia conforme a região.';
    return true;
  }

  function loadLeaflet() {
    if (window.L) return Promise.resolve(window.L);
    if (leafletPromise) return leafletPromise;
    leafletPromise = new Promise((resolve, reject) => {
      let css = $('link[data-borai-leaflet-css]');
      const cssReady = new Promise(done => {
        if (css && css.sheet) { done(); return; }
        if (!css) {
          css = document.createElement('link'); css.rel = 'stylesheet';
          css.href = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css';
          css.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
          css.crossOrigin = 'anonymous'; css.dataset.boraiLeafletCss = 'true';
          document.head.append(css);
        }
        const finish = () => done();
        css.addEventListener('load', finish, { once: true });
        css.addEventListener('error', finish, { once: true });
        window.setTimeout(finish, 5000);
      });
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';
      script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
      script.crossOrigin = 'anonymous'; script.async = true;
      script.onload = () => cssReady.then(() => window.L ? resolve(window.L) : reject(new Error('A biblioteca do mapa não ficou disponível.')));
      script.onerror = () => reject(new Error('Não foi possível carregar a biblioteca do mapa. Verifique a conexão e tente novamente.'));
      document.head.append(script);
    }).catch(error => { leafletPromise = null; throw error; });
    return leafletPromise;
  }

  async function fetchJson(url, options = {}, timeoutMs = 18000) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal, credentials: 'omit' });
      if (!response.ok) {
        const error = new Error(`O serviço cartográfico respondeu com erro HTTP ${response.status}.`);
        error.status = response.status; throw error;
      }
      return await response.json();
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('A consulta demorou demais. Tente novamente mais tarde.');
      throw error;
    } finally { window.clearTimeout(timeout); }
  }

  function cacheKeyForRegion(current) { return `${current.state}|${current.city}`.toLocaleLowerCase('pt-BR'); }

  async function geocodeCity() {
    const current = region();
    const key = cacheKeyForRegion(current);
    const cache = readStore(CONFIG.cityCache, {});
    const cached = cache[key];
    if (cached && Number.isFinite(cached.lat) && Number.isFinite(cached.lon)) return cached;

    const last = Number(readStore(CONFIG.nominatimLast, 0)) || 0;
    const waitMs = CONFIG.nominatimInterval - (Date.now() - last);
    if (waitMs > 0) await new Promise(resolve => window.setTimeout(resolve, waitMs));
    writeStore(CONFIG.nominatimLast, Date.now());

    const params = new URLSearchParams({
      q: `${current.city}, ${current.state}, Brasil`, format: 'geojson',
      countrycodes: 'br', limit: '5', addressdetails: '1', 'accept-language': 'pt-BR'
    });
    const data = await fetchJson(`${CONFIG.nominatim}?${params.toString()}`, {
      headers: { Accept: 'application/geo+json, application/json', 'Accept-Language': 'pt-BR' }
    }, 14000);
    const features = Array.isArray(data.features) ? data.features : [];
    const feature = features.find(item => {
      const address = item.properties && item.properties.address || {};
      return !address.country_code || String(address.country_code).toLowerCase() === 'br';
    });
    const coordinates = feature && feature.geometry && feature.geometry.coordinates;
    if (!feature || !Array.isArray(coordinates) || coordinates.length < 2) {
      throw new Error(`Não encontrei ${current.city} (${current.state}) na base cartográfica. Use a pesquisa manual do mapa.`);
    }
    const center = { lon: Number(coordinates[0]), lat: Number(coordinates[1]), label: current.city };
    if (!Number.isFinite(center.lat) || !Number.isFinite(center.lon)) throw new Error('A busca retornou coordenadas inválidas.');
    cache[key] = center;
    const keys = Object.keys(cache);
    while (keys.length > 50) delete cache[keys.shift()];
    writeStore(CONFIG.cityCache, cache);
    return center;
  }

  function initMap(L) {
    if (map) return map;
    const element = $('#boraiLeafletMap');
    if (!element) throw new Error('A área do mapa não foi encontrada.');
    map = L.map(element, { zoomControl: true, scrollWheelZoom: true, preferCanvas: true }).setView([-14.235, -51.925], 4);
    L.tileLayer(CONFIG.tileUrl, {
      minZoom: 3, maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>'
    }).addTo(map);
    searchLayer = L.layerGroup().addTo(map);
    transitLayer = L.layerGroup().addTo(map);
    window.requestAnimationFrame(() => map && map.invalidateSize({ pan: false }));
    return map;
  }

  function popupContent(title, description, osmUrl) {
    const root = document.createElement('div'); root.className = 'borai-map-popup';
    const heading = document.createElement('strong'); heading.textContent = title || 'Local mapeado';
    const paragraph = document.createElement('p'); paragraph.textContent = description || 'Local identificado a partir de dados colaborativos do OpenStreetMap.';
    root.append(heading, paragraph);
    if (osmUrl) {
      const link = document.createElement('a'); link.href = osmUrl; link.target = '_blank';
      link.rel = 'noopener noreferrer'; link.textContent = 'Ver no OpenStreetMap ↗'; root.append(link);
    }
    return root;
  }

  function osmObjectUrl(properties) {
    if (!properties || !properties.osm_id || !properties.osm_type) return '';
    const types = { N: 'node', W: 'way', R: 'relation', node: 'node', way: 'way', relation: 'relation' };
    const type = types[properties.osm_type];
    return type ? `https://www.openstreetmap.org/${type}/${encodeURIComponent(properties.osm_id)}` : '';
  }

  function addressText(properties) {
    return [properties.street, properties.housenumber, properties.district || properties.suburb,
      properties.city || properties.locality, properties.state].filter(Boolean).map(item => String(item).trim()).join(', ')
      || [properties.type, properties.country].filter(Boolean).join(' · ');
  }

  function clearResults() { $('#boraiMapResults')?.replaceChildren(); }
  function addResultHeading(text) {
    const box = $('#boraiMapResults'); if (!box) return;
    const heading = document.createElement('p'); heading.className = 'borai-map-results-heading'; heading.textContent = text; box.append(heading);
  }

  function renderPlaceResults(features) {
    clearResults(); searchLayer.clearLayers();
    if (!features.length) { setStatus('Nenhum resultado encontrado. Tente incluir bairro, cidade ou estado.', 'info'); return; }
    const L = window.L; const box = $('#boraiMapResults'); const results = [];
    addResultHeading(`${features.length} resultado(s) da pesquisa`);
    features.slice(0, 8).forEach((feature, index) => {
      const coords = feature.geometry && feature.geometry.coordinates;
      if (!Array.isArray(coords) || coords.length < 2) return;
      const lon = Number(coords[0]); const lat = Number(coords[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
      const props = feature.properties || {};
      const title = props.name || props.street || `Local ${index + 1}`;
      const address = addressText(props);
      const marker = L.marker([lat, lon]).bindPopup(popupContent(title, address, osmObjectUrl(props))).addTo(searchLayer);
      const item = { lat, lon, marker }; results.push(item);
      const button = document.createElement('button'); button.type = 'button'; button.className = 'borai-map-result';
      const icon = document.createElement('span'); icon.className = 'borai-map-result-icon'; icon.textContent = '⌖';
      const copy = document.createElement('span'); copy.className = 'borai-map-result-copy';
      const name = document.createElement('strong'); name.textContent = title;
      const details = document.createElement('span'); details.textContent = address || 'Endereço não informado';
      copy.append(name, details); button.append(icon, copy);
      button.addEventListener('click', () => { map.setView([item.lat, item.lon], Math.max(map.getZoom(), 16)); item.marker.openPopup(); });
      box.append(button);
    });
    if (!results.length) { clearResults(); setStatus('Os resultados não trouxeram coordenadas utilizáveis. Tente uma pesquisa mais específica.', 'info'); return; }
    if (results.length === 1) map.setView([results[0].lat, results[0].lon], 16);
    else map.fitBounds(searchLayer.getBounds().pad(0.18), { maxZoom: 16 });
    setStatus('Locais encontrados com dados do OpenStreetMap. A disponibilidade depende do mapeamento da região.', 'success');
  }

  function searchCacheRead(query, current) {
    const cache = readStore(CONFIG.searchCache, {});
    const key = `${current.state}|${current.city}|${query.toLocaleLowerCase('pt-BR')}`;
    const record = cache[key];
    return record && Date.now() - record.savedAt < CONFIG.searchTtl ? record.features : null;
  }

  function searchCacheWrite(query, current, features) {
    const cache = readStore(CONFIG.searchCache, {});
    const key = `${current.state}|${current.city}|${query.toLocaleLowerCase('pt-BR')}`;
    cache[key] = { savedAt: Date.now(), features };
    const keys = Object.keys(cache); while (keys.length > 24) delete cache[keys.shift()];
    writeStore(CONFIG.searchCache, cache);
  }

  async function searchPlaces(queryOverride) {
    if (searchBusy) return;
    if (!map) await activate();
    if (!map) return;
    const input = $('#boraiMapSearchInput'); const button = $('#boraiMapSearchButton');
    const query = String(queryOverride || (input && input.value) || '').trim();
    if (input && queryOverride) input.value = queryOverride;
    if (query.length < 2) { setStatus('Digite pelo menos duas letras para pesquisar um local.'); input?.focus(); return; }
    const current = region();
    const cached = searchCacheRead(query, current);
    if (cached) { renderPlaceResults(cached); return; }
    if (Date.now() - lastPhotonAt < 900) { setStatus('Aguarde um instante antes de fazer outra pesquisa.'); return; }
    lastPhotonAt = Date.now(); searchBusy = true; setBusy(button, true, 'Buscando…');
    setStatus('Pesquisando locais no OpenStreetMap…');
    try {
      const params = new URLSearchParams({ q: `${query}, ${current.city}, ${current.state}, Brasil`, limit: '8', lang: 'pt', countrycode: 'BR' });
      if (map) { const center = map.getCenter(); params.set('lat', String(center.lat)); params.set('lon', String(center.lng)); params.set('zoom', String(Math.max(10, map.getZoom()))); }
      const data = await fetchJson(`${CONFIG.photon}?${params.toString()}`, { headers: { Accept: 'application/geo+json, application/json' } }, 14000);
      const features = Array.isArray(data.features) ? data.features.slice(0, 8) : [];
      searchCacheWrite(query, current, features); renderPlaceResults(features);
    } catch (error) {
      setStatus(`${error.message || 'Não foi possível pesquisar agora.'} Verifique a conexão e tente novamente.`, 'error');
    } finally { searchBusy = false; setBusy(button, false); }
  }

  function transportCategory(tags) {
    if (tags.amenity === 'bus_station' || tags.public_transport === 'station') return { label: 'Terminal ou estação de transporte', icon: '▣' };
    if (tags.railway === 'station' || tags.railway === 'halt' || tags.railway === 'tram_stop') return { label: 'Estação ferroviária ou de trilhos', icon: '🚉' };
    if (tags.railway === 'subway_entrance') return { label: 'Acesso ao metrô', icon: '🚇' };
    if (tags.highway === 'bus_stop') return { label: 'Parada de ônibus', icon: '🚏' };
    if (tags.public_transport === 'platform' || tags.public_transport === 'stop_position') return { label: 'Ponto de parada mapeado', icon: '🚏' };
    return { label: 'Ponto de transporte público', icon: '🚏' };
  }

  function elementCoordinates(element) {
    if (Number.isFinite(element.lat) && Number.isFinite(element.lon)) return { lat: element.lat, lon: element.lon };
    if (element.center && Number.isFinite(element.center.lat) && Number.isFinite(element.center.lon)) return { lat: element.center.lat, lon: element.center.lon };
    return null;
  }

  function transitCacheKey(center, current) {
    return `${current.state}|${current.city}|${center.lat.toFixed(2)}|${center.lng.toFixed(2)}`;
  }

  function buildOverpassQuery(center) {
    const lat = Number(center.lat.toFixed(6)); const lon = Number(center.lng.toFixed(6));
    return `[out:json][timeout:18];\n(\n  node(around:1100,${lat},${lon})["highway"="bus_stop"];\n  node(around:1100,${lat},${lon})["public_transport"~"platform|station|stop_position"];\n  node(around:1100,${lat},${lon})["railway"~"station|halt|tram_stop|subway_entrance"];\n  node(around:1100,${lat},${lon})["amenity"="bus_station"];\n  way(around:1100,${lat},${lon})["public_transport"="station"];\n  way(around:1100,${lat},${lon})["railway"~"station|halt|tram_stop"];\n  way(around:1100,${lat},${lon})["amenity"="bus_station"];\n);\nout center;`;
  }

  function renderTransitResults(elements, fromCache = false) {
    transitLayer.clearLayers(); clearResults();
    const list = elements.slice(0, 80);
    if (!list.length) { setStatus('A consulta terminou, mas não foram encontrados pontos de transporte mapeados nesta área. Isso não significa que não existam serviços locais.', 'info'); return; }
    const L = window.L; const box = $('#boraiMapResults'); let added = 0;
    addResultHeading(`${list.length} ponto(s) de transporte mapeado(s)`);
    list.forEach((element, index) => {
      const position = elementCoordinates(element); if (!position) return;
      const tags = element.tags || {}; const category = transportCategory(tags);
      const title = tags.name || category.label;
      const details = [category.label, tags.operator, tags.network, tags.ref ? `Referência: ${tags.ref}` : ''].filter(Boolean).join(' · ');
      const type = { node: 'node', way: 'way', relation: 'relation' }[element.type];
      const url = type ? `https://www.openstreetmap.org/${type}/${encodeURIComponent(element.id)}` : '';
      const icon = L.divIcon({ className: 'borai-transit-pin', html: `<span><b>${category.icon}</b></span>`, iconSize: [29, 29], iconAnchor: [14, 28] });
      const marker = L.marker([position.lat, position.lon], { icon }).bindPopup(popupContent(title, details, url)).addTo(transitLayer);
      const button = document.createElement('button'); button.type = 'button'; button.className = 'borai-map-result';
      const iconNode = document.createElement('span'); iconNode.className = 'borai-map-result-icon'; iconNode.textContent = category.icon;
      const copy = document.createElement('span'); copy.className = 'borai-map-result-copy';
      const name = document.createElement('strong'); name.textContent = title || `Ponto de transporte ${index + 1}`;
      const desc = document.createElement('span'); desc.textContent = details;
      copy.append(name, desc); button.append(iconNode, copy);
      button.addEventListener('click', () => { map.setView([position.lat, position.lon], Math.max(map.getZoom(), 16)); marker.openPopup(); });
      box.append(button); added += 1;
    });
    if (!added) { clearResults(); setStatus('A consulta não retornou coordenadas que possam ser exibidas no mapa.', 'info'); return; }
    if (added > 1) map.fitBounds(transitLayer.getBounds().pad(0.15), { maxZoom: 16 });
    else map.setView(transitLayer.getLayers()[0].getLatLng(), 16);
    setStatus(`${added} ponto(s) encontrados em dados colaborativos do OpenStreetMap${fromCache ? ' (resultado em cache)' : ''}. A cobertura varia e não há horários nem posição de veículos em tempo real.`, 'success');
  }

  async function loadTransitPoints() {
    if (transitBusy || !map) return;
    const button = $('#boraiMapTransitButton');
    if (map.getZoom() < 8) await centerOnCity();
    if (map.getZoom() < 8) {
      setStatus('Não foi possível localizar o município para consultar pontos próximos. Pesquise um endereço ou tente centralizar a cidade novamente.', 'error');
      return;
    }
    const center = map.getCenter(); const current = region(); const key = transitCacheKey(center, current);
    const cache = readStore(CONFIG.transitCache, {}); const cached = cache[key];
    if (cached && Date.now() - cached.savedAt < CONFIG.transitTtl && Array.isArray(cached.elements)) {
      renderTransitResults(cached.elements, true); return;
    }
    const last = Number(readStore(CONFIG.overpassLast, 0)) || 0;
    if (Date.now() - last < CONFIG.overpassInterval) {
      const remaining = Math.ceil((CONFIG.overpassInterval - (Date.now() - last)) / 1000);
      setStatus(`Para respeitar os limites do serviço comunitário, aguarde ${remaining}s antes de consultar novamente.`); return;
    }
    transitBusy = true; setBusy(button, true, 'Consultando…');
    setStatus('Consultando pontos de ônibus, estações e terminais mapeados nas proximidades…');
    writeStore(CONFIG.overpassLast, Date.now());
    try {
      const body = new URLSearchParams({ data: buildOverpassQuery(center) });
      const data = await fetchJson(CONFIG.overpass, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', Accept: 'application/json' },
        body: body.toString()
      }, 24000);
      const elements = Array.isArray(data.elements) ? data.elements : [];
      cache[key] = { savedAt: Date.now(), elements };
      const keys = Object.keys(cache); while (keys.length > 12) delete cache[keys.shift()];
      writeStore(CONFIG.transitCache, cache); renderTransitResults(elements);
    } catch (error) {
      let message = error.message || 'Não foi possível consultar os pontos de transporte.';
      if (error.status === 400) message = 'O serviço de dados comunitários recusou a consulta. Tente novamente mais tarde.';
      else if ([429, 502, 503, 504].includes(error.status)) message += ' O serviço público pode estar sobrecarregado. Aguarde antes de tentar novamente.';
      else message += ' Confira sua conexão.';
      setStatus(message, 'error');
    } finally { transitBusy = false; setBusy(button, false); }
  }

  async function centerOnCity() {
    if (!map) return;
    const current = region(); const button = $('#boraiMapCenterButton');
    setBusy(button, true, 'Localizando…'); setStatus(`Localizando ${current.city} (${current.state})…`);
    try {
      const center = await geocodeCity();
      map.setView([center.lat, center.lon], 14, { animate: true });
      if (cityMarker) cityMarker.remove();
      cityMarker = window.L.marker([center.lat, center.lon]).addTo(map)
        .bindPopup(popupContent(`${current.city} - ${current.state}`, 'Área aproximada do município selecionado. O marcador não representa um endereço específico.'));
      setStatus(`Mapa centralizado em ${current.city} (${current.state}). Use a pesquisa para localizar endereços e estabelecimentos.`, 'success');
    } catch (error) {
      setStatus(`${error.message || 'Não foi possível localizar automaticamente o município.'} Você ainda pode pesquisar um endereço manualmente.`, 'error');
    } finally { setBusy(button, false); }
  }

  function locateUser() {
    const button = $('#boraiMapLocateButton');
    if (!navigator.geolocation) { setStatus('Este navegador não oferece geolocalização. Pesquise um endereço manualmente.', 'error'); return; }
    setBusy(button, true, 'Solicitando…'); setStatus('Aguardando autorização de localização do navegador…');
    navigator.geolocation.getCurrentPosition(position => {
      const lat = position.coords.latitude; const lon = position.coords.longitude;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) { setStatus('O navegador retornou uma localização inválida.', 'error'); setBusy(button, false); return; }
      if (userMarker) userMarker.remove();
      const icon = window.L.divIcon({ className: 'borai-transit-pin', html: '<span style="background:#2879cf"><b>●</b></span>', iconSize: [29, 29], iconAnchor: [14, 28] });
      userMarker = window.L.marker([lat, lon], { icon }).addTo(map)
        .bindPopup(popupContent('Sua localização', 'Posição informada pelo navegador neste aparelho.'));
      map.setView([lat, lon], 16, { animate: true }); userMarker.openPopup();
      setStatus('Sua localização foi exibida no mapa. O navegador controla a autorização e a precisão.', 'success'); setBusy(button, false);
    }, error => {
      const messages = {
        1: 'Permissão de localização negada. Autorize o acesso nas configurações do navegador.',
        2: 'Não foi possível determinar sua localização. Verifique o GPS ou a conexão.',
        3: 'A localização demorou demais. Tente novamente.'
      };
      setStatus(messages[error.code] || 'Não foi possível obter sua localização.', 'error'); setBusy(button, false);
    }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 120000 });
  }

  async function activate() {
    if (!buildInterface()) return;
    if (map) { window.requestAnimationFrame(() => map && map.invalidateSize({ pan: false })); return; }
    if (activationPromise) return activationPromise;
    activationPromise = (async () => {
      addStyles(); setStatus('Carregando o mapa…');
      try {
        const L = await loadLeaflet(); initMap(L); await centerOnCity();
        window.requestAnimationFrame(() => map && map.invalidateSize({ pan: false }));
      } catch (error) {
        setStatus(`${error.message || 'Não foi possível iniciar o mapa.'} Verifique a conexão e tente novamente.`, 'error');
        const element = $('#boraiLeafletMap');
        if (element) {
          const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'primary-button';
          retry.textContent = 'Tentar carregar novamente'; retry.addEventListener('click', () => { activationPromise = null; leafletPromise = null; activate(); });
          element.replaceChildren(retry);
        }
      } finally { activationPromise = null; }
    })();
    return activationPromise;
  }

  async function search(query) {
    await activate();
    if (!map) return;
    const input = $('#boraiMapSearchInput'); if (input) input.value = String(query || '');
    await searchPlaces(String(query || ''));
  }

  async function regionChanged() {
    const label = $('#mapCityLabel'); const current = region();
    if (label) label.textContent = `${current.city} - ${current.state}`;
    if (map) { cityMarker?.remove(); cityMarker = null; searchLayer.clearLayers(); transitLayer.clearLayers(); clearResults(); await centerOnCity(); }
  }

  function bindEvents() {
    $('#boraiMapSearchForm')?.addEventListener('submit', event => { event.preventDefault(); searchPlaces(); });
    $('#boraiMapCenterButton')?.addEventListener('click', () => map ? centerOnCity() : activate());
    $('#boraiMapLocateButton')?.addEventListener('click', () => map ? locateUser() : activate().then(() => map && locateUser()));
    $('#boraiMapTransitButton')?.addEventListener('click', () => map ? loadTransitPoints() : activate().then(() => map && loadTransitPoints()));
    window.addEventListener('resize', () => { if (map) window.requestAnimationFrame(() => map && map.invalidateSize({ pan: false })); }, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && map && $('#mapView') && !$('#mapView').hidden) window.requestAnimationFrame(() => map && map.invalidateSize({ pan: false }));
    });
  }

  function start() {
    if (!$('#mapView') || !buildInterface()) return;
    addStyles(); bindEvents();
    window.BoraiMap = { activate, search, regionChanged };
    window.dispatchEvent(new Event('borai-map-ready'));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
