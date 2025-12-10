/**
 * camera.js - Controle da câmera e scanner de código de barras
 * OTIMIZADO PARA PATRIMÔNIO (Códigos pequenos de 7 dígitos)
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
    let _deteccaoCount = 0;

    // Callback para quando um código é lido
    let _onCodigoLido = null;

    function iniciar(callback) {
        _onCodigoLido = callback;
        const statusEl = document.getElementById('camera-status');
        if (statusEl) {
            statusEl.textContent = '⏳ Iniciando câmera...';
            statusEl.className = 'camera-status';
        }

        if (typeof Quagga === 'undefined') {
            _mostrarErro('QuaggaJS não carregado. Recarregue a página.');
            return;
        }

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            _mostrarErro('Câmera não suportada.');
            return;
        }

        console.log('[Camera] Iniciando modo PATRIMÔNIO...');

        Quagga.init({
            inputStream: {
                name: "Live",
                type: "LiveStream",
                target: document.querySelector("#camera-preview"),
                constraints: {
                    width: { ideal: 1280, min: 640 }, // HD é suficiente e mais rápido
                    height: { ideal: 720, min: 480 },
                    aspectRatio: { ideal: 1.777778 },
                    facingMode: "environment",
                    focusMode: "continuous",
                    advanced: [{ focusMode: "continuous" }]
                }
            },
            locator: {
                // "medium" é OBRIGATÓRIO para etiquetas de patrimônio padrão.
                // Se as etiquetas forem muito pequenas (tipo joia), mude para "small".
                patchSize: "medium", 
                halfSample: true // Melhora performance em celulares
            },
            numOfWorkers: navigator.hardwareConcurrency || 2,
            frequency: 10, // 10 scans/segundo é mais estável que 60
            decoder: {
                readers: [
                    // Ordem de prioridade para Patrimônio:
                    "code_128_reader", // O mais moderno e comum
                    "code_39_reader",  // O clássico (barras mais largas)
                    "i2of5_reader",    // Interleaved 2 of 5 (comum para numéricos puros)
                    "codabar_reader"   // Usado em bibliotecas/bancos
                    // REMOVIDOS: ean, upc (Isso evita ler código de comida errado)
                ],
                multiple: false
            },
            locate: true
        }, _onQuaggaInit);
    }

    function _onQuaggaInit(err) {
        if (err) {
            console.error('[Camera] Erro:', err);
            _mostrarErro('Erro: ' + (err.message || 'Sem permissão'));
            return;
        }

        Quagga.start();
        _ativa = true;

        // Visualização Debug (Caixas verdes)
        // Isso ajuda você a ver se a câmera está "focando" nas barras
        Quagga.onProcessed(function(result) {
            var drawingCtx = Quagga.canvas.ctx.overlay,
                drawingCanvas = Quagga.canvas.dom.overlay;

            if (result) {
                if (result.boxes) {
                    drawingCtx.clearRect(0, 0, parseInt(drawingCanvas.getAttribute("width")), parseInt(drawingCanvas.getAttribute("height")));
                    result.boxes.filter(function (box) {
                        return box !== result.box;
                    }).forEach(function (box) {
                        Quagga.ImageDebug.drawPath(box, {x: 0, y: 1}, drawingCtx, {color: "green", lineWidth: 2});
                    });
                }
                if (result.box) {
                    Quagga.ImageDebug.drawPath(result.box, {x: 0, y: 1}, drawingCtx, {color: "#00F", lineWidth: 2});
                }
            }
        });

        const statusEl = document.getElementById('camera-status');
        if (statusEl) {
            statusEl.textContent = '📷 Aponte para a etiqueta de patrimônio';
            statusEl.className = 'camera-status scanning';
        }

        _atualizarBotoes(true);
        setTimeout(_configurarControlesAvancados, 500);
        Quagga.onDetected(_onDeteccao);
    }

    function _onDeteccao(result) {
        _deteccaoCount++;
        
        // Filtro de confiança e validação
        if (!result || !result.codeResult || result.codeResult.confidence < 0.6) return;

        const codigo = result.codeResult.code;
        
        // FILTRO EXTRA: Se seus patrimônios tem SEMPRE 7 dígitos:
        // Descomente a linha abaixo para ignorar qualquer leitura errada
        // if (codigo.length !== 7) return;

        const agora = Date.now();

        // Debounce de 1.5s
        if (codigo && (codigo !== _ultimoCodigo || agora - _ultimaLeitura > 1500)) {
            
            // Tocar um som de "bip" ajuda a saber que leu
            _tocarBip();

            _ultimoCodigo = codigo;
            _ultimaLeitura = agora;

            const statusEl = document.getElementById('camera-status');
            if (statusEl) statusEl.textContent = `✅ Lido: ${codigo}`;

            if (_onCodigoLido) _onCodigoLido(codigo);
        }
    }

    // Função auxiliar para feedback sonoro (opcional)
    function _tocarBip() {
        // Oscilador simples para fazer "bip"
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                const ctx = new AudioContext();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'square';
                osc.frequency.value = 1200;
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.1);
                setTimeout(() => { osc.stop(); ctx.close(); }, 100);
            }
        } catch(e) {}
    }

    function _configurarControlesAvancados() {
        try {
            const videoElement = document.querySelector('#camera-preview video');
            if (!videoElement || !videoElement.srcObject) return;

            _stream = videoElement.srcObject;
            _track = _stream.getVideoTracks()[0];
            if (!_track) return;

            const capabilities = _track.getCapabilities();
            _zoomCapabilities = capabilities;

            const zoomSlider = document.getElementById('zoom-slider');
            const zoomValue = document.getElementById('zoom-value');
            if (zoomSlider && capabilities.zoom) {
                zoomSlider.min = capabilities.zoom.min;
                zoomSlider.max = Math.min(capabilities.zoom.max, 4); // Limita zoom a 4x
                zoomSlider.value = capabilities.zoom.min;
                zoomSlider.disabled = false;
                if (zoomValue) zoomValue.textContent = capabilities.zoom.min.toFixed(1) + 'x';
            }

            const btnFlash = document.getElementById('btn-flash');
            if (btnFlash) {
                btnFlash.style.display = capabilities.torch ? 'inline-flex' : 'none';
            }
            
            // Força foco contínuo se disponível
            if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
                _track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {});
            }
            
            const advancedControls = document.getElementById('camera-advanced');
            if (advancedControls) advancedControls.style.display = 'block';

        } catch (e) {
            console.log('[Camera] Aviso controles:', e);
        }
    }

    function parar() {
        if (_flashAtivo && _track) {
            _track.applyConstraints({ advanced: [{ torch: false }] }).catch(() => {});
            _flashAtivo = false;
        }

        if (_ativa) {
            if (typeof Quagga !== 'undefined') {
                Quagga.stop();
                Quagga.offDetected(_onDeteccao);
            }
            _ativa = false;
        }

        _stream = null;
        _track = null;
        _atualizarBotoes(false);
        
        const preview = document.getElementById('camera-preview');
        if (preview) preview.innerHTML = '';
        
        const advancedControls = document.getElementById('camera-advanced');
        if (advancedControls) advancedControls.style.display = 'none';

        const statusEl = document.getElementById('camera-status');
        if (statusEl) {
            statusEl.textContent = 'Câmera parada';
            statusEl.className = 'camera-status';
        }
    }

    function ajustarZoom(value) {
        const zoomValue = parseFloat(value);
        const display = document.getElementById('zoom-value');
        if (display) display.textContent = zoomValue.toFixed(1) + 'x';

        if (_track && _zoomCapabilities && _zoomCapabilities.zoom) {
            _track.applyConstraints({ advanced: [{ zoom: zoomValue }] }).catch(() => {});
        }
    }

    function toggleFlash() {
        if (!_track) return;
        _flashAtivo = !_flashAtivo;
        _track.applyConstraints({ advanced: [{ torch: _flashAtivo }] })
            .then(() => {
                const btnFlash = document.getElementById('btn-flash');
                if (btnFlash) {
                    btnFlash.classList.toggle('active', _flashAtivo);
                    btnFlash.innerHTML = _flashAtivo ? '🔦 Desligar' : '🔦 Lanterna';
                }
            })
            .catch(() => UI.toast('Lanterna indisponível', 'warning'));
    }

    function setTamanhoArea(tamanho) {
        // Mantido para compatibilidade, mas o patchSize agora é fixo no init para melhor performance
        const overlay = document.getElementById('camera-overlay');
        if (overlay) overlay.className = 'camera-overlay size-' + tamanho;
    }

    function _mostrarErro(mensagem) {
        const statusEl = document.getElementById('camera-status');
        if (statusEl) {
            statusEl.textContent = '❌ ' + mensagem;
            statusEl.className = 'camera-status error';
        }
        alert(mensagem); // Fallback visual
    }

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

    return {
        iniciar,
        parar,
        ajustarZoom,
        toggleFlash,
        setTamanhoArea,
        estaAtiva: () => _ativa
    };

})();

window.Camera = Camera;