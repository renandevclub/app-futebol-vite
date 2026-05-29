import { getSupabaseClient, initDB, runSupabaseQuery, readStorage, writeStorage, generateId, isSupabaseUnavailable } from './impl/supabase-client.impl.js';
import { normalizeMatchFromSupabase, normalizeMatchToSupabase, normalizeTeams, normalizeTeamDraws, normalizeTeamKey } from './impl/match-normalizer.js';
import { isCurrentUserAdmin } from './impl/auth.service.js';
import { LOCAL_STORAGE_KEYS } from '../shared/constants/storage-keys.js';

const STORAGE_KEYS = LOCAL_STORAGE_KEYS;

function assertAdminWrite(action = 'alterar dados') {
    if (!isCurrentUserAdmin()) {
        throw new Error(`Apenas administradores podem ${action}.`);
    }
}

export async function getAllMatches() {
    await initDB();

    const remoteMatches = await runSupabaseQuery(async (client) => {
        const { data, error } = await client
            .from('fm_partidas')
            .select('*')
            .order('date', { ascending: true })
            .order('time', { ascending: true });

        if (error) throw error;
        return (data || []).map(normalizeMatchFromSupabase);
    }, undefined);

    if (remoteMatches !== undefined) return remoteMatches;

    return readStorage(STORAGE_KEYS.matches, []);
}

export async function getMatchById(matchId) {
    await initDB();

    const remoteMatch = await runSupabaseQuery(async (client) => {
        const { data, error } = await client
            .from('fm_partidas')
            .select('*')
            .eq('id', matchId)
            .maybeSingle();

        if (error) throw error;
        return normalizeMatchFromSupabase(data);
    }, undefined);

    if (remoteMatch !== undefined) return remoteMatch;

    const matches = readStorage(STORAGE_KEYS.matches, []);
    return matches.find(match => match.id === matchId) || null;
}

export async function addMatch(match) {
    await initDB();
    assertAdminWrite('salvar partidas');

    const remoteMatch = await runSupabaseQuery(async (client) => {
        const payload = normalizeMatchToSupabase(match);
        const { data, error } = await client
            .from('fm_partidas')
            .upsert(payload, { onConflict: 'id' })
            .select()
            .single();

        if (error) throw error;
        return normalizeMatchFromSupabase(data);
    }, undefined);

    if (remoteMatch !== undefined) return remoteMatch;

    const matches = readStorage(STORAGE_KEYS.matches, []);
    const existingIndex = matches.findIndex(item => item.id === match.id);

    match.updated_at = new Date().toISOString();
    if (!match.id) {
        match.id = generateId('match');
    }

    if (existingIndex !== -1) {
        matches[existingIndex] = { ...matches[existingIndex], ...match };
    } else {
        matches.push(match);
    }

    writeStorage(STORAGE_KEYS.matches, matches);
    return match;
}

export async function updateMatchRoster(match, action = 'alterar lista de jogadores') {
    await initDB();
    assertAdminWrite(action);

    const payload = normalizeMatchToSupabase(match);
    const client = getSupabaseClient();

    if (client && !isSupabaseUnavailable()) {
        try {
            const { error } = await client.rpc('admin_update_match_roster', {
                match_id: payload.id,
                new_players: payload.players,
                new_votes: payload.votes,
                new_team_draws: payload.team_draws
            });

            if (error) throw error;
            return true;
        } catch (error) {
            const message = error?.message || '';
            const rpcMissing = message.includes('Could not find the function')
                || message.includes('admin_update_match_roster');
            const canFallbackLocal = message.includes('Failed to fetch')
                || error?.name === 'TypeError';

            if (rpcMissing) {
                console.warn('RPC administrativa de jogadores indisponivel, tentando salvar partida completa:', error);
                return await addMatch(match);
            }

            if (!canFallbackLocal) {
                throw error;
            }

            console.warn('Supabase indisponivel, usando fallback local para lista de jogadores:', error);
        }
    }

    return await addMatch(match);
}

export async function deleteMatch(matchId) {
    await initDB();
    assertAdminWrite('excluir partidas');

    const remoteDeleted = await runSupabaseQuery(async (client) => {
        const { error } = await client
            .from('fm_partidas')
            .delete()
            .eq('id', matchId);

        if (error) throw error;
        return true;
    }, undefined);

    if (remoteDeleted !== undefined) return;

    let matches = readStorage(STORAGE_KEYS.matches, []);
    matches = matches.filter(match => match.id !== matchId);
    writeStorage(STORAGE_KEYS.matches, matches);
}

export async function playerUpdateMatchData(matchId, players, votes) {
    await initDB();

    const client = getSupabaseClient();
    if (client && !isSupabaseUnavailable()) {
        try {
            const { error } = await client.rpc('player_update_match', {
                match_id: matchId,
                new_players: players,
                new_votes: votes
            });
            if (error) throw error;
            return;
        } catch (error) {
            const message = error?.message || '';
            const canFallback = message.includes('Could not find the function')
                || message.includes('Failed to fetch')
                || error?.name === 'TypeError';

            if (!canFallback) {
                throw error;
            }

            console.warn('RPC de atualizacao indisponivel, usando fallback local:', error);
        }
    }

    // Fallback local
    const matches = readStorage(STORAGE_KEYS.matches, []);
    const match = matches.find(m => m.id === matchId);
    if (match) {
        match.players = players;
        match.votes = votes;
        match.updated_at = new Date().toISOString();
        writeStorage(STORAGE_KEYS.matches, matches);
    }
}

export async function playerWithdrawFromMatch(matchId, reason = '') {
    await initDB();

    const client = getSupabaseClient();
    if (!client) {
        throw new Error('Sistema indisponível. Tente novamente em instantes.');
    }

    try {
        const { data, error } = await client.rpc('player_withdraw_from_match', {
            p_match_id: matchId,
            p_reason: reason
        });

        if (error) {
            console.error('Erro na RPC de desistência:', error);
            throw new Error(error.message || 'Erro ao registrar desistência. Tente novamente.');
        }

        if (!data || !data.success) {
            throw new Error('Resposta inválida do servidor. Tente novamente.');
        }

        return data;
    } catch (error) {
        console.error('Falha ao registrar desistência:', error);
        throw error;
    }
}

export const matchService = Object.freeze({
    list: getAllMatches,
    getById: getMatchById,
    save: addMatch,
    remove: deleteMatch,
    updateRoster: updateMatchRoster,
    updatePlayerData: playerUpdateMatchData,
    withdrawPlayer: playerWithdrawFromMatch,
    normalizeFromDatabase: normalizeMatchFromSupabase,
    normalizeToDatabase: normalizeMatchToSupabase,
    normalizeTeams,
    normalizeTeamDraws,
    normalizeTeamKey,
});

export {
    normalizeMatchFromSupabase,
    normalizeMatchToSupabase,
    normalizeTeams,
    normalizeTeamDraws,
    normalizeTeamKey,
};


