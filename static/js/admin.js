// js/admin.js
// Lógica del Módulo de Registro por Administrador (Consola de Ingreso Manual, Hojas de Cálculo y Registros Simultáneos)

var editRegistroModo = false;
var registroModoActivo = 'individual'; // 'individual' o 'masivo'

function inicializarAdmin() {
    refrescarSelectColaboradores();
    refrescarTablaRegistros();
    resetearFormularioRegistro();
    
    if (typeof refrescarIpsAutorizadas === 'function') {
        refrescarIpsAutorizadas();
    }
    
    // Setear fecha por defecto a hoy en campos de fecha
    const fechaInput = document.getElementById('reg-fecha');
    if (fechaInput) {
        fechaInput.value = obtenerFechaActualMedellin();
    }
    
    const fechaMasivaInput = document.getElementById('reg-fecha-masivo');
    if (fechaMasivaInput) {
        fechaMasivaInput.value = obtenerFechaActualMedellin();
    }

    // Inicializar el modo en individual
    cambiarModoRegistro('individual');

    // Vincular botones de cambio de modo
    const btnInd = document.getElementById('btn-mode-individual');
    const btnMas = document.getElementById('btn-mode-masivo');
    if (btnInd && !btnInd.dataset.listener) {
        btnInd.dataset.listener = 'true';
        btnInd.addEventListener('click', () => cambiarModoRegistro('individual'));
    }
    if (btnMas && !btnMas.dataset.listener) {
        btnMas.dataset.listener = 'true';
        btnMas.addEventListener('click', () => cambiarModoRegistro('masivo'));
    }

    // Vincular cambio de fecha en modo masivo
    if (fechaMasivaInput && !fechaMasivaInput.dataset.listener) {
        fechaMasivaInput.dataset.listener = 'true';
        fechaMasivaInput.addEventListener('change', renderizarTablaMasiva);
    }
}

