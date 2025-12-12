/**
 * ui.js - Gerenciamento da Interface do Usuário
 * Renderização segura, modais, toasts, ordenação de tabelas
 */

const UI = (function () {
    'use strict';

    // Estado de ordenação das tabelas
    const _ordenacao = {
        localizados: { coluna: 'patrimonio', direcao: 'asc' },
        pendentes: { coluna: 'patrimonio', direcao: 'asc' },
        bipados: { coluna: 'data_bipagem', direcao: 'desc' },
        coordenacao: { coluna: 'patrimonio', direcao: 'asc' }
    };

    // ==================== TOAST ====================

    /**
     * Exibe notificação toast
     * @param {string} mensagem - Texto da mensagem
     * @param {string} tipo - 'success', 'error', 'warning', 'info'
     */
    function toast(mensagem, tipo = 'info') {
        const t = document.getElementById('toast');
        if (!t) return;

        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        t.textContent = `${icons[tipo] || ''} ${mensagem}`;
        t.className = `toast ${tipo} show`;

        setTimeout(() => t.classList.remove('show'), 3500);
    }

    // ==================== LOADER ====================

    /**
     * Mostra loader de carregamento
     * @param {string} texto - Texto do loader
     */
    function mostrarLoader(texto = 'Carregando...') {
        let loader = document.getElementById('loader-overlay');

        if (!loader) {
            loader = document.createElement('div');
            loader.id = 'loader-overlay';
            loader.className = 'loader-overlay';
            loader.innerHTML = `
                <div class="loader-spinner"></div>
                <div class="loader-text">${Utils.sanitizar(texto)}</div>
            `;
            document.body.appendChild(loader);
        } else {
            const loaderText = loader.querySelector('.loader-text');
            if (loaderText) loaderText.textContent = texto;
        }

        // Força reflow antes de adicionar classe
        loader.offsetHeight;
        loader.classList.add('active');
    }

    /**
     * Esconde loader
     */
    function esconderLoader() {
        const loader = document.getElementById('loader-overlay');
        if (loader) {
            loader.classList.remove('active');
        }
    }

    // ==================== MODAL DE CONFIRMAÇÃO ====================

    /**
     * Mostra modal de confirmação
     * @param {Object} config - { titulo, mensagem, textoBotaoConfirmar, tipo }
     * @returns {Promise<boolean>} Resolução do usuário
     */
    function confirmar(config) {
        return new Promise((resolve) => {
            const {
                titulo = 'Confirmar',
                mensagem = 'Deseja continuar?',
                textoBotaoConfirmar = 'Confirmar',
                tipo = 'primary' // 'primary', 'danger'
            } = config;

            // Remove modal existente
            const existente = document.getElementById('modal-confirmacao');
            if (existente) existente.remove();

            // Cria modal
            const modal = document.createElement('div');
            modal.id = 'modal-confirmacao';
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-box">
                    <h3>${Utils.sanitizar(titulo)}</h3>
                    <p>${Utils.sanitizar(mensagem)}</p>
                    <div class="modal-actions">
                        <button class="btn btn-secondary" id="modal-cancelar">Cancelar</button>
                        <button class="btn btn-${tipo}" id="modal-confirmar">${Utils.sanitizar(textoBotaoConfirmar)}</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            // Força reflow
            modal.offsetHeight;
            modal.classList.add('active');

            // Handlers
            const fechar = (resultado) => {
                modal.classList.remove('active');
                setTimeout(() => modal.remove(), 300);
                resolve(resultado);
            };

            modal.querySelector('#modal-confirmar').onclick = () => fechar(true);
            modal.querySelector('#modal-cancelar').onclick = () => fechar(false);
            modal.onclick = (e) => {
                if (e.target === modal) fechar(false);
            };
        });
    }

    // ==================== RENDERIZAÇÃO SEGURA ====================

    /**
     * Cria elemento de célula de tabela de forma segura
     * @param {string} conteudo - Conteúdo da célula
     * @param {Object} opcoes - { html: boolean, classe: string }
     * @returns {HTMLElement} Elemento TD
     */
    function criarCelula(conteudo, opcoes = {}) {
        const td = document.createElement('td');

        if (opcoes.html) {
            // Usa sanitização antes de inserir HTML
            td.innerHTML = conteudo;
        } else {
            td.textContent = conteudo || '-';
        }

        if (opcoes.classe) {
            td.className = opcoes.classe;
        }

        return td;
    }

    /**
     * Cria linha de tabela de forma segura
     * @param {Array} colunas - Array de { valor, opcoes }
     * @returns {HTMLElement} Elemento TR
     */
    function criarLinha(colunas) {
        const tr = document.createElement('tr');
        colunas.forEach(col => {
            tr.appendChild(criarCelula(col.valor, col.opcoes));
        });
        return tr;
    }

    /**
     * Renderiza corpo da tabela de forma segura
     * @param {HTMLElement} tbody - Elemento tbody
     * @param {Array} dados - Dados a renderizar
     * @param {Function} renderizarLinha - Função que retorna array de colunas
     * @param {string} mensagemVazia - Mensagem quando não há dados
     */
    function renderizarTabela(tbody, dados, renderizarLinha, mensagemVazia = 'Nenhum item encontrado') {
        tbody.innerHTML = '';

        if (!dados || dados.length === 0) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 10;
            td.className = 'empty-state';
            td.innerHTML = `
                <div class="icon">📭</div>
                <p>${Utils.sanitizar(mensagemVazia)}</p>
            `;
            tr.appendChild(td);
            tbody.appendChild(tr);
            return;
        }

        dados.forEach(item => {
            const colunas = renderizarLinha(item);
            tbody.appendChild(criarLinha(colunas));
        });
    }

    // ==================== TABELAS ESPECÍFICAS ====================

    /**
     * Renderiza tabela de localizados
     * @param {string} busca - Termo de busca
     */
    function renderizarLocalizados(busca = '') {
        const tbody = document.getElementById('tabela-localizados');
        if (!tbody) return;

        let dados = Inventario.obterLocalizados(busca);
        dados = _ordenarDados(dados, _ordenacao.localizados);

        renderizarTabela(tbody, dados, (item) => [
            { valor: item.patrimonio, opcoes: { html: true, classe: '' } },
            { valor: item.descricao },
            { valor: item.uorg_destino, opcoes: { html: true } },
            { valor: item.coordenacao_destino },
            { valor: item.localidade }
        ], 'Nenhum item localizado');

        // Destaca patrimônio
        tbody.querySelectorAll('tr').forEach((tr, i) => {
            if (dados[i]) {
                const td = tr.children[0];
                td.innerHTML = `<strong>${Utils.sanitizar(dados[i].patrimonio)}</strong>`;

                // Badge na UORG
                const tdUorg = tr.children[2];
                tdUorg.innerHTML = `<span class="badge badge-success">${Utils.sanitizar(dados[i].uorg_destino)}</span>`;
            }
        });
    }

    /**
     * Renderiza tabela de pendentes
     * @param {string} busca - Termo de busca
     */
    function renderizarPendentes(busca = '') {
        const tbody = document.getElementById('tabela-pendentes');
        if (!tbody) return;

        let dados = Inventario.obterPendentes(busca);
        dados = _ordenarDados(dados, _ordenacao.pendentes);

        renderizarTabela(tbody, dados, (item) => {
            const bipado = Inventario.verificarBipagem(item.patrimonio);
            return [
                { valor: item.patrimonio },
                { valor: item.descricao },
                { valor: item.categoria },
                { valor: item.coordenacao_destino },
                { valor: bipado ? 'Bipado' : 'Não bipado' }
            ];
        }, 'Todos os itens estão localizados! 🎉');

        // Estiliza células
        tbody.querySelectorAll('tr').forEach((tr, i) => {
            if (dados[i]) {
                const td = tr.children[0];
                td.innerHTML = `<strong>${Utils.sanitizar(dados[i].patrimonio)}</strong>`;

                const bipado = Inventario.verificarBipagem(dados[i].patrimonio);
                const tdStatus = tr.children[4];
                if (bipado) {
                    tdStatus.innerHTML = `<span class="badge badge-action">✓ Bipado</span>`;
                } else {
                    tdStatus.innerHTML = `<span class="badge badge-warning">Pendente</span>`;
                }
            }
        });
    }

    /**
     * Renderiza tabela de bipados
     * @param {string} busca - Termo de busca
     */
    function renderizarBipados(busca = '') {
        const tbody = document.getElementById('tabela-bipados');
        if (!tbody) return;

        let dados = Inventario.obterBipados(busca);
        dados = _ordenarDados(dados, _ordenacao.bipados);

        const bipagens = Inventario.obterBipagens();

        renderizarTabela(tbody, dados, (item) => {
            const temUorg = item.uorg_destino && item.uorg_destino.trim() !== '';
            const reg = bipagens[item.patrimonio] || {};
            return [
                { valor: item.patrimonio },
                { valor: item.descricao },
                { valor: temUorg ? item.uorg_destino : 'PENDENTE' },
                { valor: item.coordenacao_destino },
                { valor: Utils.formatarData(reg.data_bipagem) },
                { valor: reg.observacao || '' }
            ];

        }, 'Nenhum item bipado ainda');

        // Estiliza células
        tbody.querySelectorAll('tr').forEach((tr, i) => {
            if (dados[i]) {
                tr.children[0].innerHTML = `<strong>${Utils.sanitizar(dados[i].patrimonio)}</strong>`;

                const temUorg = dados[i].uorg_destino && dados[i].uorg_destino.trim() !== '';
                if (!temUorg) {
                    tr.children[2].innerHTML = `<span style="color:var(--cor-alerta)">PENDENTE</span>`;
                }

                const reg = bipagens[dados[i].patrimonio] || {};
                tr.children[4].innerHTML =
                    `<span class="badge badge-info">${Utils.formatarData(reg.data_bipagem)}</span>`;
            }
        });

    }


    /**
     * Renderiza tabela por coordenação
     * @param {string} coordenacao - Coordenação selecionada
     */
    function renderizarPorCoordenacao(coordenacao) {
        const tbody = document.getElementById('tabela-por-coordenacao');
        if (!tbody) return;

        if (!coordenacao) {
            tbody.innerHTML = `
                <tr><td colspan="8" class="empty-state">
                    <div class="icon">🏢</div>
                    <p>Selecione uma coordenação destino acima</p>
                </td></tr>
            `;
            return;
        }

        let dados = Inventario.obterPorCoordenacao(coordenacao);
        dados = _ordenarDados(dados, _ordenacao.coordenacao);

        const bipagens = Inventario.obterBipagens();

        renderizarTabela(tbody, dados, (item) => {
            const bipado = bipagens[item.patrimonio];
            return [
                { valor: item.patrimonio },
                { valor: item.descricao },
                { valor: item.categoria },
                { valor: item.uorg_destino || '-' },
                { valor: item.localidade || '-' },
                { valor: item.coordenacao_destino },
                { valor: bipado ? 'Bipado' : '-' },
                { valor: bipado ? Utils.formatarData(bipado) : '-' }
            ];
        }, `Nenhum item encontrado para ${coordenacao}`);

        // Estiliza
        tbody.querySelectorAll('tr').forEach((tr, i) => {
            if (dados[i]) {
                tr.children[0].innerHTML = `<strong>${Utils.sanitizar(dados[i].patrimonio)}</strong>`;

                const bipado = bipagens[dados[i].patrimonio];

                // Coluna Status (6): mostra se foi bipado ou não
                tr.children[6].innerHTML = bipado
                    ? `<span class="badge badge-success">Bipado</span>`
                    : `-`;

                // Coluna Data Leitura (7): mostra data/hora se bipado
                if (bipado) {
                    tr.children[7].innerHTML = `<span class="badge badge-info">${Utils.formatarData(bipado)}</span>`;
                }
            }
        });
    }

    // ==================== ORDENAÇÃO ====================

    /**
     * Ordena dados de acordo com configuração
     */
    function _ordenarDados(dados, config) {
        if (!config || !config.coluna) return dados;

        return [...dados].sort((a, b) => {
            let valA = a[config.coluna] || '';
            let valB = b[config.coluna] || '';

            // Trata datas
            if (config.coluna.includes('data') || config.coluna.includes('bipagem')) {
                valA = new Date(valA) || 0;
                valB = new Date(valB) || 0;
                return config.direcao === 'asc' ? valA - valB : valB - valA;
            }

            // Strings
            valA = valA.toString().toLowerCase();
            valB = valB.toString().toLowerCase();

            if (config.direcao === 'asc') {
                return valA.localeCompare(valB);
            }
            return valB.localeCompare(valA);
        });
    }

    /**
     * Define ordenação de uma tabela
     * @param {string} tabela - Nome da tabela
     * @param {string} coluna - Coluna para ordenar
     */
    function setOrdenacao(tabela, coluna) {
        if (!_ordenacao[tabela]) return;

        // Alterna direção se mesma coluna
        if (_ordenacao[tabela].coluna === coluna) {
            _ordenacao[tabela].direcao = _ordenacao[tabela].direcao === 'asc' ? 'desc' : 'asc';
        } else {
            _ordenacao[tabela].coluna = coluna;
            _ordenacao[tabela].direcao = 'asc';
        }

        // Re-renderiza tabela
        switch (tabela) {
            case 'localizados': renderizarLocalizados(); break;
            case 'pendentes': renderizarPendentes(); break;
            case 'bipados': renderizarBipados(); break;
            case 'coordenacao':
                const select = document.getElementById('select-coordenacao');
                if (select) renderizarPorCoordenacao(select.value);
                break;
        }

        // Atualiza ícones de ordenação
        _atualizarIconesOrdenacao(tabela);
    }

    /**
     * Atualiza ícones de ordenação nos cabeçalhos
     */
    function _atualizarIconesOrdenacao(tabela) {
        const config = _ordenacao[tabela];
        if (!config) return;

        const icone = config.direcao === 'asc' ? '↑' : '↓';

        document.querySelectorAll(`[data-tabela="${tabela}"] th`).forEach(th => {
            const coluna = th.dataset.coluna;
            const span = th.querySelector('.sort-icon') || document.createElement('span');
            span.className = 'sort-icon';

            if (coluna === config.coluna) {
                span.textContent = icone;
                th.classList.add('sorted');
            } else {
                span.textContent = '↕';
                th.classList.remove('sorted');
            }

            if (!th.querySelector('.sort-icon')) {
                th.appendChild(span);
            }
        });
    }

    // ==================== ESTATÍSTICAS ====================

    /**
     * Atualiza exibição das estatísticas
     */
    function atualizarEstatisticas() {
        const stats = Inventario.obterEstatisticas();

        // Atualiza cards
        _setTexto('stat-total', stats.total);
        _setTexto('stat-localizados', stats.localizados);
        _setTexto('stat-pendentes', stats.pendentes);
        _setTexto('stat-bipados', stats.bipados);
        _setTexto('stat-percentual', stats.percentual + '%');

        // Atualiza barra de progresso
        _setTexto('stat-total-text', stats.total);
        _setTexto('stat-localizados-text', stats.localizados);
        _setTexto('stat-pendentes-text', stats.pendentes);

        const progressFill = document.getElementById('progress-fill');
        if (progressFill) {
            progressFill.style.width = stats.percentual + '%';
        }

        // Atualiza badges das abas
        _setTexto('tab-localizados-count', stats.localizados);
        _setTexto('tab-pendentes-count', stats.pendentes);
        _setTexto('tab-bipados-count', stats.bipados);
    }

    /**
     * Define texto de elemento de forma segura
     */
    function _setTexto(id, valor) {
        const el = document.getElementById(id);
        if (el) el.textContent = valor;
    }

    // ==================== HISTÓRICO ====================

    /**
     * Renderiza histórico de leituras
     */
    function renderizarHistorico() {
        const lista = document.getElementById('historico-lista');
        if (!lista) return;

        const historico = Inventario.obterHistorico(10);

        if (historico.length === 0) {
            lista.innerHTML = `
            <div class="empty-state">
                <div class="icon">📭</div>
                <p>Nenhuma leitura ainda</p>
            </div>
        `;
            return;
        }

        lista.innerHTML = '';
        historico.forEach(item => {
            const div = document.createElement('div');
            let iconClass = 'error', emoji = '❌';
            if (item.status === 'sucesso') { iconClass = 'success'; emoji = '✅'; }
            else if (item.status === 'ja_bipado') { iconClass = 'warning'; emoji = '⚠️'; }

            div.className = `historico-item ${iconClass}`;
            div.innerHTML = `
            <div class="status-icon ${iconClass}">${emoji}</div>
            <div class="info">
                <div class="patrimonio">${Utils.sanitizar(item.patrimonio)}</div>
                <div class="descricao">${Utils.sanitizar(item.item?.descricao || item.mensagem)}</div>
                ${item.observacao ? `<div class="observacao">${Utils.sanitizar(item.observacao)}</div>` : ''}
            </div>
            <div class="time">${Utils.formatarHora(item.timestamp)}</div>
        `;

            // clicar no histórico reabre o resultado e o modal de observação
            div.onclick = () => {
                UI.mostrarResultado(item);
                UI.solicitarObservacao(item).then(obs => {
                    if (obs !== null) {
                        Inventario.atualizarObservacao(item.patrimonio, obs);
                        item.observacao = obs;
                        Inventario.adicionarHistorico(item);
                        UI.renderizarHistorico();
                    }
                });
            };

            lista.appendChild(div);
        });
    }


    // ==================== RESULTADO DO SCAN ====================

    /**
     * Mostra resultado da leitura
     * @param {Object} resultado - Resultado do processamento
     */
    function mostrarResultado(resultado) {
        const container = document.getElementById('scan-result');
        if (!container) return;

        container.className = 'scan-result';
        container.style.display = 'block';

        const icon = document.getElementById('result-icon');
        const status = document.getElementById('result-status');
        const details = document.getElementById('result-details');

        if (resultado.status === 'sucesso') {
            container.classList.add('sucesso');
            icon.textContent = '✅';
            status.textContent = 'Item encontrado e registrado!';

            const temUorg = resultado.item?.uorg_destino && resultado.item.uorg_destino.trim() !== '';

            details.innerHTML = `
                <p><strong>Patrimônio:</strong> ${Utils.sanitizar(resultado.patrimonio)}</p>
                <p><strong>Descrição:</strong> ${Utils.sanitizar(resultado.item?.descricao) || '-'}</p>
                <div class="highlight">
                    <p><strong>📍 UORG Destino:</strong> ${resultado.item?.uorg_destino ? Utils.sanitizar(resultado.item.uorg_destino) : '<span style="color:var(--cor-alerta)">NÃO DEFINIDO</span>'}</p>
                    <p class="coord-atual"><strong>👥 Coordenação:</strong> ${Utils.sanitizar(resultado.item?.coordenacao_destino) || '-'}</p>
                    <p><strong>🏢 Localidade:</strong> ${Utils.sanitizar(resultado.item?.localidade) || '-'}</p>
                </div>
                <p style="margin-top: 0.75rem; font-size: 0.85rem;">
                    <strong>Status:</strong> ${temUorg ? '<span style="color:var(--cor-sucesso)">✅ Localizado</span>' : '<span style="color:var(--cor-alerta)">⏳ Pendente</span>'}
                </p>
            `;
        } else if (resultado.status === 'ja_bipado') {
            container.classList.add('ja-bipado');
            icon.textContent = '⚠️';
            status.textContent = 'Item já foi bipado!';

            details.innerHTML = `
                <p><strong>Patrimônio:</strong> ${Utils.sanitizar(resultado.patrimonio)}</p>
                <p><strong>Descrição:</strong> ${Utils.sanitizar(resultado.item?.descricao) || '-'}</p>
                <div class="highlight">
                    <p><strong>📍 UORG Destino:</strong> ${resultado.item?.uorg_destino ? Utils.sanitizar(resultado.item.uorg_destino) : '<span style="color:var(--cor-alerta)">NÃO DEFINIDO</span>'}</p>
                    <p class="coord-atual"><strong>👥 Coordenação:</strong> ${Utils.sanitizar(resultado.item?.coordenacao_destino) || '-'}</p>
                    <p><strong>🕐 Bipado em:</strong> ${Utils.formatarData(resultado.data_bipagem)}</p>
                </div>
            `;
        } else {
            container.classList.add('nao-encontrado');
            icon.textContent = '❌';
            status.textContent = 'Item não encontrado!';

            details.innerHTML = `
                <p><strong>Patrimônio buscado:</strong> ${Utils.sanitizar(resultado.patrimonio)}</p>
                <p>Este item não foi encontrado no inventário importado.</p>
                <p style="margin-top: 0.5rem; font-size: 0.85rem; color: var(--cor-texto-claro);">
                    Verifique se o número está correto ou se o inventário foi importado.
                </p>
            `;
        }

        container.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    /**
 * Pergunta ao usuário qual observação quer registrar
 * @param {Object} resultado - mesmo objeto usado em mostrarResultado
 * @returns {Promise<string|null>}
 */
    function solicitarObservacao(itemOuResultado) {
        return new Promise(resolve => {
            const existente = document.getElementById('modal-observacao');
            if (existente) existente.remove();

            const motivos = [
                'Patrimônio na sala incorreta',
                'Troca de UORG de patrimônio',
                'Bem avariado',
                'Etiqueta ilegível/danificada',
                'Divergência de descrição',
                'Bem não localizado visualmente'
            ];
            const MOTIVO_TROCA = 'Troca de UORG de patrimônio';

            const todasBipagens = Inventario.obterBipagens();
            const atual = todasBipagens[itemOuResultado.patrimonio]?.observacao || '';

            const coordenacoes = Inventario.listarCoordenacoes();

            const modal = document.createElement('div');
            modal.id = 'modal-observacao';
            modal.className = 'modal-overlay';
            modal.innerHTML = `
      <div class="modal-box">
        <h3>Observação da bipagem</h3>
        <p>
          Patrimônio ${Utils.sanitizar(itemOuResultado.patrimonio)}
          – ${Utils.sanitizar(itemOuResultado.item?.descricao || '')}
        </p>

        <label class="label-small">Motivo</label>
        <select id="obs-select" class="input-full">
          <option value="">Sem observação</option>
          ${motivos.map(m => `
            <option value="${Utils.sanitizar(m)}" ${m === atual ? 'selected' : ''}>
              ${Utils.sanitizar(m)}
            </option>
          `).join('')}
        </select>

        <div id="obs-coord-wrapper" style="display:none; margin-top:0.5rem;">
          <label class="label-small">Nova coordenação / UORG</label>
          <select id="obs-coord" class="input-full">
            <option value="">Selecione...</option>
            ${coordenacoes.map(c => `
              <option value="${Utils.sanitizar(c)}">${Utils.sanitizar(c)}</option>
            `).join('')}
          </select>
        </div>

        <div class="modal-actions">
          <button class="btn btn-secondary" id="obs-cancelar">Fechar</button>
          <button class="btn btn-primary" id="obs-salvar">Salvar</button>
        </div>
      </div>
    `;
            document.body.appendChild(modal);

            const selectMotivo = modal.querySelector('#obs-select');
            const wrapperCoord = modal.querySelector('#obs-coord-wrapper');
            const selectCoord = modal.querySelector('#obs-coord');

            // mostra/esconde coordenação só na troca de UORG
            const atualizarVisibilidadeCoord = () => {
                if (selectMotivo.value === MOTIVO_TROCA) {
                    wrapperCoord.style.display = 'block';
                } else {
                    wrapperCoord.style.display = 'none';
                }
            };
            atualizarVisibilidadeCoord();
            selectMotivo.addEventListener('change', atualizarVisibilidadeCoord);

            const fechar = (valor) => {
                modal.classList.remove('active');
                setTimeout(() => modal.remove(), 200);
                resolve(valor);
            };

            modal.offsetHeight;
            modal.classList.add('active');

            modal.querySelector('#obs-cancelar').onclick = () => fechar(null);
            modal.querySelector('#obs-salvar').onclick = () => {
                let v = selectMotivo.value || null;

                if (v === MOTIVO_TROCA) {
                    const destino = selectCoord.value || '';
                    if (destino) {
                        v = `${MOTIVO_TROCA} → ${destino}`;
                    }
                }

                fechar(v);
            };
            modal.onclick = (e) => {
                if (e.target === modal) fechar(null);
            };
        });
    }



    // ==================== SCROLL TOP ====================

    /**
     * Configura botão de voltar ao topo
     */
    function configurarScrollTop() {
        let btn = document.getElementById('btn-scroll-top');

        if (!btn) {
            btn = document.createElement('button');
            btn.id = 'btn-scroll-top';
            btn.className = 'btn-scroll-top';
            btn.innerHTML = '↑';
            btn.title = 'Voltar ao topo';
            btn.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
            document.body.appendChild(btn);
        }

        window.addEventListener('scroll', () => {
            if (window.scrollY > 300) {
                btn.classList.add('visible');
            } else {
                btn.classList.remove('visible');
            }
        });
    }

    // ==================== SELECT DE COORDENAÇÕES ====================

    /**
     * Popula select de coordenações
     */
    function popularSelectCoordenacoes() {
        const select = document.getElementById('select-coordenacao');
        if (!select) return;

        const coordenacoes = Inventario.listarCoordenacoes();

        select.innerHTML = '<option value="">-- Escolha uma coordenação destino --</option>';

        coordenacoes.forEach(coord => {
            const option = document.createElement('option');
            option.value = coord;
            option.textContent = coord;
            select.appendChild(option);
        });
    }

    // API pública
    return {
        toast,
        mostrarLoader,
        esconderLoader,
        confirmar,
        criarCelula,
        criarLinha,
        renderizarTabela,
        renderizarLocalizados,
        renderizarPendentes,
        renderizarBipados,
        renderizarPorCoordenacao,
        setOrdenacao,
        atualizarEstatisticas,
        renderizarHistorico,
        mostrarResultado,
        solicitarObservacao,
        configurarScrollTop,
        popularSelectCoordenacoes
    };
})();

window.UI = UI;