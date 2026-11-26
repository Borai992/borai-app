(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const storage = {
    get(key, fallback) { try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ } }
  };

  function addMapTabMarkup() {
    if (!$('#mapView')) {
      const preferencesView = $('#preferencesView');
      if (preferencesView) {
        preferencesView.insertAdjacentHTML('beforebegin', `
          <section class="tab-view map-view" id="mapView" hidden>
            <div class="tab-heading">
              <div class="heading-icon map-heading-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="m3 6 5.5-2 7 2L21 4v14l-5.5 2-7-2L3 20z"/><path d="M8.5 4v14M15.5 6v14"/></svg>
              </div>
              <div><p class="eyebrow">EXPLORE SUA REGIÃO</p><h1>Mapa</h1><p>Encontre referências e descubra caminhos.</p></div>
            </div>
            <div class="map-preview-card">
              <div class="map-preview-top">
                <span class="map-preview-tag"><i></i> Prévia do mapa</span>
                <span class="map-city-label" id="mapCityLabel">Mogi das Cruzes</span>
              </div>
              <div class="map-canvas" role="img" aria-label="Ilustração decorativa de um mapa urbano. O mapa interativo real será integrado futuramente.">
                <span class="map-park park-one"></span>
                <span class="map-park park-two"></span>
                <span class="map-road road-one"></span>
                <span class="map-road road-two"></span>
                <span class="map-road road-three"></span>
                <span class="map-road road-four"></span>
                <span class="map-street-label street-one">AV. PRINCIPAL</span>
                <span class="map-street-label street-two">R. DAS FLORES</span>
                <span class="map-place-label place-one">Centro</span>
                <span class="map-place-label place-two">Estação</span>
                <span class="map-marker" aria-hidden="true"><span>B</span></span>
              </div>
              <div class="map-status">
                <span class="map-status-icon">⌖</span>
                <div><strong>O mapa interativo está chegando!</strong><p>Estamos preparando a integração com um mapa real para você visualizar locais e trajetos diretamente no Boraí.</p></div>
              </div>
            </div>
            <div class="map-actions">
              <button class="primary-button" id="mapRouteButton">Planejar uma rota ↗</button>
              <button class="secondary-button" id="mapTransportButton">Encontrar transporte</button>
            </div>
            <p class="demo-note centered">Esta é uma prévia visual. A localização e os dados exibidos ainda não são reais.</p>
          </section>
        `);
      }
    }

    if (!$('.nav-item[data-tab="map"]')) {
      const preferencesButton = $('.nav-item[data-tab="preferences"]');
      if (preferencesButton) {
        preferencesButton.insertAdjacentHTML('beforebegin', `
          <button class="nav-item" data-tab="map">
            <span class="nav-icon map-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="m3 6 5.5-2 7 2L21 4v14l-5.5 2-7-2L3 20z"/><path d="M8.5 4v14M15.5 6v14"/></svg>
            </span>
            <span>Mapa</span>
          </button>
        `);
      }
    }

    if (!$('[data-drawer-tab="map"]')) {
      const drawerPreferences = $('[data-drawer-tab="preferences"]');
      if (drawerPreferences) drawerPreferences.insertAdjacentHTML('beforebegin', '<button data-drawer-tab="map">⌖ <span>Mapa</span></button>');
    }
  }

  addMapTabMarkup();

  const stylePatch = document.createElement('style');
  stylePatch.textContent = `
    .bottom-nav{grid-template-columns:repeat(5,minmax(0,1fr))}
    .bottom-nav .nav-item{font-size:13px;min-width:0;padding:0 2px}
    .map-icon svg{width:29px;height:29px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
    .map-heading-icon svg{width:38px;height:38px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
    .map-preview-card{overflow:hidden;border:1px solid #efd5bb;border-radius:22px;background:#fffaf4;box-shadow:0 6px 20px rgba(127,71,24,.07)}
    .map-preview-top{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 17px;background:#fffaf4}
    .map-preview-tag{display:flex;align-items:center;gap:8px;color:#a65411;font-size:12px;font-weight:800}
    .map-preview-tag i{width:8px;height:8px;border-radius:50%;background:#e97800;display:inline-block}
    .map-city-label{color:#76695e;font-size:12px;font-weight:700}
    .map-canvas{height:clamp(250px,38vw,360px);position:relative;overflow:hidden;background-color:#f0eadb;background-image:linear-gradient(28deg,transparent 47%,rgba(255,255,255,.48) 48% 50%,transparent 51%),linear-gradient(115deg,transparent 44%,rgba(218,232,204,.8) 45% 57%,transparent 58%),linear-gradient(0deg,rgba(255,255,255,.25) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.25) 1px,transparent 1px);background-size:100% 100%,100% 100%,42px 42px,42px 42px}
    .map-park{position:absolute;background:#d9e6c9;border:1px solid #c8d9b5;border-radius:18px;opacity:.95}
    .park-one{width:28%;height:26%;left:7%;top:12%;transform:rotate(-8deg)}
    .park-two{width:24%;height:30%;right:8%;bottom:9%;transform:rotate(12deg)}
    .map-road{position:absolute;z-index:1;background:#fffdf8;border:1px solid #e7ddcd;border-radius:30px;box-shadow:0 1px 0 rgba(205,187,160,.18)}
    .road-one{width:120%;height:25px;left:-10%;top:46%;transform:rotate(-13deg)}
    .road-two{width:25px;height:130%;left:42%;top:-15%;transform:rotate(19deg)}
    .road-three{width:90%;height:15px;left:15%;top:22%;transform:rotate(27deg)}
    .road-four{width:80%;height:13px;left:12%;top:76%;transform:rotate(-28deg)}
    .map-street-label,.map-place-label{position:absolute;z-index:2;padding:4px 7px;border-radius:5px;background:rgba(255,253,248,.82);color:#887968;font-size:9px;font-weight:800;letter-spacing:.5px}
    .street-one{left:9%;top:53%;transform:rotate(-13deg)}
    .street-two{right:8%;top:35%;transform:rotate(19deg)}
    .place-one{left:11%;bottom:15%}
    .place-two{right:13%;top:13%}
    .map-marker{position:absolute;z-index:3;left:54%;top:48%;width:42px;height:42px;display:grid;place-items:center;border:4px solid #fff;border-radius:50% 50% 50% 5px;background:linear-gradient(145deg,#ff9820,#c65300);box-shadow:0 4px 12px rgba(105,55,13,.28);transform:translate(-50%,-50%) rotate(-45deg)}
    .map-marker span{color:white;font-size:15px;font-weight:900;transform:rotate(45deg)}
    .map-status{display:flex;align-items:flex-start;gap:13px;padding:16px 17px}
    .map-status-icon{width:38px;height:38px;flex:none;display:grid;place-items:center;border-radius:12px;background:#ffead5;color:#b6570c;font-size:24px}
    .map-status strong{display:block;color:#79400f;font-size:14px;margin:1px 0 5px}
    .map-status p{margin:0;color:#796e63;font-size:12px;line-height:1.5}
    .map-actions{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px}
    .map-actions .primary-button,.map-actions .secondary-button{min-height:48px;margin:0;border-radius:13px;font-size:14px;font-weight:800}
    .map-view>.demo-note{margin-left:0;margin-right:0}
    .message-avatar.bia-message-avatar{width:42px;height:42px;border:2px solid #ffd5a8;background:linear-gradient(145deg,#f28a15,#a94300);box-shadow:0 3px 8px rgba(174,85,0,.18)}
    .bia-message-avatar .bot-face{width:24px;height:18px;border:2px solid #fff4df;border-radius:7px;gap:4px;box-shadow:none}
    .bia-message-avatar .bot-face:before,.bia-message-avatar .bot-face:after{top:3px;width:4px;height:9px;border-radius:5px}
    .bia-message-avatar .bot-face:before{left:-6px}
    .bia-message-avatar .bot-face:after{right:-6px}
    .bia-message-avatar .bot-face i{width:4px;height:5px;border:1px solid #fff4df;border-bottom:0;border-radius:5px 5px 0 0}
    .bia-message-avatar .bot-face b{bottom:3px;left:7px;width:7px;height:4px;border-bottom:1px solid #fff4df}
    .mini-bia .bot-face{width:43px;height:30px;border-width:4px;border-radius:12px;gap:8px;box-shadow:none}
    .mini-bia .bot-face:before,.mini-bia .bot-face:after{top:6px;width:6px;height:12px}
    .mini-bia .bot-face:before{left:-9px}
    .mini-bia .bot-face:after{right:-9px}
    .mini-bia .bot-face i{width:5px;height:7px;border-width:2px}
    .mini-bia .bot-face b{bottom:5px;left:13px;width:12px;height:6px;border-bottom-width:2px}
    @media(max-width:600px){
      .bottom-nav .nav-item{font-size:10.5px}
      .bottom-nav .nav-icon{height:32px}
      .map-actions{grid-template-columns:1fr}
      .map-canvas{height:260px}
      .map-status{padding:13px}
    }
    @media(max-width:365px){
      .bottom-nav .nav-item{font-size:9.5px}
      .map-preview-top{padding:12px}
      .map-city-label,.map-preview-tag{font-size:10px}
    }
  `;
  document.head.appendChild(stylePatch);

  let currentTab = 'home';
  let toastTimer;
  let biaIsSending = false;
  const biaHistory = [];
  const BIA_API_URL = 'https://borai-bia-api.contatoborai2026.workers.dev/chat';
  const tabs = { home: $('#homeView'), bia: $('#biaView'), map: $('#mapView'), preferences: $('#preferencesView'), plus: $('#plusView') };
  const modalBackdrop = $('#modalBackdrop');
  const modalContent = $('#modalContent');
  const cityLabel = $('#cityLabel');
  let city = storage.get('borai-city', 'Mogi das Cruzes');
  let savedRoutes = storage.get('borai-routes', []);
  let preferences = storage.get('borai-preferences', { bus: true, train: true, metro: true, other: true, largeText: false, alerts: true });

  function showToast(message) {
    const toast = $('#toast'); toast.textContent = message; toast.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
  }
  function renderCity() {
    cityLabel.textContent = `SP - ${city}`;
    const mapCityLabel = $('#mapCityLabel');
    if (mapCityLabel) mapCityLabel.textContent = city;
  }
  function setTab(tab) {
    if (!tabs[tab]) return;
    currentTab = tab;
    Object.entries(tabs).forEach(([name, element]) => { element.hidden = name !== tab; });
    $$('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.tab === tab));
    closeDrawer();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function openModal(html) { modalContent.innerHTML = html; modalBackdrop.hidden = false; const focusable = $('input,select,button', modalContent); if (focusable) setTimeout(() => focusable.focus(), 20); }
  function closeModal() { modalBackdrop.hidden = true; modalContent.innerHTML = ''; }
  function openDrawer() { $('#sideDrawer').classList.add('open'); $('#sideDrawer').setAttribute('aria-hidden', 'false'); $('#drawerBackdrop').hidden = false; $('#menuButton').setAttribute('aria-expanded', 'true'); }
  function closeDrawer() { $('#sideDrawer').classList.remove('open'); $('#sideDrawer').setAttribute('aria-hidden', 'true'); $('#drawerBackdrop').hidden = true; $('#menuButton').setAttribute('aria-expanded', 'false'); }
  function mapsDirections(origin, destination) {
    const params = new URLSearchParams({ api: '1', origin: `${origin}, ${city}, SP, Brasil`, destination: `${destination}, ${city}, SP, Brasil`, travelmode: 'transit' });
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }
  function openRouteModal() {
    openModal(`<p class="eyebrow">PLANEJAMENTO DE VIAGEM</p><h2 id="modalTitle">Para onde vamos?</h2><p>Informe os locais para consultar opções de transporte público. O Boraí encaminhará a consulta ao Google Maps.</p>
      <form id="routeForm"><div class="form-field"><label for="routeOrigin">Ponto de partida</label><input id="routeOrigin" required placeholder="Ex.: Estação Estudantes" autocomplete="street-address"></div>
      <div class="form-field"><label for="routeDestination">Destino</label><input id="routeDestination" required placeholder="Ex.: Mogi Shopping" autocomplete="street-address"></div>
      <label class="setting-line" style="border:0"><span>Salvar este trajeto nos favoritos</span><input id="saveRoute" type="checkbox" checked><i></i></label>
      <button class="primary-button" type="submit">Consultar trajeto ↗</button></form><div id="routeResult"></div>`);
    $('#routeForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const origin = $('#routeOrigin').value.trim(); const destination = $('#routeDestination').value.trim();
      if (!origin || !destination) return;
      const url = mapsDirections(origin, destination);
      if ($('#saveRoute').checked) {
        savedRoutes = [{ id: Date.now(), origin, destination }, ...savedRoutes].slice(0, 6);
        storage.set('borai-routes', savedRoutes); renderSavedRoutes();
      }
      $('#routeResult').innerHTML = `<div class="modal-result"><strong>Consulta pronta</strong><span>O Google Maps abrirá as opções de transporte público para esse trajeto. Os horários e trajetos são fornecidos pelo serviço externo.</span><br><a href="${url}" target="_blank" rel="noopener noreferrer">Abrir opções no Google Maps ↗</a></div>`;
    });
  }
  function openTransportModal() {
    openModal(`<p class="eyebrow">ENCONTRE UM MEIO DE TRANSPORTE</p><h2 id="modalTitle">O que você procura?</h2><p>Escolha uma modalidade e pesquise opções próximas ou informações na sua cidade.</p>
      <div class="form-field"><label for="transportType">Modalidade</label><select id="transportType"><option value="pontos de ônibus">Ônibus</option><option value="estação de trem CPTM">Trem / CPTM</option><option value="estação de metrô">Metrô</option><option value="terminal de transporte público">Terminais</option><option value="transporte público">Outros transportes públicos</option></select></div>
      <div class="form-field"><label for="transportArea">Bairro ou referência (opcional)</label><input id="transportArea" placeholder="Ex.: Centro"></div>
      <button class="primary-button" id="searchTransport">Pesquisar no mapa ↗</button>
      <p class="demo-note">A pesquisa será aberta no Google Maps. O Boraí ainda não possui uma base própria de horários e veículos em tempo real.</p>`);
    $('#searchTransport').addEventListener('click', () => {
      const type = $('#transportType').value; const area = $('#transportArea').value.trim();
      const query = `${type} ${area} ${city} SP Brasil`;
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, '_blank', 'noopener,noreferrer');
    });
  }
  function openCityModal() {
    openModal(`<p class="eyebrow">SUA REGIÃO</p><h2 id="modalTitle">Escolha sua cidade</h2><p>Defina a cidade usada nas pesquisas do Boraí.</p><form id="cityForm"><div class="form-field"><label for="cityInput">Cidade</label><input id="cityInput" required value="${escapeHtml(city)}" maxlength="50" placeholder="Ex.: Mogi das Cruzes"></div><button class="primary-button" type="submit">Salvar cidade</button></form>`);
    $('#cityForm').addEventListener('submit', event => { event.preventDefault(); city = $('#cityInput').value.trim(); storage.set('borai-city', city); renderCity(); closeModal(); showToast(`Cidade alterada para ${city}.`); });
  }
  function escapeHtml(value) { return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }
  function renderSavedRoutes() {
    const section = $('#savedSection'); const container = $('#savedRoutes');
    section.hidden = savedRoutes.length === 0;
    container.innerHTML = savedRoutes.map(route => `<article class="saved-route"><small>TRAJETO FAVORITO</small><strong>${escapeHtml(route.origin)} → ${escapeHtml(route.destination)}</strong><button data-open-route="${route.id}">Consultar novamente ↗</button> <button data-remove-route="${route.id}">Remover</button></article>`).join('');
    $$('[data-open-route]', container).forEach(button => button.addEventListener('click', () => { const route = savedRoutes.find(item => item.id === Number(button.dataset.openRoute)); if (route) window.open(mapsDirections(route.origin, route.destination), '_blank', 'noopener,noreferrer'); }));
    $$('[data-remove-route]', container).forEach(button => button.addEventListener('click', () => { savedRoutes = savedRoutes.filter(item => item.id !== Number(button.dataset.removeRoute)); storage.set('borai-routes', savedRoutes); renderSavedRoutes(); showToast('Trajeto removido dos favoritos.'); }));
  }
  function answerBia(question) {
    const q = question.toLocaleLowerCase('pt-BR');
    if (/(rota|trajeto|caminho|destino|chegar|viagem)/.test(q)) return 'Para planejar uma viagem, volte à aba Início e toque em “Adicionar” na seção Rota. Informe a origem e o destino. O Boraí abrirá as opções de transporte público no Google Maps. Os horários e trajetos exibidos vêm do serviço externo.';
    if (/(ônibus|onibus|trem|metrô|metro|cptm|transporte|modalidade|linha)/.test(q)) return 'O Boraí foi pensado para reunir informações de ônibus, trens, metrô e outros meios de transporte público. Nesta demonstração, você pode pesquisar locais e modalidades pelo botão “Transporte”. A disponibilidade de dados varia conforme a cidade e a operadora.';
    if (/(boraí\+|borai\+|preço|preco|mensal|anual|assinatura|plano)/.test(q)) return 'O Boraí+ é o plano adicional do projeto: R$ 8,99 por mês ou R$ 89,99 por ano. A proposta inclui experiência sem anúncios, personalização e recursos adicionais da BIA. Nesta versão, a contratação é apenas demonstrativa.';
    if (/(horário|horario|atraso|tempo real|localização|localizacao|onde está|onde esta)/.test(q)) return 'Para horários, localização dos veículos e previsões em tempo real, precisamos de uma fonte oficial de dados da sua cidade ou operadora. Nesta versão ainda não há integração desse tipo, então não vou inventar previsões.';
    if (/(cidade|mog[ií]|localização|localizacao|região|regiao)/.test(q)) return `O Boraí está configurado para ${city}. Você pode alterar a cidade tocando no nome no topo da tela. As consultas externas usam a cidade escolhida.`;
    if (/(oi|olá|ola|bom dia|boa tarde|boa noite|tudo bem)/.test(q)) return 'Olá! Tudo certo por aqui. Posso explicar como planejar uma rota, pesquisar meios de transporte ou conhecer os recursos do Boraí+.';
    if (/(quem é você|quem e voce|bia|o que você faz|o que voce faz)/.test(q)) return 'Eu sou a BIA, assistente virtual do Boraí. Nesta primeira versão sou uma demonstração com respostas programadas. A próxima etapa poderá conectar uma IA real por API, mantendo a proteção da chave em um servidor.';
    return 'Ainda estou aprendendo! Nesta versão consigo orientar sobre planejamento de rotas, modalidades de transporte, Boraí+ e funcionamento do projeto. Para informações reais de horários e veículos, precisamos conectar fontes oficiais de dados.';
  }

  function createBiaAvatar() {
    const avatar = document.createElement('span');
    avatar.className = 'message-avatar bia-message-avatar';
    const face = document.createElement('span');
    face.className = 'bot-face';
    face.append(document.createElement('i'), document.createElement('i'), document.createElement('b'));
    avatar.append(face);
    return avatar;
  }

  function appendMessage(text, who, label) {
    const message = document.createElement('div'); message.className = `message ${who === 'user' ? 'user-message' : 'bot-message'}`;
    const avatar = who === 'user' ? document.createElement('span') : createBiaAvatar();
    if (who === 'user') { avatar.className = 'message-avatar'; avatar.textContent = 'V'; }
    const body = document.createElement('div'); const name = document.createElement('strong'); name.textContent = who === 'user' ? 'VOCÊ' : 'BIA';
    const p = document.createElement('p'); p.textContent = text; body.append(name, p);
    if (who !== 'user') { const small = document.createElement('small'); small.textContent = label || 'Gemini'; body.append(small); }
    message.append(avatar, body); $('#chatMessages').append(message); $('#chatMessages').scrollTop = $('#chatMessages').scrollHeight;
    return message;
  }

  async function sendBia(text) {
    const question = text.trim();
    if (!question || biaIsSending) return;
    biaIsSending = true;
    const input = $('#chatInput');
    const submit = $('#chatForm button[type="submit"]');
    appendMessage(question, 'user');
    input.value = '';
    input.disabled = true;
    submit.disabled = true;
    submit.textContent = '…';
    const typing = appendMessage('Estou pensando na melhor resposta…', 'bot', 'Conectando ao Gemini');

    try {
      const response = await fetch(BIA_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: question,
          history: biaHistory.slice(-10),
          city
        })
      });
      let data = {};
      try { data = await response.json(); } catch { /* resposta sem JSON */ }
      if (!response.ok) throw new Error(data.error || `Erro de conexão (${response.status}).`);
      const answer = typeof data.reply === 'string' ? data.reply.trim() : '';
      if (!answer) throw new Error('A BIA recebeu uma resposta vazia. Tente novamente.');
      biaHistory.push({ role: 'user', text: question }, { role: 'model', text: answer });
      if (biaHistory.length > 12) biaHistory.splice(0, biaHistory.length - 12);
      typing.remove();
      appendMessage(answer, 'bot', 'Gemini');
    } catch (error) {
      typing.remove();
      const message = error && error.message ? error.message : 'Não consegui acessar a BIA agora.';
      appendMessage(`${message} Confira sua conexão e tente novamente.`, 'bot', 'Aviso de conexão');
    } finally {
      biaIsSending = false;
      input.disabled = false;
      submit.disabled = false;
      submit.textContent = '➤';
      input.focus();
    }
  }
  function loadPreferences() {
    $$('[data-pref]').forEach(input => { input.checked = Boolean(preferences[input.dataset.pref]); });
    document.body.classList.toggle('large-text-mode', Boolean(preferences.largeText));
  }

  $('#menuButton').addEventListener('click', openDrawer);
  $('#closeDrawer').addEventListener('click', closeDrawer);
  $('#drawerBackdrop').addEventListener('click', closeDrawer);
  $('#cityPicker').addEventListener('click', openCityModal);
  $('#addRouteButton').addEventListener('click', openRouteModal);
  $('#routeArrow').addEventListener('click', openRouteModal);
  $('#addTransportButton').addEventListener('click', openTransportModal);
  $('#transportArrow').addEventListener('click', openTransportModal);
  $('#openBiaButton').addEventListener('click', () => setTab('bia'));
  $('#mapRouteButton').addEventListener('click', openRouteModal);
  $('#mapTransportButton').addEventListener('click', openTransportModal);
  $('#modalClose').addEventListener('click', closeModal);
  modalBackdrop.addEventListener('click', event => { if (event.target === modalBackdrop) closeModal(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') { closeModal(); closeDrawer(); } });
  $$('.nav-item').forEach(button => button.addEventListener('click', () => setTab(button.dataset.tab)));
  $$('[data-drawer-tab]').forEach(button => button.addEventListener('click', () => setTab(button.dataset.drawerTab)));
  $('#chatForm').addEventListener('submit', event => { event.preventDefault(); sendBia($('#chatInput').value); });
  $$('.suggestion-chips button').forEach(button => button.addEventListener('click', () => sendBia(button.dataset.prompt)));
  $$('#preferencesView [data-pref]').forEach(input => input.addEventListener('change', () => {
    preferences[input.dataset.pref] = input.checked; storage.set('borai-preferences', preferences);
    document.body.classList.toggle('large-text-mode', Boolean(preferences.largeText));
    $('#preferencesSaved').textContent = 'Preferências atualizadas e salvas neste aparelho.';
  }));
  $$('.plan-card').forEach(button => button.addEventListener('click', () => showToast(`Plano ${button.dataset.plan} selecionado — contratação não disponível nesta demonstração.`)));
  $('#closeAdButton').addEventListener('click', () => { $('#adSection').hidden = true; showToast('Anúncio fechado.'); });
  $('#adLearnMore').addEventListener('click', () => showToast('Espaço publicitário demonstrativo do Boraí.'));
  $('#searchForm').addEventListener('submit', event => {
    event.preventDefault(); const term = $('#globalSearch').value.trim(); if (!term) return;
    if (/bia|ajuda|assistente/i.test(term)) { setTab('bia'); $('#chatInput').value = term; $('#chatInput').focus(); }
    else { openModal(`<p class="eyebrow">PESQUISA</p><h2 id="modalTitle">Pesquisar “${escapeHtml(term)}”</h2><p>Escolha onde deseja procurar essa informação.</p><button class="primary-button" id="searchMapButton">Pesquisar no Google Maps ↗</button><button class="secondary-button" id="searchBiaButton" style="width:100%;margin-top:10px">Perguntar à BIA</button>`);
      $('#searchMapButton').addEventListener('click', () => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${term} ${city} SP Brasil`)}`, '_blank', 'noopener,noreferrer'));
      $('#searchBiaButton').addEventListener('click', () => { closeModal(); setTab('bia'); sendBia(term); });
    }
  });

  const initialBiaAvatar = $('.chat-messages .bot-message .message-avatar');
  if (initialBiaAvatar) initialBiaAvatar.replaceWith(createBiaAvatar());
  const biaHeading = $('.mini-bia');
  if (biaHeading) {
    biaHeading.textContent = '';
    const face = document.createElement('span');
    face.className = 'bot-face';
    face.append(document.createElement('i'), document.createElement('i'), document.createElement('b'));
    biaHeading.append(face);
  }

  renderCity(); renderSavedRoutes(); loadPreferences();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
})();
