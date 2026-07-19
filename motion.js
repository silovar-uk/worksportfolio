(() => {
  'use strict';

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const revealed = new WeakSet();
  const tilted = new WeakSet();
  let revealObserver = null;
  let numberObserver = null;
  let mutationObserver = null;
  let activeTilt = null;
  let tiltFrame = 0;
  let pointerFrame = 0;

  function addProgress() {
    if (document.querySelector('.portfolio-motion-progress')) return;
    const bar = document.createElement('div');
    bar.className = 'portfolio-motion-progress';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);
    const update = () => {
      const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
      document.documentElement.style.setProperty('--scroll-progress', Math.min(1, scrollY / max));
    };
    update();
    addEventListener('scroll', update, { passive: true });
    addEventListener('resize', update, { passive: true });
  }

  function setupRevealObserver() {
    if (reduced.matches || revealObserver) return;
    revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: .08 });
  }

  function registerReveals(root = document) {
    setupRevealObserver();
    const selectors = [
      '.portfolio-wow-head > *',
      '.portfolio-strata',
      '.portfolio-pick',
      '.catalog-overview',
      '.catalog-group-head',
      '.catalog-row',
      '.catalog-card',
      '.catalog-table-wrap',
      '[data-project-surface]'
    ].join(',');
    root.querySelectorAll?.(selectors).forEach((element, index) => {
      if (revealed.has(element)) return;
      revealed.add(element);
      element.classList.add('motion-reveal');
      element.style.setProperty('--motion-index', String(index % 10));
      if (reduced.matches) element.classList.add('is-visible');
      else revealObserver?.observe(element);
    });
  }

  function animateNumber(element) {
    const target = Number(String(element.textContent).replace(/[^0-9.-]/g, ''));
    if (!Number.isFinite(target)) return;
    if (element.dataset.motionValue === String(target)) return;
    element.dataset.motionValue = String(target);
    const box = element.closest('.portfolio-wow-number');
    if (reduced.matches) {
      element.textContent = String(target);
      box?.classList.add('is-counted');
      return;
    }
    const startValue = Number(element.dataset.motionCurrent || 0);
    const start = performance.now();
    const duration = 820;
    box?.classList.remove('is-counted');
    box?.classList.add('is-counting');
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 4);
      const value = Math.round(startValue + (target - startValue) * eased);
      element.textContent = String(value);
      if (progress < 1) requestAnimationFrame(tick);
      else {
        element.dataset.motionCurrent = String(target);
        box?.classList.remove('is-counting');
        box?.classList.add('is-counted');
      }
    };
    requestAnimationFrame(tick);
  }

  function setupNumberObserver() {
    if (numberObserver) return;
    numberObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        animateNumber(entry.target);
        numberObserver.unobserve(entry.target);
      });
    }, { threshold: .55 });
  }

  function registerNumbers(root = document) {
    setupNumberObserver();
    root.querySelectorAll?.('.portfolio-wow-number strong').forEach((element) => {
      const displayed = Number(String(element.textContent).replace(/[^0-9.-]/g, ''));
      if (!Number.isFinite(displayed)) return;
      if (element.dataset.motionValue !== String(displayed)) {
        delete element.dataset.motionValue;
        numberObserver.observe(element);
      }
    });
  }

  function setWowPointer(event) {
    if (reduced.matches || !finePointer.matches) return;
    const wow = event.currentTarget;
    const rect = wow.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    if (pointerFrame) cancelAnimationFrame(pointerFrame);
    pointerFrame = requestAnimationFrame(() => {
      wow.style.setProperty('--mx', `${x}%`);
      wow.style.setProperty('--my', `${y}%`);
      wow.style.setProperty('--ambient-x', `${(x - 50) * .24}px`);
      wow.style.setProperty('--ambient-y', `${(y - 50) * .18}px`);
    });
  }

  function resetWowPointer(event) {
    const wow = event.currentTarget;
    wow.style.setProperty('--mx', '50%');
    wow.style.setProperty('--my', '30%');
    wow.style.setProperty('--ambient-x', '0px');
    wow.style.setProperty('--ambient-y', '0px');
  }

  function registerWow(root = document) {
    root.querySelectorAll?.('.portfolio-wow').forEach((wow) => {
      if (wow.dataset.motionBound) return;
      wow.dataset.motionBound = 'true';
      wow.addEventListener('pointermove', setWowPointer, { passive: true });
      wow.addEventListener('pointerleave', resetWowPointer, { passive: true });
    });
  }

  function tiltTargetAt(event) {
    if (reduced.matches || !finePointer.matches) return null;
    return event.target.closest('.portfolio-pick-card,.catalog-card,[data-project-surface]');
  }

  function applyTilt(event, target) {
    const rect = target.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    target.style.setProperty('--tilt-x', `${(0.5 - y) * 6}deg`);
    target.style.setProperty('--tilt-y', `${(x - 0.5) * 8}deg`);
  }

  function resetTilt(target) {
    if (!target) return;
    target.style.setProperty('--tilt-x', '0deg');
    target.style.setProperty('--tilt-y', '0deg');
  }

  function bindTilt() {
    document.addEventListener('pointermove', (event) => {
      const target = tiltTargetAt(event);
      if (target !== activeTilt) {
        resetTilt(activeTilt);
        activeTilt = target;
      }
      if (!target) return;
      if (tiltFrame) cancelAnimationFrame(tiltFrame);
      tiltFrame = requestAnimationFrame(() => applyTilt(event, target));
    }, { passive: true });
    document.addEventListener('pointerout', (event) => {
      if (!activeTilt) return;
      if (event.relatedTarget && activeTilt.contains(event.relatedTarget)) return;
      resetTilt(activeTilt);
      activeTilt = null;
    }, { passive: true });
  }

  function particleBurst(button) {
    if (reduced.matches) return;
    const rect = button.getBoundingClientRect();
    const colors = ['var(--red)', 'var(--yellow)', 'var(--type-web)', 'var(--type-extension)', 'var(--type-learning)'];
    for (let index = 0; index < 12; index += 1) {
      const particle = document.createElement('i');
      particle.className = 'motion-particle';
      particle.style.left = `${rect.left + rect.width / 2}px`;
      particle.style.top = `${rect.top + rect.height / 2}px`;
      const angle = (Math.PI * 2 * index) / 12 + Math.random() * .28;
      const distance = 42 + Math.random() * 74;
      particle.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
      particle.style.setProperty('--dy', `${Math.sin(angle) * distance}px`);
      particle.style.setProperty('--spin', `${Math.round(Math.random() * 320 - 160)}deg`);
      particle.style.setProperty('--particle-color', colors[index % colors.length]);
      document.body.appendChild(particle);
      particle.addEventListener('animationend', () => particle.remove(), { once: true });
    }
  }

  function bindInteractions() {
    document.addEventListener('click', (event) => {
      const shuffle = event.target.closest('[data-wow-shuffle]');
      if (shuffle) {
        shuffle.closest('.portfolio-pick')?.classList.add('is-shuffling');
        setTimeout(() => shuffle.closest('.portfolio-pick')?.classList.remove('is-shuffling'), 520);
        particleBurst(shuffle);
      }
      if (event.target.closest('[data-view-button]')) {
        document.body.classList.remove('is-view-transitioning');
        void document.body.offsetWidth;
        document.body.classList.add('is-view-transitioning');
        setTimeout(() => document.body.classList.remove('is-view-transitioning'), 380);
      }
    }, true);
  }

  function scan(root = document) {
    registerReveals(root);
    registerNumbers(root);
    registerWow(root);
  }

  function start() {
    document.documentElement.classList.add('motion-ready');
    addProgress();
    bindTilt();
    bindInteractions();
    scan();
    mutationObserver = new MutationObserver((records) => {
      records.forEach((record) => {
        record.addedNodes.forEach((node) => {
          if (node.nodeType !== Node.ELEMENT_NODE) return;
          scan(node);
          if (node.matches?.('.portfolio-wow-number strong')) registerNumbers(node.parentElement || node);
        });
      });
      registerNumbers();
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });
    reduced.addEventListener?.('change', () => location.reload());
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
