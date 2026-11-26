/* Boraí — ajustes finais de rotas, referências externas e menu Sobre.
 * Carregar depois de penultimate-changes.js. Mantém o mapa interativo da aba Mapa.
 */
(() => {
  'use strict';

  if (window.__boraiFinalAdjustmentsInstalled) return;
  window.__boraiFinalAdjustmentsInstalled = true;

  const DEMO_HIDDEN_KEY = 'borai-demo-route-dismissed-v1';
  const ABOUT_URL = 'https://adriano277.github.io/borai-site/';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  function showToast(message) {
    const toast = $('#toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    window.setTimeout(() => toast.classList.remove('show'), 3600);
  }

  function isGoogleMapsUrl(value) {
    return /(?:^|\.)google\.[^/]+\/maps|maps\.google\./i.test(String(value || ''));
  }

  // Bloqueia chamadas antigas que tentariam abrir um serviço externo de mapas.
  const originalWindowOpen = window.open;
  window.open = function (url, ...args) {
    if (isGoogleMapsUrl(url)) {
      showToast('A consulta de rotas será realizada dentro do Boraí quando o serviço próprio estiver integrado.');
      return null;
    }
    return originalWindowOpen.call(window, url, ...args);
  };

  function replaceGoogleText(value) {
    let text = String(value || '');
    text = text.replace(
      /Informe a origem e o destino\. A consulta será aberta no Google Maps usando sua região escolhida:/gi,
      'Informe a origem e o destino. O serviço próprio de planejamento de rotas do Boraí está em desenvolvimento. Região selecionada:'
    );
    text = text.replace(
      /O Google Maps abrirá as opções de transporte público\. Horários e trajetos são fornecidos pelo serviço externo\./gi,
      'As opções de transporte público serão apresentadas diretamente no Boraí após a integração do serviço próprio de rotas.'
    );
    text = text.replace(/Abrir opções no Google Maps/gi, 'Consultar no Boraí (em breve)');
    text = text.replace(/Pesquisar transporte no Google Maps/gi, 'Pesquisar transporte (em breve)');
    text = text.replace(/Você também pode abrir a pesquisa no Google Maps\./gi,
      'A pesquisa integrada de locais será aprimorada futuramente.');
    text = text.replace(/pesquise os pontos diretamente no Google Maps\./gi, 'tente novamente mais tarde.');
    text = text.replace(/Google Maps/gi, 'serviço próprio de mapas do Boraí');
    return text;
  }

  function cleanExternalMapReferences(root = document) {
    if (root.nodeType === Node.TEXT_NODE) {
      const parent = root.parentElement;
      if (parent && !parent.closest('script,style')) root.nodeValue = replaceGoogleText(root.nodeValue);
      return;
    }

    if (root.nodeType === Node.ELEMENT_NODE || root.nodeType === Node.DOCUMENT_NODE) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const textNodes = [];
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const parent = node.parentElement;
        if (parent && !parent.closest('script,style') && /google\s*maps/i.test(node.nodeValue || '')) {
          textNodes.push(node);
        }
      }
      textNodes.forEach(node => { node.nodeValue = replaceGoogleText(node.nodeValue); });

      const anchors = root.querySelectorAll ? root.querySelectorAll('a[href]') : [];
      anchors.forEach(link => {
        if (!isGoogleMapsUrl(link.getAttribute('href'))) return;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'borai-concept-route-button';
        button.dataset.boraiConceptRoute = 'true';
        button.textContent = 'Consultar rota no Boraí (em breve)';
        link.replaceWith(button);
      });

      const transportButton = $('#mapTransportButton', root);
      if (transportButton) transportButton.textContent = 'Pesquisar transporte (em breve)';
      const transportSearch = $('#boraiTransportSearch', root);
      if (transportSearch) transportSearch.textContent = 'Consultar opções (em breve)';
    }
  }

  function installExternalMapCleanup() {
    cleanExternalMapReferences(document);
    if (!('MutationObserver' in window) || !document.documentElement) return;

    const observer = new MutationObserver(records => {
      records.forEach(record => {
        if (record.type === 'characterData') cleanExternalMapReferences(record.target);
        record.addedNodes && record.addedNodes.forEach(node => cleanExternalMapReferences(node));
      });
    });
    observer.observe(document.documentElement, { childList: true, characterData: true, subtree: true });

    // Também impede a navegação caso algum link externo seja inserido por outro script.
    window.addEventListener('click', event => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest('a[href]');
      if (anchor && isGoogleMapsUrl(anchor.getAttribute('href'))) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        showToast('A consulta será feita dentro do Boraí quando o serviço próprio estiver disponível.');
        return;
      }

      const openRoute = target.closest('[data-borai-open-route]');
      if (openRoute) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        showToast('O planejamento de rotas será realizado diretamente no Boraí. Este recurso está em desenvolvimento.');
        return;
      }

      const transportSearch = target.closest('#boraiTransportSearch');
      if (transportSearch) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        showToast('A pesquisa de transporte ficará disponível diretamente no Boraí.');
      }
    }, true);
  }

  // Mantém a rota de exemplo como favorita inicial. Só a oculta depois que
  // a própria pessoa tocar em Remover; a escolha fica salva neste aparelho.
  function patchFavoriteList() {
    const container = $('#savedRoutes');
    const section = $('#savedSection');
    if (!container || container.dataset.boraiFinalPatched === 'true') return;
    container.dataset.boraiFinalPatched = 'true';

    function syncDemoCard() {
      const demoCards = $$('.saved-route[data-borai-demo-card="true"], .saved-route.borai-demo-favorite', container);
      demoCards.forEach(card => {
        if (localStorage.getItem(DEMO_HIDDEN_KEY) === 'true') card.hidden = true;
        const actions = $('.borai-route-actions', card);
        if (!actions || $('[data-borai-hide-demo-route]', actions)) return;
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.textContent = 'Remover';
        remove.dataset.boraiHideDemoRoute = 'true';
        remove.setAttribute('aria-label', 'Remover rota favorita de demonstração');
        actions.append(remove);
      });

      if (section) {
        const visibleCards = $$('.saved-route', container).filter(card => !card.hidden);
        section.hidden = visibleCards.length === 0;
      }
    }

    // A rota é criada pelo script de favoritos anterior. Sincronizamos também
    // quando esse script redesenha a lista após salvar ou remover outro trajeto.
    syncDemoCard();
    if ('MutationObserver' in window) {
      const observer = new MutationObserver(() => syncDemoCard());
      observer.observe(container, { childList: true, subtree: true });
    }

    document.addEventListener('click', event => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const remove = target.closest('[data-borai-hide-demo-route]');
      if (!remove) return;
      event.preventDefault();
      event.stopPropagation();
      localStorage.setItem(DEMO_HIDDEN_KEY, 'true');
      const card = remove.closest('.saved-route');
      if (card) card.hidden = true;
      syncDemoCard();
      showToast('Rota favorita removida. Você poderá adicioná-la novamente quando quiser.');
    });
  }

  function addAboutMenuItem() {
    const drawer = $('#sideDrawer');
    if (!drawer || $('[data-borai-about]', drawer)) return;
    const footer = $('.drawer-foot', drawer);
    const item = document.createElement('button');
    item.type = 'button';
    item.dataset.boraiAbout = 'true';
    item.innerHTML = 'ⓘ <span>Sobre o Boraí</span>';
    if (footer) drawer.insertBefore(item, footer);
    else drawer.append(item);
  }

  function openAboutModal() {
    const backdrop = $('#modalBackdrop');
    const content = $('#modalContent');
    if (!backdrop || !content) return;
    content.innerHTML = `
      <p class="eyebrow">CONHEÇA O BORAÍ</p>
      <h2 id="modalTitle">Mobilidade que aproxima</h2>
      <p>O Boraí é uma proposta de aplicativo de mobilidade urbana criada para reunir, em um só lugar, informações que ajudam as pessoas a organizar seus deslocamentos pela cidade.</p>
      <div class="modal-result">
        <strong>O que o Boraí pretende oferecer?</strong>
        <p>Consulta de linhas e itinerários, horários de funcionamento, tarifas, estimativas de viagem, localização de veículos quando houver dados disponíveis e avisos sobre alterações no transporte público.</p>
      </div>
      <p>A ideia é facilitar o dia a dia de quem utiliza ônibus, trem, metrô e outros meios de transporte, com uma experiência simples e integrada. Este aplicativo é um protótipo demonstrativo; algumas integrações e recursos próprios ainda estão em desenvolvimento.</p>
      <a class="primary-button borai-about-link" href="${ABOUT_URL}" target="_blank" rel="noopener noreferrer">Conhecer o site institucional ↗</a>
      <button class="secondary-button borai-about-close" type="button" id="boraiAboutClose">Fechar</button>
    `;
    backdrop.hidden = false;
    const close = $('#boraiAboutClose', content);
    if (close) close.addEventListener('click', () => { backdrop.hidden = true; });
  }

  function installAboutInteraction() {
    addAboutMenuItem();
    document.addEventListener('click', event => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const about = target.closest('[data-borai-about]');
      if (!about) return;
      event.preventDefault();
      const drawer = $('#sideDrawer');
      if (drawer) { drawer.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true'); }
      const drawerBackdrop = $('#drawerBackdrop');
      if (drawerBackdrop) drawerBackdrop.hidden = true;
      const menuButton = $('#menuButton');
      if (menuButton) menuButton.setAttribute('aria-expanded', 'false');
      openAboutModal();
    });
  }

  function addStyles() {
    if ($('#borai-final-adjustments-style')) return;
    const style = document.createElement('style');
    style.id = 'borai-final-adjustments-style';
    style.textContent = `
      .saved-route .borai-route-actions [data-borai-hide-demo-route]{margin-top:5px;border:0;background:transparent;color:#a94d00;text-decoration:underline;cursor:pointer;padding:3px 0;font-size:12px;font-weight:700}
      .borai-concept-route-button{display:inline-block;margin-top:8px;padding:9px 13px;border:1px solid #e4b487;border-radius:10px;background:#fff4e8;color:#99500e;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer}
      .borai-about-link{display:flex;align-items:center;justify-content:center;box-sizing:border-box;margin:16px 0 10px;text-decoration:none}
      .borai-about-close{width:100%;min-height:44px;margin-top:2px;font-weight:800}
      .saved-route[hidden]{display:none!important}
    `;
    document.head.append(style);
  }

  function start() {
    addStyles();
    patchFavoriteList();
    installAboutInteraction();
    installExternalMapCleanup();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
