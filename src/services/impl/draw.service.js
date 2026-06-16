/**
 * @file src/services/impl/draw.service.js
 * @description Serviço de Sorteio (Player Draw) — CRUD gerenciado
 * Schema real: fm_sorteios_jogadores — usa player_username (não player_id)
 */

import { drawFromSupabase, drawToSupabase, validateDraw } from '../../core/dto/draw.dto.js';
import { runSupabaseOperation } from './supabase-client.service.js';
import { getStoredUser } from '../../stores/session-store.js';

/**
 * Lista todos os draws de uma partida
 * @param {string} matchId
 * @returns {Promise<import('../../core/types').FMPlayerDraw[]>}
 */
export async function listDraws(matchId) {
  return (
    (await runSupabaseOperation(
      async () => {
        const { getSupabaseClient } = await import('./supabase-client.service.js');
        const client = getSupabaseClient();
        const { data, error } = await client
          .from('fm_sorteios_jogadores')
          .select('*')
          .eq('match_id', matchId);
        if (error) throw error;
        return (data || []).map(drawFromSupabase).filter(Boolean);
      },
      []
    )) || []
  );
}

/**
 * Obtém o status de draw de um jogador específico
 * @param {string} matchId
 * @param {string} [username] - Se omitido, usa username do usuário logado
 * @returns {Promise<import('../../core/types').FMPlayerDraw|null>}
 */
export async function getPlayerDraw(matchId, username) {
  const uname = username || getStoredUser()?.username;
  if (!uname || !matchId) return null;

  return await runSupabaseOperation(
    async () => {
      const { getSupabaseClient } = await import('./supabase-client.service.js');
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('fm_sorteios_jogadores')
        .select('*')
        .eq('match_id', matchId)
        .eq('player_username', uname)
        .maybeSingle();
      if (error) throw error;
      return data ? drawFromSupabase(data) : null;
    },
    null
  );
}

/**
 * Cria um novo draw (jogador entra no sorteio)
 * @param {string} matchId
 * @param {string} [username] - Se omitido, usa username do usuário logado
 * @returns {Promise<import('../../core/types').FMPlayerDraw|null>}
 */
export async function createDraw(matchId, username) {
  const uname = username || getStoredUser()?.username;
  if (!uname || !matchId) return null;

  const draw = {
    match_id: matchId,
    player_username: uname,
    player_key: uname.toLowerCase(),
    team_id: null,
    team_name: null,
    status: 'drawn',
    assigned_by: 'system',
  };

  const validation = validateDraw(draw);
  if (!validation.valid) {
    console.warn('[draw.service] Invalid draw:', validation.errors);
    return null;
  }

  return await runSupabaseOperation(
    async () => {
      const { getSupabaseClient } = await import('./supabase-client.service.js');
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('fm_sorteios_jogadores')
        .insert(drawToSupabase(draw))
        .select()
        .single();
      if (error) throw error;
      return drawFromSupabase(data);
    },
    null
  );
}

/**
 * Remove/release um draw (jogador sai do sorteio)
 * @param {string} matchId
 * @param {string} [username]
 * @returns {Promise<boolean>}
 */
export async function releaseDraw(matchId, username) {
  const uname = username || getStoredUser()?.username;
  if (!uname || !matchId) return false;

  return await runSupabaseOperation(
    async () => {
      const { getSupabaseClient } = await import('./supabase-client.service.js');
      const client = getSupabaseClient();
      const { error } = await client
        .from('fm_sorteios_jogadores')
        .update({
          status: 'released',
          released_at: new Date().toISOString(),
          released_by: uname,
        })
        .eq('match_id', matchId)
        .eq('player_username', uname)
        .eq('status', 'drawn');
      if (error) throw error;
      return true;
    },
    false
  );
}

/**
 * Atualiza o time sorteado para um jogador
 * @param {string} drawId
 * @param {string} teamId
 * @param {string} [teamName]
 * @returns {Promise<import('../../core/types').FMPlayerDraw|null>}
 */
export async function assignTeam(drawId, teamId, teamName) {
  if (!drawId || !teamId) return null;

  return await runSupabaseOperation(
    async () => {
      const { getSupabaseClient } = await import('./supabase-client.service.js');
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('fm_sorteios_jogadores')
        .update({
          team_id: teamId,
          team_name: teamName || null,
          status: 'drawn',
          drawn_at: new Date().toISOString(),
        })
        .eq('id', drawId)
        .select()
        .single();
      if (error) throw error;
      return drawFromSupabase(data);
    },
    null
  );
}
