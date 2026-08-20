// js/requests.js
// Módulo 4: Gestión de Permisos y Vacaciones (Flujo de Colaborador, Consola de Aprobación y Seguimiento)

// Calendario de Festivos Oficiales de Colombia (2025 - 2027)
var FESTIVOS_COLOMBIA = [
    // 2025
    '2025-01-01', '2025-01-06', '2025-03-24', '2025-04-17', '2025-04-18', '2025-05-01',
    '2025-06-02', '2025-06-23', '2025-06-30', '2025-07-20', '2025-08-07', '2025-08-18',
    '2025-10-13', '2025-11-03', '2025-11-17', '2025-12-08', '2025-12-25',
    // 2026
    '2026-01-01', '2026-01-12', '2026-03-23', '2026-04-02', '2026-04-03', '2026-05-01',
    '2026-05-18', '2026-06-08', '2026-06-15', '2026-06-29', '2026-07-20', '2026-08-07',
    '2026-08-17', '2026-10-12', '2026-11-02', '2026-11-16', '2026-12-08', '2026-12-25',
    // 2027
    '2027-01-01', '2027-01-11', '2027-03-22', '2027-03-25', '2027-03-26', '2027-05-01',
    '2027-05-10', '2027-05-31', '2027-06-07', '2027-07-05', '2027-07-20', '2027-08-07',
    '2027-08-16', '2027-10-18', '2027-11-01', '2027-11-15', '2027-12-08', '2027-12-25'
];

function inicializarRequests() {
    configurarFormulariosYEventos();
    aplicarAccesoRBAC();
    refrescarTablas();
}

