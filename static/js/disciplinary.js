// js/disciplinary.js
// Controlador para el Módulo 5: Gestión de Actas Disciplinarias Automáticas (Flujo de Descargos)

var BOSS_SIGNATURE_SVG = `<svg width="150" height="60" viewBox="0 0 150 60" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 30 C 30 10, 40 50, 60 20 C 80 -10, 90 40, 110 30 C 130 20, 140 10, 145 15" stroke="#1e3a8a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 35 L 130 35" stroke="#1e3a8a" stroke-width="1.5" stroke-dasharray="4 4"/><text x="15" y="52" fill="#1e3a8a" font-family="'Poppins', sans-serif" font-size="9" font-weight="bold">Firma Autorizada Jefe</text></svg>`;

var signatureCanvas = null;
var signatureCtx = null;
var isSignatureDrawing = false;
var signatureLastPos = { x: 0, y: 0 };
var signatureHasDrawn = false;
var selectedActaId = null;

function inicializarDisciplinary() {
    let config = {};
    let sesion = { rol: 'ADMINISTRADOR', cedula: null };
    try {
        config = obtenerConfiguracion();
        if (config && config.sesion_activa) {
            sesion = config.sesion_activa;
        }
    } catch(e) {
        console.warn("No se pudo obtener configuracion, usando defaults", e);
    }

    const adminView = document.getElementById('disciplinary-admin-view');
    const colabView = document.getElementById('disciplinary-colaborador-view');
    const formContainer = document.getElementById('disciplinary-form-container');

    if (sesion.rol === 'ADMINISTRADOR') {
        if (adminView) adminView.style.display = 'block';
        if (colabView) colabView.style.display = 'none';
        if (formContainer) formContainer.style.display = 'none';
        
        escanearInfraccionesSemanales();
        renderizarActasAdmin();
        setupListenersAdmin();
    } else {
        if (adminView) adminView.style.display = 'none';
        if (colabView) colabView.style.display = 'block';
        if (formContainer) formContainer.style.display = 'none';

        renderizarActasColaborador(sesion.cedula);
    }

    setupFormListeners();
    inicializarCanvasFirma();
    inicializarImportacionActas();
}

// --- MAPEO DE CARGO Y ÁREA AUXILIAR ---
function obtenerCargoYArea(cedula) {
    const colab = obtenerColaboradorPorCedula(cedula);
    if (colab && colab.cargo && colab.area) {
        return { cargo: colab.cargo, area: colab.area };
    }
    const mappings = {
        10102020: { cargo: 'Analista de TI', area: 'Tecnología' },
        10203030: { cargo: 'Analista de Calidad', area: 'Gestión Humana' },
        10304040: { cargo: 'Operario de Planta', area: 'Producción' },
        10405050: { cargo: 'Operario de Turno', area: 'Producción' }
    };
    return mappings[cedula] || { cargo: 'Auxiliar General', area: 'Operaciones' };
}

