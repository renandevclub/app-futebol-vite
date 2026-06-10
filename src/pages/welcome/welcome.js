document.addEventListener('DOMContentLoaded', () => {
    const carousel = document.querySelector('.carousel-inner');
    if (carousel) {
        const items = carousel.querySelectorAll('.carousel-item');
        const totalItems = items.length;
        let currentIndex = 0;

        // Função para trocar o slide
        function showNextSlide() {
            // Calcula o próximo índice
            const nextIndex = (currentIndex + 1) % totalItems;
            
            // Move o carrossel para a esquerda
            carousel.style.transform = `translateX(-${nextIndex * 100}%)`;
            
            // Atualiza o índice atual
            currentIndex = nextIndex;
        }

        // Inicia a troca automática a cada 4 segundos (4000 milissegundos)
        setInterval(showNextSlide, 4000);
    }

    // Configura botão do WhatsApp com link dinâmico do banco de dados
    async function setupWhatsappButton() {
        const btnJoinWhatsapp = document.getElementById('btn-join-whatsapp');
        if (btnJoinWhatsapp) {
            try {
                const link = await getConfig('whatsapp_group_link');
                if (link) {
                    btnJoinWhatsapp.href = link;
                }
            } catch (error) {
                console.error("Erro ao carregar link do WhatsApp", error);
            }
        }
    }

    // Modal para novos usuários Google definirem seu apelido oficial de jogador
    async function checkGoogleUserNickname() {
        if (typeof FMModal === 'undefined' || typeof window.getCurrentUser !== 'function') return;

        const user = window.getCurrentUser();
        if (!user || user.role === 'visitor' || window.isVisitorUser()) return;

        // Se o apelido já foi personalizado ou se o prompt foi pulado na sessão atual
        if (user.username_customized === true || sessionStorage.getItem('skip_nickname_prompt') === 'true') {
            return;
        }

        const htmlContent = `
            <div class="welcome-nickname-prompt" style="padding: 10px 0; display: flex; flex-direction: column; gap: 16px; text-align: left;">
                <p style="color: var(--text-secondary); font-size: 0.92rem; line-height: 1.5; margin: 0;">
                    Vimos que você entrou com sua conta do Google. Escolha seu apelido oficial de jogador para aparecer corretamente na lista e nos sorteios de times de futebol:
                </p>
                <div style="display: flex; flex-direction: column; gap: 6px;">
                    <label for="prompt-new-username" style="color: var(--text-main); font-weight: 600; font-size: 0.88rem; display: block; text-align: left;">Meu Apelido</label>
                    <input type="text" id="prompt-new-username" value="${user.username || ''}" placeholder="Ex: Pedrinho, Renan.L" 
                        style="background: rgba(6, 9, 19, 0.6); border: 1px solid var(--border-subtle); border-radius: 8px; color: var(--text-main); padding: 12px 16px; font-size: 0.95rem; outline: none; width: 100%; box-sizing: border-box;" />
                    <span id="prompt-username-error" style="color: #fca5a5; font-size: 0.78rem; display: none; margin-top: 4px;"></span>
                </div>
                <div style="display: flex; gap: 12px; margin-top: 10px; width: 100%;">
                    <button id="btn-prompt-skip" style="flex: 1; padding: 12px; border-radius: 8px; border: 1px solid var(--border-subtle); background: transparent; color: var(--text-secondary); font-weight: 600; cursor: pointer; transition: 0.2s;">Depois</button>
                    <button id="btn-prompt-save" style="flex: 2; padding: 12px; border-radius: 8px; border: none; background: linear-gradient(135deg, var(--accent-primary), var(--accent-blue)); color: #000; font-weight: 700; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 12px rgba(0, 255, 135, 0.2);">Salvar Apelido</button>
                </div>
            </div>
        `;

        // Exibe o modal com prioridade e previne fechamento indesejado
        FMModal.show({
            id: 'nickname_prompt_modal',
            type: 'info',
            title: '⚽ Seu Apelido do Futebol',
            html: htmlContent,
            width: '420px',
            closeOnBackdrop: false,
            closeOnEsc: false,
            actions: []
        });

        // Configurar eventos no DOM injetado do modal
        setTimeout(() => {
            const btnSkip = document.getElementById('btn-prompt-skip');
            const btnSave = document.getElementById('btn-prompt-save');
            const inputUsername = document.getElementById('prompt-new-username');
            const spanError = document.getElementById('prompt-username-error');

            if (btnSkip) {
                btnSkip.addEventListener('click', () => {
                    sessionStorage.setItem('skip_nickname_prompt', 'true');
                    FMModal.closeById('nickname_prompt_modal');
                });
            }

            if (btnSave && inputUsername && spanError) {
                btnSave.addEventListener('click', async () => {
                    const newUsername = inputUsername.value.trim();
                    spanError.style.display = 'none';

                    if (!newUsername) {
                        spanError.textContent = 'O apelido é obrigatório.';
                        spanError.style.display = 'block';
                        return;
                    }

                    if (newUsername.length < 3 || newUsername.length > 20) {
                        spanError.textContent = 'O apelido deve ter entre 3 e 20 caracteres.';
                        spanError.style.display = 'block';
                        return;
                    }

                    if (!/^[a-zA-Z0-9._]+$/.test(newUsername)) {
                        spanError.textContent = 'Apenas letras, números, pontos (.) e sublinhados (_). Sem espaços ou acentos.';
                        spanError.style.display = 'block';
                        return;
                    }

                    btnSave.disabled = true;
                    btnSkip.disabled = true;
                    const originalText = btnSave.textContent;
                    btnSave.textContent = 'Salvando...';

                    try {
                        const client = typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : window.supabaseClient;
                        if (!client) {
                            throw new Error('Supabase client não inicializado.');
                        }

                        const { error } = await client.rpc('update_user_nickname', {
                            p_new_username: newUsername,
                            p_new_full_name: user.full_name || null,
                            p_new_phone: user.phone || null
                        });

                        if (error) {
                            throw error;
                        }

                        // Atualiza a sessão
                        user.username = newUsername;
                        user.username_customized = true;
                        if (window.FMSession && window.FMSession.setStoredUser) {
                            window.FMSession.setStoredUser(user);
                        }

                        FMModal.closeById('nickname_prompt_modal');
                        FMModal.success('Apelido cadastrado com sucesso! Bom jogo!');

                    } catch (err) {
                        console.error('Erro ao salvar apelido no prompt:', err);
                        spanError.textContent = err.message || 'Erro ao salvar apelido. Tente novamente.';
                        spanError.style.display = 'block';
                        btnSave.disabled = false;
                        btnSkip.disabled = false;
                        btnSave.textContent = originalText;
                    }
                });
            }
        }, 100);
    }

    setupWhatsappButton();
    checkGoogleUserNickname();
});
