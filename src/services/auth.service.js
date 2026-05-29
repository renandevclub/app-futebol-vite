/**
 * @file src/services/auth.service.js
 * @description Serviço de autenticação refatorado
 * Re-exporta implementações profissionais mantendo compatibilidade
 */

export {
  checkAccess,
  clearCurrentUser,
  getCurrentSession,
  getCurrentUser,
  isCurrentUserAdmin,
  isCurrentUserVisitor,
  loginWithPassword,
  logout,
  setCurrentUser,
  shouldRedirectToLogin,
} from './impl/auth.service.js';

/**
 * Compatibilidade com código legado
 * Re-exporta do auth-guard.js antigo (ainda funciona)
 */
export {
  checkAccess,
  checkPaymentStatus,
  clearCurrentUser,
  getCurrentUser,
  getUserProfile,
  isAdminUser,
  isVisitorUser,
  redirectToLogin,
  requireAdmin,
  requireAuth,
} from '../core/auth-guard.js';
