import { clearStoredUser, getStoredUser, setStoredUser } from '../stores/session-store.js';
import { VISITOR_ALLOWED_PAGES as ROUTE_VISITOR_ALLOWED_PAGES } from '../shared/constants/routes.js';
import { USER_ROLES, isAdminRole, isVisitorRole } from '../shared/constants/roles.js';
import { initDB, getSupabaseClient } from '../services/supabase.service.js';
import { getPlayerPaymentStatus } from '../services/payment.service.js';

async function getUserProfile(userId) {
  const client = getSupabaseClient();
  if (!client) return { role: USER_ROLES.player, username: null, full_name: null, phone: null, avatar_url: null, username_customized: false };

  const { data, error } = await client
    .from("fm_perfis")
    .select("role, username, full_name, phone, avatar_url, username_customized")
    .eq("auth_id", userId)
    .single();

  if (error || !data) {
      console.error("Erro ao buscar perfil:", error);
      return { role: USER_ROLES.player, username: null, full_name: null, phone: null, avatar_url: null, username_customized: false };
  }
  return { 
    role: data.role, 
    username: data.username, 
    full_name: data.full_name, 
    phone: data.phone || null,
    avatar_url: data.avatar_url || null,
    username_customized: data.username_customized || false
  };
}

async function checkPaymentStatus() {
  const user = getCurrentUser();
  if (!user?.id) return null;

  try {
    const payment = await getPlayerPaymentStatus(user.id);
    if (!payment) return null;

    if (!payment.confirmed && window.location.pathname.endsWith('payment.html')) {
      window.location.href = window.location.pathname.includes('/pages/') ? 'welcome.html' : 'pages/welcome.html';
      return payment;
    }

    if (payment.confirmed === true && payment.payment_status !== 'paid') {
      if (!window.location.pathname.endsWith('payment.html')) {
        const result = await FMModal.show({
          type: 'admin',
          title: 'Pagamento pendente',
          message: 'Você está confirmado para o jogo, mas ainda não realizou o pagamento da coleta.',
          closeOnBackdrop: true,
          closeOnEsc: true,
          closeButton: true,
          actions: [
            {
              id: 'close',
              label: 'Mais tarde',
              variant: 'secondary',
              value: false,
            },
            {
              id: 'pay',
              label: 'Ir para pagamento',
              variant: 'primary',
              value: true,
            },
          ],
        });

        if (result?.action === 'pay') {
          window.location.href = window.location.pathname.includes('/pages/') ? 'payment.html' : 'pages/payment.html';
        }
      }
    }

    return payment;
  } catch (error) {
    console.error('Erro ao checar status de pagamento:', error);
    return null;
  }
}

window.checkPaymentStatus = checkPaymentStatus;

/**
 * Verifica se o usuário logado é visitante.
 */
function isVisitorUser() {
    const user = getCurrentUser();
    return isVisitorRole(user?.role);
}

/**
 * Lista de páginas que visitantes podem acessar.
 */
const VISITOR_ALLOWED_PAGES = [
    'welcome.html',
    'dashboard.html',
    'details.html',
    'placar-ao-vivo.html'
];

/**
 * Lista de páginas que exigem role admin.
 */
const ADMIN_ONLY_PAGES = [
    'admin-placar.html',
    'schedule.html',
    'financials.html'
];

