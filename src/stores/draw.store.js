/**
 * @file src/stores/draw.store.js
 * @description Store reativo para sorteios (draws)
 */

import { createStore } from './reactive-store.js';

const initialState = {
  draws: [],            // Lista de draws
  byMatchId: {},       // Map: matchId -> draws[]
  loading: false,
  error: null,
  drawInProgress: null, // Draw em progresso
};

const drawStore = createStore(initialState);

/**
 * Define lista de draws
 */
export function setDraws(draws) {
  drawStore.set('draws', draws || []);
  // Indexa por matchId
  const byMatchId = {};
  (draws || []).forEach(draw => {
    if (!byMatchId[draw.match_id]) {
      byMatchId[draw.match_id] = [];
    }
    byMatchId[draw.match_id].push(draw);
  });
  drawStore.set('byMatchId', byMatchId);
}

/**
 * Obtém lista de draws
 */
export function getDraws() {
  return drawStore.get('draws') || [];
}

/**
 * Obtém draws de um match
 */
export function getDrawsByMatchId(matchId) {
  return drawStore.get('byMatchId')?.[matchId] || [];
}

/**
 * Adiciona draw
 */
export function addDraw(draw) {
  const draws = getDraws();
  const exists = draws.find(d => d.id === draw.id);
  if (!exists) {
    setDraws([...draws, draw]);
  }
}

/**
 * Remove draw
 */
export function removeDraw(drawId) {
  const draws = getDraws();
  setDraws(draws.filter(d => d.id !== drawId));
}

/**
 * Atualiza draw
 */
export function updateDraw(drawId, updates) {
  const draws = getDraws();
  const index = draws.findIndex(d => d.id === drawId);
  if (index !== -1) {
    draws[index] = { ...draws[index], ...updates };
    setDraws([...draws]);
  }
}

/**
 * Define draw em progresso
 */
export function setDrawInProgress(draw) {
  drawStore.set('drawInProgress', draw);
}

/**
 * Obtém draw em progresso
 */
export function getDrawInProgress() {
  return drawStore.get('drawInProgress');
}

/**
 * Limpa draw em progresso
 */
export function clearDrawInProgress() {
  drawStore.set('drawInProgress', null);
}

/**
 * Define loading
 */
export function setDrawLoading(loading) {
  drawStore.set('loading', loading);
}

/**
 * Obtém loading
 */
export function isDrawLoading() {
  return drawStore.get('loading');
}

/**
 * Define erro
 */
export function setDrawError(error) {
  drawStore.set('error', error);
}

/**
 * Obtém erro
 */
export function getDrawError() {
  return drawStore.get('error');
}

/**
 * Se inscreve para mudanças
 */
export function subscribeToDraw(callback) {
  return drawStore.subscribe(() => {
    callback({
      draws: drawStore.get('draws'),
      loading: drawStore.get('loading'),
      error: drawStore.get('error'),
      drawInProgress: drawStore.get('drawInProgress'),
    });
  });
}

/**
 * Reseta store
 */
export function resetDrawStore() {
  drawStore.reset();
}

export default drawStore;
