/**
 * @file src/components/ui/index.js
 * @description UI Component Library — Futebol Milhão Premium
 * 
 * Componentes disponíveis:
 *   - component.js: Base factory (createElement, fragment, qs, qsa)
 *   - toast.js: Sistema de toast notifications
 */

export { createElement, fragment, qs, qsa } from './component.js';
export { toast, showToast, dismissToast, dismissAll } from './toast.js';
export { initConnectionIndicator } from './connection-indicator.js';

/**
 * Namespace aggregado para acesso centralizado
 */
export const UI = {
  createElement: () => import('./component.js').then(m => m.createElement),
  fragment: () => import('./component.js').then(m => m.fragment),
  toast: () => import('./toast.js').then(m => m.toast),
  connectionIndicator: () => import('./connection-indicator.js').then(m => m.initConnectionIndicator),
};
