/**
 * @file src/core/dto/draw.dto.js
 * @description DTO e transformação para Player Draw (Sorteio)
 * Schema real: fm_player_draws — player_username (não player_id)
 */

/**
 * Transforma dados brutos do Supabase para entidade interna
 * @param {any} rawData
 * @returns {import('../types').FMPlayerDraw|null}
 */
export function drawFromSupabase(rawData) {
  if (!rawData) return null;

  return {
    id: rawData.id || '',
    match_id: rawData.match_id || '',
    player_username: rawData.player_username || '',
    player_key: rawData.player_key || '',
    team_id: rawData.team_id || null,
    team_name: rawData.team_name || null,
    status: rawData.status || 'drawn',
    assigned_by: rawData.assigned_by || 'system',
    idempotency_key: rawData.idempotency_key || null,
    drawn_at: rawData.drawn_at || null,
    created_at: rawData.created_at || null,
    updated_at: rawData.updated_at || null,
    released_at: rawData.released_at || null,
    released_by: rawData.released_by || null,
    release_reason: rawData.release_reason || null,
  };
}

/**
 * Transforma entidade interna para formato Supabase
 * @param {import('../types').FMPlayerDraw} draw
 * @returns {Object}
 */
export function drawToSupabase(draw) {
  return {
    id: draw.id,
    match_id: draw.match_id,
    player_username: draw.player_username,
    player_key: draw.player_key,
    team_id: draw.team_id,
    team_name: draw.team_name,
    status: draw.status,
    assigned_by: draw.assigned_by,
    idempotency_key: draw.idempotency_key,
  };
}

/**
 * Validação básica de Draw
 * @param {any} data
 * @returns {{ valid: boolean; errors: string[] }}
 */
export function validateDraw(data) {
  const errors = [];

  if (!data.match_id) {
    errors.push('Match ID é obrigatório');
  }

  if (!data.player_username && !data.player_key) {
    errors.push('Player username ou key é obrigatório');
  }

  if (data.status && !['drawn', 'released'].includes(data.status)) {
    errors.push('Status inválido');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