// Helper para obtener la fecha de hoy en Medellín en formato YYYY-MM-DD
function obtenerFechaActualMedellin() {
    const ahora = new Date();
    const opciones = { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' };
    const formateador = new Intl.DateTimeFormat('en-US', opciones);
    const [{ value: month }, , { value: day }, , { value: year }] = formateador.formatToParts(ahora);
    return `${year}-${month}-${day}`;
}

// --- SELECT DE COLABORADORES ---
function refrescarSelectColaboradores() {
    const select = document.getElementById('reg-colaborador');
    if (!select) return;

    const colaboradores = obtenerColaboradores().filter(c => c.rol !== 'JEFE_INMEDIATO');
    const valorSeleccionado = select.value;

    select.innerHTML = '<option value="" disabled selected>Seleccione un colaborador...</option>';
    colaboradores.forEach(c => {
        select.innerHTML += `<option value="${c.cedula}">${c.nombre} (${c.cedula})</option>`;
    });

    if (valorSeleccionado) {
        select.value = valorSeleccionado;
    }
}

// --- CONTROL DE CAMBIO DE MODO ---
function cambiarModoRegistro(modo) {
    // Si estamos editando individualmente, bloqueamos cambiar de modo
    if (editRegistroModo) {
        showToast('Debe guardar o cancelar la edición actual antes de cambiar de modo.', 'warning');
        return;
    }

    registroModoActivo = modo;
    const btnInd = document.getElementById('btn-mode-individual');
    const btnMas = document.getElementById('btn-mode-masivo');
    
    const indGrid = document.getElementById('individual-form-grid');
    const indPanel = document.getElementById('individual-live-panel');
    const indObs = document.getElementById('individual-obs-group');
    const masGrid = document.getElementById('masivo-form-grid');
    
    const btnSubmit = document.getElementById('btn-submit-registro');

    if (modo === 'individual') {
        if (btnInd) btnInd.className = 'btn btn-primary';
        if (btnMas) btnMas.className = 'btn btn-secondary';
        
        if (indGrid) indGrid.style.display = 'grid';
        if (indPanel) indPanel.style.display = 'flex';
        if (indObs) indObs.style.display = 'block';
        if (masGrid) masGrid.style.display = 'none';

        if (btnSubmit) btnSubmit.textContent = 'Guardar Registro';
        
        document.getElementById('reg-colaborador').required = true;
        document.getElementById('reg-fecha').required = true;
        document.getElementById('reg-ingreso').required = true;
        document.getElementById('reg-salida').required = true;
        document.getElementById('reg-fecha-masivo').required = false;

        actualizarCalculosEnVivo();
    } else {
        if (btnInd) btnInd.className = 'btn btn-secondary';
        if (btnMas) btnMas.className = 'btn btn-primary';
        
        if (indGrid) indGrid.style.display = 'none';
        if (indPanel) indPanel.style.display = 'none';
        if (indObs) indObs.style.display = 'none';
        if (masGrid) masGrid.style.display = 'flex';

        if (btnSubmit) btnSubmit.textContent = 'Guardar Registros Simultáneos';

        document.getElementById('reg-colaborador').required = false;
        document.getElementById('reg-fecha').required = false;
        document.getElementById('reg-ingreso').required = false;
        document.getElementById('reg-salida').required = false;
        document.getElementById('reg-fecha-masivo').required = true;

        renderizarTablaMasiva();
    }
}

// --- RENDERIZAR TABLA DE REGISTROS SIMULTÁNEOS (MASIVO) ---
function renderizarTablaMasiva() {
    const tbody = document.getElementById('table-masivo-body');
    if (!tbody) return;

    const colaboradores = obtenerColaboradores().filter(c => c.rol !== 'JEFE_INMEDIATO');
    const fecha = document.getElementById('reg-fecha-masivo').value || obtenerFechaActualMedellin();

    tbody.innerHTML = '';

    if (colaboradores.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-secondary);">No hay colaboradores registrados.</td></tr>';
        return;
    }

    colaboradores.forEach(c => {
        const shift = obtenerTurnoColaboradorPorFecha(c, fecha);
        const diaSemana = obtenerDiaSemana(fecha);
        const shiftDisplay = shift 
            ? `${shift.codigo} (${shift.hora_inicio} - ${shift.hora_fin})` 
            : `<span style="color:var(--text-secondary); font-style:italic;">Descanso (${diaSemana})</span>`;

        const tr = document.createElement('tr');
        tr.dataset.cedula = c.cedula;
        
        tr.innerHTML = `
            <td style="font-weight:600; text-align: left;">
                ${c.nombre} <br><small style="color:var(--text-secondary);">${c.cedula}</small>
            </td>
            <td><small style="font-size:0.8rem;">${shiftDisplay}</small></td>
            <td>
                <input type="time" class="masivo-ingreso" style="padding: 6px 10px; font-size: 0.85rem; width:110px;">
            </td>
            <td>
                <input type="time" class="masivo-salida" style="padding: 6px 10px; font-size: 0.85rem; width:110px;">
            </td>
            <td style="text-align: left;">
                <div class="masivo-calculo" style="font-size:0.75rem; font-weight:600; color:var(--text-secondary); line-height: 1.3;">-</div>
            </td>
            <td>
                <div style="display:flex; flex-direction:column; gap:4px; text-align: left;">
                    <select class="masivo-tipo-permiso" style="padding: 6px; font-size:0.8rem; margin-bottom: 2px;">
                        <option value="">Ninguno / Normal</option>
                        <optgroup label="Permisos Remunerados">
                            <option value="Citas Medicas">Citas Médicas</option>
                            <option value="Calamidad Domestica">Calamidad Doméstica</option>
                            <option value="Votacion y Jurado">Votación y Jurado</option>
                            <option value="Obligaciones Escolares">Obligaciones Escolares</option>
                            <option value="Diligencias Judiciales">Diligencias Judiciales</option>
                            <option value="Incapacidad Enfermedad General">Incapacidad Enfermedad General</option>
                            <option value="Incapacidad Laboral">Incapacidad Laboral</option>
                        </optgroup>
                        <optgroup label="Permisos No Remunerados">
                            <option value="Otros">Otros (Especifique)</option>
                        </optgroup>
                    </select>
                    <div class="masivo-incapacidad-container" style="display: none; align-items: center; gap: 8px; background-color: var(--warning-light); padding: 6px; border-radius: var(--radius-sm); border-left: 3px solid var(--warning); margin-bottom: 2px;">
                        <input type="checkbox" class="masivo-incapacidad-presentada" style="width: 14px; height: 14px; cursor: pointer;">
                        <span style="font-weight: 600; font-size: 0.75rem; color: var(--warning);">¿Soporte?</span>
                    </div>
                    <textarea class="masivo-observaciones" rows="1" placeholder="Especifique..." style="display:none; padding: 6px 10px; font-size:0.8rem; height:32px; resize:none; width: 100%;"></textarea>
                    <small class="masivo-warning-obs" style="color: var(--danger); font-weight:600; font-size:0.65rem; display:none;">⚠️ Justificación obligatoria.</small>
                </div>
            </td>
        `;

        tbody.appendChild(tr);

        const inputIngreso = tr.querySelector('.masivo-ingreso');
        const inputSalida = tr.querySelector('.masivo-salida');
        const selectPermiso = tr.querySelector('.masivo-tipo-permiso');
        const textareaObs = tr.querySelector('.masivo-observaciones');
        
        selectPermiso.addEventListener('change', (e) => {
            textareaObs.style.display = e.target.value === 'Otros' ? 'block' : 'none';
            const incContainer = tr.querySelector('.masivo-incapacidad-container');
            if (incContainer) {
                incContainer.style.display = e.target.value.includes('Incapacidad') ? 'flex' : 'none';
            }
            fnCalcularFila();
        });

        const fnCalcularFila = () => {
            const ing = inputIngreso.value;
            const sal = inputSalida.value;
            const obsTipo = selectPermiso.value;
            const obsText = textareaObs.value.trim();
            const divCalc = tr.querySelector('.masivo-calculo');
            const smallWarning = tr.querySelector('.masivo-warning-obs');

            if (!ing || !sal) {
                divCalc.textContent = '-';
                divCalc.style.color = 'var(--text-secondary)';
                smallWarning.style.display = 'none';
                selectPermiso.style.borderColor = 'var(--card-border)';
                textareaObs.style.borderColor = 'var(--card-border)';
                return;
            }

            const calc = calcularHorasLaboradas(
                ing,
                sal,
                shift ? shift.hora_inicio : null,
                shift ? shift.hora_fin : null
            );

            divCalc.innerHTML = `Norm: <strong>${calc.normales}h</strong><br>
                                 Ext: <strong style="color:var(--success);">${calc.extras}h</strong><br>
                                 Perm: <strong style="color:var(--warning);">${calc.permisos}h</strong>`;

            const tieneDesviacion = (calc.extras > 0 || calc.permisos > 0);
            if (tieneDesviacion) {
                let isValid = false;
                if (obsTipo) {
                    isValid = (obsTipo === 'Otros') ? obsText.length > 0 : true;
                }
                
                if (!isValid) {
                    smallWarning.style.display = 'block';
                    selectPermiso.style.borderColor = 'var(--danger)';
                    if (obsTipo === 'Otros') textareaObs.style.borderColor = 'var(--danger)';
                } else {
                    smallWarning.style.display = 'none';
                    selectPermiso.style.borderColor = 'var(--success)';
                    textareaObs.style.borderColor = 'var(--success)';
                }
            } else {
                smallWarning.style.display = 'none';
                selectPermiso.style.borderColor = 'var(--card-border)';
                textareaObs.style.borderColor = 'var(--card-border)';
            }
        };

        [inputIngreso, inputSalida].forEach(el => {
            el.addEventListener('input', fnCalcularFila);
            el.addEventListener('change', fnCalcularFila);
        });
        textareaObs.addEventListener('input', fnCalcularFila);
    });
}

