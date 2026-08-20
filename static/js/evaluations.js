// js/evaluations.js
// Controlador para el Módulo 6: Evaluación de Desempeño

var evalCanvas = null;
var evalCtx = null;
var isEvalDrawing = false;
var evalLastPos = { x: 0, y: 0 };
var evalHasDrawn = false;
var selectedEvalId = null;

// --- CONFIGURACIÓN DE CICLOS ---
var intigravity_eval_ciclos = [
    {
        id: 1,
        nombre: "Q1 - 2026",
        estado: "CERRADO",
        weight_blandas: 30,
        weight_metas: 50,
        weight_puntualidad: 20
    },
    {
        id: 2,
        nombre: "Q2 - 2026",
        estado: "ACTIVO",
        weight_blandas: 30,
        weight_metas: 50,
        weight_puntualidad: 20
    }
];

function initCiclosEvaluacion() {
    // Ya no se usa localStorage para ciclos, se usan los ciclos predeterminados
}

function inicializarEvaluations() {
    const config = obtenerConfiguracion();
    const sesion = config.sesion_activa || { rol: 'ADMINISTRADOR', cedula: null };

    if (sesion.rol === 'COLABORADOR') {
        inicializarEvaluationsColab(sesion.cedula);
    } else {
        inicializarEvaluationsAdmin();
    }
}

