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
     * @param {string} modo - 'manual', 'camera' ou 'lote'
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
        const secaoLote = document.getElementById('section-lote');

        if (secaoManual) secaoManual.style.display = modo === 'manual' ? 'block' : 'none';
        if (secaoCamera) secaoCamera.classList.toggle('active', modo === 'camera');
        if (secaoLote) secaoLote.style.display = modo === 'lote' ? 'block' : 'none';

        // Para câmera se mudou para outro modo
        if (modo !== 'camera') {
            Camera.parar();
        }
        
        // Foca no input correto
        if (modo === 'manual') {
            const input = document.getElementById('input-patrimonio');
            if (input) input.focus();
        } else if (modo === 'lote') {
            const textarea = document.getElementById('input-lote');
            if (textarea) textarea.focus();
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

    // ==================== PROCESSAMENTO EM LOTE ====================

    /**
     * Processa lista de patrimônios em lote
     */
    function processarLote() {
        const textarea = document.getElementById('input-lote');
        if (!textarea) return;

        const texto = textarea.value.trim();
        if (!texto) {
            UI.toast('Cole uma lista de patrimônios', 'warning');
            return;
        }

        // Extrai patrimônios (aceita vírgula, ponto-vírgula, tab, quebra de linha)
        const patrimonios = texto
            .split(/[,;\t\n\r]+/)
            .map(p => p.trim())
            .filter(p => p.length > 0);

        // Remove duplicatas mantendo ordem
        const unicos = [...new Set(patrimonios)];

        if (unicos.length === 0) {
            UI.toast('Nenhum patrimônio válido encontrado', 'warning');
            return;
        }

        // Contadores
        let sucesso = 0;
        let jaBipado = 0;
        let naoEncontrado = 0;
        const detalhes = {
            sucesso: [],
            jaBipado: [],
            naoEncontrado: []
        };

        // Processa cada patrimônio
        for (const patrimonio of unicos) {
            if (!Utils.validarPatrimonio(patrimonio)) {
                naoEncontrado++;
                detalhes.naoEncontrado.push(patrimonio);
                continue;
            }

            const resultado = Inventario.registrarBipagem(patrimonio);

            switch (resultado.status) {
                case 'sucesso':
                    sucesso++;
                    detalhes.sucesso.push(patrimonio);
                    Inventario.adicionarHistorico(resultado);
                    break;
                case 'ja_bipado':
                    jaBipado++;
                    detalhes.jaBipado.push(patrimonio);
                    break;
                default:
                    naoEncontrado++;
                    detalhes.naoEncontrado.push(patrimonio);
            }
        }

        // Mostra resultado
        _mostrarResultadoLote(sucesso, jaBipado, naoEncontrado, detalhes);

        // Atualiza UI
        UI.atualizarEstatisticas();
        UI.renderizarHistorico();

        // Feedback
        if (sucesso > 0) {
            Utils.tocarSom('sucesso');
            UI.toast(`${sucesso} patrimônio(s) registrado(s)!`, 'success');
        } else if (jaBipado > 0 && naoEncontrado === 0) {
            Utils.tocarSom('alerta');
            UI.toast('Todos já estavam bipados', 'warning');
        } else {
            Utils.tocarSom('erro');
            UI.toast('Nenhum patrimônio novo registrado', 'error');
        }
    }

    /**
     * Mostra resultado do processamento em lote na interface
     */
    function _mostrarResultadoLote(sucesso, jaBipado, naoEncontrado, detalhes) {
        const container = document.getElementById('lote-resultado');
        if (!container) return;

        // Atualiza números
        document.getElementById('lote-sucesso').textContent = sucesso;
        document.getElementById('lote-ja-bipado').textContent = jaBipado;
        document.getElementById('lote-nao-encontrado').textContent = naoEncontrado;

        // Monta detalhes
        let html = '';
        
        if (detalhes.naoEncontrado.length > 0) {
            html += `<div class="detalhe-grupo erro">
                <strong>❌ Não encontrados (${detalhes.naoEncontrado.length}):</strong>
                <div class="lista-patrimonios">${detalhes.naoEncontrado.join(', ')}</div>
            </div>`;
        }
        
        if (detalhes.jaBipado.length > 0) {
            html += `<div class="detalhe-grupo alerta">
                <strong>⚠️ Já bipados (${detalhes.jaBipado.length}):</strong>
                <div class="lista-patrimonios">${detalhes.jaBipado.join(', ')}</div>
            </div>`;
        }
        
        if (detalhes.sucesso.length > 0) {
            html += `<div class="detalhe-grupo sucesso">
                <strong>✅ Registrados (${detalhes.sucesso.length}):</strong>
                <div class="lista-patrimonios">${detalhes.sucesso.join(', ')}</div>
            </div>`;
        }

        document.getElementById('lote-detalhes').innerHTML = html;
        container.style.display = 'block';
    }

    /**
     * Limpa textarea e resultado do lote
     */
    function limparLote() {
        const textarea = document.getElementById('input-lote');
        if (textarea) {
            textarea.value = '';
            textarea.focus();
        }

        const resultado = document.getElementById('lote-resultado');
        if (resultado) {
            resultado.style.display = 'none';
        }
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
        input.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                _processarUpload(e.target.files[0]);
            }
        });
    }

    /**
     * Processa arquivo CSV enviado
     */
    async function _processarUpload(arquivo) {
        const statusEl = document.getElementById('import-status');
        
        try {
            if (statusEl) {
                statusEl.innerHTML = '<div class="info-box">⏳ Processando arquivo...</div>';
            }

            const resultado = await CSV.processarArquivo(arquivo);

            if (resultado.erros.length > 0) {
                console.warn('[App] Avisos na importação:', resultado.erros);
            }

            if (resultado.dados.length === 0) {
                throw new Error('Nenhum dado válido encontrado no arquivo');
            }

            // Importa para o inventário
            const stats = Inventario.importar(resultado.dados);

            // Atualiza UI
            UI.atualizarEstatisticas();

            // Mostra resultado
            if (statusEl) {
                statusEl.innerHTML = `
                    <div class="info-box" style="background: #d4edda; border-color: #28a745;">
                        ✅ <strong>Importação concluída!</strong><br>
                        📦 Total: ${stats.total} itens<br>
                        ✅ Localizados: ${stats.localizados}<br>
                        ⏳ Pendentes: ${stats.pendentes}
                        ${resultado.erros.length > 0 ? `<br><br>⚠️ ${resultado.erros.length} aviso(s)` : ''}
                    </div>
                `;
            }

            UI.toast('Inventário importado com sucesso!', 'success');

        } catch (e) {
            console.error('[App] Erro no upload:', e);
            
            if (statusEl) {
                statusEl.innerHTML = `
                    <div class="info-box" style="background: #f8d7da; border-color: #dc3545;">
                        ❌ <strong>Erro na importação</strong><br>
                        ${e.message}
                    </div>
                `;
            }

            UI.toast('Erro ao importar arquivo', 'error');
        }

        // Limpa input
        const input = document.getElementById('arquivo-csv');
        if (input) input.value = '';
    }

    // ==================== BUSCAS ====================

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
        
        // Lote
        processarLote,
        limparLote,
        
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
window.setMode = function(modo) { App.setModoScanner(modo); };
window.verificarPatrimonio = function() { App.verificarPatrimonio(); };
window.iniciarCamera = function() { App.iniciarCamera(); };
window.pararCamera = function() { App.pararCamera(); };
window.processarLote = function() { App.processarLote(); };
window.limparLote = function() { App.limparLote(); };
window.exportarCSV = function(tipo) { App.exportarCSV(tipo); };
window.exportarPorCoordenacao = function() { App.exportarPorCoordenacao(); };
window.exportarBackup = function() { App.exportarBackup(); };
window.importarBackup = function() { App.importarBackup(); };
window.limparBipagens = function() { App.limparBipagens(); };
window.limparTudo = function() { App.limparTudo(); };
window.ajustarZoom = function(v) { App.ajustarZoom(v); };
window.toggleFlash = function() { App.toggleFlash(); };
window.setOverlaySize = function(t) { App.setTamanhoArea(t); };

