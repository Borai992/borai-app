/* Boraí — Mapa interativo (Leaflet + OpenStreetMap)
 * Integra-se à aba #mapView criada por app.js e lê a região salva por enhancements.js.
 * Não contém chaves/API secrets. Serviços públicos são consultados somente por ação do usuário.
 */
(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const MAP_CACHE_KEY = 'borai-map-city-centers-v1';
  const SEARCH_CACHE_KEY = 'borai-map-search-cache-v1';
  const TRANSIT_CACHE_KEY = 'borai-map-transit-cache-v1';
  const OVERPASS_LAST_KEY = 'borai-map-overpass-last-request';
  const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';
  const PHOTON_ENDPOINT = 'https://photon.komoot.io/api/';
  const TRANSIT_CACHE_TTL = 8 * 60 * 60 * 1000;
  const SEARCH_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
  const OVERPASS_MIN_INTERVAL = 30 * 1000;
  const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

  let map = null;
  let leafletPromise = null;
  let cityMarker = null;
  let userMarker = null;
  let searchLayer = null;
  let transitLayer = null;
  let cityCenter = null;
  let activeSearchResults = [];
  let activeTransitResults = [];
  let lastPhotonRequestAt = 0;
  let isLoadingTransit = false;

  function readStore(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function writeStore(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_) {
      return false;
    }
  }

  function getRegion() {
    const city = readStore('borai-city', 'Mogi das Cruzes');
    const state = readStore('borai-state', 'SP');
    return {
      city: typeof city === 'string' && city.trim() ? city.trim() : 'Mogi das Cruzes',
      state: typeof state === 'string' && state.trim() ? state.trim().toUpperCase() : 'SP'
    };
  }

  function addStyles() {
    if ($('#borai-map-enhancements-style')) return;
    const style = document.createElement('style');
    style.id = 'borai-map-enhancements-style';
    style.textContent = `
      .map-preview-tag.borai-map-live-tag{color:#a34c08}
      .borai-map-tools{padding:14px 16px 13px;background:#fffaf4;border-top:1px solid #f1e0cf;border-bottom:1px solid #f1e0cf}
      .borai-map-search{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px}
      .borai-map-search input{width:100%;min-width:0;min-height:46px;border:1px solid #e7c8a9;border-radius:12px;padding:0 13px;background:#fff;color:#352a21;font-size:14px;outline:none}
      .borai-map-search input:focus{border-color:#ef7800;box-shadow:0 0 0 3px rgba(239,120,0,.13)}
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
      .borai-transit-pin span{display:grid;place-items:center;width:29px;height:29px;border:2px solid #fff;border-radius:50% 50% 50% 7px;background:#e87500;color:#fff;font-size:15px;font-weight:900;box-shadow:0 2px 8px rgba(61,39,20,.32);transform:rotate(-45deg)}
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
      @media(max-width:600px){
        .borai-map-tools{padding:12px}
        .map-canvas.borai-map-ready{height:56vh;min-height:330px}
        #boraiLeafletMap{min-height:330px}
        .borai-map-search{grid-template-columns:minmax(0,1fr) auto}
        .borai-map-search button{padding:0 12px}
        .borai-map-tool-button{flex:1 1 calc(50% - 8px);padding:0 9px;font-size:12px}
      }
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

  function setButtonBusy(button, busy, busyLabel) {
    if (!button) return;
    if (busy) {
      button.dataset.previousLabel = button.textContent;
      button.textContent = busyLabel || 'Carregando…';
      button.disabled = true;
    } else {
      button.textContent = button.dataset.previousLabel || button.textContent;
      button.disabled = false;
      delete button.dataset.previousLabel;
    }
  }

  function buildInterface() {
    const view = $('#mapView');
    const card = $('.map-preview-card', view);
    const canvas = $('.map-canvas', card);
    if (!view || !card || !canvas) return false;
    if ($('#boraiLeafletMap')) return true;

    const region = getRegion();
    const label = $('#mapCityLabel', card);
    if (label) label.textContent = `${region.city} - ${region.state}`;
    const tag = $('.map-preview-tag', card);
    if (tag) {
      tag.classList.add('borai-map-live-tag');
      tag.innerHTML = '<i></i> Mapa interativo';
    }

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
        <button type="button" class="borai-map-tool-button" id="boraiMapTransitButton">▣ Pontos de transporte</button>
      </div>
    `;
    const results = document.createElement('div');
    results.className = 'borai-map-results';
    results.id = 'boraiMapResults';
    results.setAttribute('aria-live', 'polite');

    canvas.classList.add('borai-map-ready');
    canvas.removeAttribute('role');
    canvas.setAttribute('aria-label', 'Mapa geográfico interativo. Use dois dedos para ampliar no celular ou os controles de zoom.');
    canvas.replaceChildren();
    const mapElement = document.createElement('div');
    mapElement.id = 'boraiLeafletMap';
    mapElement.setAttribute('role', 'application');
    mapElement.setAttribute('aria-label', 'Mapa OpenStreetMap do Boraí');
    canvas.append(mapElement);

    const status = document.createElement('div');
    status.className = 'borai-map-status';
    status.id = 'boraiMapStatus';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.textContent = 'Abra o mapa para carregar a visualização da cidade selecionada.';

    const legend = document.createElement('div');
    legend.className = 'borai-map-legend';
    legend.innerHTML = '<span><i></i> Locais pesquisados</span><span>🚏 Pontos de transporte mapeados</span><span>🔵 Sua localização</span>';

    const note = document.createElement('div');
    note.className = 'borai-map-attribution-note';
    note.innerHTML = 'Mapa e dados cartográficos: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>. Pontos de transporte são dados colaborativos e podem estar incompletos ou desatualizados; não representam horários, operação ou posição de veículos em tempo real.';

    const oldStatus = $('.map-status', card);
    card.insertBefore(tools, canvas);
    canvas.after(results, status, legend, note);
    if (oldStatus) oldStatus.remove();

    const routeButton = $('#mapRouteButton', view);
    if (routeButton) routeButton.textContent = 'Planejar rota de transporte ↗';
    const transportButton = $('#mapTransportButton', view);
    if (transportButton) transportButton.textContent = 'Pesquisar transporte no Google Maps ↗';
    const demoNote = $('.map-view > .demo-note', view);
    if (demoNote) demoNote.textContent = 'O mapa mostra ruas e locais mapeados no OpenStreetMap. A consulta de transporte público depende da cobertura colaborativa da região.';
    return true;
  }

  function loadLeaflet() {
    if (window.L) return Promise.resolve(window.L);
    if (leafletPromise) return leafletPromise;

    leafletPromise = new Promise((resolve, reject) => {
      let css = $('link[data-borai-leaflet-css]');
      let cssReady;
      if (!css) {
        css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css';
        css.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
        css.crossOrigin = 'anonymous';
        css.dataset.boraiLeafletCss = 'true';
        cssReady = new Promise(done => {
          css.onload = done;
          css.onerror = done;
          window.setTimeout(done, 5000);
        });
        document.head.append(css);
      } else if (css.sheet) {
        cssReady = Promise.resolve();
      } else {
        cssReady = new Promise(done => {
          css.addEventListener('load', done, { once: true });
          css.addEventListener('error', done, { once: true });
          window.setTimeout(done, 5000);
        });
      }
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';
      script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
      script.crossOrigin = 'anonymous';
      script.async = true;
      script.onload = () => cssReady.then(() => window.L ? resolve(window.L) : reject(new Error('A biblioteca do mapa não ficou disponível.')));
      script.onerror = () => reject(new Error('Não foi possível carregar o Leaflet. Verifique sua conexão e tente abrir a aba Mapa novamente.'));
      document.head.append(script);
    });
    return leafletPromise;
  }

  async function fetchJson(url, options = {}, timeoutMs = 18000) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      if (!response.ok) {
        const error = new Error(`O serviço externo respondeu com erro HTTP ${response.status}.`);
        error.status = response.status;
        throw error;
      }
      return await response.json();
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('A consulta demorou demais. Tente novamente mais tarde.');
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function cityCacheKey(region) {
    return `${region.city.toLocaleLowerCase('pt-BR')}|${region.state}`;
  }

  async function geocodeCity(region) {
    const key = cityCacheKey(region);
    const cache = readStore(MAP_CACHE_KEY, {});
    const stored = cache[key];
    if (stored && Number.isFinite(stored.lat) && Number.isFinite(stored.lon)) return stored;

    const params = new URLSearchParams({
      q: `${region.city}, ${region.state}, Brasil`,
      limit: '1',
      lang: 'pt',
      countrycode: 'br'
    });
    const data = await fetchJson(`${PHOTON_ENDPOINT}?${params.toString()}`, { headers: { Accept: 'application/geo+json, application/json' } }, 12000);
    const feature = data && Array.isArray(data.features) ? data.features[0] : null;
    if (!feature || !feature.geometry || !Array.isArray(feature.geometry.coordinates)) {
      throw new Error(`Não encontrei automaticamente ${region.city} (${region.state}). Use a pesquisa do mapa ou sua localização.`);
    }
    const [lon, lat] = feature.geometry.coordinates;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error('O serviço de busca retornou coordenadas inválidas.');
    const props = feature.properties || {};
    if (props.country && !/brasil|brazil/i.test(props.country)) {
      throw new Error('A busca não confirmou que o resultado pertence ao Brasil. Pesquise o município manualmente.');
    }
    const center = { lat, lon, label: props.name || region.city };
    cache[key] = center;
    const keys = Object.keys(cache);
    while (keys.length > 80) delete cache[keys.shift()];
    writeStore(MAP_CACHE_KEY, cache);
    return center;
  }

  function initLeafletMap(L) {
    if (map) return map;
    const element = $('#boraiLeafletMap');
    if (!element) throw new Error('A área do mapa não foi encontrada.');

    element.replaceChildren();
    map = L.map(element, {
      zoomControl: true,
      scrollWheelZoom: true,
      tap: true,
      preferCanvas: true
    }).setView([-14.235, -51.925], 4);

    L.tileLayer(TILE_URL, {
      minZoom: 3,
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>',
      crossOrigin: true
    }).addTo(map);

    searchLayer = L.layerGroup().addTo(map);
    transitLayer = L.layerGroup().addTo(map);
    map.on('click', () => {});

    window.setTimeout(() => map && map.invalidateSize({ pan: false }), 160);
    return map;
  }

  function popupContent(title, description, osmUrl) {
    const root = document.createElement('div');
    root.className = 'borai-map-popup';
    const heading = document.createElement('strong');
    heading.textContent = title || 'Local mapeado';
    const paragraph = document.createElement('p');
    paragraph.textContent = description || 'Local identificado a partir de dados colaborativos do OpenStreetMap.';
    root.append(heading, paragraph);
    if (osmUrl) {
      const link = document.createElement('a');
      link.href = osmUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Ver no OpenStreetMap ↗';
      root.append(link);
    }
    return root;
  }

  function osmObjectUrl(properties) {
    if (!properties || !properties.osm_id || !properties.osm_type) return '';
    const typeMap = { N: 'node', W: 'way', R: 'relation', node: 'node', way: 'way', relation: 'relation' };
    const type = typeMap[properties.osm_type];
    return type ? `https://www.openstreetmap.org/${type}/${encodeURIComponent(properties.osm_id)}` : '';
  }

  function displayAddress(properties) {
    const parts = [properties.street, properties.housenumber, properties.district || properties.suburb, properties.city || properties.locality, properties.state]
      .filter(Boolean).map(value => String(value).trim()).filter(Boolean);
    return parts.length ? parts.join(', ') : [properties.type, properties.country].filter(Boolean).join(' · ');
  }

  function clearResults() {
    const resultBox = $('#boraiMapResults');
    if (resultBox) resultBox.replaceChildren();
  }

  function addResultHeading(label) {
    const resultBox = $('#boraiMapResults');
    if (!resultBox) return;
    const heading = document.createElement('p');
    heading.className = 'borai-map-results-heading';
    heading.textContent = label;
    resultBox.append(heading);
  }

  function renderPlaceResults(features) {
    clearResults();
    searchLayer.clearLayers();
    activeSearchResults = [];
    if (!features.length) {
      setStatus('Nenhum resultado encontrado para essa pesquisa. Tente incluir bairro, cidade ou estado.', 'info');
      return;
    }
    addResultHeading(`${features.length} resultado(s) da pesquisa`);
    const L = window.L;
    features.forEach((feature, index) => {
      const coordinates = feature.geometry && feature.geometry.coordinates;
      if (!Array.isArray(coordinates) || coordinates.length < 2) return;
      const lon = Number(coordinates[0]);
      const lat = Number(coordinates[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
      const properties = feature.properties || {};
      const title = properties.name || properties.street || `Local ${index + 1}`;
      const address = displayAddress(properties);
      const marker = L.marker([lat, lon]).bindPopup(popupContent(title, address, osmObjectUrl(properties)));
      marker.addTo(searchLayer);
      const item = { lat, lon, title, address, marker };
      activeSearchResults.push(item);

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'borai-map-result';
      const icon = document.createElement('span');
      icon.className = 'borai-map-result-icon';
      icon.textContent = '⌖';
      const copy = document.createElement('span');
      copy.className = 'borai-map-result-copy';
      const name = document.createElement('strong');
      name.textContent = title;
      const details = document.createElement('span');
      details.textContent = address || 'Endereço não informado';
      copy.append(name, details);
      button.append(icon, copy);
      button.addEventListener('click', () => {
        map.setView([item.lat, item.lon], Math.max(map.getZoom(), 16));
        item.marker.openPopup();
      });
      $('#boraiMapResults').append(button);
    });
    if (!activeSearchResults.length) {
      clearResults();
      setStatus('Os resultados não trouxeram coordenadas utilizáveis. Tente uma pesquisa mais específica.', 'info');
      return;
    }
    if (activeSearchResults.length === 1) map.setView([activeSearchResults[0].lat, activeSearchResults[0].lon], 16);
    else map.fitBounds(searchLayer.getBounds().pad(0.18), { maxZoom: 16 });
    setStatus('Resultados de locais encontrados pelo Photon, com base em dados do OpenStreetMap. A disponibilidade depende do mapeamento da região.', 'success');
  }

  function readSearchCache(query, region) {
    const cache = readStore(SEARCH_CACHE_KEY, {});
    const item = cache[`${region.state}|${region.city}|${query.toLocaleLowerCase('pt-BR')}`];
    return item && Date.now() - item.savedAt < SEARCH_CACHE_TTL ? item.features : null;
  }

  function saveSearchCache(query, region, features) {
    const cache = readStore(SEARCH_CACHE_KEY, {});
    cache[`${region.state}|${region.city}|${query.toLocaleLowerCase('pt-BR')}`] = { savedAt: Date.now(), features };
    const keys = Object.keys(cache);
    while (keys.length > 16) delete cache[keys.shift()];
    writeStore(SEARCH_CACHE_KEY, cache);
  }

  async function searchPlaces(event) {
    if (event) event.preventDefault();
    if (!map) {
      await ensureMap();
      if (!map) return;
    }
    const input = $('#boraiMapSearchInput');
    const button = $('#boraiMapSearchButton');
    const rawQuery = input ? input.value.trim() : '';
    if (rawQuery.length < 2) {
      setStatus('Digite pelo menos duas letras para pesquisar um endereço, estação ou estabelecimento.');
      if (input) input.focus();
      return;
    }
    const region = getRegion();
    const cache = readSearchCache(rawQuery, region);
    if (cache) {
      renderPlaceResults(cache);
      return;
    }
    if (Date.now() - lastPhotonRequestAt < 1000) {
      setStatus('Aguarde um instante antes de fazer outra pesquisa.');
      return;
    }
    lastPhotonRequestAt = Date.now();
    setButtonBusy(button, true, 'Buscando…');
    setStatus('Pesquisando locais no OpenStreetMap…');
    try {
      const query = `${rawQuery}, ${region.city}, ${region.state}, Brasil`;
      const params = new URLSearchParams({ q: query, limit: '8', lang: 'pt', countrycode: 'br' });
      if (map) {
        const center = map.getCenter();
        params.set('lat', String(center.lat));
        params.set('lon', String(center.lng));
        params.set('zoom', String(Math.max(10, map.getZoom())));
      }
      const data = await fetchJson(`${PHOTON_ENDPOINT}?${params.toString()}`, { headers: { Accept: 'application/geo+json, application/json' } }, 14000);
      const features = Array.isArray(data.features) ? data.features.slice(0, 8) : [];
      saveSearchCache(rawQuery, region, features);
      renderPlaceResults(features);
    } catch (error) {
      setStatus(`${error.message || 'Não foi possível pesquisar agora.'} Você também pode abrir a pesquisa no Google Maps.`, 'error');
      if (typeof window.showToast === 'function') window.showToast('Pesquisa de locais indisponível no momento.');
    } finally {
      setButtonBusy(button, false);
    }
  }

  function transportCategory(tags) {
    if (tags.amenity === 'bus_station' || tags.public_transport === 'station') return { label: 'Terminal ou estação de transporte', icon: '▣' };
    if (tags.railway === 'station' || tags.railway === 'halt' || tags.railway === 'tram_stop') return { label: 'Estação ferroviária ou de trilhos', icon: '🚉' };
    if (tags.railway === 'subway_entrance') return { label: 'Acesso ao metrô', icon: '🚇' };
    if (tags.highway === 'bus_stop') return { label: 'Parada de ônibus', icon: '🚏' };
    if (tags.public_transport === 'platform') return { label: 'Plataforma de transporte', icon: '🚏' };
    if (tags.public_transport === 'stop_position') return { label: 'Ponto de parada mapeado', icon: '🚏' };
    return { label: 'Ponto de transporte público', icon: '🚏' };
  }

  function elementCoordinates(element) {
    if (Number.isFinite(element.lat) && Number.isFinite(element.lon)) return { lat: element.lat, lon: element.lon };
    if (element.center && Number.isFinite(element.center.lat) && Number.isFinite(element.center.lon)) return { lat: element.center.lat, lon: element.center.lon };
    return null;
  }

  function transitCacheKey(center, region) {
    return `${region.state}|${region.city}|${center.lat.toFixed(2)}|${center.lng.toFixed(2)}`;
  }

  function transitPopup(element) {
    const tags = element.tags || {};
    const category = transportCategory(tags);
    const title = tags.name || category.label;
    const details = [category.label, tags.operator, tags.network, tags.ref ? `Referência: ${tags.ref}` : ''].filter(Boolean).join(' · ');
    const typeMap = { node: 'node', way: 'way', relation: 'relation' };
    const url = typeMap[element.type] ? `https://www.openstreetmap.org/${typeMap[element.type]}/${encodeURIComponent(element.id)}` : '';
    return { category, title, details, url };
  }

  function renderTransitResults(elements, fromCache = false) {
    transitLayer.clearLayers();
    activeTransitResults = [];
    const resultBox = $('#boraiMapResults');
    clearResults();
    if (!elements.length) {
      setStatus('A consulta foi concluída, mas não foram encontrados pontos de transporte mapeados nesta área. Isso não significa que não existam serviços locais.', 'info');
      return;
    }
    const list = elements.slice(0, 80);
    addResultHeading(`${list.length} ponto(s) de transporte mapeado(s)`);
    const L = window.L;
    list.forEach((element, index) => {
      const position = elementCoordinates(element);
      if (!position) return;
      const info = transitPopup(element);
      const markerIcon = L.divIcon({
        className: 'borai-transit-pin',
        html: `<span><b>${info.category.icon}</b></span>`,
        iconSize: [29, 29],
        iconAnchor: [14, 28]
      });
      const marker = L.marker([position.lat, position.lon], { icon: markerIcon })
        .bindPopup(popupContent(info.title, info.details, info.url))
        .addTo(transitLayer);
      const item = { ...position, title: info.title, details: info.details, marker };
      activeTransitResults.push(item);

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'borai-map-result';
      const icon = document.createElement('span');
      icon.className = 'borai-map-result-icon';
      icon.textContent = info.category.icon;
      const copy = document.createElement('span');
      copy.className = 'borai-map-result-copy';
      const name = document.createElement('strong');
      name.textContent = info.title || `Ponto de transporte ${index + 1}`;
      const details = document.createElement('span');
      details.textContent = info.details;
      copy.append(name, details);
      button.append(icon, copy);
      button.addEventListener('click', () => {
        map.setView([item.lat, item.lon], Math.max(map.getZoom(), 16));
        item.marker.openPopup();
      });
      resultBox.append(button);
    });
    if (activeTransitResults.length > 1) map.fitBounds(transitLayer.getBounds().pad(0.15), { maxZoom: 16 });
    else if (activeTransitResults.length === 1) map.setView([activeTransitResults[0].lat, activeTransitResults[0].lon], 16);
    setStatus(`${activeTransitResults.length} ponto(s) encontrados em dados colaborativos do OpenStreetMap${fromCache ? ' (resultado em cache)' : ''}. Cobertura e atualização variam; não há informação de horários ou veículos em tempo real.`, 'success');
  }

  function createOverpassQuery(center) {
    const lat = Number(center.lat.toFixed(6));
    const lon = Number(center.lng.toFixed(6));
    return `[out:json][timeout:20];\n(\n  node(around:1400,${lat},${lon})["highway"="bus_stop"];\n  node(around:1400,${lat},${lon})["public_transport"~"platform|station|stop_position"];\n  node(around:1400,${lat},${lon})["railway"~"station|halt|tram_stop|subway_entrance"];\n  node(around:1400,${lat},${lon})["amenity"="bus_station"];\n  way(around:1400,${lat},${lon})["public_transport"="station"];\n  way(around:1400,${lat},${lon})["railway"~"station|halt|tram_stop"];\n  way(around:1400,${lat},${lon})["amenity"="bus_station"];\n);\nout center tags;`;
  }

  async function loadTransitPoints() {
    if (isLoadingTransit) return;
    const button = $('#boraiMapTransitButton');
    const region = getRegion();
    const center = map.getCenter();
    const key = transitCacheKey(center, region);
    if (map.getZoom() < 8) {
      await centerOnCity();
      if (map.getZoom() < 8) {
        setStatus('O município ainda não foi localizado automaticamente. Pesquise um endereço ou use sua localização antes de consultar os pontos próximos.', 'error');
        return;
      }
    }
    const cache = readStore(TRANSIT_CACHE_KEY, {});
    const stored = cache[key];
    if (stored && Date.now() - stored.savedAt < TRANSIT_CACHE_TTL && Array.isArray(stored.elements)) {
      renderTransitResults(stored.elements, true);
      return;
    }

    const lastRequest = Number(readStore(OVERPASS_LAST_KEY, 0)) || 0;
    if (Date.now() - lastRequest < OVERPASS_MIN_INTERVAL) {
      const remaining = Math.ceil((OVERPASS_MIN_INTERVAL - (Date.now() - lastRequest)) / 1000);
      setStatus(`Para respeitar os limites do serviço comunitário, aguarde ${remaining}s antes de consultar novamente.`);
      return;
    }

    isLoadingTransit = true;
    setButtonBusy(button, true, 'Consultando…');
    setStatus('Consultando pontos de ônibus, estações e terminais mapeados nas proximidades…');
    writeStore(OVERPASS_LAST_KEY, Date.now());
    try {
      const query = createOverpassQuery(center);
      const body = new URLSearchParams({ data: query });
      const data = await fetchJson(OVERPASS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', Accept: 'application/json' },
        body: body.toString()
      }, 26000);
      const elements = Array.isArray(data.elements) ? data.elements : [];
      cache[key] = { savedAt: Date.now(), elements };
      const keys = Object.keys(cache);
      while (keys.length > 10) delete cache[keys.shift()];
      writeStore(TRANSIT_CACHE_KEY, cache);
      renderTransitResults(elements);
    } catch (error) {
      const code = error.status ? ` (HTTP ${error.status})` : '';
      let message = `${error.message || 'Não foi possível consultar os dados de transporte.'}${code}`;
      if (error.status === 429 || error.status === 504 || error.status === 502) {
        message += ' O servidor público pode estar ocupado. O Boraí não fará novas tentativas automáticas; aguarde um pouco antes de tentar novamente.';
      } else {
        message += ' Confira a conexão ou pesquise os pontos diretamente no Google Maps.';
      }
      setStatus(message, 'error');
    } finally {
      isLoadingTransit = false;
      setButtonBusy(button, false);
    }
  }

  async function centerOnCity() {
    const region = getRegion();
    const button = $('#boraiMapCenterButton');
    setButtonBusy(button, true, 'Localizando…');
    setStatus(`Localizando ${region.city} (${region.state})…`);
    try {
      const center = await geocodeCity(region);
      cityCenter = center;
      map.setView([center.lat, center.lon], 14, { animate: true });
      if (cityMarker) cityMarker.remove();
      cityMarker = window.L.marker([center.lat, center.lon]).addTo(map)
        .bindPopup(popupContent(`${region.city} - ${region.state}`, 'Área aproximada do município selecionado. O marcador não representa um endereço específico.'));
      setStatus(`Mapa centralizado em ${region.city} (${region.state}). Use a pesquisa para localizar endereços e estabelecimentos.`, 'success');
    } catch (error) {
      setStatus(error.message || 'Não foi possível localizar automaticamente a cidade.', 'error');
    } finally {
      setButtonBusy(button, false);
    }
  }

  function locateUser() {
    const button = $('#boraiMapLocateButton');
    if (!navigator.geolocation) {
      setStatus('Este navegador não oferece geolocalização. Você ainda pode pesquisar um endereço manualmente.', 'error');
      return;
    }
    setButtonBusy(button, true, 'Solicitando…');
    setStatus('Aguardando a autorização de localização do navegador…');
    navigator.geolocation.getCurrentPosition(position => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        setStatus('O navegador retornou uma localização inválida.', 'error');
        setButtonBusy(button, false);
        return;
      }
      if (userMarker) userMarker.remove();
      const icon = window.L.divIcon({
        className: 'borai-transit-pin',
        html: '<span style="background:#2879cf"><b>●</b></span>',
        iconSize: [29, 29],
        iconAnchor: [14, 28]
      });
      userMarker = window.L.marker([lat, lon], { icon }).addTo(map)
        .bindPopup(popupContent('Sua localização', 'Posição informada pelo navegador neste aparelho.'));
      map.setView([lat, lon], 16, { animate: true });
      userMarker.openPopup();
      setStatus('Sua localização foi exibida no mapa. O navegador controla a autorização e a precisão.', 'success');
      setButtonBusy(button, false);
    }, error => {
      const messages = {
        1: 'Permissão de localização negada. Autorize o acesso nas configurações do navegador para usar este recurso.',
        2: 'Não foi possível determinar sua localização. Verifique o GPS ou a conexão.',
        3: 'A localização demorou demais. Tente novamente.'
      };
      setStatus(messages[error.code] || 'Não foi possível obter sua localização.', 'error');
      setButtonBusy(button, false);
    }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 120000 });
  }

  async function ensureMap() {
    if (!buildInterface()) return;
    if (map) {
      window.setTimeout(() => map && map.invalidateSize({ pan: false }), 120);
      return;
    }
    setStatus('Carregando o mapa…');
    try {
      const L = await loadLeaflet();
      initLeafletMap(L);
      await centerOnCity();
    } catch (error) {
      setStatus(`${error.message || 'Não foi possível iniciar o mapa.'} Você ainda pode usar o planejamento de rota e a pesquisa externa.`, 'error');
      const mapElement = $('#boraiLeafletMap');
      if (mapElement) {
        const fallback = document.createElement('div');
        fallback.style.cssText = 'height:100%;min-height:300px;display:grid;place-items:center;padding:24px;text-align:center;color:#7a4c26;background:#fff5e9;font:14px/1.5 Arial,sans-serif';
        const message = document.createElement('p');
        message.textContent = 'O mapa não pôde ser carregado agora. Confira a conexão e tente novamente.';
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.textContent = 'Tentar carregar novamente';
        retry.style.cssText = 'margin-top:10px;padding:10px 14px;border:0;border-radius:10px;background:#ef7800;color:white;font-weight:700';
        retry.addEventListener('click', () => ensureMap());
        fallback.append(message, retry);
        mapElement.replaceChildren(fallback);
      }
      leafletPromise = null;
    }
  }

  function bindEvents() {
    const form = $('#boraiMapSearchForm');
    if (form) form.addEventListener('submit', searchPlaces);
    const center = $('#boraiMapCenterButton');
    if (center) center.addEventListener('click', () => map ? centerOnCity() : ensureMap());
    const locate = $('#boraiMapLocateButton');
    if (locate) locate.addEventListener('click', () => map ? locateUser() : ensureMap().then(() => map && locateUser()));
    const transit = $('#boraiMapTransitButton');
    if (transit) transit.addEventListener('click', () => map ? loadTransitPoints() : ensureMap().then(() => map && loadTransitPoints()));

    document.addEventListener('click', event => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('.nav-item[data-tab="map"], [data-drawer-tab="map"]')) {
        window.setTimeout(() => ensureMap(), 180);
      }
    });

    window.addEventListener('resize', () => {
      if (map) window.setTimeout(() => map.invalidateSize({ pan: false }), 120);
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && map && !$('#mapView').hidden) window.setTimeout(() => map.invalidateSize({ pan: false }), 120);
    });
  }

  function start() {
    if (!$('#mapView') || !buildInterface()) return;
    addStyles();
    bindEvents();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
