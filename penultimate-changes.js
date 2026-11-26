/* Boraí — penúltima atualização demonstrativa
 * Adiciona uma rota favorita de exemplo com alerta simulado e formas de pagamento
 * ilustrativas para o Boraí+. Não consulta incidentes reais nem processa pagamentos.
 * Carregar depois dos scripts atuais do aplicativo.
 */
(() => {
  'use strict';

  if (window.__boraiPenultimateChangesInstalled) return;
  window.__boraiPenultimateChangesInstalled = true;

  const $ = (selector, root = document) => root.querySelector(selector);
  const ROUTES_KEY = 'borai-routes';
  const DEMO_ROUTE_ID = 900000026;
  const DEMO_ROUTE = {
    id: DEMO_ROUTE_ID,
    origin: 'Terminal Central, Rua Professor Flaviano de Melo, 525',
    destination: 'ETEC Presidente Vargas, Rua Coronel Cardoso de Siqueira, 801',
    displayOrigin: 'Terminal Central',
    displayDestination: 'ETEC Presidente Vargas',
    city: 'Mogi das Cruzes',
    state: 'SP',
    isDemoRoute: true
  };

  function readStore(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
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

  function normalize(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  function favoriteRoutesForDisplay() {
    const stored = readStore(ROUTES_KEY, []);
    const routes = Array.isArray(stored) ? stored.filter(route => route && typeof route === 'object') : [];
    const userRoutes = routes.filter(route => !(
      route.isDemoRoute === true ||
      (normalize(route.origin).includes('terminal central') && normalize(route.destination).includes('etec presidente vargas'))
    ));

    // A rota de exemplo aparece sempre na lista, mas não altera nem ocupa espaço
    // no armazenamento dos favoritos pessoais do usuário.
    return [DEMO_ROUTE, ...userRoutes];
  }

  function currentRegion(route) {
    if (route && route.isDemoRoute) {
      return { city: DEMO_ROUTE.city, state: DEMO_ROUTE.state };
    }
    const city = readStore('borai-city', 'Mogi das Cruzes');
    const state = readStore('borai-state', 'SP');
    return {
      city: typeof city === 'string' && city.trim() ? city.trim() : 'Mogi das Cruzes',
      state: typeof state === 'string' && state.trim() ? state.trim() : 'SP'
    };
  }

  function routeUrl(route) {
    const region = currentRegion(route);
    const params = new URLSearchParams({
      api: '1',
      origin: `${route.origin}, ${region.city}, ${region.state}, Brasil`,
      destination: `${route.destination}, ${region.city}, ${region.state}, Brasil`,
      travelmode: 'transit'
    });
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }

  function addStyles() {
    if ($('#borai-penultimate-style')) return;
    const style = document.createElement('style');
    style.id = 'borai-penultimate-style';
    style.textContent = `
      .borai-demo-favorite{position:relative;border:1px solid #efbf8f!important;background:linear-gradient(145deg,#fffaf4,#fff4e8)!important;padding:15px 54px 15px 15px!important;box-shadow:0 4px 14px rgba(142,75,19,.06)}
      .saved-route .borai-demo-alert{position:absolute;right:13px;top:13px;width:32px;height:32px;margin:0!important;padding:0!important;border:0!important;border-radius:50%;background:#f6a300!important;color:#fff!important;font-size:21px;font-weight:900;line-height:1;box-shadow:0 2px 7px rgba(142,88,0,.22);text-decoration:none!important;cursor:pointer}
      .borai-route-kicker{display:block;color:#a9540b!important;font-size:11px!important;font-weight:800;letter-spacing:.45px}
      .borai-route-title{display:block;margin:7px 0 5px;color:#382a20;font-size:16px;line-height:1.35}
      .borai-route-subtitle{display:block;color:#84776b;font-size:11px;line-height:1.4;margin:0 0 8px}
      .borai-demo-alert:focus-visible,.borai-payment-method:focus-visible,.borai-payment-confirm:focus-visible{outline:3px solid #9d4d0b;outline-offset:3px}
      .borai-route-actions{display:flex;gap:14px;flex-wrap:wrap;align-items:center}
      .saved-route .borai-route-actions button{margin-top:5px;border:0!important;background:transparent!important;color:#a94d00!important;text-decoration:underline;cursor:pointer;padding:3px 0;font-size:12px;font-weight:700}
      .plan-card.borai-plan-selected{border-color:#e87500!important;background:#fff0df!important;box-shadow:0 0 0 3px rgba(232,117,0,.12)}
      .borai-demo-tag{display:inline-flex;align-items:center;gap:5px;margin-top:6px;padding:4px 8px;border-radius:20px;background:#fff0d5;color:#87500d;font-size:10px;font-weight:800}
      .borai-incident-label{display:inline-flex;margin:0 0 12px;padding:6px 10px;border-radius:18px;background:#fff0d6;color:#8a5100;font-size:11px;font-weight:900;letter-spacing:.5px}
      .borai-incident-modal{border:1px solid #f0d2ad;border-radius:15px;background:#fff8ed;padding:15px;margin:12px 0}
      .borai-incident-modal strong{display:block;color:#8c3e12;margin-bottom:6px}
      .borai-incident-modal p{margin:0;color:#5f5146;line-height:1.55}
      .borai-payment-section{max-width:680px;margin:25px auto 0;padding:20px;border:1px solid #f0d4b8;border-radius:18px;background:#fffaf4}
      .borai-payment-section h2{margin:0 0 5px;font-size:21px;color:#3d3026}
      .borai-payment-intro{margin:0 0 15px;color:#817468;font-size:13px;line-height:1.45}
      .borai-payment-options{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
      .borai-payment-method{min-width:0;min-height:112px;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:6px;padding:13px;border:1.5px solid #ebd0b4;border-radius:14px;background:#fff;color:#43372e;text-align:left;cursor:pointer;transition:border-color .16s,background .16s,box-shadow .16s}
      .borai-payment-method[aria-pressed="true"]{border-color:#e87500;background:#fff0df;box-shadow:0 0 0 2px rgba(232,117,0,.12)}
      .borai-payment-icon{width:34px;height:34px;display:grid;place-items:center;border-radius:10px;background:#ffead5;color:#a94e00;font-size:15px;font-weight:900}
      .borai-payment-method strong{font-size:14px}
      .borai-payment-method small{font-size:10px;color:#88796d;line-height:1.35}
      .borai-payment-summary{margin:14px 0 0;padding:11px 12px;border-radius:11px;background:#fff2e5;color:#765037;font-size:12px;line-height:1.45}
      .borai-payment-confirm{width:100%;min-height:48px;margin-top:12px;border:0;border-radius:12px;background:#e97800;color:#fff;font-size:14px;font-weight:800;cursor:pointer}
      .borai-payment-confirm:disabled{background:#c9b9a8;color:#fff;cursor:not-allowed}
      .borai-payment-footnote{margin:11px 0 0;color:#887d72;font-size:11px;line-height:1.45}
      @media(max-width:560px){
        .borai-payment-section{padding:15px;margin-top:21px}
        .borai-payment-options{grid-template-columns:1fr}
        .borai-payment-method{min-height:72px;display:grid;grid-template-columns:38px minmax(0,1fr);column-gap:10px;row-gap:2px;align-content:center}
        .borai-payment-icon{grid-row:span 2}
      }
    `;
    document.head.append(style);
  }

  function showModal(html) {
    const backdrop = $('#modalBackdrop');
    const content = $('#modalContent');
    if (!backdrop || !content) return;
    content.innerHTML = html;
    backdrop.hidden = false;
  }

  function openIncidentNotice() {
    showModal(`
      <p class="eyebrow">CENTRAL DE AVISOS</p>
      <h2 id="modalTitle">Atenção: trânsito intenso</h2>
      <span class="borai-incident-label">⚠ SIMULAÇÃO DE OCORRÊNCIA</span>
      <div class="borai-incident-modal">
        <strong>Acidente na região do Terminal Central</strong>
        <p>Há trânsito intenso no entorno do Terminal Central por conta de um acidente. O trajeto pode levar mais tempo que o previsto, aumentando as chances de atraso.</p>
      </div>
      <p>Considere sair com antecedência e conferir os canais oficiais de trânsito antes de iniciar a viagem.</p>
      <p class="demo-note">Este aviso é fictício e serve apenas para demonstrar como o Boraí poderá comunicar problemas no transporte. Não representa uma ocorrência real ou monitorada pelo aplicativo.</p>
      <button class="primary-button" type="button" id="boraiIncidentClose">Entendi</button>
    `);
    const close = $('#boraiIncidentClose');
    if (close) close.addEventListener('click', () => { $('#modalBackdrop').hidden = true; });
  }

  function createRouteCard(route) {
    const article = document.createElement('article');
    article.className = 'saved-route';
    const heading = document.createElement('small');
    heading.className = 'borai-route-kicker';
    heading.textContent = route.isDemoRoute ? 'ROTA FAVORITA • EXEMPLO' : 'TRAJETO FAVORITO';
    article.append(heading);

    const title = document.createElement('strong');
    title.className = 'borai-route-title';
    title.textContent = `${route.displayOrigin || route.origin} → ${route.displayDestination || route.destination}`;
    article.append(title);

    if (route.isDemoRoute) {
      article.classList.add('borai-demo-favorite');
      article.dataset.boraiDemoCard = 'true';
      const alert = document.createElement('button');
      alert.type = 'button';
      alert.className = 'borai-demo-alert';
      alert.textContent = '!';
      alert.setAttribute('aria-label', 'Abrir aviso demonstrativo de trânsito');
      alert.title = 'Ver aviso de trânsito';
      alert.dataset.boraiIncident = 'true';
      article.append(alert);

      const subtitle = document.createElement('small');
      subtitle.className = 'borai-route-subtitle';
      subtitle.textContent = 'Centro • Mogi das Cruzes';
      article.append(subtitle);

      const tag = document.createElement('span');
      tag.className = 'borai-demo-tag';
      tag.textContent = '⚠ Aviso de trânsito simulado';
      article.append(tag);
    }

    const actions = document.createElement('div');
    actions.className = 'borai-route-actions';
    const open = document.createElement('button');
    open.type = 'button';
    open.textContent = 'Consultar rota ↗';
    open.dataset.boraiOpenRoute = String(route.id);
    actions.append(open);

    if (!route.isDemoRoute) {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Remover';
      remove.dataset.boraiRemoveRoute = String(route.id);
      actions.append(remove);
    } else {
      const alertLink = document.createElement('button');
      alertLink.type = 'button';
      alertLink.textContent = 'Ver aviso';
      alertLink.dataset.boraiIncident = 'true';
      actions.append(alertLink);
    }

    article.append(actions);
    return article;
  }

  function renderFavoriteRoutes() {
    const section = $('#savedSection');
    const container = $('#savedRoutes');
    if (!section || !container) return;

    const routes = favoriteRoutesForDisplay();
    const signature = JSON.stringify(routes);
    const alreadyRendered = container.dataset.boraiRoutesSignature === signature &&
      container.querySelector('[data-borai-demo-card="true"]') &&
      container.children.length === routes.length;
    if (alreadyRendered) return;

    const fragment = document.createDocumentFragment();
    routes.forEach(route => fragment.append(createRouteCard(route)));
    container.replaceChildren(fragment);
    container.dataset.boraiRoutesSignature = signature;
    section.hidden = routes.length === 0;
  }

  function installFavoriteRoutes() {
    renderFavoriteRoutes();
    const container = $('#savedRoutes');
    if (!container || !('MutationObserver' in window)) return;
    const observer = new MutationObserver(() => renderFavoriteRoutes());
    observer.observe(container, { childList: true });
  }

  function addPaymentSection() {
    const plans = $('.plans-grid', $('#plusView'));
    if (!plans || $('#boraiPaymentSection')) return;

    const section = document.createElement('section');
    section.id = 'boraiPaymentSection';
    section.className = 'borai-payment-section';
    section.setAttribute('aria-labelledby', 'boraiPaymentTitle');
    section.innerHTML = `
      <h2 id="boraiPaymentTitle">Formas de pagamento</h2>
      <p class="borai-payment-intro">Escolha uma opção para visualizar como a contratação do Boraí+ poderá funcionar.</p>
      <div class="borai-payment-options">
        <button type="button" class="borai-payment-method" data-borai-payment="Pix" aria-pressed="false">
          <span class="borai-payment-icon" aria-hidden="true">PIX</span>
          <strong>Pix</strong><small>Pagamento instantâneo</small>
        </button>
        <button type="button" class="borai-payment-method" data-borai-payment="Boleto bancário" aria-pressed="false">
          <span class="borai-payment-icon" aria-hidden="true">▤</span>
          <strong>Boleto</strong><small>Pagamento por boleto bancário</small>
        </button>
        <button type="button" class="borai-payment-method" data-borai-payment="Cartão de crédito" aria-pressed="false">
          <span class="borai-payment-icon" aria-hidden="true">▰</span>
          <strong>Cartão de crédito</strong><small>Pagamento com cartão</small>
        </button>
      </div>
      <p class="borai-payment-summary" id="boraiPaymentSummary" aria-live="polite">Selecione um plano acima e uma forma de pagamento.</p>
      <button type="button" class="borai-payment-confirm" id="boraiPaymentConfirm" disabled>Continuar</button>
      <p class="borai-payment-footnote">Demonstração acadêmica: nenhum pagamento será processado. Não informe dados de cartão ou conta. A contratação real dependeria de uma integração segura com um provedor de pagamentos.</p>
    `;
    plans.insertAdjacentElement('afterend', section);
  }

  let selectedPlan = null;
  let selectedPayment = '';

  function updatePaymentSummary() {
    const summary = $('#boraiPaymentSummary');
    const confirm = $('#boraiPaymentConfirm');
    if (!summary || !confirm) return;

    if (selectedPlan && selectedPayment) {
      summary.textContent = `Selecionado: plano ${selectedPlan.name} (${selectedPlan.price}) • ${selectedPayment}.`;
      confirm.textContent = 'Continuar com esta opção';
      confirm.disabled = false;
    } else if (selectedPlan) {
      summary.textContent = `Plano ${selectedPlan.name} (${selectedPlan.price}) selecionado. Agora escolha uma forma de pagamento.`;
      confirm.textContent = 'Escolha uma forma de pagamento';
      confirm.disabled = true;
    } else if (selectedPayment) {
      summary.textContent = `${selectedPayment} selecionado. Agora escolha um plano do Boraí+ acima.`;
      confirm.textContent = 'Escolha um plano';
      confirm.disabled = true;
    } else {
      summary.textContent = 'Selecione um plano acima e uma forma de pagamento.';
      confirm.textContent = 'Continuar';
      confirm.disabled = true;
    }
  }

  function selectPlan(button) {
    const plus = $('#plusView');
    if (!plus) return;
    $$('.plan-card', plus).forEach(card => {
      const selected = card === button;
      card.classList.toggle('borai-plan-selected', selected);
      card.setAttribute('aria-pressed', String(selected));
    });
    const name = button.dataset.plan || 'Mensal';
    const price = $('strong', button)?.textContent.trim() || '';
    selectedPlan = { name, price };
    updatePaymentSummary();
  }

  function selectPayment(button) {
    const section = $('#boraiPaymentSection');
    if (!section) return;
    $$('.borai-payment-method', section).forEach(option => {
      const selected = option === button;
      option.classList.toggle('is-selected', selected);
      option.setAttribute('aria-pressed', String(selected));
    });
    selectedPayment = button.dataset.boraiPayment || '';
    updatePaymentSummary();
  }

  function showPaymentConfirmation() {
    if (!selectedPlan || !selectedPayment) return;
    showModal(`
      <p class="eyebrow">BORAÍ+</p>
      <h2 id="modalTitle">Resumo da assinatura</h2>
      <div class="modal-result">
        <strong>Plano ${selectedPlan.name} — ${selectedPlan.price}</strong>
        <span>Forma de pagamento escolhida: ${selectedPayment}.</span>
      </div>
      <p>Esta é apenas uma simulação da etapa de contratação. O Boraí ainda não está conectado a um serviço de pagamentos; nenhum Pix, boleto ou cobrança no cartão será gerado.</p>
      <button type="button" class="primary-button" id="boraiPaymentClose">Fechar</button>
    `);
    const close = $('#boraiPaymentClose');
    if (close) close.addEventListener('click', () => { $('#modalBackdrop').hidden = true; });
  }

  function installInteractions() {
    document.addEventListener('click', event => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const incident = target.closest('[data-borai-incident]');
      if (incident) {
        event.preventDefault();
        event.stopPropagation();
        openIncidentNotice();
        return;
      }

      const openRoute = target.closest('[data-borai-open-route]');
      if (openRoute) {
        event.preventDefault();
        const routeId = openRoute.dataset.boraiOpenRoute;
        const routes = readStore(ROUTES_KEY, []);
        const route = String(routeId) === String(DEMO_ROUTE_ID)
          ? DEMO_ROUTE
          : (Array.isArray(routes) ? routes.find(item => String(item.id) === String(routeId)) : null);
        if (route) window.open(routeUrl(route), '_blank', 'noopener,noreferrer');
        return;
      }

      const removeRoute = target.closest('[data-borai-remove-route]');
      if (removeRoute) {
        event.preventDefault();
        const routeId = removeRoute.dataset.boraiRemoveRoute;
        const routes = readStore(ROUTES_KEY, []);
        if (Array.isArray(routes)) {
          writeStore(ROUTES_KEY, routes.filter(route => String(route.id) !== String(routeId)));
          renderFavoriteRoutes();
        }
        return;
      }

      const planButton = target.closest('.plan-card');
      if (planButton) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        selectPlan(planButton);
        return;
      }

      const paymentButton = target.closest('[data-borai-payment]');
      if (paymentButton) {
        event.preventDefault();
        selectPayment(paymentButton);
        return;
      }

      if (target.closest('#boraiPaymentConfirm')) {
        event.preventDefault();
        showPaymentConfirmation();
      }
    }, true);
  }

  addStyles();
  installFavoriteRoutes();
  addPaymentSection();
  installInteractions();
  updatePaymentSummary();
})();