// --- VISTA ADMINISTRADOR / JEFE ---
function inicializarEvaluationsAdmin() {
    poblarCiclosList();
    poblarSelectoresCalificar();
    renderizarEvaluacionesAdminTable();

    // Listener para registrar ciclo
    const formCiclo = document.getElementById('form-eval-ciclo');
    if (formCiclo) {
        formCiclo.onsubmit = function(e) {
            e.preventDefault();
            const nombre = document.getElementById('eval-ciclo-nombre').value.trim();
            const weightBlandas = parseInt(document.getElementById('weight-blandas').value) || 0;
            const weightMetas = parseInt(document.getElementById('weight-metas').value) || 0;
            const weightPuntualidad = 30; // Fijo en 30%

            if (weightBlandas + weightMetas + weightPuntualidad !== 100) {
                showToast('La suma de las ponderaciones debe ser 100% (Blandas + Metas + Puntualidad (30%)).', 'danger');
                return;
            }

            const ciclos = intigravity_eval_ciclos;
            const maxId = ciclos.reduce((max, c) => c.id > max ? c.id : max, 0);
            const nuevoCiclo = {
                id: maxId + 1,
                nombre,
                weight_blandas: weightBlandas,
                weight_metas: weightMetas,
                weight_puntualidad: weightPuntualidad
            };

            ciclos.push(nuevoCiclo);
            localStorage.setItem('intigravity_eval_ciclos', JSON.stringify(ciclos));
            showToast('Ciclo de evaluación registrado.', 'success');
            formCiclo.reset();
            document.getElementById('weight-blandas').value = 30;
            document.getElementById('weight-metas').value = 40;
            document.getElementById('weight-puntualidad').value = 30;
            
            poblarCiclosList();
            poblarSelectoresCalificar();
        };
    }

    // Configurar estrellas interactivas
    configurarEstrellasInteractivas('rating-blandas-stars', 'eval-score-blandas');
    configurarEstrellasInteractivas('rating-metas-stars', 'eval-score-metas');

    // Cambios en selectores para calcular puntualidad automática
    const selectColab = document.getElementById('eval-select-colab');
    const selectCiclo = document.getElementById('eval-select-ciclo');

    function actualizarPuntualidadDisplay() {
        const cedula = selectColab.value;
        const cicloId = selectCiclo.value;

        if (cedula && cicloId) {
            const ciclos = intigravity_eval_ciclos;
            const ciclo = ciclos.find(c => c.id === parseInt(cicloId));
            if (ciclo) {
                const score = calcularPuntualidadAutomatica(cedula, ciclo.nombre);
                document.getElementById('eval-score-puntualidad-display').textContent = score.toFixed(1);
                document.getElementById('eval-score-puntualidad').value = score;
            }
        } else {
            document.getElementById('eval-score-puntualidad-display').textContent = 'N/A';
            document.getElementById('eval-score-puntualidad').value = '0';
        }
    }

    if (selectColab) selectColab.onchange = actualizarPuntualidadDisplay;
    if (selectCiclo) selectCiclo.onchange = actualizarPuntualidadDisplay;

    // Submit de calificación
    const formCalificar = document.getElementById('form-calificar-colab');
    if (formCalificar) {
        formCalificar.onsubmit = function(e) {
            e.preventDefault();
            const cedula = parseInt(selectColab.value);
            const cicloId = parseInt(selectCiclo.value);
            const scoreBlandas = parseFloat(document.getElementById('eval-score-blandas').value) || 0;
            const scoreMetas = parseFloat(document.getElementById('eval-score-metas').value) || 0;
            const scorePuntualidad = parseFloat(document.getElementById('eval-score-puntualidad').value) || 0;
            const feedback = document.getElementById('eval-feedback-jefe').value.trim();

            if (!cedula || !cicloId) {
                showToast('Seleccione un colaborador y un ciclo de evaluación.', 'danger');
                return;
            }
            if (scoreBlandas === 0 || scoreMetas === 0) {
                showToast('Califique todas las métricas (1-5 estrellas).', 'danger');
                return;
            }

            const ciclos = intigravity_eval_ciclos;
            const ciclo = ciclos.find(c => c.id === cicloId);
            if (!ciclo) return;

            // Calcular nota final ponderada
            const notaFinal = (scoreBlandas * (ciclo.weight_blandas / 100)) + 
                              (scoreMetas * (ciclo.weight_metas / 100)) + 
                              (scorePuntualidad * (ciclo.weight_puntualidad / 100));

            const evaluacion = {
                cedula_colaborador: cedula,
                ciclo_evaluacion: ciclo.nombre,
                competencias_blandas: scoreBlandas,
                cumplimiento_metas: scoreMetas,
                puntualidad: scorePuntualidad,
                nota_final: parseFloat(notaFinal.toFixed(2)),
                feedback_jefe: feedback,
                comentarios_colaborador: '',
                firma_conformidad_canvas: '',
                estado: 'COMPLETADA',
                fecha_creacion: new Date().toISOString().split('T')[0],
                fecha_firma: null
            };

            // Enviar a Django
            fetch(window.location.pathname, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                body: JSON.stringify({
                    accion: 'guardar_evaluacion',
                    cedula: cedula,
                    periodo: ciclo.nombre,
                    fecha: evaluacion.fecha_creacion,
                    puntaje_global: evaluacion.nota_final,
                    feedback: evaluacion.feedback_jefe,
                    metas: "Blandas: " + scoreBlandas + ", Metas: " + scoreMetas
                })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    showToast('Evaluación registrada con éxito.', 'success');
                    setTimeout(() => {
                        window.location.reload();
                    }, 1000);
                } else {
                    showToast(data.message, 'error');
                }
            })
            .catch(err => {
                showToast('Error de conexión', 'error');
                console.error(err);
            });
        };
    }
}

function poblarCiclosList() {
    const listEl = document.getElementById('eval-ciclos-list');
    if (!listEl) return;

    const ciclos = intigravity_eval_ciclos;
    listEl.innerHTML = '';

    if (ciclos.length === 0) {
        listEl.innerHTML = '<div style="font-size:0.8rem; font-style:italic; color:var(--text-secondary);">No hay ciclos creados.</div>';
    } else {
        ciclos.forEach(c => {
            listEl.innerHTML += `
                <div style="background-color: var(--bg-secondary); border: 1px solid var(--card-border); padding: 10px; border-radius: var(--radius-sm); font-size: 0.8rem;">
                    <strong>${c.nombre}</strong><br>
                    <small style="color:var(--text-secondary)">Ponderación: Blandas ${c.weight_blandas}% | Metas ${c.weight_metas}% | Puntualidad ${c.weight_puntualidad}%</small>
                </div>
            `;
        });
    }
}

