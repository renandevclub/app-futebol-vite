
// Sistema de Administração - Mini Torneio (Bolão)
// Versão adaptada para Supabase

const supabase = window.supabaseClient;

class AdminManager {
    constructor() {
        this.config = {};
        this.user = null; // Para armazenar o usuário do Supabase Auth

        // O cliente Supabase é inicializado globalmente em supabase-client.js
        this.init();
    }

    async init() {
        this.bindUI();
        this.setupEventListeners();
        await this.checkAuthState();
    }

    bindUI() {
        this.ui = {
            loginScreen: document.getElementById('login-screen'),
            adminPanel: document.getElementById('admin-panel'),
            loginForm: document.getElementById('login-form'),
            usernameInput: document.getElementById('username-input'),
            passwordInput: document.getElementById('password-input'),
            loginError: document.getElementById('login-error'),
            logoutBtn: document.getElementById('logout-btn'),
            
            // Configurações Gerais
            valorInscricao: document.getElementById('valor-inscricao'),
            aluguelCampo: document.getElementById('aluguel-campo'),
            tempoCronometro: document.getElementById('tempo-cronometro'),
            formatoPartida: document.getElementById('formato-partida'),
            quantidadeTimes: document.getElementById('quantidade-times'),
            dataInicioTorneio: document.getElementById('data-inicio-torneio'),
            salvarConfigBtn: document.getElementById('salvar-config-btn'),

            // Premiação
            arrecadacaoTotal: document.getElementById('arrecadacao-total'),
            disponivelPremiacao: document.getElementById('disponivel-premiacao'),
            artilheiroAtivo: document.getElementById('artilheiro-ativo'),
            artilheiroContainer: document.getElementById('artilheiro-container'),
            premioPrimeiro: document.getElementById('premio-primeiro'),
            premioSegundo: document.getElementById('premio-segundo'),
            premioTerceiro: document.getElementById('premio-terceiro'),
            premioArtilheiro: document.getElementById('premio-artilheiro'),
            salvarPremiacaoBtn: document.getElementById('salvar-premiacao-btn'),

            // Gerenciamento de Dados
            exportarDadosBtn: document.getElementById('exportar-dados-btn'),
            limparDadosBtn: document.getElementById('limpar-dados-btn'),


        };
    }

