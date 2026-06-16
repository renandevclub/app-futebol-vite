import { getSupabaseClient, initDB, readStorage, writeStorage } from './impl/supabase-client.impl.js';
import { normalizeTeams, normalizeTeamKey, normalizeTeamDraws, TEAM_DEFAULT_STYLES } from './impl/match-normalizer.js';
import { isCurrentUserAdmin } from './impl/auth.service.js';
import { getCurrentUser } from './impl/auth.service.js'; // From the refactored auth module
import { LOCAL_STORAGE_KEYS } from '../shared/constants/storage-keys.js';

const STORAGE_KEYS = LOCAL_STORAGE_KEYS;

function assertAdminWrite(action = 'alterar dados') {
    if (!isCurrentUserAdmin()) {
        throw new Error(`Apenas administradores podem ${action}.`);
    }
}

export function chooseBalancedTeam(match) {
    const teams = normalizeTeams(match.teams || []);
    if (teams.length === 0) return null;

    const counts = teams.map(team => ({
        team,
        count: (match.players || []).filter(player => player.teamId === team.id).length
    }));
    const minCount = Math.min(...counts.map(item => item.count));
    const eligibleTeams = counts.filter(item => item.count === minCount);
    const index = Math.floor(Math.random() * eligibleTeams.length);
    return eligibleTeams[index]?.team || null;
}

export function generateDrawIdempotencyKey(matchId) {
    const currentUser = getCurrentUser();
    const username = currentUser?.username || 'unknown';
    const timeWindow = Math.floor(Date.now() / 15000); // janela de 15 segundos
    const random = Math.random().toString(36).substring(2, 8);
    return `draw_${matchId}_${normalizeTeamKey(username)}_${timeWindow}_${random}`;
}

export async function playerDrawTeam(matchId, forceTeamId = null, drawType = 'linha') {
    await initDB();

    const client = getSupabaseClient();
    if (!client) {
        throw new Error('Sistema indisponivel. Tente novamente em instantes.');
    }

    const idempotencyKey = generateDrawIdempotencyKey(matchId);
    const currentUser = getCurrentUser();

    try {
        const params = {
            p_match_id: matchId,
            p_idempotency_key: idempotencyKey,
            p_draw_type: drawType
        };
        if (forceTeamId) {
            params.p_force_team_id = forceTeamId;
        }

        // Se for sessão de jogador simplificada (sem auth.uid), passamos o username
        if (currentUser && currentUser.is_player_session) {
            params.p_player_username = currentUser.username;
        }

        const { data, error } = await client.rpc('player_draw_team', params);

        if (error) {
            console.error('Erro na RPC de sorteio:', error);
            throw new Error(error.message || 'Erro ao realizar sorteio. Tente novamente.');
        }

        if (!data) {
            throw new Error('Resposta invalida do servidor. Tente novamente.');
        }

        return data;
    } catch (error) {
        const message = error?.message || '';

        if (message.includes('already') || message.includes('possui')) {
            throw error;
        }

        console.error('Falha crítica no sorteio (sem fallback local):', error);
        throw new Error(
            'Não foi possível realizar o sorteio. Verifique sua conexão e tente novamente. ' +
            'Seu progresso está seguro.'
        );
    }
}

export async function getPlayerDrawStatus(matchId) {
    await initDB();

    const client = getSupabaseClient();
    if (!client) {
        console.warn('Supabase indisponível, não é possível verificar status do sorteio.');
        return { authenticated: false, error: 'offline' };
    }

    const currentUser = getCurrentUser();
    const params = {
        p_match_id: matchId
    };

    if (currentUser && currentUser.is_player_session) {
        params.p_player_username = currentUser.username;
    }

    try {
        const { data, error } = await client.rpc('get_player_draw_status', params);

        if (error) {
            console.warn('Erro ao consultar status do sorteio:', error);
            return { authenticated: false, error: error.message };
        }

        return data || { authenticated: false };
    } catch (error) {
        console.warn('Erro ao consultar status do sorteio:', error);
        return { authenticated: false, error: 'network_error' };
    }
}

export async function releasePlayerDraw(matchId, username) {
    await initDB();
    assertAdminWrite('liberar novo sorteio');

    const usernameKey = normalizeTeamKey(username);
    const client = getSupabaseClient();
    let supabaseUnavailable = false;

    if (client) {
        try {
            const { error } = await client.rpc('admin_release_player_draw', {
                p_match_id: matchId,
                p_player_username: username,
                p_release_reason: 'Administrador liberou novo sorteio.'
            });

            if (error) throw error;
            return true;
        } catch (error) {
            const message = error?.message || '';
            const canFallback = message.includes('Could not find the function')
                || message.includes('admin_release_player_draw')
                || message.includes('Failed to fetch')
                || error?.name === 'TypeError';

            if (!canFallback) {
                throw error;
            }

            console.warn('RPC de liberacao de sorteio indisponivel, usando fallback local:', error);
            supabaseUnavailable = true;
        }
    }

    const matches = readStorage(STORAGE_KEYS.matches, []);
    const match = matches.find(item => item.id === matchId);
    if (!match) {
        throw new Error('Partida nao encontrada.');
    }

    match.players = Array.isArray(match.players) ? match.players : [];
    const player = match.players.find(item => normalizeTeamKey(item?.username) === usernameKey);
    match.teamDraws = normalizeTeamDraws(match.teamDraws || match.team_draws || {});
    if (!player && !match.teamDraws[usernameKey]) {
        throw new Error('Jogador nao encontrado na lista de confirmados.');
    }

    if (player) {
        delete player.teamId;
        delete player.teamName;
        delete player.assignmentMode;
        delete player.drawnAt;
    }

    delete match.teamDraws[usernameKey];
    match.team_draws = match.teamDraws;
    match.updated_at = new Date().toISOString();
    writeStorage(STORAGE_KEYS.matches, matches);
    return true;
}

export const drawService = Object.freeze({
    chooseBalancedTeam,
    createIdempotencyKey: generateDrawIdempotencyKey,
    drawTeam: playerDrawTeam,
    getStatus: getPlayerDrawStatus,
    releasePlayerDraw,
    teamDefaultStyles: TEAM_DEFAULT_STYLES,
});