// --- ESCÁNER DE INFRACCIONES (ADMIN) ---
function escanearInfraccionesSemanales() {
    const listEl = document.getElementById('disciplinary-warnings-list');
    if (!listEl) return;

    listEl.innerHTML = '';
    const colaboradores = obtenerColaboradores();
    const registros = obtenerRegistros();
    const actas = obtenerActas();

    // Optimización O(N): Agrupar todos los retardos primero
    const retardosGlobales = {};
    registros.forEach(r => {
        if (r.estado_ingreso === 'RETARDO') {
            if (!retardosGlobales[r.cedula_colaborador]) retardosGlobales[r.cedula_colaborador] = [];
            retardosGlobales[r.cedula_colaborador].push(r);
        }
    });

    let warningsCount = 0;

    colaboradores.forEach(colab => {
        // Obtener registros con retardo pre-agrupados O(1)
        const retardosColab = retardosGlobales[colab.cedula] || [];

        // Agrupar retardos por año y semana calendario
        const gruposPorSemana = {};
        retardosColab.forEach(r => {
            const [yearStr] = r.fecha.split('-');
            const year = parseInt(yearStr);
            const week = r.semana_calendario;
            const key = `${year}-W${week}`;

            if (!gruposPorSemana[key]) {
                gruposPorSemana[key] = {
                    year,
                    week,
                    registros: []
                };
            }
            gruposPorSemana[key].registros.push(r);
        });

        // Verificar si califica para acta disciplinaria (4 o más en una semana)
        Object.keys(gruposPorSemana).forEach(key => {
            const grupo = gruposPorSemana[key];
            if (grupo.registros.length >= 4) {
                // Verificar si ya tiene un acta para este año y semana
                const existeActa = actas.some(a => 
                    a.cedula_colaborador === colab.cedula && 
                    a.semana_relacionada === grupo.week && 
                    a.anio_relacionado === grupo.year
                );

                if (!existeActa) {
                    warningsCount++;
                    // Mostrar tarjeta de advertencia
                    const card = document.createElement('div');
                    card.className = 'glass-card';
                    card.style.border = '1px solid var(--warning)';
                    card.style.padding = '15px';
                    card.style.marginBottom = '0';
                    card.style.display = 'flex';
                    card.style.flexDirection = 'column';
                    card.style.justifyContent = 'space-between';

                    // Formatear fechas de retardos para mostrar
                    const listRetardosHtml = grupo.registros.map(r => {
                        const [y, m, d] = r.fecha.split('-');
                        return `<li style="font-size: 0.75rem; margin-top:2px;">📅 ${d}/${m}/${y} - ingresó: <strong>${r.hora_ingreso}</strong></li>`;
                    }).join('');

                    card.innerHTML = `
                        <div>
                            <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary); margin-bottom: 6px;">
                                ${colab.nombre}
                            </div>
                            <div style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 8px;">
                                Cédula: <strong>${colab.cedula}</strong> | Semana: <strong>${grupo.week}</strong> (Año ${grupo.year})
                            </div>
                            <div style="background-color: var(--bg-secondary); padding: 8px; border-radius: 4px; margin-bottom: 12px; border: 1px solid var(--card-border);">
                                <span style="font-weight: 600; font-size: 0.75rem; color: var(--danger); display: block; margin-bottom: 4px;">⚠️ Acumula ${grupo.registros.length} retardos en la semana:</span>
                                <ul style="margin: 0; padding-left: 15px; color: var(--text-primary);">
                                    ${listRetardosHtml}
                                </ul>
                            </div>
                        </div>
                        <button class="btn btn-primary btn-generate-acta" data-cedula="${colab.cedula}" data-semana="${grupo.week}" data-anio="${grupo.year}" style="width: 100%; font-size: 0.8rem; padding: 8px 12px;">
                            Generar Acta Disciplinaria
                        </button>
                    `;
                    listEl.appendChild(card);
                }
            }
        });
    });

    if (warningsCount === 0) {
        listEl.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 20px; color: var(--text-secondary); font-size: 0.85rem; background-color: var(--bg-secondary); border-radius: var(--radius-md); border: 1px dashed var(--card-border);">
                ✅ No se detectaron nuevos casos de colaboradores que califiquen para actas esta semana.
            </div>
        `;
    } else {
        // Enlazar los botones generados
        document.querySelectorAll('.btn-generate-acta').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const cedula = parseInt(e.target.dataset.cedula);
                const semana = parseInt(e.target.dataset.semana);
                const anio = parseInt(e.target.dataset.anio);
                generarActaAutomatica(cedula, semana, anio);
            });
        });
    }
}

// --- GENERACIÓN AUTOMÁTICA DE ACTA ---
function generarActaAutomatica(cedula, semana, anio) {
    const colab = obtenerColaboradorPorCedula(cedula);
    if (!colab) {
        showToast('Error: Colaborador no encontrado', 'danger');
        return;
    }

    const registros = obtenerRegistros();
    const actas = obtenerActas();

    // Obtener retardos de la semana específica para la fecha de infracción
    const retardosSemana = registros.filter(r => 
        r.cedula_colaborador === cedula && 
        r.semana_calendario === semana && 
        r.fecha.startsWith(anio.toString()) && 
        r.estado_ingreso === 'RETARDO'
    );

    if (retardosSemana.length === 0) {
        showToast('No se encontraron retardos para esa semana', 'danger');
        return;
    }

    // Determinar mes y año de la infracción para calcular antecedentes
    const refDate = new Date(retardosSemana[0].fecha + 'T00:00:00');
    const mesInfractor = refDate.getMonth(); // 0-indexed
    const anioInfractor = refDate.getFullYear();

    // Obtener todos los retardos del colaborador en el MES de la infracción
    const retardosMes = registros.filter(r => {
        if (r.cedula_colaborador !== cedula || r.estado_ingreso !== 'RETARDO') return false;
        const d = new Date(r.fecha + 'T00:00:00');
        return d.getMonth() === mesInfractor && d.getFullYear() === anioInfractor;
    });

    // Ordenar cronológicamente
    retardosMes.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    // Determinar si tiene antecedente de actas en el mismo mes
    const tieneAntecedenteMes = actas.some(a => {
        if (a.cedula_colaborador !== cedula) return false;
        const d = new Date(a.fecha_emision + 'T00:00:00');
        return d.getMonth() === mesInfractor && d.getFullYear() === anioInfractor;
    });

    // Tipificación de falta según las reglas del apartado 3.4
    const cantRetardosSemana = retardosSemana.length;
    let tipoFalta = 'LEVE';

    if (cantRetardosSemana === 4 && !tieneAntecedenteMes) {
        tipoFalta = 'LEVE';
    } else if (cantRetardosSemana === 5 || (cantRetardosSemana === 4 && tieneAntecedenteMes)) {
        tipoFalta = 'GRAVE';
    } else if (cantRetardosSemana >= 6) {
        tipoFalta = 'MUY_GRAVE';
    }

    // Formatear los retardos del mes
    const retardosFormatted = retardosMes.map(r => {
        const [y, m, d] = r.fecha.split('-');
        return `${d}/${m}/${y} - ${r.hora_ingreso}`;
    }).join(', ');

    // Construir datos del colaborador
    const cInfo = obtenerCargoYArea(cedula);

    // Obtener fecha actual en formato Colombia
    const hoy = new Date();
    const hoyStr = hoy.toISOString().split('T')[0];

    // Buscar la firma del jefe asignado
    let firmaJefe = BOSS_SIGNATURE_SVG;
    if (colab.jefe_asignado_cedula) {
        const jefe = obtenerColaboradorPorCedula(colab.jefe_asignado_cedula);
        if (jefe && jefe.firma_jefe_canvas) {
            firmaJefe = jefe.firma_jefe_canvas;
        }
    } else {
        // Fallback al primer jefe inmediato registrado que tenga firma
        const todosColabs = obtenerColaboradores();
        const primerJefe = todosColabs.find(c => c.rol === 'JEFE_INMEDIATO' && c.firma_jefe_canvas);
        if (primerJefe) {
            firmaJefe = primerJefe.firma_jefe_canvas;
        }
    }

    const descripcionGenerada = `El colaborador durante el mes, registró llegadas tardías en las siguientes fechas, con hora de ingreso: [${retardosFormatted}]. Lo anterior evidencia una conducta reiterada de incumplimiento del horario laboral establecido por la empresa, situación que ha sido previamente informada al colaborador.`;

    fetch(window.location.href, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        },
        body: JSON.stringify({
            accion: 'crear_acta',
            cedula: cedula,
            fecha_emision: hoyStr,
            tipo_falta: tipoFalta,
            decision: descripcionGenerada,
            semana_relacionada: semana,
            anio_relacionado: anio
        })
    })
    .then(r => r.json())
    .then(data => {
        if (data.success) {
            showToast(`Acta disciplinaria (${tipoFalta}) generada con éxito.`, 'success');
            setTimeout(() => window.location.reload(), 1500);
        } else {
            showToast('Error al generar acta: ' + data.message, 'danger');
        }
    })
    .catch(err => {
        showToast('Error de red', 'danger');
        console.error(err);
    });
}

// --- RENDERIZAR HISTORIAL DE ACTAS (ADMIN) ---
function renderizarActasAdmin() {
    const tbody = document.getElementById('table-actas-body');
    if (!tbody) return;

    tbody.innerHTML = '';
    const actas = obtenerActas();

    const searchVal = document.getElementById('filter-acta-search').value.toLowerCase();
    const faltaVal = document.getElementById('filter-acta-falta').value;
    const estadoVal = document.getElementById('filter-acta-estado').value;

    const filtradas = actas.filter(a => {
        const matchesSearch = a.nombre_colaborador.toLowerCase().includes(searchVal) || a.cedula_colaborador.toString().includes(searchVal);
        const matchesFalta = faltaVal === 'all' || a.tipo_falta === faltaVal;
        const matchesEstado = estadoVal === 'all' || a.estado_acta === estadoVal;
        return matchesSearch && matchesFalta && matchesEstado;
    });

    if (filtradas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-secondary);">No se encontraron actas disciplinarias.</td></tr>';
        return;
    }

    // Ordenar descendentemente por ID
    filtradas.sort((a, b) => b.id_acta - a.id_acta);

    filtradas.forEach(a => {
        const [y, m, d] = (a.fecha_emision || '2026-01-01').split('-');
        const badgeFalta = a.tipo_falta === 'LEVE' ? '<span class="badge" style="background-color: var(--accent-light); color: var(--accent);">Leve</span>' :
                            a.tipo_falta === 'GRAVE' ? '<span class="badge badge-warning">Grave</span>' :
                            '<span class="badge badge-danger">Muy Grave</span>';
        
        const badgeEstado = a.estado_acta === 'PENDIENTE_FIRMA' ? '<span class="badge badge-warning">Pendiente Firma</span>' : '<span class="badge badge-success">Concluida</span>';

        tbody.innerHTML += `
            <tr>
                <td style="font-weight: 700;">#ACTA-${a.id_acta.toString().padStart(4, '0')}</td>
                <td><strong>${a.nombre_colaborador}</strong><br><small style="color:var(--text-secondary);">${a.cedula_colaborador}</small></td>
                <td>${d}/${m}/${y}</td>
                <td>${badgeFalta}</td>
                <td style="text-align: center;">${a.decision ? (a.decision.match(/\d{2}\/\d{2}\/\d{4}/g) || []).length : (a.fechas_retardo_relacionadas || []).length}</td>
                <td>${badgeEstado}</td>
                <td>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-secondary btn-view-acta" data-id="${a.id_acta}" style="padding: 4px 8px; font-size: 0.75rem;">
                            Ver Detalles
                        </button>
                        <button class="btn btn-danger btn-delete-acta" data-id="${a.id_acta}" style="padding: 4px 8px; font-size: 0.75rem;">
                            Eliminar
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    // Enlazar acciones
    document.querySelectorAll('.btn-view-acta').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.currentTarget.dataset.id);
            mostrarFormularioActa(id);
        });
    });

    document.querySelectorAll('.btn-delete-acta').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.currentTarget.dataset.id);
            if (confirm(`¿Está seguro de eliminar el acta disciplinaria #ACTA-${id.toString().padStart(4, '0')}?`)) {
                fetch(window.location.href, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCookie('csrftoken')
                    },
                    body: JSON.stringify({
                        accion: 'eliminar_acta',
                        id_acta: id
                    })
                })
                .then(r => r.json())
                .then(data => {
                    if (data.success) {
                        showToast('Acta eliminada con éxito', 'success');
                        setTimeout(() => window.location.reload(), 1000);
                    } else {
                        showToast('Error al eliminar acta: ' + data.message, 'danger');
                    }
                })
                .catch(err => {
                    showToast('Error de red', 'danger');
                    console.error(err);
                });
            }
        });
    });
}