// --- CÁLCULOS EN VIVO (LIVE PREVIEW) - INDIVIDUAL ---
var regColaboradorSelect = document.getElementById('reg-colaborador');
var regFechaInput = document.getElementById('reg-fecha');
var regIngresoInput = document.getElementById('reg-ingreso');
var regSalidaInput = document.getElementById('reg-salida');
var regObservacionesInput = document.getElementById('reg-observaciones');
var regTipoPermisoInput = document.getElementById('reg-tipo-permiso');

function actualizarCalculosEnVivo() {
    if (registroModoActivo !== 'individual') return;

    const cedula = regColaboradorSelect.value;
    const fecha = regFechaInput.value || obtenerFechaActualMedellin();
    const ingreso = regIngresoInput.value;
    const salida = regSalidaInput.value;

    const lblTurno = document.getElementById('calc-live-turno');
    const lblNormales = document.getElementById('calc-live-normales');
    const lblExtras = document.getElementById('calc-live-extras');
    const lblPermisos = document.getElementById('calc-live-permisos');

    if (!cedula) {
        if (lblTurno) lblTurno.textContent = '-';
        return;
    }

    const colaborador = obtenerColaboradorPorCedula(cedula);
    if (!colaborador) return;

    const diaSemana = obtenerDiaSemana(fecha);
    const shift = obtenerTurnoColaboradorPorFecha(colaborador, fecha);

    if (!shift) {
        if (lblTurno) lblTurno.innerHTML = `<span class="badge badge-warning">${diaSemana}: Descanso (Todo Extra)</span>`;
        if (ingreso && salida) {
            const calc = calcularHorasLaboradas(ingreso, salida, null, null);
            lblNormales.textContent = `${calc.normales}h`;
            lblExtras.textContent = `${calc.extras}h`;
            lblPermisos.textContent = `${calc.permisos}h`;
        } else {
            lblNormales.textContent = '0.0h';
            lblExtras.textContent = '0.0h';
            lblPermisos.textContent = '0.0h';
        }
        validarObservacionesObligatorias();
        return;
    }

    if (lblTurno) {
        lblTurno.innerHTML = `<span class="badge badge-info">${diaSemana}: ${shift.codigo} (${shift.hora_inicio} - ${shift.hora_fin})</span>`;
    }

    if (ingreso && salida) {
        const calc = calcularHorasLaboradas(ingreso, salida, shift.hora_inicio, shift.hora_fin);
        lblNormales.textContent = `${calc.normales}h`;
        lblExtras.textContent = `${calc.extras}h`;
        lblPermisos.textContent = `${calc.permisos}h`;
    } else {
        lblNormales.textContent = '0.0h';
        lblExtras.textContent = '0.0h';
        lblPermisos.textContent = '0.0h';
    }

    validarObservacionesObligatorias();
}

