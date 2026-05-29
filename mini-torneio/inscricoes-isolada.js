
// Sistema de Inscrição de Times - Mini Torneio (Bolão)
// Versão Isolada para Divulgação Pública
// Integração com Supabase mantida

const supabase = window.supabaseClient;

class InscricaoManager {
    constructor() {
        this.timesInscritos = [];
        this.timeEmEdicao = null;
        this.isLoading = false;
        this.init();
    }

    async init() {
        this.bindUI();
        this.setupEventListeners();
        await this.carregarDados();
        this.adicionarCampoJogador(true); // Adiciona o primeiro campo como obrigatório
        this.setupRealtimeListeners();
    }

    bindUI() {
        this.ui = {
            formInscricao: document.getElementById("form-inscricao"),
            listaJogadores: document.getElementById("lista-jogadores"),
            btnAddJogador: document.getElementById("btn-add-jogador"),
            msgSucessoInscricao: document.getElementById("msg-sucesso-inscricao"),
            timesInscritosContainer: document.getElementById("times-inscritos-container"),
            
            // Edição
            telefoneAcesso: document.getElementById("telefone-acesso"),
            btnAcessarEdicao: document.getElementById("btn-acessar-edicao"),
            
            // Modal
            modalEdicao: document.getElementById("modal-edicao"),
            btnFecharModal: document.getElementById("btn-fechar-modal"),
            modalNomeTime: document.getElementById("modal-nome-time"),
            modalListaJogadores: document.getElementById("modal-lista-jogadores"),
            btnAddJogadorModal: document.getElementById("btn-add-jogador-modal"),
            btnSalvarEdicao: document.getElementById("btn-salvar-edicao"),
            menuCapitao: document.getElementById("menu-capitao"),
        };
    }