// --- RENDERIZAR ACTAS DEL COLABORADOR ---
function renderizarActasColaborador(cedula) {
    const listEl = document.getElementById('colaborador-actas-list');
    const alertEl = document.getElementById('disciplinary-colab-pending-alert');
    if (!listEl) return;

    listEl.innerHTML = '';
    const actas = obtenerActas().filter(a => a.cedula_colaborador == cedula);

    const pendientes = actas.filter(a => a.estado_acta === 'PENDIENTE_FIRMA');
    if (alertEl) {
        alertEl.style.display = pendientes.length > 0 ? 'block' : 'none';
    }

    if (actas.length === 0) {
        listEl.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 30px; color: var(--text-secondary); background-color: var(--bg-secondary); border-radius: var(--radius-md); border: 1px dashed var(--card-border);">
                Sin actas disciplinarias
            </div>
        `;
        return;
    }

    // Ordenar descendentemente
    actas.sort((a, b) => b.id_acta - a.id_acta);

    actas.forEach(a => {
        const [y, m, d] = (a.fecha_emision || '2026-01-01').split('-');
        const isPending = a.estado_acta === 'PENDIENTE_FIRMA';
        const cardBorder = isPending ? 'border: 2px solid var(--danger);' : 'border: 1px solid var(--card-border);';
        
        const badgeFalta = a.tipo_falta === 'LEVE' ? '<span class="badge" style="background-color: var(--accent-light); color: var(--accent);">Leve</span>' :
                            a.tipo_falta === 'GRAVE' ? '<span class="badge badge-warning">Grave</span>' :
                            '<span class="badge badge-danger">Muy Grave</span>';
        
        const badgeEstado = isPending ? '<span class="badge badge-danger">Pendiente Firma</span>' : '<span class="badge badge-success">Concluida</span>';

        listEl.innerHTML += `
            <div class="glass-card" style="margin-bottom:0; display:flex; flex-direction:column; justify-content:space-between; ${cardBorder}">
                <div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                        <span style="font-weight:700; font-size:1.05rem; color:var(--text-primary);">ACTA-${a.id_acta.toString().padStart(4, '0')}</span>
                        ${badgeEstado}
                    </div>
                    <div style="display:flex; gap:10px; margin-bottom:12px;">
                        ${badgeFalta}
                        <span style="font-size:0.8rem; color:var(--text-secondary);">Emitida: ${d}/${m}/${y}</span>
                    </div>
                    <p style="font-size:0.8rem; color:var(--text-secondary); line-height:1.4; margin-bottom:15px;">
                        Esta acta se generó debido a la acumulación de retardos en el mes consultado. Registra un total de <strong>${a.decision ? (a.decision.match(/\d{2}\/\d{2}\/\d{4}/g) || []).length : (a.fechas_retardo_relacionadas || []).length}</strong> llegadas tardes.
                    </p>
                </div>
                <button class="btn ${isPending ? 'btn-primary' : 'btn-secondary'} btn-action-colab-acta" data-id="${a.id_acta}" style="width:100%; padding:10px 14px; font-weight:600;">
                    ${isPending ? 'Revisar y Firmar Descargos' : 'Ver Acta Firmada'}
                </button>
            </div>
        `;
    });

    // Vincular botones
    document.querySelectorAll('.btn-action-colab-acta').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.target.dataset.id);
            mostrarFormularioActa(id);
        });
    });
}

// --- MOSTRAR DETALLE DE ACTA / FORMULARIO ---
function mostrarFormularioActa(id_acta) {
    const actas = obtenerActas();
    const acta = actas.find(a => a.id_acta === id_acta);
    if (!acta) return;

    // Control de seguridad por Rol y Cédula
    const config = obtenerConfiguracion();
    const sesion = config.sesion_activa || { rol: 'ADMINISTRADOR', cedula: null };
    if (sesion.rol === 'COLABORADOR' && acta.cedula_colaborador !== sesion.cedula) {
        showToast('Acceso no autorizado a este documento.', 'danger');
        return;
    }

    selectedActaId = id_acta;

    // Ocultar vistas de listado
    const adminView = document.getElementById('disciplinary-admin-view');
    const colabView = document.getElementById('disciplinary-colaborador-view');
    const formContainer = document.getElementById('disciplinary-form-container');

    if (adminView) adminView.style.display = 'none';
    if (colabView) colabView.style.display = 'none';
    if (formContainer) formContainer.style.display = 'block';

    // Rellenar campos
    const colabActa = obtenerColaboradorPorCedula(acta.cedula_colaborador);
    document.getElementById('acta-form-nombre').value = acta.nombre_colaborador;
    document.getElementById('acta-form-cedula').value = acta.cedula_colaborador;
    document.getElementById('acta-form-cargo').value = colabActa ? colabActa.cargo : '';
    document.getElementById('acta-form-area').value = colabActa ? colabActa.area : '';

    const normalFields = document.getElementById('acta-normal-fields');
    const importedView = document.getElementById('acta-imported-view');

    if (acta.imagen_importada_base64) {
        if (normalFields) normalFields.style.display = 'none';
        if (importedView) {
            importedView.style.display = 'block';
            document.getElementById('acta-imported-colab-name').textContent = `${acta.nombre_colaborador} (Cédula: ${acta.cedula_colaborador})`;
            document.getElementById('acta-imported-date').textContent = acta.fecha_emision.split('-').reverse().join('/');
            
            const badgeFalta = acta.tipo_falta === 'LEVE' ? '<span class="badge" style="background-color: var(--accent-light); color: var(--accent);">Leve</span>' :
                                acta.tipo_falta === 'GRAVE' ? '<span class="badge badge-warning">Grave</span>' :
                                '<span class="badge badge-danger">Muy Grave</span>';
            document.getElementById('acta-imported-falta-badge').innerHTML = badgeFalta;
            document.getElementById('acta-imported-img').src = acta.imagen_importada_base64;
        }
        return; // Detener flujo para no fallar con retardos vacíos
    } else {
        if (normalFields) normalFields.style.display = 'block';
        if (importedView) importedView.style.display = 'none';
    }

    const [y, m, d] = (acta.fecha_emision || '2026-01-01').split('-');
    document.getElementById('acta-form-fecha').value = `${d}/${m}/${y}`;
    document.getElementById('acta-form-decision').value = acta.decision || '';

    // Configurar tipo de falta checkboxes
    document.getElementById('acta-form-falta-leve').checked = acta.tipo_falta === 'LEVE';
    document.getElementById('acta-form-falta-grave').checked = acta.tipo_falta === 'GRAVE';
    document.getElementById('acta-form-falta-muygrave').checked = acta.tipo_falta === 'MUY_GRAVE';

    // Rellenar descripción detallada del hecho
    const retardosList = (acta.fechas_retardo_relacionadas || []).map(r => {
        const [ry, rm, rd] = r.fecha.split('-');
        return `${rd}/${rm}/${ry} - ${r.hora_registro}`;
    }).join(', ');

    const descEl = document.getElementById('acta-form-descripcion');
    descEl.textContent = acta.decision || `El colaborador durante el mes, registró llegadas tardías en las siguientes fechas, con hora de ingreso: [${retardosList}]. Lo anterior evidencia una conducta reiterada de incumplimiento del horario laboral establecido por la empresa, situación que ha sido previamente informada al colaborador.`;

    // Configurar sección de descargos según estado del acta
    const descargosInput = document.getElementById('acta-form-descargos');
    const descargosView = document.getElementById('acta-form-descargos-view');
    const charCountEl = document.getElementById('acta-form-descargos-char-count');

    // Configurar canvas de firma e imagen
    const canvas = document.getElementById('disciplinary-canvas');
    const firmaImg = document.getElementById('acta-form-firma-img');
    const btnClearCanvas = document.getElementById('btn-clear-canvas');
    const submitContainer = document.getElementById('acta-submit-container');

    // Cargar firma del jefe
    const bossContainer = document.getElementById('boss-signature-svg-container');
    const firmaJefe = acta.firma_jefe_precargada || BOSS_SIGNATURE_SVG;
    if (firmaJefe.startsWith('data:image/')) {
        bossContainer.innerHTML = `<img src="${firmaJefe}" style="max-width: 100%; max-height: 100%; object-fit: contain;">`;
    } else {
        bossContainer.innerHTML = firmaJefe;
    }

    // config y sesion ya fueron declarados arriba en esta función

    if (acta.estado_acta === 'PENDIENTE_FIRMA') {
        // Si el rol activo es COLABORADOR y el acta le pertenece
        if (sesion.rol === 'COLABORADOR' && sesion.cedula === acta.cedula_colaborador) {
            descargosInput.style.display = 'block';
            descargosInput.value = '';
            descargosInput.disabled = false;
            descargosView.style.display = 'none';
            if (charCountEl) charCountEl.style.display = 'block';

            if (canvas) canvas.style.display = 'block';
            if (firmaImg) firmaImg.style.display = 'none';
            if (btnClearCanvas) btnClearCanvas.style.display = 'block';
            if (submitContainer) submitContainer.style.display = 'block';

            limpiarLienzoFirma();
        } else {
            // Admin viendo acta pendiente de firma
            descargosInput.style.display = 'none';
            descargosView.style.display = 'block';
            descargosView.textContent = 'Pendiente de descargos por parte del empleado.';
            if (charCountEl) charCountEl.style.display = 'none';

            if (canvas) canvas.style.display = 'block';
            if (firmaImg) firmaImg.style.display = 'none';
            if (btnClearCanvas) btnClearCanvas.style.display = 'none';
            if (submitContainer) submitContainer.style.display = 'none';

            limpiarLienzoFirma();
            // Deshabilitar dibujo para admin
            signatureCtx.fillStyle = "rgba(240, 240, 240, 0.5)";
            signatureCtx.fillRect(0, 0, canvas.width, canvas.height);
        }
    } else {
        // Concluida (Lectura para todos)
        descargosInput.style.display = 'none';
        descargosView.style.display = 'block';
        descargosView.textContent = acta.descargos_colaborador;
        if (charCountEl) charCountEl.style.display = 'none';

        if (canvas) canvas.style.display = 'none';
        if (firmaImg) {
            firmaImg.style.display = 'block';
            firmaImg.src = acta.firma_colaborador_canvas || '';
        }
        if (btnClearCanvas) btnClearCanvas.style.display = 'none';
        if (submitContainer) submitContainer.style.display = 'none';
    }
}

// --- CONFIGURACIÓN DE LISTENERS GENERALES ---
function setupListenersAdmin() {
    const filterSearch = document.getElementById('filter-acta-search');
    const filterFalta = document.getElementById('filter-acta-falta');
    const filterEstado = document.getElementById('filter-acta-estado');
    const btnClear = document.getElementById('btn-clear-acta-filters');

    const inputs = [filterSearch, filterFalta, filterEstado];
    inputs.forEach(input => {
        if (input && !input.dataset.listener) {
            input.dataset.listener = 'true';
            input.addEventListener('input', renderizarActasAdmin);
            input.addEventListener('change', renderizarActasAdmin);
        }
    });

    if (btnClear && !btnClear.dataset.listener) {
        btnClear.dataset.listener = 'true';
        btnClear.addEventListener('click', () => {
            if (filterSearch) filterSearch.value = '';
            if (filterFalta) filterFalta.value = 'all';
            if (filterEstado) filterEstado.value = 'all';
            renderizarActasAdmin();
        });
    }
}

function setupFormListeners() {
    const btnBack = document.getElementById('btn-back-to-actas');
    if (btnBack && !btnBack.dataset.listener) {
        btnBack.dataset.listener = 'true';
        btnBack.addEventListener('click', () => {
            const config = obtenerConfiguracion();
            const sesion = config.sesion_activa || { rol: 'ADMINISTRADOR', cedula: null };
            
            const adminView = document.getElementById('disciplinary-admin-view');
            const colabView = document.getElementById('disciplinary-colaborador-view');
            const formContainer = document.getElementById('disciplinary-form-container');

            if (formContainer) formContainer.style.display = 'none';

            if (sesion.rol === 'ADMINISTRADOR') {
                if (adminView) adminView.style.display = 'block';
                escanearInfraccionesSemanales();
                renderizarActasAdmin();
            } else {
                if (colabView) colabView.style.display = 'block';
                renderizarActasColaborador(sesion.cedula);
            }
        });
    }

    const btnPrint = document.getElementById('btn-print-acta');
    if (btnPrint && !btnPrint.dataset.listener) {
        btnPrint.dataset.listener = 'true';
        btnPrint.addEventListener('click', () => {
            if (selectedActaId) {
                window.open(`/pdf/acta/${selectedActaId}/`, '_blank');
            } else {
                showToast('No hay un acta seleccionada', 'danger');
            }
        });
    }

    const btnSubmit = document.getElementById('btn-submit-acta');
    if (btnSubmit && !btnSubmit.dataset.listener) {
        btnSubmit.dataset.listener = 'true';
        btnSubmit.addEventListener('click', () => {
            procesarFirmaDescargos();
        });
    }

    const formActa = document.getElementById('form-acta');
    if (formActa && !formActa.dataset.listener) {
        formActa.dataset.listener = 'true';
        formActa.addEventListener('submit', (e) => {
            e.preventDefault();
            const payload = {
                accion: 'crear_acta',
                cedula: document.getElementById('acta-colaborador').value,
                fecha_emision: document.getElementById('acta-fecha').value,
                tipo_falta: document.getElementById('acta-falta').value,
                motivo: document.getElementById('acta-motivo').value
            };
            fetch(window.location.pathname, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                body: JSON.stringify(payload)
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    showToast(data.message, 'success');
                    setTimeout(() => window.location.reload(), 1000);
                } else {
                    showToast('Error: ' + data.message, 'error');
                }
            })
            .catch(err => {
                showToast('Error de red: ' + err, 'error');
            });
        });
    }
}

// --- LIENZO DE FIRMA CANVAS ---
function inicializarCanvasFirma() {
    const canvas = document.getElementById('disciplinary-canvas');
    if (!canvas) return;

    signatureCanvas = canvas;
    signatureCtx = canvas.getContext('2d');

    // Estilos del trazo
    signatureCtx.strokeStyle = '#1e3a8a'; // Tinta azul corporativa
    signatureCtx.lineWidth = 3;
    signatureCtx.lineCap = 'round';
    signatureCtx.lineJoin = 'round';

    // Eventos de Mouse
    canvas.addEventListener('mousedown', (e) => {
        const config = obtenerConfiguracion();
        const sesion = config.sesion_activa || { rol: 'ADMINISTRADOR', cedula: null };
        const actas = obtenerActas();
        const acta = actas.find(a => a.id_acta === selectedActaId);
        
        // Bloquear si el acta está concluida o si el usuario no es el colaborador
        if (!acta || acta.estado_acta !== 'PENDIENTE_FIRMA' || sesion.rol !== 'COLABORADOR' || sesion.cedula !== acta.cedula_colaborador) {
            return;
        }

        isSignatureDrawing = true;
        signatureLastPos = obtenerPosicionEvento(e);
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!isSignatureDrawing) return;
        const currentPos = obtenerPosicionEvento(e);
        
        signatureCtx.beginPath();
        signatureCtx.moveTo(signatureLastPos.x, signatureLastPos.y);
        signatureCtx.lineTo(currentPos.x, currentPos.y);
        signatureCtx.stroke();

        signatureLastPos = currentPos;
        signatureHasDrawn = true;
    });

    window.addEventListener('mouseup', () => {
        isSignatureDrawing = false;
    });

    canvas.addEventListener('mouseleave', () => {
        isSignatureDrawing = false;
    });

    // Eventos Táctiles (Móviles)
    canvas.addEventListener('touchstart', (e) => {
        const config = obtenerConfiguracion();
        const sesion = config.sesion_activa || { rol: 'ADMINISTRADOR', cedula: null };
        const actas = obtenerActas();
        const acta = actas.find(a => a.id_acta === selectedActaId);
        
        if (!acta || acta.estado_acta !== 'PENDIENTE_FIRMA' || sesion.rol !== 'COLABORADOR' || sesion.cedula !== acta.cedula_colaborador) {
            return;
        }

        isSignatureDrawing = true;
        signatureLastPos = obtenerPosicionEvento(e);
        e.preventDefault();
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        if (!isSignatureDrawing) return;
        const currentPos = obtenerPosicionEvento(e);

        signatureCtx.beginPath();
        signatureCtx.moveTo(signatureLastPos.x, signatureLastPos.y);
        signatureCtx.lineTo(currentPos.x, currentPos.y);
        signatureCtx.stroke();

        signatureLastPos = currentPos;
        signatureHasDrawn = true;
        e.preventDefault();
    }, { passive: false });

    canvas.addEventListener('touchend', () => {
        isSignatureDrawing = false;
    });

    // Botón Limpiar
    const btnClear = document.getElementById('btn-clear-canvas');
    if (btnClear && !btnClear.dataset.listener) {
        btnClear.dataset.listener = 'true';
        btnClear.addEventListener('click', limpiarLienzoFirma);
    }
}

function obtenerPosicionEvento(e) {
    const rect = signatureCanvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
        x: clientX - rect.left,
        y: clientY - rect.top
    };
}

function limpiarLienzoFirma() {
    if (!signatureCanvas || !signatureCtx) return;
    signatureCtx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
    signatureHasDrawn = false;
}

// --- PROCESAR FIRMA Y ENVÍO DE DESCARGOS ---
function procesarFirmaDescargos() {
    if (!selectedActaId) return;

    const descargosVal = document.getElementById('acta-form-descargos').value.trim();
    
    // Validar descargos
    if (!descargosVal) {
        showToast('El campo de descargos es obligatorio para el empleado.', 'danger');
        document.getElementById('acta-form-descargos').focus();
        return;
    }

    if (descargosVal.length < 10) {
        showToast('Por favor, redacte descargos detallados (mínimo 10 caracteres).', 'danger');
        document.getElementById('acta-form-descargos').focus();
        return;
    }

    // Validar firma
    if (!signatureHasDrawn) {
        showToast('Debe firmar digitalmente el acta antes de enviarla.', 'danger');
        return;
    }

    // Capturar firma como base64
    // Optimización de Memoria: Usar WebP con 50% de calidad
    const firmaBase64 = signatureCanvas.toDataURL('image/webp', 0.5);

    const actas = obtenerActas();
    const index = actas.findIndex(a => a.id_acta === selectedActaId);

    if (index !== -1) {
        actas[index].descargos_colaborador = descargosVal;
        actas[index].firma_colaborador_canvas = firmaBase64;
        actas[index].estado_acta = 'CONCLUIDA';
        localStorage.setItem(DB_KEY_ACTAS, JSON.stringify(actas));

        showToast('Descargos enviados y acta firmada correctamente.', 'success');

        // Volver al listado del colaborador
        const config = obtenerConfiguracion();
        const sesion = config.sesion_activa || { rol: 'ADMINISTRADOR', cedula: null };
        
        document.getElementById('disciplinary-form-container').style.display = 'none';
        document.getElementById('disciplinary-colaborador-view').style.display = 'block';
        renderizarActasColaborador(sesion.cedula);

        if (typeof actualizarDashboardCompleto === 'function') {
            actualizarDashboardCompleto();
        }
    }
}

function inicializarImportacionActas() {
    const btnImport = document.getElementById('btn-import-acta');
    const modalImport = document.getElementById('modal-import-acta');
    const btnCloseImport = document.getElementById('btn-close-import');
    const formImport = document.getElementById('form-import-acta');
    const colabSelect = document.getElementById('import-acta-colab');

    if (!btnImport || !modalImport || !formImport || !colabSelect) return;

    // Abrir modal de importación
    if (!btnImport.dataset.listener) {
        btnImport.dataset.listener = 'true';
        btnImport.addEventListener('click', () => {
            // Poblar colaboradores (sólo rol COLABORADOR)
            const colaboradores = obtenerColaboradores().filter(c => c.rol === 'COLABORADOR' || !c.rol);
            colabSelect.innerHTML = '<option value="" disabled selected>Seleccione Colaborador...</option>';
            colaboradores.forEach(c => {
                colabSelect.innerHTML += `<option value="${c.cedula}">${c.nombre} (Cédula: ${c.cedula})</option>`;
            });

            // Poner fecha de hoy por defecto
            const hoy = new Date();
            document.getElementById('import-acta-fecha').value = hoy.toISOString().split('T')[0];

            modalImport.style.display = 'flex';
        });
    }

    // Cerrar modal
    if (btnCloseImport && !btnCloseImport.dataset.listener) {
        btnCloseImport.dataset.listener = 'true';
        btnCloseImport.addEventListener('click', () => {
            modalImport.style.display = 'none';
            formImport.reset();
        });
    }

    // Procesar importación al enviar formulario
    if (!formImport.dataset.listener) {
        formImport.dataset.listener = 'true';
        formImport.addEventListener('submit', (e) => {
            e.preventDefault();

            const cedula = parseInt(colabSelect.value);
            const colab = obtenerColaboradorPorCedula(cedula);
            if (!colab) {
                showToast('Colaborador no encontrado', 'danger');
                return;
            }

            const fecha = document.getElementById('import-acta-fecha').value;
            const tipoFalta = document.getElementById('import-acta-falta').value;
            const fileInput = document.getElementById('import-acta-file');
            const file = fileInput.files[0];

            if (!file) {
                showToast('Debe cargar una imagen del acta', 'danger');
                return;
            }

            const cInfo = obtenerCargoYArea(cedula);

            const reader = new FileReader();
            reader.onload = function(event) {
                const imageBase64 = event.target.result;

                const nuevaActa = {
                    id_acta: null, // Asignado por guardarActa
                    cedula_colaborador: cedula,
                    nombre_colaborador: colab.nombre,
                    cargo: cInfo.cargo,
                    area: cInfo.area,
                    fecha_emision: fecha,
                    tipo_falta: tipoFalta,
                    semana_relacionada: obtenerSemanaCalendario(fecha),
                    anio_relacionado: parseInt(fecha.split('-')[0]),
                    fechas_retardo_relacionadas: [],
                    descargos_colaborador: 'Acta física digitalizada importada por el Administrador.',
                    decision: 'Llamado de atencion escrito',
                    firma_colaborador_canvas: '',
                    firma_jefe_precargada: '',
                    imagen_importada_base64: imageBase64,
                    estado_acta: 'CONCLUIDA'
                };

                guardarActa(nuevaActa);
                showToast('Acta física importada con éxito.', 'success');
                modalImport.style.display = 'none';
                formImport.reset();

                // Refrescar listado
                renderizarActasAdmin();
                if (typeof actualizarDashboardCompleto === 'function') {
                    actualizarDashboardCompleto();
                }
            };
            reader.readAsDataURL(file);
        });
    }
}



