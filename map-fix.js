/* Boraí — correção de centralização e consultas do mapa
 * Carregar depois de map-enhancements.js.
 * Mantém o Leaflet e as demais funções originais do aplicativo.
 */
(() => {
  'use strict';

  if (window.__boraiMapFixInstalled) return;
  window.__boraiMapFixInstalled = true;

  const ORIGINAL_FETCH = window.fetch.bind(window);
  const CITY_CACHE_RESET_KEY = 'borai-map-fix-cache-reset-v1';
  const NOMINATIM_LAST_REQUEST_KEY = 'borai-map-fix-last-nominatim-request';
  const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/search';

  const STATE_NAMES = {
    AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia',
    CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás',
    MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', MG: 'Minas Gerais',
    PA: 'Pará', PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí',
    RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul',
    RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina', SP: 'São Paulo',
    SE: 'Sergipe', TO: 'Tocantins'
  };

  function storedString(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      const parsed = JSON.parse(raw);
      return typeof parsed === 'string' && parsed.trim() ? parsed.trim() : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function selectedRegion() {
    const state = storedString('borai-state', 'SP').toUpperCase();
    return {
      city: storedString('borai-city', 'Mogi das Cruzes'),
      state,
      stateName: STATE_NAMES[state] || state
    };
  }

  function wait(ms) {
    return new Promise(resolve => window.setTimeout(resolve, ms));
  }

  async function cityGeoJson(signal) {
    const region = selectedRegion();
    const params = new URLSearchParams({
      q: `${region.city}, ${region.stateName}, Brasil`,
      format: 'geojson',
      countrycodes: 'br',
      limit: '1',
      addressdetails: '1',
      'accept-language': 'pt-BR'
    });

    // A consulta é feita somente ao abrir o mapa/centralizar a cidade.
    // Respeita o intervalo mínimo e a resposta também é guardada pelo módulo principal.
    const lastRequest = Number(localStorage.getItem(NOMINATIM_LAST_REQUEST_KEY)) || 0;
    const waitTime = 1100 - (Date.now() - lastRequest);
    if (waitTime > 0) await wait(waitTime);
    localStorage.setItem(NOMINATIM_LAST_REQUEST_KEY, String(Date.now()));

    const response = await ORIGINAL_FETCH(`${NOMINATIM_ENDPOINT}?${params.toString()}`, {
      method: 'GET',
      headers: { Accept: 'application/geo+json', 'Accept-Language': 'pt-BR' },
      signal,
      credentials: 'omit'
    });
    if (!response.ok) {
      const error = new Error(`A busca do município retornou HTTP ${response.status}.`);
      error.status = response.status;
      throw error;
    }

    const result = await response.json();
    const features = Array.isArray(result.features) ? result.features : [];
    const feature = features.find(item => {
      const properties = item.properties || {};
      const address = properties.address || {};
      return !address.country_code || String(address.country_code).toLowerCase() === 'br';
    });
    if (!feature || !feature.geometry || !Array.isArray(feature.geometry.coordinates)) {
      throw new Error(`Não encontrei ${region.city} (${region.state}) na base cartográfica.`);
    }

    const properties = feature.properties || {};
    const address = properties.address || {};
    properties.name = properties.name || region.city;
    properties.country = address.country || 'Brasil';
    properties.state = address.state || region.stateName;
    feature.properties = properties;
    return { type: 'FeatureCollection', features: [feature] };
  }

  function patchedFetch(input, init = {}) {
    let requestUrl;
    try {
      requestUrl = new URL(input instanceof Request ? input.url : String(input), window.location.href);
    } catch (_) {
      return ORIGINAL_FETCH(input, init);
    }

    // Photon espera o código ISO do país em maiúsculas. Corrige o parâmetro
    // também nas pesquisas de endereço e estabelecimento.
    if (requestUrl.hostname === 'photon.komoot.io' && requestUrl.pathname.startsWith('/api')) {
      if (requestUrl.searchParams.has('countrycode')) {
        requestUrl.searchParams.set('countrycode', 'BR');
      }

      // A busca do centro do município usa limit=1. Usa Nominatim como geocodificador
      // de município e devolve GeoJSON no formato que o código Leaflet já entende.
      if (requestUrl.searchParams.get('limit') === '1') {
        return cityGeoJson(init.signal).then(data => new Response(JSON.stringify(data), {
          status: 200,
          headers: { 'Content-Type': 'application/geo+json; charset=utf-8' }
        })).catch(error => {
          console.warn('[Boraí mapa] Geocodificação alternativa indisponível:', error);
          return ORIGINAL_FETCH(requestUrl.href, init);
        });
      }

      return ORIGINAL_FETCH(requestUrl.href, init);
    }

    // Mantém a consulta Overpass, mas usa a forma simples e compatível
    // de saída com centro e tags dos elementos encontrados.
    if (requestUrl.hostname === 'overpass-api.de' && requestUrl.pathname.includes('/interpreter') && typeof init.body === 'string') {
      try {
        const body = new URLSearchParams(init.body);
        const query = body.get('data');
        if (query && /out\s+center\s+tags\s*;/i.test(query)) {
          body.set('data', query.replace(/out\s+center\s+tags\s*;/i, 'out center;'));
          init = { ...init, body: body.toString() };
        }
      } catch (_) {
        // Se o corpo não puder ser interpretado, envia a requisição original.
      }
    }

    return ORIGINAL_FETCH(input, init);
  }

  window.fetch = patchedFetch;

  // Apaga uma única vez coordenadas antigas que possam ter sido guardadas
  // quando o geocodificador retornou um município incorreto.
  try {
    if (!localStorage.getItem(CITY_CACHE_RESET_KEY)) {
      localStorage.removeItem('borai-map-city-centers-v1');
      localStorage.setItem(CITY_CACHE_RESET_KEY, '1');
    }
  } catch (_) {
    // O mapa continua funcionando mesmo quando o armazenamento está bloqueado.
  }
})();
