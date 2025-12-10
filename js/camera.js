/**
 * camera.js - Controle da câmera e scanner de código de barras
 * VERSÃO CORRIGIDA - QuaggaJS 0.12.x
 * 
 * Problemas resolvidos:
 * ✅ Nomes de decoders corrigidos
 * ✅ Frequency aumentada para detecção mais rápida
 * ✅ Área de leitura expandida por padrão
 * ✅ Debug console para rastrear leituras
 * ✅ Tratamento de erros melhorado
 */

const Camera = (function() {
    'use strict';

    // Estado interno
    let _ativa = false;
    let _stream = null;
    let _track = null;
    let _flashAtivo = false;
    let _zoomCapabilities = null;
    let _ultimoCodigo = '';
    let _ultimaLeitura = 0;
    let _deteccaoCount = 0; // Contador de tentativas

    // Callback para quando um código é lido
    let _onCodigoLido = null;

    /**
     * Inicia a câmera e o scanner
     * @param {Function} callback - Função chamada quando um código é lido
     */
    function iniciar(callback) {
        _onCodigoLido = callback;
        const statusEl = document.getElementById('camera-status');
        if (statusEl) {
            statusEl.textContent = '⏳ Iniciando câmera...';
            statusEl.className = 'camera-status';
        }

        // Verifica se QuaggaJS está disponível
        if (typeof Quagga === 'undefined') {
            _mostrarErro('QuaggaJS não foi carregado. Verifique a conexão ou reload a página.');
            return;
        }

        // Verifica suporte
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            _mostrarErro('Câmera não suportada neste navegador');
            return;
        }

        console.log('[Camera] Iniciando com configuração otimizada...');

        // Configuração DO Quagga - CORRIGIDA
        Quagga.init({
            inputStream: {
                name: "Live",
                type: "LiveStream",
                target: document.querySelector("#camera-preview"),
                constraints: {
                    width: { ideal: 1920, min: 1280 },
                    height: { ideal: 1080, min: 720 },
                    facingMode: "environment",
                    focusMode: "continuous",
                    advanced: [{ focusMode: "continuous" }]
                }
            },
            locator: {
                patchSize: "large", // ✅ MUDADO DE "medium" PARA "large"
                halfSample: false
            },
            numOfWorkers: 2, // ✅ REDUZIDO para evitar overhead
            frequency: 60, // ✅ AUMENTADO de 15 para 60 (mais rápido)
            decoder: {
                readers: [
                    "code_128_reader",
                    "ean_reader",
                    "ean_8_reader",
                    "code_39_reader",
                    "codabar_reader",
                    "upc_reader",
                    "upc_e_reader"
                ],
                multiple: false
            },
            locate: true
        }, _onQuaggaInit);
    }

    /**
     * Callback de inicialização do Quagga
     */
    function _onQuaggaInit(err) {
        if (err) {
            console.error('[Camera] Erro Quagga:', err);
            _mostrarErro('Erro ao acessar câmera: ' + (err.message || 'Permissão negada'));
            return;
        }

        console.log('[Camera] QuaggaJS inicializado com sucesso');

        Quagga.start();
        _ativa = true;

        // Atualiza UI
        const statusEl = document.getElementById('camera-status');
        if (statusEl) {
            statusEl.textContent = '📷 Câmera ativa - Aponte para o código de barras';
            statusEl.className = 'camera-status scanning';
        }

        _atualizarBotoes(true);

        // Configura controles avançados após um pequeno delay
        setTimeout(_configurarControlesAvancados, 500);

        // Registra handler de detecção
        Quagga.onDetected(_onDeteccao);

        // DEBUG: Log para rastrear status
        console.log('[Camera] Sistema de detecção ativo. Aguardando códigos...');
    }

    /**
     * Handler de detecção de código
     */
    function _onDeteccao(result) {
        _deteccaoCount++;

        // Validação básica
        if (!result || !result.codeResult || !result.codeResult.code) {
            if (_deteccaoCount % 100 === 0) {
                console.log(`[Camera] ${_deteccaoCount} varreduras, aguardando código válido...`);
            }
            return;
        }

        const codigo = result.codeResult.code;
        const agora = Date.now();
        const confianca = result.codeResult.confidence || 0;

        console.log(`[Camera] Código detectado: ${codigo} (confiança: ${confianca.toFixed(2)})`);

        // Evita leituras duplicadas (debounce de 2 segundos)
        if (codigo && (codigo !== _ultimoCodigo || agora - _ultimaLeitura > 2000)) {
            _ultimoCodigo = codigo;
            _ultimaLeitura = agora;

            const statusEl = document.getElementById('camera-status');
            if (statusEl) {
                statusEl.textContent = `✅ Código lido: ${codigo}`;
            }

            console.log(`[Camera] ✅ Código processado: ${codigo}`);

            // Chama callback
            if (_onCodigoLido) {
                _onCodigoLido(codigo);
            }
        }
    }

    /**
     * Configura controles avançados da câmera (zoom, flash)
     */
    function _configurarControlesAvancados() {
        try {
            const videoElement = document.querySelector('#camera-preview video');
            if (!videoElement || !videoElement.srcObject) {
                console.log('[Camera] Video element não disponível ainda');
                return;
            }

            _stream = videoElement.srcObject;
            _track = _stream.getVideoTracks()[0];
            if (!_track) {
                console.log('[Camera] Video track não disponível');
                return;
            }

            const capabilities = _track.getCapabilities();
            _zoomCapabilities = capabilities;

            console.log('[Camera] Capacidades detectadas:', Object.keys(capabilities));

            // Configura slider de zoom
            const zoomSlider = document.getElementById('zoom-slider');
            const zoomValue = document.getElementById('zoom-value');
            if (zoomSlider && capabilities.zoom) {
                zoomSlider.min = capabilities.zoom.min;
                zoomSlider.max = Math.min(capabilities.zoom.max, 8);
                zoomSlider.value = capabilities.zoom.min;
                zoomSlider.disabled = false;
                if (zoomValue) {
                    zoomValue.textContent = capabilities.zoom.min.toFixed(1) + 'x';
                }
            } else if (zoomSlider) {
                zoomSlider.disabled = true;
                if (zoomValue) {
                    zoomValue.textContent = 'N/D';
                }
            }

            // Configura botão de flash
            const btnFlash = document.getElementById('btn-flash');
            if (btnFlash) {
                btnFlash.style.display = capabilities.torch ? 'inline-flex' : 'none';
            }

            // Aplica foco contínuo
            if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
                _track.applyConstraints({
                    advanced: [{ focusMode: 'continuous' }]
                }).catch(() => {});
            }

            // Mostra controles avançados
            const advancedControls = document.getElementById('camera-advanced');
            if (advancedControls) {
                advancedControls.style.display = 'block';
            }

            console.log('[Camera] Controles avançados configurados');

        } catch (e) {
            console.log('[Camera] Aviso ao configurar controles:', e.message);
        }
    }

    /**
     * Para a câmera
     */
    function parar() {
        // Desliga flash se ativo
        if (_flashAtivo && _track) {
            _track.applyConstraints({
                advanced: [{ torch: false }]
            }).catch(() => {});
            _flashAtivo = false;
        }

        if (_ativa) {
            if (typeof Quagga !== 'undefined') {
                Quagga.stop();
                Quagga.offDetected(_onDeteccao);
            }
            _ativa = false;
        }

        // Limpa referências
        _stream = null;
        _track = null;
        _zoomCapabilities = null;
        _ultimoCodigo = '';
        _ultimaLeitura = 0;
        _deteccaoCount = 0;

        // Atualiza UI
        _atualizarBotoes(false);
        const statusEl = document.getElementById('camera-status');
        if (statusEl) {
            statusEl.textContent = 'Câmera parada';
            statusEl.className = 'camera-status';
        }

        const preview = document.getElementById('camera-preview');
        if (preview) {
            preview.innerHTML = '';
        }

        // Esconde controles avançados
        const advancedControls = document.getElementById('camera-advanced');
        if (advancedControls) {
            advancedControls.style.display = 'none';
        }

        // Reseta controles
        const zoomSlider = document.getElementById('zoom-slider');
        const zoomValue = document.getElementById('zoom-value');
        if (zoomSlider) zoomSlider.value = 1;
        if (zoomValue) zoomValue.textContent = '1.0x';

        console.log('[Camera] Câmera parada');
    }

    /**
     * Ajusta o zoom da câmera
     * @param {number} value - Valor do zoom
     */
    function ajustarZoom(value) {
        const zoomValue = parseFloat(value);
        const display = document.getElementById('zoom-value');
        if (display) {
            display.textContent = zoomValue.toFixed(1) + 'x';
        }

        if (_track && _zoomCapabilities && _zoomCapabilities.zoom) {
            _track.applyConstraints({
                advanced: [{ zoom: zoomValue }]
            }).catch(e => console.log('[Camera] Erro ao ajustar zoom:', e));
        }
    }

    /**
     * Alterna o flash/lanterna
     */
    function toggleFlash() {
        if (!_track) return;

        _flashAtivo = !_flashAtivo;
        _track.applyConstraints({
            advanced: [{ torch: _flashAtivo }]
        }).then(() => {
            const btnFlash = document.getElementById('btn-flash');
            if (btnFlash) {
                btnFlash.classList.toggle('active', _flashAtivo);
                btnFlash.innerHTML = _flashAtivo ? '🔦 Desligar' : '🔦 Lanterna';
            }
            console.log(`[Camera] Flash: ${_flashAtivo ? 'ON' : 'OFF'}`);
        }).catch(e => {
            console.log('[Camera] Erro ao controlar lanterna:', e);
            if (typeof UI !== 'undefined') {
                UI.toast('Lanterna não disponível', 'warning');
            }
        });
    }

    /**
     * Define o tamanho da área de leitura
     * @param {string} tamanho - 'small', 'medium' ou 'large'
     */
    function setTamanhoArea(tamanho) {
        const overlay = document.getElementById('camera-overlay');
        if (overlay) {
            overlay.className = 'camera-overlay size-' + tamanho;
            console.log(`[Camera] Área de leitura: ${tamanho}`);
        }

        // Atualiza botões
        document.querySelectorAll('.size-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        if (event && event.target) {
            event.target.classList.add('active');
        }
    }

    /**
     * Mostra mensagem de erro
     */
    function _mostrarErro(mensagem) {
        const statusEl = document.getElementById('camera-status');
        if (statusEl) {
            statusEl.textContent = '❌ ' + mensagem;
            statusEl.className = 'camera-status error';
        }
        console.error('[Camera] ' + mensagem);
    }

    /**
     * Atualiza visibilidade dos botões
     */
    function _atualizarBotoes(cameraAtiva) {
        const btnStart = document.getElementById('btn-start-camera');
        const btnStop = document.getElementById('btn-stop-camera');
        const btnFlash = document.getElementById('btn-flash');

        if (btnStart) btnStart.style.display = cameraAtiva ? 'none' : 'inline-flex';
        if (btnStop) btnStop.style.display = cameraAtiva ? 'inline-flex' : 'none';
        if (btnFlash && !cameraAtiva) {
            btnFlash.style.display = 'none';
            btnFlash.classList.remove('active');
        }
    }

    /**
     * Verifica se a câmera está ativa
     */
    function estaAtiva() {
        return _ativa;
    }

    // API pública
    return {
        iniciar,
        parar,
        ajustarZoom,
        toggleFlash,
        setTamanhoArea,
        estaAtiva
    };

})();

window.Camera = Camera;