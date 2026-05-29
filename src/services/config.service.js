import { initDB, runSupabaseQuery, readStorage } from './impl/supabase-client.impl.js';
import { LOCAL_STORAGE_KEYS } from '../shared/constants/storage-keys.js';

const STORAGE_KEYS = LOCAL_STORAGE_KEYS;
const DEFAULT_CONFIG = [];

export async function getConfig(key) {
    await initDB();

    const remoteValue = await runSupabaseQuery(async (client) => {
        const { data, error } = await client
            .from('configuracoes')
            .select('value')
            .eq('key', key)
            .maybeSingle();

        if (error) throw error;
        return data?.value || null;
    }, undefined);

    if (remoteValue !== undefined) return remoteValue;

    const config = readStorage(STORAGE_KEYS.config, DEFAULT_CONFIG);
    const entry = config.find(item => item.key === key);
    return entry ? entry.value : null;
}

export const configService = Object.freeze({
    get: getConfig,
});
