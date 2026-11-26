/* Boraí — núcleo otimizado da aplicação.
 * Rotas, favoritos, região, perfil, BIA, preferências, anúncios e Boraí+.
 * O mapa é iniciado separadamente e apenas quando a aba Mapa é aberta.
 */
(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const KEYS = {
    city: 'borai-city', state: 'borai-state', routes: 'borai-routes',
    preferences: 'borai-preferences', profile: 'borai-profile',
    states: 'borai-ibge-states'
  };
  const DEFAULT_PREFERENCES = { bus: true, train: true, metro: true, other: true, largeText: false, alerts: true };
  const DEFAULT_PROFILE = { name: '', email: '', phone: '', residence: '', photo: '' };
  const DEMO_ROUTE = {
    id: 'borai-demo-route', isDemoRoute: true,
    origin: 'Terminal Central, Rua Professor Flaviano de Melo, 525',
    destination: 'ETEC Presidente Vargas, Rua Coronel Cardoso de Siqueira, 801',
    displayOrigin: 'Terminal Central', displayDestination: 'ETEC Presidente Vargas',
    city: 'Mogi das Cruzes', state: 'SP'
  };
  const ABOUT_URL = 'https://adriano277.github.io/borai-site/';
  const BIA_API_URL = 'https://borai-bia-api.contatoborai2026.workers.dev/chat';

  const state = {
    city: readStore(KEYS.city, 'Mogi das Cruzes'),
    uf: readStore(KEYS.state, 'SP'),
    routes: normalizeRoutes(readStore(KEYS.routes, [])),
    preferences: { ...DEFAULT_PREFERENCES, ...readStore(KEYS.preferences, {}) },
    profile: { ...DEFAULT_PROFILE, ...readStore(KEYS.profile, {}) },
    currentTab: 'home',
    demoRouteDismissed: false, // Deliberadamente não persistir: volta ao reabrir o site.
    biaHistory: [], biaSending: false, toastTimer: null,
    adClosed: false, selectedPlan: null, selectedPayment: ''
  };

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

  function normalizeRoutes(value) {
    return Array.isArray(value) ? value.filter(item => item && typeof item === 'object' && !item.isDemoRoute).slice(0, 6) : [];
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
  }

  function showToast(message) {
    const toast = $('#toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    if (state.toastTimer) window.clearTimeout(state.toastTimer);
    state.toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2800);
  }

  function openModal(markup) {
    const backdrop = $('#modalBackdrop');
    const content = $('#modalContent');
    if (!backdrop || !content) return;
    content.innerHTML = markup;
    backdrop.hidden = false;
    const focusable = $('input, select, textarea, button, a[href]', content);
    if (focusable) window.requestAnimationFrame(() => focusable.focus());
  }

  function closeModal() {
    const backdrop = $('#modalBackdrop');
    const content = $('#modalContent');
    if (backdrop) backdrop.hidden = true;
    if (content) content.replaceChildren();
  }

  function openDrawer() {
    const drawer = $('#sideDrawer');
    const shade = $('#drawerBackdrop');
    if (!drawer || !shade) return;
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    shade.hidden = false;
    $('#menuButton')?.setAttribute('aria-expanded', 'true');
  }

  function closeDrawer() {
    const drawer = $('#sideDrawer');
    const shade = $('#drawerBackdrop');
    if (drawer) {
      drawer.classList.remove('open');
      drawer.setAttribute('aria-hidden', 'true');
    }
    if (shade) shade.hidden = true;
    $('#menuButton')?.setAttribute('aria-expanded', 'false');
  }

  function buildMapView() {
    const main = $('#mainContent');
    if (!main || $('#mapView')) return;
    const view = document.createElement('section');
    view.className = 'tab-view map-view';
    view.id = 'mapView';
    view.hidden = true;
    view.innerHTML = `
      <div class="tab-heading">
        <div class="heading-icon map-heading-icon" aria-hidden="true">⌖</div>
        <div><p class="eyebrow">EXPLORE SUA REGIÃO</p><h1>Mapa</h1><p>Encontre endereços, estações e pontos de transporte.</p></div>
      </div>
      <div class="map-preview-card">
        <div class="map-preview-top"><span class="map-preview-tag"><i></i> Mapa interativo</span><span class="map-city-label" id="mapCityLabel"></span></div>
        <div class="map-canvas" aria-label="Mapa interativo do Boraí"></div>
        <div class="map-status"><span class="map-status-icon">⌖</span><div><strong>Mapa pronto para carregar</strong><p>Abra esta aba para iniciar o mapa e consultar locais próximos.</p></div></div>
      </div>
      <div class="map-actions">
        <button class="primary-button" type="button" id="mapRouteButton">Planejar uma rota</button>
        <button class="secondary-button" type="button" id="mapTransportButton">Pesquisar transporte</button>
      </div>
      <p class="demo-note centered">Os locais e pontos de transporte dependem da cobertura colaborativa do OpenStreetMap. Não há horários ou posição de veículos em tempo real nesta demonstração.</p>`;
    const preferences = $('#preferencesView');
    if (preferences) main.insertBefore(view, preferences);
    else main.append(view);
  }

  function addNavigationItems() {
    const nav = $('.bottom-nav');
    if (nav && !$('.nav-item[data-tab="map"]', nav)) {
      const preferencesButton = $('.nav-item[data-tab="preferences"]', nav);
      const button = document.createElement('button');
      button.className = 'nav-item';
      button.type = 'button';
      button.dataset.tab = 'map';
      button.innerHTML = '<span class="nav-icon map-icon" aria-hidden="true">⌖</span><span>Mapa</span>';
      if (preferencesButton) nav.insertBefore(button, preferencesButton);
      else nav.append(button);
    }
    const drawer = $('#sideDrawer');
    if (drawer && !$('[data-drawer-tab="map"]', drawer)) {
      const anchor = $('[data-drawer-tab="preferences"]', drawer);
      const button = document.createElement('button');
      button.type = 'button'; button.dataset.drawerTab = 'map';
      button.innerHTML = '⌖ <span>Mapa</span>';
      if (anchor) drawer.insertBefore(button, anchor);
      else drawer.append(button);
    }
    if (drawer && !$('[data-drawer-settings]', drawer)) {
      const button = document.createElement('button');
      button.type = 'button'; button.dataset.drawerSettings = 'true';
      button.innerHTML = '<span class="drawer-settings-icon">⚙</span><span>Configurações</span>';
      const foot = $('.drawer-foot', drawer);
      if (foot) drawer.insertBefore(button, foot); else drawer.append(button);
    }
    if (drawer && !$('[data-borai-about]', drawer)) {
      const button = document.createElement('button');
      button.type = 'button'; button.dataset.boraiAbout = 'true';
      button.innerHTML = 'ⓘ <span>Sobre o Boraí</span>';
      const foot = $('.drawer-foot', drawer);
      if (foot) drawer.insertBefore(button, foot); else drawer.append(button);
    }
    if (nav) nav.style.gridTemplateColumns = 'repeat(5, minmax(0, 1fr))';
  }

  function buildSettingsView() {
    const main = $('#mainContent');
    if (!main || $('#boraiSettingsView')) return;
    const view = document.createElement('section');
    view.className = 'tab-view borai-settings-view';
    view.id = 'boraiSettingsView';
    view.hidden = true;
    view.innerHTML = `
      <div class="tab-heading"><div class="heading-icon">⚙</div><div><p class="eyebrow">SUA CONTA NO BORAÍ</p><h1>Configurações</h1><p>Personalize seus dados neste aparelho.</p></div></div>
      <p class="borai-settings-intro">Todos os campos são opcionais. Este protótipo não exige cadastro; suas informações ficam armazenadas somente neste navegador.</p>
      <div class="borai-profile-card"><div class="borai-user-avatar" id="boraiProfileAvatar">V</div><div><strong id="boraiProfilePreviewName">Seu perfil</strong><small id="boraiProfilePreviewEmail">Informações opcionais</small></div></div>
      <form class="settings-card borai-settings-form" id="boraiProfileForm">
        <h2>Dados pessoais</h2><p>Preencha apenas o que desejar.</p>
        <div class="form-field"><label for="boraiProfileName">Nome</label><input id="boraiProfileName" maxlength="60" autocomplete="name" placeholder="Como gostaria de ser chamado?"></div>
        <div class="form-field"><label for="boraiProfileEmail">E-mail</label><input id="boraiProfileEmail" type="email" maxlength="100" autocomplete="email" placeholder="seuemail@gmail.com"></div>
        <div class="form-field"><label for="boraiProfilePhone">Telefone</label><input id="boraiProfilePhone" type="tel" maxlength="16" autocomplete="tel" placeholder="(11) 99999-9999"></div>
        <div class="form-field"><label for="boraiProfileResidence">Endereço (opcional)</label><input id="boraiProfileResidence" maxlength="160" autocomplete="street-address" placeholder="Rua, número e bairro"><p class="field-note">Evite salvar informações pessoais que não queira manter neste aparelho.</p></div>
        <div class="form-field"><label for="boraiProfilePhoto">Foto de perfil</label><div class="borai-photo-actions"><input id="boraiProfilePhoto" type="file" accept="image/*"><button type="button" class="secondary-button" id="boraiRemovePhoto">Remover foto</button></div><p class="field-note">A imagem será reduzida antes de ser salva.</p></div>
        <div class="borai-settings-actions"><button class="primary-button" type="submit">Salvar configurações</button><button class="secondary-button" type="button" id="boraiClearProfile">Apagar meus dados deste aparelho</button></div>
      </form>
      <p class="demo-note">A foto ou a inicial do seu nome aparecerá ao lado das mensagens enviadas à BIA. Os dados de perfil não são enviados à assistente.</p>`;
    main.append(view);
    $('#boraiProfileName').value = state.profile.name || '';
    $('#boraiProfileEmail').value = state.profile.email || '';
    $('#boraiProfilePhone').value = state.profile.phone || '';
    $('#boraiProfileResidence').value = state.profile.residence || '';
    renderProfilePreview();
  }

  function injectStyles() {
    if ($('#borai-core-style')) return;
    const style = document.createElement('style');
    style.id = 'borai-core-style';
    style.textContent = `
      .bottom-nav{grid-template-columns:repeat(5,minmax(0,1fr))}
      .bottom-nav .nav-item{min-width:0;padding:0 2px;font-size:12px}
      .map-icon{font-size:31px}.map-heading-icon{font-size:36px}
      .map-preview-card{overflow:hidden;border:1px solid #efd5bb;border-radius:22px;background:#fffaf4;box-shadow:0 6px 20px rgba(127,71,24,.07)}
      .map-preview-top{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 17px;background:#fffaf4}
      .map-preview-tag{display:flex;align-items:center;gap:8px;color:#a65411;font-size:12px;font-weight:800}
      .map-preview-tag i{width:8px;height:8px;border-radius:50%;background:#e97800;display:inline-block}
      .map-city-label{color:#76695e;font-size:12px;font-weight:700}
      .map-canvas{height:clamp(250px,38vw,360px);position:relative;overflow:hidden;background:#f0eadb}
      .map-actions{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px}
      .map-actions button{min-height:48px;margin:0;border-radius:13px;font-size:14px;font-weight:800}
      .map-status{display:flex;align-items:flex-start;gap:13px;padding:16px 17px}
      .map-status-icon{width:38px;height:38px;flex:none;display:grid;place-items:center;border-radius:12px;background:#ffead5;color:#b6570c;font-size:24px}
      .map-status strong{display:block;color:#79400f;font-size:14px;margin:1px 0 5px}
      .map-status p{margin:0;color:#796e63;font-size:12px;line-height:1.5}
      .borai-settings-view{padding-top:25px}
      .borai-settings-intro{color:#776d63;font-size:13px;line-height:1.55;margin:-12px 0 20px}
      .borai-profile-card{display:flex;align-items:center;gap:15px;padding:17px;border:1px solid #f0d4b8;border-radius:18px;background:#fffaf4;margin-bottom:17px}
      .borai-user-avatar{width:64px;height:64px;flex:none;border-radius:50%;display:grid;place-items:center;overflow:hidden;background:linear-gradient(145deg,#f28a15,#a94300);border:3px solid #ffd5a8;color:white;font-size:26px;font-weight:800}
      .borai-user-avatar img{width:100%;height:100%;object-fit:cover}
      .borai-profile-card strong{display:block;color:#4a3424;font-size:16px;margin-bottom:4px}
      .borai-profile-card small{display:block;color:#887b70;font-size:12px;line-height:1.4}
      .borai-settings-form .form-field{margin:0 0 15px}.borai-settings-form .form-field input{min-height:47px}
      .field-note{font-size:11px;color:#8b7e72;margin:5px 1px 0;line-height:1.4}
      .borai-photo-actions{display:flex;gap:9px;align-items:center;flex-wrap:wrap}.borai-photo-actions .secondary-button{margin:0}
      .borai-settings-actions{display:grid;gap:10px;margin-top:18px}.borai-settings-actions .primary-button{margin:0}
      .drawer-settings-icon{display:inline-flex;width:20px;justify-content:center;color:#ef7800;font-size:22px;line-height:1}
      .borai-demo-favorite{position:relative;border:1px solid #efbf8f!important;background:linear-gradient(145deg,#fffaf4,#fff4e8)!important;padding:15px!important;box-shadow:0 4px 14px rgba(142,75,19,.06)}
      .borai-route-kicker{display:block;color:#a9540b!important;font-size:11px!important;font-weight:800;letter-spacing:.45px}
      .borai-route-title{display:block;margin:7px 0 5px;color:#382a20;font-size:16px;line-height:1.35}
      .borai-route-subtitle{display:block;color:#84776b;font-size:11px;line-height:1.4;margin:0 0 8px}
      .borai-route-actions{display:flex;gap:14px;flex-wrap:wrap;align-items:center}
      .saved-route .borai-route-actions button{margin-top:5px;border:0!important;background:transparent!important;color:#a94d00!important;text-decoration:underline;cursor:pointer;padding:3px 0;font-size:12px;font-weight:700}
      .borai-demo-alert{border:0;border-radius:50%;width:28px;height:28px;background:#f6a300;color:#fff;font-weight:900;cursor:pointer;margin-left:7px}
      .borai-demo-tag{display:inline-flex;align-items:center;gap:5px;margin-top:6px;padding:4px 8px;border-radius:20px;background:#fff0d5;color:#87500d;font-size:10px;font-weight:800}
      .borai-incident-label{display:inline-flex;margin:0 0 12px;padding:6px 10px;border-radius:18px;background:#fff0d6;color:#8a5100;font-size:11px;font-weight:900;letter-spacing:.5px}
      .borai-incident-modal{border:1px solid #f0d2ad;border-radius:15px;background:#fff8ed;padding:15px;margin:12px 0}
      .borai-incident-modal strong{display:block;color:#8c3e12;margin-bottom:6px}.borai-incident-modal p{margin:0;color:#5f5146;line-height:1.55}
      .borai-ad-track{display:flex;width:100%;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;scroll-behavior:smooth;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch;scrollbar-width:none}
      .borai-ad-track::-webkit-scrollbar{display:none}.borai-ad-slide{flex:0 0 100%;min-width:0;scroll-snap-align:start}
      .borai-ad-slide>.ad-banner,.borai-demo-banner{height:174px;min-height:174px;border-radius:24px}
      .borai-demo-banner{position:relative;display:flex;align-items:center;overflow:hidden;isolation:isolate;padding:18px 24px;color:#fff;background:linear-gradient(112deg,#a94a00,#e87500 58%,#ff9b36);box-shadow:0 5px 14px rgba(83,45,18,.16)}
      .borai-demo-banner.theme-partner{background:linear-gradient(112deg,#573b2a,#95603a 56%,#d18a4c)}
      .borai-demo-banner.theme-city{background:linear-gradient(112deg,#7d3b08,#d45f00 58%,#f89b30)}
      .borai-demo-copy{position:relative;z-index:2;display:flex;flex-direction:column;align-items:flex-start;gap:5px;max-width:74%}
      .borai-demo-copy strong{display:block;font-size:22px;line-height:1.08}.borai-demo-copy>span:not(.borai-demo-tag){font-size:12px;line-height:1.35}
      .borai-demo-copy button{margin-top:4px;border:0;border-radius:24px;padding:8px 14px;background:#fff7ee;color:#9a4700;font-size:12px;font-weight:800;cursor:pointer}
      .borai-demo-art{position:absolute;right:22px;bottom:14px;display:grid;place-items:center;width:100px;height:100px;border:2px solid #ffffff99;border-radius:50%;background:#ffffff22;color:#fff;font-size:46px}
      .borai-demo-tag{margin:0;border:1px solid #ffffff88;background:#2d190c38;color:#fff;text-transform:uppercase;letter-spacing:.4px}
      .borai-ad-dots{display:flex;justify-content:center;align-items:center;gap:8px;padding:11px 0 2px}
      .borai-ad-dot{width:8px;height:8px;padding:0;border:0;border-radius:99px;background:#e7c7a8;cursor:pointer}
      .borai-ad-dot[aria-current="true"]{width:22px;background:#ef7800}
      .welcome-visual .bia-callout{z-index:4;width:250px;min-height:300px;text-align:center;touch-action:none;user-select:none;-webkit-user-select:none}
      .welcome-visual .bia-orb{touch-action:none;cursor:grab;user-select:none;-webkit-user-select:none}
      .welcome-visual .bia-orb.is-dragging{cursor:grabbing}
      .borai-text-size-panel{display:grid;gap:8px;margin:12px 0 18px}.borai-text-size-panel label{font-size:13px;color:#493525;font-weight:700}
      .borai-text-size-panel input{width:100%;accent-color:#ef7800}.borai-text-size-panel output{color:#a84f08;font-size:12px;font-weight:800}
      .borai-payment-section{max-width:680px;margin:25px auto 0;padding:20px;border:1px solid #f0d4b8;border-radius:18px;background:#fffaf4}
      .borai-payment-section h2{margin:0 0 5px;font-size:21px;color:#3d3026}.borai-payment-intro{margin:0 0 15px;color:#817468;font-size:13px;line-height:1.45}
      .borai-payment-options{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
      .borai-payment-method{min-width:0;min-height:95px;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:6px;padding:13px;border:1.5px solid #ebd0b4;border-radius:14px;background:#fff;color:#43372e;text-align:left;cursor:pointer}
      .borai-payment-method[aria-pressed="true"]{border-color:#e87500;background:#fff0df;box-shadow:0 0 0 2px #e875001f}
      .borai-payment-icon{width:34px;height:34px;display:grid;place-items:center;border-radius:10px;background:#ffead5;color:#a94e00;font-size:15px;font-weight:900}
      .borai-payment-method strong{font-size:14px}.borai-payment-method small{font-size:10px;color:#88796d;line-height:1.35}
      .borai-payment-summary{margin:14px 0 0;padding:11px 12px;border-radius:11px;background:#fff2e5;color:#765037;font-size:12px;line-height:1.45}
      .borai-payment-confirm{width:100%;min-height:48px;margin-top:12px;border:0;border-radius:12px;background:#e97800;color:#fff;font-size:14px;font-weight:800;cursor:pointer}
      .borai-payment-confirm:disabled{background:#c9b9a8;color:#fff;cursor:not-allowed}
      .borai-payment-footnote{margin:11px 0 0;color:#887d72;font-size:11px;line-height:1.45}
      .borai-text-size-panel .size-row{display:flex;align-items:center;justify-content:space-between;gap:8px}
      @media(max-width:600px){.bottom-nav .nav-item{font-size:10px}.map-actions{grid-template-columns:1fr}.borai-payment-section{padding:15px}.borai-payment-options{grid-template-columns:1fr}.borai-payment-method{min-height:70px;display:grid;grid-template-columns:38px minmax(0,1fr);column-gap:10px;row-gap:2px}.borai-payment-icon{grid-row:span 2}.borai-demo-copy{max-width:76%}.borai-demo-copy strong{font-size:19px}.borai-demo-art{width:76px;height:76px;right:13px;bottom:22px;font-size:36px}.welcome-visual .bia-callout{width:218px;min-height:270px}}
      @media(max-width:365px){.bottom-nav .nav-item{font-size:9px}.map-preview-top{padding:12px}}
    `;
    document.head.append(style);
  }

  function getTabs() {
    return {
      home: $('#homeView'), bia: $('#biaView'), map: $('#mapView'),
      preferences: $('#preferencesView'), plus: $('#plusView'), settings: $('#boraiSettingsView')
    };
  }

  let mapModulePromise = null;

  function loadMapModule() {
    if (window.BoraiMap) return Promise.resolve(window.BoraiMap);
    if (mapModulePromise) return mapModulePromise;
    mapModulePromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = './map-enhancements.js';
      script.async = true;
      script.onload = () => window.BoraiMap
        ? resolve(window.BoraiMap)
        : reject(new Error('O módulo do mapa não foi inicializado.'));
      script.onerror = () => reject(new Error('Não foi possível carregar o módulo do mapa. Verifique sua conexão.'));
      document.head.append(script);
    }).catch(error => {
      mapModulePromise = null;
      throw error;
    });
    return mapModulePromise;
  }

  function activateMap() {
    loadMapModule()
      .then(module => module.activate())
      .catch(error => showToast(error.message || 'Não foi possível abrir o mapa.'));
  }

  function setTab(name) {
    const tabs = getTabs();
    if (!tabs[name]) return;
    state.currentTab = name;
    Object.entries(tabs).forEach(([key, view]) => { if (view) view.hidden = key !== name; });
    $$('.nav-item[data-tab]').forEach(button => button.classList.toggle('active', button.dataset.tab === name));
    closeDrawer();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (name === 'map') activateMap();
  }

  function renderCity() {
    const label = $('#cityLabel');
    if (label) label.textContent = `${state.uf} - ${state.city}`;
    const mapLabel = $('#mapCityLabel');
    if (mapLabel) mapLabel.textContent = `${state.city} - ${state.uf}`;
  }

  function cityContext() { return `${state.city}, ${state.uf}, Brasil`; }

  function renderSavedRoutes() {
    const section = $('#savedSection');
    const container = $('#savedRoutes');
    if (!section || !container) return;
    const routes = state.demoRouteDismissed ? state.routes : [DEMO_ROUTE, ...state.routes];
    const fragment = document.createDocumentFragment();
    routes.forEach(route => {
      const article = document.createElement('article');
      article.className = 'saved-route';
      if (route.isDemoRoute) {
        article.classList.add('borai-demo-favorite');
        article.dataset.demoRouteCard = 'true';
      }
      const kicker = document.createElement('small');
      kicker.className = 'borai-route-kicker';
      kicker.textContent = route.isDemoRoute ? 'ROTA FAVORITA • EXEMPLO' : 'TRAJETO FAVORITO';
      const title = document.createElement('strong');
      title.className = 'borai-route-title';
      title.textContent = `${route.displayOrigin || route.origin} → ${route.displayDestination || route.destination}`;
      article.append(kicker, title);
      if (route.isDemoRoute) {
        const subtitle = document.createElement('small');
        subtitle.className = 'borai-route-subtitle';
        subtitle.textContent = 'Centro • Mogi das Cruzes';
        const tag = document.createElement('span');
        tag.className = 'borai-demo-tag';
        tag.textContent = '⚠ Aviso de trânsito simulado';
        const alert = document.createElement('button');
        alert.type = 'button'; alert.className = 'borai-demo-alert';
        alert.textContent = '!'; alert.title = 'Ver aviso de trânsito'; alert.dataset.demoIncident = 'true';
        alert.setAttribute('aria-label', 'Abrir aviso demonstrativo de trânsito');
        article.append(alert, subtitle, tag);
      }
      const actions = document.createElement('div');
      actions.className = 'borai-route-actions';
      const consult = document.createElement('button');
      consult.type = 'button'; consult.textContent = route.isDemoRoute ? 'Consultar rota' : 'Ver trajeto';
      consult.dataset.openRoute = String(route.id);
      actions.append(consult);
      if (route.isDemoRoute) {
        const incident = document.createElement('button');
        incident.type = 'button'; incident.textContent = 'Ver aviso'; incident.dataset.demoIncident = 'true';
        const remove = document.createElement('button');
        remove.type = 'button'; remove.textContent = 'Remover'; remove.dataset.removeDemoRoute = 'true';
        actions.append(incident, remove);
      } else {
        const remove = document.createElement('button');
        remove.type = 'button'; remove.textContent = 'Remover'; remove.dataset.removeRoute = String(route.id);
        actions.append(remove);
      }
      article.append(actions);
      fragment.append(article);
    });
    container.replaceChildren(fragment);
    section.hidden = routes.length === 0;
  }

  function saveRoute(origin, destination) {
    const entry = { id: Date.now(), origin, destination };
    state.routes = [entry, ...state.routes].slice(0, 6);
    if (!writeStore(KEYS.routes, state.routes)) {
      showToast('Não foi possível salvar o trajeto neste aparelho.');
      return false;
    }
    renderSavedRoutes();
    return true;
  }

  function showRouteDetails(route) {
    if (!route) return;
    openModal(`
      <p class="eyebrow">${route.isDemoRoute ? 'ROTA DE DEMONSTRAÇÃO' : 'TRAJETO FAVORITO'}</p>
      <h2 id="modalTitle">${escapeHtml(route.displayOrigin || route.origin)} → ${escapeHtml(route.displayDestination || route.destination)}</h2>
      ${route.isDemoRoute ? '<span class="borai-incident-label">⚠ AVISO SIMULADO</span><div class="borai-incident-modal"><strong>Trânsito intenso no entorno do Terminal Central</strong><p>Simulação de acidente na região, com possibilidade de atraso. Não é uma ocorrência real nem monitorada pelo Boraí.</p></div>' : '<p>Este trajeto está salvo nos seus favoritos neste aparelho.</p>'}
      <p>O cálculo integrado de itinerários de transporte público ainda está em desenvolvimento. Você pode localizar os pontos de partida e destino no mapa do Boraí.</p>
      <button class="primary-button" type="button" id="boraiRouteOriginMap">Localizar origem no Mapa</button>
      <button class="secondary-button" type="button" id="boraiRouteDestinationMap" style="width:100%;margin-top:9px">Localizar destino no Mapa</button>
      <button class="secondary-button" type="button" id="boraiRouteDetailsClose" style="width:100%;margin-top:9px">Fechar</button>`);
    $('#boraiRouteOriginMap')?.addEventListener('click', () => searchInMap(route.displayOrigin || route.origin));
    $('#boraiRouteDestinationMap')?.addEventListener('click', () => searchInMap(route.displayDestination || route.destination));
    $('#boraiRouteDetailsClose')?.addEventListener('click', closeModal);
  }

  function showIncidentNotice() {
    openModal(`
      <p class="eyebrow">CENTRAL DE AVISOS</p><h2 id="modalTitle">Atenção: trânsito intenso</h2>
      <span class="borai-incident-label">⚠ SIMULAÇÃO DE OCORRÊNCIA</span>
      <div class="borai-incident-modal"><strong>Acidente na região do Terminal Central</strong><p>Há trânsito intenso no entorno do Terminal Central por conta de um acidente. O trajeto pode levar mais tempo que o previsto.</p></div>
      <p>Considere sair com antecedência e conferir os canais oficiais de trânsito antes de iniciar a viagem.</p>
      <p class="demo-note">Este aviso é fictício e serve apenas para demonstrar uma futura função do Boraí. Não representa uma ocorrência real.</p>
      <button class="primary-button" type="button" id="boraiIncidentClose">Entendi</button>`);
    $('#boraiIncidentClose')?.addEventListener('click', closeModal);
  }

  function openRouteModal() {
    openModal(`
      <p class="eyebrow">PLANEJAMENTO DE VIAGEM</p><h2 id="modalTitle">Para onde vamos?</h2>
      <p>Informe a origem e o destino para salvar o trajeto. O cálculo de itinerários integrados ainda está em desenvolvimento.</p>
      <form id="routeForm">
        <div class="form-field"><label for="routeOrigin">Ponto de partida</label><input id="routeOrigin" required maxlength="120" placeholder="Ex.: Terminal Central"></div>
        <div class="form-field"><label for="routeDestination">Destino</label><input id="routeDestination" required maxlength="120" placeholder="Ex.: ETEC Presidente Vargas"></div>
        <label class="setting-line" style="border:0"><span>Salvar este trajeto nos favoritos</span><input id="saveRoute" type="checkbox" checked><i></i></label>
        <button class="primary-button" type="submit">Salvar trajeto</button>
      </form><div id="routeResult"></div>`);
    $('#routeForm')?.addEventListener('submit', event => {
      event.preventDefault();
      const origin = $('#routeOrigin').value.trim();
      const destination = $('#routeDestination').value.trim();
      if (!origin || !destination) return;
      if ($('#saveRoute').checked && !saveRoute(origin, destination)) return;
      $('#routeResult').innerHTML = '<div class="modal-result"><strong>Trajeto salvo</strong><span>O cálculo integrado de itinerários está em desenvolvimento. Você pode pesquisar a origem e o destino na aba Mapa.</span></div>';
      showToast($('#saveRoute').checked ? 'Trajeto adicionado aos favoritos.' : 'Consulta registrada nesta tela.');
    });
  }

  function openTransportModal() {
    openModal(`
      <p class="eyebrow">ENCONTRE UM MEIO DE TRANSPORTE</p><h2 id="modalTitle">O que você procura?</h2>
      <p>Escolha uma modalidade e pesquise locais no mapa integrado do Boraí.</p>
      <div class="form-field"><label for="transportType">Modalidade</label><select id="transportType"><option value="ponto de ônibus">Ônibus</option><option value="estação de trem CPTM">Trem / CPTM</option><option value="estação de metrô">Metrô</option><option value="terminal de transporte público">Terminais</option><option value="transporte público">Outros transportes públicos</option></select></div>
      <div class="form-field"><label for="transportArea">Bairro ou referência (opcional)</label><input id="transportArea" maxlength="80" placeholder="Ex.: Centro"></div>
      <button class="primary-button" type="button" id="searchTransport">Pesquisar no Mapa Boraí</button>
      <p class="demo-note">A pesquisa utiliza os dados cartográficos disponíveis no OpenStreetMap. A cobertura pode variar por região.</p>`);
    $('#searchTransport')?.addEventListener('click', () => {
      const type = $('#transportType').value;
      const area = $('#transportArea').value.trim();
      searchInMap([type, area, cityContext()].filter(Boolean).join(' '));
    });
  }

  function searchInMap(query) {
    closeModal();
    setTab('map');
    loadMapModule()
      .then(module => module.search(query))
      .catch(error => showToast(error.message || 'Não foi possível pesquisar no mapa.'));
  }

  function requestJson(url, timeoutMs = 12000) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error(`Serviço indisponível (HTTP ${response.status}).`);
        return response.json();
      })
      .catch(error => {
        if (error.name === 'AbortError') throw new Error('A consulta demorou demais. Tente novamente.');
        throw error;
      })
      .finally(() => window.clearTimeout(timeout));
  }

  let brazilStatesCache = null;
  const municipalityCache = new Map();

  async function getBrazilStates() {
    if (brazilStatesCache) return brazilStatesCache;
    const cached = readStore(KEYS.states, null);
    try {
      const data = await requestJson('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome');
      brazilStatesCache = data;
      writeStore(KEYS.states, data);
      return data;
    } catch (error) {
      if (Array.isArray(cached) && cached.length) { brazilStatesCache = cached; return cached; }
      throw error;
    }
  }

  async function getMunicipalities(uf) {
    if (municipalityCache.has(uf)) return municipalityCache.get(uf);
    const cacheKey = `borai-ibge-cities-${uf}`;
    const cached = readStore(cacheKey, null);
    try {
      const data = await requestJson(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${encodeURIComponent(uf)}/municipios?orderBy=nome`, 18000);
      municipalityCache.set(uf, data);
      writeStore(cacheKey, data);
      return data;
    } catch (error) {
      if (Array.isArray(cached) && cached.length) { municipalityCache.set(uf, cached); return cached; }
      throw error;
    }
  }

  async function populateMunicipalities(uf, preferredCity = '') {
    const select = $('#regionCity');
    const status = $('#regionStatus');
    const save = $('#regionSave');
    if (!select || !status || !save) return;
    select.disabled = true; save.disabled = true;
    status.textContent = 'Carregando municípios em ordem alfabética…';
    try {
      const cities = await getMunicipalities(uf);
      const fragment = document.createDocumentFragment();
      const placeholder = document.createElement('option');
      placeholder.value = ''; placeholder.textContent = 'Selecione um município';
      fragment.append(placeholder);
      cities.forEach(item => {
        const option = document.createElement('option');
        option.value = item.nome; option.textContent = item.nome;
        fragment.append(option);
      });
      select.replaceChildren(fragment);
      const match = cities.find(item => item.nome.toLocaleLowerCase('pt-BR') === String(preferredCity).toLocaleLowerCase('pt-BR'));
      select.value = match ? match.nome : '';
      select.disabled = false; save.disabled = !select.value;
      status.textContent = `${cities.length} municípios disponíveis neste estado, conforme a lista do IBGE.`;
    } catch (error) {
      select.replaceChildren(new Option('Lista indisponível', ''));
      status.textContent = 'Não foi possível carregar os municípios. Verifique a conexão e tente novamente.';
      save.disabled = true;
    }
  }

  async function openRegionModal() {
    openModal(`
      <p class="eyebrow">SUA REGIÃO</p><h2 id="modalTitle">Escolha sua cidade</h2>
      <p>Selecione o estado e o município. A lista de municípios é organizada em ordem alfabética.</p>
      <div class="form-field"><label for="regionState">Estado</label><select id="regionState" disabled><option>Carregando estados…</option></select></div>
      <div class="form-field"><label for="regionCity">Município</label><select id="regionCity" disabled><option>Selecione um estado primeiro</option></select></div>
      <p id="regionStatus" class="borai-region-help" aria-live="polite">Carregando lista oficial do IBGE…</p>
      <button class="primary-button" id="regionSave" type="button" disabled>Salvar região</button>`);
    const stateSelect = $('#regionState');
    try {
      const states = await getBrazilStates();
      if (!$('#regionState')) return;
      const fragment = document.createDocumentFragment();
      fragment.append(new Option('Selecione um estado', ''));
      states.forEach(item => fragment.append(new Option(`${item.nome} (${item.sigla})`, item.sigla)));
      stateSelect.replaceChildren(fragment);
      stateSelect.disabled = false;
      stateSelect.value = states.some(item => item.sigla === state.uf) ? state.uf : 'SP';
      await populateMunicipalities(stateSelect.value, state.city);
      stateSelect.addEventListener('change', () => populateMunicipalities(stateSelect.value, ''));
      $('#regionCity').addEventListener('change', event => { $('#regionSave').disabled = !event.target.value; });
      $('#regionSave').addEventListener('click', () => {
        const citySelect = $('#regionCity');
        if (!stateSelect.value || !citySelect.value) return;
        state.city = citySelect.value; state.uf = stateSelect.value;
        if (!writeStore(KEYS.city, state.city) || !writeStore(KEYS.state, state.uf)) {
          showToast('Não foi possível salvar a região neste aparelho.'); return;
        }
        renderCity(); closeModal(); showToast(`Região alterada para ${state.city} - ${state.uf}.`);
        if (window.BoraiMap) window.BoraiMap.regionChanged();
      });
    } catch (error) {
      const status = $('#regionStatus');
      if (status) status.textContent = 'Não foi possível carregar os estados brasileiros. Tente abrir esta tela novamente.';
    }
  }

  function openAboutModal() {
    openModal(`
      <p class="eyebrow">CONHEÇA O BORAÍ</p><h2 id="modalTitle">Mobilidade que aproxima</h2>
      <p>O Boraí é uma proposta de aplicativo de mobilidade urbana criada para reunir, em um só lugar, informações que ajudam as pessoas a organizar seus deslocamentos pela cidade.</p>
      <div class="modal-result"><strong>O que o Boraí pretende oferecer?</strong><p>Consulta de linhas e itinerários, horários de funcionamento, tarifas, estimativas de viagem, localização de veículos quando houver dados disponíveis e avisos sobre alterações no transporte público.</p></div>
      <p>Este aplicativo é um protótipo demonstrativo; algumas integrações e recursos próprios ainda estão em desenvolvimento.</p>
      <a class="primary-button borai-about-link" href="${ABOUT_URL}" target="_blank" rel="noopener noreferrer">Conhecer o site institucional ↗</a>
      <button class="secondary-button" type="button" id="aboutClose" style="width:100%;margin-top:9px">Fechar</button>`);
    $('#aboutClose')?.addEventListener('click', closeModal);
  }

  function renderProfilePreview() {
    const avatar = $('#boraiProfileAvatar');
    if (avatar) {
      avatar.replaceChildren();
      if (state.profile.photo) {
        const image = document.createElement('img'); image.src = state.profile.photo;
        image.alt = state.profile.name ? `Foto de perfil de ${state.profile.name}` : 'Foto de perfil';
        avatar.append(image);
      } else avatar.textContent = (state.profile.name || 'V').trim().charAt(0).toLocaleUpperCase('pt-BR');
    }
    const name = $('#boraiProfilePreviewName'); if (name) name.textContent = state.profile.name || 'Seu perfil';
    const email = $('#boraiProfilePreviewEmail'); if (email) email.textContent = state.profile.email || 'Informações opcionais';
    $$('.user-message').forEach(message => applyProfileToMessage(message));
  }

  function applyProfileToMessage(message) {
    const avatar = $('.message-avatar', message);
    const label = $('strong', message);
    if (!avatar) return;
    avatar.className = 'message-avatar user-profile-avatar';
    avatar.replaceChildren();
    if (state.profile.photo) {
      const image = document.createElement('img'); image.src = state.profile.photo;
      image.alt = state.profile.name ? `Foto de ${state.profile.name}` : 'Sua foto de perfil';
      avatar.append(image);
    } else avatar.textContent = (state.profile.name || 'V').trim().charAt(0).toLocaleUpperCase('pt-BR');
    if (label) label.textContent = state.profile.name || 'VOCÊ';
  }

  function formatPhone(value) {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits ? `(${digits}` : '';
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  function compressImage(file) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith('image/')) return reject(new Error('Selecione um arquivo de imagem.'));
      if (file.size > 8 * 1024 * 1024) return reject(new Error('A imagem deve ter até 8 MB.'));
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Não foi possível abrir essa imagem.'));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error('O arquivo selecionado não é uma imagem válida.'));
        image.onload = () => {
          const scale = Math.min(1, 320 / Math.max(image.width, image.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          const context = canvas.getContext('2d');
          if (!context) return reject(new Error('Não foi possível preparar esta imagem.'));
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          try { resolve(canvas.toDataURL('image/jpeg', 0.76)); }
          catch (_) { reject(new Error('Não foi possível salvar esta imagem.')); }
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function bindProfile() {
    $('#boraiProfilePhone')?.addEventListener('input', event => { event.target.value = formatPhone(event.target.value); });
    $('#boraiProfilePhoto')?.addEventListener('change', async event => {
      const file = event.target.files && event.target.files[0]; if (!file) return;
      try { state.profile.photo = await compressImage(file); renderProfilePreview(); showToast('Foto preparada. Salve as configurações para confirmar.'); }
      catch (error) { showToast(error.message); event.target.value = ''; }
    });
    $('#boraiRemovePhoto')?.addEventListener('click', () => { state.profile.photo = ''; $('#boraiProfilePhoto').value = ''; renderProfilePreview(); });
    $('#boraiClearProfile')?.addEventListener('click', () => {
      if (!window.confirm('Apagar nome, e-mail, telefone, endereço e foto salvos neste aparelho?')) return;
      state.profile = { ...DEFAULT_PROFILE }; writeStore(KEYS.profile, state.profile);
      $('#boraiProfileForm')?.reset(); renderProfilePreview(); showToast('Dados de perfil apagados deste aparelho.');
    });
    $('#boraiProfileForm')?.addEventListener('submit', event => {
      event.preventDefault();
      state.profile.name = $('#boraiProfileName').value.trim();
      state.profile.email = $('#boraiProfileEmail').value.trim();
      state.profile.phone = $('#boraiProfilePhone').value.trim();
      state.profile.residence = $('#boraiProfileResidence').value.trim();
      if (!writeStore(KEYS.profile, state.profile)) { showToast('Não foi possível salvar. Tente remover a foto ou liberar espaço.'); return; }
      renderProfilePreview(); showToast('Configurações salvas neste aparelho.');
    });
  }

  function createBiaAvatar() {
    const avatar = document.createElement('span'); avatar.className = 'message-avatar bia-message-avatar';
    const face = document.createElement('span'); face.className = 'bot-face';
    face.append(document.createElement('i'), document.createElement('i'), document.createElement('b'));
    avatar.append(face); return avatar;
  }

  function appendMessage(messageText, who, label) {
    const message = document.createElement('div');
    message.className = `message ${who === 'user' ? 'user-message' : 'bot-message'}`;
    const avatar = who === 'user' ? document.createElement('span') : createBiaAvatar();
    if (who === 'user') { avatar.className = 'message-avatar'; avatar.textContent = 'V'; }
    const body = document.createElement('div');
    const name = document.createElement('strong'); name.textContent = who === 'user' ? (state.profile.name || 'VOCÊ') : 'BIA';
    const paragraph = document.createElement('p'); paragraph.textContent = messageText;
    body.append(name, paragraph);
    if (who !== 'user') { const small = document.createElement('small'); small.textContent = label || 'Assistente Boraí'; body.append(small); }
    message.append(avatar, body); $('#chatMessages')?.append(message);
    if (who === 'user') applyProfileToMessage(message);
    const chat = $('#chatMessages'); if (chat) chat.scrollTop = chat.scrollHeight;
    return message;
  }

  async function sendBia(rawText) {
    const question = String(rawText || '').trim();
    if (!question || state.biaSending) return;
    state.biaSending = true;
    const input = $('#chatInput'); const button = $('#chatForm button[type="submit"]');
    appendMessage(question, 'user');
    if (input) { input.value = ''; input.disabled = true; }
    if (button) { button.disabled = true; button.textContent = '…'; }
    const typing = appendMessage('Estou pensando na melhor resposta…', 'bot', 'BIA está respondendo');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 28000);
    try {
      const response = await fetch(BIA_API_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ message: question, history: state.biaHistory.slice(-10), city: state.city })
      });
      let data = {}; try { data = await response.json(); } catch (_) {}
      if (!response.ok) throw new Error(data.error || `Erro de conexão (${response.status}).`);
      const answer = typeof data.reply === 'string' ? data.reply.trim() : '';
      if (!answer) throw new Error('A BIA recebeu uma resposta vazia. Tente novamente.');
      state.biaHistory.push({ role: 'user', text: question }, { role: 'model', text: answer });
      if (state.biaHistory.length > 12) state.biaHistory.splice(0, state.biaHistory.length - 12);
      typing.remove(); appendMessage(answer, 'bot', 'BIA • Gemini');
    } catch (error) {
      typing.remove();
      const message = error.name === 'AbortError' ? 'A resposta demorou demais. Verifique sua conexão e tente novamente.' : `${error.message || 'Não consegui acessar a BIA agora.'} Confira sua conexão e tente novamente.`;
      appendMessage(message, 'bot', 'Aviso de conexão');
    } finally {
      window.clearTimeout(timeout); state.biaSending = false;
      if (input) { input.disabled = false; input.focus(); }
      if (button) { button.disabled = false; button.textContent = '➤'; }
    }
  }

  function buildAdCarousel() {
    const section = $('#adSection');
    if (!section) return;
    const original = $('.ad-banner', section);
    if (!original) return;
    const track = document.createElement('div'); track.className = 'borai-ad-track';
    track.setAttribute('aria-label', 'Anúncios demonstrativos'); track.tabIndex = 0;
    const first = document.createElement('article'); first.className = 'borai-ad-slide'; first.append(original); track.append(first);
    const promotions = [
      { theme: 'theme-partner', tag: 'Parceria demonstrativa', title: 'Café da Estação: uma pausa no caminho.', desc: 'Exemplo fictício de divulgação de um comércio local.', action: 'Ver exemplo', art: '☕', message: 'Este é um exemplo fictício de parceria. Nenhuma empresa foi contratada pelo Boraí.' },
      { theme: 'theme-city', tag: 'Anúncio demonstrativo', title: 'Boraí+ — sua mobilidade sem interrupções.', desc: 'Conheça a experiência sem anúncios e os recursos extras da BIA.', action: 'Ver planos', art: '✦', plus: true }
    ];
    promotions.forEach(promo => {
      const slide = document.createElement('article'); slide.className = 'borai-ad-slide';
      const banner = document.createElement('div'); banner.className = `borai-demo-banner ${promo.theme}`;
      const copy = document.createElement('div'); copy.className = 'borai-demo-copy';
      const tag = document.createElement('span'); tag.className = 'borai-demo-tag'; tag.textContent = promo.tag;
      const title = document.createElement('strong'); title.textContent = promo.title;
      const desc = document.createElement('span'); desc.textContent = promo.desc;
      const action = document.createElement('button'); action.type = 'button'; action.textContent = promo.action;
      action.addEventListener('click', () => promo.plus ? setTab('plus') : showToast(promo.message));
      copy.append(tag, title, desc, action);
      const art = document.createElement('div'); art.className = 'borai-demo-art'; art.setAttribute('aria-hidden', 'true'); art.textContent = promo.art;
      banner.append(copy, art); slide.append(banner); track.append(slide);
    });
    const dots = document.createElement('div'); dots.className = 'borai-ad-dots'; dots.setAttribute('role', 'group'); dots.setAttribute('aria-label', 'Escolher anúncio');
    const dotButtons = [];
    for (let index = 0; index < 3; index += 1) {
      const dot = document.createElement('button'); dot.type = 'button'; dot.className = 'borai-ad-dot';
      dot.setAttribute('aria-label', `Mostrar anúncio ${index + 1}`); dot.setAttribute('aria-current', String(index === 0));
      dot.addEventListener('click', () => track.scrollTo({ left: index * track.clientWidth, behavior: 'smooth' }));
      dots.append(dot); dotButtons.push(dot);
    }
    const updateDots = () => {
      const index = Math.max(0, Math.min(2, Math.round(track.scrollLeft / Math.max(1, track.clientWidth))));
      dotButtons.forEach((dot, i) => dot.setAttribute('aria-current', String(i === index)));
    };
    track.addEventListener('scroll', updateDots, { passive: true });
    track.addEventListener('keydown', event => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const current = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
      const next = Math.max(0, Math.min(2, current + (event.key === 'ArrowRight' ? 1 : -1)));
      track.scrollTo({ left: next * track.clientWidth, behavior: 'smooth' });
    });
    section.replaceChildren(track, dots);
  }

  function addPaymentSection() {
    const plans = $('.plans-grid', $('#plusView'));
    if (!plans || $('#boraiPaymentSection')) return;
    const section = document.createElement('section');
    section.id = 'boraiPaymentSection'; section.className = 'borai-payment-section';
    section.innerHTML = `
      <h2>Formas de pagamento</h2><p class="borai-payment-intro">Escolha uma opção para visualizar como a contratação do Boraí+ poderá funcionar.</p>
      <div class="borai-payment-options">
        <button type="button" class="borai-payment-method" data-payment="Pix" aria-pressed="false"><span class="borai-payment-icon">PIX</span><strong>Pix</strong><small>Pagamento instantâneo</small></button>
        <button type="button" class="borai-payment-method" data-payment="Boleto bancário" aria-pressed="false"><span class="borai-payment-icon">▤</span><strong>Boleto</strong><small>Pagamento por boleto bancário</small></button>
        <button type="button" class="borai-payment-method" data-payment="Cartão de crédito" aria-pressed="false"><span class="borai-payment-icon">▰</span><strong>Cartão de crédito</strong><small>Pagamento com cartão</small></button>
      </div>
      <p class="borai-payment-summary" id="paymentSummary" aria-live="polite">Selecione um plano acima e uma forma de pagamento.</p>
      <button type="button" class="borai-payment-confirm" id="paymentConfirm" disabled>Continuar</button>
      <p class="borai-payment-footnote">Demonstração acadêmica: nenhum pagamento será processado. Não informe dados de cartão ou conta.</p>`;
    plans.insertAdjacentElement('afterend', section);
  }

  function updatePaymentSummary() {
    const summary = $('#paymentSummary'); const confirm = $('#paymentConfirm');
    if (!summary || !confirm) return;
    if (state.selectedPlan && state.selectedPayment) {
      summary.textContent = `Selecionado: plano ${state.selectedPlan.name} (${state.selectedPlan.price}) • ${state.selectedPayment}.`;
      confirm.textContent = 'Continuar com esta opção'; confirm.disabled = false;
    } else if (state.selectedPlan) {
      summary.textContent = `Plano ${state.selectedPlan.name} (${state.selectedPlan.price}) selecionado. Agora escolha uma forma de pagamento.`;
      confirm.textContent = 'Escolha uma forma de pagamento'; confirm.disabled = true;
    } else if (state.selectedPayment) {
      summary.textContent = `${state.selectedPayment} selecionado. Agora escolha um plano.`;
      confirm.textContent = 'Escolha um plano'; confirm.disabled = true;
    } else {
      summary.textContent = 'Selecione um plano acima e uma forma de pagamento.';
      confirm.textContent = 'Continuar'; confirm.disabled = true;
    }
  }

  function showPaymentConfirmation() {
    if (!state.selectedPlan || !state.selectedPayment) return;
    openModal(`<p class="eyebrow">BORAÍ+</p><h2 id="modalTitle">Resumo da assinatura</h2><div class="modal-result"><strong>Plano ${escapeHtml(state.selectedPlan.name)} — ${escapeHtml(state.selectedPlan.price)}</strong><span>Forma de pagamento escolhida: ${escapeHtml(state.selectedPayment)}.</span></div><p>Esta é apenas uma simulação. Nenhum Pix, boleto ou cobrança no cartão será gerado.</p><button class="primary-button" type="button" id="paymentClose">Fechar</button>`);
    $('#paymentClose')?.addEventListener('click', closeModal);
  }

  function makeBiaDraggable() {
    const stage = $('.welcome-visual'); const callout = $('.welcome-visual .bia-callout'); const orb = $('#openBiaButton');
    if (!stage || !callout || !orb) return;
    const clamp = (n, min, max) => Math.min(Math.max(n, min), Math.max(min, max));
    const saved = readStore('borai-bia-orb-position-v1', null);
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
      callout.style.left = `${saved.x}px`; callout.style.top = `${saved.y}px`; callout.style.right = 'auto';
    }
    let pointerId = null; let startX = 0; let startY = 0; let baseX = 0; let baseY = 0; let moved = false;
    orb.addEventListener('pointerdown', event => {
      if (event.button !== undefined && event.button !== 0) return;
      const stageRect = stage.getBoundingClientRect(); const rect = callout.getBoundingClientRect();
      pointerId = event.pointerId; startX = event.clientX; startY = event.clientY;
      baseX = rect.left - stageRect.left; baseY = rect.top - stageRect.top; moved = false;
      try { orb.setPointerCapture(event.pointerId); } catch (_) {}
    });
    orb.addEventListener('pointermove', event => {
      if (pointerId !== event.pointerId) return;
      const dx = event.clientX - startX; const dy = event.clientY - startY;
      if (!moved && Math.hypot(dx, dy) < 7) return;
      moved = true; event.preventDefault();
      const maxX = stage.clientWidth - callout.offsetWidth; const maxY = stage.clientHeight - callout.offsetHeight;
      callout.style.left = `${clamp(baseX + dx, 0, maxX)}px`;
      callout.style.top = `${clamp(baseY + dy, 0, maxY)}px`; callout.style.right = 'auto';
      orb.classList.add('is-dragging');
    });
    const finish = event => {
      if (pointerId === null || (event && event.pointerId !== pointerId)) return;
      if (moved) {
        writeStore('borai-bia-orb-position-v1', { x: parseFloat(callout.style.left) || 0, y: parseFloat(callout.style.top) || 0 });
        orb.dataset.suppressClick = 'true';
      }
      pointerId = null; orb.classList.remove('is-dragging');
    };
    orb.addEventListener('pointerup', finish); orb.addEventListener('pointercancel', finish);
  }

  function loadPreferences() {
    $$('[data-pref]').forEach(input => { input.checked = Boolean(state.preferences[input.dataset.pref]); });
    document.body.classList.toggle('large-text-mode', Boolean(state.preferences.largeText));
  }

  function handleClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const drawerTab = target.closest('[data-drawer-tab]');
    if (drawerTab) { setTab(drawerTab.dataset.drawerTab); return; }
    const navTab = target.closest('.nav-item[data-tab]');
    if (navTab) { setTab(navTab.dataset.tab); return; }
    if (target.closest('#menuButton')) { openDrawer(); return; }
    if (target.closest('#closeDrawer, #drawerBackdrop')) { closeDrawer(); return; }
    if (target.closest('#cityPicker')) { openRegionModal(); return; }
    if (target.closest('#addRouteButton, #routeArrow, #mapRouteButton')) { openRouteModal(); return; }
    if (target.closest('#addTransportButton, #transportArrow, #mapTransportButton')) { openTransportModal(); return; }
    if (target.closest('#openBiaButton')) {
      if ($('#openBiaButton').dataset.suppressClick === 'true') { delete $('#openBiaButton').dataset.suppressClick; event.preventDefault(); return; }
      setTab('bia'); return;
    }
    if (target.closest('#modalClose')) { closeModal(); return; }
    if (target === $('#modalBackdrop')) { closeModal(); return; }
    if (target.closest('[data-drawer-settings]')) { setTab('settings'); return; }
    if (target.closest('[data-borai-about]')) { closeDrawer(); openAboutModal(); return; }
    if (target.closest('[data-demo-incident]')) { showIncidentNotice(); return; }
    const removeDemo = target.closest('[data-remove-demo-route]');
    if (removeDemo) { state.demoRouteDismissed = true; renderSavedRoutes(); showToast('Rota de demonstração removida até você reabrir o site.'); return; }
    const openRoute = target.closest('[data-open-route]');
    if (openRoute) {
      const id = openRoute.dataset.openRoute;
      const route = id === DEMO_ROUTE.id ? DEMO_ROUTE : state.routes.find(item => String(item.id) === id);
      showRouteDetails(route); return;
    }
    const removeRoute = target.closest('[data-remove-route]');
    if (removeRoute) {
      state.routes = state.routes.filter(item => String(item.id) !== removeRoute.dataset.removeRoute);
      writeStore(KEYS.routes, state.routes); renderSavedRoutes(); showToast('Trajeto removido dos favoritos.'); return;
    }
    const plan = target.closest('.plan-card');
    if (plan) {
      $$('.plan-card').forEach(card => { const selected = card === plan; card.classList.toggle('borai-plan-selected', selected); card.setAttribute('aria-pressed', String(selected)); });
      state.selectedPlan = { name: plan.dataset.plan || 'Mensal', price: $('strong', plan)?.textContent.trim() || '' };
      updatePaymentSummary(); return;
    }
    const payment = target.closest('[data-payment]');
    if (payment) {
      $$('.borai-payment-method').forEach(button => { const selected = button === payment; button.setAttribute('aria-pressed', String(selected)); });
      state.selectedPayment = payment.dataset.payment || ''; updatePaymentSummary(); return;
    }
    if (target.closest('#paymentConfirm')) { showPaymentConfirmation(); return; }
    if (target.closest('#closeAdButton')) { $('#adSection').hidden = true; state.adClosed = true; showToast('Anúncio fechado.'); return; }
    if (target.closest('#adLearnMore')) { showToast('Espaço publicitário demonstrativo do Boraí.'); return; }
  }

  function handleSubmit(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (form.id === 'chatForm') { event.preventDefault(); sendBia($('#chatInput').value); return; }
    if (form.id === 'searchForm') {
      event.preventDefault();
      const term = $('#globalSearch').value.trim(); if (!term) return;
      if (/bia|ajuda|assistente/i.test(term)) { setTab('bia'); $('#chatInput').value = term; $('#chatInput').focus(); }
      else {
        openModal(`<p class="eyebrow">PESQUISA</p><h2 id="modalTitle">Pesquisar “${escapeHtml(term)}”</h2><p>Escolha onde deseja procurar essa informação.</p><button class="primary-button" type="button" id="searchMapButton">Pesquisar na aba Mapa</button><button class="secondary-button" type="button" id="searchBiaButton" style="width:100%;margin-top:10px">Perguntar à BIA</button>`);
        $('#searchMapButton')?.addEventListener('click', () => searchInMap(term));
        $('#searchBiaButton')?.addEventListener('click', () => { closeModal(); setTab('bia'); sendBia(term); });
      }
    }
  }

  function bindPreferences() {
    $$('[data-pref]').forEach(input => input.addEventListener('change', () => {
      state.preferences[input.dataset.pref] = input.checked;
      writeStore(KEYS.preferences, state.preferences);
      document.body.classList.toggle('large-text-mode', Boolean(state.preferences.largeText));
      const status = $('#preferencesSaved'); if (status) status.textContent = 'Preferências atualizadas e salvas neste aparelho.';
    }));
    $$('.suggestion-chips button').forEach(button => button.addEventListener('click', () => sendBia(button.dataset.prompt || '')));
  }

  function initialize() {
    buildMapView(); addNavigationItems(); buildSettingsView(); injectStyles();
    renderCity(); renderSavedRoutes(); loadPreferences(); buildAdCarousel(); addPaymentSection(); bindProfile(); bindPreferences(); makeBiaDraggable();
    const initialAvatar = $('.chat-messages .bot-message .message-avatar');
    if (initialAvatar) initialAvatar.replaceWith(createBiaAvatar());
    const miniBia = $('.mini-bia');
    if (miniBia) { miniBia.replaceChildren(); const face = document.createElement('span'); face.className = 'bot-face'; face.append(document.createElement('i'), document.createElement('i'), document.createElement('b')); miniBia.append(face); }
    document.addEventListener('click', handleClick);
    document.addEventListener('submit', handleSubmit);
    document.addEventListener('keydown', event => { if (event.key === 'Escape') { closeModal(); closeDrawer(); } });
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}), { once: true });
    }
  }

  window.BoraiApp = {
    setTab,
    getRegion: () => ({ city: state.city, state: state.uf }),
    showToast
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();