function validarObservacionesObligatorias() {
    if (registroModoActivo !== 'individual') return;

    const cedula = regColaboradorSelect.value;
    const fecha = regFechaInput.value || obtenerFechaActualMedellin();
    const ingreso = regIngresoInput.value;
    const salida = regSalidaInput.value;
    const obsText = regObservacionesInput ? regObservacionesInput.value.trim() : '';
    const obsSelect = regTipoPermisoInput ? regTipoPermisoInput.value : '';
    const observaciones = obsText || obsSelect;
    
    const warningObs = document.getElementById('reg-warning-obs');
    const btnSubmit = document.getElementById('btn-submit-registro');

    if (!cedula || !ingreso || !salida) {
        if (warningObs) warningObs.style.display = 'none';
        if (btnSubmit) btnSubmit.disabled = false;
        return;
    }

    const colaborador = obtenerColaboradorPorCedula(cedula);
    if (!colaborador) return;

    const shift = obtenerTurnoColaboradorPorFecha(colaborador, fecha);
    
    // Calcular horas
    const calc = calcularHorasLaboradas(
        ingreso,
        salida,
        shift ? shift.hora_inicio : null,
        shift ? shift.hora_fin : null
    );

    const tieneDesviacion = (calc.extras > 0 || calc.permisos > 0);

    if (tieneDesviacion) {
        if (warningObs) warningObs.style.display = 'block';
        if (observaciones.length === 0) {
            if (btnSubmit) btnSubmit.disabled = true;
        } else {
            if (btnSubmit) btnSubmit.disabled = false;
        }
    } else {
        if (warningObs) warningObs.style.display = 'none';
        if (btnSubmit) btnSubmit.disabled = false;
    }
}

// Vincular eventos individuales
[regColaboradorSelect, regFechaInput, regIngresoInput, regSalidaInput].forEach(el => {
    if (el) {
        el.addEventListener('change', actualizarCalculosEnVivo);
        el.addEventListener('input', actualizarCalculosEnVivo);
    }
});
if (regObservacionesInput) {
    regObservacionesInput.addEventListener('input', validarObservacionesObligatorias);
}
if (regTipoPermisoInput) {
    regTipoPermisoInput.addEventListener('change', (e) => {
        const obsContainer = document.getElementById('reg-observaciones-container');
        if (obsContainer) obsContainer.style.display = e.target.value === 'Otros' ? 'block' : 'none';
        
        const incContainer = document.getElementById('reg-incapacidad-container');
        if (incContainer) incContainer.style.display = e.target.value.includes('Incapacidad') ? 'flex' : 'none';
        
        actualizarCalculosEnVivo();
    });
}

