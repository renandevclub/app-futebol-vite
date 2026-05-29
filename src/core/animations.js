/**
 * Animations & Micro-interactions — Futebol Milhão
 * Animações premium com IntersectionObserver e GPU acceleration.
 */
(function () {

  /* ==================== */
  /* Scroll Reveal (fade-in-up com interseção) */
  /* ==================== */
  function initScrollReveal() {
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('[data-animate]').forEach(el => el.classList.add('visible'));
      return;
    }

    const elements = document.querySelectorAll('[data-animate]');
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -30px 0px' }
    );

    elements.forEach((el) => observer.observe(el));
  }

  /* ==================== */
  /* Ripple effect nos botões */
  /* ==================== */
  function initRippleEffect() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-ripple, .btn-primary.has-ripple, [data-ripple]');
      if (!btn) return;

      const ripple = document.createElement('span');
      ripple.className = 'ripple-effect';
      const rect = btn.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
      btn.appendChild(ripple);

      ripple.addEventListener('animationend', () => ripple.remove());
    });
  }

  /* ==================== */
  /* Number Counter (contagem animada) */
  /* ==================== */
  function animateCounter(el, target, duration = 1500) {
    const start = performance.now();
    const initial = parseInt(el.textContent, 10) || 0;
    const range = target - initial;

    function update(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(initial + range * eased);

      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        el.textContent = target;
      }
    }

    requestAnimationFrame(update);
  }

  function initCounters() {
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('[data-counter]').forEach(el => {
        animateCounter(el, parseInt(el.dataset.counter, 10));
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          animateCounter(el, parseInt(el.dataset.counter, 10));
          observer.unobserve(el);
        });
      },
      { threshold: 0.5 }
    );

    document.querySelectorAll('[data-counter]').forEach(el => observer.observe(el));
  }

  /* ==================== */
  /* Parallax leve (opcional) */
  /* ==================== */
  function initParallax() {
    if (window.innerWidth < 768) return;
    const elements = document.querySelectorAll('[data-parallax]');
    if (elements.length === 0) return;

    function onScroll() {
      elements.forEach((el) => {
        const speed = parseFloat(el.dataset.parallax) || 0.3;
        const rect = el.getBoundingClientRect();
        const scrolled = rect.top / window.innerHeight;
        const offset = scrolled * speed * 100;
        el.style.transform = `translateY(${offset}px)`;
      });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ==================== */
  /* Inicialização */
  /* ==================== */
  document.addEventListener('DOMContentLoaded', () => {
    initScrollReveal();
    initRippleEffect();
    initCounters();
    initParallax();
  });

  /* Global */
  window.FMAnimations = { animateCounter, initScrollReveal, initCounters };
})();

/* ============================= */
/* CSS para ripple */
/* ============================= */
(function () {
  const style = document.createElement('style');
  style.textContent = `
    .ripple-effect {
      position: absolute; border-radius: 50%;
      background: rgba(255,255,255,0.3);
      transform: scale(0);
      animation: ripple 0.6s ease-out;
      pointer-events: none;
    }
    @keyframes ripple {
      to { transform: scale(4); opacity: 0; }
    }
    [data-animate] {
      opacity: 0;
      transform: translateY(16px);
      transition: opacity 0.5s cubic-bezier(0.19,1,0.22,1),
                  transform 0.5s cubic-bezier(0.19,1,0.22,1);
    }
    [data-animate].visible {
      opacity: 1;
      transform: translateY(0);
    }
    [data-animate="fade"] {
      transform: none;
      transition: opacity 0.4s ease;
    }
    [data-animate="fade"].visible { opacity: 1; }
    [data-animate="scale"] {
      transform: scale(0.95);
      transition: opacity 0.4s ease, transform 0.4s cubic-bezier(0.19,1,0.22,1);
    }
    [data-animate="scale"].visible {
      opacity: 1; transform: scale(1);
    }
    [data-lazy] {
      opacity: 0;
      transition: opacity 0.4s ease;
    }
    [data-lazy].loaded { opacity: 1; }
  `;
  document.head.appendChild(style);
})();