// --- CONFIGURACIÓN DE EVENTOS EN EL FORMULARIO Y BUSCADOR ---
function configurarFormulariosYEventos() {
    const categoriaSelect = document.getElementById('req-categoria');
    const permisoTipoSelect = document.getElementById('req-permiso-tipo');
    const diaCompletoCheckbox = document.getElementById('req-permiso-dia-completo');
    
    const horaSalidaInput = document.getElementById('req-permiso-salida');
    const horaRegresoInput = document.getElementById('req-permiso-regreso');
    const vacInicioInput = document.getElementById('req-vac-inicio');
    const vacFinInput = document.getElementById('req-vac-fin');
    
    const formSolicitud = document.getElementById('form-solicitud-req');
    const btnSeguimiento = document.getElementById('btn-consultar-seguimiento');
    const cedulaInput = document.getElementById('req-colab-cedula');
    const nombreInput = document.getElementById('req-colab-nombre');
    const contactoInput = document.getElementById('req-colab-contacto');

    // 1. Mostrar/Ocultar campos según categoría
    if (categoriaSelect && !categoriaSelect.dataset.listener) {
        categoriaSelect.dataset.listener = 'true';
        categoriaSelect.addEventListener('change', (e) => {
            const blockPermiso = document.getElementById('req-block-permiso');
            const blockVacaciones = document.getElementById('req-block-vacaciones');
            if (e.target.value === 'permiso') {
                if (blockPermiso) blockPermiso.style.display = 'flex';
                if (blockVacaciones) blockVacaciones.style.display = 'none';
            } else {
                if (blockPermiso) blockPermiso.style.display = 'none';
                if (blockVacaciones) blockVacaciones.style.display = 'flex';
            }
        });
    }

    // 2. Mostrar/Ocultar "Detalle del Motivo" si es "Otro"
    if (permisoTipoSelect && !permisoTipoSelect.dataset.listener) {
        permisoTipoSelect.dataset.listener = 'true';
        permisoTipoSelect.addEventListener('change', (e) => {
            const otroGroup = document.getElementById('req-permiso-otro-group');
            const otroInput = document.getElementById('req-permiso-otro');
            if (e.target.value === 'Otro') {
                if (otroGroup) otroGroup.style.display = 'block';
                if (otroInput) otroInput.required = true;
            } else {
                if (otroGroup) otroGroup.style.display = 'none';
                if (otroInput) {
                    otroInput.required = false;
                    otroInput.value = '';
                }
            }
        });
    }

    // 3. Mostrar/Ocultar bloque de horas según "Día Completo"
    if (diaCompletoCheckbox && !diaCompletoCheckbox.dataset.listener) {
        diaCompletoCheckbox.dataset.listener = 'true';
        diaCompletoCheckbox.addEventListener('change', (e) => {
            const horasBlock = document.getElementById('req-permiso-horas-block');
            const salidaInput = document.getElementById('req-permiso-salida');
            const regresoInput = document.getElementById('req-permiso-regreso');
            
            if (e.target.checked) {
                if (horasBlock) horasBlock.style.display = 'none';
                if (salidaInput) salidaInput.required = false;
                if (regresoInput) regresoInput.required = false;
            } else {
                if (horasBlock) horasBlock.style.display = 'grid';
                if (salidaInput) salidaInput.required = true;
                if (regresoInput) regresoInput.required = true;
            }
            calcularYMostrarHorasPermiso();
        });
    }

    // 4. Cálculos en tiempo real al cambiar horas o fechas
    const calcularHoras = () => calcularYMostrarHorasPermiso();
    const calcularVacaciones = () => calcularYMostrarDiasVacaciones();

    if (horaSalidaInput && !horaSalidaInput.dataset.listener) {
        horaSalidaInput.dataset.listener = 'true';
        horaSalidaInput.addEventListener('input', calcularHoras);
        horaSalidaInput.addEventListener('change', calcularHoras);
    }
    if (horaRegresoInput && !horaRegresoInput.dataset.listener) {
        horaRegresoInput.dataset.listener = 'true';
        horaRegresoInput.addEventListener('input', calcularHoras);
        horaRegresoInput.addEventListener('change', calcularHoras);
    }
    if (vacInicioInput && !vacInicioInput.dataset.listener) {
        vacInicioInput.dataset.listener = 'true';
        vacInicioInput.addEventListener('change', calcularVacaciones);
        vacInicioInput.addEventListener('input', calcularVacaciones);
    }
    if (vacFinInput && !vacFinInput.dataset.listener) {
        vacFinInput.dataset.listener = 'true';
        vacFinInput.addEventListener('change', calcularVacaciones);
        vacFinInput.addEventListener('input', calcularVacaciones);
    }

    // 5. Autocompletar nombre y contacto al escribir cédula (Para admin)
    if (cedulaInput && !cedulaInput.dataset.listener) {
        cedulaInput.dataset.listener = 'true';
        cedulaInput.addEventListener('input', (e) => {
            const nombreInput = document.getElementById('req-colab-nombre');
            const contactoInput = document.getElementById('req-colab-contacto');
            if (!nombreInput || nombreInput.disabled) return;
            
            const cedulaVal = parseInt(e.target.value.trim());
            if (cedulaVal) {
                const colab = window.obtenerColaboradorPorCedula ? window.obtenerColaboradorPorCedula(cedulaVal) : obtenerColaboradorPorCedula(cedulaVal);
                if (colab) {
                    nombreInput.value = colab.nombre;
                    if (contactoInput) {
                        contactoInput.value = colab.numero_contacto || 'No registrado';
                    }
                } else {
                    nombreInput.value = '';
                    if (contactoInput) {
                        contactoInput.value = '';
                    }
                }
            } else {
                nombreInput.value = '';
                if (contactoInput) {
                    contactoInput.value = '';
                }
            }
        });
    }

    // 6. Enviar Solicitud Form
    if (formSolicitud && !formSolicitud.dataset.listener) {
        formSolicitud.dataset.listener = 'true';
        formSolicitud.addEventListener('submit', guardarNuevaSolicitud);
    }

    // 7. Buscar historial
    if (btnSeguimiento && !btnSeguimiento.dataset.listener) {
        btnSeguimiento.dataset.listener = 'true';
        btnSeguimiento.addEventListener('click', () => {
            const segCedulaEl = document.getElementById('req-seg-cedula');
            const cedulaVal = segCedulaEl ? parseInt(segCedulaEl.value.trim()) : null;
            renderizarSeguimientoColaborador(cedulaVal);
        });
    }
}