// --- SUBMIT REGISTRO MANUAL (INDIVIDUAL & MASIVO) ---
var formRegistroManual = document.getElementById('form-registro-manual');
if (formRegistroManual) {
    formRegistroManual.addEventListener('submit', (e) => {
        e.preventDefault();

        // --- SUBMIT MODO MASIVO ---
        if (registroModoActivo === 'masivo') {
            const fecha = document.getElementById('reg-fecha-masivo').value;
            if (!fecha) {
                showToast('Por favor seleccione la fecha del registro masivo.', 'danger');
                return;
            }

            const rows = document.querySelectorAll('#table-masivo-body tr');
            const registrosAGuardar = [];
            let tieneErrorJustificacion = false;
            const semana_calendario = obtenerSemanaCalendario(fecha);

            for (let i = 0; i < rows.length; i++) {
                const tr = rows[i];
                const cedula = parseInt(tr.dataset.cedula);
                const colab = obtenerColaboradorPorCedula(cedula);
                if (!colab) continue;

                const ing = tr.querySelector('.masivo-ingreso').value;
                const sal = tr.querySelector('.masivo-salida').value;
                const obsTipo = tr.querySelector('.masivo-tipo-permiso').value;
                const obsText = tr.querySelector('.masivo-observaciones').value.trim();
                const incCheckbox = tr.querySelector('.masivo-incapacidad-presentada');
                const incPresentada = incCheckbox ? incCheckbox.checked : false;

                // Fila vacía se omite
                if (!ing && !sal) {
                    continue;
                }

                // Fila incompleta es error de digitación
                if (!ing || !sal) {
                    tieneErrorJustificacion = true;
                    tr.style.backgroundColor = 'var(--danger-light)';
                    continue;
                }

                const shift = obtenerTurnoColaboradorPorFecha(colab, fecha);

                // Calcular horas
                const horas_calculadas = calcularHorasLaboradas(
                    ing, 
                    sal, 
                    shift ? shift.hora_inicio : null, 
                    shift ? shift.hora_fin : null
                );

                const tieneDesv = (horas_calculadas.extras > 0 || horas_calculadas.permisos > 0);
                
                let isValid = false;
                if (obsTipo) {
                    isValid = (obsTipo === 'Otros') ? obsText.length > 0 : true;
                }
                
                if (tieneDesv && !isValid) {
                    tieneErrorJustificacion = true;
                    tr.style.backgroundColor = 'var(--warning-light)';
                    continue;
                }

                // Validar estado de ingreso
                let estado_ingreso = 'A_TIEMPO';
                if (shift) {
                    const minutosIngreso = horaAMinutos(ing);
                    const minutosShiftInicio = horaAMinutos(shift.hora_inicio);
                    if (minutosIngreso - minutosShiftInicio > 5) {
                        estado_ingreso = 'RETARDO';
                    }
                }

                const config = obtenerConfiguracion();
                const ip_dispositivo = config.ip_simulada || '127.0.0.1';
                
                const observaciones = obsText || (obsTipo !== 'Otros' ? obsTipo : '');

                const registro = {
                    cedula_colaborador: cedula,
                    tipo_registro: 'admin',
                    fecha,
                    semana_calendario,
                    hora_ingreso: ing,
                    hora_salida: sal,
                    estado_ingreso,
                    alerta_reincidencia_activa: false,
                    ip_dispositivo,
                    horas_calculadas,
                    observaciones: observaciones || 'Asistencia manual múltiple.'
                };
                
                if (obsTipo) {
                    registro.tipo_permiso = obsTipo;
                    registro.estado_permiso = 'PENDIENTE';
                    if (obsTipo.includes('Incapacidad')) {
                        registro.incapacidad_presentada = incPresentada;
                    }
                }

                // Si hay retardo, verificar reincidencia (3er strike)
                if (estado_ingreso === 'RETARDO') {
                    const registrosLocales = obtenerRegistros();
                    const retardosSemana = registrosLocales.filter(r => 
                        r.cedula_colaborador === cedula && 
                        r.semana_calendario === semana_calendario && 
                        r.estado_ingreso === 'RETARDO'
                    );
                    if (retardosSemana.length >= 2) {
                        registro.alerta_reincidencia_activa = true;
                    }
                }

                registrosAGuardar.push(registro);
            }

            if (tieneErrorJustificacion) {
                showToast('⚠️ Envío bloqueado: hay registros con desviaciones que requieren una justificación.', 'danger');
                return;
            }

            if (registrosAGuardar.length === 0) {
                showToast('No se ingresó ninguna marcación para registrar.', 'warning');
                return;
            }

            // Guardar todos los registros de la lista
            registrosAGuardar.forEach(reg => {
                guardarRegistro(reg);
                if (reg.alerta_reincidencia_activa) {
                    const c = obtenerColaboradorPorCedula(reg.cedula_colaborador);
                    showToast(`⚠️ REINCIDENCIA CRÍTICA: ${c ? c.nombre : reg.cedula_colaborador} acumuló 3 retardos en la semana ${reg.semana_calendario}.`, 'danger');
                }
            });

            showToast(`Se guardaron con éxito ${registrosAGuardar.length} registros simultáneos de asistencia.`, 'success');
            resetearFormularioRegistro();
            refrescarTablaRegistros();
            return;
        }

        // --- SUBMIT MODO INDIVIDUAL ---
        const id_registro = document.getElementById('edit-registro-id').value;
        const cedula = parseInt(regColaboradorSelect.value);
        const fecha = regFechaInput.value;
        const hora_ingreso = regIngresoInput.value;
        const hora_salida = regSalidaInput.value;
        const obsText = regObservacionesInput.value.trim();
        const tipoPermiso = regTipoPermisoInput ? regTipoPermisoInput.value : '';
        const observaciones = obsText || (tipoPermiso !== 'Otros' ? tipoPermiso : '');
        const incCheckbox = document.getElementById('reg-incapacidad-presentada');
        const incapacidadPresentada = incCheckbox ? incCheckbox.checked : false;

        const colab = obtenerColaboradorPorCedula(cedula);
        if (!colab) return;

        const shift = obtenerTurnoColaboradorPorFecha(colab, fecha);

        // Calcular horas
        const horas_calculadas = calcularHorasLaboradas(
            hora_ingreso, 
            hora_salida, 
            shift ? shift.hora_inicio : null, 
            shift ? shift.hora_fin : null
        );

        // Validar tolerancia de 5 minutos al ingreso para determinar retardo
        let estado_ingreso = 'A_TIEMPO';
        if (shift) {
            const minutosIngreso = horaAMinutos(hora_ingreso);
            const minutosShiftInicio = horaAMinutos(shift.hora_inicio);
            if (minutosIngreso - minutosShiftInicio > 5) {
                estado_ingreso = 'RETARDO';
            }
        }

        // Calcular semana calendario ISO
        const semana_calendario = obtenerSemanaCalendario(fecha);

        // Capturar IP activa
        const config = obtenerConfiguracion();
        const ip_dispositivo = config.ip_simulada || '127.0.0.1';

        const registro = {
            cedula_colaborador: cedula,
            tipo_registro: 'admin',
            fecha,
            semana_calendario,
            hora_ingreso,
            hora_salida,
            estado_ingreso,
            alerta_reincidencia_activa: false, 
            ip_dispositivo,
            horas_calculadas,
            observaciones: observaciones || 'Asistencia manual.'
        };

        if (tipoPermiso) {
            registro.tipo_permiso = tipoPermiso;
            // Si es edición y ya tenía un estado, conservarlo, sino PENDIENTE
            registro.estado_permiso = 'PENDIENTE';
            if (tipoPermiso.includes('Incapacidad')) {
                registro.incapacidad_presentada = incapacidadPresentada;
            }
        }

        // Si hay retardo, verificar reincidencia (3er strike)
        if (estado_ingreso === 'RETARDO') {
            const registros = obtenerRegistros();
            const retardosSemana = registros.filter(r => 
                r.cedula_colaborador === cedula && 
                r.semana_calendario === semana_calendario && 
                r.estado_ingreso === 'RETARDO' &&
                (!id_registro || r.id_registro !== parseInt(id_registro))
            );
            if (retardosSemana.length >= 2) {
                registro.alerta_reincidencia_activa = true;
                showToast(`⚠️ REINCIDENCIA CRÍTICA: El colaborador ha acumulado 3 retardos en la semana ${semana_calendario}.`, 'danger');
            }
        }

        if (editRegistroModo && id_registro) {
            registro.id_registro = parseInt(id_registro);
            const registroPrevio = obtenerRegistros().find(r => r.id_registro === parseInt(id_registro));
            if (registroPrevio) {
                registro.tipo_registro = registroPrevio.tipo_registro;
                if (registroPrevio.tipo_permiso === registro.tipo_permiso) {
                    registro.estado_permiso = registroPrevio.estado_permiso;
                    if (registroPrevio.motivo_rechazo) {
                        registro.motivo_rechazo = registroPrevio.motivo_rechazo;
                    }
                }
            }
        }

        guardarRegistro(registro);
        showToast(editRegistroModo ? 'Registro de tiempo actualizado' : 'Registro de tiempo añadido manualmente', 'success');

        resetearFormularioRegistro();
        refrescarTablaRegistros();
    });
}

