import { setStoredUser } from '../../stores/session-store.js';
import { USER_ROLES, isAdminRole } from '../../shared/constants/roles.js';
import { initDB, getSupabaseClient } from '../../services/supabase.service.js';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const usernameInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password');
    const roleSelect = document.getElementById('login-role');
    const loginButton = document.getElementById('login-button');
    const btnText = document.getElementById('btn-text');
    const errorMessageDiv = document.getElementById('error-message');

    if (!loginForm || !usernameInput || !passwordInput || !roleSelect || !loginButton || !errorMessageDiv) {
        return;
    }

    // Attempt to load Supabase client initialization if needed
    if (typeof initDB === 'function') {
        initDB().catch(console.warn);
    }

    // Role select dynamic changes
    roleSelect.addEventListener('change', () => {
        const isAdmin = roleSelect.value === 'Administrador';
        btnText.textContent = isAdmin ? 'Acesso Administrativo' : 'Entrar no Jogo';
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
        const password = passwordInput.value;

        if (!username || !password) {
            showError('Por favor, preencha todos os campos.');
            return;
        }

        try {
            const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : window.supabaseClient;
            if (!client) {
                throw new Error('Erro de conexão com servidor. Recarregue a página.');
            }
            
            // 1. Buscar o e-mail vinculado ao username via RPC
            const { data: email, error: rpcError } = await client.rpc('get_email_by_username', { p_username: username });

            if (rpcError) {
                console.error("RPC erro:", rpcError);
                throw new Error('Erro ao buscar dados do usuário. Tente novamente.');
            }

            if (!email) {
                throw new Error('Usuário não encontrado. Verifique seu apelido ou cadastre-se.');
            }

            // 2. Autenticar no Supabase Auth com o e-mail encontrado
            const { data, error } = await client.auth.signInWithPassword({ email, password });
            
            if (error || !data.user) {
                console.error("Login erro:", error);
                throw new Error('Senha incorreta. Tente novamente.');
            }

            // 3. Buscar a role e dados do perfil no banco
            const { data: profileData, error: profileError } = await client
                .from('fm_perfis')
                .select('role, full_name, username, phone, avatar_url')
                .eq('auth_id', data.user.id)
                .single();
                
            let userRole = profileData ? profileData.role : USER_ROLES.player;
            let userFullName = profileData ? profileData.full_name : data.user.user_metadata?.name || 'Jogador';
            let userName = profileData ? profileData.username : username;

            // 4. Validação de Admin
            if (role === 'Administrador' && !isAdminRole(userRole)) {
                await client.auth.signOut();
                throw new Error('Acesso negado. Esta conta não possui privilégios de administrador.');
            }

            // 5. Sucesso -> Salvar fallback local e redirecionar
            setStoredUser({
                id: data.user.id,
                username: userName,
                full_name: userFullName,
                email: email,
                phone: profileData?.phone || null,
                role: userRole,
                avatar_url: profileData?.avatar_url || null
            });

            // Notificar OneSignal para reidentificar usuário
            window.dispatchEvent(new CustomEvent('fm:user-logged-in', {
              detail: { username: userName, role: userRole }
            }));

            // Redireciona para o painel principal (onde tem o vídeo stealth)
            window.location.href = 'pages/welcome.html';
            
        } catch (error) {
            console.error('Erro no fluxo de login:', error);
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
