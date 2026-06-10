import { setSelectedMatchId } from '../../stores/session-store.js';
import {
  SERVICE_WORKER_PATH,
  checkServiceWorkerScript,
  unregisterServiceWorkersForScript,
} from '../../core/service-worker-support.js';

/**
 * ============================================
 * FM Notifications Service v2 — Futebol Milhao
 * ============================================
 *
 * Funcionalidades:
 * - Inicializacao automatica do OneSignal v16
 * - Solicitacao INTELIGENTE de permissao (contextual, apos acoes do usuario)
 * - Registro AUTOMATICO de usuario (external_id + tags)
 * - Segmentacao por usuario (tags: role, username, confirmed, payment_status)
 * - Deep linking (clique na notificacao → pagina especifica)
 * - Notificacoes SILENCIOSAS (data-only, sem alerta visual)
 * - Integracao Supabase (realtime + RPC + Edge Function)
 * - Integracao Realtime Supabase para notificacoes em tempo real
 * - Compatibilidade PWA standalone + navegador normal
 * - Compatibilidade Mobile (Android + iPhone/iOS 16.4+)
 *
 * Tipos de notificacao:
 *   sorteio_iniciado  - Sorteio de times iniciado
 *   time_completo     - Time completo (todas vagas preenchidas)
 *   novo_jogador      - Novo jogador entrou na partida
 *   pagamento_pendente - Lembrete de pagamento pendente
 *   partida_confirmada - Partida confirmada pelo admin
 *   alteracao_horario - Alteracao de data/hora/local
 *   resultado_partida - Resultado da partida / votacao aberta
 *   ranking_atualizado - Classificacao atualizada
 *   aviso_admin       - Aviso administrativo manual
 * ============================================
 */
