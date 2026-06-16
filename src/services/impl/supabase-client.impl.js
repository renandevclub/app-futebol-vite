import { FM_CONFIG } from '../../core/config.js';
import { LOCAL_STORAGE_KEYS } from '../../shared/constants/storage-keys.js';

const STORAGE_KEYS = LOCAL_STORAGE_KEYS;
const SUPABASE_URL = FM_CONFIG.supabase.url || '';
const SUPABASE_PUBLISHABLE_KEY = FM_CONFIG.supabase.publishableKey || '';

let futebolSupabaseClient = null;
let supabaseUnavailable = false;

export function readStorage(key, fallback = []) {
    const raw = localStorage.getItem(key);
    if (!raw) return Array.isArray(fallback) ? [...fallback] : fallback;
    try {
        return JSON.parse(raw);
    } catch (error) {
        console.warn(`Falha ao ler storage ${key}:`, error);
        return Array.isArray(fallback) ? [...fallback] : fallback;
    }
}

export function writeStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

export function generateId(prefix = 'item') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export async function initDB() {
    if (typeof window === 'undefined') {
        throw new Error('localStorage so funciona no browser.');
    }
    
    // Default config values
    const DEFAULT_CONFIG = [];

    if (!localStorage.getItem(STORAGE_KEYS.config)) writeStorage(STORAGE_KEYS.config, DEFAULT_CONFIG);
    if (!localStorage.getItem(STORAGE_KEYS.users)) writeStorage(STORAGE_KEYS.users, []);
    if (!localStorage.getItem(STORAGE_KEYS.matches)) writeStorage(STORAGE_KEYS.matches, []);
    if (!localStorage.getItem(STORAGE_KEYS.playerStats)) writeStorage(STORAGE_KEYS.playerStats, []);
}

export function getSupabaseClient() {
    if (supabaseUnavailable || typeof window === 'undefined') {
        return null;
    }

    if (window.supabaseClient) {
        futebolSupabaseClient = window.supabaseClient;
        return futebolSupabaseClient;
    }

    if (!futebolSupabaseClient && window.supabase?.createClient) {
        futebolSupabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
            auth: {
                autoRefreshToken: true,
                detectSessionInUrl: true,
                persistSession: true,
            },
        });
        window.supabaseClient = futebolSupabaseClient; // Expose globally for auth and scripts

        // Listener global para capturar redirecionamento de recuperação de senha (PASSWORD_RECOVERY)
        futebolSupabaseClient.auth.onAuthStateChange((event, session) => {
            console.log('[Supabase Client Impl] Evento Auth:', event);
            if (event === 'PASSWORD_RECOVERY') {
                const path = window.location.pathname;
                if (!path.endsWith('reset-password.html') && !path.endsWith('redefinir-senha')) {
                    console.log('[Supabase Client Impl] PASSWORD_RECOVERY fora da página de reset. Redirecionando...');
                    const targetUrl = new URL('/pages/reset-password.html', window.location.origin);
                    targetUrl.search = window.location.search;
                    targetUrl.hash = window.location.hash;
                    window.location.replace(targetUrl.toString());
                }
            }
        });
    }

    return futebolSupabaseClient;
}

export async function runSupabaseQuery(operation, fallbackValue) {
    const client = getSupabaseClient();
    if (!client) return fallbackValue;

    try {
        return await operation(client);
    } catch (error) {
        console.warn('Operação do Supabase falhou:', error);
        
        // Marca como indisponível apenas se for erro de rede real (Failed to fetch ou TypeError)
        const isNetworkError = error?.message?.includes('Failed to fetch') || error?.name === 'TypeError';
        if (isNetworkError) {
            console.warn('[SupabaseClient] Erro de rede detectado, ativando fallback offline.');
            supabaseUnavailable = true;
        }
        return fallbackValue;
    }
}

export function setSupabaseUnavailable(status) {
    supabaseUnavailable = status;
}

export function isSupabaseUnavailable() {
    return supabaseUnavailable;
}

if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
        console.log('[SupabaseClient] Rede restabelecida. Resetando flag de indisponibilidade.');
        supabaseUnavailable = false;
    });
}