function poblarSelectoresCalificar() {
    const selectColab = document.getElementById('eval-select-colab');
    const selectCiclo = document.getElementById('eval-select-ciclo');
    if (!selectColab || !selectCiclo) return;

    // Colaboradores (excluir Jefe o autocalificaciones no necesarias, solo Colaboradores normales)
    const colaboradores = obtenerColaboradores().filter(c => c.rol === 'COLABORADOR');
    selectColab.innerHTML = '<option value="" disabled selected>Seleccione colaborador...</option>';
    colaboradores.forEach(c => {
        selectColab.innerHTML += `<option value="${c.cedula}">${c.nombre} (Cédula: ${c.cedula})</option>`;
    });

    // Ciclos
    const ciclos = intigravity_eval_ciclos;
    selectCiclo.innerHTML = '<option value="" disabled selected>Seleccione ciclo...</option>';
    ciclos.forEach(c => {
        selectCiclo.innerHTML += `<option value="${c.id}">${c.nombre}</option>`;
    });
}

function configurarEstrellasInteractivas(containerId, inputId) {
    const container = document.getElementById(containerId);
    const input = document.getElementById(inputId);
    if (!container || !input) return;

    const stars = container.querySelectorAll('span');
    
    stars.forEach(star => {
        star.onclick = function() {
            const val = parseInt(this.dataset.star);
            input.value = val;
            
            // Pintar estrellas
            stars.forEach(s => {
                const sVal = parseInt(s.dataset.star);
                if (sVal <= val) {
                    s.style.color = '#eab308'; // Amarillo brillante
                } else {
                    s.style.color = 'var(--card-border)';
                }
            });
        };
    });
}

function resetStarsRating(containerId, inputId) {
    const container = document.getElementById(containerId);
    const input = document.getElementById(inputId);
    if (input) input.value = 0;
    if (container) {
        container.querySelectorAll('span').forEach(s => {
            s.style.color = 'var(--card-border)';
        });
    }
}

function renderizarEvaluacionesAdminTable() {
    const body = document.getElementById('table-evaluations-admin-body');
    if (!body) return;

    const evaluaciones = obtenerEvaluaciones();
    const colaboradores = obtenerColaboradores();
    body.innerHTML = '';

    if (evaluaciones.length === 0) {
        body.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-secondary);">No hay evaluaciones registradas.</td></tr>';
        return;
    }

    evaluaciones.forEach(ev => {
        const colab = colaboradores.find(c => c.cedula === ev.cedula_colaborador);
        const colabNombre = colab ? colab.nombre : `Cédula: ${ev.cedula_colaborador}`;
        const estadoLabel = ev.estado === 'FIRMADA' 
            ? '<span class="badge badge-success">Firmada</span>' 
            : '<span class="badge badge-warning">Pendiente Firma</span>';

        body.innerHTML += `
            <tr>
                <td><strong>${colabNombre}</strong></td>
                <td>${ev.ciclo_evaluacion}</td>
                <td>${ev.competencias_blandas.toFixed(1)} / 5.0</td>
                <td>${ev.cumplimiento_metas.toFixed(1)} / 5.0</td>
                <td>${ev.puntualidad.toFixed(1)} / 5.0</td>
                <td><strong style="color:var(--accent);">${ev.nota_final.toFixed(2)}</strong></td>
                <td>${estadoLabel}</td>
            </tr>
        `;
    });
}

function calcularPuntualidadAutomatica(cedula, cicloNombre) {
    const registros = obtenerRegistros();
    let anio = 2026;
    const match = cicloNombre.match(/\d{4}/);
    if (match) {
        anio = parseInt(match[0]);
    }

    const retardos = registros.filter(r => 
        r.cedula_colaborador == cedula && 
        r.fecha.startsWith(anio.toString()) && 
        r.estado_ingreso === 'RETARDO'
    ).length;

    // Regla: 5.0 - (retardos * 0.5), min 1.0
    const score = Math.max(1.0, 5.0 - (retardos * 0.5));
    return parseFloat(score.toFixed(1));
}


// --- VISTA COLABORADOR (AUTO-SERVICIO) ---
function inicializarEvaluationsColab(cedula) {
    renderizarMisEvaluaciones(cedula);

    const btnBack = document.getElementById('btn-back-to-evals');
    if (btnBack) {
        btnBack.onclick = function() {
            document.getElementById('eval-colab-detail-card').style.display = 'none';
            document.getElementById('evaluations-colab-panel').querySelector('.glass-card').style.display = 'block';
            inicializarEvaluationsColab(cedula);
        };
    }

    inicializarCanvasFirmaColab();
}

