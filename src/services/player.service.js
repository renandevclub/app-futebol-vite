import { getSupabaseClient, initDB, runSupabaseQuery, readStorage, writeStorage, generateId } from './impl/supabase-client.impl.js';
import { isCurrentUserAdmin } from './impl/auth.service.js';
import { LOCAL_STORAGE_KEYS } from '../shared/constants/storage-keys.js';

const STORAGE_KEYS = LOCAL_STORAGE_KEYS;

function assertAdminWrite(action = 'alterar dados') {
    if (!isCurrentUserAdmin()) {
        throw new Error(`Apenas administradores podem ${action}.`);
    }
}

export async function getUser(username) {
    await initDB();

    const remoteUser = await runSupabaseQuery(async (client) => {
        const { data, error } = await client
            .from('fm_perfis')
            .select('*')
            .ilike('username', username)
            .maybeSingle();

        if (error) throw error;
        return data || null;
    }, undefined);

    if (remoteUser !== undefined) return remoteUser;

    const users = readStorage(STORAGE_KEYS.users, []);
    return users.find(user => user.username.toLowerCase() === username.toLowerCase()) || null;
}

export async function getUserByEmail(email) {
    await initDB();

    const remoteUser = await runSupabaseQuery(async (client) => {
        const { data, error } = await client
            .from('fm_perfis')
            .select('*')
            .ilike('email', email)
            .maybeSingle();

        if (error) throw error;
        return data || null;
    }, undefined);

    if (remoteUser !== undefined) return remoteUser;

    const users = readStorage(STORAGE_KEYS.users, []);
    return users.find(user => user.email?.toLowerCase() === email.toLowerCase()) || null;
}

export async function getProfileByAuthId(authId) {
    await initDB();

    const remoteUser = await runSupabaseQuery(async (client) => {
        const { data, error } = await client
            .from('fm_perfis')
            .select('*')
            .eq('auth_id', authId)
            .maybeSingle();

        if (error) throw error;
        return data || null;
    }, undefined);

    if (remoteUser !== undefined) return remoteUser;

    const users = readStorage(STORAGE_KEYS.users, []);
    return users.find(user => user.id === authId || user.auth_id === authId) || null;
}

export async function addUser(user) {
    await initDB();
    assertAdminWrite('adicionar usuarios');

    const remoteUser = await runSupabaseQuery(async (client) => {
        const payload = {
            username: user.username,
            full_name: user.full_name || user.fullName || user.username,
            email: user.email || null,
            role: user.role || 'player',
            auth_id: user.auth_id || user.id || null
        };
        const { data, error } = await client
            .from('fm_perfis')
            .upsert(payload, { onConflict: 'username' })
            .select()
            .single();

        if (error) throw error;
        return data;
    }, undefined);

    if (remoteUser !== undefined) return remoteUser;

    const users = readStorage(STORAGE_KEYS.users, []);
    if (!user.id) {
        user.id = generateId('user');
    }
    user.created_at = user.created_at || new Date().toISOString();
    user.updated_at = new Date().toISOString();

    users.push(user);
    writeStorage(STORAGE_KEYS.users, users);
    return user;
}

export async function getPlayerStats(username) {
    await initDB();

    const remoteStats = await runSupabaseQuery(async (client) => {
        const { data, error } = await client
            .from('fm_estatisticas_jogadores')
            .select('*')
            .ilike('username', username)
            .maybeSingle();

        if (error) throw error;
        return data || null;
    }, undefined);

    if (remoteStats !== undefined) return remoteStats;

    const stats = readStorage(STORAGE_KEYS.playerStats, []);
    return stats.find(item => item.username.toLowerCase() === username.toLowerCase()) || null;
}

export async function updatePlayerStats(stats) {
    await initDB();
    assertAdminWrite('alterar estatisticas dos jogadores');

    const remoteStats = await runSupabaseQuery(async (client) => {
        const { data, error } = await client
            .from('fm_estatisticas_jogadores')
            .upsert(stats, { onConflict: 'username' })
            .select()
            .single();

        if (error) throw error;
        return data;
    }, undefined);

    if (remoteStats !== undefined) return remoteStats;

    const allStats = readStorage(STORAGE_KEYS.playerStats, []);
    const index = allStats.findIndex(item => item.username.toLowerCase() === stats.username.toLowerCase());

    stats.updated_at = new Date().toISOString();
    if (!stats.username) {
        throw new Error('Username obrigatorio para atualizar stats.');
    }

    if (index !== -1) {
        allStats[index] = { ...allStats[index], ...stats };
    } else {
        allStats.push(stats);
    }

    writeStorage(STORAGE_KEYS.playerStats, allStats);
    return stats;
}

export async function clearPlayerStats(username) {
    await initDB();
    assertAdminWrite('limpar estatisticas dos jogadores');

    const remoteCleared = await runSupabaseQuery(async (client) => {
        const { error } = await client
            .from('fm_estatisticas_jogadores')
            .delete()
            .ilike('username', username);

        if (error) throw error;
        return true;
    }, undefined);

    if (remoteCleared !== undefined) return;

    let allStats = readStorage(STORAGE_KEYS.playerStats, []);
    allStats = allStats.filter(item => item.username.toLowerCase() !== username.toLowerCase());
    writeStorage(STORAGE_KEYS.playerStats, allStats);
}

export const playerService = Object.freeze({
    getUser,
    getUserByEmail,
    getProfileByAuthId,
    addUser,
    getStats: getPlayerStats,
    updateStats: updatePlayerStats,
    clearStats: clearPlayerStats,
});
