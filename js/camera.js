/**
 * camera.js - Controle da câmera e scanner de código de barras
 * Usa biblioteca QuaggaJS para leitura de códigos
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

        // Verifica suporte
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            _mostrarErro('Câmera não suportada neste navegador');
            return;
        }

        // Configuração do Quagga
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
                patchSize: "medium",
                halfSample: false
            },
            numOfWorkers: navigator.hardwareConcurrency || 4,
            frequency: 15,
            decoder: {
                readers: [
                    "code_128_reader",
                    "ean_reader",
                    "ean_8_reader",
                    "code_39_reader",
                    "code_39_vin_reader",
                    "codabar_reader",
                    "upc_reader",
                    "upc_e_reader",
                    "i2of5_reader",
                    "2of5_reader"
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
            console.error('Erro Quagga:', err);
            _mostrarErro('Erro ao acessar câmera: ' + (err.message || 'Permissão negada'));
            return;
        }

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
    }

    /**
     * Handler de detecção de código
     */
    function _onDeteccao(result) {
        const codigo = result.codeResult.code;
        const agora = Date.now();

        // Evita leituras duplicadas (debounce de 3 segundos)
        if (codigo && (codigo !== _ultimoCodigo || agora - _ultimaLeitura > 3000)) {
            _ultimoCodigo = codigo;
            _ultimaLeitura = agora;

            const statusEl = document.getElementById('camera-status');
            if (statusEl) {
                statusEl.textContent = `✅ Código lido: ${codigo}`;
            }

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
            if (!videoElement || !videoElement.srcObject) return;

            _stream = videoElement.srcObject;
            _track = _stream.getVideoTracks()[0];

            if (!_track) return;

            const capabilities = _track.getCapabilities();
            _zoomCapabilities = capabilities;

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

        } catch (e) {
            console.log('Erro ao configurar controles:', e);
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
            Quagga.stop();
            Quagga.offDetected(_onDeteccao);
            _ativa = false;
        }

        // Limpa referências
        _stream = null;
        _track = null;
        _zoomCapabilities = null;
        _ultimoCodigo = '';
        _ultimaLeitura = 0;

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
            }).catch(e => console.log('Erro ao ajustar zoom:', e));
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
        }).catch(e => {
            console.log('Erro ao controlar lanterna:', e);
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