// --- EDITAR / ELIMINAR REGISTROS ---
window.editarRegistro = function(id_registro) {
    // Si estamos en masivo, forzar a volver a individual
    cambiarModoRegistro('individual');

    const registros = obtenerRegistros();
    const reg = registros.find(r => r.id_registro === parseInt(id_registro));
    if (!reg) return;

    editRegistroModo = true;
    document.getElementById('registro-form-title').querySelector('span').textContent = 'Editar Registro de Tiempo';
    document.getElementById('btn-submit-registro').textContent = 'Actualizar Registro';

    document.getElementById('edit-registro-id').value = reg.id_registro;
    regColaboradorSelect.value = reg.cedula_colaborador;
    regFechaInput.value = reg.fecha;
    regIngresoInput.value = reg.hora_ingreso;
    regSalidaInput.value = reg.hora_salida;
    regObservacionesInput.value = reg.observaciones;
    
    if (regTipoPermisoInput) {
        regTipoPermisoInput.value = reg.tipo_permiso || '';
        document.getElementById('reg-observaciones-container').style.display = (reg.tipo_permiso === 'Otros' || !reg.tipo_permiso) ? 'block' : 'none';
        if (reg.tipo_permiso && reg.tipo_permiso !== 'Otros') {
            regObservacionesInput.value = ''; // el texto viene del combo
        }
    }

    document.getElementById('btn-cancel-registro').style.display = 'inline-flex';
    
    actualizarCalculosEnVivo();
    window.location.hash = '#admin';
};

window.eliminarRegistroAction = function(id_registro) {
    if (confirm('¿Está seguro de eliminar este registro de asistencia?')) {
        eliminarRegistro(id_registro);
        showToast('Registro eliminado con éxito', 'success');
        refrescarTablaRegistros();
    }
};

// --- CANCELAR EDICIÓN ---
var btnCancelRegistro = document.getElementById('btn-cancel-registro');
if (btnCancelRegistro) {
    btnCancelRegistro.addEventListener('click', resetearFormularioRegistro);
}

function resetearFormularioRegistro() {
    editRegistroModo = false;
    document.getElementById('registro-form-title').querySelector('span').textContent = 'Registrar Marcación Manual (Administrador)';
    
    const btnSubmit = document.getElementById('btn-submit-registro');
    if (btnSubmit) {
        btnSubmit.textContent = registroModoActivo === 'individual' ? 'Guardar Registro' : 'Guardar Registros Simultáneos';
    }

    document.getElementById('edit-registro-id').value = '';
    regColaboradorSelect.selectedIndex = 0;
    regFechaInput.value = obtenerFechaActualMedellin();
    regIngresoInput.value = '';
    regSalidaInput.value = '';
    regObservacionesInput.value = '';
    if (regTipoPermisoInput) {
        regTipoPermisoInput.value = '';
        document.getElementById('reg-observaciones-container').style.display = 'none';
    }

    document.getElementById('btn-cancel-registro').style.display = 'none';

    actualizarCalculosEnVivo();

    // Si estamos en modo masivo, recargar/limpiar la tabla masiva
    if (registroModoActivo === 'masivo') {
        renderizarTablaMasiva();
    }
}

