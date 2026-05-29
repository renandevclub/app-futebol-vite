/**
 * @file src/core/dto/payment.dto.js
 * @description DTO e transformação para Payment Status
 */

/**
 * Transforma dados brutos do Supabase para entidade interna
 * @param {any} rawData
 * @returns {import('../types').FMPaymentStatus|null}
 */
export function paymentFromSupabase(rawData) {
  if (!rawData) return null;

  return {
    player_id: rawData.player_id || rawData.auth_id || '',
    match_id: rawData.match_id || '',
    confirmed: Boolean(rawData.confirmed),
    payment_status: rawData.payment_status || 'pending',
    confirmed_at: rawData.confirmed_at || null,
    paid_at: rawData.paid_at || null,
  };
}

/**
 * Transforma entidade interna para formato Supabase
 * @param {import('../types').FMPaymentStatus} payment
 * @returns {Object}
 */
export function paymentToSupabase(payment) {
  return {
    player_id: payment.player_id,
    match_id: payment.match_id,
    confirmed: payment.confirmed,
    payment_status: payment.payment_status,
    confirmed_at: payment.confirmed_at,
    paid_at: payment.paid_at,
  };
}

/**
 * Validação básica de Payment
 * @param {any} data
 * @returns {{ valid: boolean; errors: string[] }}
 */
export function validatePayment(data) {
  const errors = [];

  if (!data.player_id) {
    errors.push('Player ID é obrigatório');
  }

  if (!data.payment_status || !['pending', 'paid'].includes(data.payment_status)) {
    errors.push('Status de pagamento inválido');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Verifica se pagamento está pendente
 * @param {import('../types').FMPaymentStatus} payment
 * @returns {boolean}
 */
export function isPaymentPending(payment) {
  return payment?.payment_status === 'pending';
}

/**
 * Verifica se pagamento está pago
 * @param {import('../types').FMPaymentStatus} payment
 * @returns {boolean}
 */
export function isPaymentPaid(payment) {
  return payment?.payment_status === 'paid';
}

/**
 * Obtém label de status em português
 * @param {string} status
 * @returns {string}
 */
export function getPaymentStatusLabel(status) {
  const labels = {
    pending: 'Pendente',
    paid: 'Pago',
  };
  return labels[status] || status;
}
