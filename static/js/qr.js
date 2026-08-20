// js/qr.js
// Lógica del Módulo de Auto-servicio QR y Control Anti-Fraude IP (Con soporte para turnos por día de la semana, retardos y justificaciones)

var tipoMarcajeSeleccionado = 'ingreso';
var cameraStream = null;

window.startCamera = async function() {
    const video = document.getElementById('camera-stream');
    if (!video || cameraStream) return;
    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
        video.srcObject = cameraStream;
    } catch (e) {
        console.warn('No se pudo acceder a la cámara:', e);
    }
};

window.stopCamera = function() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    const video = document.getElementById('camera-stream');
    if (video) video.srcObject = null;
};

window.captureImage = function() {
    const video = document.getElementById('camera-stream');
    const canvas = document.getElementById('camera-canvas');
    if (!video || !canvas || !cameraStream) return null;

    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');
    
    // Draw video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Draw timestamp watermark
    const now = new Date();
    const timestamp = now.toLocaleString();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, canvas.height - 25, canvas.width, 25);
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px Poppins, sans-serif';
    ctx.fillText(timestamp, 10, canvas.height - 8);

    // Compress as JPEG
    return canvas.toDataURL('image/jpeg', 0.6);
};

function inicializarQR() {
    refrescarIpsAutorizadas();
    setupBotonesTipoMarcaje();
    
    const config = obtenerConfiguracion();
    const currentIp = config.ip_simulada || '192.168.1.25';
    const scanCapturedIp = document.getElementById('scan-captured-ip');
    if (scanCapturedIp) scanCapturedIp.textContent = currentIp;

    const sesion = config.sesion_activa || { rol: 'ADMINISTRADOR', cedula: null };
    const scanCedula = document.getElementById('scan-cedula');
    
    if (scanCedula) {
        if (sesion.rol === 'COLABORADOR') {
            scanCedula.value = sesion.cedula;
            scanCedula.disabled = true;
        } else {
            scanCedula.value = '';
            scanCedula.disabled = false;
        }
    }

    // Asegurar y resetear contenedor de observaciones
    const container = asegurarContenedorObservacionQR();
    if (container) {
        container.style.display = 'none';
        const textarea = document.getElementById('scan-observaciones');
        if (textarea) textarea.value = '';
    }

    evaluarDesviacionQR();
    setupCerrarModales();
}

function obtenerHoraActualMedellin() {
    const ahora = new Date();
    const opciones = { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hour12: false };
    return ahora.toLocaleTimeString('es-CO', opciones);
}

