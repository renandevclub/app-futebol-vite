/**
 * @file globals-bridge.js
 * @description Expõe funções do módulo ES como globais do window
 * para manter compatibilidade com o código legado que usa
 * initDB(), getSupabaseClient(), etc. sem imports.
 */
import { initDB, getSupabaseClient, runSupabaseQuery } from '../../services/supabase.service.js';
import { getAllMatches, deleteMatch, getMatchById, addMatch, updateMatchRoster, playerUpdateMatchData, playerWithdrawFromMatch } from '../../services/match.service.js';
import { getPlayerPaymentStatus, updatePlayerPaymentStatus, getPaymentLinks } from '../../services/payment.service.js';
import { getConfig } from '../../services/config.service.js';
import { playerDrawTeam, getPlayerDrawStatus, releasePlayerDraw } from '../../services/draw.service.js';
import { getStoredUser } from '../../stores/session-store.js';

// Legacy Auth Aliases
window.getCurrentStoredUser = getStoredUser;
window.getCurrentUser = getStoredUser;

// Supabase core
window.initDB = initDB;
window.getSupabaseClient = getSupabaseClient;
window.runSupabaseQuery = runSupabaseQuery;

// Match service
window.getAllMatches = getAllMatches;
window.deleteMatch = deleteMatch;
window.getMatchById = getMatchById;
window.addMatch = addMatch;
window.updateMatchRoster = updateMatchRoster;
window.playerUpdateMatchData = playerUpdateMatchData;
window.playerWithdrawFromMatch = playerWithdrawFromMatch;

// Payment service
window.getPlayerPaymentStatus = getPlayerPaymentStatus;
window.getPaymentLinks = getPaymentLinks;

// Config service
window.getConfig = getConfig;

// Draw service
window.playerDrawTeam = playerDrawTeam;
window.getPlayerDrawStatus = getPlayerDrawStatus;
window.releasePlayerDraw = releasePlayerDraw;

// Payment updates
window.updatePlayerPaymentStatus = updatePlayerPaymentStatus;
