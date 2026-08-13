(() => {
  'use strict';

  function validFavoriteCount() {
    try {
      const valid = new Set((window.BUILD_DIARY_DATA?.projects || []).map((project) => project.id));
      const saved = JSON.parse(localStorage.getItem('worksportfolio-personal-marks-v1') || '{}');
      return (Array.isArray(saved.favorites) ? saved.favorites : []).filter((id) => valid.has(id)).length;
    } catch (_) {
      return 0;
    }
  }

  function updateFavoriteStat() {
    const number = document.querySelector('[data-wow-stats] .portfolio-wow-number:last-child strong');
    if (number) number.textContent = String(validFavoriteCount());
  }

  function showStage() {
    const stage = document.querySelector('[data-portfolio-wow]');
    if (stage?.hidden) stage.hidden = false;
  }

  function switchToShelf() {
    const active = document.querySelector('[data-view-button].is-active');
    if (active?.getAttribute('data-view-button') === 'shelf') return;
    document.querySelector('[data-view-button="shelf"]')?.click();
  }

  function start() {
    const wait = () => {
      const stage = document.querySelector('[data-portfolio-wow]');
      if (!stage) {
        setTimeout(wait, 80);
        return;
      }
      showStage();
      const observer = new MutationObserver(showStage);
      observer.observe(stage, { attributes: true, attributeFilter: ['hidden'] });

      document.addEventListener('click', (event) => {
        if (event.target.closest('[data-wow-year]')) switchToShelf();
        if (event.target.closest('[data-view-button]')) setTimeout(showStage, 0);
        if (event.target.closest('[data-mark-toggle],[data-mark-bulk]')) setTimeout(updateFavoriteStat, 40);
      }, true);
      window.addEventListener('storage', (event) => {
        if (event.key === 'worksportfolio-personal-marks-v1') updateFavoriteStat();
      });
      updateFavoriteStat();
    };
    wait();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
