(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const storage = {
    get(key, fallback) { try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ } }
  };
  let currentTab = 'home';
  let toastTimer;
  let biaIsSending = false;
  const biaHistory = [];
  const BIA_API_URL = 'https://borai-bia-api.contatoborai2026.workers.dev/chat';
  const tabs = { home: $('#homeView'), bia: $('#biaView'), preferences: $('#preferencesView'), plus: $('#plusView') };
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
  function renderCity() { cityLabel.textContent = `SP - ${city}`; }
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
      $('#routeResult').innerHTML = `<div class="modal-result"><strong>Consulta pronta</strong><span>O Google Maps abrirá as opções de transporte público para esse trajeto. Horários e disponibilidade são fornecidos pelo serviço externo.</span><br><a href="${url}" target="_blank" rel="noopener noreferrer">Abrir opções no Google Maps ↗</a></div>`;
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
  function appendMessage(text, who, label) {
    const message = document.createElement('div'); message.className = `message ${who === 'user' ? 'user-message' : 'bot-message'}`;
    const avatar = document.createElement('span'); avatar.className = 'message-avatar'; avatar.textContent = who === 'user' ? 'V' : 'B';
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

  renderCity(); renderSavedRoutes(); loadPreferences();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
})();
