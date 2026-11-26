(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const readStore = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };
  const writeStore = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  };

  const REGION_KEY_CITY = 'borai-city';
  const REGION_KEY_STATE = 'borai-state';
  const PROFILE_KEY = 'borai-profile';
  let selectedCity = readStore(REGION_KEY_CITY, 'Mogi das Cruzes');
  let selectedState = readStore(REGION_KEY_STATE, 'SP');
  let profile = readStore(PROFILE_KEY, {
    name: '', email: '', phone: '', residence: '', photo: ''
  });
  let profileVersion = 0;
  let statesCache = null;
  let cityCache = new Map();

  function injectStyles() {
    if ($('#borai-enhancements-style')) return;
    const style = document.createElement('style');
    style.id = 'borai-enhancements-style';
    style.textContent = `
      .borai-settings-view{padding-top:25px}
      .borai-settings-intro{color:#776d63;font-size:13px;line-height:1.55;margin:-12px 0 20px}
      .borai-profile-card{display:flex;align-items:center;gap:15px;padding:17px;border:1px solid #f0d4b8;border-radius:18px;background:#fffaf4;margin-bottom:17px}
      .borai-user-avatar{width:64px;height:64px;flex:none;border-radius:50%;display:grid;place-items:center;overflow:hidden;background:linear-gradient(145deg,#f28a15,#a94300);border:3px solid #ffd5a8;color:white;font-size:26px;font-weight:800}
      .borai-user-avatar img{width:100%;height:100%;object-fit:cover}
      .borai-profile-card strong{display:block;color:#4a3424;font-size:16px;margin-bottom:4px}
      .borai-profile-card small{display:block;color:#887b70;font-size:12px;line-height:1.4}
      .borai-settings-form .form-field{margin:0 0 15px}
      .borai-settings-form .form-field input{min-height:47px}
      .borai-settings-form .field-note{font-size:11px;color:#8b7e72;margin:5px 1px 0;line-height:1.4}
      .borai-photo-actions{display:flex;gap:9px;align-items:center;flex-wrap:wrap}
      .borai-photo-actions .secondary-button{margin:0}
      .borai-settings-actions{display:grid;gap:10px;margin-top:18px}
      .borai-settings-actions .primary-button{margin:0}
      .borai-region-form .form-field{margin:0 0 15px}
      .borai-region-form select,.borai-region-form input{width:100%;height:48px;border:1px solid #e9c9a8;border-radius:12px;padding:0 13px;background:#fff;font-size:15px;color:#30271f}
      .borai-region-help{font-size:12px;color:#83776c;line-height:1.45;margin:0 0 16px}
      .borai-loading{padding:12px;border-radius:12px;background:#fff2e4;color:#89501d;font-size:13px}
      .borai-region-error{padding:12px;border:1px solid #efc5a8;border-radius:12px;background:#fff5ec;color:#8c3e20;font-size:13px;line-height:1.5}
      .borai-region-error button{margin-top:8px}
      .message-avatar.user-profile-avatar{overflow:hidden;padding:0;background:#5d4635;color:#fff}
      .user-profile-avatar img{width:100%;height:100%;object-fit:cover;border-radius:50%}
      .drawer-settings-icon{display:inline-flex;width:20px;justify-content:center}
      @media(max-width:600px){
        .borai-settings-view{padding-top:20px}
        .borai-profile-card{padding:14px}
      }
    `;
    document.head.appendChild(style);
  }

  function avatarMarkup(container, data) {
    if (!container) return;
    container.classList.add('borai-user-avatar');
    container.replaceChildren();
    const name = String(data.name || '').trim();
    if (data.photo) {
      const image = document.createElement('img');
      image.src = data.photo;
      image.alt = name ? `Foto de perfil de ${name}` : 'Foto de perfil';
      container.append(image);
    } else {
      container.textContent = name ? name.charAt(0).toLocaleUpperCase('pt-BR') : 'V';
    }
  }

  function applyUserAvatar(message) {
    if (!message || !message.classList || !message.classList.contains('user-message')) return;
    if (message.dataset.profileVersion === String(profileVersion)) return;
    const avatar = $('.message-avatar', message);
    if (avatar) {
      avatar.className = 'message-avatar user-profile-avatar';
      avatar.replaceChildren();
      if (profile.photo) {
        const image = document.createElement('img');
        image.src = profile.photo;
        image.alt = profile.name ? `Foto de ${profile.name}` : 'Sua foto de perfil';
        avatar.append(image);
      } else {
        avatar.textContent = profile.name ? profile.name.trim().charAt(0).toLocaleUpperCase('pt-BR') : 'V';
      }
    }
    const label = $('strong', message);
    if (label) label.textContent = profile.name ? profile.name : 'VOCÊ';
    message.dataset.profileVersion = String(profileVersion);
  }

  function refreshUserAvatars() {
    profileVersion += 1;
    $$('.user-message').forEach(applyUserAvatar);
    const preview = $('#boraiProfileAvatar');
    avatarMarkup(preview, profile);
    const previewName = $('#boraiProfilePreviewName');
    if (previewName) previewName.textContent = profile.name || 'Seu perfil';
    const previewEmail = $('#boraiProfilePreviewEmail');
    if (previewEmail) previewEmail.textContent = profile.email || 'Informações opcionais';
  }

  function addSettingsScreen() {
    const main = $('#mainContent');
    if (!main || $('#boraiSettingsView')) return;
    const view = document.createElement('section');
    view.id = 'boraiSettingsView';
    view.className = 'tab-view borai-settings-view';
    view.hidden = true;
    view.innerHTML = `
      <div class="tab-heading">
        <div class="heading-icon" aria-hidden="true">⚙</div>
        <div><p class="eyebrow">SUA CONTA NO BORAÍ</p><h1>Configurações</h1><p>Personalize seus dados quando quiser.</p></div>
      </div>
      <p class="borai-settings-intro">Todos os campos são opcionais. Como esta é uma versão de demonstração, as informações ficam salvas somente neste navegador. Não é necessário criar uma conta.</p>
      <div class="borai-profile-card">
        <div class="borai-user-avatar" id="boraiProfileAvatar">V</div>
        <div><strong id="boraiProfilePreviewName">Seu perfil</strong><small id="boraiProfilePreviewEmail">Informações opcionais</small></div>
      </div>
      <form class="settings-card borai-settings-form" id="boraiProfileForm">
        <h2>Dados pessoais</h2>
        <p>Preencha apenas o que desejar.</p>
        <div class="form-field">
          <label for="boraiProfileName">Nome</label>
          <input id="boraiProfileName" name="name" type="text" maxlength="60" autocomplete="name" placeholder="Como gostaria de ser chamado?">
        </div>
        <div class="form-field">
          <label for="boraiProfileEmail">E-mail ou conta Boraí</label>
          <input id="boraiProfileEmail" name="email" type="text" maxlength="100" autocomplete="email" placeholder="seuemail@gmail.com">
          <p class="field-note">Campo demonstrativo: não realiza login nem valida uma conta.</p>
        </div>
        <div class="form-field">
          <label for="boraiProfilePhone">Número de telefone</label>
          <input id="boraiProfilePhone" name="phone" type="tel" maxlength="16" autocomplete="tel" placeholder="(11) 99999-9999">
        </div>
        <div class="form-field">
          <label for="boraiProfileResidence">Endereço de moradia</label>
          <input id="boraiProfileResidence" name="residence" type="text" maxlength="160" autocomplete="street-address" placeholder="Rua, número, bairro e cidade">
          <p class="field-note">Opcional. Não compartilhe informações que não queira manter neste aparelho.</p>
        </div>
        <div class="form-field">
          <label for="boraiProfilePhoto">Foto de perfil</label>
          <div class="borai-photo-actions">
            <input id="boraiProfilePhoto" type="file" accept="image/*">
            <button type="button" class="secondary-button" id="boraiRemovePhoto">Remover foto</button>
          </div>
          <p class="field-note">Ao escolher uma foto, ela será reduzida e salva somente neste navegador.</p>
        </div>
        <div class="borai-settings-actions">
          <button class="primary-button" type="submit">Salvar configurações</button>
          <button class="secondary-button" type="button" id="boraiClearProfile">Apagar meus dados deste aparelho</button>
        </div>
      </form>
      <p class="demo-note">A foto ou a inicial do seu nome aparecerá ao lado das mensagens que você enviar à BIA. Esses dados de perfil não são enviados ao Gemini.</p>
    `;
    main.append(view);

    const drawer = $('#sideDrawer');
    if (drawer && !$('[data-borai-settings]', drawer)) {
      const foot = $('.drawer-foot', drawer);
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.boraiSettings = 'true';
      button.innerHTML = '<span class="drawer-settings-icon">⚙</span> <span>Configurações</span>';
      if (foot) drawer.insertBefore(button, foot);
      else drawer.append(button);
    }

    $('#boraiProfileName').value = profile.name || '';
    $('#boraiProfileEmail').value = profile.email || '';
    $('#boraiProfilePhone').value = profile.phone || '';
    $('#boraiProfileResidence').value = profile.residence || '';
    refreshUserAvatars();
  }

  function closeSideDrawer() {
    const drawer = $('#sideDrawer');
    const backdrop = $('#drawerBackdrop');
    if (drawer) {
      drawer.classList.remove('open');
      drawer.setAttribute('aria-hidden', 'true');
    }
    if (backdrop) backdrop.hidden = true;
    const menu = $('#menuButton');
    if (menu) menu.setAttribute('aria-expanded', 'false');
  }

  function openSettings() {
    const settings = $('#boraiSettingsView');
    if (!settings) return;
    $$('.home-view, .tab-view').forEach(section => { section.hidden = true; });
    settings.hidden = false;
    $$('.nav-item').forEach(button => button.classList.remove('active'));
    closeSideDrawer();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    refreshUserAvatars();
  }

  function openCustomModal(html) {
    const backdrop = $('#modalBackdrop');
    const content = $('#modalContent');
    if (!backdrop || !content) return;
    content.innerHTML = html;
    backdrop.hidden = false;
  }

  async function getJson(url) {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Falha ao consultar a lista oficial (${response.status}).`);
    return response.json();
  }

  async function getBrazilStates() {
    if (statesCache) return statesCache;
    const cache = readStore('borai-ibge-states', null);
    try {
      const states = await getJson('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome');
      statesCache = states;
      writeStore('borai-ibge-states', states);
      return states;
    } catch (error) {
      if (cache && cache.length) {
        statesCache = cache;
        return cache;
      }
      throw error;
    }
  }

  async function getBrazilMunicipalities(uf) {
    if (cityCache.has(uf)) return cityCache.get(uf);
    const cache = readStore(`borai-ibge-cities-${uf}`, null);
    try {
      const cities = await getJson(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${encodeURIComponent(uf)}/municipios?orderBy=nome`);
      cityCache.set(uf, cities);
      writeStore(`borai-ibge-cities-${uf}`, cities);
      return cities;
    } catch (error) {
      if (cache && cache.length) {
        cityCache.set(uf, cache);
        return cache;
      }
      throw error;
    }
  }

  async function populateMunicipalities(uf, preferredCity) {
    const citySelect = $('#boraiRegionCity');
    const search = $('#boraiRegionSearch');
    const status = $('#boraiRegionStatus');
    const saveButton = $('#boraiRegionSave');
    if (!citySelect) return;
    citySelect.disabled = true;
    saveButton.disabled = true;
    status.textContent = 'Carregando municípios deste estado...';
    try {
      const municipalities = await getBrazilMunicipalities(uf);
      citySelect.innerHTML = '<option value="">Selecione um município</option>';
      municipalities.forEach(item => {
        const option = document.createElement('option');
        option.value = item.nome;
        option.textContent = item.nome;
        citySelect.append(option);
      });
      const found = municipalities.find(item => item.nome.toLocaleLowerCase('pt-BR') === String(preferredCity || '').toLocaleLowerCase('pt-BR'));
      if (found) citySelect.value = found.nome;
      if (search) search.value = '';
      citySelect.disabled = false;
      saveButton.disabled = false;
      status.textContent = `${municipalities.length} municípios disponíveis neste estado, conforme a lista do IBGE.`;
    } catch (error) {
      citySelect.innerHTML = '<option value="">Lista indisponível</option>';
      status.innerHTML = '';
      const message = document.createElement('div');
      message.className = 'borai-region-error';
      message.textContent = 'Não foi possível carregar a lista oficial de municípios. Verifique a conexão e tente novamente.';
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'secondary-button';
      retry.textContent = 'Tentar novamente';
      retry.addEventListener('click', () => populateMunicipalities(uf, preferredCity));
      message.append(retry);
      status.append(message);
      saveButton.disabled = true;
    }
  }

  async function openRegionPicker() {
    openCustomModal(`
      <p class="eyebrow">SUA REGIÃO</p>
      <h2 id="modalTitle">Escolha onde você está</h2>
      <p class="borai-region-help">Selecione primeiro o estado e depois um município brasileiro. A lista é consultada na base oficial de localidades do IBGE.</p>
      <div class="borai-region-form">
        <div class="form-field"><label for="boraiRegionState">Estado</label><select id="boraiRegionState" required disabled><option>Carregando estados...</option></select></div>
        <div class="form-field"><label for="boraiRegionSearch">Pesquisar município</label><input id="boraiRegionSearch" type="search" placeholder="Digite para filtrar a lista"></div>
        <div class="form-field"><label for="boraiRegionCity">Município</label><select id="boraiRegionCity" required disabled><option>Selecione um estado primeiro</option></select></div>
        <p id="boraiRegionStatus" class="borai-region-help" aria-live="polite">Carregando lista do IBGE...</p>
        <button class="primary-button" id="boraiRegionSave" type="button" disabled>Salvar região</button>
      </div>
    `);

    const stateSelect = $('#boraiRegionState');
    const citySelect = $('#boraiRegionCity');
    const search = $('#boraiRegionSearch');
    try {
      const states = await getBrazilStates();
      stateSelect.innerHTML = '<option value="">Selecione um estado</option>';
      states.forEach(item => {
        const option = document.createElement('option');
        option.value = item.sigla;
        option.textContent = `${item.nome} (${item.sigla})`;
        stateSelect.append(option);
      });
      stateSelect.disabled = false;
      stateSelect.value = states.some(item => item.sigla === selectedState) ? selectedState : 'SP';
      await populateMunicipalities(stateSelect.value, selectedCity);

      stateSelect.addEventListener('change', () => populateMunicipalities(stateSelect.value, ''));
      search.addEventListener('input', () => {
        const term = search.value.toLocaleLowerCase('pt-BR').trim();
        Array.from(citySelect.options).forEach((option, index) => {
          if (index === 0) return;
          option.hidden = term && !option.textContent.toLocaleLowerCase('pt-BR').includes(term);
        });
      });
      citySelect.addEventListener('change', () => { $('#boraiRegionSave').disabled = !citySelect.value; });
      $('#boraiRegionSave').addEventListener('click', () => {
        if (!stateSelect.value || !citySelect.value) return;
        selectedState = stateSelect.value;
        selectedCity = citySelect.value;
        if (!writeStore(REGION_KEY_CITY, selectedCity) || !writeStore(REGION_KEY_STATE, selectedState)) {
          alert('Não foi possível salvar a região neste navegador.');
          return;
        }
        const label = $('#cityLabel');
        if (label) label.textContent = `${selectedState} - ${selectedCity}`;
        const mapLabel = $('#mapCityLabel');
        if (mapLabel) mapLabel.textContent = selectedCity;
        $('#modalBackdrop').hidden = true;
        window.location.reload();
      });
    } catch (error) {
      const status = $('#boraiRegionStatus');
      if (status) {
        status.textContent = 'Não foi possível carregar os estados brasileiros. Verifique sua conexão e abra esta tela novamente.';
        status.classList.add('borai-region-error');
      }
    }
  }

  function selectedPlaceText() {
    return `${selectedCity}, ${selectedState}, Brasil`;
  }

  function updateSavedRoutes(origin, destination) {
    const saved = readStore('borai-routes', []);
    const next = [{ id: Date.now(), origin, destination }, ...saved].slice(0, 6);
    writeStore('borai-routes', next);
    const section = $('#savedSection');
    const container = $('#savedRoutes');
    if (section && container) {
      section.hidden = next.length === 0;
      container.innerHTML = '';
      next.forEach(route => {
        const article = document.createElement('article');
        article.className = 'saved-route';
        const small = document.createElement('small');
        small.textContent = 'TRAJETO FAVORITO';
        const title = document.createElement('strong');
        title.textContent = `${route.origin} → ${route.destination}`;
        const open = document.createElement('button');
        open.type = 'button';
        open.textContent = 'Consultar novamente ↗';
        open.addEventListener('click', () => {
          const params = new URLSearchParams({
            api: '1',
            origin: `${route.origin}, ${selectedPlaceText()}`,
            destination: `${route.destination}, ${selectedPlaceText()}`,
            travelmode: 'transit'
          });
          window.open(`https://www.google.com/maps/dir/?${params.toString()}`, '_blank', 'noopener,noreferrer');
        });
        article.append(small, title, open);
        container.append(article);
      });
    }
  }

  function openRouteWithSelectedRegion() {
    openCustomModal(`
      <p class="eyebrow">PLANEJAMENTO DE VIAGEM</p>
      <h2 id="modalTitle">Para onde vamos?</h2>
      <p>Informe a origem e o destino. A consulta será aberta no Google Maps usando sua região escolhida: <strong>${selectedCity} - ${selectedState}</strong>.</p>
      <form id="boraiRouteForm">
        <div class="form-field"><label for="boraiRouteOrigin">Ponto de partida</label><input id="boraiRouteOrigin" required maxlength="120" placeholder="Ex.: Estação Central"></div>
        <div class="form-field"><label for="boraiRouteDestination">Destino</label><input id="boraiRouteDestination" required maxlength="120" placeholder="Ex.: Shopping"></div>
        <label class="setting-line" style="border:0"><span>Salvar este trajeto nos favoritos</span><input id="boraiSaveRoute" type="checkbox" checked><i></i></label>
        <button class="primary-button" type="submit">Consultar trajeto ↗</button>
      </form>
      <div id="boraiRouteResult"></div>
    `);
    $('#boraiRouteForm').addEventListener('submit', event => {
      event.preventDefault();
      const origin = $('#boraiRouteOrigin').value.trim();
      const destination = $('#boraiRouteDestination').value.trim();
      if (!origin || !destination) return;
      if ($('#boraiSaveRoute').checked) updateSavedRoutes(origin, destination);
      const params = new URLSearchParams({
        api: '1',
        origin: `${origin}, ${selectedPlaceText()}`,
        destination: `${destination}, ${selectedPlaceText()}`,
        travelmode: 'transit'
      });
      const url = `https://www.google.com/maps/dir/?${params.toString()}`;
      const result = $('#boraiRouteResult');
      result.innerHTML = '';
      const box = document.createElement('div');
      box.className = 'modal-result';
      const title = document.createElement('strong');
      title.textContent = 'Consulta pronta';
      const info = document.createElement('span');
      info.textContent = 'O Google Maps abrirá as opções de transporte público. Horários e trajetos são fornecidos pelo serviço externo.';
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Abrir opções no Google Maps ↗';
      box.append(title, info, document.createElement('br'), link);
      result.append(box);
    });
  }

  function openTransportWithSelectedRegion() {
    openCustomModal(`
      <p class="eyebrow">ENCONTRE UM MEIO DE TRANSPORTE</p>
      <h2 id="modalTitle">O que você procura?</h2>
      <p>Pesquise em <strong>${selectedCity} - ${selectedState}</strong>.</p>
      <div class="form-field"><label for="boraiTransportType">Modalidade</label>
        <select id="boraiTransportType">
          <option value="pontos de ônibus">Ônibus</option>
          <option value="estação de trem CPTM">Trem / CPTM</option>
          <option value="estação de metrô">Metrô</option>
          <option value="terminal de transporte público">Terminais</option>
          <option value="transporte público">Outros transportes públicos</option>
        </select>
      </div>
      <div class="form-field"><label for="boraiTransportArea">Bairro ou referência (opcional)</label><input id="boraiTransportArea" placeholder="Ex.: Centro"></div>
      <button class="primary-button" id="boraiTransportSearch">Pesquisar no mapa ↗</button>
    `);
    $('#boraiTransportSearch').addEventListener('click', () => {
      const type = $('#boraiTransportType').value;
      const area = $('#boraiTransportArea').value.trim();
      const query = `${type} ${area} ${selectedPlaceText()}`;
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, '_blank', 'noopener,noreferrer');
    });
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
      if (!file || !file.type.startsWith('image/')) {
        reject(new Error('Selecione um arquivo de imagem.'));
        return;
      }
      if (file.size > 8 * 1024 * 1024) {
        reject(new Error('A imagem deve ter até 8 MB.'));
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Não foi possível abrir essa imagem.'));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error('O arquivo selecionado não é uma imagem válida.'));
        image.onload = () => {
          const max = 320;
          const scale = Math.min(1, max / Math.max(image.width, image.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          const context = canvas.getContext('2d');
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          try {
            resolve(canvas.toDataURL('image/jpeg', 0.78));
          } catch {
            reject(new Error('Não foi possível preparar essa foto.'));
          }
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function showToastSafe(message) {
    const toast = $('#toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    window.setTimeout(() => toast.classList.remove('show'), 2800);
  }

  function handleProfileForm() {
    const form = $('#boraiProfileForm');
    if (!form) return;
    $('#boraiProfilePhone').addEventListener('input', event => {
      event.target.value = formatPhone(event.target.value);
    });
    $('#boraiProfilePhoto').addEventListener('change', async event => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      try {
        profile.photo = await compressImage(file);
        refreshUserAvatars();
        showToastSafe('Foto de perfil selecionada. Toque em Salvar configurações para confirmar.');
      } catch (error) {
        alert(error.message);
        event.target.value = '';
      }
    });
    $('#boraiRemovePhoto').addEventListener('click', () => {
      profile.photo = '';
      $('#boraiProfilePhoto').value = '';
      refreshUserAvatars();
    });
    $('#boraiClearProfile').addEventListener('click', () => {
      if (!confirm('Apagar nome, e-mail, telefone, endereço e foto salvos neste aparelho?')) return;
      profile = { name: '', email: '', phone: '', residence: '', photo: '' };
      writeStore(PROFILE_KEY, profile);
      form.reset();
      refreshUserAvatars();
      showToastSafe('Dados de perfil apagados deste aparelho.');
    });
    form.addEventListener('submit', event => {
      event.preventDefault();
      profile.name = $('#boraiProfileName').value.trim();
      profile.email = $('#boraiProfileEmail').value.trim();
      profile.phone = $('#boraiProfilePhone').value.trim();
      profile.residence = $('#boraiProfileResidence').value.trim();
      if (!writeStore(PROFILE_KEY, profile)) {
        alert('O navegador não conseguiu salvar os dados. Tente remover uma imagem ou liberar espaço.');
        return;
      }
      refreshUserAvatars();
      showToastSafe('Configurações salvas neste aparelho.');
    });
  }

  function registerCaptureHandlers() {
    document.addEventListener('click', event => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      if (target.closest('#cityPicker')) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        openRegionPicker();
        return;
      }

      if (target.closest('#addRouteButton, #routeArrow, #mapRouteButton')) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        openRouteWithSelectedRegion();
        return;
      }

      if (target.closest('#addTransportButton, #transportArrow, #mapTransportButton')) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        openTransportWithSelectedRegion();
        return;
      }

      const settingsButton = target.closest('[data-borai-settings]');
      if (settingsButton) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        openSettings();
      }
    }, true);

    document.addEventListener('click', event => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const drawerButton = target.closest('[data-drawer-tab="settings"]');
      if (drawerButton) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        openSettings();
        return;
      }
      const anyDrawerTab = target.closest('[data-drawer-tab]');
      if (anyDrawerTab && $('#boraiSettingsView')) $('#boraiSettingsView').hidden = true;
      const navButton = target.closest('.nav-item[data-tab]');
      if (navButton && $('#boraiSettingsView')) $('#boraiSettingsView').hidden = true;
    }, true);
  }

  function startAvatarObserver() {
    const chat = $('#chatMessages');
    if (!chat || !('MutationObserver' in window)) return;
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (!(node instanceof Element)) return;
          if (node.matches('.user-message')) applyUserAvatar(node);
          node.querySelectorAll && node.querySelectorAll('.user-message').forEach(applyUserAvatar);
        });
      });
    });
    observer.observe(chat, { childList: true, subtree: true });
  }

  function bindProfileAndRegion() {
    const cityLabel = $('#cityLabel');
    if (cityLabel) cityLabel.textContent = `${selectedState} - ${selectedCity}`;
    const mapCityLabel = $('#mapCityLabel');
    if (mapCityLabel) mapCityLabel.textContent = selectedCity;
    handleProfileForm();
    startAvatarObserver();
    refreshUserAvatars();
  }

  injectStyles();
  addSettingsScreen();
  registerCaptureHandlers();
  bindProfileAndRegion();
})();