// ==================== MENU HAMBÚRGUER ====================

let _menuAberto = false;

/**
 * Toggle do menu lateral
 */
function toggleMenu() {
    if (_menuAberto) {
        fecharMenu();
    } else {
        abrirMenu();
    }
}

/**
 * Abre o menu lateral
 */
function abrirMenu() {
    _menuAberto = true;
    document.body.classList.add('menu-open');
    _atualizarMenuStats();
}

/**
 * Fecha o menu lateral
 */
function fecharMenu() {
    _menuAberto = false;
    document.body.classList.remove('menu-open');
}

/**
 * Atualiza estatísticas no menu
 */
function _atualizarMenuStats() {
    const stats = Inventario.obterEstatisticas();
    
    // Menu stats
    const menuTotal = document.getElementById('menu-stat-total');
    const menuLocalizados = document.getElementById('menu-stat-localizados');
    const menuPendentes = document.getElementById('menu-stat-pendentes');
    
    if (menuTotal) menuTotal.textContent = stats.total;
    if (menuLocalizados) menuLocalizados.textContent = stats.localizados;
    if (menuPendentes) menuPendentes.textContent = stats.pendentes;
    
    // Menu badges
    const badgeLocalizados = document.getElementById('menu-badge-localizados');
    const badgePendentes = document.getElementById('menu-badge-pendentes');
    const badgeBipados = document.getElementById('menu-badge-bipados');
    
    if (badgeLocalizados) badgeLocalizados.textContent = stats.localizados;
    if (badgePendentes) badgePendentes.textContent = stats.pendentes;
    if (badgeBipados) badgeBipados.textContent = stats.bipados;
    
    // Mini stat no header
    const miniStat = document.getElementById('mini-stat-total');
    if (miniStat) miniStat.textContent = stats.total;
}

/**
 * Navega para uma aba específica
 */
function navegarPara(aba) {
    // Fecha menu mobile
    fecharMenu();

    // Atualiza menu items
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.toggle('active', item.dataset.tab === aba);
    });

    // Atualiza quick nav
    document.querySelectorAll('.quick-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === aba);
    });

    // Atualiza tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === aba);
    });

    // Atualiza painéis
    document.querySelectorAll('.panel').forEach(panel => {
        panel.classList.remove('active');
    });
    
    const painel = document.getElementById(`panel-${aba}`);
    if (painel) {
        painel.classList.add('active');
    }

    // Carrega conteúdo
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
            break;
    }

    // Scroll para o topo
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Atualiza stats do menu
    _atualizarMenuStats();
}

// Expõe funções globalmente
window.toggleMenu = toggleMenu;
window.navegarPara = navegarPara;