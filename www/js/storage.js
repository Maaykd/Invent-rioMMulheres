/**
 * storage.js - Gerenciamento de persistência de dados
 * Centraliza todas as operações de localStorage
 */

const Storage = (function() {
    'use strict';

    // Chaves do localStorage (versionadas para facilitar migrações)
    const KEYS = {
        INVENTARIO: 'inventario_v4',
        BIPAGENS: 'bipagens_v4',
        HISTORICO: 'historico_v4',
        CONFIG: 'config_v4'
    };

    /**
     * Salva dados no localStorage
     * @param {string} key - Chave de armazenamento
     * @param {*} data - Dados a serem salvos
     * @returns {boolean} Sucesso da operação
     */
    function salvar(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error('Erro ao salvar no localStorage:', e);
            return false;
        }
    }

    /**
     * Carrega dados do localStorage
     * @param {string} key - Chave de armazenamento
     * @param {*} defaultValue - Valor padrão se não encontrar
     * @returns {*} Dados carregados ou valor padrão
     */
    function carregar(key, defaultValue = null) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : defaultValue;
        } catch (e) {
            console.error('Erro ao carregar do localStorage:', e);
            return defaultValue;
        }
    }

    /**
     * Remove dados do localStorage
     * @param {string} key - Chave a remover
     */
    function remover(key) {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.error('Erro ao remover do localStorage:', e);
        }
    }

    // ==================== API ESPECÍFICA ====================

    /**
     * Salva o inventário
     * @param {Array} inventario - Lista de itens
     */
    function salvarInventario(inventario) {
        return salvar(KEYS.INVENTARIO, inventario);
    }

    /**
     * Carrega o inventário
     * @returns {Array} Lista de itens do inventário
     */
    function carregarInventario() {
        return carregar(KEYS.INVENTARIO, []);
    }

    /**
     * Salva as bipagens
     * @param {Object} bipagens - Mapa patrimônio -> data
     */
    function salvarBipagens(bipagens) {
        return salvar(KEYS.BIPAGENS, bipagens);
    }

    /**
     * Carrega as bipagens
     * @returns {Object} Mapa de bipagens
     */
    function carregarBipagens() {
        return carregar(KEYS.BIPAGENS, {});
    }

    /**
     * Salva o histórico de leituras
     * @param {Array} historico - Lista de leituras
     */
    function salvarHistorico(historico) {
        return salvar(KEYS.HISTORICO, historico);
    }

    /**
     * Carrega o histórico de leituras
     * @returns {Array} Lista de leituras
     */
    function carregarHistorico() {
        return carregar(KEYS.HISTORICO, []);
    }

    /**
     * Salva todos os dados de uma vez
     * @param {Object} dados - { inventario, bipagens, historico }
     */
    function salvarTudo(dados) {
        if (dados.inventario !== undefined) salvarInventario(dados.inventario);
        if (dados.bipagens !== undefined) salvarBipagens(dados.bipagens);
        if (dados.historico !== undefined) salvarHistorico(dados.historico);
    }

    /**
     * Carrega todos os dados
     * @returns {Object} { inventario, bipagens, historico }
     */
    function carregarTudo() {
        return {
            inventario: carregarInventario(),
            bipagens: carregarBipagens(),
            historico: carregarHistorico()
        };
    }

    /**
     * Limpa todos os dados do sistema
     */
    function limparTudo() {
        remover(KEYS.INVENTARIO);
        remover(KEYS.BIPAGENS);
        remover(KEYS.HISTORICO);
        remover(KEYS.CONFIG);
    }

    /**
     * Limpa apenas as bipagens
     */
    function limparBipagens() {
        remover(KEYS.BIPAGENS);
        remover(KEYS.HISTORICO);
    }

    // ==================== BACKUP/RESTAURAÇÃO ====================

    /**
     * Exporta backup completo em JSON
     * @returns {Object} Objeto com todos os dados para backup
     */
    function exportarBackup() {
        return {
            versao: '4.0',
            dataExportacao: new Date().toISOString(),
            dados: carregarTudo()
        };
    }

    /**
     * Importa backup de JSON
     * @param {Object} backup - Objeto de backup
     * @returns {Object} { sucesso: boolean, mensagem: string }
     */
    function importarBackup(backup) {
        try {
            // Validação básica
            if (!backup || typeof backup !== 'object') {
                return { sucesso: false, mensagem: 'Arquivo de backup inválido' };
            }

            // Verifica estrutura do backup
            if (!backup.dados) {
                return { sucesso: false, mensagem: 'Estrutura do backup incorreta' };
            }

            const { inventario, bipagens, historico } = backup.dados;

            // Valida tipos
            if (inventario && !Array.isArray(inventario)) {
                return { sucesso: false, mensagem: 'Inventário inválido no backup' };
            }

            if (bipagens && typeof bipagens !== 'object') {
                return { sucesso: false, mensagem: 'Bipagens inválidas no backup' };
            }

            if (historico && !Array.isArray(historico)) {
                return { sucesso: false, mensagem: 'Histórico inválido no backup' };
            }

            // Salva os dados
            salvarTudo({
                inventario: inventario || [],
                bipagens: bipagens || {},
                historico: historico || []
            });

            return { 
                sucesso: true, 
                mensagem: `Backup restaurado! ${inventario?.length || 0} itens, ${Object.keys(bipagens || {}).length} bipagens.` 
            };
        } catch (e) {
            console.error('Erro ao importar backup:', e);
            return { sucesso: false, mensagem: 'Erro ao processar arquivo de backup' };
        }
    }

    /**
     * Verifica espaço usado no localStorage
     * @returns {Object} { usado: number, limite: number, percentual: number }
     */
    function verificarEspaco() {
        let usado = 0;
        for (const key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                usado += localStorage[key].length * 2; // UTF-16 = 2 bytes por char
            }
        }
        const limite = 5 * 1024 * 1024; // 5MB típico
        return {
            usado,
            limite,
            percentual: Math.round((usado / limite) * 100)
        };
    }

    // API pública
    return {
        KEYS,
        salvar,
        carregar,
        remover,
        salvarInventario,
        carregarInventario,
        salvarBipagens,
        carregarBipagens,
        salvarHistorico,
        carregarHistorico,
        salvarTudo,
        carregarTudo,
        limparTudo,
        limparBipagens,
        exportarBackup,
        importarBackup,
        verificarEspaco
    };
})();

window.Storage = Storage;