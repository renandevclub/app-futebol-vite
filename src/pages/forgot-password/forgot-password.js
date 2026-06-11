import { initDB, getSupabaseClient } from '../../services/supabase.service.js';
import { requestPasswordReset } from '../../services/impl/auth.service.js';

function setButtonText(button, text) {
  const label = button?.querySelector('span');
  if (label) {
    label.textContent = text;
    return;
  }
  if (button) button.textContent = text;
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('forgot-password-form');
  const identifierInput = document.getElementById('forgot-identifier');
  const sendButton = document.getElementById('forgot-password-btn');
  const messageDiv = document.getElementById('forgot-error-message');

  if (!form || !identifierInput || !sendButton || !messageDiv) {
    return;
  }

  const readyPromise = typeof initDB === 'function'
    ? initDB().catch((error) => {
        console.warn('Erro ao inicializar Supabase:', error);
        return null;
      })
    : Promise.resolve(null);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const originalText = sendButton.textContent.trim();
    const identifier = identifierInput.value.trim();

    messageDiv.style.display = 'none';
    messageDiv.textContent = '';
    sendButton.disabled = true;
    sendButton.setAttribute('aria-busy', 'true');
    setButtonText(sendButton, 'Enviando...');

    try {
      if (!identifier) {
        throw new Error('Informe o e-mail ou apelido cadastrado.');
      }

      await readyPromise;
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Erro de conexão com o Supabase. Recarregue a página.');
      }

      let email = identifier.includes('@') ? identifier.toLowerCase() : identifier;
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

      const redirectTo = new URL('/pages/reset-password.html', window.location.origin).toString();
      await requestPasswordReset(email, redirectTo);

      messageDiv.className = 'success-message';
      messageDiv.textContent = 'Link enviado! Verifique seu e-mail para redefinir a senha.';
      messageDiv.style.display = 'block';
    } catch (error) {
      console.error('Falha ao recuperar senha:', error);
      let errorMessage = error?.message || 'Ocorreu um erro ao tentar recuperar a senha.';
      
      // Traduz e formata o erro de Rate Limit (429 - Too Many Requests) do Supabase Auth
      if (errorMessage.includes('For security purposes')) {
        const match = errorMessage.match(/(\d+)\s+seconds/);
        const seconds = match ? match[1] : 'alguns';
        errorMessage = `Por motivos de segurança, você só pode solicitar um novo link de redefinição após ${seconds} segundos. Por favor, aguarde um momento.`;
      }
      
      messageDiv.className = 'error-message';
      messageDiv.textContent = errorMessage;
      messageDiv.style.display = 'block';
    } finally {
      sendButton.disabled = false;
      sendButton.removeAttribute('aria-busy');
      setButtonText(sendButton, originalText);
    }
  });
});