// --- DETECTAR ROL Y CONFIGURAR INTERFAZ (RBAC) ---
function aplicarAccesoRBAC() {
    const config = obtenerConfiguracion();
    const sesion = config.sesion_activa || { rol: 'ADMINISTRADOR', cedula: null };
    
    const cardAprobaciones = document.getElementById('admin-approvals-card');
    const inputCedulaForm = document.getElementById('req-colab-cedula');
    const inputNombreForm = document.getElementById('req-colab-nombre');
    const inputCedulaSeguimiento = document.getElementById('req-seg-cedula');
    const btnBuscarSeguimiento = document.getElementById('btn-consultar-seguimiento');

    const inputContactoForm = document.getElementById('req-colab-contacto');
    const segCedulaGroup = document.getElementById('req-seg-cedula-group');

    if (sesion.rol === 'COLABORADOR') {
        // Ocultar consola de aprobación
        if (cardAprobaciones) cardAprobaciones.style.display = 'none';
        
        // Bloquear y autocompletar cédula y nombre en formulario
        if (inputCedulaForm) {
            inputCedulaForm.value = sesion.cedula;
            inputCedulaForm.disabled = true;
        }
        
        const colab = obtenerColaboradorPorCedula(sesion.cedula);
        if (inputNombreForm) {
            inputNombreForm.value = colab ? colab.nombre : '';
            inputNombreForm.disabled = true;
        }
        
        if (inputContactoForm) {
            inputContactoForm.value = colab && colab.numero_contacto ? colab.numero_contacto : '';
            inputContactoForm.disabled = true;
        }

        // Ocultar el grupo de búsqueda de seguimiento para colaborador
        if (segCedulaGroup) {
            segCedulaGroup.style.display = 'none';
        }

        // Dejar el input oculto o bloqueado por si otras funciones lo necesitan
        if (inputCedulaSeguimiento) {
            inputCedulaSeguimiento.value = sesion.cedula;
            inputCedulaSeguimiento.disabled = true;
        }
        if (btnBuscarSeguimiento) {
            btnBuscarSeguimiento.disabled = true;
        }

        renderizarSeguimientoColaborador(sesion.cedula);
    } else {
        // Es administrador: mostrar consola de aprobación
        if (cardAprobaciones) cardAprobaciones.style.display = 'block';
        
        // Desbloquear entradas del formulario
        if (inputCedulaForm) {
            inputCedulaForm.disabled = false;
            inputCedulaForm.value = '';
        }
        if (inputNombreForm) {
            inputNombreForm.disabled = false;
            inputNombreForm.value = '';
        }
        if (inputContactoForm) {
            inputContactoForm.disabled = false;
            inputContactoForm.value = '';
        }

        if (segCedulaGroup) {
            segCedulaGroup.style.display = 'block';
        }

        // Desbloquear seguimiento
        if (inputCedulaSeguimiento) {
            inputCedulaSeguimiento.disabled = false;
            inputCedulaSeguimiento.value = '';
        }
        if (btnBuscarSeguimiento) {
            btnBuscarSeguimiento.disabled = false;
        }

        // Limpiar la tabla de seguimiento inicialmente en admin
        const tbodySeg = document.getElementById('table-seguimiento-body');
        if (tbodySeg) {
            tbodySeg.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-secondary); font-size:0.85rem;">Ingrese la cédula del colaborador para realizar la consulta.</td></tr>`;
        }
    }
}

