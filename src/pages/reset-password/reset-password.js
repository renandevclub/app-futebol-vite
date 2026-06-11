import { initDB, getSupabaseClient } from '../../services/supabase.service.js';
import { updateCurrentUserPassword } from '../../services/impl/auth.service.js';

const initialUrl = new URL(window.location.href);
const RECOVERY_EVENTS = new Set(['PASSWORD_RECOVERY', 'SIGNED_IN', 'INITIAL_SESSION', 'TOKEN_REFRESHED']);

function getHashParams(url = new URL(window.location.href)) {
  return new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash);
}

function isRecoveryLink(url = initialUrl) {
  const hashParams = getHashParams(url);
  return (
    url.searchParams.has('code') ||
    url.searchParams.get('type') === 'recovery' ||
    hashParams.get('type') === 'recovery' ||
    hashParams.has('access_token') ||
    hashParams.has('refresh_token')
  );
}

function getAuthRedirectError() {
  const sources = [initialUrl.searchParams, getHashParams(initialUrl)];

  for (const params of sources) {
    const description = params.get('error_description');
    const error = params.get('error');
    if (description || error) {
      return (description || error).replace(/\+/g, ' ');
    }
  }

  return '';
}

function setMessage(type, message) {
  const messageDiv = document.getElementById('reset-message');
  if (!messageDiv) return;
  messageDiv.className = type === 'success' ? 'success-message' : 'error-message';
  messageDiv.textContent = message;
  messageDiv.style.display = 'block';
}

function clearMessage(messageDiv) {
  if (!messageDiv) return;
  messageDiv.style.display = 'none';
  messageDiv.textContent = '';
}

function setButtonText(button, text) {
  const label = button?.querySelector('span');
  if (label) {
    label.textContent = text;
    return;
  }
  if (button) button.textContent = text;
}

function setFormDisabled(form, disabled) {
  form?.querySelectorAll('input, button').forEach((field) => {
    field.disabled = disabled;
  });
}

function cleanupRecoveryUrl() {
  const currentUrl = new URL(window.location.href);
  ['code', 'type', 'error', 'error_code', 'error_description'].forEach((param) => {
    currentUrl.searchParams.delete(param);
  });
  window.history.replaceState({}, '', currentUrl.pathname + currentUrl.search);
}

async function readCurrentSession(client) {
  const { data, error } = await client.auth.getSession();
  if (error) {
    console.warn('Erro ao verificar sessão atual:', error);
    return null;
  }
  return data?.session || null;
}

function waitForRecoverySession(client, timeoutMs = 3500) {
  return new Promise((resolve) => {
    let settled = false;
    let subscription = null;
    let timer = null;

    const finish = (session = null) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      subscription?.unsubscribe?.();
      resolve(session);
    };

    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (session && RECOVERY_EVENTS.has(event)) {
        finish(session);
      }
    });
    subscription = data?.subscription || null;
    if (settled) subscription?.unsubscribe?.();

    timer = setTimeout(async () => {
      finish(await readCurrentSession(client));
    }, timeoutMs);
  });
}

async function resolveRecoverySession(client) {
  const redirectError = getAuthRedirectError();
  if (redirectError) {
    throw new Error(`Link inválido ou expirado: ${redirectError}`);
  }

  const currentUrl = new URL(window.location.href);
  const code = currentUrl.searchParams.get('code');

  if (code) {
    const { data, error } = await client.auth.exchangeCodeForSession(code);
    if (error) {
      throw new Error(error.message || 'Não foi possível validar o link de recuperação.');
    }
    if (data?.session) {
      cleanupRecoveryUrl();
      return data.session;
    }
  }

  const existingSession = await readCurrentSession(client);
  if (existingSession) {
    if (window.location.hash) cleanupRecoveryUrl();
    return existingSession;
  }

  if (isRecoveryLink(initialUrl) || isRecoveryLink(currentUrl)) {
    const session = await waitForRecoverySession(client);
    if (session) {
      cleanupRecoveryUrl();
      return session;
    }
  }

  return null;
}

async function init() {
  const form = document.getElementById('reset-password-form');
  const passwordInput = document.getElementById('new-password');
  const confirmInput = document.getElementById('confirm-password');
  const button = document.getElementById('reset-password-btn');
  const messageDiv = document.getElementById('reset-message');

  if (!form || !passwordInput || !confirmInput || !button || !messageDiv) {
    return;
  }

  if (typeof initDB === 'function') {
    try {
      await initDB();
    } catch (error) {
      console.warn('Erro ao inicializar base de dados:', error);
    }
  }

  const client = getSupabaseClient();
  if (!client) {
    setMessage('error', 'Supabase não está disponível. Recarregue a página e tente novamente.');
    setFormDisabled(form, true);
    return;
  }

  try {
    const session = await resolveRecoverySession(client);
    if (!session) {
      throw new Error('Link de recuperação inválido ou expirado. Solicite um novo link em "Esqueci minha senha".');
    }
  } catch (error) {
    setMessage('error', error?.message || 'Não foi possível validar o link de recuperação.');
    setFormDisabled(form, true);
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    clearMessage(messageDiv);
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    const originalText = button.textContent.trim();
    setButtonText(button, 'Redefinindo...');

    const password = passwordInput.value;
    const confirmPassword = confirmInput.value;

    if (password.length < 6) {
      setMessage('error', 'A nova senha deve ter pelo menos 6 caracteres.');
      button.disabled = false;
      button.removeAttribute('aria-busy');
      setButtonText(button, originalText);
      return;
    }

    if (password !== confirmPassword) {
      setMessage('error', 'As senhas não coincidem.');
      button.disabled = false;
      button.removeAttribute('aria-busy');
      setButtonText(button, originalText);
      return;
    }

    try {
      const activeSession = await readCurrentSession(client);
      if (!activeSession) {
        throw new Error('Sessão de recuperação expirada ou inválida. Solicite um novo link.');
      }

      await updateCurrentUserPassword(password);
      await client.auth.signOut().catch((error) => {
        console.warn('Senha atualizada, mas não foi possível encerrar a sessão temporária:', error);
      });

      setMessage('success', 'Senha redefinida com sucesso! Redirecionando para o login...');
      setTimeout(() => {
        window.location.href = '/index.html';
      }, 2200);
    } catch (error) {
      setMessage('error', error?.message || 'Erro ao redefinir a senha. Tente novamente.');
      button.disabled = false;
      button.removeAttribute('aria-busy');
      setButtonText(button, originalText);
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
