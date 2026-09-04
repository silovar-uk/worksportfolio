(() => {
  'use strict';

  let bound = false;

  function compactHtml() {
    return `
      <button type="button" class="floating-random-launch" data-floating-random-draw aria-label="ランダム3枚を引き直す" style="display:flex!important;width:auto!important;height:44px!important;padding:0 10px!important;gap:7px!important;align-items:center!important">
        <span class="floating-random-dice" aria-hidden="true">🎲</span>
        <span class="floating-random-copy" style="display:grid!important;text-align:left!important;line-height:1.05!important"><strong>3枚引き直す</strong><small style="display:none!important">ランダムで3枚</small></span>
      </button>`;
  }

  function ensureHost() {
    let host = document.querySelector('[data-floating-random]');
    if (!host && document.body) {
      host = document.createElement('aside');
      host.className = 'floating-random';
      host.dataset.floatingRandom = '';
      document.body.appendChild(host);
    }
    return host;
  }

  function render() {
    const host = ensureHost();
    if (!host) return;
    host.classList.remove('is-expanded');
    const html = compactHtml();
    if (host.innerHTML !== html) host.innerHTML = html;
  }

  function redrawThree() {
    const section = document.querySelector('[data-random-three]');
    if (!section) return;

    if (section.classList.contains('is-mobile-collapsed')) {
      const toggle = section.querySelector('[data-random-three-mobile-toggle]');
      if (toggle) toggle.click();
      else section.classList.remove('is-mobile-collapsed');
    }

    section.querySelector('[data-random-three-refresh]')?.click();
    requestAnimationFrame(() => {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function bindEvents() {
    if (bound) return;
    bound = true;
    document.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest('[data-floating-random-draw]')) return;
      event.preventDefault();
      redrawThree();
    }, true);
  }

  function start() {
    bindEvents();
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
