/**
 * main.js - Orquestração e inicialização do sistema
 * Conecta todos os módulos e gerencia eventos
 */

// Verifica se dependências foram carregadas
(function checkDependencies() {
    const deps = ['Utils', 'Storage', 'Inventario', 'CSV', 'Camera', 'UI'];
    const missing = deps.filter(d => typeof window[d] === 'undefined');
    if (missing.length > 0) {
        console.error('[App] Dependências não carregadas:', missing.join(', '));
        alert('Erro: Alguns módulos não foram carregados.\n\nVerifique se todos os arquivos JS estão na pasta correta:\n- js/utils.js\n- js/storage.js\n- js/data.js\n- js/csv.js\n- js/camera.js\n- js/ui.js\n- js/main.js');
    }
})();

const App = (function() {
    'use strict';

    // Estado da aplicação
    let _modoScanner = 'manual';

    // Funções com debounce para busca
    let _buscaLocalizadosDebounced;
    let _buscaPendentesDebounced;
    let _buscaBipadosDebounced;

    // ==================== INICIALIZAÇÃO ====================

    /**
     * Inicializa a aplicação
     */
    function inicializar() {
        try {
            console.log('[App] Inicializando sistema...');

            // Inicializa módulo de dados
            Inventario.inicializar();

            // Configura UI
            UI.atualizarEstatisticas();
            UI.renderizarHistorico();
            UI.configurarScrollTop();

            // Setup de eventos
            _setupTabs();
            _setupScanner();
            _setupUpload();
            _setupBuscas();
            _setupCoordenacao();
            _setupBackup();

            console.log('[App] ✅ Sistema inicializado!');
        } catch (e) {
            console.error('[App] ❌ Erro na inicialização:', e);
            alert('Erro ao inicializar o sistema. Verifique o console (F12) para detalhes.');
        }
    }

    // ==================== TABS ====================

    /**
     * Configura navegação por abas
     */
    function _setupTabs() {
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                // Remove active de todos
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));

                // Ativa selecionado
                tab.classList.add('active');
                const panelId = `panel-${tab.dataset.tab}`;
                const panel = document.getElementById(panelId);
                if (panel) panel.classList.add('active');

                // Carrega conteúdo da aba
                _carregarConteudoAba(tab.dataset.tab);
            });
        });
    }

    /**
     * Carrega conteúdo específico de cada aba
     */
    function _carregarConteudoAba(aba) {
        switch (aba) {
            case 'scanner':
                setTimeout(() => {
                    const input = document.getElementById('input-patrimonio');
                    if (input) input.focus();
                }, 100);
                break;

            case 'localizados':
                UI.renderizarLocalizados();
                break;

            case 'pendentes':
                UI.renderizarPendentes();
                break;

            case 'bipados':
                UI.renderizarBipados();
                break;

            case 'por-coordenacao':
                UI.popularSelectCoordenacoes();
                const select = document.getElementById('select-coordenacao');
                if (select && select.value) {
                    UI.renderizarPorCoordenacao(select.value);
                }
                break;
        }
    }

    // ==================== SCANNER ====================

    /**
     * Configura módulo de scanner
     */
    function _setupScanner() {
        // Entrada manual - Enter para verificar
        const inputPatrimonio = document.getElementById('input-patrimonio');
        if (inputPatrimonio) {
            inputPatrimonio.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    verificarPatrimonio();
                }
            });
        }
    }

    /**
     * Alterna modo do scanner
     * @param {string} modo - 'manual' ou 'camera'
     */
    function setModoScanner(modo) {
        _modoScanner = modo;

        // Atualiza botões
        document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
        const btnAtivo = document.getElementById(`mode-${modo}`);
        if (btnAtivo) btnAtivo.classList.add('active');

        // Alterna seções
        const secaoManual = document.getElementById('section-manual');
        const secaoCamera = document.getElementById('section-camera');

        if (secaoManual) secaoManual.style.display = modo === 'manual' ? 'block' : 'none';
        if (secaoCamera) secaoCamera.classList.toggle('active', modo === 'camera');

        // Para câmera se mudou para manual
        if (modo === 'manual') {
            Camera.parar();
            const input = document.getElementById('input-patrimonio');
            if (input) input.focus();
        }
    }

    /**
     * Verifica patrimônio digitado manualmente
     */
    function verificarPatrimonio() {
        const input = document.getElementById('input-patrimonio');
        if (!input) return;

        const patrimonio = input.value.trim();
        if (!patrimonio) {
            UI.toast('Digite um número de patrimônio', 'warning');
            return;
        }

        _processarLeitura(patrimonio);
        input.value = '';
        input.focus();
    }

    /**
     * Processa leitura (manual ou câmera)
     */
    function _processarLeitura(patrimonio) {
        if (!Utils.validarPatrimonio(patrimonio)) {
            UI.toast('Patrimônio inválido', 'error');
            return;
        }

        // Registra bipagem usando índice O(1)
        const resultado = Inventario.registrarBipagem(patrimonio);

        // Feedback sonoro
        switch (resultado.status) {
            case 'sucesso': Utils.tocarSom('sucesso'); break;
            case 'ja_bipado': Utils.tocarSom('alerta'); break;
            default: Utils.tocarSom('erro');
        }

        // Toast
        const toastMsgs = {
            'sucesso': ['Item registrado com sucesso!', 'success'],
            'ja_bipado': ['Item já foi bipado!', 'warning'],
            'nao_encontrado': ['Item não encontrado!', 'error']
        };
        const [msg, tipo] = toastMsgs[resultado.status] || ['Erro', 'error'];
        UI.toast(msg, tipo);

        // Mostra resultado visual
        UI.mostrarResultado(resultado);

        // Adiciona ao histórico
        Inventario.adicionarHistorico(resultado);

        // Atualiza UI
        UI.atualizarEstatisticas();
        UI.renderizarHistorico();
    }

    /**
     * Inicia câmera do scanner
     */
    function iniciarCamera() {
        Camera.iniciar(_processarLeitura);
    }

    /**
     * Para câmera do scanner
     */
    function pararCamera() {
        Camera.parar();
    }

    // ==================== UPLOAD CSV ====================

    /**
     * Configura upload de arquivo CSV
     */
    function _setupUpload() {
        const area = document.getElementById('upload-area');
        const input = document.getElementById('arquivo-csv');

        if (!area || !input) return;

        // Click na área
        area.addEventListener('click', () => input.click());

        // Drag and drop
        area.addEventListener('dragover', (e) => {
            e.preventDefault();
            area.classList.add('dragover');
        });

        area.addEventListener('dragleave', () => {
            area.classList.remove('dragover');
        });

        area.addEventListener('drop', (e) => {
            e.preventDefault();
            area.classList.remove('dragover');
            
            const arquivos = e.dataTransfer.files;
            if (arquivos.length > 0) {
                _processarUpload(arquivos[0]);
            }
        });

        // Seleção de arquivo
        input.addEventListener('change', () => {
            if (input.files.length > 0) {
                _processarUpload(input.files[0]);
            }
        });
    }

    /**
     * Processa arquivo de upload
     */
    async function _processarUpload(arquivo) {
        const statusEl = document.getElementById('import-status');

        UI.mostrarLoader('Processando arquivo CSV...');

        try {
            const resultado = await CSV.processarArquivo(arquivo);

            if (resultado.erros.length > 0 && resultado.dados.length === 0) {
                throw new Error(resultado.erros.join('\n'));
            }

            // Importa dados
            const stats = Inventario.importar(resultado.dados);

            // Feedback
            UI.esconderLoader();

            let html = `
                <div class="info-box" style="background: var(--cor-sucesso-fundo); border-left-color: var(--cor-sucesso);">
                    <strong>✅ Importação concluída!</strong><br>
                    <br>
                    📊 <strong>${stats.total}</strong> itens importados<br>
                    ✅ <strong>${stats.localizados}</strong> já localizados (UORG preenchido)<br>
                    ⏳ <strong>${stats.pendentes}</strong> pendentes de localização
                </div>
            `;

            if (resultado.erros.length > 0) {
                html += `
                    <div class="info-box" style="background: var(--cor-alerta-fundo); border-left-color: var(--cor-alerta); margin-top: 1rem;">
                        <strong>⚠️ Avisos (${resultado.erros.length}):</strong><br>
                        <small>${resultado.erros.slice(0, 5).join('<br>')}</small>
                        ${resultado.erros.length > 5 ? `<br><small>... e mais ${resultado.erros.length - 5} avisos</small>` : ''}
                    </div>
                `;
            }

            if (statusEl) statusEl.innerHTML = html;

            UI.atualizarEstatisticas();
            UI.toast(`${stats.total} itens importados!`, 'success');

        } catch (erro) {
            UI.esconderLoader();
            
            if (statusEl) {
                statusEl.innerHTML = `
                    <div class="info-box" style="background: var(--cor-erro-fundo); border-left-color: var(--cor-erro);">
                        <strong>❌ Erro na importação</strong><br>
                        ${Utils.sanitizar(erro.message)}
                    </div>
                `;
            }

            UI.toast('Erro ao importar arquivo', 'error');
        }
    }

    // ==================== BUSCAS COM DEBOUNCE ====================

    /**
     * Configura campos de busca com debounce
     */
    function _setupBuscas() {
        // Cria funções com debounce
        _buscaLocalizadosDebounced = Utils.debounce((termo) => {
            UI.renderizarLocalizados(termo);
        }, 300);

        _buscaPendentesDebounced = Utils.debounce((termo) => {
            UI.renderizarPendentes(termo);
        }, 300);

        _buscaBipadosDebounced = Utils.debounce((termo) => {
            UI.renderizarBipados(termo);
        }, 300);

        // Conecta aos inputs
        const inputLocalizados = document.getElementById('busca-localizados');
        const inputPendentes = document.getElementById('busca-pendentes');
        const inputBipados = document.getElementById('busca-bipados');

        if (inputLocalizados) {
            inputLocalizados.addEventListener('input', (e) => {
                _buscaLocalizadosDebounced(e.target.value);
            });
        }

        if (inputPendentes) {
            inputPendentes.addEventListener('input', (e) => {
                _buscaPendentesDebounced(e.target.value);
            });
        }

        if (inputBipados) {
            inputBipados.addEventListener('input', (e) => {
                _buscaBipadosDebounced(e.target.value);
            });
        }
    }

    // ==================== COORDENAÇÃO ====================

    /**
     * Configura seleção de coordenação
     */
    function _setupCoordenacao() {
        const select = document.getElementById('select-coordenacao');
        if (select) {
            select.addEventListener('change', () => {
                UI.renderizarPorCoordenacao(select.value);
            });
        }
    }

    /**
     * Exporta por coordenação
     */
    function exportarPorCoordenacao() {
        const select = document.getElementById('select-coordenacao');
        if (!select || !select.value) {
            UI.toast('Selecione uma coordenação primeiro', 'warning');
            return;
        }

        CSV.exportar('coordenacao', select.value);
    }

    // ==================== BACKUP ====================

    /**
     * Configura backup e restauração
     */
    function _setupBackup() {
        const inputRestore = document.getElementById('input-restore-backup');
        if (inputRestore) {
            inputRestore.addEventListener('change', _importarBackup);
        }
    }

    /**
     * Exporta backup em JSON
     */
    function exportarBackup() {
        const backup = Storage.exportarBackup();
        const json = JSON.stringify(backup, null, 2);
        
        const blob = new Blob([json], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `backup_inventario_${new Date().toISOString().slice(0,10)}.json`;
        link.click();

        UI.toast('Backup exportado!', 'success');
    }

    /**
     * Importa backup de JSON
     */
    async function _importarBackup(event) {
        const arquivo = event.target.files[0];
        if (!arquivo) return;

        try {
            const texto = await arquivo.text();
            const backup = JSON.parse(texto);
            
            const resultado = Storage.importarBackup(backup);

            if (resultado.sucesso) {
                // Reinicializa dados
                Inventario.inicializar();
                UI.atualizarEstatisticas();
                UI.renderizarHistorico();
                UI.toast(resultado.mensagem, 'success');
            } else {
                UI.toast(resultado.mensagem, 'error');
            }
        } catch (e) {
            UI.toast('Erro ao ler arquivo de backup', 'error');
        }

        // Limpa input
        event.target.value = '';
    }

    /**
     * Abre diálogo de importar backup
     */
    function importarBackup() {
        const input = document.getElementById('input-restore-backup');
        if (input) input.click();
    }

    // ==================== EXPORTAÇÕES CSV ====================

    /**
     * Exporta CSV por tipo
     */
    function exportarCSV(tipo) {
        CSV.exportar(tipo);
    }

    // ==================== LIMPEZA ====================

    /**
     * Limpa todas as bipagens
     */
    async function limparBipagens() {
        const stats = Inventario.obterEstatisticas();
        
        if (stats.bipados === 0) {
            UI.toast('Não há bipagens para limpar', 'warning');
            return;
        }

        const confirmado = await UI.confirmar({
            titulo: '🗑️ Limpar Bipagens',
            mensagem: `Deseja limpar ${stats.bipados} bipagens? O inventário será mantido.`,
            textoBotaoConfirmar: 'Limpar',
            tipo: 'danger'
        });

        if (!confirmado) return;

        Inventario.limparBipagens();
        UI.atualizarEstatisticas();
        UI.renderizarHistorico();

        const resultEl = document.getElementById('scan-result');
        if (resultEl) resultEl.style.display = 'none';

        UI.toast('Bipagens removidas!', 'success');
    }

    /**
     * Limpa todos os dados
     */
    async function limparTudo() {
        const confirmado = await UI.confirmar({
            titulo: '⚠️ Resetar Sistema',
            mensagem: 'Isso vai apagar TODOS os dados: inventário, bipagens e histórico. Esta ação é irreversível!',
            textoBotaoConfirmar: 'Resetar Tudo',
            tipo: 'danger'
        });

        if (!confirmado) return;

        Inventario.limparTudo();
        UI.atualizarEstatisticas();
        UI.renderizarHistorico();

        const resultEl = document.getElementById('scan-result');
        if (resultEl) resultEl.style.display = 'none';

        const statusEl = document.getElementById('import-status');
        if (statusEl) statusEl.innerHTML = '';

        UI.toast('Sistema resetado!', 'success');
    }

    // ==================== ORDENAÇÃO DE TABELAS ====================

    /**
     * Ordena tabela por coluna
     */
    function ordenarTabela(tabela, coluna) {
        UI.setOrdenacao(tabela, coluna);
    }

    // ==================== API PÚBLICA ====================

    // Inicializa quando DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inicializar);
    } else {
        // DOM já está pronto
        inicializar();
    }

    return {
        // Scanner
        setModoScanner,
        verificarPatrimonio,
        iniciarCamera,
        pararCamera,
        
        // Exportação
        exportarCSV,
        exportarPorCoordenacao,
        
        // Backup
        exportarBackup,
        importarBackup,
        
        // Limpeza
        limparBipagens,
        limparTudo,
        
        // Ordenação
        ordenarTabela,
        
        // Câmera (delegação)
        ajustarZoom: (v) => Camera.ajustarZoom(v),
        toggleFlash: () => Camera.toggleFlash(),
        setTamanhoArea: (t) => Camera.setTamanhoArea(t)
    };
})();

// Expõe globalmente para uso no HTML
window.App = App;

// Aliases para compatibilidade com onclick no HTML
// Usamos funções wrapper para garantir que App existe quando chamadas
window.setMode = function(modo) { App.setModoScanner(modo); };
window.verificarPatrimonio = function() { App.verificarPatrimonio(); };
window.iniciarCamera = function() { App.iniciarCamera(); };
window.pararCamera = function() { App.pararCamera(); };
window.exportarCSV = function(tipo) { App.exportarCSV(tipo); };
window.exportarPorCoordenacao = function() { App.exportarPorCoordenacao(); };
window.exportarBackup = function() { App.exportarBackup(); };
window.importarBackup = function() { App.importarBackup(); };
window.limparBipagens = function() { App.limparBipagens(); };
window.limparTudo = function() { App.limparTudo(); };
window.ajustarZoom = function(v) { App.ajustarZoom(v); };
window.toggleFlash = function() { App.toggleFlash(); };
window.setOverlaySize = function(t) { App.setTamanhoArea(t); };