// --- ACTUALIZAR TABLA HOJA DE CÁLCULO ---
function refrescarTablaRegistros() {
    const registros = obtenerRegistros();
    const tbody = document.getElementById('table-registros-body');
    if (!tbody) return;

    tbody.innerHTML = '';
    
    if (registros.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; color:var(--text-secondary);">No hay registros de marcación en el sistema.</td></tr>';
    } else {
        registros.sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id_registro - a.id_registro);

        registros.forEach(r => {
            const colab = obtenerColaboradorPorCedula(r.cedula_colaborador);
            const nombreColab = colab ? colab.nombre : 'Colaborador Eliminado';
            
            // Turno asignado a ese día en específico
            const diaSemana = obtenerDiaSemana(r.fecha);
            const shift = colab ? obtenerTurnoColaboradorPorFecha(colab, r.fecha) : null;
            const shiftDisplay = shift 
                ? `${shift.codigo} (${diaSemana})` 
                : `<span style="color:var(--text-secondary); font-style:italic;">Descanso (${diaSemana})</span>`;

            let badgeTipo = '';
            if (r.tipo_registro === 'admin') {
                badgeTipo = '<span class="badge badge-info" style="font-size:0.65rem;">Manual</span>';
            } else {
                badgeTipo = '<span class="badge badge-success" style="font-size:0.65rem; background-color: var(--success-light); color: var(--success);">Código QR</span>';
            }

            // Destacar si tiene reincidencia activa o retardo simple
            if (r.alerta_reincidencia_activa) {
                badgeTipo += ' <span class="badge badge-danger" style="font-size:0.6rem; padding: 2px 6px; margin-left: 4px;" title="Reincidencia Crítica (3er Retardo Semanal)">Reincidencia ⚠️</span>';
            } else if (r.estado_ingreso === 'RETARDO') {
                badgeTipo += ' <span class="badge badge-warning" style="font-size:0.6rem; padding: 2px 6px; margin-left: 4px;" title="Retardo en el ingreso">Retardo</span>';
            }

            let obsDisplay = r.observaciones ? r.observaciones : '<span style="color:var(--text-secondary); font-style:italic;">Sin observaciones</span>';
            if (r.tipo_permiso) {
                let badgePermiso = '';
                if (r.estado_permiso === 'PENDIENTE') badgePermiso = '<span class="badge badge-warning" style="font-size:0.6rem;">🟡 Pendiente</span>';
                else if (r.estado_permiso === 'APROBADO') badgePermiso = '<span class="badge badge-success" style="font-size:0.6rem;">🟢 Aprobado</span>';
                else if (r.estado_permiso === 'RECHAZADO') badgePermiso = `<span class="badge badge-danger" style="font-size:0.6rem;" title="Motivo: ${r.motivo_rechazo || ''}">🔴 Rechazado</span>`;
                
                let badgeIncapacidad = '';
                if (r.tipo_permiso.includes('Incapacidad') && !r.incapacidad_presentada) {
                    badgeIncapacidad = '<br><span class="badge badge-danger" style="font-size:0.6rem; margin-top:4px;">⚠️ Falta Soporte (Incapacidad)</span>';
                }

                obsDisplay = `<strong>${r.tipo_permiso}</strong> ${badgePermiso}${badgeIncapacidad}<br><small>${obsDisplay}</small>`;
            }

            let accionesHTML = `
                <button class="btn-icon btn-icon-edit" onclick="editarRegistro(${r.id_registro})" title="Editar Registro">
                    <svg style="width:16px; height:16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                </button>
                <button class="btn-icon btn-icon-delete" onclick="eliminarRegistroAction(${r.id_registro})" title="Eliminar Registro">
                    <svg style="width:16px; height:16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
            `;

            if (r.foto_captura) {
                accionesHTML = `
                    <button class="btn-icon" style="color:var(--accent);" onclick="verFotoRegistro(${r.id_registro})" title="Ver Captura Facial">
                        <svg style="width:16px; height:16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                    </button>
                ` + accionesHTML;
            }

            if (r.tipo_permiso && r.estado_permiso === 'PENDIENTE') {
                accionesHTML = `
                    <button class="btn-icon" style="color:var(--success);" onclick="aprobarPermiso(${r.id_registro})" title="Aprobar Permiso">
                        <svg style="width:16px; height:16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                    </button>
                    <button class="btn-icon" style="color:var(--danger);" onclick="rechazarPermiso(${r.id_registro})" title="Rechazar Permiso">
                        <svg style="width:16px; height:16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                ` + accionesHTML;
            }

            if (r.tipo_permiso && r.tipo_permiso.includes('Incapacidad') && !r.incapacidad_presentada) {
                accionesHTML = `
                    <button class="btn-icon" style="color:var(--warning);" onclick="marcarIncapacidadPresentada(${r.id_registro})" title="Marcar incapacidad como presentada (Soporte recibido)">
                        <svg style="width:16px; height:16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                    </button>
                ` + accionesHTML;
            }


            tbody.innerHTML += `
                <tr>
                    <td style="font-weight:600; text-align: left;">${nombreColab} <br><small style="color:var(--text-secondary);">${r.cedula_colaborador}</small></td>
                    <td>${r.fecha}</td>
                    <td>${badgeTipo}</td>
                    <td><strong style="color: var(--success);">${r.hora_ingreso}</strong></td>
                    <td><strong style="color: var(--danger);">${r.hora_salida}</strong></td>
                    <td style="font-weight: 600;">${r.horas_calculadas.normales}h</td>
                    <td style="font-weight: 600; color: var(--success);">${r.horas_calculadas.extras > 0 ? r.horas_calculadas.extras + 'h' : '0.0h'}</td>
                    <td style="font-weight: 600; color: var(--warning);">${r.horas_calculadas.permisos > 0 ? r.horas_calculadas.permisos + 'h' : '0.0h'}</td>
                    <td><small style="font-size:0.75rem;">${shiftDisplay}</small></td>
                    <td style="font-size: 0.85rem; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left;" title="${r.observaciones || ''}">${obsDisplay}</td>
                    <td>
                        <div class="action-buttons">
                            ${accionesHTML}
                        </div>
                    </td>
                </tr>
            `;
        });
    }
}