async function checkAccess(requiredRole) {
  const isNestedPage = window.location.pathname.includes('/pages/');
  const loginPath = isNestedPage ? "../index.html" : "index.html";
  const welcomePath = isNestedPage ? "welcome.html" : "pages/welcome.html";
  const currentPage = window.location.pathname.split('/').pop() || '';

  // 1. Verificar se existe a sessão local de Jogador (sem Supabase Auth)
  const playerSessionRaw = sessionStorage.getItem('player_session');
  if (playerSessionRaw) {
    try {
      const player = JSON.parse(playerSessionRaw);
      const currentUserData = {
        id: player.id || player.nome,
        username: player.nome,
        full_name: player.nome,
        phone: player.telefone || null,
        role: USER_ROLES.player, // 'user'
        avatar_url: null,
        is_player_session: true,
        username_customized: true
      };
      
      // Salva no store para compatibilidade com getCurrentUser()
      setStoredUser(currentUserData);

      // Bloquear se tentar acessar página de Admin
      const isAdminPage = ADMIN_ONLY_PAGES.some(p => currentPage.includes(p));
      if (isAdminPage || requiredRole === 'admin') {
        await FMModal.admin({
          title: 'Acesso negado',
          message: 'Você não tem permissão para acessar esta área.',
          priority: 90
        });
        window.location.href = welcomePath;
        return null;
      }

      return currentUserData;
    } catch (e) {
      console.error('Erro ao processar player_session:', e);
    }
  }

  // 2. Fluxo do Administrador via Supabase Auth
  const client = getSupabaseClient();
  if (!client) {
    window.location.href = loginPath;
    return null;
  }

  const { data: { user }, error } = await client.auth.getUser();

  if (!user || error) {
    window.location.href = loginPath;
    return null;
  }

  const profile = await getUserProfile(user.id);

  // Se o usuário logado no Supabase NÃO for admin e tentar acessar página admin
  const isAdminPage = ADMIN_ONLY_PAGES.some(p => currentPage.includes(p));
  if ((isAdminPage || requiredRole === 'admin') && profile.role !== 'admin') {
    await FMModal.admin({
      title: 'Acesso negado',
      message: 'Você não tem permissão para acessar esta área.',
      priority: 90
    });
    window.location.href = welcomePath;
    return null;
  }

  if (requiredRole && profile.role !== requiredRole) {
    await FMModal.admin({
      title: 'Acesso negado',
      message: 'Você não tem permissão para acessar esta área.',
      priority: 90
    });
    window.location.href = welcomePath;
    return null;
  }

  // Salvar dados completos do perfil no sessionStorage
  const currentUserData = {
    id: user.id,
    email: user.email,
    username: profile.username || user.user_metadata?.username || user.user_metadata?.name || 'Jogador',
    full_name: profile.full_name || user.user_metadata?.name || 'Jogador',
    phone: profile.phone || null,
    role: profile.role,
    avatar_url: profile.avatar_url || null,
    username_customized: profile.username_customized || false
  };
  setStoredUser(currentUserData);
  return currentUserData;
}

function redirectToLogin() {
    const isNestedPage = window.location.pathname.includes('/pages/');
    window.location.href = isNestedPage ? '../index.html' : 'index.html';
}

function getCurrentUser() {
    return getStoredUser();
}

function isAdminUser() {
    return isAdminRole(getCurrentUser()?.role);
}

function clearCurrentUser() {
    clearStoredUser();
}

// Backward compatibility functions
async function requireAuth() {
    return await checkAccess();
}

async function requireAdmin() {
    return await checkAccess('admin');
}

if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', async () => {
        // Ensure DB is initialized so getSupabaseClient() works
        if (typeof initDB === 'function') {
            await initDB();
        }
        
        // Se for a página de login/registro, não obriga auth
        if (window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('register.html') || window.location.pathname === '/' || window.location.pathname.endsWith('Futebol%20Milh%C3%A3o/')) {
            return;
        }

        const currentUser = await checkAccess();
        if (!currentUser) return;

        await checkPaymentStatus();

        // Esconder elementos admin-only
        document.querySelectorAll('[data-admin-only]').forEach((element) => {
            element.style.display = isAdminRole(currentUser.role) ? '' : 'none';
        });

        // Esconder elementos que visitantes não podem ver
        document.querySelectorAll('[data-no-visitor]').forEach((element) => {
            element.style.display = isVisitorRole(currentUser.role) ? 'none' : '';
        });

        // Adicionar badge de visitante no header se aplicável
        if (isVisitorRole(currentUser.role)) {
            document.body.classList.add('is-visitor');
            const header = document.querySelector('.main-header');
            if (header && !header.querySelector('.visitor-badge-header')) {
                const badge = document.createElement('div');
                badge.className = 'visitor-badge-header';
                badge.innerHTML = '<span>👁️ Visitante</span>';
                badge.style.cssText = 'position:fixed;top:8px;right:60px;z-index:999;background:rgba(245,158,11,0.15);color:#fbbf24;padding:4px 12px;border-radius:20px;font-size:0.75rem;font-weight:700;border:1px solid rgba(245,158,11,0.3);backdrop-filter:blur(8px);';
                document.body.appendChild(badge);
            }
        }
    });
}

// MIGRACAO VITE: Expor funções globalmente no window
window.getUserProfile = getUserProfile;
window.isVisitorUser = isVisitorUser;
window.checkAccess = checkAccess;
window.redirectToLogin = redirectToLogin;
window.getCurrentUser = getCurrentUser;
window.isAdminUser = isAdminUser;
window.clearCurrentUser = clearCurrentUser;
window.requireAuth = requireAuth;
window.requireAdmin = requireAdmin;

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
};