function renderizarMisEvaluaciones(cedula) {
    const listEl = document.getElementById('colaborador-evals-list');
    if (!listEl) return;

    const evaluaciones = obtenerEvaluaciones().filter(ev => ev.cedula_colaborador == cedula);
    listEl.innerHTML = '';

    if (evaluaciones.length === 0) {
        listEl.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:20px; color:var(--text-secondary); background:var(--bg-secondary); border-radius:var(--radius-md);">No tiene evaluaciones de desempeño registradas en el sistema.</div>';
        return;
    }

    evaluaciones.forEach(ev => {
        const card = document.createElement('div');
        card.className = 'glass-card hover-card';
        card.style.cursor = 'pointer';
        card.style.marginBottom = '0';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.justifyContent = 'space-between';
        
        const firmBadge = ev.estado === 'FIRMADA' 
            ? '<span class="badge badge-success">Concluida</span>' 
            : '<span class="badge badge-warning">Pendiente Firma</span>';

        card.innerHTML = `
            <div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <span style="font-weight:700; color:var(--accent);">${ev.ciclo_evaluacion}</span>
                    ${firmBadge}
                </div>
                <div style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:12px;">
                    Fecha de evaluación: <strong>${ev.fecha_creacion}</strong>
                </div>
                <div style="font-size:1.6rem; font-weight:800; color:var(--text-primary); margin-bottom:10px;">
                    ${ev.nota_final.toFixed(2)} / 5.0
                </div>
                <p style="font-size:0.75rem; color:var(--text-secondary); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">
                    Feedback: "${ev.feedback_jefe}"
                </p>
            </div>
            <button class="btn btn-secondary" style="width:100%; margin-top:15px; font-size:0.8rem;">Ver Detalles</button>
        `;

        card.onclick = function() {
            verDetalleEvaluacionColab(ev);
        };

        listEl.appendChild(card);
    });
}

function verDetalleEvaluacionColab(ev) {
    selectedEvalId = ev.id_evaluacion;

    document.getElementById('evaluations-colab-panel').querySelector('.glass-card').style.display = 'none';
    document.getElementById('eval-colab-detail-card').style.display = 'block';

    document.getElementById('eval-detail-title').textContent = `Evaluación: ${ev.ciclo_evaluacion}`;
    document.getElementById('eval-detail-blandas').textContent = `${ev.competencias_blandas.toFixed(1)} / 5.0`;
    document.getElementById('eval-detail-metas').textContent = `${ev.cumplimiento_metas.toFixed(1)} / 5.0`;
    document.getElementById('eval-detail-puntualidad').textContent = `${ev.puntualidad.toFixed(1)} / 5.0`;
    document.getElementById('eval-detail-final').textContent = `${ev.nota_final.toFixed(2)} / 5.0`;
    document.getElementById('eval-detail-feedback').textContent = ev.feedback_jefe;

    const signatureSection = document.getElementById('eval-signature-section');
    const commentsInput = document.getElementById('eval-colab-comments');
    const commentsView = document.getElementById('eval-colab-comments-view');
    const canvas = document.getElementById('eval-colab-canvas');
    const imgFirma = document.getElementById('eval-colab-firma-img');
    const btnSubmit = document.getElementById('btn-submit-eval-signature');
    const btnClear = document.getElementById('btn-clear-eval-canvas');

    limpiarCanvasFirmaColab();

    if (ev.estado === 'FIRMADA') {
        // Modo sólo lectura
        commentsInput.style.display = 'none';
        commentsView.textContent = ev.comentarios_colaborador || '(Sin comentarios registrados)';
        commentsView.style.display = 'block';
        
        canvas.style.display = 'none';
        if (ev.firma_conformidad_canvas) {
            imgFirma.src = ev.firma_conformidad_canvas;
            imgFirma.style.display = 'block';
        } else {
            imgFirma.style.display = 'none';
        }
        
        if (btnSubmit) btnSubmit.style.display = 'none';
        if (btnClear) btnClear.style.display = 'none';
    } else {
        // Modo firma activo
        commentsInput.value = '';
        commentsInput.style.display = 'block';
        commentsView.style.display = 'none';

        canvas.style.display = 'block';
        imgFirma.style.display = 'none';

        if (btnSubmit) {
            btnSubmit.style.display = 'block';
            btnSubmit.onclick = function() {
                if (!evalHasDrawn) {
                    showToast('Por favor, firme en el lienzo de conformidad.', 'danger');
                    return;
                }

                const comentarios = commentsInput.value.trim();
                // Optimización de Memoria: Usar WebP con 50% de calidad
                const firmaBase64 = canvas.toDataURL('image/webp', 0.5);

                const evaluacion = obtenerEvaluacionPorId(selectedEvalId);
                if (evaluacion) {
                    evaluacion.comentarios_colaborador = comentarios;
                    evaluacion.firma_conformidad_canvas = firmaBase64;
                    evaluacion.estado = 'FIRMADA';
                    evaluacion.fecha_firma = new Date().toISOString().split('T')[0];

                    guardarEvaluacion(evaluacion);
                    showToast('Evaluación firmada y completada con éxito.', 'success');
                    
                    // Volver
                    document.getElementById('eval-colab-detail-card').style.display = 'none';
                    document.getElementById('evaluations-colab-panel').querySelector('.glass-card').style.display = 'block';
                    inicializarEvaluationsColab(evaluacion.cedula_colaborador);
                    if (typeof actualizarDashboardCompleto === 'function') {
                        actualizarDashboardCompleto();
                    }
                }
            };
        }
        if (btnClear) btnClear.style.display = 'block';
    }
}

