import { isAdminRole, isVisitorRole } from '../../shared/constants/roles.js';

/**
 * ============================================
 * FM Notification Triggers — Futebol Milhao
 * ============================================
 *
 * Escuta mudancas no banco via Supabase Realtime e dispara
 * notificacoes automaticas para os 9 tipos de eventos.
 *
 * Tambem fornece hooks para paginas chamarem apos acoes do usuario
 * (solicitacao inteligente de permissao, registro de tags, etc.)
 *
 * IMPORTANTE:
 * - Notificacoes enviadas para TODOS os usuarios passam pela Edge Function
 *   e requerem que o usuario atual seja admin.
 * - Notificacoes locais (in-app) sao exibidas para qualquer usuario.
 * - Os triggers do banco (SQL) cuidam de notificacoes server-side
 *   (partida_confirmada, encerrada, alteracao_horario).
 * - Os triggers deste arquivo cuidam de notificacoes client-side
 *   (novo_jogador, time_completo, sorteio_iniciado, ranking).
 * ============================================
 */
(function () {
  'use strict';

  let realtimeChannels = {};
  let isSubscribed = false;
  let lastKnownMatchStates = {};

  /* ==================== */
  /* HELPERS */
  /* ==================== */

  function getClient() {
    try {
      if (typeof getSupabaseClient === 'function') return getSupabaseClient();
    } catch (_) { /* noop */ }
    return null;
  }

  function isAdmin() {
    try {
      if (typeof isCurrentUserAdmin === 'function') return isCurrentUserAdmin();
    } catch (_) { /* noop */ }
    const user = getCurrentUserSafe();
    return isAdminRole(user?.role);
  }

  function getCurrentUserSafe() {
    try {
      if (typeof getCurrentUser === 'function') return getCurrentUser();
    } catch (_) { /* noop */ }
    return null;
  }

  function notif() {
    return window.FMNotifications;
  }

  function waitForNotif(ms = 10000) {
    return new Promise((resolve) => {
      if (notif()?.isInitialized()) return resolve(notif());
      const start = Date.now();
      const check = setInterval(() => {
        if (notif()?.isInitialized()) { clearInterval(check); resolve(notif()); return; }
        if (Date.now() - start > ms) { clearInterval(check); resolve(null); }
      }, 500);
    });
  }

  /* ==================== */
  /* MATCH STATE TRACKING */
  /* ==================== */

  function getMatchStateKey(match) {
    if (!match) return '';
    const playerCount = Array.isArray(match.players) ? match.players.length : 0;
    const confirmedCount = Array.isArray(match.players)
      ? match.players.filter(p => p && p.status !== 'withdrew').length
      : 0;
    const hasDraws = match.team_draws && Object.keys(match.team_draws).length > 0;
    return `${match.id}|${match.status}|${playerCount}|${confirmedCount}|${match.date}|${match.time}|${match.location}|${hasDraws}`;
  }

  /* ==================== */
  /* REALTIME: fm_matches */
  /* ==================== */

  function setupMatchRealtime() {
    const client = getClient();
    if (!client || typeof client.channel !== 'function') {
      setTimeout(setupMatchRealtime, 3000);
      return;
    }

    if (realtimeChannels.matches) {
      realtimeChannels.matches.unsubscribe().catch(() => {});
    }

    realtimeChannels.matches = client.channel('fm-notifications-matches');

    realtimeChannels.matches
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'fm_partidas',
      }, async (payload) => {
        if (!payload?.new || !payload?.old) return;

        const newMatch = payload.new;
        const oldMatch = payload.old;
        const matchId = newMatch.id;

        const prevState = lastKnownMatchStates[matchId] || getMatchStateKey(oldMatch);
        const newState = getMatchStateKey(newMatch);
        lastKnownMatchStates[matchId] = newState;

        if (prevState === newState) return;

        const nf = notif();
        if (!nf || !nf.isInitialized()) return;

        /* -- Status transitions -- */
        const oldStatus = oldMatch.status;
        const newStatus = newMatch.status;

        // Partida CONFIRMADA
        if (oldStatus !== 'CONFIRMADA' && newStatus === 'CONFIRMADA') {
          if (isAdmin()) {
            nf.notifyMatchConfirmed({
              id: matchId,
              location: newMatch.location,
              date: newMatch.date,
              time: newMatch.time,
              title: newMatch.title,
            });
          }
        }

        // Partida ENCERRADA (votacao aberta)
        if (oldStatus !== 'ENCERRADA' && newStatus === 'ENCERRADA') {
          if (isAdmin()) {
            nf.notifyMatchResult({
              id: matchId,
              location: newMatch.location,
              voting_deadline: newMatch.voting_deadline,
            });
          }
        }

        /* -- Schedule change -- */
        if ((oldStatus === 'CONFIRMADA' || oldStatus === 'AGENDADA') &&
            (oldMatch.date !== newMatch.date ||
             oldMatch.time !== newMatch.time ||
             oldMatch.location !== newMatch.location)) {
          if (isAdmin()) {
            nf.notifyScheduleChange(
              { id: matchId, location: newMatch.location, title: newMatch.title },
              { date: newMatch.date, time: newMatch.time, location: newMatch.location }
            );
          }
        }

        /* -- New player joined -- */
        const oldPlayers = Array.isArray(oldMatch.players) ? oldMatch.players : [];
        const newPlayers = Array.isArray(newMatch.players) ? newMatch.players : [];
        const oldActiveCount = oldPlayers.filter(p => p && p.status !== 'withdrew').length;
        const newActiveCount = newPlayers.filter(p => p && p.status !== 'withdrew').length;

        if (newActiveCount > oldActiveCount && newActiveCount > 0) {
          const newPlayer = newPlayers[newPlayers.length - 1];
          const playerName = newPlayer?.username || 'Um jogador';

          if (isAdmin()) {
            nf.notifyNewPlayer(
              { id: matchId, location: newMatch.location, date: newMatch.date },
              playerName
            );
          }

          // Time completo?
          const maxPlayers = Array.isArray(newMatch.teams) ? newMatch.teams.length * 6 : 0;
          if (maxPlayers > 0 && newActiveCount >= maxPlayers) {
            if (isAdmin()) {
              nf.notifyTeamFull(
                { id: matchId, location: newMatch.location, date: newMatch.date },
                newActiveCount
              );
            }
          }
        }

        /* -- Draw happening / started -- */
        const oldDrawKeys = oldMatch.team_draws ? Object.keys(oldMatch.team_draws).length : 0;
        const newDrawKeys = newMatch.team_draws ? Object.keys(newMatch.team_draws).length : 0;

        if (newDrawKeys > oldDrawKeys && newDrawKeys >= 1) {
          if (isAdmin() && oldDrawKeys === 0) {
            nf.notifyDrawStarted({
              id: matchId,
              location: newMatch.location,
              date: newMatch.date,
            });
          }
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          isSubscribed = true;
          console.log('[FM Triggers] Realtime matches ativo.');
        }
      });
  }

  /* ==================== */
  /* REALTIME: fm_standings (ranking) */
  /* ==================== */

  function setupStandingsRealtime() {
    const client = getClient();
    if (!client) { setTimeout(setupStandingsRealtime, 3000); return; }

    if (realtimeChannels.standings) {
      realtimeChannels.standings.unsubscribe().catch(() => {});
    }

    realtimeChannels.standings = client.channel('fm-notifications-standings');

    realtimeChannels.standings
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'fm_classificacao',
      }, async () => {
        const nf = notif();
        if (!nf || !nf.isInitialized() || !isAdmin()) return;
        nf.notifyRankingUpdate(null, {});
      })
      .subscribe();
  }

  /* ==================== */
  /* ACTION HOOKS (called by pages after user actions) */
  /* ==================== */

  /**
   * Chamado apos o usuario confirmar presenca / fazer sorteio.
   * Solicita permissao de notificacao de forma inteligente.
   */
  async function onUserConfirmedMatch() {
    const nf = notif() || await waitForNotif();
    if (!nf) return;

    // Atualizar tag de confirmed
    nf.updateConfirmedTag(true);

    // Solicitar permissao com contexto favoravel
    nf.requestPermissionWithContext('confirmed');
  }

  /**
   * Chamado apos o usuario realizar pagamento.
   */
  async function onUserPaid() {
    const nf = notif() || await waitForNotif();
    if (!nf) return;

    nf.updatePaymentTag('paid');
    nf.requestPermissionWithContext('payment');
  }

  /**
   * Chamado apos o sorteio de times.
   */
  async function onDrawCompleted() {
    const nf = notif() || await waitForNotif();
    if (!nf) return;

    nf.requestPermissionWithContext('draw');
  }

  /**
   * Verifica e notifica sobre pagamento pendente do usuario atual.
   */
  async function checkPaymentReminder() {
    const user = getCurrentUserSafe();
    if (!user || isVisitorRole(user.role) || isAdminRole(user.role) || user.is_player_session) return;

    try {
      const client = getClient();
      if (!client) return;

      const { data } = await client
        .from('fm_perfis')
        .select('confirmed, payment_status')
        .eq('username', user.username)
        .maybeSingle();

      if (data?.confirmed && data?.payment_status !== 'paid') {
        const nf = notif() || await waitForNotif();
        if (nf) {
          await nf.updatePaymentTag('pending');
          await nf.updateConfirmedTag('true');
        }
      }
    } catch (_) { /* noop */ }
  }

  /**
   * Envia lembrete de pagamento via push (admin only).
   */
  async function sendPaymentReminderToUser(username) {
    const nf = notif() || await waitForNotif();
    if (!nf || !isAdmin()) return;

    return nf.notifyPaymentPending({ username });
  }

  /* ==================== */
  /* INITIALIZATION */
  /* ==================== */

  async function init() {
    const pathname = window.location.pathname;
    if (pathname.endsWith('index.html') || pathname === '/' || pathname.endsWith('register.html')) {
      // Nao inicializar na pagina de login/registro
      return;
    }

    // Aguardar auth
    const user = getCurrentUserSafe();
    if (!user) {
      setTimeout(init, 2000);
      return;
    }

    if (isVisitorRole(user.role)) return;

    setupMatchRealtime();
    setupStandingsRealtime();

    // Verificar pagamento pendente apos login
    setTimeout(checkPaymentReminder, 5000);
  }

  /* ==================== */
  /* PUBLIC API */
  /* ==================== */
  window.FMNotificationTriggers = {
    init,
    setupMatchRealtime,
    setupStandingsRealtime,
    onUserConfirmedMatch,
    onUserPaid,
    onDrawCompleted,
    checkPaymentReminder,
    sendPaymentReminderToUser,
  };

  /* Auto-init */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 1500));
  } else {
    setTimeout(init, 1500);
  }
})();
