// Cliente Supabase - Mini Torneio (Bolão)
// Conexão unificada com o banco de dados principal do Futebol Milhão

const SUPABASE_URL = window.FM_CONFIG?.supabase?.url || 
                     (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || 
                     'https://yepleajrpynexloacxcg.supabase.co';

const SUPABASE_KEY = window.FM_CONFIG?.supabase?.publishableKey || 
                     (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY) || 
                     'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllcGxlYWpycHluZXhsb2FjeGNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3MzYyODQsImV4cCI6MjA5MzMxMjI4NH0.3Ky5IO-3W9uhm4B8wid_iwwAXZpxd9wepCtd_yxIdJI';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
window.supabaseClient = supabase;