    setupEventListeners() {
        this.ui.loginForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.fazerLogin();
        });

        this.ui.logoutBtn?.addEventListener('click', () => this.fazerLogout());
        this.ui.salvarConfigBtn?.addEventListener('click', () => this.salvarConfiguracoesGerais());
        this.ui.salvarPremiacaoBtn?.addEventListener('click', () => this.salvarConfiguracaoPremiacao());
        this.ui.limparDadosBtn?.addEventListener('click', () => this.limparDadosTorneio());

        // Listeners para cálculos automáticos na UI
        const inputsCalculo = [this.ui.valorInscricao, this.ui.aluguelCampo, this.ui.quantidadeTimes];
        inputsCalculo.forEach(input => input?.addEventListener('input', () => this.atualizarCalculosUI()));

        this.ui.artilheiroAtivo?.addEventListener('change', () => this.toggleArtilheiro());
    }

    async checkAuthState() {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            const user = session.user;
            // Valida se o usuário tem perfil de administrador no Futebol Milhão
            const { data: perfil, error: perfilError } = await supabase
                .from('fm_perfis')
                .select('role')
                .eq('auth_id', user.id)
                .single();

            if (!perfilError && perfil && perfil.role === 'admin') {
                this.user = user;
                this.ui.loginScreen.classList.add('hidden');
                this.ui.adminPanel.classList.remove('hidden');
                await this.carregarConfiguracoes();
                this.setupRealtimeListeners();
            } else {
                // Não é administrador! Desconecta e mostra erro
                console.warn('Acesso negado: Usuário logado não é administrador.', user.email);
                this.showToast('Acesso Negado: Apenas administradores podem acessar esta página.', 'error');
                await supabase.auth.signOut();
                this.user = null;
                this.ui.loginScreen.classList.remove('hidden');
                this.ui.adminPanel.classList.add('hidden');
            }
        } else {
            this.ui.loginScreen.classList.remove('hidden');
            this.ui.adminPanel.classList.add('hidden');
        }
    }

    async fazerLogin() {
        const email = this.ui.usernameInput.value; // Usaremos email como usuário
        const password = this.ui.passwordInput.value;

        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) {
            this.ui.loginError.textContent = `Erro: ${error.message}`;
            this.ui.loginError.classList.remove('hidden');
            this.showToast(`Falha no login: ${error.message}`, 'error');
        } else {
            const user = data.user;
            // Valida se o usuário tem perfil de administrador no Futebol Milhão
            const { data: perfil, error: perfilError } = await supabase
                .from('fm_perfis')
                .select('role')
                .eq('auth_id', user.id)
                .single();

            if (!perfilError && perfil && perfil.role === 'admin') {
                this.user = user;
                this.ui.loginScreen.classList.add('hidden');
                this.ui.adminPanel.classList.remove('hidden');
                this.ui.loginError.classList.add('hidden');
                await this.carregarConfiguracoes();
                this.setupRealtimeListeners();
                this.showToast('Login bem-sucedido!');
            } else {
                // Não é administrador! Desconecta imediatamente
                this.ui.loginError.textContent = 'Acesso Negado: Apenas administradores podem acessar esta página.';
                this.ui.loginError.classList.remove('hidden');
                this.showToast('Acesso Negado: Apenas administradores podem acessar esta página.', 'error');
                await supabase.auth.signOut();
                this.user = null;
            }
        }
    }

    async fazerLogout() {
        const { error } = await supabase.auth.signOut();
        if (error) {
            this.showToast(`Erro ao sair: ${error.message}`, 'error');
        } else {
            this.user = null;
            this.ui.adminPanel.classList.add('hidden');
            this.ui.loginScreen.classList.remove('hidden');
            this.showToast('Você saiu da sua conta.', 'info');
        }
    }

    async carregarConfiguracoes() {
        const { data, error } = await supabase
            .from('mt_configuracoes')
            .select('*')
            .eq('id', 1)
            .single();

        if (error) {
            console.error('Erro ao carregar configuração:', error);
            this.showToast('Não foi possível carregar as configurações.', 'error');
            // Usar uma config padrão em caso de falha
            this.config = { valor_inscricao: 0, aluguel_campo: 0, quantidade_times: 0, premiacao: {} };
        } else {
            this.config = data;
        }
        this.carregarDadosNaInterface();
    }

    carregarDadosNaInterface() {
        this.ui.valorInscricao.value = this.config.valor_inscricao;
        this.ui.aluguelCampo.value = this.config.aluguel_campo;
        this.ui.tempoCronometro.value = this.config.tempo_cronometro;
        this.ui.formatoPartida.value = this.config.formato_partida;
        this.ui.quantidadeTimes.value = this.config.quantidade_times;
                if (this.config.data_inicio_torneio) {
            const dataUTC = new Date(this.config.data_inicio_torneio);
            // A diferença de 3 horas (20:00 vs 23:00) sugere que a data/hora está sendo interpretada como UTC
            // e convertida para um fuso horário local de UTC-3. Para que o input mostre 23:00,
            // precisamos ajustar a data para 3 horas a mais antes de formatar.
            const TRES_HORAS_MS = 3 * 60 * 60 * 1000;
            const dataLocalCorrigida = new Date(dataUTC.getTime() + TRES_HORAS_MS);
            
            // Formato YYYY-MM-DDTHH:MM para input datetime-local
            const ano = dataLocalCorrigida.getFullYear();
            const mes = String(dataLocalCorrigida.getMonth() + 1).padStart(2, '0');
            const dia = String(dataLocalCorrigida.getDate()).padStart(2, '0');
            const hora = String(dataLocalCorrigida.getHours()).padStart(2, '0');
            const minuto = String(dataLocalCorrigida.getMinutes()).padStart(2, '0');
            
            this.ui.dataInicioTorneio.value = `${ano}-${mes}-${dia}T${hora}:${minuto}`;
        } else {
            this.ui.dataInicioTorneio.value = '';
        }

        if (this.config.premiacao) {
            this.ui.premioPrimeiro.value = this.config.premiacao.primeiro;
            this.ui.premioSegundo.value = this.config.premiacao.segundo;
            this.ui.premioTerceiro.value = this.config.premiacao.terceiro;
            this.ui.premioArtilheiro.value = this.config.premiacao.artilheiro;
            this.ui.artilheiroAtivo.checked = this.config.premiacao.artilheiroAtivo;
        }

        this.toggleArtilheiro(false);
        this.atualizarCalculosUI();
    }

    atualizarCalculosUI() {
        const valorInscricao = parseFloat(this.ui.valorInscricao.value) || 0;
        const aluguelCampo = parseFloat(this.ui.aluguelCampo.value) || 0;
        const quantidadeTimes = parseInt(this.ui.quantidadeTimes.value) || 0;

        const arrecadacaoTotal = valorInscricao * quantidadeTimes;
        const disponivelPremiacao = arrecadacaoTotal - aluguelCampo;

        this.ui.arrecadacaoTotal.textContent = arrecadacaoTotal.toFixed(2).replace('.', ',');
        this.ui.disponivelPremiacao.textContent = disponivelPremiacao.toFixed(2).replace('.', ',');
    }

    async salvarConfiguracoesGerais() {
        const configData = {
            id: 1,
            valor_inscricao: parseFloat(this.ui.valorInscricao.value),
            aluguel_campo: parseFloat(this.ui.aluguelCampo.value),
            tempo_cronometro: parseInt(this.ui.tempoCronometro.value),
            formato_partida: this.ui.formatoPartida.value,
            quantidade_times: parseInt(this.ui.quantidadeTimes.value),
            data_inicio_torneio: this.ui.dataInicioTorneio.value || null,
            updated_at: new Date().toISOString(),
        };

        const { error } = await supabase.from('mt_configuracoes').update(configData).eq('id', 1);

        if (error) {
            this.showToast(`Erro ao salvar: ${error.message}`, 'error');
        } else {
            this.showToast('Configurações gerais salvas com sucesso!');
        }
    }

    async salvarConfiguracaoPremiacao() {
        const premiacaoData = {
            primeiro: parseFloat(this.ui.premioPrimeiro.value),
            segundo: parseFloat(this.ui.premioSegundo.value),
            terceiro: parseFloat(this.ui.premioTerceiro.value),
            artilheiro: parseFloat(this.ui.premioArtilheiro.value),
            artilheiroAtivo: this.ui.artilheiroAtivo.checked,
        };

        const { error } = await supabase.from('mt_configuracoes').update({ premiacao: premiacaoData, updated_at: new Date().toISOString() }).eq('id', 1);

        if (error) {
            this.showToast(`Erro ao salvar premiação: ${error.message}`, 'error');
        } else {
            this.showToast('Premiação salva com sucesso!');
        }
    }

    async limparDadosTorneio() {
        const confirmacao = confirm('⚠️ ATENÇÃO! ⚠️\n\nEsta ação é IRREVERSÍVEL e irá apagar TODAS as inscrições e resultados do banco de dados. Deseja continuar?');
        if (!confirmacao) return;

        // Deleta todas as partidas
        const { error: partidasError } = await supabase.from('mt_partidas').delete().neq('id', 0);
        if (partidasError) {
            this.showToast(`Erro ao limpar partidas: ${partidasError.message}`, 'error');
            return;
        }

        // Deleta todos os times
        const { error: timesError } = await supabase.from('mt_times').delete().neq('id', 0);
        if (timesError) {
            this.showToast(`Erro ao limpar times: ${timesError.message}`, 'error');
            return;
        }

        this.showToast('Todos os dados do torneio foram limpos!', 'success');
    }

    toggleArtilheiro(recalcular = true) {
        this.ui.artilheiroContainer.classList.toggle('hidden', !this.ui.artilheiroAtivo.checked);
    }

    setupRealtimeListeners() {
        supabase.channel('configuracoes-changes')
            .on('postgres_changes', 
                { event: 'UPDATE', schema: 'public', table: 'mt_configuracoes', filter: 'id=eq.1' },  
                (payload) => {
                    console.log('Configuração alterada em tempo real:', payload.new);
                    this.config = payload.new;
                    this.carregarDadosNaInterface();
                    this.showToast('As configurações foram atualizadas por outro administrador.', 'info');
                }
            )
            .subscribe();
    }

    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        const bgColor = type === 'success' ? 'bg-green-500' : (type === 'error' ? 'bg-red-500' : 'bg-blue-500');
        toast.className = `fixed top-5 right-5 p-4 rounded-lg shadow-lg text-white ${bgColor}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new AdminManager();
});

