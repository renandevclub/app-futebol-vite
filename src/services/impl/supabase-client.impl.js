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
        futebolSupabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
        window.supabaseClient = futebolSupabaseClient; // Expose globally for auth and scripts
    }

    return futebolSupabaseClient;
}

export async function runSupabaseQuery(operation, fallbackValue) {
    const client = getSupabaseClient();
    if (!client) return fallbackValue;

    try {
        return await operation(client);
    } catch (error) {
        console.warn('Supabase indisponivel, usando fallback local:', error);
        supabaseUnavailable = true;
        return fallbackValue;
    }
}

export function setSupabaseUnavailable(status) {
    supabaseUnavailable = status;
}

export function isSupabaseUnavailable() {
    return supabaseUnavailable;
}