// --- CÁLCULO EN VIVO DE DÍAS HÁBILES DE VACACIONES ---
function calcularYMostrarDiasVacaciones() {
    const vacInicioInput = document.getElementById('req-vac-inicio');
    const vacFinInput = document.getElementById('req-vac-fin');
    const displayVal = document.getElementById('req-vac-dias-val');

    if (!vacInicioInput || !vacFinInput || !displayVal) return;

    const fechaInicioStr = vacInicioInput.value;
    const fechaFinStr = vacFinInput.value;

    if (!fechaInicioStr || !fechaFinStr) {
        displayVal.textContent = '0 días';
        return;
    }

    const partsInicio = fechaInicioStr.split('-');
    const partsFin = fechaFinStr.split('-');
    
    const dInicio = new Date(partsInicio[0], partsInicio[1] - 1, partsInicio[2]);
    const dFin = new Date(partsFin[0], partsFin[1] - 1, partsFin[2]);

    if (dFin < dInicio) {
        displayVal.textContent = '0 días (Fecha de fin debe ser posterior a la de inicio)';
        displayVal.style.color = 'var(--danger)';
        return;
    }

    displayVal.style.color = 'var(--accent)';
    let diasHabiles = 0;
    let curr = new Date(dInicio);

    while (curr <= dFin) {
        const y = curr.getFullYear();
        const m = String(curr.getMonth() + 1).padStart(2, '0');
        const d = String(curr.getDate()).padStart(2, '0');
        const dateKey = `${y}-${m}-${d}`;

        const esDomingo = curr.getDay() === 0;
        const esFestivo = FESTIVOS_COLOMBIA.includes(dateKey);

        if (!esDomingo && !esFestivo) {
            diasHabiles++;
        }
        curr.setDate(curr.getDate() + 1);
    }

    displayVal.textContent = `${diasHabiles} día${diasHabiles === 1 ? '' : 's'}`;
}

// --- CÁLCULO EN VIVO DE HORAS DE PERMISO ---
function calcularYMostrarHorasPermiso() {
    const diaCompletoCheckbox = document.getElementById('req-permiso-dia-completo');
    const displayVal = document.getElementById('req-permiso-horas-val');
    
    if (!diaCompletoCheckbox || !displayVal) return;

    if (diaCompletoCheckbox.checked) {
        displayVal.textContent = 'Día Completo';
        return;
    }

    const salidaInput = document.getElementById('req-permiso-salida');
    const regresoInput = document.getElementById('req-permiso-regreso');

    if (!salidaInput || !regresoInput) return;

    const salidaStr = salidaInput.value;
    const regresoStr = regresoInput.value;

    if (!salidaStr || !regresoStr) {
        displayVal.textContent = '0h';
        return;
    }

    const minSalida = reqHoraAMinutos(salidaStr);
    const minRegreso = reqHoraAMinutos(regresoStr);

    let diff = minRegreso - minSalida;
    if (diff < 0) {
        diff += 1440; // Cruce de medianoche
    }

    const horasDec = reqMinutosAHorasDecimal(diff);
    displayVal.textContent = `${horasDec}h`;
}

window.autocompletarColaborador = function(inputElem) {
    try {
        const val = inputElem.value.trim();
        const nombreInput = document.getElementById('req-colab-nombre');
        const contactoInput = document.getElementById('req-colab-contacto');
        
        if (!nombreInput) return;

        if (val.length >= 4) {
            const colab = window.obtenerColaboradorPorCedula(val);
            if (colab) {
                nombreInput.value = colab.nombre;
                if (contactoInput) contactoInput.value = colab.numero_contacto || '';
            } else {
                nombreInput.value = '';
                if (contactoInput) contactoInput.value = '';
            }
        } else {
            nombreInput.value = '';
            if (contactoInput) contactoInput.value = '';
        }
    } catch (err) {
        alert("Autocomplete Error: " + err.message);
    }
};

