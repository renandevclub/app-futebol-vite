import { initDB, runSupabaseQuery, readStorage, getSupabaseClient, writeStorage } from './impl/supabase-client.impl.js';
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

export async function saveConfig(key, value) {
    await initDB();

    const result = await runSupabaseQuery(async (client) => {
        const { error } = await client
            .from('configuracoes')
            .upsert({ key, value }, { onConflict: 'key' });

        if (error) throw error;
        return true;
    }, undefined);

    if (result !== undefined) return result;

    // Fallback local se Supabase estiver offline
    const config = readStorage(STORAGE_KEYS.config, DEFAULT_CONFIG);
    const existingIndex = config.findIndex(item => item.key === key);
    if (existingIndex !== -1) {
        config[existingIndex].value = value;
    } else {
        config.push({ key, value });
    }
    writeStorage(STORAGE_KEYS.config, config);
    return true;
}

export const configService = Object.freeze({
    get: getConfig,
    set: saveConfig,
});

