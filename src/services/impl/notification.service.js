/**
 * @file src/services/impl/notification.service.js
 * @description Serviço de Notificações — acesso ao log de push OneSignal
 * Schema real: fm_notificacoes — log de notificações push via OneSignal
 */

import { notificationFromSupabase, notificationToSupabase, NOTIFICATION_TYPES, getNotificationTypeLabel } from '../../core/dto/notification.dto.js';
import { runSupabaseOperation } from './supabase-client.service.js';

/**
 * Lista notificações do log OneSignal
 * @param {Object} [opts={}]
 * @param {number} [opts.limit=20]
 * @returns {Promise<import('../../core/types').FMNotification[]>}
 */
export async function listNotifications(opts = {}) {
  const { limit = 20 } = opts;

  return (
    (await runSupabaseOperation(
      async () => {
        const { getSupabaseClient } = await import('./supabase-client.service.js');
        const client = getSupabaseClient();
        const { data, error } = await client
          .from('fm_notificacoes')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);
        if (error) throw error;
        return (data || []).map(notificationFromSupabase).filter(Boolean);
      },
      []
    )) || []
  );
}

/**
 * Cria uma entrada de log de notificação
 * @param {Object} payload
 * @param {string} payload.type
 * @param {string} [payload.match_id]
 * @param {string} payload.title
 * @param {string} payload.body
 * @param {string} [payload.url]
 * @param {Object} [payload.data]
 * @param {string} [payload.sent_by]
 * @param {string} [payload.onesignal_external_id]
 * @param {string} [payload.onesignal_notification_id]
 * @param {string} [payload.segment]
 * @param {string} [payload.status]
 * @returns {Promise<import('../../core/types').FMNotification|null>}
 */
export async function logNotification(payload) {
  if (!payload.type || !payload.title) return null;

  const notification = {
    type: payload.type,
    match_id: payload.match_id || null,
    title: payload.title,
    body: payload.body || '',
    url: payload.url || null,
    data: payload.data || {},
    sent_by: payload.sent_by || null,
    onesignal_external_id: payload.onesignal_external_id || null,
    onesignal_notification_id: payload.onesignal_notification_id || null,
    segment: payload.segment || null,
    status: payload.status || 'sent',
    created_at: new Date().toISOString(),
  };

  return await runSupabaseOperation(
    async () => {
      const { getSupabaseClient } = await import('./supabase-client.service.js');
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('fm_notificacoes')
        .insert(notificationToSupabase(notification))
        .select()
        .single();
      if (error) throw error;
      return notificationFromSupabase(data);
    },
    null
  );
}

// Re-exporta constantes do DTO
export { NOTIFICATION_TYPES, getNotificationTypeLabel };
