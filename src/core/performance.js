/**
 * Performance Utils — Futebol Milhão
 * Lazy loading, preload/prefetch e otimizações mobile.
 */
(function () {

  /* ==================== */
  /* Lazy Loading Imagens */
  /* ==================== */
  function initLazyImages() {
    if (!('IntersectionObserver' in window)) return;
    const images = document.querySelectorAll('img[loading="lazy"], img[data-src]');
    if (images.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
          }
          img.removeAttribute('loading');
          observer.unobserve(img);
        });
      },
      { rootMargin: '200px 0px', threshold: 0.01 }
    );

    images.forEach((img) => observer.observe(img));
  }

  /* ==================== */
  /* Lazy Load abaixo da dobra com IntersectionObserver */
  /* ==================== */
  function initLazySections() {
    if (!('IntersectionObserver' in window)) return;
    const sections = document.querySelectorAll('[data-lazy]');
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          el.classList.add('loaded');
          observer.unobserve(el);
        });
      },
      { rootMargin: '150px 0px' }
    );

    sections.forEach((el) => observer.observe(el));
  }

  /* ==================== */
  /* Prefetch de Links (hover/longpress) */
  /* ==================== */
  function initPrefetchLinks() {
    const links = document.querySelectorAll('a[href]');
    const prefetchTimer = {};

    links.forEach((link) => {
      const href = link.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      if (link.dataset.noPrefetch) return;

      link.addEventListener('mouseenter', () => {
        prefetchTimer[href] = setTimeout(() => {
          const prefetch = document.createElement('link');
          prefetch.rel = 'prefetch';
          prefetch.href = href;
          prefetch.as = 'document';
          document.head.appendChild(prefetch);
        }, 150);
      });

      link.addEventListener('mouseleave', () => {
        clearTimeout(prefetchTimer[href]);
      });

      link.addEventListener('touchstart', () => {
        prefetchTimer[href] = setTimeout(() => {
          const prefetch = document.createElement('link');
          prefetch.rel = 'prefetch';
          prefetch.href = href;
          prefetch.as = 'document';
          document.head.appendChild(prefetch);
        }, 200);
      }, { passive: true });
    });
  }

  /* ==================== */
  /* Preload de recursos críticos */
  /* ==================== */
  function addCriticalPreloads() {
    // Removido o preload manual de CSS em ambiente de desenvolvimento.
    // O Vite injeta os estilos dinamicamente em dev e gera links otimizados de preload em build.
    // Preloads manuais de arquivos estáticos geravam alertas de "não utilizado" no console.
  }

  /* ==================== */
  /* Virtual Scroll para listas longas */
  /* ==================== */
  function initVirtualList(containerId, items, renderFn, itemHeight = 72, buffer = 5) {
    const container = document.getElementById(containerId);
    if (!container || items.length === 0) return;

    let scrollTop = 0;
    let viewportHeight = 0;

    function updateVisibleItems() {
      const totalHeight = items.length * itemHeight;
      const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - buffer);
      const endIndex = Math.min(items.length, Math.ceil((scrollTop + viewportHeight) / itemHeight) + buffer);

      const visibleItems = items.slice(startIndex, endIndex);

      container.innerHTML = '';

      const spacerTop = document.createElement('div');
      spacerTop.style.height = `${startIndex * itemHeight}px`;
      container.appendChild(spacerTop);

      visibleItems.forEach((item, i) => {
        const el = renderFn(item, startIndex + i);
        el.style.position = 'absolute';
        el.style.top = `${(startIndex + i) * itemHeight}px`;
        el.style.width = '100%';
        container.appendChild(el);
      });

      const spacerBottom = document.createElement('div');
      spacerBottom.style.height = `${(items.length - endIndex) * itemHeight}px`;
      container.appendChild(spacerBottom);
    }

    container.style.position = 'relative';
    container.style.overflow = 'hidden';
    container.style.minHeight = `${Math.min(items.length * itemHeight, 400)}px`;

    const scrollParent = container.closest('[data-scroll-container]') || window;

    function onScroll(e) {
      const rect = container.getBoundingClientRect();
      scrollTop = -rect.top + (e.target?.scrollTop || 0);
      if (scrollTop < 0) scrollTop = 0;
      viewportHeight = rect.height;
      requestAnimationFrame(updateVisibleItems);
    }

    scrollParent.addEventListener('scroll', onScroll, { passive: true });
    updateVisibleItems();
  }

  /* ==================== */
  /* Inicialização */
  /* ==================== */
  document.addEventListener('DOMContentLoaded', () => {
    initLazyImages();
    initLazySections();
    initPrefetchLinks();
    if (document.querySelector('link[rel="preload"]') === null) {
      addCriticalPreloads();
    }
  });

  window.FMPerformance = {
    initLazyImages,
    initLazySections,
    initPrefetchLinks,
    initVirtualList,
  };
})();
