import {
  SERVICE_WORKER_PATH,
} from './service-worker-support.js';

/**
 * PWA Installer — Futebol Milhão
 * Gerencia prompt de instalação do PWA e atualizações do Service Worker.
 */
(function () {
  let deferredPrompt = null;
  let refreshing = false;
  const INSTALL_DISMISSED_KEY = 'fm_pwa_install_dismissed';

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      // Registro nativo robusto e simples direto pelo navegador
      const registration = await navigator.serviceWorker
        .register(SERVICE_WORKER_PATH, { scope: '/' })
        .catch((err) => {
          console.error('[FM PWA] Erro ao registrar Service Worker:', err);
          return null;
        });

      if (registration) {
        watchForServiceWorkerUpdates(registration);
      }
    });
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    const dismissedAt = localStorage.getItem(INSTALL_DISMISSED_KEY);
    if (!dismissedAt || Date.now() - Number(dismissedAt) > 7 * 24 * 60 * 60 * 1000) {
      setTimeout(() => showInstallPrompt(), 5 * 60 * 1000);
    }
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    removeInstallBanner();
  });

  function showInstallPrompt() {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (isStandalone) return;

    const banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.style.cssText = `
      position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
      z-index: 9999; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      color: #f1f5f9; padding: 14px 20px; border-radius: 16px;
      font-family: 'Outfit', sans-serif; font-size: 0.9rem;
      display: flex; align-items: center; gap: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(16,185,129,0.3);
      backdrop-filter: blur(16px); animation: slideUpBanner 0.4s ease;
      max-width: calc(100vw - 32px);
    `;
    banner.innerHTML = `
      <span style="font-size:1.5rem">📱</span>
      <span style="flex:1;font-weight:500">Instale o app para acesso rápido</span>
      <button id="pwa-install-btn" style="
        background: linear-gradient(135deg,#10b981,#059669);color:#fff;
        border:none;padding:8px 16px;border-radius:10px;font-weight:700;
        font-family:inherit;font-size:0.85rem;cursor:pointer;white-space:nowrap;
      ">Instalar</button>
      <button id="pwa-dismiss-btn" style="
        background:none;border:none;color:#64748b;font-size:1.2rem;
        cursor:pointer;padding:4px;
      ">✕</button>
    `;
    document.body.appendChild(banner);

    document.getElementById('pwa-install-btn').addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      deferredPrompt = null;
      removeInstallBanner();
    });

    document.getElementById('pwa-dismiss-btn').addEventListener('click', () => {
      localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now()));
      removeInstallBanner();
    });
  }

  function showUpdateToast(worker) {
    if (document.getElementById('pwa-update-toast')) return;

    const toast = document.createElement('div');
    toast.id = 'pwa-update-toast';
    toast.style.cssText = `
      position: fixed; top: 80px; left: 50%; transform: translateX(-50%);
      z-index: 9999; background: linear-gradient(135deg,#10b981,#059669);
      color: #fff; padding: 12px 20px; border-radius: 12px;
      font-family: 'Outfit', sans-serif; font-size: 0.85rem; font-weight: 600;
      box-shadow: 0 8px 24px rgba(16,185,129,0.4);
      display: flex; align-items: center; gap: 10px; animation: slideDownToast 0.4s ease;
    `;
    toast.innerHTML = `
      <span>🔄</span>
      <span>Nova versão disponível!</span>
      <button id="pwa-reload-btn" style="
        background:rgba(255,255,255,0.2);border:none;color:#fff;
        padding:6px 14px;border-radius:8px;font-weight:700;font-family:inherit;
        cursor:pointer;font-size:0.8rem;
      ">Atualizar</button>
    `;
    document.body.appendChild(toast);

    document.getElementById('pwa-reload-btn').addEventListener('click', () => {
      if (worker) {
        worker.postMessage('skipWaiting');
      } else {
        navigator.serviceWorker.ready.then((reg) => {
          if (reg.waiting) {
            reg.waiting.postMessage('skipWaiting');
          } else {
            window.location.reload();
          }
        });
      }
    });
  }

  function watchForServiceWorkerUpdates(registration) {
    // Atualização silenciosa em segundo plano: desativado o toast de atualização visual para evitar loops irritantes.
  }

  function removeInstallBanner() {
    const el = document.getElementById('pwa-install-banner');
    if (el) el.remove();
  }

  function tryInstallPWA() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
    }
  }

  window.tryInstallPWA = tryInstallPWA;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideUpBanner {
      from { transform: translateX(-50%) translateY(100px); opacity: 0; }
      to { transform: translateX(-50%) translateY(0); opacity: 1; }
    }
    @keyframes slideDownToast {
      from { transform: translateX(-50%) translateY(-50px); opacity: 0; }
      to { transform: translateX(-50%) translateY(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);

  window.addEventListener('DOMContentLoaded', () => {
    const isRegistered = window.matchMedia('(display-mode: standalone)').matches;
    if (!isRegistered) {
      const installBtn = document.createElement('button');
      installBtn.id = 'pwa-install-trigger';
      installBtn.className = 'nav-button nav-home';
      installBtn.style.cssText = 'gap:12px';
      installBtn.innerHTML = '<span class="nav-icon">📱</span><span class="nav-text">Instalar App</span>';
      installBtn.title = 'Instalar na tela inicial';
      installBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        tryInstallPWA();
      });
      setTimeout(() => {
        const navContainer = document.querySelector('.nav-buttons-container');
        if (navContainer && !document.getElementById('pwa-install-trigger')) {
          const logoutBtn = navContainer.querySelector('.nav-logout');
          if (logoutBtn) {
            navContainer.insertBefore(installBtn, logoutBtn);
          }
        }
      }, 500);
    }
  });
})();
