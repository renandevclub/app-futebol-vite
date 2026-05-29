/**
 * @file src/core/dto/notification.dto.js
 * @description DTO e transformação para Notification (Log de push do OneSignal)
 * Schema real: fm_notifications — log de notificações push enviadas via OneSignal
 */

/**
 * Transforma dados brutos do Supabase para entidade interna
 * @param {any} rawData
 * @returns {import('../types').FMNotification|null}
 */
export function notificationFromSupabase(rawData) {
  if (!rawData) return null;

  return {
    id: rawData.id || '',
    type: rawData.type || 'info',
    match_id: rawData.match_id || null,
    title: rawData.title || '',
    body: rawData.body || '',
    url: rawData.url || null,
    data: rawData.data || {},
    sent_by: rawData.sent_by || null,
    onesignal_external_id: rawData.onesignal_external_id || null,
    onesignal_notification_id: rawData.onesignal_notification_id || null,
    segment: rawData.segment || null,
    status: rawData.status || 'sent',
    created_at: rawData.created_at || null,
  };
}

/**
 * Transforma entidade interna para formato Supabase
 * @param {import('../types').FMNotification} notification
 * @returns {Object}
 */
export function notificationToSupabase(notification) {
  return {
    id: notification.id,
    type: notification.type,
    match_id: notification.match_id,
    title: notification.title,
    body: notification.body,
    url: notification.url,
    data: notification.data,
    sent_by: notification.sent_by,
    onesignal_external_id: notification.onesignal_external_id,
    onesignal_notification_id: notification.onesignal_notification_id,
    segment: notification.segment,
    status: notification.status,
  };
}

/**
 * Tipos de notificação disponíveis
 */
export const NOTIFICATION_TYPES = {
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

/**
 * Obtém label de tipo em português
 * @param {string} type
 * @returns {string}
 */
export function getNotificationTypeLabel(type) {
  const labels = {
    [NOTIFICATION_TYPES.DRAW_STARTED]: 'Sorteio Iniciado',
    [NOTIFICATION_TYPES.TEAM_FULL]: 'Time Completo',
    [NOTIFICATION_TYPES.NEW_PLAYER]: 'Novo Jogador',
    [NOTIFICATION_TYPES.PAYMENT_PENDING]: 'Pagamento Pendente',
    [NOTIFICATION_TYPES.MATCH_CONFIRMED]: 'Partida Confirmada',
    [NOTIFICATION_TYPES.SCHEDULE_CHANGE]: 'Alteração de Horário',
    [NOTIFICATION_TYPES.MATCH_RESULT]: 'Resultado da Partida',
    [NOTIFICATION_TYPES.RANKING_UPDATE]: 'Ranking Atualizado',
    [NOTIFICATION_TYPES.ADMIN_NOTICE]: 'Aviso Administrativo',
    [NOTIFICATION_TYPES.VOTING_OPEN]: 'Votação Aberta',
  };
  return labels[type] || type;
}