window.aprobarPermiso = function(id) {
    if (!confirm('¿Está seguro de APROBAR este permiso/justificación? Si es un permiso remunerado, exonerará el tiempo perdido.')) return;
    const registros = obtenerRegistros();
    const idx = registros.findIndex(r => r.id_registro === id);
    if (idx !== -1) {
        registros[idx].estado_permiso = 'APROBADO';
        // Recalcular horas por si cambia
        const colab = obtenerColaboradorPorCedula(registros[idx].cedula_colaborador);
        const shift = colab ? obtenerTurnoColaboradorPorFecha(colab, registros[idx].fecha) : null;
        registros[idx].horas_calculadas = calcularHorasLaboradas(
            registros[idx].hora_ingreso,
            registros[idx].hora_salida,
            shift ? shift.hora_inicio : null,
            shift ? shift.hora_fin : null,
            registros[idx] // Pasamos el registro para que exonere si es remunerado
        );
        guardarRegistro(registros[idx]);
        showToast('Permiso aprobado correctamente.', 'success');
        refrescarTablaRegistros();
    }
};

window.verFotoRegistro = function(id) {
    const registros = obtenerRegistros();
    const reg = registros.find(r => r.id_registro === id);
    if (reg && reg.foto_captura) {
        document.getElementById('visor-foto-img').src = reg.foto_captura;
        const colab = obtenerColaboradorPorCedula(reg.cedula_colaborador);
        document.getElementById('visor-foto-info').innerHTML = `
            <strong>${colab ? colab.nombre : 'Colaborador Eliminado'}</strong><br>
            Cédula: ${reg.cedula_colaborador}<br>
            Fecha: ${reg.fecha} - Hora: ${reg.hora_ingreso || reg.hora_salida}
        `;
        document.getElementById('modal-ver-foto').style.display = 'block';
    } else {
        showToast('No hay captura facial disponible para este registro.', 'warning');
    }
};

window.rechazarPermiso = function(id) {
    const motivo = prompt('Por favor, indique el MOTIVO del rechazo para notificar al colaborador:');
    if (motivo === null) return; // Canceló
    if (motivo.trim() === '') {
        alert('Debe especificar un motivo de rechazo.');
        return;
    }
    
    const registros = obtenerRegistros();
    const idx = registros.findIndex(r => r.id_registro === id);
    if (idx !== -1) {
        registros[idx].estado_permiso = 'RECHAZADO';
        registros[idx].motivo_rechazo = motivo.trim();
        // Recalcular horas
        const colab = obtenerColaboradorPorCedula(registros[idx].cedula_colaborador);
        const shift = colab ? obtenerTurnoColaboradorPorFecha(colab, registros[idx].fecha) : null;
        registros[idx].horas_calculadas = calcularHorasLaboradas(
            registros[idx].hora_ingreso,
            registros[idx].hora_salida,
            shift ? shift.hora_inicio : null,
            shift ? shift.hora_fin : null,
            registros[idx]
        );
        guardarRegistros(registros);
        showToast('Permiso rechazado y horas recalculadas.', 'success');
        refrescarTablaRegistros();
    }
};

window.marcarIncapacidadPresentada = function(id) {
    if (confirm('¿Confirma que el colaborador ya presentó el soporte físico/digital de la incapacidad?')) {
        const registros = obtenerRegistros();
        const idx = registros.findIndex(r => r.id_registro === id);
        if (idx !== -1) {
            registros[idx].incapacidad_presentada = true;
            guardarRegistros(registros);
            showToast('Soporte de incapacidad recibido y actualizado.', 'success');
            refrescarTablaRegistros();
        }
    }
};