function inicializarCanvasFirmaColab() {
    const canvas = document.getElementById('eval-colab-canvas');
    if (!canvas) return;

    evalCanvas = canvas;
    evalCtx = canvas.getContext('2d');

    // Estilos del trazo
    evalCtx.strokeStyle = '#018C8C';
    evalCtx.lineWidth = 3;
    evalCtx.lineCap = 'round';
    evalCtx.lineJoin = 'round';

    function getPos(e) {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }

    // Eventos Mouse
    canvas.onmousedown = function(e) {
        isEvalDrawing = true;
        evalLastPos = getPos(e);
    };

    canvas.onmousemove = function(e) {
        if (!isEvalDrawing) return;
        const currentPos = getPos(e);
        evalCtx.beginPath();
        evalCtx.moveTo(evalLastPos.x, evalLastPos.y);
        evalCtx.lineTo(currentPos.x, currentPos.y);
        evalCtx.stroke();
        evalLastPos = currentPos;
        evalHasDrawn = true;
    };

    window.addEventListener('mouseup', () => { isEvalDrawing = false; });
    canvas.onmouseleave = function() { isEvalDrawing = false; };

    // Eventos Touch
    canvas.addEventListener('touchstart', (e) => {
        isEvalDrawing = true;
        evalLastPos = getPos(e);
        e.preventDefault();
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        if (!isEvalDrawing) return;
        const currentPos = getPos(e);
        evalCtx.beginPath();
        evalCtx.moveTo(evalLastPos.x, evalLastPos.y);
        evalCtx.lineTo(currentPos.x, currentPos.y);
        evalCtx.stroke();
        evalLastPos = currentPos;
        evalHasDrawn = true;
        e.preventDefault();
    }, { passive: false });

    canvas.addEventListener('touchend', () => { isEvalDrawing = false; });

    // Botón limpiar
    const btnClear = document.getElementById('btn-clear-eval-canvas');
    if (btnClear) {
        btnClear.onclick = limpiarCanvasFirmaColab;
    }
}

function limpiarCanvasFirmaColab() {
    if (!evalCanvas || !evalCtx) return;
    evalCtx.clearRect(0, 0, evalCanvas.width, evalCanvas.height);
    evalHasDrawn = false;
}

// Auto-inicialización para soportar navegación asíncrona (HTMX)
setTimeout(() => {
    if (document.getElementById('evaluations-view') || document.getElementById('evaluaciones-grid')) {
        if (typeof window.inicializarEvaluaciones === 'function') {
            window.inicializarEvaluaciones();
        } else if (typeof renderCiclos === 'function') {
            renderCiclos();
            renderTablaEvaluaciones();
            setupFirmaModal();
        }
    }
}, 150);



