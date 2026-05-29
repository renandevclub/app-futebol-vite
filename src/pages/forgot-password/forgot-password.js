import { initDB, getSupabaseClient } from '../../services/supabase.service.js';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('forgot-password-form');
  const identifierInput = document.getElementById('forgot-identifier');
  const sendButton = document.getElementById('forgot-password-btn');
  const messageDiv = document.getElementById('forgot-error-message');

  if (!form || !identifierInput || !sendButton || !messageDiv) {
    return;
  }

  if (typeof initDB === 'function') {
    initDB().catch(console.warn);
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const originalText = sendButton.textContent;
    const identifier = identifierInput.value.trim();

    messageDiv.style.display = 'none';
    messageDiv.textContent = '';
    sendButton.disabled = true;
    sendButton.textContent = 'Enviando...';

    try {
      if (!identifier) {
        throw new Error('Informe o e-mail ou apelido cadastrado.');
      }

      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Erro de conexão com o Supabase. Recarregue a página.');
      }

      let email = identifier;
      if (!identifier.includes('@')) {
        const { data: lookupEmail, error: lookupError } = await client.rpc('get_email_by_username', {
          p_username: identifier,
        });

        if (lookupError) {
          console.error('Erro no lookup de usuário:', lookupError);
          throw new Error('Erro ao buscar e-mail do usuário. Tente novamente.');
        }

        if (!lookupEmail) {
          throw new Error('Usuário não encontrado. Verifique seu apelido ou use o e-mail cadastrado.');
        }

        email = lookupEmail;
      }

      const redirectTo = `${window.location.origin}/pages/reset-password.html`;
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (error) {
        console.error('Erro ao enviar reset de senha:', error);
        throw new Error(error.message || 'Não foi possível enviar o e-mail de recuperação.');
      }

      messageDiv.className = 'success-message';
      messageDiv.textContent = 'Link enviado! Verifique seu e-mail para redefinir a senha.';
      messageDiv.style.display = 'block';
    } catch (error) {
      console.error('Falha ao recuperar senha:', error);
      messageDiv.className = 'error-message';
      messageDiv.textContent = error?.message || 'Ocorreu um erro ao tentar recuperar a senha.';
      messageDiv.style.display = 'block';
    } finally {
      sendButton.disabled = false;
      sendButton.textContent = originalText;
    }
  });
});