// --- GUARDAR NUEVA SOLICITUD ---
function guardarNuevaSolicitud(e) {
    e.preventDefault();
    try {
        var config = obtenerConfiguracion();
        var sesion = config.sesion_activa || { rol: 'ADMINISTRADOR', cedula: null };

        const inputCedulaForm = document.getElementById('req-colab-cedula');
        const inputNombreForm = document.getElementById('req-colab-nombre');
        const inputContactoForm = document.getElementById('req-colab-contacto');
        const selectCategoria = document.getElementById('req-categoria');
        const textObservaciones = document.getElementById('req-observaciones');

        if (!inputCedulaForm || !inputNombreForm || !inputContactoForm || !selectCategoria) return;

        const cedula = parseInt(inputCedulaForm.value.trim());
        const nombre = inputNombreForm.value.trim();
        const contacto = inputContactoForm.value.trim();
        const categoria = selectCategoria.value;
        const observaciones = textObservaciones ? textObservaciones.value.trim() : '';

        if (!cedula || !nombre || !contacto) {
            showToast('Por favor, complete los datos básicos de identificación.', 'warning');
            return;
        }

        // Obtener fecha actual en zona horaria de Bogotá/Medellín
        const hoy = obtenerFechaActualMedellinLocal(); const inputFechaPermiso = document.getElementById('req-permiso-fecha'); const fechaPermisoVal = inputFechaPermiso ? inputFechaPermiso.value : hoy;

        const nuevaSolicitud = {
            cedula_colaborador: cedula,
            nombre_colaborador: nombre,
            contacto: contacto,
            fecha_solicitud: fechaPermisoVal,
            categoria: categoria,
            observaciones: observaciones,
            estado: 'PENDIENTE'
        };

        if (categoria === 'permiso') {
            const selectPermisoTipo = document.getElementById('req-permiso-tipo');
            const inputOtroMotivo = document.getElementById('req-permiso-otro');
            const diaCompletoCheckbox = document.getElementById('req-permiso-dia-completo');
            
            nuevaSolicitud.tipo_permiso = selectPermisoTipo ? selectPermisoTipo.value : 'Personal';
            nuevaSolicitud.otro_detalle = (nuevaSolicitud.tipo_permiso === 'Otro' && inputOtroMotivo) ? inputOtroMotivo.value.trim() : '';
            nuevaSolicitud.cobertura_dia_completo = diaCompletoCheckbox ? diaCompletoCheckbox.checked : true;
            
            if (nuevaSolicitud.cobertura_dia_completo) {
                nuevaSolicitud.hora_salida = '';
                nuevaSolicitud.hora_regreso = '';
                nuevaSolicitud.total_calculado = 'Día Completo';
            } else {
                const salidaVal = document.getElementById('req-permiso-salida').value;
                const regresoVal = document.getElementById('req-permiso-regreso').value;
                
                if (!salidaVal || !regresoVal) {
                    showToast('Por favor, defina la hora de salida y regreso para el permiso.', 'warning');
                    return;
                }

                nuevaSolicitud.hora_salida = salidaVal;
                nuevaSolicitud.hora_regreso = regresoVal;
                
                const minSal = reqHoraAMinutos(salidaVal);
                const minReg = reqHoraAMinutos(regresoVal);
                let diff = minReg - minSal;
                if (diff < 0) diff += 1440;
                
                nuevaSolicitud.total_calculado = `${reqMinutosAHorasDecimal(diff)}h`;
            }
        } else {
            // Categoria vacaciones
            const vacInicioVal = document.getElementById('req-vac-inicio').value;
            const vacFinVal = document.getElementById('req-vac-fin').value;

            if (!vacInicioVal || !vacFinVal) {
                showToast('Por favor, seleccione las fechas de inicio y fin de las vacaciones.', 'warning');
                return;
            }

            const partsInicio = vacInicioVal.split('-');
            const partsFin = vacFinVal.split('-');
            const dInicio = new Date(partsInicio[0], partsInicio[1] - 1, partsInicio[2]);
            const dFin = new Date(partsFin[0], partsFin[1] - 1, partsFin[2]);

            if (dFin < dInicio) {
                showToast('La fecha de fin no puede ser menor a la fecha de inicio.', 'warning');
                return;
            }

            nuevaSolicitud.tipo_permiso = 'Vacaciones';
            nuevaSolicitud.otro_detalle = '';
            nuevaSolicitud.cobertura_dia_completo = true;
            nuevaSolicitud.hora_salida = '';
            nuevaSolicitud.hora_regreso = '';
            nuevaSolicitud.fecha_inicio_vacaciones = vacInicioVal;
            nuevaSolicitud.fecha_fin_vacaciones = vacFinVal;
        }

        const payload = {
            accion: 'solicitar_permiso',
            cedula: nuevaSolicitud.cedula_colaborador,
            tipo: nuevaSolicitud.categoria === 'permiso' ? nuevaSolicitud.tipo_permiso : 'Vacaciones',
            fecha_inicio: nuevaSolicitud.categoria === 'permiso' ? nuevaSolicitud.fecha_solicitud : nuevaSolicitud.fecha_inicio_vacaciones,
            fecha_fin: nuevaSolicitud.categoria === 'permiso' ? nuevaSolicitud.fecha_solicitud : nuevaSolicitud.fecha_fin_vacaciones,
            motivo: nuevaSolicitud.observaciones
        };

        fetch(window.location.href, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': window.getCookie('csrftoken')
            },
            body: JSON.stringify(payload)
        })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showToast('Solicitud enviada exitosamente.', 'success');
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

    // Resetear formulario
    e.target.reset();

    // Re-configurar valores por defecto y previsualización
    const blockPermiso = document.getElementById('req-block-permiso');
    const blockVacaciones = document.getElementById('req-block-vacaciones');
    const otroGroup = document.getElementById('req-permiso-otro-group');
    const horasBlock = document.getElementById('req-permiso-horas-block');
    
    if (blockPermiso) blockPermiso.style.display = 'flex';
    if (blockVacaciones) blockVacaciones.style.display = 'none';
    if (otroGroup) otroGroup.style.display = 'none';
    if (horasBlock) horasBlock.style.display = 'none';

    // Si es colaborador, volver a pre-llenar sus datos fijos
    if (sesion.rol === 'COLABORADOR') {
        if (inputCedulaForm) {
            inputCedulaForm.value = sesion.cedula;
        }
        const colab = obtenerColaboradorPorCedula(sesion.cedula);
        if (inputNombreForm) {
            inputNombreForm.value = colab ? colab.nombre : '';
        }
        renderizarSeguimientoColaborador(sesion.cedula);
    } else {
        // Si es admin, limpiar tabla de seguimiento o recargar con la cédula del colaborador registrado si se desea
        const segCedulaEl = document.getElementById('req-seg-cedula');
        if (segCedulaEl && segCedulaEl.value) {
            renderizarSeguimientoColaborador(parseInt(segCedulaEl.value.trim()));
        }
    }

    calcularYMostrarHorasPermiso();
    refrescarTablas();

    } catch (err) {
        alert("CRITICAL ERROR: " + err.message + "\n" + err.stack);
    }
}

