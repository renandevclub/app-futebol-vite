// Sistema de Placar Ao Vivo - ADMINISTRAÇÃO
// Lógica de controle completa com autenticação
// Adaptação do padrão de integração Supabase

// Helper: obtém o client Supabase de forma segura (evita capturar undefined no topo do módulo)
function getSupabase() {
    const client = window.supabaseClient;
    if (!client) {
        console.error('[PlacarAdmin] window.supabaseClient não está definido!');
    }
    return client;
}
const supabase = getSupabase();

class PlacarAdministrador {
    constructor() {
        this.times = [];
        this.partidaAtual = null; // Armazena a partida com status 'em-andamento'
        this.cronometroInterval = null;
        this.init();
    }

    async init() {
        this.bindUI();
        this.setupEventListeners();
        await this.checkAuth();
        this.carregarDadosIniciais();
        this.setupRealtimeListeners(); // Mantém o realtime para o admin ver as mudanças de outros admins (se houver)
    }

    async checkAuth() {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            alert("Acesso Restrito: Você precisa estar logado para gerenciar o placar.");
            window.location.href = "../index.html";
            return;
        }

        const user = session.user;
        const { data: perfil, error } = await supabase
            .from('fm_perfis')
            .select('role')
            .eq('auth_id', user.id)
            .single();

