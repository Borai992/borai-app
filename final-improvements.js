(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const safeRead = (key, fallback) => {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  };
  const safeWrite = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  };

  const TEXT_SIZE_KEY = 'borai-accessibility-text-sizes-v1';
  const BIA_POSITION_KEY = 'borai-bia-orb-position-v1';
  const DEFAULT_TEXT_SIZES = { small: 100, normal: 100, titles: 100 };
  let textSizes = { ...DEFAULT_TEXT_SIZES, ...(safeRead(TEXT_SIZE_KEY, {}) || {}) };

  function injectFinalStyles() {
    if ($('#borai-final-improvements-style')) return;
    const style = document.createElement('style');
    style.id = 'borai-final-improvements-style';
    style.textContent = `
      /* Identidade visual dos ícones de configurações */
      .drawer-settings-icon,
      .borai-settings-view .heading-icon {
        color: #ef7800 !important;
      }
      .drawer-settings-icon {
        font-size: 22px;
        line-height: 1;
      }
      .borai-settings-view .heading-icon {
        background: #fff0df;
        border-color: #ffd5aa;
      }

      /* Carrossel de anúncios demonstrativos */
      #adSection { position: relative; }
      .borai-ad-track {
        display: flex;
        width: 100%;
        gap: 0;
        overflow-x: auto;
        overflow-y: hidden;
        scroll-snap-type: x mandatory;
        scroll-behavior: smooth;
        overscroll-behavior-x: contain;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
      }
      .borai-ad-track::-webkit-scrollbar { display: none; }
      .borai-ad-slide {
        flex: 0 0 100%;
        min-width: 0;
        scroll-snap-align: start;
      }
      .borai-ad-slide > .ad-banner,
      .borai-demo-banner {
        min-height: 174px;
        height: 174px;
        border-radius: 24px;
      }
      .borai-ad-slide .ad-tag {
        max-width: calc(100% - 58px);
      }
      .borai-demo-banner {
        position: relative;
        display: flex;
        align-items: center;
        overflow: hidden;
        isolation: isolate;
        padding: 18px 24px;
        color: #fff;
        background: linear-gradient(112deg, #a94a00 0%, #e87500 58%, #ff9b36 100%);
        box-shadow: 0 5px 14px rgba(83,45,18,.16);
      }
      .borai-demo-banner::before {
        content: "";
        position: absolute;
        z-index: -1;
        width: 230px;
        height: 230px;
        right: -35px;
        top: -90px;
        border: 24px solid rgba(255,255,255,.13);
        border-radius: 50%;
      }
      .borai-demo-banner::after {
        content: "";
        position: absolute;
        z-index: -1;
        width: 170px;
        height: 170px;
        right: 58px;
        bottom: -125px;
        border: 18px solid rgba(255,255,255,.13);
        border-radius: 50%;
      }
      .borai-demo-banner.theme-partner {
        background: linear-gradient(112deg, #573b2a 0%, #95603a 56%, #d18a4c 100%);
      }
      .borai-demo-banner.theme-city {
        background: linear-gradient(112deg, #7d3b08 0%, #d45f00 58%, #f89b30 100%);
      }
      .borai-demo-copy {
        position: relative;
        z-index: 2;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 5px;
        max-width: 74%;
      }
      .borai-demo-tag {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        margin-bottom: 3px;
        border: 1px solid rgba(255,255,255,.55);
        border-radius: 20px;
        padding: 4px 9px;
        background: rgba(45,25,12,.22);
        color: #fff;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: .45px;
        text-transform: uppercase;
      }
      .borai-demo-copy strong {
        display: block;
        font-size: 23px;
        line-height: 1.08;
        font-weight: 800;
      }
      .borai-demo-copy > span:not(.borai-demo-tag) {
        font-size: 12px;
        line-height: 1.35;
        opacity: .95;
      }
      .borai-demo-action {
        margin-top: 4px;
        border: 0;
        border-radius: 24px;
        padding: 8px 14px;
        background: #fff7ee;
        color: #9a4700;
        font-size: 12px;
        font-weight: 800;
        cursor: pointer;
      }
      .borai-demo-art {
        position: absolute;
        right: 22px;
        bottom: 14px;
        display: grid;
        place-items: center;
        width: 105px;
        height: 105px;
        border: 2px solid rgba(255,255,255,.65);
        border-radius: 50%;
        background: rgba(255,255,255,.13);
        color: #fff;
        font-size: 48px;
        text-shadow: 0 3px 8px rgba(50,20,0,.2);
      }
      .borai-ad-dots {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 8px;
        padding: 11px 0 2px;
      }
      .borai-ad-dot {
        width: 8px;
        height: 8px;
        padding: 0;
        border: 0;
        border-radius: 99px;
        background: #e7c7a8;
        cursor: pointer;
        transition: width .18s ease, background .18s ease;
      }
      .borai-ad-dot[aria-current="true"] {
        width: 22px;
        background: #ef7800;
      }

      /* A BIA pode ser movimentada dentro da ilustração inicial */
      .welcome-visual .bia-callout {
        z-index: 4;
        width: 250px;
        min-height: 300px;
        text-align: center;
        touch-action: none;
        user-select: none;
        -webkit-user-select: none;
      }
      .welcome-visual .bia-callout p {
        margin-left: auto;
        margin-right: auto;
      }
      .welcome-visual .bia-orb {
        width: 220px;
        height: 220px;
        touch-action: none;
        cursor: grab;
        user-select: none;
        -webkit-user-select: none;
      }
      .welcome-visual .bia-orb:active { cursor: grabbing; }
      .welcome-visual .bia-orb.is-dragging { cursor: grabbing; }
      @media (max-width: 600px) {
        .welcome-visual .bia-callout { width: 218px; min-height: 270px; }
        .welcome-visual .bia-orb { width: 190px; height: 190px; }
        .borai-demo-banner { padding: 15px 16px; }
        .borai-demo-copy { max-width: 76%; }
        .borai-demo-copy strong { font-size: 19px; }
        .borai-demo-art { width: 78px; height: 78px; right: 13px; bottom: 22px; font-size: 36px; }
      }

      /* Controles independentes de acessibilidade */
      .borai-text-size-panel {
        display: grid;
        gap: 14px;
        margin: 12px 0 18px;
      }
      .borai-size-control {
        padding: 12px 13px;
        border: 1px solid #f0d4b8;
        border-radius: 14px;
        background: #fffaf4;
      }
      .borai-size-control-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        margin-bottom: 8px;
        color: #493525;
        font-size: 14px;
        font-weight: 700;
      }
      .borai-size-value {
        flex: none;
        color: #a84f08;
        font-size: 12px;
        font-weight: 800;
        font-variant-numeric: tabular-nums;
      }
      .borai-size-control input[type="range"] {
        display: block;
        width: 100%;
        min-height: 24px;
        margin: 0;
        accent-color: #ef7800;
        cursor: pointer;
      }
      .borai-size-hint {
        display: flex;
        justify-content: space-between;
        margin-top: 2px;
        color: #86786c;
        font-size: 10px;
      }
      .borai-text-size-reset {
        width: 100%;
        min-height: 43px;
        margin-top: 1px;
        border: 1px solid #e5b98f;
        border-radius: 12px;
        background: #fff;
        color: #99500e;
        font-size: 13px;
        font-weight: 800;
        cursor: pointer;
      }
      .borai-text-size-reset:focus-visible,
      .borai-size-control input:focus-visible,
      .borai-ad-dot:focus-visible,
      .borai-demo-action:focus-visible {
        outline: 3px solid rgba(239,120,0,.35);
        outline-offset: 3px;
      }
    `;
    document.head.append(style);
  }

  function turnMunicipalitySearchOff() {
    const modalContent = $('#modalContent');
    if (!modalContent || !('MutationObserver' in window)) return;

    const removeSearchField = root => {
      const search = $('#boraiRegionSearch', root);
      if (!search) return;
      // O elemento é retirado visualmente, mas a referência mantida pela função
      // existente continua válida; assim, o restante do seletor do IBGE não quebra.
      const field = search.closest('.form-field');
      if (field) field.remove();
      else search.remove();
    };

    removeSearchField(modalContent);
    const observer = new MutationObserver(records => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          if (node.id === 'boraiRegionSearch' || $('#boraiRegionSearch', node)) {
            removeSearchField(modalContent);
          }
        }
      }
    });
    observer.observe(modalContent, { childList: true, subtree: true });
  }

  function buildAdCarousel() {
    const section = $('#adSection');
    if (!section || section.dataset.boraiCarouselReady === 'true') return;
    const originalBanner = $('.ad-banner', section);
    if (!originalBanner) return;

    section.dataset.boraiCarouselReady = 'true';
    const originalTag = $('.ad-tag', originalBanner);
    if (originalTag) originalTag.innerHTML = 'Anúncio demonstrativo <span aria-hidden="true">ⓘ</span>';

    const track = document.createElement('div');
    track.className = 'borai-ad-track';
    track.setAttribute('aria-label', 'Carrossel de anúncios demonstrativos');
    track.setAttribute('tabindex', '0');

    const firstSlide = document.createElement('article');
    firstSlide.className = 'borai-ad-slide';
    firstSlide.setAttribute('aria-label', 'Anúncio 1 de 3');
    firstSlide.append(originalBanner);
    track.append(firstSlide);

    const promotions = [
      {
        theme: 'theme-partner',
        tag: 'Parceria demonstrativa',
        title: 'Café da Estação: uma pausa no caminho.',
        description: 'Exemplo fictício de divulgação de um comércio local.',
        action: 'Ver exemplo',
        art: '☕',
        message: 'Este é um exemplo fictício de parceria. Nenhuma empresa foi contratada pelo Boraí.'
      },
      {
        theme: 'theme-city',
        tag: 'Anúncio demonstrativo',
        title: 'Boraí+ — sua mobilidade sem interrupções.',
        description: 'Conheça a experiência sem anúncios e os recursos extras da BIA.',
        action: 'Ver planos',
        art: '✦',
        message: 'O Boraí+ é uma oferta demonstrativa: R$ 8,99 por mês ou R$ 89,99 por ano. Ainda não há cobrança real.'
      }
    ];

    promotions.forEach((promotion, index) => {
      const slide = document.createElement('article');
      slide.className = 'borai-ad-slide';
      slide.setAttribute('aria-label', `Anúncio ${index + 2} de 3`);
      const banner = document.createElement('div');
      banner.className = `borai-demo-banner ${promotion.theme}`;

      const copy = document.createElement('div');
      copy.className = 'borai-demo-copy';
      const tag = document.createElement('span');
      tag.className = 'borai-demo-tag';
      tag.textContent = promotion.tag;
      const title = document.createElement('strong');
      title.textContent = promotion.title;
      const description = document.createElement('span');
      description.textContent = promotion.description;
      const action = document.createElement('button');
      action.type = 'button';
      action.className = 'borai-demo-action';
      action.textContent = promotion.action;
      action.addEventListener('click', () => {
        if (index === 1) {
          const plusTab = $('.nav-item[data-tab="plus"]');
          if (plusTab) plusTab.click();
        } else {
          showLocalToast(promotion.message);
        }
      });
      copy.append(tag, title, description, action);

      const art = document.createElement('div');
      art.className = 'borai-demo-art';
      art.setAttribute('aria-hidden', 'true');
      art.textContent = promotion.art;
      banner.append(copy, art);
      slide.append(banner);
      track.append(slide);
    });

    const dots = document.createElement('div');
    dots.className = 'borai-ad-dots';
    dots.setAttribute('role', 'group');
    dots.setAttribute('aria-label', 'Escolher anúncio');
    const dotButtons = [];
    for (let i = 0; i < 3; i += 1) {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'borai-ad-dot';
      dot.setAttribute('aria-label', `Mostrar anúncio ${i + 1}`);
      dot.setAttribute('aria-current', i === 0 ? 'true' : 'false');
      dot.addEventListener('click', () => {
        track.scrollTo({ left: i * track.clientWidth, behavior: 'smooth' });
      });
      dots.append(dot);
      dotButtons.push(dot);
    }

    section.replaceChildren(track, dots);

    const updateActiveDot = () => {
      const index = Math.max(0, Math.min(2, Math.round(track.scrollLeft / Math.max(1, track.clientWidth))));
      dotButtons.forEach((dot, dotIndex) => {
        dot.setAttribute('aria-current', dotIndex === index ? 'true' : 'false');
      });
    };
    track.addEventListener('scroll', updateActiveDot, { passive: true });
    track.addEventListener('keydown', event => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const current = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
      const next = Math.max(0, Math.min(2, current + (event.key === 'ArrowRight' ? 1 : -1)));
      track.scrollTo({ left: next * track.clientWidth, behavior: 'smooth' });
    });
    window.addEventListener('resize', updateActiveDot);
  }

  function showLocalToast(message) {
    const toast = $('#toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    window.setTimeout(() => toast.classList.remove('show'), 3600);
  }

  function makeBiaDraggable() {
    const stage = $('.welcome-visual');
    const callout = $('.welcome-visual .bia-callout');
    const orb = $('#openBiaButton');
    if (!stage || !callout || !orb || orb.dataset.boraiDraggable === 'true') return;
    orb.dataset.boraiDraggable = 'true';

    const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max));
    const getLimits = () => {
      const stageRect = stage.getBoundingClientRect();
      const box = callout.getBoundingClientRect();
      return {
        width: stageRect.width,
        height: stageRect.height,
        boxWidth: box.width || callout.offsetWidth || 250,
        boxHeight: box.height || callout.offsetHeight || 300
      };
    };
    const saved = safeRead(BIA_POSITION_KEY, null);
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
      const limits = getLimits();
      callout.style.left = `${clamp(saved.x, 0, limits.width - limits.boxWidth)}px`;
      callout.style.top = `${clamp(saved.y, 0, limits.height - limits.boxHeight)}px`;
      callout.style.right = 'auto';
    }

    let pointer = null;
    let suppressClick = false;
    let startX = 0;
    let startY = 0;
    let originX = 0;
    let originY = 0;
    let moved = false;

    orb.addEventListener('pointerdown', event => {
      if (event.button !== undefined && event.button !== 0) return;
      const stageRect = stage.getBoundingClientRect();
      const calloutRect = callout.getBoundingClientRect();
      pointer = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      originX = calloutRect.left - stageRect.left;
      originY = calloutRect.top - stageRect.top;
      moved = false;
      try { orb.setPointerCapture(event.pointerId); } catch { /* captura não suportada */ }
    });

    orb.addEventListener('pointermove', event => {
      if (pointer === null || event.pointerId !== pointer) return;
      const deltaX = event.clientX - startX;
      const deltaY = event.clientY - startY;
      if (!moved && Math.hypot(deltaX, deltaY) < 6) return;
      moved = true;
      event.preventDefault();
      const limits = getLimits();
      const nextX = clamp(originX + deltaX, 0, limits.width - limits.boxWidth);
      const nextY = clamp(originY + deltaY, 0, limits.height - limits.boxHeight);
      callout.style.left = `${nextX}px`;
      callout.style.top = `${nextY}px`;
      callout.style.right = 'auto';
      orb.classList.add('is-dragging');
    });

    const finishPointer = event => {
      if (pointer === null || (event && event.pointerId !== pointer)) return;
      if (moved) {
        const stageRect = stage.getBoundingClientRect();
        const calloutRect = callout.getBoundingClientRect();
        safeWrite(BIA_POSITION_KEY, {
          x: Math.round(calloutRect.left - stageRect.left),
          y: Math.round(calloutRect.top - stageRect.top)
        });
        suppressClick = true;
        window.setTimeout(() => { suppressClick = false; }, 700);
      }
      pointer = null;
      orb.classList.remove('is-dragging');
    };
    orb.addEventListener('pointerup', finishPointer);
    orb.addEventListener('pointercancel', finishPointer);
    document.addEventListener('click', event => {
      if (!suppressClick || !(event.target instanceof Element) || !event.target.closest('#openBiaButton')) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      suppressClick = false;
    }, true);

    window.addEventListener('resize', () => {
      const stageRect = stage.getBoundingClientRect();
      const box = callout.getBoundingClientRect();
      if (!callout.style.left || !callout.style.top) return;
      const currentX = parseFloat(callout.style.left) || 0;
      const currentY = parseFloat(callout.style.top) || 0;
      callout.style.left = `${clamp(currentX, 0, stageRect.width - box.width)}px`;
      callout.style.top = `${clamp(currentY, 0, stageRect.height - box.height)}px`;
      const current = safeRead(BIA_POSITION_KEY, null);
      if (current) safeWrite(BIA_POSITION_KEY, {
        x: parseFloat(callout.style.left),
        y: parseFloat(callout.style.top)
      });
    });
  }

  const TITLE_SELECTOR = [
    'h1', 'h2', 'h3',
    '.section-heading strong',
    '.plan-card strong',
    '.drawer-head strong',
    '.ad-copy strong',
    '.borai-demo-copy strong',
    '.borai-profile-card strong'
  ].join(',');
  const SMALL_SELECTOR = [
    'small', '.eyebrow', '.demo-note', '.field-note',
    '.borai-settings-intro', '.borai-region-help', '.borai-size-hint',
    '.settings-saved', '.ad-tag', '.borai-demo-tag',
    '.map-preview-tag', '.map-city-label', '.map-street-label',
    '.map-place-label', '.map-status p', '.section-heading > span'
  ].join(',');
  const TEXT_SELECTOR = '*';

  function elementScaleGroup(element) {
    if (element.matches(TITLE_SELECTOR)) return 'titles';
    if (element.matches(SMALL_SELECTOR)) return 'small';
    return 'normal';
  }

  function applyTextSizes(root = document) {
    const candidates = [];
    if (root instanceof Element) candidates.push(root);
    if (root.querySelectorAll) candidates.push(...$$(TEXT_SELECTOR, root));
    const elements = candidates.filter(element => {
      if (element.closest('head,script,style,svg')) return false;
      const isField = /^(INPUT|SELECT|TEXTAREA)$/.test(element.tagName);
      const hasDirectText = Array.from(element.childNodes).some(node =>
        node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0
      );
      return isField || hasDirectText;
    });

    // Captura os tamanhos originais antes de aplicar qualquer escala nesta rodada.
    const pending = elements.filter(element => {
      if (element.dataset.boraiFontBase) return false;
      return true;
    }).map(element => ({
      element,
      base: parseFloat(getComputedStyle(element).fontSize) || 16
    }));

    pending.forEach(({ element, base }) => {
      element.dataset.boraiFontBase = String(base);
    });

    elements.forEach(element => {
      const base = parseFloat(element.dataset.boraiFontBase);
      if (!Number.isFinite(base)) return;
      const group = elementScaleGroup(element);
      const scale = Number(textSizes[group]) || 100;
      element.dataset.boraiScale = String(scale);
      element.style.setProperty('font-size', `${(base * scale / 100).toFixed(2)}px`, 'important');
    });
  }

  function createTextSizeControls() {
    const card = $$('#preferencesView .settings-card').find(item => {
      const heading = $('h2', item);
      return heading && heading.textContent.trim().toLocaleLowerCase('pt-BR') === 'acessibilidade e avisos';
    });
    if (!card || card.dataset.boraiTextControls === 'true') return;
    card.dataset.boraiTextControls = 'true';

    const legacyToggle = $('input[data-pref="largeText"]', card);
    const legacyLine = legacyToggle ? legacyToggle.closest('.setting-line') : null;
    const insertionParent = legacyLine?.parentElement || card;
    const alertsLine = $('input[data-pref="alerts"]', card)?.closest('.setting-line') || null;
    if (legacyLine) legacyLine.remove();
    document.body.classList.remove('large-text-mode');

    const panel = document.createElement('div');
    panel.className = 'borai-text-size-panel';
    panel.setAttribute('aria-label', 'Controles de tamanho do texto');

    const controls = [
      { key: 'small', title: 'Textos pequenos e informações secundárias', hint: 'Ex.: textos cinzas, observações e etiquetas' },
      { key: 'normal', title: 'Textos normais', hint: 'Ex.: parágrafos, botões e campos' },
      { key: 'titles', title: 'Títulos e cabeçalhos', hint: 'Ex.: títulos das telas e dos cartões' }
    ];

    controls.forEach(control => {
      const wrapper = document.createElement('div');
      wrapper.className = 'borai-size-control';
      const head = document.createElement('div');
      head.className = 'borai-size-control-head';
      const label = document.createElement('label');
      label.htmlFor = `boraiTextSize-${control.key}`;
      label.textContent = control.title;
      const value = document.createElement('output');
      value.className = 'borai-size-value';
      value.id = `boraiTextSizeValue-${control.key}`;
      value.textContent = `${textSizes[control.key]}%`;
      head.append(label, value);

      const slider = document.createElement('input');
      slider.type = 'range';
      slider.id = `boraiTextSize-${control.key}`;
      slider.min = '85';
      slider.max = '150';
      slider.step = '5';
      slider.value = String(textSizes[control.key]);
      slider.setAttribute('aria-describedby', `boraiTextSizeHint-${control.key}`);
      slider.addEventListener('input', () => {
        textSizes[control.key] = Number(slider.value);
        value.textContent = `${slider.value}%`;
        safeWrite(TEXT_SIZE_KEY, textSizes);
        applyTextSizes(document);
      });

      const hint = document.createElement('div');
      hint.className = 'borai-size-hint';
      hint.id = `boraiTextSizeHint-${control.key}`;
      const min = document.createElement('span');
      min.textContent = 'Menor';
      const max = document.createElement('span');
      max.textContent = 'Maior';
      hint.append(min, max);

      wrapper.append(head, slider, hint);
      panel.append(wrapper);
    });

    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'borai-text-size-reset';
    reset.textContent = 'Restaurar tamanhos padrão';
    reset.addEventListener('click', () => {
      textSizes = { ...DEFAULT_TEXT_SIZES };
      safeWrite(TEXT_SIZE_KEY, textSizes);
      controls.forEach(control => {
        const slider = $(`#boraiTextSize-${control.key}`, panel);
        const value = $(`#boraiTextSizeValue-${control.key}`, panel);
        slider.value = String(DEFAULT_TEXT_SIZES[control.key]);
        value.textContent = `${DEFAULT_TEXT_SIZES[control.key]}%`;
      });
      applyTextSizes(document);
    });
    panel.append(reset);

    if (insertionParent) {
      insertionParent.insertBefore(panel, alertsLine && alertsLine.parentElement === insertionParent ? alertsLine : null);
    } else {
      card.append(panel);
    }
  }

  function observeDynamicText() {
    if (!('MutationObserver' in window)) return;
    const targets = [$('#mainContent'), $('#modalContent'), $('#sideDrawer')].filter(Boolean);
    if (!targets.length) return;
    const observer = new MutationObserver(records => {
      records.forEach(record => {
        record.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) applyTextSizes(node);
        });
      });
    });
    targets.forEach(target => observer.observe(target, { childList: true, subtree: true }));
  }

  injectFinalStyles();
  turnMunicipalitySearchOff();
  buildAdCarousel();
  makeBiaDraggable();
  createTextSizeControls();
  applyTextSizes(document);
  observeDynamicText();
})();
