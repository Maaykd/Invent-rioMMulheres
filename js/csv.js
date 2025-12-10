/**
 * csv.js - Processamento de arquivos CSV
 * Importação, exportação, parsing
 * Suporte a UTF-8 e Latin-1 (ISO-8859-1)
 */

const CSV = (function() {
    'use strict';

    /**
     * Detecta o separador usado no CSV
     * @param {string} texto - Primeira linha do CSV
     * @returns {string} Separador detectado (';' ou ',')
     */
    function detectarSeparador(texto) {
        const primeiraLinha = texto.split('\n')[0];
        const contaPontoVirgula = (primeiraLinha.match(/;/g) || []).length;
        const contaVirgula = (primeiraLinha.match(/,/g) || []).length;
        return contaPontoVirgula > contaVirgula ? ';' : ',';
    }

    /**
     * Normaliza nome de coluna para chave de objeto
     * Lida com diferentes encodings e variações
     * @param {string} nome - Nome da coluna
     * @returns {string} Nome normalizado
     */
    function normalizarColuna(nome) {
        if (!nome) return '';
        
        let normalizado = nome
            .toString()
            .trim()
            .toLowerCase()
            // Remove acentos (funciona com UTF-8)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            // Remove caracteres não ASCII (pega Latin-1 corrompido)
            .replace(/[^\x00-\x7F]/g, '')
            // Substitui espaços e caracteres especiais por _
            .replace(/[^a-z0-9]/g, '_')
            // Remove underscores múltiplos
            .replace(/_+/g, '_')
            // Remove underscores no início e fim
            .replace(/^_|_$/g, '');
        
        // Mapeamento flexível - busca por palavras-chave
        // Isso funciona mesmo se o encoding estiver corrompido
        const mapeamentos = [
            { busca: ['patrimonio', 'patrim_nio', 'patrim'], resultado: 'patrimonio' },
            { busca: ['codigo_do_item', 'codigo_item', 'cod_item', 'codigo'], resultado: 'codigo_item' },
            { busca: ['descricao_do_bem', 'descri_o_do_bem', 'descricao', 'descri_o', 'desc_bem'], resultado: 'descricao' },
            { busca: ['categoria', 'categ'], resultado: 'categoria' },
            { busca: ['valor', 'val'], resultado: 'valor' },
            { busca: ['uorgs_destino', 'uorg_destino', 'uorgs', 'uorg'], resultado: 'uorg_destino' },
            { busca: ['coordenacao_destino', 'coordena_o_destino', 'coordena_destino', 'coord_destino', 'coordena_o', 'coordena'], resultado: 'coordenacao_destino' },
            { busca: ['localidade', 'local'], resultado: 'localidade' }
        ];
        
        for (const map of mapeamentos) {
            for (const termo of map.busca) {
                if (normalizado === termo || normalizado.includes(termo)) {
                    return map.resultado;
                }
            }
        }
        
        return normalizado;
    }

    /**
     * Parse de CSV para array de objetos
     * @param {string} texto - Conteúdo do CSV
     * @returns {Object} { dados: Array, colunas: Array, erros: Array }
     */
    function parse(texto) {
        const erros = [];
        
        if (!texto || typeof texto !== 'string') {
            return { dados: [], colunas: [], erros: ['Arquivo vazio ou inválido'] };
        }

        // Detecta separador
        const separador = detectarSeparador(texto);
        
        // Divide em linhas (remove linhas vazias)
        const linhas = texto
            .split(/\r?\n/)
            .map(l => l.trim())
            .filter(l => l.length > 0);

        if (linhas.length < 2) {
            return { dados: [], colunas: [], erros: ['Arquivo precisa ter cabeçalho e pelo menos uma linha de dados'] };
        }

        // Extrai cabeçalhos
        const cabecalhosOriginais = linhas[0].split(separador).map(h => h.replace(/^["']|["']$/g, '').trim());
        const cabecalhos = cabecalhosOriginais.map(h => normalizarColuna(h));
        
        console.log('[CSV] Cabeçalhos originais:', cabecalhosOriginais);
        console.log('[CSV] Cabeçalhos normalizados:', cabecalhos);

        // Verifica coluna obrigatória
        if (!cabecalhos.includes('patrimonio')) {
            return { dados: [], colunas: cabecalhos, erros: ['Coluna "patrimonio" não encontrada. Colunas detectadas: ' + cabecalhos.join(', ')] };
        }

        // Processa linhas de dados
        const dados = [];
        
        for (let i = 1; i < linhas.length; i++) {
            try {
                const valores = parseLinhaCSV(linhas[i], separador);
                
                if (valores.length !== cabecalhos.length) {
                    // Tenta ajustar se tiver colunas a mais ou a menos
                    while (valores.length < cabecalhos.length) valores.push('');
                    if (valores.length > cabecalhos.length) valores.length = cabecalhos.length;
                }

                const item = {};
                for (let j = 0; j < cabecalhos.length; j++) {
                    // Sanitiza o valor
                    item[cabecalhos[j]] = Utils.sanitizar(valores[j]);
                }

                // Valida patrimônio
                if (!item.patrimonio || item.patrimonio.trim() === '') {
                    continue; // Pula linhas sem patrimônio
                }

                dados.push(item);
            } catch (e) {
                erros.push(`Linha ${i + 1}: erro ao processar - ${e.message}`);
            }
        }

        return { dados, colunas: cabecalhos, erros };
    }

    /**
     * Parse de uma linha CSV considerando aspas
     * @param {string} linha - Linha a processar
     * @param {string} separador - Separador usado
     * @returns {Array} Valores da linha
     */
    function parseLinhaCSV(linha, separador) {
        const valores = [];
        let valorAtual = '';
        let dentroAspas = false;
        let charAspas = null;

        for (let i = 0; i < linha.length; i++) {
            const char = linha[i];
            const nextChar = linha[i + 1];

            if (!dentroAspas && (char === '"' || char === "'")) {
                dentroAspas = true;
                charAspas = char;
            } else if (dentroAspas && char === charAspas) {
                if (nextChar === charAspas) {
                    // Aspas escapadas
                    valorAtual += char;
                    i++;
                } else {
                    // Fim das aspas
                    dentroAspas = false;
                    charAspas = null;
                }
            } else if (!dentroAspas && char === separador) {
                valores.push(valorAtual.trim());
                valorAtual = '';
            } else {
                valorAtual += char;
            }
        }

        valores.push(valorAtual.trim());
        return valores;
    }

    /**
     * Gera CSV a partir de dados
     * @param {Array} colunas - Lista de colunas
     * @param {Array} dados - Lista de objetos
     * @param {string} separador - Separador (padrão ';')
     * @returns {string} Conteúdo CSV
     */
    function gerar(colunas, dados, separador = ';') {
        // Cabeçalho
        let csv = colunas.join(separador) + '\n';

        // Dados
        dados.forEach(item => {
            const linha = colunas.map(col => {
                let val = item[col];
                if (val === null || val === undefined) val = '';
                val = String(val);

                // Escapa valores com separador, aspas ou quebras de linha
                if (val.includes(separador) || val.includes('"') || val.includes('\n')) {
                    val = '"' + val.replace(/"/g, '""') + '"';
                }
                return val;
            });
            csv += linha.join(separador) + '\n';
        });

        return csv;
    }

    /**
     * Faz download de um arquivo CSV
     * @param {string} nomeArquivo - Nome do arquivo
     * @param {string} conteudo - Conteúdo CSV
     */
    function download(nomeArquivo, conteudo) {
        // BOM para Excel reconhecer UTF-8
        const blob = new Blob(['\ufeff' + conteudo], { 
            type: 'text/csv;charset=utf-8;' 
        });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = nomeArquivo;
        link.click();
        
        // Limpa URL
        setTimeout(() => URL.revokeObjectURL(link.href), 100);
    }

    /**
     * Exporta dados usando configuração do Inventario
     * @param {string} tipo - Tipo de exportação
     * @param {string} coordenacao - Coordenação (opcional)
     * @returns {boolean} Sucesso
     */
    function exportar(tipo, coordenacao = null) {
        const config = Inventario.prepararExportacao(tipo, coordenacao);
        
        if (config.erro) {
            if (typeof UI !== 'undefined') UI.toast(config.erro, 'error');
            return false;
        }

        if (config.dados.length === 0) {
            if (typeof UI !== 'undefined') UI.toast('Nenhum dado para exportar', 'warning');
            return false;
        }

        const csv = gerar(config.colunas, config.dados);
        download(config.nomeArquivo, csv);
        if (typeof UI !== 'undefined') UI.toast(`Exportado: ${config.nomeArquivo}`, 'success');
        return true;
    }

    /**
     * Processa arquivo de upload
     * Tenta Latin-1 primeiro (comum em Excel BR), depois UTF-8
     * @param {File} arquivo - Arquivo selecionado
     * @returns {Promise} Promise com resultado do parse
     */
    function processarArquivo(arquivo) {
        return new Promise((resolve, reject) => {
            if (!arquivo) {
                reject(new Error('Nenhum arquivo selecionado'));
                return;
            }

            const extensao = arquivo.name.split('.').pop().toLowerCase();
            if (!['csv', 'txt'].includes(extensao)) {
                reject(new Error('Formato inválido. Use CSV ou TXT.'));
                return;
            }

            // Tenta ler como Latin-1 primeiro (mais comum em CSVs do Brasil/Excel)
            const reader = new FileReader();
            
            reader.onload = (e) => {
                let texto = e.target.result;
                
                // Se detectar caracteres de substituição, tenta UTF-8
                if (texto.includes('\uFFFD')) {
                    const reader2 = new FileReader();
                    reader2.onload = (e2) => {
                        const resultado = parse(e2.target.result);
                        resolve(resultado);
                    };
                    reader2.onerror = () => reject(new Error('Erro ao ler arquivo'));
                    reader2.readAsText(arquivo, 'UTF-8');
                } else {
                    const resultado = parse(texto);
                    resolve(resultado);
                }
            };
            
            reader.onerror = () => {
                reject(new Error('Erro ao ler arquivo'));
            };

            // Tenta ISO-8859-1 (Latin-1) primeiro - comum em Excel BR
            reader.readAsText(arquivo, 'ISO-8859-1');
        });
    }

    // API pública
    return {
        detectarSeparador,
        normalizarColuna,
        parse,
        gerar,
        download,
        exportar,
        processarArquivo
    };
})();

window.CSV = CSV;