        if (error || !perfil || (perfil.role !== 'admin' && perfil.role !== 'user')) {
            alert("Acesso Negado: Apenas administradores ou jogadores cadastrados podem acessar esta área.");
            window.location.href = "../index.html";
        }
    }

    bindUI() {
        this.ui = {
            configPartidaSection: document.getElementById("config-partida"),
            selectTime1: document.getElementById("select-time1"),
            selectTime2: document.getElementById("select-time2"),
            btnIniciarPartida: document.getElementById("btn-iniciar-partida"),
            placarAoVivoSection: document.getElementById("placar-ao-vivo"),
            statusPartida: document.getElementById("status-partida"),
            cronometroDisplay: document.getElementById("cronometro"),
            btnPlayPause: document.getElementById("btn-play-pause"),
            btnReset: document.getElementById("btn-reset"),
            nomeTime1: document.getElementById("nome-time1"),
            nomeTime2: document.getElementById("nome-time2"),
            placarTime1: document.getElementById("placar-time1"),
            placarTime2: document.getElementById("placar-time2"),
            btnAumentarTime1: document.getElementById("btn-aumentar-time1"),
            btnDiminuirTime1: document.getElementById("btn-diminuir-time1"),
            btnAumentarTime2: document.getElementById("btn-aumentar-time2"),
            btnDiminuirTime2: document.getElementById("btn-diminuir-time2"),
            selectArtilheiroTime1: document.getElementById("select-artilheiro-time1"),
            selectArtilheiroTime2: document.getElementById("select-artilheiro-time2"),
            btnRegistrarGolTime1: document.getElementById("btn-registrar-gol-time1"),
            btnRegistrarGolTime2: document.getElementById("btn-registrar-gol-time2"),
            listaGolsTime1: document.getElementById("lista-gols-time1"),
            listaGolsTime2: document.getElementById("lista-gols-time2"),
            btnFinalizarPartida: document.getElementById("btn-finalizar-partida"),

            historicoPartidasLista: document.getElementById("historico-partidas-lista"),
        };
    }

    setupEventListeners() {
        this.ui.btnIniciarPartida.addEventListener("click", () => this.iniciarPartida());
        this.ui.btnPlayPause.addEventListener("click", () => this.toggleCronometro());
        this.ui.btnReset.addEventListener("click", () => this.resetCronometro());
        this.ui.btnFinalizarPartida.addEventListener("click", () => this.finalizarPartida());

        this.ui.btnAumentarTime1.addEventListener("click", () => this.ajustarPlacar("time1", 1));
        this.ui.btnDiminuirTime1.addEventListener("click", () => this.ajustarPlacar("time1", -1));
        this.ui.btnAumentarTime2.addEventListener("click", () => this.ajustarPlacar("time2", 1));
        this.ui.btnDiminuirTime2.addEventListener("click", () => this.ajustarPlacar("time2", -1));
        this.ui.btnRegistrarGolTime1.addEventListener("click", () => this.registrarGol("time1"));
        this.ui.btnRegistrarGolTime2.addEventListener("click", () => this.registrarGol("time2"));
    }

    async carregarDadosIniciais() {
        // Carrega todos os times e jogadores
        const { data: timesData, error: timesError } = await supabase.from("mt_times").select("id, nome_time, jogadores");
        if (timesError) {
            console.error("Erro ao carregar times:", timesError);
        } else {
            this.times = timesData;
            this.popularSelectsTimes();
        }

        // Carrega a partida 'em-andamento' (se houver)
        const { data: partidaData, error: partidaError } = await supabase
            .from("mt_partidas")
            .select("*, time1:mt_times!time1_id(nome_time, jogadores), time2:mt_times!time2_id(nome_time, jogadores)")
            .eq("status", "em-andamento")
            .single();

        if (partidaData) {
            this.partidaAtual = partidaData;
            this.atualizarInterfaceComPartida();
        } else {
            this.mostrarConfiguracaoPartida();
        }


        this.carregarHistoricoPartidas();
    }

    popularSelectsTimes() {
        const selects = [this.ui.selectTime1, this.ui.selectTime2];
        selects.forEach(select => {
            select.innerHTML = '<option value="">Selecione o time</option>';
            this.times.forEach(time => {
                select.innerHTML += `<option value="${time.id}">${time.nome_time}</option>`;
            });
        });
    }

    popularSelectsArtilheiros() {
        if (!this.partidaAtual) return;

        const time1 = this.partidaAtual.time1;
        const time2 = this.partidaAtual.time2;

        const popularSelect = (selectElement, time) => {
            selectElement.innerHTML = '<option value="">Quem marcou?</option>';
            if (time && time.jogadores && Array.isArray(time.jogadores)) {
                time.jogadores.forEach(jogador => {
                    selectElement.innerHTML += `<option value="${jogador}">${jogador}</option>`;
                });
            }
        };

        popularSelect(this.ui.selectArtilheiroTime1, time1);
        popularSelect(this.ui.selectArtilheiroTime2, time2);
    }

    async iniciarPartida() {
        const time1Id = this.ui.selectTime1.value;
        const time2Id = this.ui.selectTime2.value;

        if (!time1Id || !time2Id || time1Id === time2Id) {
            alert("Selecione dois times diferentes e válidos.");
            return;
        }

        // Verifica se já existe uma partida em andamento
        const { data: partidaEmAndamento } = await supabase
            .from("mt_partidas")
            .select("id")
            .eq("status", "em-andamento")
            .maybeSingle();

        if (partidaEmAndamento) {
            alert("Já existe uma partida em andamento. Finalize-a antes de iniciar uma nova.");
            return;
        }

        const { data: config } = await supabase.from('mt_configuracoes').select('tempo_cronometro').eq('id', 1).single();

        const novaPartida = {
            time1_id: time1Id,
            time2_id: time2Id,
            status: "em-andamento",
            time1_gols: 0,
            time2_gols: 0,
            gols_registrados: { time1: [], time2: [] },
            cronometro_state: { minutos: config?.tempo_cronometro || 7, segundos: 0, rodando: true },
        };

        const { data, error } = await supabase
            .from("mt_partidas")
            .insert(novaPartida)
            .select("*, time1:mt_times!time1_id(nome_time, jogadores), time2:mt_times!time2_id(nome_time, jogadores)")
            .single();

        if (error) {
            console.error("Erro ao iniciar partida:", error);
            alert("Não foi possível iniciar a partida.");
        } else {
            this.partidaAtual = data;
            this.atualizarInterfaceComPartida();
        }
    }

    atualizarInterfaceComPartida() {
        if (!this.partidaAtual) {
            this.mostrarConfiguracaoPartida();
            return;
        }

        this.ui.configPartidaSection.classList.add("hidden");
        this.ui.placarAoVivoSection.classList.remove("hidden");

        this.ui.nomeTime1.textContent = this.partidaAtual.time1.nome_time;
        this.ui.nomeTime2.textContent = this.partidaAtual.time2.nome_time;
            this.ui.placarTime1.textContent = this.partidaAtual.time1_gols || 0;
            this.ui.placarTime2.textContent = this.partidaAtual.time2_gols || 0;

            this.atualizarStatusPartida();
            this.renderListaGols();
            this.gerenciarCronometro(true); // Gerencia o cronômetro (salva no banco)
            this.popularSelectsArtilheiros();
            this.atualizarNomesTimesGols(); // Nova função para atualizar os nomes dos times na seção de gols
        }

    mostrarConfiguracaoPartida() {
        this.ui.placarAoVivoSection.classList.add("hidden");
        this.ui.configPartidaSection.classList.remove("hidden");
    }

    // --- Lógica do Cronômetro ---

    gerenciarCronometro(is_admin) {
        clearInterval(this.cronometroInterval);
        if (!this.partidaAtual || !this.partidaAtual.cronometro_state) return;

        let { minutos, segundos, rodando } = this.partidaAtual.cronometro_state;
        this.atualizarDisplayCronometro(minutos, segundos);

        if (rodando) {
            this.ui.btnPlayPause.innerHTML = '<i class="fas fa-pause"></i>';
            this.ui.statusPartida.textContent = 'AO VIVO';
            this.ui.statusPartida.classList.remove('bg-gray-500');
            this.ui.statusPartida.classList.add('bg-red-500');
            this.cronometroInterval = setInterval(async () => {
                if (segundos > 0) {
                    segundos--;
                } else if (minutos > 0) {
                    minutos--;
                    segundos = 59;
                } else {
                    clearInterval(this.cronometroInterval);
                    this.partidaAtual.cronometro_state.rodando = false;
                    await this.atualizarCronometroNoBanco(minutos, segundos, false);
                    this.ui.btnPlayPause.innerHTML = '<i class="fas fa-play"></i>';
                    return;
                }
                this.partidaAtual.cronometro_state.minutos = minutos;
                this.partidaAtual.cronometro_state.segundos = segundos;
                this.atualizarDisplayCronometro(minutos, segundos);
                
                // Salva o estado a cada 5 segundos para evitar sobrecarga no Supabase
                if (segundos % 5 === 0) {
                    await this.atualizarCronometroNoBanco(minutos, segundos, true);
                }
            }, 1000);
        } else {
            this.ui.btnPlayPause.innerHTML = '<i class="fas fa-play"></i>';
            this.ui.statusPartida.textContent = 'PAUSADO';
            this.ui.statusPartida.classList.remove('bg-red-500');
            this.ui.statusPartida.classList.add('bg-gray-500');
        }
    }

    async toggleCronometro() {
        if (!this.partidaAtual) return;
        const newState = !this.partidaAtual.cronometro_state.rodando;
        
        this.partidaAtual.cronometro_state.rodando = newState;
        await this.atualizarCronometroNoBanco(this.partidaAtual.cronometro_state.minutos, this.partidaAtual.cronometro_state.segundos, newState);

        this.gerenciarCronometro(true);
    }

    async resetCronometro() {
        if (!this.partidaAtual) return;
        clearInterval(this.cronometroInterval);
        
        const { data: config } = await supabase.from('mt_configuracoes').select('tempo_cronometro').eq('id', 1).single();
        const minutosIniciais = config?.tempo_cronometro || 7;

        this.partidaAtual.cronometro_state = { minutos: minutosIniciais, segundos: 0, rodando: false };
        await this.atualizarCronometroNoBanco(minutosIniciais, 0, false);
        
        this.gerenciarCronometro(true);
    }

    atualizarDisplayCronometro(minutos, segundos) {
        const minStr = String(minutos).padStart(2, '0');
        const secStr = String(segundos).padStart(2, '0');
        this.ui.cronometroDisplay.textContent = `${minStr}:${secStr}`;
    }

    async atualizarCronometroNoBanco(minutos, segundos, rodando) {
        if (!this.partidaAtual) return;
        const sb = supabase || getSupabase();
        if (!sb) return;
        const { error } = await sb
            .from("mt_partidas")
            .update({ 
                cronometro_state: { minutos, segundos, rodando } 
            })
            .eq("id", this.partidaAtual.id);
        
        if (error) {
            console.error("Erro ao atualizar cronômetro:", error);
        }
    }

    // --- Lógica do Placar ---

    async ajustarPlacar(timeKey, delta) {
        if (!this.partidaAtual) return;

        const golsAtuais = this.partidaAtual[`${timeKey}_gols`];
        const novosGols = Math.max(0, golsAtuais + delta);

        if (novosGols === golsAtuais) return;

        this.partidaAtual[`${timeKey}_gols`] = novosGols;

        const sb = supabase || getSupabase();
        if (!sb) return;
        const { error } = await sb
            .from("mt_partidas")
            .update({ 
                [`${timeKey}_gols`]: novosGols
            })
            .eq("id", this.partidaAtual.id);

        if (error) {
            console.error(`Erro ao ajustar placar do ${timeKey}:`, error);
        } else {
            this.ui[`placar${timeKey === 'time1' ? 'Time1' : 'Time2'}`].textContent = novosGols;
            if (delta > 0) {
                this.aplicarAnimacaoGol(timeKey);
            }
        }
    }

    async registrarGol(timeKey) {
        if (!this.partidaAtual) return;

        const selectArtilheiro = this.ui[`selectArtilheiro${timeKey === 'time1' ? 'Time1' : 'Time2'}`];
        const artilheiro = selectArtilheiro.value;

        if (!artilheiro) {
            alert("Selecione o jogador que marcou o gol.");
            return;
        }

        // Adiciona o gol à lista de gols registrados
        const golsRegistrados = this.partidaAtual.gols_registrados;
        const golsDoTime = golsRegistrados[timeKey];
        
        const { minutos, segundos } = this.partidaAtual.cronometro_state;
        const tempo = `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;

        golsDoTime.push({ jogador: artilheiro, minuto: tempo });
        this.partidaAtual.gols_registrados = golsRegistrados;

        // Atualiza o placar
        await this.ajustarPlacar(timeKey, 1);

        // Atualiza o banco com o registro de gols
        const { error } = await supabase
            .from("mt_partidas")
            .update({ 
                gols_registrados: golsRegistrados
            })
            .eq("id", this.partidaAtual.id);

        if (error) {
            console.error("Erro ao registrar gol:", error);
        } else {
            this.renderListaGols();
            selectArtilheiro.value = ""; // Limpa a seleção
        }
    }

    renderListaGols() {
        if (!this.partidaAtual) return;

        const golsTime1 = this.partidaAtual.gols_registrados.time1 || [];
        const golsTime2 = this.partidaAtual.gols_registrados.time2 || [];

        this.ui.listaGolsTime1.innerHTML = golsTime1.map(gol => 
            `<li class="truncate" title="${gol.jogador}">(${gol.minuto}) ${gol.jogador}</li>`
        ).join('');

        this.ui.listaGolsTime2.innerHTML = golsTime2.map(gol => 
            `<li class="truncate" title="${gol.jogador}">(${gol.minuto}) ${gol.jogador}</li>`
        ).join('');
    }

    aplicarAnimacaoGol(timeKey) {
        const placarElement = this.ui[`placar${timeKey === 'time1' ? 'Time1' : 'Time2'}`];
        placarElement.classList.add('gol-animation');
        setTimeout(() => {
            placarElement.classList.remove('gol-animation');
        }, 500);
    }

    // --- Finalização da Partida ---

    async finalizarPartida() {
        if (!this.partidaAtual) {
            console.warn('[PlacarAdmin] finalizarPartida chamada sem partidaAtual');
            return;
        }

        clearInterval(this.cronometroInterval);

        const confirmacao = confirm("Tem certeza que deseja finalizar a partida?");
        if (!confirmacao) return;

        // Garante que o client Supabase está disponível
        const sb = supabase || getSupabase();
        if (!sb) {
            alert("Erro crítico: Supabase não está disponível. Recarregue a página.");
            return;
        }

        // Verifica se o usuário está autenticado antes de tentar atualizar
        const { data: { session } } = await sb.auth.getSession();
        if (!session) {
            alert("Sessão expirada. Você será redirecionado para fazer login novamente.");
            window.location.href = "../index.html";
            return;
        }

        console.log('[PlacarAdmin] Finalizando partida ID:', this.partidaAtual.id);
        console.log('[PlacarAdmin] Sessão ativa - User ID:', session.user.id);

        try {
            // Usa .select() para confirmar que a linha foi realmente atualizada
            const { data, error } = await sb
                .from("mt_partidas")
                .update({ 
                    status: "finalizada",
                    cronometro_state: { minutos: 0, segundos: 0, rodando: false }
                })
                .eq("id", this.partidaAtual.id)
                .select();

            if (error) {
                console.error("[PlacarAdmin] Erro do Supabase ao finalizar:", error);
                alert(`Não foi possível finalizar a partida.\nErro: ${error.message}`);
                return;
            }

            // Verifica se a atualização realmente afetou alguma linha
            // (RLS pode bloquear silenciosamente retornando 0 linhas)
            if (!data || data.length === 0) {
                console.error("[PlacarAdmin] UPDATE retornou 0 linhas. RLS pode estar bloqueando.");
                console.error("[PlacarAdmin] Tentando re-autenticar...");

                // Tenta forçar refresh do token e tentar novamente
                const { data: refreshData } = await sb.auth.refreshSession();
                if (refreshData?.session) {
                    console.log('[PlacarAdmin] Token renovado. Tentando novamente...');
                    const { data: retryData, error: retryError } = await sb
                        .from("mt_partidas")
                        .update({ 
                            status: "finalizada",
                            cronometro_state: { minutos: 0, segundos: 0, rodando: false }
                        })
                        .eq("id", this.partidaAtual.id)
                        .select();

                    if (retryError || !retryData || retryData.length === 0) {
                        console.error("[PlacarAdmin] Retry também falhou:", retryError);
                        alert("Não foi possível finalizar a partida. Verifique suas permissões e tente novamente.");
                        return;
                    }
                } else {
                    alert("Sessão expirada. Faça login novamente.");
                    window.location.href = "../index.html";
                    return;
                }
            }

            console.log('[PlacarAdmin] Partida finalizada com sucesso!', data);
            alert("Partida finalizada com sucesso!");
            this.partidaAtual = null;
            this.mostrarConfiguracaoPartida();
            this.carregarHistoricoPartidas();
        } catch (err) {
            console.error("[PlacarAdmin] Exceção ao finalizar partida:", err);
            alert(`Erro inesperado ao finalizar: ${err.message}`);
        }
    }

    // --- Realtime e Atualizações ---

    setupRealtimeListeners() {
        // Escuta por mudanças na tabela 'partidas'
        supabase
            .channel('partidas_changes')
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'mt_partidas' },
                (payload) => {
                    this.handleRealtimeUpdate(payload.new);
                }
            )
            .subscribe();
    }

    handleRealtimeUpdate(novaPartida) {
        // Se a partida que mudou é a que estamos administrando
        if (this.partidaAtual && novaPartida.id === this.partidaAtual.id) {
            const cronometroMudou = JSON.stringify(novaPartida.cronometro_state) !== JSON.stringify(this.partidaAtual.cronometro_state);
            
            // Atualiza o objeto local
            this.partidaAtual = { ...this.partidaAtual, ...novaPartida };
            
            // Re-renderiza a interface (exceto o cronômetro se estiver rodando localmente)
            this.ui.placarTime1.textContent = this.partidaAtual.time1_gols || 0;
            this.ui.placarTime2.textContent = this.partidaAtual.time2_gols || 0;
            this.renderListaGols();
            this.atualizarStatusPartida();

            // Se o cronômetro mudou (ex: outro admin pausou/resetou), reinicia o gerenciador
            if (cronometroMudou) {
                this.gerenciarCronometro(false); // is_admin = false para não tentar salvar no banco a cada segundo
            }
        }
        
        // Se uma partida em andamento foi finalizada por outro admin
        if (novaPartida.status === 'finalizada' && this.partidaAtual && novaPartida.id === this.partidaAtual.id) {
            this.partidaAtual = null;
            this.mostrarConfiguracaoPartida();
            this.carregarHistoricoPartidas();
        }
        
        // Se uma nova partida foi iniciada e não estamos em uma
        if (novaPartida.status === 'em-andamento' && !this.partidaAtual) {
             // Recarrega os dados para pegar a nova partida e os nomes dos times
             this.carregarDadosIniciais();
        }
    }

    atualizarStatusPartida() {
        if (!this.partidaAtual) return;

        const statusElement = this.ui.statusPartida;
        statusElement.className = 'status-badge inline-block text-white px-4 py-2 rounded-full font-semibold text-sm';

        if (this.partidaAtual.status === 'finalizada') {
            statusElement.textContent = 'FINALIZADA';
            statusElement.classList.add('bg-green-500');
        } else {
            // O status AO VIVO/PAUSADO é definido em gerenciarCronometro
            if (this.partidaAtual.cronometro_state.rodando) {
                statusElement.textContent = 'AO VIVO';
                statusElement.classList.add('bg-red-500');
            } else {
                statusElement.textContent = 'PAUSADO';
                statusElement.classList.add('bg-gray-500');
            }
        }
        statusElement.innerHTML = `<i class="fas fa-circle mr-2"></i> ${statusElement.textContent}`;
    }

    // --- Funções Auxiliares ---

    atualizarNomesTimesGols() {
        if (!this.partidaAtual) return;
        document.getElementById('nome-time1-gols').textContent = this.partidaAtual.time1.nome_time;
        document.getElementById('nome-time2-gols').textContent = this.partidaAtual.time2.nome_time;
    }

    // --- Referências do Admin ---



    async carregarHistoricoPartidas() {
        const { data: historico, error } = await supabase
            .from("mt_partidas")
            .select("*, time1:mt_times!time1_id(nome_time), time2:mt_times!time2_id(nome_time)")
            .eq("status", "finalizada")
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Erro ao carregar histórico:", error);
            this.ui.historicoPartidasLista.innerHTML = '<p class="text-red-500 text-center py-8">Erro ao carregar histórico.</p>';
        } else if (historico.length === 0) {
            this.ui.historicoPartidasLista.innerHTML = '<p class="text-gray-500 text-center py-8">Nenhuma partida finalizada ainda.</p>';
        } else {
            this.ui.historicoPartidasLista.innerHTML = historico.map(partida => {
                const dataFormatada = new Date(partida.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                const time1Venceu = partida.time1_gols > partida.time2_gols;
                const time2Venceu = partida.time2_gols > partida.time1_gols;
                const empate = partida.time1_gols === partida.time2_gols;

                const time1Classes = time1Venceu ? 'text-green-600 font-extrabold' : (empate ? 'text-gray-600' : 'text-red-600');
                const time2Classes = time2Venceu ? 'text-green-600 font-extrabold' : (empate ? 'text-gray-600' : 'text-red-600');
                const cardClasses = time1Venceu || time2Venceu ? 'border-l-4 border-yellow-500 shadow-lg' : 'shadow-md';

                return `
                    <div class="bg-white p-5 rounded-xl transition-all hover:shadow-xl ${cardClasses}">
                        <div class="flex justify-between items-start mb-3">
                            <span class="text-xs font-medium text-gray-500">${dataFormatada}</span>
                            <span class="text-sm font-semibold text-purple-600">Finalizada</span>
                        </div>
                        <div class="flex justify-between items-center text-lg">
                            <div class="text-left flex-1 truncate mr-2">
                                <span class="font-bold">${partida.time1.nome_time}</span>
                            </div>
                            <div class="text-right">
                                <span class="text-2xl ${time1Classes}">${partida.time1_gols}</span>
                            </div>
                        </div>
                        <div class="flex justify-between items-center text-lg mt-1">
                            <div class="text-left flex-1 truncate mr-2">
                                <span class="font-bold">${partida.time2.nome_time}</span>
                            </div>
                            <div class="text-right">
                                <span class="text-2xl ${time2Classes}">${partida.time2_gols}</span>
                            </div>
                        </div>
                        ${empate ? '<div class="text-center mt-3 text-sm font-semibold text-gray-500 border-t pt-2">EMPATE</div>' : ''}
                    </div>
                `;
            }).join('');
        }
    }
}

// Inicializa a aplicação
document.addEventListener("DOMContentLoaded", () => {
    // Verifica se o Supabase client foi carregado (do supabase-client.js)
    if (typeof supabase === 'undefined') {
        console.error("Supabase client não está definido. Verifique se supabase-client.js foi carregado corretamente.");
        return;
    }
    new PlacarAdministrador();
});

