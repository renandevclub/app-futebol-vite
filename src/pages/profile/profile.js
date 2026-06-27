import { getStoredUser, setStoredUser } from '../../stores/session-store.js';
import { getPlayerStats } from '../../services/player.service.js';
import { initDB } from '../../services/supabase.service.js';
import { getAllMatches } from '../../services/match.service.js';
import { formatDateBR } from '../../utils/date.js';
import { formatBrazilianPhone } from '../../utils/phone.js';
import { isAdminRole } from '../../shared/constants/roles.js';

document.addEventListener('DOMContentLoaded', async () => {
    await initDB();

    const currentUser = getStoredUser();

    if (!currentUser) {
        document.body.innerHTML = '<h1 style="text-align:center;padding:50px;">Acesso Negado. Faça o login.</h1>';
        return;
    }

    // Elementos da UI
    const avatarInitials = document.getElementById('avatar-initials');
    const profileName = document.getElementById('profile-name');
    const profileRoleBadge = document.getElementById('profile-role-badge');
    const profileMemberSince = document.getElementById('profile-member-since');
    const profileInfoGrid = document.getElementById('profile-info-grid');
    const statsContainer = document.getElementById('player-stats-container');
    const rankingContainer = document.getElementById('player-ranking-container');
    const historyContainer = document.getElementById('match-history-list');
    const achievementsContainer = document.getElementById('achievements-container');

    // Estado de Edição de Perfil
    let isEditing = false;
    const btnEditProfile = document.getElementById('btn-edit-profile');

    if (btnEditProfile) {
        btnEditProfile.addEventListener('click', () => {
            isEditing = !isEditing;
            updateEditButtonState();
            renderPersonalInfo();
        });
    }

    function updateEditButtonState() {
        if (btnEditProfile) {
            btnEditProfile.innerHTML = isEditing 
                ? '<i class="fas fa-times"></i> Cancelar' 
                : '<i class="fas fa-edit"></i> Editar';
            btnEditProfile.className = isEditing 
                ? 'btn-edit-profile editing' 
                : 'btn-edit-profile';
        }
    }

    // Renderização rápida inicial com dados em cache da sessão para UX premium instantânea
    renderHeroCard([]);
    renderPersonalInfo();

    async function loadProfile() {
        try {
            // Sincronizar dados mais recentes do perfil no Supabase
            const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
            if (client && currentUser) {
                try {
                    const { data: dbUser } = await client
                        .from('fm_perfis')
                        .select('*')
                        .eq('username', currentUser.username)
                        .maybeSingle();
                    if (dbUser) {
                        const authUserId = currentUser.auth_id || currentUser.id;
                        Object.assign(currentUser, dbUser);
                        currentUser.id = dbUser.auth_id || authUserId || currentUser.id;
                        setStoredUser(currentUser);
                    }
                } catch (e) {
                    console.warn("Não foi possível sincronizar o perfil com o banco:", e);
                }
            }

            const allMatches = await getAllMatches();
            const endedMatches = allMatches.filter(m => m.status === 'ENCERRADA');
            const playerMatches = endedMatches.filter(m =>
                m.players.some(p => p.username === currentUser.username)
            );

            // Buscar total de gols no placar ao vivo
            let totalGols = 0;
            if (client) {
                try {
                    const { data: liveMatches } = await client.from('fm_partidas_ao_vivo').select('gols_registrados');
                    if (liveMatches) {
                        liveMatches.forEach(match => {
                            if (match.gols_registrados) {
                                const golsT1 = match.gols_registrados.time1 || [];
                                const golsT2 = match.gols_registrados.time2 || [];
                                const todosGols = [...golsT1, ...golsT2];
                                todosGols.forEach(gol => {
                                    if (gol.jogador && gol.jogador.trim().toLowerCase() === currentUser.username.toLowerCase()) {
                                        totalGols++;
                                    }
                                });
                            }
                        });
                    }
                } catch(e) {
                    console.error("Erro ao buscar gols:", e);
                }
            }

            let persistedStats = null;
            try {
                if (currentUser.username) {
                    persistedStats = await getPlayerStats(currentUser.username);
                }
            } catch (statsError) {
                console.warn('Não foi possível obter as estatísticas persistidas do jogador:', statsError);
            }

            renderHeroCard(playerMatches);
            renderPersonalInfo();
            renderStats(playerMatches, allMatches, totalGols, persistedStats);
            renderBestPlayersRanking(endedMatches);
            renderAchievementsScreen(playerMatches, totalGols);
            renderHistory(playerMatches);

        } catch (error) {
            console.error("Erro ao carregar perfil:", error);
            profileName.textContent = currentUser.username || 'Jogador';
        }
    }

    function renderHeroCard(matches) {
        // Iniciais do avatar
        const name = currentUser.full_name || currentUser.username || 'J';
        const initials = name.split(' ')
            .filter(w => w.length > 0)
            .map(w => w[0].toUpperCase())
            .slice(0, 2)
            .join('');
        avatarInitials.textContent = initials;

        // Exibição do avatar de foto se existir
        const avatarImage = document.getElementById('avatar-image');
        if (avatarImage) {
            if (currentUser.avatar_url) {
                avatarImage.src = currentUser.avatar_url;
                avatarImage.classList.remove('hidden');
                avatarInitials.classList.add('hidden');
            } else {
                avatarImage.src = '';
                avatarImage.classList.add('hidden');
                avatarInitials.classList.remove('hidden');
            }
        }

        // Nome
        profileName.textContent = currentUser.username || 'Jogador';

        // Badge de role
        const isAdmin = isAdminRole(currentUser.role);
        profileRoleBadge.innerHTML = isAdmin ? '<i class="fas fa-shield-alt mr-1"></i> Administrador' : '<i class="fas fa-futbol mr-1"></i> Jogador';
        if (isAdmin) profileRoleBadge.classList.add('admin');

        // Membro desde
        const firstDate = getFirstMatchDate(matches);
        if (firstDate !== 'N/A') {
            profileMemberSince.textContent = `Membro desde ${firstDate}`;
        } else {
            profileMemberSince.textContent = 'Novo membro do grupo';
        }
    }

    function renderPersonalInfo() {
        if (isEditing) {
            profileInfoGrid.innerHTML = `
                <div class="profile-info-row-edit">
                    <label class="profile-info-label" for="edit-fullname">
                        <span class="info-icon-span"><i class="fas fa-id-card"></i></span>
                        Nome Completo
                    </label>
                    <input type="text" id="edit-fullname" class="profile-edit-input" value="${currentUser.full_name || ''}" placeholder="Seu nome completo" />
                </div>
                <div class="profile-info-row-edit">
                    <label class="profile-info-label" for="edit-username">
                        <span class="info-icon-span"><i class="fas fa-user-tag"></i></span>
                        Apelido (exibido no jogo)
                    </label>
                    <input type="text" id="edit-username" class="profile-edit-input" value="${currentUser.username || ''}" placeholder="Seu apelido no grupo" />
                </div>
                <div class="profile-info-row-edit">
                    <span class="profile-info-label">
                        <span class="info-icon-span"><i class="fas fa-envelope"></i></span>
                        E-mail
                    </span>
                    <span class="profile-info-value-static">${currentUser.email || '—'}</span>
                </div>
                <div class="profile-info-row-edit">
                    <label class="profile-info-label" for="edit-phone">
                        <span class="info-icon-span"><i class="fas fa-mobile-alt"></i></span>
                        Celular
                    </label>
                    <input type="tel" id="edit-phone" class="profile-edit-input" value="${formatBrazilianPhone(currentUser.phone) || ''}" placeholder="(00) 00000-0000" />
                </div>
                <div class="profile-edit-actions">
                    <button id="btn-save-profile" class="btn btn-primary btn-save">
                        <i class="fas fa-save"></i> Salvar Alterações
                    </button>
                </div>
            `;

            // Máscara dinâmica de telefone
            const phoneInput = document.getElementById('edit-phone');
            if (phoneInput) {
                phoneInput.addEventListener('input', (e) => {
                    e.target.value = formatBrazilianPhone(e.target.value);
                });
            }

            // Escutador do botão salvar
            const btnSave = document.getElementById('btn-save-profile');
            if (btnSave) {
                btnSave.addEventListener('click', handleSaveProfile);
            }
        } else {
            const infoItems = [
                { icon: 'fas fa-id-card', label: 'Nome Completo', value: currentUser.full_name || '—' },
                { icon: 'fas fa-user-tag', label: 'Apelido', value: currentUser.username || '—' },
                { icon: 'fas fa-envelope', label: 'E-mail', value: currentUser.email || '—' },
                { icon: 'fas fa-mobile-alt', label: 'Celular', value: formatBrazilianPhone(currentUser.phone) || 'Não informado' }
            ];

            profileInfoGrid.innerHTML = infoItems.map(item => `
                <div class="profile-info-row">
                    <span class="profile-info-label">
                        <span class="info-icon-span"><i class="${item.icon}"></i></span>
                        ${item.label}
                    </span>
                    <span class="profile-info-value">${item.value}</span>
                </div>
            `).join('');
        }
    }

    async function handleSaveProfile() {
        const editFullNameInput = document.getElementById('edit-fullname');
        const editUsernameInput = document.getElementById('edit-username');
        const editPhoneInput = document.getElementById('edit-phone');

        if (!editFullNameInput || !editUsernameInput || !editPhoneInput) return;

        const newFullName = editFullNameInput.value.trim();
        const newUsername = editUsernameInput.value.trim();
        const newPhoneRaw = editPhoneInput.value.trim();
        const newPhone = newPhoneRaw.replace(/\D/g, '');

        if (!newUsername) {
            FMModal.warning('O apelido é obrigatório.');
            return;
        }

        if (newUsername.length < 3 || newUsername.length > 20) {
            FMModal.warning('O apelido deve ter entre 3 e 20 caracteres.');
            return;
        }

        if (!/^[a-zA-Z0-9._]+$/.test(newUsername)) {
            FMModal.warning('O apelido pode conter apenas letras, números, pontos (.) e sublinhados (_). Sem espaços ou acentos.');
            return;
        }

        const btnSave = document.getElementById('btn-save-profile');
        const originalHtml = btnSave.innerHTML;
        btnSave.disabled = true;
        btnSave.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Salvando...';

        try {
            const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
            if (!client) {
                throw new Error('Supabase client não inicializado.');
            }

            const { error } = await client.rpc('update_user_nickname', {
                p_new_username: newUsername,
                p_new_full_name: newFullName || null,
                p_new_phone: newPhone || null
            });

            if (error) {
                throw error;
            }

            // Atualiza sessão
            currentUser.username = newUsername;
            currentUser.full_name = newFullName || null;
            currentUser.phone = newPhone || null;
            currentUser.username_customized = true;
            setStoredUser(currentUser);

            FMModal.success('Perfil atualizado com sucesso!');
            
            isEditing = false;
            updateEditButtonState();
            
            // Recarrega o perfil com os novos dados
            await loadProfile();

        } catch (err) {
            console.error('Erro ao salvar perfil:', err);
            FMModal.error(err.message || 'Ocorreu um erro ao atualizar seu perfil. Tente novamente.');
        } finally {
            if (btnSave) {
                btnSave.disabled = false;
                btnSave.innerHTML = originalHtml;
            }
        }
    }

    function renderStats(playerMatches, allMatches, totalGols, persistedStats = null) {
        statsContainer.innerHTML = '';

        const bestPlayerWins = countTrophies(playerMatches, 'best_player');
        const worstPlayerWins = countTrophies(playerMatches, 'worst_player');
        const paymentRate = calculatePaymentRate(playerMatches);

        const stats = [
            { icon: '<i class="fas fa-trophy"></i>', iconClass: 'star', title: 'Craque da Partida', value: `${bestPlayerWins} ${bestPlayerWins === 1 ? 'vez' : 'vezes'}`, desc: 'Eleito o melhor em campo' },
            { icon: '<i class="fas fa-futbol"></i>', iconClass: 'goal', title: 'Gols Marcados', value: `${totalGols} ${totalGols === 1 ? 'gol' : 'gols'}`, desc: 'Registrados no ao vivo' },
            { icon: '<i class="fas fa-award text-danger"></i>', iconClass: 'wood', title: 'Perna de Pau', value: `${worstPlayerWins} ${worstPlayerWins === 1 ? 'vez' : 'vezes'}`, desc: 'Votos de pior da rodada' },
            { icon: '<i class="fas fa-file-signature"></i>', iconClass: 'check', title: 'Pagamentos em Dia', value: `${paymentRate}%`, desc: 'Assiduidade financeira' },
            { icon: '<i class="fas fa-running"></i>', iconClass: 'matches', title: 'Partidas Jogadas', value: `${playerMatches.length}`, desc: 'Presenças confirmadas' }
        ];

        if (persistedStats) {
            const financialTitle = persistedStats.status === 'DISCOUNT'
                ? 'Desconto Ativo'
                : persistedStats.status === 'PENALTY'
                ? 'Penalidade Aplicada'
                : 'Situação Financeira';

            stats.push({
                icon: '<i class="fas fa-wallet"></i>',
                iconClass: 'money',
                title: financialTitle,
                value: `R$ ${formatCurrencyBRL(Number(persistedStats.value || 0))}`,
                desc: 'Mensalidade atual'
            });
        } else {
            stats.push({
                icon: '<i class="fas fa-wallet"></i>',
                iconClass: 'money',
                title: 'Situação Financeira',
                value: 'Sem pendências',
                desc: 'Tudo regularizado'
            });
        }

        stats.forEach(stat => {
            const card = document.createElement('div');
            card.className = 'stat-card';
            card.innerHTML = `
                <div class="stat-card-header">
                    <span class="stat-title">${stat.title}</span>
                    <span class="stat-mini-icon ${stat.iconClass}">${stat.icon}</span>
                </div>
                <div class="stat-card-body">
                    <p class="stat-value">${stat.value}</p>
                    <p class="stat-desc">${stat.desc}</p>
                </div>
            `;
            statsContainer.appendChild(card);
        });
    }

    function formatCurrencyBRL(amount) {
        return amount.toFixed(2).replace('.', ',');
    }

    function renderBestPlayersRanking(matches) {
        if (!rankingContainer) return;

        const ranking = buildBestPlayersRanking(matches);
        rankingContainer.innerHTML = '';

        if (ranking.length === 0) {
            rankingContainer.innerHTML = '<p class="ranking-empty">Ainda não há votos de melhor jogador registrados nas partidas.</p>';
            return;
        }

        const topItems = ranking.slice(0, 5);
        const currentUserEntry = ranking.find(item => item.username.toLowerCase() === currentUser.username.toLowerCase());

        const header = document.createElement('div');
        header.className = 'ranking-header';
        header.innerHTML = `
            <div class="ranking-title">Top ${topItems.length} jogadores eleitos Craque</div>
            ${currentUserEntry ? `<div class="ranking-current-position">Sua posição: <strong>#${currentUserEntry.rank}</strong> • ${currentUserEntry.votes} voto${currentUserEntry.votes === 1 ? '' : 's'}</div>` : ''}
        `;

        const list = document.createElement('div');
        list.className = 'ranking-list';

        topItems.forEach((item, index) => {
            const rankIcon = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${item.rank}`;
            const itemEl = document.createElement('div');
            itemEl.className = `ranking-item${item.username.toLowerCase() === currentUser.username.toLowerCase() ? ' ranking-current' : ''}`;
            itemEl.innerHTML = `
                <div class="ranking-item-left">
                    <span class="ranking-position">${rankIcon}</span>
                    <div>
                        <div class="ranking-player-name">${item.username}</div>
                        <div class="ranking-player-meta">${item.matches} partida${item.matches === 1 ? '' : 's'} como Craque</div>
                    </div>
                </div>
                <div class="ranking-votes">${item.votes} voto${item.votes === 1 ? '' : 's'}</div>
            `;
            list.appendChild(itemEl);
        });

        rankingContainer.appendChild(header);
        rankingContainer.appendChild(list);
    }

    function buildBestPlayersRanking(matches) {
        const voteTotals = {};
        const matchCounts = {};

        matches.forEach(match => {
            const bestVotes = Array.isArray(match.votes?.best_player) ? match.votes.best_player : [];
            const uniqueCandidates = new Set();

            bestVotes.forEach(vote => {
                const candidate = getVoteCandidateUsername(vote);
                if (!candidate) return;
                const username = candidate.trim();
                if (!username) return;

                voteTotals[username] = (voteTotals[username] || 0) + 1;
                uniqueCandidates.add(username);
            });

            uniqueCandidates.forEach(username => {
                matchCounts[username] = (matchCounts[username] || 0) + 1;
            });
        });

        const ranking = Object.keys(voteTotals).map(username => ({
            username,
            votes: voteTotals[username],
            matches: matchCounts[username] || 0
        }));

        ranking.sort((a, b) => {
            if (b.votes !== a.votes) return b.votes - a.votes;
            if (b.matches !== a.matches) return b.matches - a.matches;
            return a.username.localeCompare(b.username);
        });

        return ranking.map((item, index) => ({ ...item, rank: index + 1 }));
    }

    function getVoteCandidateUsername(vote) {
        if (!vote) return '';
        return String(vote.candidate || vote.candidate_username || vote.username || vote?.player || vote || '').trim();
    }

    function renderAchievementsScreen(playerMatches, totalGols) {
        if (!achievementsContainer || !window.FMAchievements) return;

        const bestPlayerWins = countTrophies(playerMatches, 'best_player');
        const paymentRate = calculatePaymentRate(playerMatches);

        const data = {
            totalMatches: playerMatches.length,
            totalGoals: totalGols,
            bestPlayerWins,
            paymentRate
        };

        const achievements = window.FMAchievements.calculateAchievements(data);
        window.FMAchievements.renderAchievements(achievements, achievementsContainer);
    }

    function renderHistory(matches) {
        historyContainer.innerHTML = '';
        if (matches.length === 0) {
            historyContainer.innerHTML = '<p class="text-center py-6 text-gray-500"><i class="fas fa-history mr-1 block text-2xl opacity-40 mb-2"></i> Você ainda não participou de nenhuma partida encerrada.</p>';
            return;
        }

        const recentMatches = matches.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

        recentMatches.forEach(match => {
            const formattedDate = formatDateBR(match.date);
            const playerInMatch = match.players.find(p => p.username === currentUser.username);
            const isPaid = playerInMatch && playerInMatch.paid;

            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            historyItem.innerHTML = `
                <div class="history-item-main">
                    <span class="history-location"><i class="fas fa-map-marker-alt text-accent mr-1"></i> ${match.location}</span>
                    <span class="history-date"><i class="far fa-calendar-alt text-muted mr-1"></i> ${formattedDate} às ${match.time || '—'}h</span>
                </div>
                <div class="history-item-status">
                    <span class="${isPaid ? 'paid' : 'unpaid'}">
                        ${isPaid ? '<i class="fas fa-check-circle mr-1"></i> Pago' : '<i class="fas fa-exclamation-circle mr-1"></i> Pendente'}
                    </span>
                </div>
            `;
            historyContainer.appendChild(historyItem);
        });
    }

    // --- FUNÇÕES AUXILIARES ---
    function getFirstMatchDate(matches) {
        if (matches.length === 0) return 'N/A';
        const firstMatch = matches.sort((a, b) => new Date(a.date) - new Date(b.date))[0];
        return formatDateBR(firstMatch.date);
    }

    function countTrophies(matches, category) {
        let count = 0;
        matches.forEach(match => {
            const votes = match.votes?.[category];
            if (!votes || votes.length === 0) return;
            const voteCounts = votes.reduce((acc, vote) => {
                acc[vote.candidate] = (acc[vote.candidate] || 0) + 1;
                return acc;
            }, {});
            const sortedVotes = Object.entries(voteCounts).sort((a, b) => b[1] - a[1]);
            if (sortedVotes.length > 0 && sortedVotes[0][0] === currentUser.username) {
                count++;
            }
        });
        return count;
    }

    function calculatePaymentRate(matches) {
        if (matches.length === 0) return 100;
        const paidMatches = matches.filter(m => {
            const player = m.players.find(p => p.username === currentUser.username);
            return player && player.paid;
        }).length;
        return Math.round((paidMatches / matches.length) * 100);
    }

    // --- LÓGICA DE UPLOAD DE FOTO DO PERFIL ---
    const btnUploadAvatar = document.getElementById('btn-upload-avatar');
    const avatarInput = document.getElementById('avatar-input');
    const avatarLoading = document.querySelector('.avatar-loading');

    if (btnUploadAvatar && avatarInput) {
        btnUploadAvatar.addEventListener('click', () => {
            avatarInput.click();
        });

        avatarInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // Validação de tipo de arquivo
            if (!file.type.startsWith('image/')) {
                FMModal.error('Por favor, selecione um arquivo de imagem.');
                return;
            }

            // Exibir loader no avatar
            if (avatarLoading) avatarLoading.classList.remove('hidden');

            try {
                // 1. Redimensionar e comprimir imagem no client (Canvas) para desempenho ideal (200x200)
                const compressedImageBlob = await resizeAndCompressImage(file, 200, 200);

                const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
                if (!client) {
                    throw new Error('Supabase client não inicializado.');
                }

                // 2. Fazer o upload para o bucket avatars no Supabase Storage
                const fileExt = file.name.split('.').pop() || 'png';
                const ownerId = currentUser.auth_id || currentUser.id;
                if (!ownerId) {
                    throw new Error('Sessão inválida para upload de avatar.');
                }
                const safeExt = fileExt.toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
                const filename = `${ownerId}/${Date.now()}.${safeExt}`;

                const { data: uploadData, error: uploadError } = await client.storage
                    .from('avatars')
                    .upload(filename, compressedImageBlob, {
                        cacheControl: '3600',
                        upsert: true
                    });

                if (uploadError) throw uploadError;

                // 3. Obter a URL pública do arquivo
                const { data: publicUrlData } = client.storage
                    .from('avatars')
                    .getPublicUrl(filename);

                const avatarUrl = publicUrlData.publicUrl;

                // 4. Atualizar na tabela fm_perfis
                const { error: updateError } = await client
                    .from('fm_perfis')
                    .update({
                        avatar_url: avatarUrl,
                        updated_at: new Date().toISOString()
                    })
                    .eq('username', currentUser.username);

                if (updateError) throw updateError;

                // 5. Atualizar a sessão
                currentUser.avatar_url = avatarUrl;
                setStoredUser(currentUser);

                // 6. Atualizar a imagem na interface
                const avatarImage = document.getElementById('avatar-image');
                if (avatarImage) {
                    avatarImage.src = avatarUrl;
                    avatarImage.classList.remove('hidden');
                    avatarInitials.classList.add('hidden');
                }

                FMModal.success('Foto de perfil atualizada com sucesso!');

            } catch (err) {
                console.error('Erro no upload de foto de perfil:', err);
                FMModal.error(err.message || 'Ocorreu um erro ao fazer o upload da foto.');
            } finally {
                if (avatarLoading) avatarLoading.classList.add('hidden');
                avatarInput.value = ''; // Limpar input
            }
        });
    }

    // Função de utilidade para compressão/redimensionamento no cliente
    function resizeAndCompressImage(file, maxWidth, maxHeight) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > maxWidth) {
                            height = Math.round((height * maxWidth) / width);
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxHeight) {
                            width = Math.round((width * maxHeight) / height);
                            height = maxHeight;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    canvas.toBlob(
                        (blob) => {
                            if (blob) {
                                resolve(blob);
                            } else {
                                reject(new Error('Erro na compressão da imagem.'));
                            }
                        },
                        'image/jpeg',
                        0.85 // Qualidade 85% para manter leve
                    );
                };
                img.onerror = () => reject(new Error('Erro ao processar imagem para redimensionamento.'));
            };
            reader.onerror = () => reject(new Error('Erro ao carregar o leitor de imagem.'));
        });
    }

    loadProfile();
});
