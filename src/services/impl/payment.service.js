/**
 * @file src/services/impl/payment.service.js
 * @description Serviço de Pagamento — gerencia status de pagamento dos jogadores
 * Schema real: fm_profiles.confirmed + fm_profiles.payment_status
 * NÃO existe tabela fm_payment_status separada.
 */

import { paymentFromSupabase, validatePayment, isPaymentPending, isPaymentPaid } from '../../core/dto/payment.dto.js';
import { runSupabaseOperation } from './supabase-client.service.js';
import { getStoredUser } from '../../stores/session-store.js';

/**
 * Obtém o status de pagamento de um usuário
 * No banco: fm_profiles.confirmed + fm_profiles.payment_status
 * @param {string} [playerId] - auth_id do usuário (se omitido, usa logado)
 * @returns {Promise<import('../../core/types').FMPaymentStatus|null>}
 */
export async function getPaymentStatus(playerId) {
  const uid = playerId || getStoredUser()?.id;
  if (!uid) return null;

  return await runSupabaseOperation(
    async () => {
      const { getSupabaseClient } = await import('./supabase-client.service.js');
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('fm_perfis')
        .select('auth_id, confirmed, payment_status')
        .eq('auth_id', uid)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return paymentFromSupabase({
        player_id: data.auth_id,
        confirmed: data.confirmed,
        payment_status: data.payment_status || 'pending',
      });
    },
    null
  );
}

/**
 * Atualiza o status de pagamento de um jogador
 * No banco: atualiza fm_profiles
 * @param {'pending'|'paid'} status
 * @param {string} [playerId] - auth_id
 * @returns {Promise<import('../../core/types').FMPaymentStatus|null>}
 */
export async function updatePaymentStatus(status, playerId) {
  const uid = playerId || getStoredUser()?.id;
  if (!uid) return null;

  const payment = {
    player_id: uid,
    confirmed: status === 'paid',
    payment_status: status,
    confirmed_at: status === 'paid' ? new Date().toISOString() : null,
    paid_at: status === 'paid' ? new Date().toISOString() : null,
  };

  const validation = validatePayment(payment);
  if (!validation.valid) {
    console.warn('[payment.service] Invalid payment:', validation.errors);
    return null;
  }

  return await runSupabaseOperation(
    async () => {
      const { getSupabaseClient } = await import('./supabase-client.service.js');
      const client = getSupabaseClient();
      const updates = {
        confirmed: status === 'paid',
        payment_status: status,
      };
      const { data, error } = await client
        .from('fm_perfis')
        .update(updates)
        .eq('auth_id', uid)
        .select('auth_id, confirmed, payment_status')
        .single();
      if (error) throw error;
      return paymentFromSupabase({
        player_id: data.auth_id,
        confirmed: data.confirmed,
        payment_status: data.payment_status || 'pending',
      });
    },
    null
  );
}

/**
 * Marca pagamento como pago
 * @param {string} [playerId]
 * @returns {Promise<import('../../core/types').FMPaymentStatus|null>}
 */
export async function markAsPaid(playerId) {
  return updatePaymentStatus('paid', playerId);
}

/**
 * Marca pagamento como pendente
 * @param {string} [playerId]
 * @returns {Promise<import('../../core/types').FMPaymentStatus|null>}
 */
export async function markAsPending(playerId) {
  return updatePaymentStatus('pending', playerId);
}

/**
 * Lista todos os usuários com pagamento pendente
 * @returns {Promise<import('../../core/types').FMPaymentStatus[]>}
 */
export async function listPendingPayments() {
  return (
    (await runSupabaseOperation(
      async () => {
        const { getSupabaseClient } = await import('./supabase-client.service.js');
        const client = getSupabaseClient();
        const { data, error } = await client
          .from('fm_perfis')
          .select('auth_id, confirmed, payment_status')
          .eq('payment_status', 'pending');
        if (error) throw error;
        return (data || []).map(row =>
          paymentFromSupabase({
            player_id: row.auth_id,
            confirmed: row.confirmed,
            payment_status: row.payment_status || 'pending',
          })
        ).filter(Boolean);
      },
      []
    )) || []
  );
}

/**
 * Verifica se o usuário tem pagamentos pendentes
 * @param {string} [playerId]
 * @returns {Promise<boolean>}
 */
export async function hasPendingPayments(playerId) {
  const uid = playerId || getStoredUser()?.id;
  if (!uid) return false;

  return await runSupabaseOperation(
    async () => {
      const { getSupabaseClient } = await import('./supabase-client.service.js');
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('fm_perfis')
        .select('auth_id, payment_status')
        .eq('auth_id', uid)
        .eq('payment_status', 'pending')
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
    false
  );
}

// Re-exporta helpers dos DTOs
export { isPaymentPending, isPaymentPaid };
