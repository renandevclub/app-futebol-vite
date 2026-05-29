/**
 * @file src/stores/match.store.js
 * @description Store reativo para matches (partidas)
 */

import { createStore } from './reactive-store.js';

const initialState = {
  current: null,           // Match atual selecionado
  list: [],               // Lista de matches
  loading: false,
  error: null,
  filters: {
    status: null,         // 'draft', 'open', 'closed', 'finished'
    dateRange: null,      // { from, to }
  },
};

const matchStore = createStore(initialState);

/**
 * Define match atual
 */
export function setCurrentMatch(match) {
  matchStore.set('current', match);
}

/**
 * Obtém match atual
 */
export function getCurrentMatch() {
  return matchStore.get('current');
}

/**
 * Limpa match atual
 */
export function clearCurrentMatch() {
  matchStore.set('current', null);
}

/**
 * Define lista de matches
 */
export function setMatches(matches) {
  matchStore.set('list', matches || []);
}

/**
 * Obtém lista de matches
 */
export function getMatches() {
  return matchStore.get('list') || [];
}

/**
 * Adiciona match à lista
 */
export function addMatchToList(match) {
  const matches = getMatches();
  const exists = matches.find(m => m.id === match.id);
  if (!exists) {
    setMatches([...matches, match]);
  }
}

/**
 * Remove match da lista
 */
export function removeMatchFromList(matchId) {
  const matches = getMatches();
  setMatches(matches.filter(m => m.id !== matchId));
}

/**
 * Atualiza match na lista
 */
export function updateMatchInList(matchId, updates) {
  const matches = getMatches();
  const index = matches.findIndex(m => m.id === matchId);
  if (index !== -1) {
    matches[index] = { ...matches[index], ...updates };
    setMatches([...matches]);
  }
}

/**
 * Define loading state
 */
export function setMatchLoading(loading) {
  matchStore.set('loading', loading);
}

/**
 * Obtém loading state
 */
export function isMatchLoading() {
  return matchStore.get('loading');
}

/**
 * Define erro
 */
export function setMatchError(error) {
  matchStore.set('error', error);
}

/**
 * Obtém erro
 */
export function getMatchError() {
  return matchStore.get('error');
}

/**
 * Limpa erro
 */
export function clearMatchError() {
  matchStore.set('error', null);
}

/**
 * Define filtros
 */
export function setMatchFilters(filters) {
  matchStore.set('filters', { ...matchStore.get('filters'), ...filters });
}

/**
 * Filtra matches por status
 */
export function filterMatchesByStatus(status) {
  const matches = getMatches();
  return matches.filter(m => m.status === status);
}

/**
 * Se inscreve para mudanças de matches
 */
export function subscribeToMatches(callback) {
  return matchStore.subscribe(() => {
    callback({
      current: matchStore.get('current'),
      list: matchStore.get('list'),
      loading: matchStore.get('loading'),
      error: matchStore.get('error'),
    });
  });
}

/**
 * Reseta store de matches
 */
export function resetMatchStore() {
  matchStore.reset();
}

export default matchStore;
