import { setStoredUser } from '../../stores/session-store.js';
import { USER_ROLES, isAdminRole } from '../../shared/constants/roles.js';
import { initDB, getSupabaseClient } from '../../services/supabase.service.js';

// Redireciona fluxos de recuperação de senha (?code= ou #type=recovery) para a página correta
// antes que o cliente do Supabase na home tente consumir o código de uso único
(function handlePasswordRecoveryRedirect() {
    if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        const hasCode = url.searchParams.has('code');
        const hasRecoveryHash = url.hash.includes('type=recovery');

        if (hasCode || hasRecoveryHash) {
            console.log('[Login] Detectado link de recuperação de senha. Redirecionando...');
            const targetUrl = new URL('pages/reset-password.html', window.location.origin);
            targetUrl.search = window.location.search;
            targetUrl.hash = window.location.hash;
            window.location.replace(targetUrl.toString());
        }
    }
})();

document.addEventListener('DOMContentLoaded', () => {
    // Limpa sessões anteriores ao carregar a página de login para evitar conflito de cache
    sessionStorage.removeItem('player_session');
    try {
        clearStoredUser();
    } catch (e) {
        console.warn('Erro ao limpar dados locais do usuário:', e);
    }

    const loginForm = document.getElementById('login-form');
    const usernameInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password');
    const roleSelect = document.getElementById('login-role');
    const loginButton = document.getElementById('login-button');
    const btnText = document.getElementById('btn-text');
    const errorMessageDiv = document.getElementById('error-message');
    const phoneInput = document.getElementById('login-phone');
    const phoneGroup = document.getElementById('phone-group');
    const passwordGroup = document.getElementById('password-group');
    const usernameLabel = document.getElementById('login-username-label');

    if (!loginForm || !usernameInput || !passwordInput || !roleSelect || !loginButton || !errorMessageDiv) {
        return;
    }

    // Lógica para abas (tabs) de seleção de perfil (Jogador vs Administrador)
    const roleTabs = document.querySelectorAll('.role-tab');
    roleTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            roleTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const selectedRole = tab.getAttribute('data-role');
            roleSelect.value = selectedRole;
            
            // Dispara o evento change no select original para atualizar o texto do botão
            roleSelect.dispatchEvent(new Event('change'));
        });
    });

    // Attempt to load Supabase client initialization if needed
    if (typeof initDB === 'function') {
        initDB().catch(console.warn);
    }

    // Role select dynamic changes
    roleSelect.addEventListener('change', () => {
        const isAdmin = roleSelect.value === 'Administrador';
        btnText.textContent = isAdmin ? 'Acesso Administrativo' : 'Entrar no Jogo';
        
        if (isAdmin) {
            if (phoneGroup) phoneGroup.style.display = 'none';
            if (passwordGroup) passwordGroup.style.display = 'block';
            if (passwordInput) passwordInput.required = true;
            if (phoneInput) phoneInput.required = false;
            if (usernameLabel) usernameLabel.textContent = 'E-mail';
            if (usernameInput) {
                usernameInput.placeholder = 'Seu e-mail';
                usernameInput.type = 'email';
                usernameInput.autocomplete = 'email';
            }
        } else {
            if (phoneGroup) phoneGroup.style.display = 'block';
            if (passwordGroup) passwordGroup.style.display = 'none';
            if (passwordInput) {
                passwordInput.required = false;
                passwordInput.value = '';
            }
            if (phoneInput) phoneInput.required = true;
            if (usernameLabel) usernameLabel.textContent = 'Nome';
            if (usernameInput) {
                usernameInput.placeholder = 'Digite seu nome';
                usernameInput.type = 'text';
                usernameInput.autocomplete = 'name';
            }
        }
    });

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        
        // Reset state
        errorMessageDiv.textContent = '';
        errorMessageDiv.style.display = 'none';
        loginButton.disabled = true;
        const originalText = btnText.textContent;
        btnText.textContent = 'Autenticando...';

        const role = roleSelect.value;
        const username = usernameInput.value.trim();
        const phoneVal = phoneInput ? phoneInput.value.trim().replace(/\D/g, '') : '';
        const password = passwordInput.value;

        // FLUXO DO JOGADOR: Salva sessão local simplificada e redireciona
        if (role === 'Jogador') {
            if (!username || username.length < 2) {
                showError('Por favor, preencha o seu nome (mínimo de 2 caracteres).');
                return;
            }
            if (!phoneVal) {
                showError('Por favor, preencha o seu número de WhatsApp.');
                return;
            }

            try {
                // Limpa qualquer sessão de administrador anterior
                try {
                    clearStoredUser();
                } catch (e) {}

                let profileId = null;
                let finalUsername = username;

                // Registra o usuário no Supabase se o cliente estiver disponível
                const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
                if (client) {
                    // Garante que o Supabase Auth anterior esteja limpo
                    await client.auth.signOut().catch(() => {});
                    btnText.textContent = 'Validando acesso...';
                    const { data, error } = await client.rpc('register_player_access', {
                        p_username: username,
                        p_phone: phoneVal,
                        p_match_id: null,
                        p_action: 'user_access',
                        p_user_agent: navigator.userAgent
                    });
                    if (error) {
                        console.error('Erro ao registrar perfil de acesso no servidor:', error);
                        showError(error.message || 'Erro ao validar acesso do jogador.');
                        return;
                    }
                    if (data) {
                        profileId = data.profile_id;
                        finalUsername = data.username || username;
                    }
                }

                sessionStorage.setItem('player_session', JSON.stringify({
                    id: profileId,
                    nome: finalUsername,
                    telefone: phoneVal,
                    tipo: 'jogador'
                }));

                btnText.textContent = 'Entrando...';
                window.location.href = 'pages/welcome.html';
            } catch (err) {
                console.error(err);
                showError('Erro ao criar sessão local de jogador.');
            }
            return;
        }

        // FLUXO DO ADMINISTRADOR: Usa Supabase Auth
        if (!username || !password) {
            showError('Por favor, preencha todos os campos.');
            return;
        }

        try {
            const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : window.supabaseClient;
            if (!client) {
                throw new Error('Erro de conexão com servidor. Recarregue a página.');
            }
            
            // Limpa qualquer sessão local de jogador anterior
            sessionStorage.removeItem('player_session');
            
            // Administrador loga com email e senha no Supabase Auth
            const { data, error } = await client.auth.signInWithPassword({ email: username.toLowerCase(), password });
            
            if (error || !data.user) {
                console.error("Login erro:", error);
                throw new Error('Senha incorreta ou usuário não encontrado.');
            }

            // Buscar a role e dados do perfil no banco
            const { data: profileData, error: profileError } = await client
                .from('fm_perfis')
                .select('role, full_name, username, phone, avatar_url')
                .eq('auth_id', data.user.id)
                .single();
                
            let userRole = profileData ? profileData.role : USER_ROLES.player;
            let userFullName = profileData ? profileData.full_name : data.user.user_metadata?.name || 'Jogador';
            let userName = profileData ? profileData.username : username;

            // Validação de Admin
            if (role === 'Administrador' && !isAdminRole(userRole)) {
                await client.auth.signOut();
                throw new Error('Acesso negado. Esta conta não possui privilégios de administrador.');
            }

            // Sucesso -> Salvar fallback local e redirecionar
            setStoredUser({
                id: data.user.id,
                username: userName,
                full_name: userFullName,
                email: username.toLowerCase(),
                phone: profileData?.phone || null,
                role: userRole,
                avatar_url: profileData?.avatar_url || null
            });

            // Notificar OneSignal para reidentificar usuário
            window.dispatchEvent(new CustomEvent('fm:user-logged-in', {
              detail: { username: userName, role: userRole }
            }));

            // Redireciona para o painel principal
            window.location.href = 'pages/welcome.html';
            
        } catch (error) {
            console.error('Erro no fluxo de login administrativo:', error);
            showError(error.message || 'Não foi possível completar o login. Tente novamente.');
        }

        function showError(msg) {
            errorMessageDiv.textContent = msg;
            errorMessageDiv.style.display = 'block';
            loginButton.disabled = false;
            btnText.textContent = originalText;
        }
    });

    // Login com o Google (OAuth)
    const googleLoginBtn = document.getElementById('google-login-btn');
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', async () => {
            errorMessageDiv.textContent = '';
            errorMessageDiv.style.display = 'none';
            googleLoginBtn.disabled = true;
            
            try {
                const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : window.supabaseClient;
                if (!client) {
                    throw new Error('Erro de conexão com servidor. Recarregue a página.');
                }
                
                const redirectUrl = `${window.location.origin}/pages/welcome.html`;
                const { error } = await client.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                        redirectTo: redirectUrl
                    }
                });
                
                if (error) {
                    throw error;
                }
            } catch (error) {
                console.error('Erro ao fazer login com o Google:', error);
                errorMessageDiv.textContent = error.message || 'Não foi possível completar o login com o Google. Tente novamente.';
                errorMessageDiv.style.display = 'block';
                googleLoginBtn.disabled = false;
            }
        });
    }
});