// --- ACTUALIZAR APROBACIONES (ADMIN) ---
window.cambiarEstadoSolicitud = function(id, nuevoEstado) {
    try {
        var config = obtenerConfiguracion();
        var sesion = config.sesion_activa || { rol: 'ADMINISTRADOR' };
    } catch (e) {
        alert("Error loading config: " + e.message);
        return;
    }

    if (sesion.rol !== 'ADMINISTRADOR') {
        showToast('Acceso no autorizado. Se requiere rol de Administrador.', 'danger');
        return;
    }

    try {
        var csrf = getCookie('csrftoken');
    } catch (e) {
        alert("Error getting cookie: " + e.message);
        return;
    }

    fetch(window.location.pathname, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrf
        },
        body: JSON.stringify({
            accion: 'cambiar_estado',
            id: id,
            nuevo_estado: nuevoEstado
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showToast(data.message, 'success');
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

window.eliminarSolicitud = function(id) {
    if (!confirm('¿Estás seguro de que deseas eliminar permanentemente esta solicitud? Esta acción no se puede deshacer.')) return;

    try {
        var config = obtenerConfiguracion();
        var sesion = config.sesion_activa || { rol: 'ADMINISTRADOR' };
    } catch (e) {
        alert("Error loading config: " + e.message);
        return;
    }

    if (sesion.rol !== 'ADMINISTRADOR') {
        showToast('Acceso denegado. Solo los administradores pueden eliminar solicitudes.', 'error');
        return;
    }

    fetch(window.location.pathname, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        },
        body: JSON.stringify({
            accion: 'eliminar_solicitud',
            id: id
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showToast(data.message, 'success');
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

// --- RENDERIZAR TABLAS ---
function refrescarTablas() {
    renderizarAprobacionesAdmin();
    
    // Si la sesión es colaborador, refresca su seguimiento
    const config = obtenerConfiguracion();
    const sesion = config.sesion_activa || { rol: 'ADMINISTRADOR', cedula: null };
    if (sesion.rol === 'COLABORADOR') {
        renderizarSeguimientoColaborador(sesion.cedula);
    }
}

function renderizarAprobacionesAdmin() {
    const tbody = document.getElementById('table-approvals-body');
    if (!tbody) return;

    const solicitudes = obtenerSolicitudes();
    const pendientes = solicitudes.filter(s => s.estado === 'PENDIENTE');

    tbody.innerHTML = '';

    if (pendientes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-secondary); font-size:0.85rem;">No hay solicitudes pendientes de autorización.</td></tr>`;
        return;
    }

    pendientes.forEach(s => {
        let detalles = '';
        if (s.categoria === 'permiso') {
            detalles = `<strong>Motivo:</strong> ${s.tipo_permiso}${s.tipo_permiso === 'Otro' ? ' (' + s.otro_detalle + ')' : ''}<br>
                        <strong>Fecha:</strong> ${s.fecha_solicitud}`;
        } else {
            detalles = `<strong>Desde:</strong> ${s.fecha_inicio_vacaciones}<br><strong>Hasta:</strong> ${s.fecha_fin_vacaciones}<br><strong>Total días a disfrutar:</strong> ${s.total_calculado}`;
        }

        const categoriaLabel = s.categoria === 'permiso' ? 'Permiso / Ausencia' : 'Vacaciones';

        tbody.innerHTML += `
            <tr>
                <td>
                    <div style="font-weight:600;">${s.nombre_colaborador}</div>
                    <div style="font-size:0.75rem; color:var(--text-secondary);">Cédula: ${s.cedula_colaborador}</div>
                </td>
                <td>${s.fecha_solicitud}</td>
                <td><span class="badge badge-info" style="text-transform:capitalize;">${categoriaLabel}</span></td>
                <td style="font-size:0.8rem; line-height:1.4;">${detalles}</td>
                <td style="font-weight:700; color:var(--accent);">${s.total_calculado}</td>
                <td style="font-size:0.8rem; max-width:200px; word-wrap:break-word;">${s.observaciones || '<span style="color:var(--text-secondary); font-style:italic;">Sin observaciones</span>'}</td>
                <td>
                    <div style="display:flex; gap:6px;">
                        <button class="btn btn-primary" onclick="window.cambiarEstadoSolicitud(${s.id_solicitud}, 'AUTORIZADA')" style="padding: 6px 12px; font-size: 0.75rem; background-color: var(--success); border-color: var(--success);">Autorizar</button>
                        <button class="btn btn-secondary" onclick="window.cambiarEstadoSolicitud(${s.id_solicitud}, 'RECHAZADA')" style="padding: 6px 12px; font-size: 0.75rem; background-color: var(--danger); border-color: var(--danger); color: white;">Rechazar</button>
                        <button class="btn btn-secondary" onclick="window.eliminarSolicitud(${s.id_solicitud})" style="padding: 6px 12px; font-size: 0.75rem; background-color: #dc3545; border-color: #dc3545; color: white;" title="Eliminar permanentemente">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
}

function renderizarSeguimientoColaborador(cedula) {
    const tbody = document.getElementById('table-seguimiento-body');
    if (!tbody) return;

    if (!cedula) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-secondary); font-size:0.85rem;">Ingrese su cédula para consultar su historial.</td></tr>`;
        return;
    }

    const solicitudes = obtenerSolicitudes();
    let filtradas = solicitudes.filter(s => s.cedula_colaborador == cedula);

    // Integrar las justificaciones de asistencia (QR / Admin)
    const registros = typeof obtenerRegistros === 'function' ? obtenerRegistros() : [];
    const justificaciones = registros.filter(r => r.cedula_colaborador == cedula && r.tipo_permiso);
    
    const justifMapeadas = justificaciones.map(r => {
        return {
            id_solicitud: r.id_registro, // para poder ordenar por id
            fecha_solicitud: r.fecha,
            categoria: 'justificacion',
            tipo_permiso: r.tipo_permiso,
            estado: r.estado_permiso === 'PENDIENTE' ? 'PENDIENTE' : (r.estado_permiso === 'APROBADO' ? 'AUTORIZADA' : 'RECHAZADA'),
            total_calculado: 'Desviación QR/Admin',
            observaciones: r.observaciones,
            motivo_rechazo: r.motivo_rechazo
        };
    });

    filtradas = filtradas.concat(justifMapeadas);

    tbody.innerHTML = '';

    if (filtradas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-secondary); font-size:0.85rem;">No se encontraron solicitudes para la cédula ${cedula}.</td></tr>`;
        return;
    }

    // Ordenar de más reciente a más antiguo
    filtradas.sort((a, b) => b.id_solicitud - a.id_solicitud);

    // Obtener rol
    let isAdmin = false;
    try {
        var config = obtenerConfiguracion();
        var sesion = config.sesion_activa;
        if (sesion && sesion.rol === 'ADMINISTRADOR') isAdmin = true;
    } catch(e) {}

    filtradas.forEach(s => {
        let detalle = '';
        if (s.categoria === 'permiso') {
            detalle = `${s.tipo_permiso}${s.tipo_permiso === 'Otro' ? ' (' + s.otro_detalle + ')' : ''} - Fecha: ${s.fecha_solicitud}`;
        } else if (s.categoria === 'justificacion') {
            detalle = `Motivo: <strong>${s.tipo_permiso}</strong><br><small style="color:var(--text-secondary);">${s.observaciones || ''}</small>`;
            if (s.motivo_rechazo && s.estado === 'RECHAZADA') {
                detalle += `<br><small style="color:var(--danger); font-weight:bold;">Motivo Rechazo: ${s.motivo_rechazo}</small>`;
            }
        } else {
            detalle = `Vacaciones de ${s.fecha_inicio_vacaciones} a ${s.fecha_fin_vacaciones} (${s.total_calculado})`;
        }

        let badgeEstado = '';
        if (s.estado === 'PENDIENTE') {
            badgeEstado = `<span class="badge badge-warning">Pendiente</span>`;
        } else if (s.estado === 'AUTORIZADA') {
            badgeEstado = `<span class="badge badge-success" style="background-color: var(--success-light); color: var(--success);">Autorizada</span>`;
        } else if (s.estado === 'RECHAZADA') {
            badgeEstado = `<span class="badge badge-danger" style="background-color: var(--danger-light); color: var(--danger);">Rechazada</span>`;
        }

        const categoriaLabel = s.categoria === 'permiso' ? 'Permiso' : (s.categoria === 'justificacion' ? 'Justif. Desviación' : 'Vacaciones');

        let acciones = badgeEstado;
        if (isAdmin && s.categoria !== 'justificacion') {
            acciones = `
                <div style="display:flex; justify-content:space-between; align-items:center; gap: 8px;">
                    ${badgeEstado}
                    <button class="btn btn-secondary" onclick="window.eliminarSolicitud(${s.id_solicitud})" style="padding: 4px 8px; font-size: 0.7rem; background-color: transparent; border: 1px solid #dc3545; color: #dc3545; border-radius: 4px;" title="Eliminar permanentemente">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
        }

        tbody.innerHTML += `
            <tr>
                <td>${s.fecha_solicitud}</td>
                <td><span class="badge badge-info" style="font-size:0.75rem;">${categoriaLabel}</span></td>
                <td style="font-size:0.8rem;">${detalle}</td>
                <td style="font-weight:600;">${s.total_calculado}</td>
                <td>${acciones}</td>
            </tr>
        `;
    });
}

// --- UTILERÍAS LOCALES DE SOPORTE ---
function reqHoraAMinutos(horaStr) {
    if (!horaStr) return 0;
    const [hrs, mins] = horaStr.split(':').map(Number);
    return (hrs * 60) + mins;
}

function reqMinutosAHorasDecimal(minutos) {
    return Math.round((minutos / 60) * 100) / 100;
}

function obtenerFechaActualMedellinLocal() {
    const ahora = new Date();
    const opciones = { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' };
    const formateador = new Intl.DateTimeFormat('en-US', opciones);
    const [{ value: month }, , { value: day }, , { value: year }] = formateador.formatToParts(ahora);
    return `${year}-${month}-${day}`;
}

// Inicializar al cargar el script (HTMX o Normal)
setTimeout(() => {
    inicializarRequests();
}, 50);



