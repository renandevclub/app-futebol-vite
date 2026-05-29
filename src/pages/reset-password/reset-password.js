import { initDB, getSupabaseClient } from '../../services/supabase.service.js';

function isRecoveryLink() {
  // Verifica se 'type=recovery' está presente em qualquer parte da URL (search ou hash)
  // Isso resolve problemas com redirecionamentos onde o Supabase anexa os parâmetros no hash fragment
  // ou quando o cliente do Supabase consome os tokens e limpa parcialmente a URL.
  return window.location.href.includes('type=recovery');
}

function setError(message) {
  const messageDiv = document.getElementById('reset-message');
  if (!messageDiv) return;
  messageDiv.className = 'error-message';
  messageDiv.textContent = message;
  messageDiv.style.display = 'block';
}

function setSuccess(message) {
  const messageDiv = document.getElementById('reset-message');
  if (!messageDiv) return;
  messageDiv.className = 'success-message';
  messageDiv.textContent = message;
  messageDiv.style.display = 'block';
}

async function updatePassword(client, newPassword) {
  const { data, error } = await client.auth.updateUser({ password: newPassword });
  if (error) {
    console.error('Erro ao atualizar senha:', error);
    throw new Error(error.message || 'Falha ao atualizar a senha. Tente novamente.');
  }

  if (!data?.user) {
    throw new Error('Não foi possível atualizar a senha. Tente novamente.');
  }

  return data.user;
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

  // 1. Inicializa o Supabase primeiro
  if (typeof initDB === 'function') {
    try {
      await initDB();
    } catch (error) {
      console.warn('Erro ao inicializar base de dados:', error);
    }
  }

  const client = getSupabaseClient();
  let hasSession = false;

  if (client) {
    try {
      // 2. Tenta processar e obter a sessão a partir da URL se houver tokens
      // O Supabase consome o access_token/refresh_token do hash e loga o usuário
      const { data } = await client.auth.getSessionFromUrl({ storeSession: true });
      if (data?.session) {
        hasSession = true;
      }
    } catch (error) {
      console.warn('Erro ao processar tokens da URL:', error);
    }

    // 3. Se não obteve da URL diretamente, verifica se já existe uma sessão ativa
    if (!hasSession) {
      try {
        const { data } = await client.auth.getSession();
        if (data?.session) {
          hasSession = true;
        }
      } catch (error) {
        console.warn('Erro ao verificar sessão atual:', error);
      }
    }
  }

  // 4. Se não for um link de recuperação e não tivermos sessão ativa, bloqueamos o formulário
  if (!isRecoveryLink() && !hasSession) {
    setError('Link de recuperação inválido ou expirado. Solicite um novo link em "Esqueci minha senha".');
    form.querySelectorAll('input, button').forEach((field) => (field.disabled = true));
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    messageDiv.style.display = 'none';
    messageDiv.textContent = '';
    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = 'Redefinindo...';

    const password = passwordInput.value.trim();
    const confirmPassword = confirmInput.value.trim();

    if (password.length < 6) {
      setError('A nova senha deve ter pelo menos 6 caracteres.');
      button.disabled = false;
      button.textContent = originalText;
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      button.disabled = false;
      button.textContent = originalText;
      return;
    }

    try {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Supabase não está disponível. Recarregue a página.');
      }

      // Garante que a sessão está ativa (o usuário deve estar autenticado temporariamente pela recuperação)
      const { data } = await client.auth.getSession();
      if (!data?.session) {
        throw new Error('Sessão de recuperação expirada ou inválida. Solicite um novo link.');
      }

      // Atualiza a senha do usuário autenticado na sessão atual
      await updatePassword(client, password);

      setSuccess('Senha redefinida com sucesso! Redirecionando para o login...');
      setTimeout(() => {
        window.location.href = '/index.html';
      }, 2200);
    } catch (error) {
      setError(error?.message || 'Erro ao redefinir a senha. Tente novamente.');
      button.disabled = false;
      button.textContent = originalText;
    }
  });
}

document.addEventListener('DOMContentLoaded', init);