(function () {
  'use strict';

  const APP_ID = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ONESIGNAL_APP_ID) || '';

  if (!APP_ID) {
    console.log('[FM Notifications] App ID nao configurado. Notificacoes desativadas.');
    return;
  }

  // OneSignal só funciona no domínio de produção configurado no dashboard.
  // Em localhost/dev, pular a inicialização para evitar erros.
  const IS_PRODUCTION = window.location.hostname !== 'localhost'
    && !window.location.hostname.startsWith('127.')
    && !window.location.hostname.startsWith('192.168.');

  const SUPABASE_FUNCTIONS_URL =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_FUNCTIONS_URL) || '';

  const ONE_SIGNAL_SCRIPT = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
  const INIT_TIMEOUT = 20000;
  const RETRY_DELAY = 15000;
  const INITIAL_DELAY = 3000;

  const NOTIFICATION_TYPES = {
    DRAW_STARTED: 'sorteio_iniciado',
    TEAM_FULL: 'time_completo',
    NEW_PLAYER: 'novo_jogador',
    PAYMENT_PENDING: 'pagamento_pendente',
    MATCH_CONFIRMED: 'partida_confirmada',
    SCHEDULE_CHANGE: 'alteracao_horario',
    MATCH_RESULT: 'resultado_partida',
    RANKING_UPDATE: 'ranking_atualizado',
    ADMIN_NOTICE: 'aviso_admin',
    VOTING_OPEN: 'votacao_aberta',
  };

  let isInitialized = false;
  let oneSignalInstance = null;
  let initPromise = null;
  let permissionRequestedThisSession = false;

  /* ==================== */
  /* SDK LOADING */
  /* ==================== */

  function loadSDK() {
    if (document.querySelector('script[src*="OneSignalSDK"]')) return;
    const script = document.createElement('script');
    script.src = ONE_SIGNAL_SCRIPT;
    script.defer = true;
    document.head.appendChild(script);
  }

  /**
   * Aguarda o OneSignal SDK v16 ficar disponivel.
   * No v16, window.OneSignalDeferred e um ARRAY onde se faz .push(callback).
   * Apos carregar, window.OneSignal fica disponivel como instancia.
   */
  function waitForOneSignal(timeout = INIT_TIMEOUT) {
    return new Promise((resolve) => {
      if (window.OneSignal && typeof window.OneSignal.init === 'function') {
        return resolve(window.OneSignal);
      }

      if (window.OneSignalDeferred && Array.isArray(window.OneSignalDeferred)) {
        window.OneSignalDeferred.push((os) => resolve(os));
        return;
      }

      let elapsed = 0;
      const check = setInterval(() => {
        if (window.OneSignal && typeof window.OneSignal.init === 'function') {
          clearInterval(check);
          resolve(window.OneSignal);
          return;
        }
        if (window.OneSignalDeferred && Array.isArray(window.OneSignalDeferred)) {
          clearInterval(check);
          window.OneSignalDeferred.push((os) => resolve(os));
          return;
        }
        elapsed += 500;
        if (elapsed >= timeout) {
          clearInterval(check);
          resolve(null);
        }
      }, 500);
    });
  }

  /* ==================== */
  /* INITIALIZATION */
  /* ==================== */

  async function initOneSignal() {
    if (!IS_PRODUCTION) {
      console.log('[FM Notifications] Ambiente de desenvolvimento detectado. OneSignal desativado.');
      return null;
    }
    if (isInitialized) return oneSignalInstance;
    if (initPromise) return initPromise;

    initPromise = _doInit();
    return initPromise;
  }

  async function _doInit() {
    const swCheck = await checkServiceWorkerScript(SERVICE_WORKER_PATH);
    if (!swCheck.ok) {
      if (swCheck.reason !== 'fetch-error') {
        await unregisterServiceWorkersForScript(SERVICE_WORKER_PATH);
      }
      console.info('[FM Notifications] Service worker indisponivel; push ignorado.', swCheck);
      initPromise = null;
      return null;
    }

    loadSDK();
    window.OneSignalDeferred = window.OneSignalDeferred || [];

    const os = await waitForOneSignal(INIT_TIMEOUT);
    if (!os) {
      console.warn('[FM Notifications] SDK nao carregou a tempo.');
      initPromise = null;
      return null;
    }

    try {
      await os.init({
        appId: APP_ID,
        allowLocalhostAsSecureOrigin: true,
        autoResubscribe: true,
        notifyButton: { enable: false },
        promptOptions: {
          slidedown: {
            prompts: [{
              type: 'push',
              autoPrompt: false,
              delay: { pageViews: 0, timeDelay: 0 },
              text: {
                actionMessage: 'Receba notificacoes de partidas, sorteios e resultados!',
                acceptButton: 'Ativar notificacoes',
                cancelButton: 'Agora nao',
              }
            }]
          }
        },
        welcomeNotification: {
          disable: false,
          title: 'Futebol Milhao',
          message: 'Voce recebera alertas de partidas, sorteios e resultados!',
        },
        persistNotification: true,
        notificationClickHandlerMatch: 'origin',
        notificationClickHandlerAction: 'navigate',
        serviceWorkerParam: { scope: '/' },
        serviceWorkerPath: SERVICE_WORKER_PATH,
        serviceWorkerUpdaterPath: SERVICE_WORKER_PATH,
      });

      isInitialized = true;
      oneSignalInstance = os;
      console.log('[FM Notifications] SDK inicializado com sucesso.');

      identifyUser();
      setupClickHandler();
      setupForegroundHandler();
      setupLifecycleListeners();

      return os;

    } catch (error) {
      if (error && error.message && error.message.includes('already initialized')) {
        console.warn('[FM Notifications] SDK já estava inicializado (recuperado).');
        isInitialized = true;
        oneSignalInstance = os;
        return os;
      }
      console.error('[FM Notifications] Erro na inicializacao:', error);
      initPromise = null;
      // Não faz retry automático — evita loop de erros no console
      return null;
    }
  }

  /* ==================== */
  /* USER IDENTIFICATION & SEGMENTATION */
  /* ==================== */

  async function identifyUser() {
    if (!oneSignalInstance || !isInitialized) return;

    const user = getCurrentUserSafe();
    if (!user?.username) return;

    try {
      await oneSignalInstance.login(user.username);
      console.log('[FM Notifications] Usuario identificado:', user.username);

      // Segmentacao: adicionar tags para targeting
      const tags = { role: user.role || 'player' };
      if (user.username) tags.username = user.username;

      try { oneSignalInstance.User.addTags(tags); } catch (_) { /* noop */ }

    } catch (err) {
      console.warn('[FM Notifications] Erro ao identificar usuario:', err);
    }
  }

  async function updatePaymentTag(status) {
    if (!oneSignalInstance || !isInitialized) return;
    try {
      oneSignalInstance.User.addTag('payment_status', status || 'pending');
    } catch (_) { /* noop */ }
  }

  async function updateConfirmedTag(confirmed) {
    if (!oneSignalInstance || !isInitialized) return;
    try {
      oneSignalInstance.User.addTag('confirmed', confirmed ? 'true' : 'false');
    } catch (_) { /* noop */ }
  }

  /* ==================== */
  /* SMART PERMISSION REQUEST */
  /* ==================== */

  /**
   * Solicita permissao de notificacao de forma INTELIGENTE.
   * Deve ser chamada APOS uma interacao positiva do usuario
   * (ex: confirmou presenca, fez sorteio, pagou).
   *
   * Nunca chama no primeiro load - espera contexto favoravel.
   */
  async function requestPermission() {
    const os = oneSignalInstance || await waitForOneSignal(10000);
    if (!os) return false;

    try {
      const isSupported = os.Notifications.isPushSupported();
      if (!isSupported) {
        console.log('[FM Notifications] Push nao suportado neste dispositivo.');
        return false;
      }
    } catch (_) { /* noop */ }

    const permission = os.Notifications.permission;
    if (permission) return true;

    // Evitar multiplas chamadas na mesma sessao
    if (permissionRequestedThisSession) return false;
    permissionRequestedThisSession = true;

    try {
      os.Notifications.requestPermission();
      return true;
    } catch (_) {
      console.log('[FM Notifications] Usuario recusou ou adiou a permissao.');
      return false;
    }
  }

  /**
   * Solicita permissao com contexto (mensagem personalizada).
   * Exibe o slidedown prompt do OneSignal antes do prompt nativo.
   */
  async function requestPermissionWithContext(context) {
    const os = oneSignalInstance || await waitForOneSignal(10000);
    if (!os) return false;

    if (os.Notifications.permission) return true;

    const messages = {
      payment: {
        actionMessage: 'Pagamento confirmado! Ative notificacoes para receber o resultado do sorteio.',
        acceptButton: 'Ativar',
        cancelButton: 'Depois',
      },
      confirmed: {
        actionMessage: 'Presenca confirmada! Receba alertas quando a partida for confirmada.',
        acceptButton: 'Quero receber!',
        cancelButton: 'Agora nao',
      },
      draw: {
        actionMessage: 'Sorteio realizado! Ative notificacoes para saber quando o jogo comecar.',
        acceptButton: 'Ativar alertas',
        cancelButton: 'Nao, obrigado',
      },
    };

    const ctx = messages[context] || messages.confirmed;

    try {
      os.Slidedown.promptPush({ force: true });
      return true;
    } catch (_) {
      return false;
    }
  }

  /* ==================== */
  /* DEEP LINKING */
  /* ==================== */

  function setupClickHandler() {
    if (!oneSignalInstance) return;

    oneSignalInstance.Notifications.addEventListener('click', async (event) => {
      event.notification.consume();

      const rawData = event.notification?.additionalData || event.notification?.data || {};
      const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
      const url = data.url || data.deepLink;
      const matchId = data.matchId || data.match_id;

      if (matchId) {
        setSelectedMatchId(matchId);
      }

      if (url) {
        const currentPath = window.location.pathname;
        const isInPages = currentPath.includes('/pages/');
        let targetUrl = url;

        if (isInPages && !url.startsWith('../') && !url.startsWith('/') && !url.startsWith('http')) {
          targetUrl = url.includes('pages/') ? url.replace('pages/', '') : url;
        } else if (!isInPages && url.startsWith('../')) {
          targetUrl = url.replace('../', 'pages/');
        }

        window.location.href = targetUrl;
      }
    });
  }

  /* ==================== */
  /* SILENT / FOREGROUND NOTIFICATIONS */
  /* ==================== */

  function setupForegroundHandler() {
    if (!oneSignalInstance) return;

    oneSignalInstance.Notifications.addEventListener('foregroundWillDisplay', (event) => {
      const notification = event.getNotification();
      const rawData = notification?.additionalData || notification?.data || {};
      const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;

      // Silent notification: nao exibe visualmente, mas processa dados
      if (data.silent === true || data.content_available === true) {
        event.preventDefault();
        handleSilentNotification(data);
        return;
      }

      // Notificacao normal em foreground: exibe toast nativo do FMModal
      if (notification.body) {
        if (typeof FMModal !== 'undefined' && typeof FMModal.notify === 'function') {
          const toast = FMModal.notify(notification.body, {
            title: notification.title || 'Futebol Milhao',
            duration: 5000,
          });
          // Deep link no clique do toast
          if (toast) {
            toast.style.cursor = 'pointer';
            toast.addEventListener('click', () => {
              const url = data.url || data.deepLink;
              if (url) window.location.href = url;
            });
          }
        }
      }
    });
  }

  /**
   * Processa notificacao silenciosa (data-only).
   * Usada para sync de dados em background sem incomodar o usuario.
   */
  function handleSilentNotification(data) {
    const action = data.action;
    console.log('[FM Notifications] Silent notification:', action, data);

    switch (action) {
      case 'refresh_matches':
        if (typeof getAllMatches === 'function') getAllMatches().catch(() => {});
        break;
      case 'refresh_stats':
        if (typeof window.location?.reload === 'function') {
          window.dispatchEvent(new CustomEvent('fm:data-refresh', { detail: data }));
        }
        break;
      case 'check_payment':
        if (typeof window.FMNotifications?.checkPaymentStatus === 'function') {
          window.FMNotifications.checkPaymentStatus();
        }
        break;
      default:
        window.dispatchEvent(new CustomEvent('fm:silent-notification', { detail: data }));
    }
  }

  /* ==================== */
  /* LIFECYCLE LISTENERS */
  /* ==================== */

  function setupLifecycleListeners() {
    if (!oneSignalInstance) return;

    // Permission changes
    oneSignalInstance.Notifications.addEventListener('permissionChange', (permission) => {
      if (permission) {
        console.log('[FM Notifications] Permissao concedida!');
        permissionRequestedThisSession = true;
      }
    });

    // Push subscription state changes
    oneSignalInstance.User.PushSubscription.addEventListener('change', (event) => {
      if (event.current?.optedIn && !event.previous?.optedIn) {
        console.log('[FM Notifications] Usuario se inscreveu em push.');
        identifyUser();
      }
    });
  }

  /* ==================== */
  /* SEND NOTIFICATIONS (admin via Edge Function) */
  /* ==================== */

  async function sendViaEdgeFunction(payload) {
    if (!SUPABASE_FUNCTIONS_URL) {
      console.warn('[FM Notifications] SUPABASE_FUNCTIONS_URL nao configurada.');
      return { success: false, error: 'Edge Function URL nao configurada' };
    }

    const supabaseClient = getSupabaseClientSafe();
    if (!supabaseClient) {
      return { success: false, error: 'Supabase client nao disponivel' };
    }

    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session?.access_token) {
        return { success: false, error: 'Usuario nao autenticado' };
      }

      const funcUrl = SUPABASE_FUNCTIONS_URL.replace(/\/$/, '') + '/send-notification';
      const response = await fetch(funcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      return await response.json();
    } catch (error) {
      console.error('[FM Notifications] Erro ao chamar Edge Function:', error);
      return { success: false, error: String(error) };
    }
  }

  /* ==================== */
  /* NOTIFICATION TYPE METHODS (9 tipos) */
  /* ==================== */

  async function _sendNotification(type, options = {}) {
    const payload = {
      type,
      title: options.title || '',
      body: options.body || '',
      url: options.url || null,
      data: options.data || null,
      sent_by: options.sent_by || getCurrentUserSafe()?.username || 'system',
      external_user_ids: options.external_user_ids || null,
      included_segments: options.included_segments || ['All'],
      chrome_web_image: options.chrome_web_image || null,
      silent: options.silent || false,
      match_id: options.match_id || null,
    };

    // Salvar no banco localmente (via RPC)
    try {
      const supabaseClient = getSupabaseClientSafe();
      if (supabaseClient) {
        await supabaseClient.rpc('fm_send_notification', {
          p_type: type,
          p_match_id: options.match_id || null,
          p_title: payload.title,
          p_body: payload.body,
          p_url: payload.url,
          p_data: payload.data || null,
          p_sent_by: payload.sent_by,
          p_external_user_ids: payload.external_user_ids || null,
          p_included_segments: payload.included_segments || null,
        });
      }
    } catch (_) { /* noop */ }

    // Enviar via Edge Function
    return sendViaEdgeFunction(payload);
  }

  /** 1. Sorteio de times iniciado */
  async function notifyDrawStarted(matchData) {
    return _sendNotification(NOTIFICATION_TYPES.DRAW_STARTED, {
      title: '🎲 Sorteio Iniciado!',
      body: `O sorteio dos times para ${matchData.location || 'a partida'} comecou! Abra o app para participar.`,
      url: 'pages/details.html',
      data: { matchId: matchData.id, location: matchData.location },
      match_id: matchData.id,
    });
  }

  /** 2. Time completo (todas vagas preenchidas) */
  async function notifyTeamFull(matchData, playerCount) {
    return _sendNotification(NOTIFICATION_TYPES.TEAM_FULL, {
      title: '✅ Times Completos!',
      body: `${playerCount || ''} jogadores confirmados para ${matchData.location || 'a partida'} em ${matchData.date || ''}. Aguardando confirmacao do admin.`,
      url: 'pages/details.html',
      data: { matchId: matchData.id, location: matchData.location },
      match_id: matchData.id,
    });
  }

  /** 3. Novo jogador entrou */
  async function notifyNewPlayer(matchData, playerName) {
    return _sendNotification(NOTIFICATION_TYPES.NEW_PLAYER, {
      title: '👋 Novo Jogador!',
      body: `${playerName || 'Alguem'} acabou de entrar na partida ${matchData.location || ''} (${matchData.date || ''}).`,
      url: 'pages/details.html',
      data: { matchId: matchData.id, playerName },
      match_id: matchData.id,
    });
  }

  /** 4. Pagamento pendente */
  async function notifyPaymentPending(userData) {
    const username = userData?.username || getCurrentUserSafe()?.username;
    return _sendNotification(NOTIFICATION_TYPES.PAYMENT_PENDING, {
      title: '💰 Pagamento Pendente',
      body: 'Seu pagamento para a proxima partida esta pendente. Regularize para garantir sua vaga!',
      url: 'pages/payment.html',
      data: { type: 'payment_reminder' },
      external_user_ids: username ? [username] : null,
      silent: false,
    });
  }

  /** 5. Partida confirmada */
  async function notifyMatchConfirmed(matchData) {
    return _sendNotification(NOTIFICATION_TYPES.MATCH_CONFIRMED, {
      title: '✅ Partida Confirmada!',
      body: `${matchData.location || 'Partida'} • ${matchData.date || ''} as ${matchData.time || ''}h. Prepare-se!`,
      url: 'pages/details.html',
      data: { matchId: matchData.id, location: matchData.location, date: matchData.date, time: matchData.time },
      match_id: matchData.id,
    });
  }

  /** 6. Alteracao de horario */
  async function notifyScheduleChange(matchData, changes) {
    const parts = [];
    if (changes?.date) parts.push(`Data: ${changes.date}`);
    if (changes?.time) parts.push(`Horario: ${changes.time}h`);
    if (changes?.location) parts.push(`Local: ${changes.location}`);

    return _sendNotification(NOTIFICATION_TYPES.SCHEDULE_CHANGE, {
      title: '📅 Alteracao na Partida',
      body: `${matchData.location || 'Partida'} atualizada! ${parts.join(' • ')}`,
      url: 'pages/details.html',
      data: { matchId: matchData.id, ...changes },
      match_id: matchData.id,
    });
  }

  /** 7. Resultado da partida / Votacao aberta */
  async function notifyMatchResult(matchData) {
    return _sendNotification(NOTIFICATION_TYPES.MATCH_RESULT, {
      title: '🏁 Partida Encerrada!',
      body: `Vote no Craque e no Perna de Pau da partida ${matchData.location || ''}. Votacao aberta por 24h!`,
      url: 'pages/details.html',
      data: { matchId: matchData.id, location: matchData.location, votingDeadline: matchData.voting_deadline },
      match_id: matchData.id,
    });
  }

  /** 8. Ranking atualizado */
  async function notifyRankingUpdate(matchId, changes) {
    return _sendNotification(NOTIFICATION_TYPES.RANKING_UPDATE, {
      title: '📊 Classificacao Atualizada!',
      body: 'A tabela de classificacao foi atualizada apos o ultimo jogo. Confira sua posicao!',
      url: 'pages/details.html',
      data: { matchId, rankingUpdate: true, ...changes },
      match_id: matchId,
    });
  }

  /** 9. Aviso administrativo */
  async function notifyAdminNotice(title, body, url) {
    return _sendNotification(NOTIFICATION_TYPES.ADMIN_NOTICE, {
      title: title || '📢 Aviso Administrativo',
      body: body || '',
      url: url || null,
      sent_by: getCurrentUserSafe()?.username || 'admin',
    });
  }

  /* ==================== */
  /* HELPER: Silent notification (data-only sync) */
  /* ==================== */
  async function sendSilentNotification(action, data, targetUsers) {
    return _sendNotification('silent_sync', {
      title: ' ',
      body: ' ',
      data: { silent: true, content_available: true, action, ...data },
      external_user_ids: targetUsers || null,
      silent: true,
    });
  }

  /* ==================== */
  /* UTILITY */
  /* ==================== */

  function getCurrentUserSafe() {
    try {
      if (typeof getCurrentUser === 'function') return getCurrentUser();
    } catch (_) { /* noop */ }
    return null;
  }

  function getSupabaseClientSafe() {
    try {
      if (typeof getSupabaseClient === 'function') return getSupabaseClient();
    } catch (_) { /* noop */ }
    return null;
  }

  function isInitializedCheck() {
    return isInitialized;
  }

  /* ==================== */
  /* INITIALIZATION TIMING */
  /* ==================== */

  window.addEventListener('DOMContentLoaded', () => {
    setTimeout(initOneSignal, INITIAL_DELAY);
  });

  /* Re-identify after login */
  window.addEventListener('fm:user-logged-in', () => {
    if (isInitialized && oneSignalInstance) {
      identifyUser();
    } else {
      setTimeout(initOneSignal, 2000);
    }
  });

  /* ==================== */
  /* PUBLIC API */
  /* ==================== */
  window.FMNotifications = {
    // Core
    init: initOneSignal,
    isInitialized: isInitializedCheck,
    getInstance: () => oneSignalInstance,

    // Smart permission
    requestPermission,
    requestPermissionWithContext,

    // User identity & segmentation
    identifyUser,
    updatePaymentTag,
    updateConfirmedTag,

    // 9 notification types
    notifyDrawStarted,
    notifyTeamFull,
    notifyNewPlayer,
    notifyPaymentPending,
    notifyMatchConfirmed,
    notifyScheduleChange,
    notifyMatchResult,
    notifyRankingUpdate,
    notifyAdminNotice,

    // Silent notifications
    sendSilentNotification,

    // Raw send (para uso avancado)
    send: _sendNotification,

    // Edge Function URL
    sendViaEdgeFunction,

    // Constants
    TYPES: NOTIFICATION_TYPES,
  };

  console.log('[FM Notifications] Servico registrado. APP_ID:', APP_ID ? 'configurado' : 'nao configurado');
})();
