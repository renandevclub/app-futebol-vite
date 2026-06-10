import { getSupabaseClient, initDB, runSupabaseQuery } from './impl/supabase-client.impl.js';

export async function getPaymentLinks() {
    await initDB();

    const remoteSettings = await runSupabaseQuery(async (client) => {
        const { data, error } = await client
            .from('configuracoes')
            .select('key, value')
            .in('key', [
                'payment_link_early_player',
                'payment_link_regular_player',
                'payment_link_goalkeeper',
                'payment_early_enabled_until',
                'payment_text_early_player',
                'payment_text_regular_player',
                'payment_text_goalkeeper'
            ]);

        if (error) throw error;
        
        const links = {};
        if (data) {
            data.forEach(item => {
                links[item.key] = item.value;
            });
        }
        return links;
    }, undefined);

    if (remoteSettings !== undefined) return remoteSettings;
    return {};
}

export async function getPlayerPaymentStatus(authUserId) {
    await initDB();

    const remotePlayer = await runSupabaseQuery(async (client) => {
        const { data, error } = await client
            .from('fm_perfis')
            .select('confirmed, payment_status')
            .eq('auth_id', authUserId)
            .maybeSingle();

        if (error) throw error;
        return data || null;
    }, undefined);

    if (remotePlayer !== undefined) return remotePlayer;
    return null;
}

export async function updatePlayerPaymentStatus(authId, updates) {
    await initDB();
    const client = getSupabaseClient();
    if (!client) return false;

    try {
        const { error } = await client
            .from('fm_perfis')
            .update(updates)
            .eq('auth_id', authId);

        if (error) {
            console.error('Erro ao atualizar payment status:', error);
            return false;
        }
        return true;
    } catch (error) {
        console.error('Erro ao atualizar payment status:', error);
        return false;
    }
}

export async function updatePlayerPaymentStatusByUsername(username, updates) {
    await initDB();
    const client = getSupabaseClient();
    if (!client) return false;

    try {
        const { error } = await client
            .from('fm_perfis')
            .update(updates)
            .eq('username', username);

        if (error) {
            console.error('Erro ao atualizar payment status por username:', error);
            return false;
        }
        return true;
    } catch (error) {
        console.error('Erro ao atualizar payment status por username:', error);
        return false;
    }
}

export const paymentService = Object.freeze({
    getLinks: getPaymentLinks,
    getStatus: getPlayerPaymentStatus,
    updateStatus: updatePlayerPaymentStatus,
    updateStatusByUsername: updatePlayerPaymentStatusByUsername,
});