function obtenerFechaActualMedellin() {
    const ahora = new Date();
    const opciones = { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' };
    const formateador = new Intl.DateTimeFormat('en-US', opciones);
    const [{ value: month }, , { value: day }, , { value: year }] = formateador.formatToParts(ahora);
    return `${year}-${month}-${day}`;
}

// --- CONFIGURACIÓN DE IPS AUTORIZADAS ---
function refrescarIpsAutorizadas() {
    const container = document.getElementById('authorized-ips-container');
    if (!container) return;

    const config = obtenerConfiguracion();
    const ips = config.ips_autorizadas || [];

    container.innerHTML = '';
    ips.forEach(ip => {
        const chip = document.createElement('span');
        chip.className = 'badge badge-info';
        chip.style.display = 'inline-flex';
        chip.style.alignItems = 'center';
        chip.style.gap = '6px';
        chip.style.padding = '6px 12px';
        chip.style.fontSize = '0.8rem';
        chip.style.borderRadius = 'var(--radius-sm)';
        
        chip.innerHTML = `
            <span>${ip}</span>
            <span style="cursor:pointer; font-weight:bold; color:var(--danger);" onclick="eliminarIpAutorizada('${ip}')">×</span>
        `;
        container.appendChild(chip);
    });
}

var btnAddIp = document.getElementById('btn-add-authorized-ip');
var inputNewIp = document.getElementById('input-new-authorized-ip');

if (btnAddIp && inputNewIp && !btnAddIp.dataset.listener) {
    btnAddIp.dataset.listener = 'true';
    btnAddIp.addEventListener('click', () => {
        const ip = inputNewIp.value.trim();
        if (!ip) return;

        const ipPattern = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^[a-fA-F0-9:]+$/;
        if (!ipPattern.test(ip)) {
            showToast('Formato de IP inválido', 'danger');
            return;
        }

        const config = obtenerConfiguracion();
        if (config.ips_autorizadas.includes(ip)) {
            showToast('Esta IP ya está autorizada', 'warning');
            return;
        }

        config.ips_autorizadas.push(ip);
        guardarConfiguracion(config);
        inputNewIp.value = '';
        
        refrescarIpsAutorizadas();
        
        const ipInput = document.getElementById('simulated-ip-input');
        if (ipInput) {
            ipInput.dispatchEvent(new Event('input'));
        }
        
        showToast(`IP ${ip} autorizada con éxito`, 'success');
    });
}

window.eliminarIpAutorizada = function(ip) {
    const config = obtenerConfiguracion();
    config.ips_autorizadas = config.ips_autorizadas.filter(item => item !== ip);
    guardarConfiguracion(config);
    
    refrescarIpsAutorizadas();

    const ipInput = document.getElementById('simulated-ip-input');
    if (ipInput) {
        ipInput.dispatchEvent(new Event('input'));
    }

    showToast(`IP ${ip} removida`, 'info');
};

// --- SIMULADOR DE BOTONES INGRESO/SALIDA EN MÓVIL ---
function setupBotonesTipoMarcaje() {
    const btnIngreso = document.getElementById('btn-scan-type-ingreso');
    const btnSalida = document.getElementById('btn-scan-type-salida');

    if (!btnIngreso || !btnSalida) return;

    if (!btnIngreso.dataset.listener) {
        btnIngreso.dataset.listener = 'true';
        btnIngreso.addEventListener('click', () => {
            tipoMarcajeSeleccionado = 'ingreso';
            btnIngreso.style.border = '2px solid var(--success)';
            btnIngreso.style.color = 'var(--success)';
            btnIngreso.style.backgroundColor = 'var(--success-light)';
            btnIngreso.style.fontWeight = '700';

            btnSalida.style.border = '2px solid var(--card-border)';
            btnSalida.style.color = 'var(--text-secondary)';
            btnSalida.style.backgroundColor = 'transparent';
            btnSalida.style.fontWeight = '500';

            evaluarDesviacionQR();
        });
    }

    if (!btnSalida.dataset.listener) {
        btnSalida.dataset.listener = 'true';
        btnSalida.addEventListener('click', () => {
            tipoMarcajeSeleccionado = 'salida';
            btnSalida.style.border = '2px solid var(--danger)';
            btnSalida.style.color = 'var(--danger)';
            btnSalida.style.backgroundColor = 'var(--danger-light)';
            btnSalida.style.fontWeight = '700';

            btnIngreso.style.border = '2px solid var(--card-border)';
            btnIngreso.style.color = 'var(--text-secondary)';
            btnIngreso.style.backgroundColor = 'transparent';
            btnIngreso.style.fontWeight = '500';

            evaluarDesviacionQR();
        });
    }
}

// --- CONTENEDOR DINÁMICO DE OBSERVACIONES ---
function asegurarContenedorObservacionQR() {
    let container = document.getElementById('scan-obs-container');
    if (!container) {
        const form = document.getElementById('form-scan-colaborador');
        if (!form) return null;
        
        container = document.createElement('div');
        container.id = 'scan-obs-container';
        container.className = 'form-group';
        container.style.display = 'none'; // oculto por defecto
        container.innerHTML = `
            <label for="scan-tipo-permiso" style="color:var(--danger); font-weight:600; font-size:0.75rem;">Motivo de Desviación (Obligatorio)</label>
            <select id="scan-tipo-permiso" onchange="document.getElementById('scan-obs-text-container').style.display = this.value === 'Otros' ? 'block' : 'none'; typeof evaluarDesviacionQR === 'function' && evaluarDesviacionQR();" style="border: 1px solid var(--danger); font-size: 0.8rem; margin-bottom: 5px;">
                <option value="">Seleccione un motivo</option>
                <optgroup label="Permisos Remunerados">
                    <option value="Citas Medicas">Citas Médicas</option>
                    <option value="Calamidad Domestica">Calamidad Doméstica</option>
                    <option value="Votacion y Jurado">Votación y Jurado</option>
                    <option value="Obligaciones Escolares">Obligaciones Escolares</option>
                    <option value="Diligencias Judiciales">Diligencias Judiciales</option>
                </optgroup>
                <optgroup label="Permisos No Remunerados">
                    <option value="Otros">Otros (Especifique)</option>
                </optgroup>
            </select>
            <div id="scan-obs-text-container" style="display: none;">
                <textarea id="scan-observaciones" rows="2" placeholder="Especifique el motivo de la desviación..." style="border: 1px solid var(--danger); font-size: 0.8rem;"></textarea>
            </div>
            <small style="color:var(--danger); font-weight:600; font-size:0.65rem;">⚠️ Se detectó una desviación respecto al turno (tarde o salida anticipada). Se requiere justificación.</small>
        `;
        // Insertar antes del botón de submit (el último elemento en el form)
        form.insertBefore(container, form.lastElementChild);

        // Escuchar cuando el usuario escribe para actualizar estado del botón enviar
        const select = container.querySelector('#scan-tipo-permiso');
        const textarea = container.querySelector('#scan-observaciones');
        if (select) select.addEventListener('change', evaluarDesviacionQR);
        if (textarea) textarea.addEventListener('input', evaluarDesviacionQR);
    }
    return container;
}

function evaluarDesviacionQR() {
    const scanCedula = document.getElementById('scan-cedula');
    if (!scanCedula) return;
    const cedula = parseInt(scanCedula.value);
    
    const container = asegurarContenedorObservacionQR();
    if (!container) return;
    
    const btnSubmit = document.querySelector('#form-scan-colaborador button[type="submit"]');

    if (!cedula || !tipoMarcajeSeleccionado) {
        container.style.display = 'none';
        if (btnSubmit) btnSubmit.disabled = false;
        return;
    }

    const colaborador = obtenerColaboradorPorCedula(cedula);
    if (!colaborador) {
        container.style.display = 'none';
        if (btnSubmit) btnSubmit.disabled = false;
        return;
    }

    const hoy = obtenerFechaActualMedellin();
    const horaAhora = obtenerHoraActualMedellin();
    const shift = obtenerTurnoColaboradorPorFecha(colaborador, hoy);

    let tieneDesviacion = false;

    if (tipoMarcajeSeleccionado === 'ingreso') {
        if (shift) {
            const diferenciaIngreso = diferenciaMinutos(shift.hora_inicio, horaAhora);
            if (diferenciaIngreso > 15) {
                tieneDesviacion = true;
            }
        }
    } else if (tipoMarcajeSeleccionado === 'salida') {
        const registros = obtenerRegistros();
        const ingresoActivo = registros.find(r => r.cedula_colaborador === cedula && r.fecha === hoy && !r.hora_salida);
        
        if (ingresoActivo) {
            const calc = calcularHorasLaboradas(
                ingresoActivo.hora_ingreso,
                horaAhora,
                shift ? shift.hora_inicio : null,
                shift ? shift.hora_fin : null
            );
            if (calc.extras > 0 || calc.permisos > 0) {
                tieneDesviacion = true;
            }
        }
    }

    if (tieneDesviacion) {
        container.style.display = 'block';
        const select = document.getElementById('scan-tipo-permiso');
        const textarea = document.getElementById('scan-observaciones');
        
        let valid = false;
        if (select && select.value) {
            if (select.value === 'Otros') {
                valid = (textarea && textarea.value.trim().length > 0);
            } else {
                valid = true;
            }
        }
        
        if (btnSubmit) btnSubmit.disabled = !valid;
    } else {
        container.style.display = 'none';
        if (btnSubmit) btnSubmit.disabled = false;
    }
}

// Escuchar cambios en la cédula para evaluar la desviación
var scanCedulaInput = document.getElementById('scan-cedula');
if (scanCedulaInput && !scanCedulaInput.dataset.listener) {
    scanCedulaInput.dataset.listener = 'true';
    scanCedulaInput.addEventListener('input', evaluarDesviacionQR);
    scanCedulaInput.addEventListener('change', evaluarDesviacionQR);
}

// --- MANEJO DE CIERRE DE MODALES DE ALERTA ---
function setupCerrarModales() {
    const btnCloseTardiness = document.getElementById('btn-close-tardiness');
    if (btnCloseTardiness && !btnCloseTardiness.dataset.listener) {
        btnCloseTardiness.dataset.listener = 'true';
        btnCloseTardiness.addEventListener('click', () => {
            document.getElementById('modal-tardiness').style.display = 'none';
        });
    }

    const btnCloseCritical = document.getElementById('btn-close-critical');
    if (btnCloseCritical && !btnCloseCritical.dataset.listener) {
        btnCloseCritical.dataset.listener = 'true';
        btnCloseCritical.addEventListener('click', () => {
            document.getElementById('modal-critical').style.display = 'none';
        });
    }
}

// --- SUBMIT ESCANEO / REGISTRO ---
var formScanColaborador = document.getElementById('form-scan-colaborador');
if (formScanColaborador && !formScanColaborador.dataset.listener) {
    formScanColaborador.dataset.listener = 'true';
    formScanColaborador.addEventListener('submit', async (e) => {
        e.preventDefault();

        const cedulaStr = document.getElementById('scan-cedula').value.trim();
        const cedula = parseInt(cedulaStr);
        
        if (!cedula) {
            showToast('Por favor, ingrese un número de cédula válido.', 'danger');
            return;
        }

        if (!tipoMarcajeSeleccionado) {
            showToast('Por favor, seleccione si es Ingreso o Salida.', 'danger');
            return;
        }

        const fotoData = window.captureImage ? window.captureImage() : null;

        const btnSubmit = document.querySelector('#form-scan-colaborador button[type="submit"]');
        if (btnSubmit) {
            btnSubmit.disabled = true;
            btnSubmit.innerHTML = 'Enviando...';
        }

        try {
            // Función para obtener cookie CSRF
            function getCookie(name) {
                let cookieValue = null;
                if (document.cookie && document.cookie !== '') {
                    const cookies = document.cookie.split(';');
                    for (let i = 0; i < cookies.length; i++) {
                        const cookie = cookies[i].trim();
                        if (cookie.substring(0, name.length + 1) === (name + '=')) {
                            cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                            break;
                        }
                    }
                }
                return cookieValue;
            }

            const response = await fetch('/asistencia/marcacion/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                body: JSON.stringify({
                    cedula: cedula,
                    tipo: tipoMarcajeSeleccionado.toUpperCase(),
                    foto: fotoData
                })
            });

            const result = await response.json();

            if (result.success) {
                showToast(result.message, 'success');
                // Limpiar cédula
                document.getElementById('scan-cedula').value = '';
            } else {
                showToast(result.message, 'danger');
            }
        } catch (error) {
            showToast('Error de conexión con el servidor.', 'danger');
        } finally {
            if (btnSubmit) {
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = 'Registrar';
            }
        }
    });
}
