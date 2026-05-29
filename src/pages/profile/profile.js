import { getStoredUser, setStoredUser } from '../../stores/session-store.js';
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
    const historyContainer = document.getElementById('match-history-list');
    const achievementsContainer = document.getElementById('achievements-container');

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
                        Object.assign(currentUser, dbUser);
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

            renderHeroCard(playerMatches);
            renderPersonalInfo();
            renderStats(playerMatches, allMatches, totalGols);
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

    function renderStats(playerMatches, allMatches, totalGols) {
        statsContainer.innerHTML = '';

        const bestPlayerWins = countTrophies(playerMatches, 'best_player');
        const worstPlayerWins = countTrophies(playerMatches, 'worst_player');
        const paymentRate = calculatePaymentRate(playerMatches);

        const stats = [
            { icon: '<i class="fas fa-trophy"></i>', iconClass: 'star', title: 'Craque da Partida', value: `${bestPlayerWins} ${bestPlayerWins === 1 ? 'vez' : 'vezes'}` },
            { icon: '<i class="fas fa-futbol"></i>', iconClass: 'goal', title: 'Gols Marcados', value: `${totalGols} ${totalGols === 1 ? 'gol' : 'gols'}` },
            { icon: '<i class="fas fa-award text-danger"></i>', iconClass: 'wood', title: 'Perna de Pau', value: `${worstPlayerWins} ${worstPlayerWins === 1 ? 'vez' : 'vezes'}` },
            { icon: '<i class="fas fa-file-signature"></i>', iconClass: 'check', title: 'Pagamentos em Dia', value: `${paymentRate}%` },
            { icon: '<i class="fas fa-running"></i>', iconClass: 'matches', title: 'Partidas Jogadas', value: `${playerMatches.length}` }
        ];

        stats.forEach(stat => {
            const card = document.createElement('div');
            card.className = 'stat-card';
            card.innerHTML = `
                <div class="stat-icon ${stat.iconClass}">${stat.icon}</div>
                <div class="stat-text">
                    <p class="stat-title">${stat.title}</p>
                    <p class="stat-value">${stat.value}</p>
                </div>
            `;
            statsContainer.appendChild(card);
        });
    }

    function renderAchievementsScreen(playerMatches, totalGols) {
        if (!achievementsContainer || typeof FMAchievements === 'undefined') return;

        const bestPlayerWins = countTrophies(playerMatches, 'best_player');
        const paymentRate = calculatePaymentRate(playerMatches);

        const data = {
            totalMatches: playerMatches.length,
            totalGoals: totalGols,
            bestPlayerWins,
            paymentRate
        };

        const achievements = FMAchievements.calculateAchievements(data);
        FMAchievements.renderAchievements(achievements, achievementsContainer);
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
                const filename = `${currentUser.username}_${Date.now()}.${fileExt}`;

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
