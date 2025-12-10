/**
 * data.js - Classe Inventario centralizada
 * Gerencia: importação, indexação, estatísticas, filtros, bipagens
 * 
 * OTIMIZAÇÃO: Usa índices hash para acesso O(1) em vez de O(n)
 */

const Inventario = (function() {
    'use strict';

    // ==================== ESTADO INTERNO ====================
    
    // Lista principal de itens
    let _itens = [];
    
    // Registro de bipagens: patrimônio -> dataHora
    let _bipagens = {};
    
    // Histórico de leituras (últimas 50)
    let _historico = [];
    
    // ==================== ÍNDICES PARA ACESSO O(1) ====================
    
    // Índice por patrimônio (chave principal)
    let _indexPatrimonio = new Map();
    
    // Índice por coordenação destino
    let _indexPorCoordenacao = new Map();
    
    // Listas pré-processadas
    let _listaLocalizados = [];
    let _listaPendentes = [];
    let _listaBipados = [];
    
    // Cache de estatísticas
    let _estatisticas = {
        total: 0,
        localizados: 0,
        pendentes: 0,
        bipados: 0,
        percentual: 0
    };

    // ==================== INICIALIZAÇÃO ====================

    /**
     * Carrega dados do storage e reconstrói índices
     */
    function inicializar() {
        try {
            const dados = Storage.carregarTudo();
            _itens = dados.inventario || [];
            _bipagens = dados.bipagens || {};
            _historico = dados.historico || [];
            
            // Reconstrói todos os índices
            reconstruirIndices();
            
            console.log(`[Inventario] Inicializado: ${_itens.length} itens, ${Object.keys(_bipagens).length} bipagens`);
        } catch (e) {
            console.error('[Inventario] Erro na inicialização:', e);
            _itens = [];
            _bipagens = {};
            _historico = [];
            _atualizarEstatisticas();
        }
    }

    /**
     * Reconstrói todos os índices após importação ou alteração massiva
     * Complexidade: O(n) uma única vez
     */
    function reconstruirIndices() {
        // Limpa índices antigos
        _indexPatrimonio.clear();
        _indexPorCoordenacao.clear();
        _listaLocalizados = [];
        _listaPendentes = [];
        _listaBipados = [];

        // Reconstrói em uma única passagem
        for (const item of _itens) {
            const patrimonioUpper = (item.patrimonio || '').toUpperCase();
            
            // Índice por patrimônio
            _indexPatrimonio.set(patrimonioUpper, item);
            
            // Índice por coordenação destino
            const coord = (item.coordenacao_destino || '').trim();
            if (coord) {
                if (!_indexPorCoordenacao.has(coord)) {
                    _indexPorCoordenacao.set(coord, []);
                }
                _indexPorCoordenacao.get(coord).push(item);
            }
            
            // Listas pré-processadas
            const temUorg = item.uorg_destino && item.uorg_destino.trim() !== '';
            if (temUorg) {
                _listaLocalizados.push(item);
            } else {
                _listaPendentes.push(item);
            }
            
            // Lista de bipados
            if (_bipagens[item.patrimonio]) {
                _listaBipados.push(item);
            }
        }

        // Ordena listas
        _listaLocalizados.sort((a, b) => a.patrimonio.localeCompare(b.patrimonio));
        _listaPendentes.sort((a, b) => a.patrimonio.localeCompare(b.patrimonio));
        _listaBipados.sort((a, b) => {
            const dataA = _bipagens[a.patrimonio];
            const dataB = _bipagens[b.patrimonio];
            return new Date(dataB) - new Date(dataA); // Mais recentes primeiro
        });

        // Atualiza estatísticas
        _atualizarEstatisticas();
    }

    /**
     * Atualiza cache de estatísticas
     */
    function _atualizarEstatisticas() {
        _estatisticas.total = _itens.length;
        _estatisticas.localizados = _listaLocalizados.length;
        _estatisticas.pendentes = _listaPendentes.length;
        _estatisticas.bipados = Object.keys(_bipagens).length;
        _estatisticas.percentual = _estatisticas.total > 0 
            ? Math.round((_estatisticas.localizados / _estatisticas.total) * 100) 
            : 0;
    }

    // ==================== IMPORTAÇÃO ====================

    /**
     * Importa novos itens (substitui inventário atual)
     * @param {Array} novosItens - Lista de itens do CSV
     */
    function importar(novosItens) {
        // Sanitiza todos os itens
        _itens = novosItens.map(item => Utils.sanitizarObjeto(item));
        
        // Salva no storage
        Storage.salvarInventario(_itens);
        
        // Reconstrói índices
        reconstruirIndices();
        
        return {
            total: _itens.length,
            localizados: _estatisticas.localizados,
            pendentes: _estatisticas.pendentes
        };
    }

    // ==================== CONSULTAS O(1) ====================

    /**
     * Busca item por patrimônio - O(1)
     * @param {string} patrimonio - Número do patrimônio
     * @returns {Object|null} Item encontrado ou null
     */
    function buscarPorPatrimonio(patrimonio) {
        if (!patrimonio) return null;
        const key = patrimonio.toString().trim().toUpperCase();
        return _indexPatrimonio.get(key) || null;
    }

    /**
     * Obtém itens de uma coordenação - O(1)
     * @param {string} coordenacao - Nome da coordenação
     * @returns {Array} Lista de itens
     */
    function obterPorCoordenacao(coordenacao) {
        if (!coordenacao) return [];
        return _indexPorCoordenacao.get(coordenacao.trim()) || [];
    }

    /**
     * Lista todas as coordenações disponíveis
     * @returns {Array} Lista de coordenações únicas
     */
    function listarCoordenacoes() {
        return Array.from(_indexPorCoordenacao.keys()).sort();
    }

    // ==================== GETTERS DAS LISTAS ====================

    /**
     * Retorna lista de itens localizados
     * @param {string} busca - Termo de busca opcional
     * @returns {Array} Lista filtrada
     */
    function obterLocalizados(busca = '') {
        if (!busca) return _listaLocalizados;
        
        const termo = Utils.normalizar(busca);
        return _listaLocalizados.filter(item => 
            Utils.normalizar(item.patrimonio).includes(termo) ||
            Utils.normalizar(item.descricao || '').includes(termo)
        );
    }

    /**
     * Retorna lista de itens pendentes
     * @param {string} busca - Termo de busca opcional
     * @returns {Array} Lista filtrada
     */
    function obterPendentes(busca = '') {
        if (!busca) return _listaPendentes;
        
        const termo = Utils.normalizar(busca);
        return _listaPendentes.filter(item => 
            Utils.normalizar(item.patrimonio).includes(termo) ||
            Utils.normalizar(item.descricao || '').includes(termo)
        );
    }

    /**
     * Retorna lista de itens bipados
     * @param {string} busca - Termo de busca opcional
     * @returns {Array} Lista filtrada
     */
    function obterBipados(busca = '') {
        // Recalcula lista de bipados (pode ter mudado)
        _listaBipados = _itens.filter(item => _bipagens[item.patrimonio]);
        _listaBipados.sort((a, b) => {
            const dataA = _bipagens[a.patrimonio];
            const dataB = _bipagens[b.patrimonio];
            return new Date(dataB) - new Date(dataA);
        });

        if (!busca) return _listaBipados;
        
        const termo = Utils.normalizar(busca);
        return _listaBipados.filter(item => 
            Utils.normalizar(item.patrimonio).includes(termo) ||
            Utils.normalizar(item.descricao || '').includes(termo)
        );
    }

    /**
     * Retorna todos os itens
     * @returns {Array} Lista completa
     */
    function obterTodos() {
        return _itens;
    }

    /**
     * Retorna estatísticas atuais
     * @returns {Object} Estatísticas
     */
    function obterEstatisticas() {
        _atualizarEstatisticas();
        return { ..._estatisticas };
    }

    // ==================== BIPAGENS ====================

    /**
     * Registra uma bipagem
     * @param {string} patrimonio - Patrimônio bipado
     * @returns {Object} Resultado da bipagem
     */
    function registrarBipagem(patrimonio) {
        const patrimonioLimpo = patrimonio.toString().trim();
        const item = buscarPorPatrimonio(patrimonioLimpo);
        
        if (!item) {
            return {
                status: 'nao_encontrado',
                mensagem: 'Item não consta no inventário importado',
                patrimonio: patrimonioLimpo,
                timestamp: new Date().toISOString()
            };
        }
        
        if (_bipagens[item.patrimonio]) {
            return {
                status: 'ja_bipado',
                mensagem: 'Item já foi bipado nesta sessão',
                patrimonio: item.patrimonio,
                item: item,
                data_bipagem: _bipagens[item.patrimonio],
                timestamp: new Date().toISOString()
            };
        }
        
        // Registra nova bipagem
        const agora = new Date().toISOString();
        _bipagens[item.patrimonio] = agora;
        
        // Salva no storage
        Storage.salvarBipagens(_bipagens);
        
        // Atualiza estatísticas
        _atualizarEstatisticas();
        
        return {
            status: 'sucesso',
            mensagem: 'Item encontrado e registrado!',
            patrimonio: item.patrimonio,
            item: item,
            timestamp: agora
        };
    }

    /**
     * Verifica se item foi bipado
     * @param {string} patrimonio - Patrimônio a verificar
     * @returns {string|null} Data da bipagem ou null
     */
    function verificarBipagem(patrimonio) {
        return _bipagens[patrimonio] || null;
    }

    /**
     * Retorna todas as bipagens
     * @returns {Object} Mapa de bipagens
     */
    function obterBipagens() {
        return { ..._bipagens };
    }

    /**
     * Limpa todas as bipagens
     */
    function limparBipagens() {
        _bipagens = {};
        _historico = [];
        Storage.limparBipagens();
        _atualizarEstatisticas();
    }

    // ==================== HISTÓRICO ====================

    /**
     * Adiciona entrada ao histórico
     * @param {Object} entrada - Dados da leitura
     */
    function adicionarHistorico(entrada) {
        _historico.unshift(entrada);
        if (_historico.length > 50) {
            _historico.pop();
        }
        Storage.salvarHistorico(_historico);
    }

    /**
     * Retorna histórico de leituras
     * @param {number} limite - Número máximo de entradas
     * @returns {Array} Lista de leituras
     */
    function obterHistorico(limite = 10) {
        return _historico.slice(0, limite);
    }

    // ==================== RESET ====================

    /**
     * Limpa todos os dados do sistema
     */
    function limparTudo() {
        _itens = [];
        _bipagens = {};
        _historico = [];
        _indexPatrimonio.clear();
        _indexPorCoordenacao.clear();
        _listaLocalizados = [];
        _listaPendentes = [];
        _listaBipados = [];
        
        Storage.limparTudo();
        _atualizarEstatisticas();
    }

    // ==================== EXPORTAÇÃO DE DADOS ====================

    /**
     * Prepara dados para exportação CSV
     * @param {string} tipo - Tipo de exportação: 'localizados', 'pendentes', 'bipados', 'completo', 'coordenacao'
     * @param {string} coordenacao - Coordenação específica (quando tipo = 'coordenacao')
     * @returns {Object} { colunas, dados, nomeArquivo }
     */
    function prepararExportacao(tipo, coordenacao = null) {
        const agora = new Date().toISOString().slice(0, 10);
        let colunas, dados, nomeArquivo;

        switch (tipo) {
            case 'localizados':
                colunas = ['patrimonio', 'codigo_item', 'descricao', 'categoria', 'valor', 'uorg_destino', 'coordenacao_destino', 'localidade'];
                dados = _listaLocalizados;
                nomeArquivo = `itens_localizados_${agora}.csv`;
                break;

            case 'pendentes':
                colunas = ['patrimonio', 'codigo_item', 'descricao', 'categoria', 'valor', 'uorg_destino', 'coordenacao_destino', 'localidade', 'bipado'];
                dados = _listaPendentes.map(i => ({
                    ...i,
                    bipado: _bipagens[i.patrimonio] ? 'SIM' : 'NAO'
                }));
                nomeArquivo = `itens_pendentes_${agora}.csv`;
                break;

            case 'bipados':
                colunas = ['patrimonio', 'codigo_item', 'descricao', 'categoria', 'valor', 'uorg_destino', 'coordenacao_destino', 'localidade', 'data_bipagem'];
                dados = obterBipados().map(i => ({
                    ...i,
                    data_bipagem: _bipagens[i.patrimonio]
                }));
                nomeArquivo = `itens_bipados_${agora}.csv`;
                break;

            case 'coordenacao':
                if (!coordenacao) {
                    return { erro: 'Coordenação não especificada' };
                }
                colunas = ['patrimonio', 'codigo_item', 'descricao', 'categoria', 'valor', 'uorg_destino', 'coordenacao_destino', 'localidade', 'bipado', 'data_leitura'];
                const itensCoord = obterPorCoordenacao(coordenacao);
                dados = itensCoord.map(i => ({
                    ...i,
                    bipado: _bipagens[i.patrimonio] ? 'SIM' : 'NAO',
                    data_leitura: _bipagens[i.patrimonio] || ''
                }));
                nomeArquivo = `inventario_${coordenacao.replace(/[^a-z0-9]+/gi, '_')}.csv`;
                break;

            default: // completo
                colunas = ['patrimonio', 'codigo_item', 'descricao', 'categoria', 'valor', 'uorg_destino', 'coordenacao_destino', 'localidade', 'status_localizacao', 'bipado', 'data_bipagem'];
                dados = _itens.map(i => ({
                    ...i,
                    status_localizacao: (i.uorg_destino && i.uorg_destino.trim() !== '') ? 'LOCALIZADO' : 'PENDENTE',
                    bipado: _bipagens[i.patrimonio] ? 'SIM' : 'NAO',
                    data_bipagem: _bipagens[i.patrimonio] || ''
                }));
                nomeArquivo = `inventario_completo_${agora}.csv`;
        }

        return { colunas, dados, nomeArquivo };
    }

    // API pública
    return {
        inicializar,
        importar,
        reconstruirIndices,
        buscarPorPatrimonio,
        obterPorCoordenacao,
        listarCoordenacoes,
        obterLocalizados,
        obterPendentes,
        obterBipados,
        obterTodos,
        obterEstatisticas,
        registrarBipagem,
        verificarBipagem,
        obterBipagens,
        limparBipagens,
        adicionarHistorico,
        obterHistorico,
        limparTudo,
        prepararExportacao
    };
})();

window.Inventario = Inventario;