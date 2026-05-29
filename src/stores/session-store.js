import { SESSION_KEYS } from '../shared/constants/storage-keys.js';

function getSession() {
  return typeof window !== 'undefined' ? window.sessionStorage : null;
}

function readJson(key, fallback = null) {
  const session = getSession();
  if (!session) return fallback;

  const raw = session.getItem(key);
  if (!raw) return fallback;

  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`[session-store] Invalid JSON for "${key}".`, error);
    return fallback;
  }
}

function writeJson(key, value) {
  const session = getSession();
  if (!session) return;
  session.setItem(key, JSON.stringify(value));
}

function getValue(key, fallback = null) {
  const session = getSession();
  return session?.getItem(key) ?? fallback;
}

function setValue(key, value) {
  const session = getSession();
  if (!session) return;
  session.setItem(key, value);
}

function removeValue(key) {
  const session = getSession();
  if (!session) return;
  session.removeItem(key);
}

export function getStoredUser() {
  return readJson(SESSION_KEYS.currentUser, null);
}

export function setStoredUser(user) {
  writeJson(SESSION_KEYS.currentUser, user);
}

export function clearStoredUser() {
  removeValue(SESSION_KEYS.currentUser);
}

export function getSelectedMatchId() {
  return getValue(SESSION_KEYS.selectedMatchId);
}

export function setSelectedMatchId(matchId) {
  setValue(SESSION_KEYS.selectedMatchId, matchId);
}

export function clearSelectedMatchId() {
  removeValue(SESSION_KEYS.selectedMatchId);
}

export function getEditMatchId() {
  return getValue(SESSION_KEYS.editMatchId);
}

export function setEditMatchId(matchId) {
  setValue(SESSION_KEYS.editMatchId, matchId);
}

export function clearEditMatchId() {
  removeValue(SESSION_KEYS.editMatchId);
}

export function hasPaymentModalShown() {
  return getValue(SESSION_KEYS.paymentModalShown) === 'true';
}

export function markPaymentModalShown() {
  setValue(SESSION_KEYS.paymentModalShown, 'true');
}

export function getVotingNotificationShown() {
  return readJson(SESSION_KEYS.votingNotificationShown, null);
}

export function markVotingNotificationShown(matchIds, timestamp = Date.now()) {
  writeJson(SESSION_KEYS.votingNotificationShown, {
    matchIds,
    timestamp,
  });
}

export function clearVotingNotificationShown() {
  removeValue(SESSION_KEYS.votingNotificationShown);
}

export function shouldSkipVotingNotification(matchIds, ttlMs = 300000) {
  const shownData = getVotingNotificationShown();
  if (!shownData) return false;

  return (
    shownData.matchIds === matchIds &&
    Date.now() - Number(shownData.timestamp || 0) < ttlMs
  );
}

export const sessionStore = Object.freeze({
  getStoredUser,
  setStoredUser,
  clearStoredUser,
  getSelectedMatchId,
  setSelectedMatchId,
  clearSelectedMatchId,
  getEditMatchId,
  setEditMatchId,
  clearEditMatchId,
  hasPaymentModalShown,
  markPaymentModalShown,
  getVotingNotificationShown,
  markVotingNotificationShown,
  clearVotingNotificationShown,
  shouldSkipVotingNotification,
});

if (typeof window !== 'undefined') {
  window.FMSession = sessionStore;
}
