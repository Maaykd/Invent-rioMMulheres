/**
 * utils.js - Funções utilitárias
 * Contém: debounce, sanitização, formatação de datas, sons
 */

const Utils = (function() {
    'use strict';

    /**
     * Debounce - Atrasa a execução de uma função
     * Usado nos campos de busca para evitar processamento excessivo
     * @param {Function} func - Função a ser executada
     * @param {number} wait - Tempo de espera em ms (padrão: 300ms)
     * @returns {Function} Função com debounce aplicado
     */
    function debounce(func, wait = 300) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Sanitiza uma string para prevenir XSS
     * Remove caracteres perigosos e escapa HTML
     * @param {string} str - String a ser sanitizada
     * @returns {string} String sanitizada
     */
    function sanitizar(str) {
        if (str === null || str === undefined) return '';
        if (typeof str !== 'string') str = String(str);
        
        // Cria um elemento temporário para escapar HTML
        const temp = document.createElement('div');
        temp.textContent = str;
        return temp.innerHTML
            .replace(/javascript:/gi, '')
            .replace(/on\w+=/gi, '')
            .trim();
    }

    /**
     * Sanitiza um objeto inteiro (usado para dados do CSV)
     * @param {Object} obj - Objeto a ser sanitizado
     * @returns {Object} Objeto com valores sanitizados
     */
    function sanitizarObjeto(obj) {
        const resultado = {};
        for (const [chave, valor] of Object.entries(obj)) {
            resultado[chave] = sanitizar(valor);
        }
        return resultado;
    }

    /**
     * Formata data para exibição (pt-BR)
     * @param {string} dataStr - String de data ISO
     * @returns {string} Data formatada ou '-'
     */
    function formatarData(dataStr) {
        if (!dataStr) return '-';
        try {
            return new Date(dataStr).toLocaleString('pt-BR');
        } catch {
            return '-';
        }
    }

    /**
     * Formata apenas a hora
     * @param {string} dataStr - String de data ISO
     * @returns {string} Hora formatada
     */
    function formatarHora(dataStr) {
        if (!dataStr) return '';
        try {
            return new Date(dataStr).toLocaleTimeString('pt-BR', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        } catch {
            return '';
        }
    }

    /**
     * Toca um som de feedback
     * @param {string} tipo - Tipo do som: 'sucesso', 'alerta', 'erro'
     */
    function tocarSom(tipo) {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            gain.gain.value = 0.12;

            const configs = {
                sucesso: { freq: 880, type: 'sine' },
                alerta: { freq: 440, type: 'triangle' },
                erro: { freq: 220, type: 'square' }
            };

            const config = configs[tipo] || configs.erro;
            osc.frequency.value = config.freq;
            osc.type = config.type;

            osc.start();
            setTimeout(() => {
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
                setTimeout(() => osc.stop(), 150);
            }, 100);
        } catch (e) {
            // Silencia erro se AudioContext não estiver disponível
        }
    }

    /**
     * Normaliza string para comparação (remove acentos, lowercase)
     * @param {string} str - String a normalizar
     * @returns {string} String normalizada
     */
    function normalizar(str) {
        if (!str) return '';
        return str
            .toString()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    }

    /**
     * Gera ID único
     * @returns {string} ID único
     */
    function gerarId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * Valida se string é um patrimônio válido
     * @param {string} patrimonio - Número do patrimônio
     * @returns {boolean} Se é válido
     */
    function validarPatrimonio(patrimonio) {
        if (!patrimonio) return false;
        const limpo = patrimonio.toString().trim();
        return limpo.length > 0 && limpo.length <= 50;
    }

    /**
     * Formata valor monetário
     * @param {number|string} valor - Valor a formatar
     * @returns {string} Valor formatado em BRL
     */
    function formatarMoeda(valor) {
        if (!valor) return '-';
        const numero = parseFloat(valor);
        if (isNaN(numero)) return '-';
        return numero.toLocaleString('pt-BR', { 
            style: 'currency', 
            currency: 'BRL' 
        });
    }

    // API pública do módulo
    return {
        debounce,
        sanitizar,
        sanitizarObjeto,
        formatarData,
        formatarHora,
        tocarSom,
        normalizar,
        gerarId,
        validarPatrimonio,
        formatarMoeda
    };
})();

// Exporta para uso global
window.Utils = Utils;