    setupEventListeners() {
        this.ui.formInscricao?.addEventListener("submit", (e) => this.submeterInscricao(e));
        this.ui.btnAddJogador?.addEventListener("click", () => this.adicionarCampoJogador());
        this.ui.btnAcessarEdicao?.addEventListener("click", () => this.acessarEdicao());
        this.ui.btnFecharModal?.addEventListener("click", () => this.fecharModal());
        this.ui.btnAddJogadorModal?.addEventListener("click", () => this.adicionarJogadorModal());
        this.ui.btnSalvarEdicao?.addEventListener("click", () => this.salvarEdicao());
        
        // Fechar modal ao clicar fora
        this.ui.modalEdicao?.addEventListener("click", (e) => {
            if (e.target === this.ui.modalEdicao) this.fecharModal();
        });

        // Fechar modal com ESC
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && !this.ui.modalEdicao.classList.contains("hidden")) {
                this.fecharModal();
            }
        });
    }

    adicionarCampoJogador(required = false) {
        const index = this.ui.listaJogadores.children.length + 1;
        const div = document.createElement("div");
        div.className = "player-item";
        div.innerHTML = `
            <input type="text" name="jogador-${index}" ${required ? "required" : ""}
                   class="input-field rounded-lg bg-white"
                   placeholder="Nome do Jogador ${index} ${required ? "*" : ""}">
            <button type="button" class="btn-remove" title="Remover jogador">
                <i class="fas fa-trash-alt"></i>
            </button>
        `;
        this.ui.listaJogadores.appendChild(div);
        div.querySelector(".btn-remove").addEventListener("click", (e) => {
            e.preventDefault();
            div.remove();
        });
    }

    async submeterInscricao(event) {
        event.preventDefault();

        if (this.isLoading) return;

        const formData = new FormData(event.target);
        const nomeTime = formData.get("nome-time")?.trim();
        const capitao = formData.get("capitao")?.trim();
        const telefone = formData.get("telefone-ou-senha")?.trim();
        const observacoes = formData.get("observacoes")?.trim() || "";

        const jogadores = Array.from(this.ui.listaJogadores.querySelectorAll("input"))
            .map(input => input.value.trim())
            .filter(Boolean);

        // Validações
        if (!nomeTime || !capitao || !telefone) {
            this.mostrarErro("Por favor, preencha todos os campos obrigatórios.");
            return;
        }

        if (jogadores.length === 0) {
            this.mostrarErro("Adicione pelo menos um jogador.");
            return;
        }

        if (jogadores.length > 20) {
            this.mostrarErro("O time não pode ter mais de 20 jogadores.");
            return;
        }

        this.isLoading = true;
        this.ui.btnAddJogador.disabled = true;
        const submitBtn = event.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="loading-spinner"></span> Enviando...';

        const novaInscricao = {
            nome_time: nomeTime,
            capitao: capitao,
            telefone: telefone,
            jogadores: jogadores,
            observacoes: observacoes,
        };

        try {
            const { data, error } = await supabase.from("mt_times").insert([novaInscricao]);

            if (error) {
                throw new Error(error.message);
            }

            // Sucesso
            this.ui.msgSucessoInscricao.classList.remove("hidden");
            this.ui.msgSucessoInscricao.classList.add("flex");
            event.target.reset();
            this.ui.listaJogadores.innerHTML = "";
            this.adicionarCampoJogador(true);
            this.enviarNotificacaoWhatsApp("NOVA INSCRIÇÃO", novaInscricao);
            
            // Limpar mensagem de sucesso após 5 segundos
            setTimeout(() => {
                this.ui.msgSucessoInscricao.classList.remove("flex");
                this.ui.msgSucessoInscricao.classList.add("hidden");
            }, 5000);

        } catch (error) {
            this.mostrarErro(`Erro ao submeter inscrição: ${error.message}`);
            console.error("Erro ao submeter inscrição:", error);
        } finally {
            this.isLoading = false;
            this.ui.btnAddJogador.disabled = false;
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fab fa-whatsapp mr-2"></i><span>Enviar Inscrição</span>';
        }
    }

    renderizarTimesInscritos() {
        if (this.timesInscritos.length === 0) {
            this.ui.timesInscritosContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p class="font-semibold text-gray-600">Nenhum time inscrito ainda</p>
                    <p class="text-sm text-gray-500">Seja o primeiro a se inscrever!</p>
                </div>
            `;
            return;
        }

        this.ui.timesInscritosContainer.innerHTML = this.timesInscritos.map((time, index) => `
            <div class="team-card rounded-lg p-4">
                <div class="flex justify-between items-start mb-3">
                    <div class="flex-1">
                        <h3 class="font-bold text-lg text-gray-800">${this.escapeHtml(time.nome_time)}</h3>
                        <p class="text-sm text-gray-600">
                            <i class="fas fa-user-circle mr-1"></i>${this.escapeHtml(time.capitao)}
                        </p>
                    </div>
                    <span class="badge-count">#${index + 1}</span>
                </div>
                <div class="mt-3">
                    <p class="text-sm font-semibold text-gray-700 mb-2">
                        <i class="fas fa-users mr-2"></i>Jogadores (${time.jogadores.length}):
                    </p>
                    <ul class="text-sm text-gray-600 space-y-1 pl-4">
                        ${time.jogadores.map((j, i) => `<li class="list-disc">${this.escapeHtml(j)}</li>`).join("")}
                    </ul>
                </div>
            </div>
        `).join("");
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // --- Lógica de Edição ---

    async acessarEdicao() {
        const telefone = this.ui.telefoneAcesso.value.trim();
        
        if (!telefone) {
            this.mostrarErro("Digite o telefone ou senha para editar.");
            return;
        }

        this.ui.btnAcessarEdicao.disabled = true;
        this.ui.btnAcessarEdicao.innerHTML = '<span class="loading-spinner"></span> Buscando...';

        try {
            const { data, error } = await supabase
                .from("mt_times")
                .select("*")
                .eq("telefone", String(telefone))
                .maybeSingle();

            if (error && error.code !== 'PGRST116') {
                throw new Error(error.message);
            }

            if (!data) {
                this.mostrarErro("Time não encontrado. Verifique o telefone/senha e tente novamente.");
                return;
            }
            
            this.timeEmEdicao = data;
            this.abrirModal();

        } catch (error) {
            this.mostrarErro(`Erro ao buscar time: ${error.message}`);
            console.error("Erro ao acessar edição:", error);
        } finally {
            this.ui.btnAcessarEdicao.disabled = false;
            this.ui.btnAcessarEdicao.innerHTML = '<i class="fas fa-edit mr-2"></i>Editar';
        }
    }

    abrirModal() {
        this.ui.modalNomeTime.textContent = `Time: ${this.escapeHtml(this.timeEmEdicao.nome_time)}`;
        this.renderizarJogadoresModal();
        
        // Lógica para exibir o menu de navegação rápida (apenas para o capitão)
        // Como o acesso à edição já é feito pelo telefone/senha do capitão, 
        // consideramos que o usuário é o capitão neste ponto.
        this.ui.menuCapitao.classList.remove("hidden");
        this.ui.menuCapitao.classList.add("flex");
        
        this.ui.modalEdicao.classList.remove("hidden");
        this.ui.modalEdicao.classList.add("flex");
        document.body.style.overflow = "hidden";
    }

    fecharModal() {
        this.ui.modalEdicao.classList.remove("flex");
        this.ui.modalEdicao.classList.add("hidden");
        this.timeEmEdicao = null;
        this.ui.telefoneAcesso.value = "";
        this.ui.menuCapitao.classList.remove("flex");
        this.ui.menuCapitao.classList.add("hidden"); // Esconde o menu ao fechar
        document.body.style.overflow = "";
    }

    renderizarJogadoresModal() {
        this.ui.modalListaJogadores.innerHTML = "";
        this.timeEmEdicao.jogadores.forEach((jogador) => {
            this.adicionarJogadorModal(jogador);
        });
    }

    adicionarJogadorModal(nome = "") {
        const div = document.createElement("div");
        div.className = "player-item";
        div.innerHTML = `
            <input type="text" value="${this.escapeHtml(nome)}" 
                   class="input-field rounded-lg bg-white"
                   placeholder="Nome do jogador">
            <button type="button" class="btn-remove" title="Remover jogador">
                <i class="fas fa-times"></i>
            </button>
        `;
        this.ui.modalListaJogadores.appendChild(div);
        div.querySelector(".btn-remove").addEventListener("click", (e) => {
            e.preventDefault();
            div.remove();
        });
    }

    async salvarEdicao() {
        const jogadoresAtualizados = Array.from(this.ui.modalListaJogadores.querySelectorAll("input"))
            .map(input => input.value.trim())
            .filter(Boolean);

        if (jogadoresAtualizados.length === 0) {
            this.mostrarErro("O time deve ter pelo menos um jogador.");
            return;
        }

        if (jogadoresAtualizados.length > 20) {
            this.mostrarErro("O time não pode ter mais de 20 jogadores.");
            return;
        }

        this.ui.btnSalvarEdicao.disabled = true;
        this.ui.btnSalvarEdicao.innerHTML = '<span class="loading-spinner"></span> Salvando...';

        try {
            const { error } = await supabase
                .from("mt_times")
                .update({ jogadores: jogadoresAtualizados })
                .eq("id", this.timeEmEdicao.id);

            if (error) {
                throw new Error(error.message);
            }

            this.timeEmEdicao.jogadores = jogadoresAtualizados;
            this.renderizarTimesInscritos();
            this.enviarNotificacaoWhatsApp("ATUALIZAÇÃO DE JOGADORES", this.timeEmEdicao);
            this.fecharModal();
            
            // Mostrar mensagem de sucesso
            const successMsg = document.createElement('div');
            successMsg.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 z-40 animate-pulse';
            successMsg.innerHTML = '<i class="fas fa-check-circle"></i> Lista atualizada com sucesso!';
            document.body.appendChild(successMsg);
            setTimeout(() => successMsg.remove(), 3000);

        } catch (error) {
            this.mostrarErro(`Erro ao salvar edição: ${error.message}`);
            console.error("Erro ao salvar edição:", error);
        } finally {
            this.ui.btnSalvarEdicao.disabled = false;
            this.ui.btnSalvarEdicao.innerHTML = '<i class="fas fa-save mr-2"></i>Salvar e Notificar';
        }
    }

    // --- Persistência e Notificação ---

    async carregarDados() {
        try {
            const { data, error } = await supabase
                .from("mt_times")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) {
                throw new Error(error.message);
            }

            this.timesInscritos = data || [];
        } catch (error) {
            console.error("Erro ao carregar times:", error);
            this.timesInscritos = [];
        }
        
        this.renderizarTimesInscritos();
    }

    enviarNotificacaoWhatsApp(titulo, data) {
        let mensagem = `*🏆 ${titulo} - MINI TORNEIO 🏆*\n\n`;
        mensagem += `*Time:* ${data.nome_time}\n`;
        mensagem += `*Capitão:* ${data.capitao}\n`;
        mensagem += `*Telefone:* ${data.telefone}\n\n`;
        mensagem += `*👥 Lista de Jogadores (${data.jogadores.length}):*\n`;
        data.jogadores.forEach((jogador, i) => {
            mensagem += `${i + 1}. ${jogador}\n`;
        });
        if (data.observacoes) {
            mensagem += `\n*💬 Observações:*\n${data.observacoes}`;
        }
        
        const whatsappUrl = `https://wa.me/5591993370456?text=${encodeURIComponent(mensagem)}`;
        window.open(whatsappUrl, "_blank");
    }

    setupRealtimeListeners() {
        try {
            supabase.channel("times-changes")
                .on(
                    "postgres_changes",
                    { event: "*", schema: "public", table: "mt_times" },
                    (payload) => {
                        console.log("Mudança na tabela de times detectada!", payload);
                        this.carregarDados();
                    }
                )
                .subscribe();
        } catch (error) {
            console.error("Erro ao configurar listeners em tempo real:", error);
        }
    }

    mostrarErro(mensagem) {
        const errorMsg = document.createElement('div');
        errorMsg.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 z-40';
        errorMsg.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${mensagem}`;
        document.body.appendChild(errorMsg);
        setTimeout(() => errorMsg.remove(), 4000);
    }
}

// Inicializa o sistema quando o DOM está pronto
document.addEventListener("DOMContentLoaded", () => {
    new InscricaoManager();
});

