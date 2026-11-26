/* Boraí — correções leves de navegação e menu.
 * Substitui a antiga rotina que varria continuamente todo o documento.
 * O mapa interativo próprio continua na aba Mapa.
 */
(() => {
  'use strict';

  if (window.__boraiLightAdjustmentsInstalled) return;
  window.__boraiLightAdjustmentsInstalled = true;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const ABOUT_URL = 'https://adriano277.github.io/borai-site/';
  let demoRouteDismissed = false;
  let demoObserver = null;

  function storedString(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return typeof value === 'string' && value.trim() ? value.trim() : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function showToast(message) {
    const toast = $('#toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    window.setTimeout(() => toast.classList.remove('show'), 2800);
  }

  function closeModal() {
    const backdrop = $('#modalBackdrop');
    const content = $('#modalContent');
    if (backdrop) backdrop.hidden = true;
    if (content) content.innerHTML = '';
  }

  function openModal(html) {
    const backdrop = $('#modalBackdrop');
    const content = $('#modalContent');
    if (!backdrop || !content) return;
    content.innerHTML = html;
    backdrop.hidden = false;
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
  }

  function currentCity() {
    const city = storedString('borai-city', 'Mogi das Cruzes');
    const state = storedString('borai-state', 'SP');
    return `${city}, ${state}, Brasil`;
  }

  function refreshFavoriteList() {
    const container = $('#savedRoutes');
    if (!container) return;
    // O renderizador de favoritos já existente observa alterações nesta lista
    // e a reconstrói a partir do armazenamento do aplicativo.
    container.replaceChildren();
  }

  function saveRoute(origin, destination) {
    let routes = [];
    try {
      const stored = JSON.parse(localStorage.getItem('borai-routes') || '[]');
      if (Array.isArray(stored)) routes = stored;
    } catch (_) {}
    routes = [{ id: Date.now(), origin, destination }, ...routes]
      .filter(route => !route.isDemoRoute)
      .slice(0, 6);
    try {
      localStorage.setItem('borai-routes', JSON.stringify(routes));
    } catch (_) {
      showToast('Não foi possível salvar o trajeto neste aparelho.');
      return false;
    }
    refreshFavoriteList();
    return true;
  }

  function openRouteForm() {
    openModal(`
      <p class="eyebrow">PLANEJAMENTO DE VIAGEM</p>
      <h2 id="modalTitle">Para onde vamos?</h2>
      <p>Informe os locais para salvar o trajeto. O cálculo integrado de itinerários ainda está em desenvolvimento.</p>
      <form id="boraiLocalRouteForm">
        <div class="form-field">
          <label for="boraiLocalOrigin">Ponto de partida</label>
          <input id="boraiLocalOrigin" required maxlength="120" placeholder="Ex.: Terminal Central">
        </div>
        <div class="form-field">
          <label for="boraiLocalDestination">Destino</label>
          <input id="boraiLocalDestination" required maxlength="120" placeholder="Ex.: ETEC Presidente Vargas">
        </div>
        <label class="setting-line" style="border:0">
          <span>Salvar este trajeto nos favoritos</span>
          <input id="boraiLocalSaveRoute" type="checkbox" checked><i></i>
        </label>
        <button class="primary-button" type="submit">Salvar trajeto</button>
      </form>
      <div id="boraiLocalRouteResult"></div>
    `);

    $('#boraiLocalRouteForm').addEventListener('submit', event => {
      event.preventDefault();
      const origin = $('#boraiLocalOrigin').value.trim();
      const destination = $('#boraiLocalDestination').value.trim();
      if (!origin || !destination) return;

      if ($('#boraiLocalSaveRoute').checked && !saveRoute(origin, destination)) return;

      $('#boraiLocalRouteResult').innerHTML = `
        <div class="modal-result">
          <strong>Trajeto salvo</strong>
          <span>O cálculo de itinerários está em desenvolvimento. Use a aba Mapa para pesquisar endereços, estações e pontos de transporte.</span>
        </div>`;
    });
  }

  function searchInsideBoraiMap(query) {
    const input = $('#boraiMapSearchInput');
    const form = $('#boraiMapSearchForm');
    const mapTab = $('.nav-item[data-tab="map"]');

    if (!input || !form || !mapTab) {
      showToast('Abra a aba Mapa para pesquisar locais dentro do Boraí.');
      return;
    }

    input.value = query;
    closeModal();
    mapTab.click();

    window.setTimeout(() => {
      if (typeof form.requestSubmit === 'function') {
        form.requestSubmit();
      } else {
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }
    }, 220);
  }

  function openTransportForm() {
    const city = currentCity();
    openModal(`
      <p class="eyebrow">ENCONTRE UM MEIO DE TRANSPORTE</p>
      <h2 id="modalTitle">O que você procura?</h2>
      <p>Escolha uma modalidade para pesquisar no mapa integrado do Boraí.</p>
      <div class="form-field">
        <label for="boraiLocalTransportType">Modalidade</label>
        <select id="boraiLocalTransportType">
          <option value="pontos de ônibus">Ônibus</option>
          <option value="estação de trem CPTM">Trem / CPTM</option>
          <option value="estação de metrô">Metrô</option>
          <option value="terminal de transporte público">Terminais</option>
          <option value="transporte público">Outros transportes públicos</option>
        </select>
      </div>
      <div class="form-field">
        <label for="boraiLocalTransportArea">Bairro ou referência (opcional)</label>
        <input id="boraiLocalTransportArea" placeholder="Ex.: Centro">
      </div>
      <button class="primary-button" id="boraiLocalTransportSearch">Pesquisar no Mapa Boraí</button>
    `);

    $('#boraiLocalTransportSearch').addEventListener('click', () => {
      const type = $('#boraiLocalTransportType').value;
      const area = $('#boraiLocalTransportArea').value.trim();
      searchInsideBoraiMap(`${type} ${area} ${city}`);
    });
  }

  function showSavedRoute(routeId) {
    let route = null;
    if (String(routeId) === '900000026') {
      route = {
        origin: 'Terminal Central',
        destination: 'ETEC Presidente Vargas'
      };
    } else {
      try {
        const routes = JSON.parse(localStorage.getItem('borai-routes') || '[]');
        route = Array.isArray(routes)
          ? routes.find(item => String(item.id) === String(routeId))
          : null;
      } catch (_) {}
    }

    if (!route) return;
    openModal(`
      <p class="eyebrow">TRAJETO FAVORITO</p>
      <h2 id="modalTitle">${escapeHtml(route.origin)} → ${escapeHtml(route.destination)}</h2>
      <p>O cálculo integrado de itinerários ainda está em desenvolvimento. Use a aba Mapa para pesquisar os locais e pontos de transporte próximos.</p>
      <button type="button" class="primary-button" id="boraiSavedRouteClose">Fechar</button>
    `);
    $('#boraiSavedRouteClose').addEventListener('click', closeModal);
  }

  function addAboutMenuItem() {
    const drawer = $('#sideDrawer');
    if (!drawer || $('[data-borai-about]', drawer)) return;

    const item = document.createElement('button');
    item.type = 'button';
    item.dataset.boraiAbout = 'true';
    item.innerHTML = 'ⓘ <span>Sobre o Boraí</span>';

    const footer = $('.drawer-foot', drawer);
    if (footer) drawer.insertBefore(item, footer);
    else drawer.append(item);
  }

  function openAboutModal() {
    openModal(`
      <p class="eyebrow">CONHEÇA O BORAÍ</p>
      <h2 id="modalTitle">Mobilidade que aproxima</h2>
      <p>O Boraí é uma proposta de aplicativo de mobilidade urbana criada para reunir, em um só lugar, informações que ajudam as pessoas a organizar seus deslocamentos pela cidade.</p>
      <div class="modal-result">
        <strong>O que o Boraí pretende oferecer?</strong>
        <p>Consulta de linhas e itinerários, horários de funcionamento, tarifas, estimativas de viagem, localização de veículos quando houver dados disponíveis e avisos sobre alterações no transporte público.</p>
      </div>
      <p>Este aplicativo é um protótipo demonstrativo; algumas integrações e recursos próprios ainda estão em desenvolvimento.</p>
      <a class="primary-button" style="display:flex;align-items:center;justify-content:center;margin:16px 0 10px;text-decoration:none" href="${ABOUT_URL}" target="_blank" rel="noopener noreferrer">Conhecer o site institucional ↗</a>
      <button class="secondary-button" type="button" id="boraiAboutClose">Fechar</button>
    `);
    $('#boraiAboutClose').addEventListener('click', closeModal);
  }

  function closeDrawer() {
    const drawer = $('#sideDrawer');
    const shade = $('#drawerBackdrop');
    const menu = $('#menuButton');
    if (drawer) {
      drawer.classList.remove('open');
      drawer.setAttribute('aria-hidden', 'true');
    }
    if (shade) shade.hidden = true;
    if (menu) menu.setAttribute('aria-expanded', 'false');
  }

  function syncDemoRemoveButton() {
    const container = $('#savedRoutes');
    if (!container) return;

    const card = $('[data-borai-demo-card="true"]', container);
    if (!card) return;

    card.hidden = demoRouteDismissed;
    const actions = $('.borai-route-actions', card);
    if (!actions || $('[data-borai-remove-demo-route]', actions)) return;

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.dataset.boraiRemoveDemoRoute = 'true';
    remove.textContent = 'Remover';
    remove.setAttribute('aria-label', 'Remover rota favorita de demonstração até reabrir o site');
    actions.append(remove);
  }

  function installDemoRouteObserver() {
    const container = $('#savedRoutes');
    if (!container || !('MutationObserver' in window)) return;

    syncDemoRemoveButton();
    demoObserver = new MutationObserver(syncDemoRemoveButton);
    demoObserver.observe(container, { childList: true, subtree: true });
  }

  function handleClick(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const about = target.closest('[data-borai-about]');
    if (about) {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeDrawer();
      openAboutModal();
      return;
    }

    const removeDemo = target.closest('[data-borai-remove-demo-route]');
    if (removeDemo) {
      event.preventDefault();
      event.stopImmediatePropagation();
      demoRouteDismissed = true;
      syncDemoRemoveButton();
      showToast('Rota de demonstração removida até você reabrir o site.');
      return;
    }

    const incident = target.closest('[data-borai-incident]');
    if (incident) return; // Mantém o aviso demonstrativo já implementado.

    const routeButton = target.closest('[data-borai-open-route]');
    if (routeButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showSavedRoute(routeButton.dataset.boraiOpenRoute);
      return;
    }

    const removeUserRoute = target.closest('[data-borai-remove-route]');
    if (removeUserRoute) return; // Mantém a remoção dos favoritos pessoais.

    const anchor = target.closest('a[href]');
    if (anchor && /(?:google\.[^/]+\/maps|maps\.google\.)/i.test(anchor.href)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showToast('As pesquisas de locais são feitas na aba Mapa do Boraí.');
      return;
    }

    if (target.closest('#addRouteButton, #routeArrow, #mapRouteButton')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openRouteForm();
      return;
    }

    if (target.closest('#addTransportButton, #transportArrow, #mapTransportButton')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openTransportForm();
      return;
    }
  }

  function handleSearchSubmit(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.id !== 'searchForm') return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const term = ($('#globalSearch')?.value || '').trim();
    if (!term) return;

    if (/bia|ajuda|assistente/i.test(term)) {
      closeModal();
      const biaTab = $('.nav-item[data-tab="bia"]');
      if (biaTab) biaTab.click();
      const input = $('#chatInput');
      if (input) {
        input.value = term;
        input.focus();
      }
      return;
    }

    openModal(`
      <p class="eyebrow">PESQUISA</p>
      <h2 id="modalTitle">Pesquisar “${escapeHtml(term)}”</h2>
      <p>Escolha onde deseja procurar essa informação.</p>
      <button class="primary-button" id="boraiSearchMap">Pesquisar na aba Mapa</button>
      <button class="secondary-button" id="boraiSearchBia" style="width:100%;margin-top:10px">Perguntar à BIA</button>
    `);

    $('#boraiSearchMap').addEventListener('click', () => searchInsideBoraiMap(term));
    $('#boraiSearchBia').addEventListener('click', () => {
      closeModal();
      const biaTab = $('.nav-item[data-tab="bia"]');
      if (biaTab) biaTab.click();
      const input = $('#chatInput');
      if (input) {
        input.value = term;
        input.focus();
      }
    });
  }

  function start() {
    addAboutMenuItem();
    installDemoRouteObserver();

    // Um único manipulador de cliques, no início da propagação.
    // Não percorre a página nem observa alterações no documento inteiro.
    window.addEventListener('click', handleClick, true);
    window.addEventListener('submit', handleSearchSubmit, true);

    const mapTransportButton = $('#mapTransportButton');
    if (mapTransportButton) mapTransportButton.textContent = 'Pesquisar transporte no Mapa Boraí';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
