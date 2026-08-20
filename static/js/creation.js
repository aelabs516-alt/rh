// js/creation.js
// Lógica del Módulo de Creación y Gestión de Colaboradores (con múltiples turnos mediante matriz dinámica) y Catálogo de Turnos

var editColaboradorModo = false;
var editHorarioModo = false;

var jefeCanvas = null;
var jefeCtx = null;
var isJefeDrawing = false;
var jefeLastPos = { x: 0, y: 0 };
var jefeHasDrawn = false;

var DIAS_SEMANA = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];
var DIAS_CORTOS = {
    'Lunes': 'Lun',
    'Martes': 'Mar',
    'Miercoles': 'Mié',
    'Jueves': 'Jue',
    'Viernes': 'Vie',
    'Sabado': 'Sáb',
    'Domingo': 'Dom'
};

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

function inicializarCreation() {
    const config = obtenerConfiguracion();
    const sesion = config.sesion_activa || { rol: 'ADMINISTRADOR', cedula: null };
    
    // Control de lectura/escritura por Rol
    const formColab = document.getElementById('form-colaborador');
    const formHorario = document.getElementById('form-horario');
    const formColabCard = formColab ? formColab.closest('.glass-card') : null;
    const formHorarioCard = formHorario ? formHorario.closest('.glass-card') : null;
    
    if (sesion.rol === 'COLABORADOR') {
        if (formColabCard) formColabCard.style.display = 'none';
        if (formHorarioCard) formHorarioCard.style.display = 'none';
    } else {
        if (formColabCard) formColabCard.style.display = 'block';
        if (formHorarioCard) formHorarioCard.style.display = 'block';
    }

    // Configurar toggle de secciones según el rol seleccionado en el formulario
    const colabRolSelect = document.getElementById('colab-rol');
    if (colabRolSelect && !colabRolSelect.dataset.listener) {
        colabRolSelect.dataset.listener = 'true';
        colabRolSelect.addEventListener('change', (e) => {
            toggleFormularioSecciones(e.target.value);
        });
    }

    inicializarCanvasFirmaJefe();
    refrescarTablasCreation();
    inicializarHandlersDocumentosLegales();

    // Reset forms a sus estados iniciales
    cancelarEdicionColaborador();
    cancelarEdicionHorario();
}

function toggleFormularioSecciones(rol) {
    const colabSection = document.getElementById('colab-only-section');
    const jefeSection = document.getElementById('jefe-only-section');

    if (rol === 'JEFE_INMEDIATO') {
        if (colabSection) colabSection.style.display = 'none';
        if (jefeSection) jefeSection.style.display = 'block';
    } else {
        if (colabSection) colabSection.style.display = 'block';
        if (jefeSection) jefeSection.style.display = 'none';
    }
}

function inicializarCanvasFirmaJefe() {
    const canvas = document.getElementById('jefe-creation-canvas');
    if (!canvas) return;

    jefeCanvas = canvas;
    jefeCtx = canvas.getContext('2d');

    // Estilos del trazo
    jefeCtx.strokeStyle = '#1e3a8a';
    jefeCtx.lineWidth = 3;
    jefeCtx.lineCap = 'round';
    jefeCtx.lineJoin = 'round';

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
    canvas.addEventListener('mousedown', (e) => {
        isJefeDrawing = true;
        jefeLastPos = getPos(e);
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!isJefeDrawing) return;
        const currentPos = getPos(e);
        jefeCtx.beginPath();
        jefeCtx.moveTo(jefeLastPos.x, jefeLastPos.y);
        jefeCtx.lineTo(currentPos.x, currentPos.y);
        jefeCtx.stroke();
        jefeLastPos = currentPos;
        jefeHasDrawn = true;
    });

    window.addEventListener('mouseup', () => { isJefeDrawing = false; });
    canvas.addEventListener('mouseleave', () => { isJefeDrawing = false; });

    // Eventos Touch
    canvas.addEventListener('touchstart', (e) => {
        isJefeDrawing = true;
        jefeLastPos = getPos(e);
        e.preventDefault();
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        if (!isJefeDrawing) return;
        const currentPos = getPos(e);
        jefeCtx.beginPath();
        jefeCtx.moveTo(jefeLastPos.x, jefeLastPos.y);
        jefeCtx.lineTo(currentPos.x, currentPos.y);
        jefeCtx.stroke();
        jefeLastPos = currentPos;
        jefeHasDrawn = true;
        e.preventDefault();
    }, { passive: false });

    canvas.addEventListener('touchend', () => { isJefeDrawing = false; });

    // Botón Limpiar
    const btnClear = document.getElementById('btn-clear-jefe-canvas');
    if (btnClear && !btnClear.dataset.listener) {
        btnClear.dataset.listener = 'true';
        btnClear.addEventListener('click', limpiarLienzoFirmaJefe);
    }

    // Botón Cargar Imagen
    const btnUpload = document.getElementById('btn-upload-jefe-signature');
    const fileInput = document.getElementById('jefe-signature-file');
    if (btnUpload && fileInput && !btnUpload.dataset.listener) {
        btnUpload.dataset.listener = 'true';
        btnUpload.addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(event) {
                const img = new Image();
                img.onload = function() {
                    limpiarLienzoFirmaJefe();
                    
                    const canvasWidth = jefeCanvas.width;
                    const canvasHeight = jefeCanvas.height;
                    
                    const scale = Math.min(canvasWidth / img.width, canvasHeight / img.height);
                    const x = (canvasWidth - img.width * scale) / 2;
                    const y = (canvasHeight - img.height * scale) / 2;
                    const width = img.width * scale;
                    const height = img.height * scale;
                    
                    jefeCtx.drawImage(img, x, y, width, height);
                    jefeHasDrawn = true;
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
            fileInput.value = '';
        });
    }
}

function limpiarLienzoFirmaJefe() {
    if (!jefeCanvas || !jefeCtx) return;
    jefeCtx.clearRect(0, 0, jefeCanvas.width, jefeCanvas.height);
    jefeHasDrawn = false;
}


// --- CONFIGURACIÓN DE ELEMENTOS ---
var formColaborador = document.getElementById('form-colaborador');
var formHorario = document.getElementById('form-horario');

// --- MANEJO DE LA MATRIZ DINÁMICA DE TURNOS ---
function crearFilaMatriz(codigoHorario = '', diasAsignados = []) {
    const row = document.createElement('div');
    row.className = 'matrix-row';
    
    // Select de turnos
    const select = document.createElement('select');
    select.className = 'matrix-shift-select';
    select.style.width = '160px';
    select.style.padding = '6px 10px';
    select.style.fontSize = '0.85rem';
    
    const horarios = obtenerHorarios();
    select.innerHTML = '<option value="" disabled selected>Seleccione Turno...</option>';
    horarios.forEach(h => {
        const selectedAttr = h.codigo === codigoHorario ? 'selected' : '';
        select.innerHTML += `<option value="${h.codigo}" ${selectedAttr}>${h.codigo} (${h.hora_inicio}-${h.hora_fin})</option>`;
    });
    
    row.appendChild(select);
    
    // Contenedor de checkboxes
    const cbContainer = document.createElement('div');
    cbContainer.className = 'matrix-day-checkboxes';
    
    DIAS_SEMANA.forEach(dia => {
        const isChecked = diasAsignados.includes(dia);
        const label = document.createElement('label');
        label.className = `matrix-day-item ${isChecked ? 'checked' : ''}`;
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = dia;
        checkbox.checked = isChecked;
        
        // Escuchar cambios para toggle de clase 'checked'
        checkbox.addEventListener('change', () => {
            label.classList.toggle('checked', checkbox.checked);
        });
        
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(` ${DIAS_CORTOS[dia]}`));
        cbContainer.appendChild(label);
    });
    
    row.appendChild(cbContainer);
    
    // Botón borrar
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn btn-danger';
    deleteBtn.style.padding = '6px 12px';
    deleteBtn.style.fontSize = '0.8rem';
    deleteBtn.style.height = '32px';
    deleteBtn.textContent = '×';
    deleteBtn.title = 'Eliminar fila';
    deleteBtn.addEventListener('click', () => {
        row.remove();
        // Si no quedan filas, agregamos una por defecto
        const container = document.getElementById('colab-matrix-container');
        if (container && container.children.length === 0) {
            agregarFilaMatriz();
        }
    });
    
    row.appendChild(deleteBtn);
    return row;
}

function agregarFilaMatriz(codigoHorario = '', diasAsignados = []) {
    const container = document.getElementById('colab-matrix-container');
    if (!container) return;
    const fila = crearFilaMatriz(codigoHorario, diasAsignados);
    container.appendChild(fila);
}

function obtenerMatrizDesdeUI() {
    const matrix = [];
    const rows = document.querySelectorAll('#colab-matrix-container .matrix-row');
    rows.forEach(row => {
        const select = row.querySelector('.matrix-shift-select');
        const codigo_horario = select ? select.value : '';
        
        const checkboxes = row.querySelectorAll('.matrix-day-checkboxes input[type="checkbox"]:checked');
        const dias_semana_asignados = Array.from(checkboxes).map(cb => cb.value);
        
        if (codigo_horario) {
            matrix.push({
                codigo_horario,
                dias_semana_asignados
            });
        }
    });
    return matrix;
}

function validarColisionesMatriz(matrix) {
    const diasAsignados = {};
    for (let i = 0; i < matrix.length; i++) {
        const row = matrix[i];
        for (let j = 0; j < row.dias_semana_asignados.length; j++) {
            const dia = row.dias_semana_asignados[j];
            if (diasAsignados[dia]) {
                showToast(`⚠️ Choque de horarios detectado: el día ${dia} tiene doble asignación (se cruza con ${diasAsignados[dia]} y ${row.codigo_horario}).`, 'danger');
                return false;
            }
            diasAsignados[dia] = row.codigo_horario;
        }
    }
    return true;
}

// Escuchar botón de agregar fila
var btnAddLine = document.getElementById('btn-add-matrix-line');
if (btnAddLine && !btnAddLine.dataset.listener) {
    btnAddLine.dataset.listener = 'true';
    btnAddLine.addEventListener('click', () => {
        agregarFilaMatriz();
    });
}

// --- SUBMIT FORMULARIO COLABORADOR ---
document.addEventListener('submit', function(e) {
    if (e.target && e.target.id === 'form-colaborador') {
        e.preventDefault();
        const formColaborador = e.target;
        const cedula = document.getElementById('colab-cedula').value.trim();
        const nombre = document.getElementById('colab-nombre').value.trim();
        const rol = document.getElementById('colab-rol').value;
        const estado = document.getElementById('colab-estado').value;
        
        const inputNum = document.getElementById('colab-numero-contacto');
        const numero_contacto = inputNum ? inputNum.value.trim() : '';
        const cargo = document.getElementById('colab-cargo') ? document.getElementById('colab-cargo').value.trim() : '';
        const area = document.getElementById('colab-area') ? document.getElementById('colab-area').value.trim() : '';
        const fecha_nacimiento = document.getElementById('colab-fecha-nacimiento') ? document.getElementById('colab-fecha-nacimiento').value : '';
        const tipo_contrato = document.getElementById('colab-tipo-contrato') ? document.getElementById('colab-tipo-contrato').value : '';
        const salario_base = document.getElementById('colab-salario-base') ? document.getElementById('colab-salario-base').value : '';
        
        let contacto_emergencia = '';
        const n_emergencia = document.getElementById('colab-nombre-emergencia') ? document.getElementById('colab-nombre-emergencia').value.trim() : '';
        const t_emergencia = document.getElementById('colab-telefono-emergencia') ? document.getElementById('colab-telefono-emergencia').value.trim() : '';
        if (n_emergencia || t_emergencia) {
            contacto_emergencia = `${n_emergencia} - ${t_emergencia}`;
        }
        
        const jefe_asignado = document.getElementById('colab-jefe-asignado') ? document.getElementById('colab-jefe-asignado').value : '';

        // Ahora enviamos directo al servidor backend (Django) en vez de guardar local
        fetch(window.location.pathname, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify({
                accion: 'crear_colaborador',
                cedula: cedula,
                nombre: nombre,
                rol: rol,
                estado: estado,
                numero_contacto: numero_contacto,
                fecha_ingreso: document.getElementById('colab-fecha-ingreso') ? document.getElementById('colab-fecha-ingreso').value : '',
                cargo: cargo,
                area: area,
                fecha_nacimiento: fecha_nacimiento,
                tipo_contrato: tipo_contrato,
                salario_base: salario_base,
                contacto_emergencia: contacto_emergencia,
                jefe_asignado: jefe_asignado
            })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showToast(data.message, 'success');
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            } else {
                showToast(data.message, 'error');
            }
        })
        .catch(err => {
            showToast('Error de conexión', 'error');
            console.error(err);
        });
    }
});


// --- SUBMIT FORMULARIO HORARIOS ---
if (formHorario) {
    formHorario.addEventListener('submit', (e) => {
        e.preventDefault();

        const codigo = document.getElementById('shift-codigo').value.trim().toUpperCase();
        const nombre = document.getElementById('shift-nombre').value.trim();
        const hora_inicio = document.getElementById('shift-inicio').value;
        const hora_fin = document.getElementById('shift-fin').value;

        // Validar código único en creación
        if (!editHorarioModo) {
            const existe = obtenerHorarioPorCodigo(codigo);
            if (existe) {
                showToast(`El código de turno "${codigo}" ya está definido`, 'danger');
                return;
            }
        }

        const horario = {
            codigo,
            nombre,
            hora_inicio,
            hora_fin
        };

        guardarHorario(horario);
        showToast(editHorarioModo ? 'Horario de turno actualizado' : 'Nuevo turno registrado', 'success');

        cancelarEdicionHorario();
        refrescarTablasCreation();
        
        // Al añadir/editar turnos, refrescar también los selectores de las filas
        refrescarSelectoresDiaColaborador();
    });
}

// --- EDITAR / ELIMINAR ACCIONES ---
window.editarColaborador = function(cedula) {
    const colab = obtenerColaboradorPorCedula(cedula);
    if (!colab) return;

    editColaboradorModo = true;
    
    document.getElementById('colaborador-form-title').querySelector('span').textContent = 'Editar Perfil';
    
    const form = document.getElementById('form-colaborador');
    if (form) {
        form.dataset.originalCedula = colab.cedula;
    }
    
    const cedulaInput = document.getElementById('colab-cedula');
    cedulaInput.value = colab.cedula;
    cedulaInput.disabled = false; // Permitido modificar la cédula en edición
    
    document.getElementById('colab-nombre').value = colab.nombre;
    document.getElementById('colab-cargo').value = colab.cargo || '';
    document.getElementById('colab-area').value = colab.area || '';
    document.getElementById('colab-fecha-nacimiento').value = colab.fecha_nacimiento || '';
    const partesContacto = (colab.contacto_emergencia || '').split(' - ');
    document.getElementById('colab-nombre-emergencia').value = partesContacto[0] || '';
    document.getElementById('colab-telefono-emergencia').value = partesContacto.slice(1).join(' - ') || '';
    document.getElementById('colab-fecha-ingreso').value = colab.fecha_ingreso || '';
    document.getElementById('colab-tipo-contrato').value = colab.tipo_contrato || 'Indefinido';
    document.getElementById('colab-salario-base').value = colab.salario_base || '';
    document.getElementById('colab-estado').value = colab.estado || 'ACTIVO';

    const expedContainer = document.getElementById('colab-expediente-digital-container');
    if (expedContainer) {
        expedContainer.style.display = 'block';
    }
    actualizarTablaDocumentosLegales(colab);

    // Rol y toggle de secciones
    const colabRolSelect = document.getElementById('colab-rol');
    colabRolSelect.value = colab.rol || 'COLABORADOR';
    colabRolSelect.disabled = true; // No se puede cambiar el rol en edición para evitar colisiones
    toggleFormularioSecciones(colab.rol || 'COLABORADOR');

    if (colab.rol === 'JEFE_INMEDIATO') {
        limpiarLienzoFirmaJefe();
        const passwordInput = document.getElementById('colab-contrasena');
        if (passwordInput) {
            passwordInput.value = colab.contrasena || '';
        }
        if (colab.firma_jefe_canvas) {
            const img = new Image();
            img.onload = function() {
                jefeCtx.drawImage(img, 0, 0, jefeCanvas.width, jefeCanvas.height);
                jefeHasDrawn = true;
            };
            img.src = colab.firma_jefe_canvas;
        }
    } else {
        // Cargar jefe asignado
        const jefeSelect = document.getElementById('colab-jefe-asignado');
        if (jefeSelect) {
            jefeSelect.value = colab.jefe_asignado_cedula || '';
        }

        // Cargar la matriz en los checkboxes dinámicos
        const container = document.getElementById('colab-matrix-container');
        if (container) {
            container.innerHTML = '';
            if (colab.matriz_turnos && colab.matriz_turnos.length > 0) {
                colab.matriz_turnos.forEach(line => {
                    agregarFilaMatriz(line.codigo_horario, line.dias_semana_asignados);
                });
            } else {
                agregarFilaMatriz();
            }
        }
    }

    document.getElementById('btn-cancel-colab').style.display = 'inline-flex';
    window.location.hash = '#creation';
};


window.eliminarColaboradorAction = function(cedula) {
    if (confirm('¿Está seguro de eliminar a este colaborador?')) {
        eliminarColaborador(cedula);
        showToast('Colaborador eliminado con éxito', 'success');
        refrescarTablasCreation();
    }
};

window.editarHorario = function(codigo) {
    const shift = obtenerHorarioPorCodigo(codigo);
    if (!shift) return;

    editHorarioModo = true;

    document.getElementById('horario-form-title').querySelector('span').textContent = 'Editar Turno';

    const codigoInput = document.getElementById('shift-codigo');
    codigoInput.value = shift.codigo;
    codigoInput.disabled = true;

    document.getElementById('shift-nombre').value = shift.nombre;
    document.getElementById('shift-inicio').value = shift.hora_inicio;
    document.getElementById('shift-fin').value = shift.hora_fin;

    document.getElementById('btn-cancel-shift').style.display = 'inline-flex';
    window.location.hash = '#creation';
};

window.eliminarHorarioAction = function(codigo) {
    // Validar si el turno está asignado a algún colaborador
    const colaboradores = obtenerColaboradores();
    let asignado = false;
    colaboradores.forEach(c => {
        if (c.matriz_turnos) {
            c.matriz_turnos.forEach(line => {
                if (line.codigo_horario === codigo) {
                    asignado = true;
                }
            });
        }
    });

    if (asignado) {
        showToast(`No se puede eliminar el turno "${codigo}" porque está asignado a la jornada de uno o más colaboradores.`, 'danger');
        return;
    }

    if (confirm('¿Está seguro de eliminar este turno?')) {
        eliminarHorario(codigo);
        showToast('Turno eliminado con éxito', 'success');
        refrescarTablasCreation();
        refrescarSelectoresDiaColaborador();
    }
};

// --- CANCELAR EDICIONES ---
var btnCancelColab = document.getElementById('btn-cancel-colab');
if (btnCancelColab) {
    btnCancelColab.addEventListener('click', cancelarEdicionColaborador);
}

function cancelarEdicionColaborador() {
    editColaboradorModo = false;
    
    document.getElementById('colaborador-form-title').querySelector('span').textContent = 'Crear Nuevo Perfil';
    
    const form = document.getElementById('form-colaborador');
    if (form) {
        form.removeAttribute('data-original-cedula');
    }
    
    const cedulaInput = document.getElementById('colab-cedula');
    cedulaInput.value = '';
    cedulaInput.disabled = false;
    
    document.getElementById('colab-nombre').value = '';
    document.getElementById('colab-cargo').value = '';
    document.getElementById('colab-area').value = '';
    document.getElementById('colab-fecha-nacimiento').value = '';
    document.getElementById('colab-nombre-emergencia').value = '';
    document.getElementById('colab-telefono-emergencia').value = '';
    document.getElementById('colab-fecha-ingreso').value = '';
    document.getElementById('colab-tipo-contrato').value = 'Indefinido';
    document.getElementById('colab-salario-base').value = '';
    document.getElementById('colab-estado').value = 'ACTIVO';

    const expedContainer = document.getElementById('colab-expediente-digital-container');
    if (expedContainer) {
        expedContainer.style.display = 'none';
    }

    const passwordInput = document.getElementById('colab-contrasena');
    if (passwordInput) passwordInput.value = '';

    const colabRolSelect = document.getElementById('colab-rol');
    if (colabRolSelect) {
        colabRolSelect.value = 'COLABORADOR';
        colabRolSelect.disabled = false;
    }
    toggleFormularioSecciones('COLABORADOR');

    // Reset matriz a una fila vacía
    const container = document.getElementById('colab-matrix-container');
    if (container) {
        container.innerHTML = '';
        agregarFilaMatriz();
    }

    limpiarLienzoFirmaJefe();

    document.getElementById('btn-cancel-colab').style.display = 'none';
}

var btnCancelShift = document.getElementById('btn-cancel-shift');
if (btnCancelShift) {
    btnCancelShift.addEventListener('click', cancelarEdicionHorario);
}

function cancelarEdicionHorario() {
    editHorarioModo = false;
    const title = document.getElementById('horario-form-title');
    if (title) title.querySelector('span').textContent = 'Configurar Horarios / Turnos';
    
    const codigoInput = document.getElementById('shift-codigo');
    if (codigoInput) {
        codigoInput.value = '';
        codigoInput.disabled = false;
    }
    
    const nombreInput = document.getElementById('shift-nombre');
    if (nombreInput) nombreInput.value = '';
    
    const inicioInput = document.getElementById('shift-inicio');
    if (inicioInput) inicioInput.value = '';
    
    const finInput = document.getElementById('shift-fin');
    if (finInput) finInput.value = '';
    
    const cancelBtn = document.getElementById('btn-cancel-shift');
    if (cancelBtn) cancelBtn.style.display = 'none';
}

// Refrescar selectores de turnos en las filas activas
function refrescarSelectoresDiaColaborador() {
    const selectores = document.querySelectorAll('.matrix-shift-select');
    const horarios = obtenerHorarios();

    selectores.forEach(select => {
        const valorPrevio = select.value;
        select.innerHTML = '<option value="" disabled selected>Seleccione Turno...</option>';
        horarios.forEach(h => {
            select.innerHTML += `<option value="${h.codigo}">${h.codigo} (${h.hora_inicio}-${h.hora_fin})</option>`;
        });
        if (valorPrevio) {
            select.value = valorPrevio;
        }
    });
}

// Formatear matriz en formato legible para la tabla
function formatearMatrizJornada(matriz) {
    if (!matriz || matriz.length === 0) {
        return '<span style="color:var(--text-secondary); font-style:italic;">Sin turnos asignados</span>';
    }
    return matriz.map(line => {
        const diasDisplay = line.dias_semana_asignados.map(d => DIAS_CORTOS[d]).join(', ');
        return `<strong>${line.codigo_horario}</strong>: ${diasDisplay}`;
    }).join(' | ');
}

// --- ACTUALIZAR TABLAS ---
function refrescarTablasCreation() {
    const config = obtenerConfiguracion();
    const sesion = config.sesion_activa || { rol: 'ADMINISTRADOR', cedula: null };
    
    let colaboradores = obtenerColaboradores();
    const horarios = obtenerHorarios();

    // Refrescar selector de jefes en el formulario
    const jefeSelect = document.getElementById('colab-jefe-asignado');
    if (jefeSelect) {
        const prevValue = jefeSelect.value;
        const jefes = colaboradores.filter(c => c.rol === 'JEFE_INMEDIATO');
        jefeSelect.innerHTML = '<option value="" disabled selected>Seleccione Jefe...</option>';
        jefes.forEach(j => {
            jefeSelect.innerHTML += `<option value="${j.cedula}">${j.nombre}</option>`;
        });
        if (prevValue) jefeSelect.value = prevValue;
    }

    // Si es colaborador visualizador, solo lee su propia información
    if (sesion.rol === 'COLABORADOR') {
        colaboradores = colaboradores.filter(c => c.cedula === sesion.cedula);
    }

    // Renderizar tabla de colaboradores
    const colabBody = document.getElementById('table-colaboradores-body');
    if (colabBody) {
        colabBody.innerHTML = '';
        if (colaboradores.length === 0) {
            colabBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-secondary);">No hay colaboradores registrados.</td></tr>';
        } else {
            colaboradores.forEach(c => {
                let perfilDisplay = 'Colaborador';
                let horariosJefeHtml = '';

                if (c.rol === 'JEFE_INMEDIATO') {
                    perfilDisplay = '<strong style="color: var(--accent);">Jefe Inmediato</strong>';
                    horariosJefeHtml = '<span style="color:var(--text-secondary); font-style:italic;">N/A - Administrador (Firma registrada)</span>';
                } else {
                    perfilDisplay = '<span style="color: var(--text-primary);">Colaborador</span>';
                    const jornadaHtml = formatearMatrizJornada(c.matriz_turnos);
                    
                    // Buscar nombre de su jefe asignado
                    const jefeAsig = colaboradores.find(j => j.cedula === c.jefe_asignado_cedula);
                    const jefeNombre = jefeAsig ? jefeAsig.nombre : `Cédula: ${c.jefe_asignado_cedula || 'No asignado'}`;
                    horariosJefeHtml = `
                        <div style="font-size:0.8rem; line-height:1.4;">
                            <span style="color: var(--text-secondary);">Jefe:</span> <strong>${jefeNombre}</strong><br>
                            <span style="color: var(--text-secondary);">Turnos:</span> ${jornadaHtml}
                        </div>
                    `;
                }
                
                let actionsHtml = '';
                if (sesion.rol !== 'COLABORADOR') {
                    actionsHtml = `
                        <div class="action-buttons">
                            <button class="btn-icon btn-icon-edit" onclick="editarColaborador(${c.cedula})" title="Editar Perfil">
                                <svg style="width:16px; height:16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                            </button>
                            <button class="btn-icon btn-icon-delete" onclick="eliminarColaboradorAction(${c.cedula})" title="Eliminar Perfil">
                                <svg style="width:16px; height:16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>
                        </div>
                    `;
                } else {
                    actionsHtml = '<span style="color:var(--text-secondary); font-style:italic;">No disponible</span>';
                }

                colabBody.innerHTML += `
                    <tr>
                        <td style="font-weight: 600;">${c.cedula}</td>
                        <td>${c.nombre}</td>
                        <td>${c.cargo || 'N/A'} / ${c.area || 'N/A'}</td>
                        <td>${perfilDisplay}</td>
                        <td>${horariosJefeHtml}</td>
                        <td>${actionsHtml}</td>
                    </tr>
                `;
            });
        }
    }


    // Renderizar tabla de horarios/turnos
    const horarioBody = document.getElementById('table-horarios-body');
    if (horarioBody) {
        horarioBody.innerHTML = '';
        if (horarios.length === 0) {
            horarioBody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-secondary);">No hay turnos configurados.</td></tr>';
        } else {
            horarios.forEach(h => {
                let actionsHtml = '';
                if (sesion.rol !== 'COLABORADOR') {
                    actionsHtml = `
                        <div class="action-buttons">
                            <button class="btn-icon btn-icon-edit" onclick="editarHorario('${h.codigo}')" title="Editar Turno">
                                <svg style="width:16px; height:16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                            </button>
                            <button class="btn-icon btn-icon-delete" onclick="eliminarHorarioAction('${h.codigo}')" title="Eliminar Turno">
                                <svg style="width:16px; height:16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>
                        </div>
                    `;
                } else {
                    actionsHtml = '<span style="color:var(--text-secondary); font-style:italic;">No disponible</span>';
                }

                horarioBody.innerHTML += `
                    <tr>
                        <td style="font-weight:600; color:var(--accent);">${h.codigo}</td>
                        <td>${h.nombre}</td>
                        <td><strong>${h.hora_inicio}</strong> a <strong>${h.hora_fin}</strong></td>
                        <td>${actionsHtml}</td>
                    </tr>
                `;
            });
        }
    }
}

// --- GESTIÓN DE EXPEDIENTE DIGITAL Y DOCUMENTOS LEGALES ---
function inicializarHandlersDocumentosLegales() {
    const inputs = [
        { id: 'doc-file-identidad', tipo: 'Documento de Identidad' },
        { id: 'doc-file-contrato', tipo: 'Contrato Firmado' },
        { id: 'doc-file-examenes', tipo: 'Exámenes Médicos' },
        { id: 'doc-file-certificaciones', tipo: 'Certificaciones' }
    ];

    inputs.forEach(item => {
        const inputEl = document.getElementById(item.id);
        if (inputEl) {
            if (inputEl.dataset.listenerSet) return;
            inputEl.dataset.listenerSet = 'true';

            inputEl.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;

                // Validar tamaño máximo 2MB para evitar cuotas de localStorage
                if (file.size > 2 * 1024 * 1024) {
                    showToast('El archivo supera el límite de 2MB. Seleccione uno más pequeño.', 'danger');
                    inputEl.value = '';
                    return;
                }

                const reader = new FileReader();
                reader.onload = function(event) {
                    const base64 = event.target.result;
                    const nombre_archivo = file.name;
                    const fecha_carga = new Date().toISOString().split('T')[0];

                    const cedula = parseInt(document.getElementById('colab-cedula').value.trim());
                    if (isNaN(cedula)) {
                        showToast('Cédula no válida para asociar el documento.', 'danger');
                        return;
                    }

                    const colab = obtenerColaboradorPorCedula(cedula);
                    if (colab) {
                        if (!colab.documentos_legales) {
                            colab.documentos_legales = [];
                        }
                        colab.documentos_legales.push({
                            tipo_documento: item.tipo,
                            nombre_archivo,
                            base64,
                            fecha_carga
                        });
                        guardarColaborador(colab);
                        actualizarTablaDocumentosLegales(colab);
                        showToast(`Documento "${item.tipo}" cargado con éxito.`, 'success');
                    }
                    inputEl.value = '';
                };
                reader.readAsDataURL(file);
            });
        }
    });
}

function actualizarTablaDocumentosLegales(colab) {
    const tableBody = document.getElementById('table-colab-docs-body');
    if (!tableBody) return;

    tableBody.innerHTML = '';
    const docs = colab.documentos_legales || [];

    if (docs.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:var(--text-secondary);">No hay documentos cargados en el expediente.</td></tr>';
        return;
    }

    docs.forEach((doc, idx) => {
        tableBody.innerHTML += `
            <tr>
                <td style="font-weight: 600;">${doc.tipo_documento}</td>
                <td>${doc.nombre_archivo}</td>
                <td>
                    <div style="display: flex; gap: 8px;">
                        <button type="button" class="btn btn-secondary" style="font-size: 0.75rem; padding: 4px 8px;" onclick="verDocumentoLegal(${colab.cedula}, ${idx})">Ver</button>
                        <button type="button" class="btn btn-danger" style="font-size: 0.75rem; padding: 4px 8px;" onclick="eliminarDocumentoLegal(${colab.cedula}, ${idx})">Eliminar</button>
                    </div>
                </td>
            </tr>
        `;
    });
}

window.verDocumentoLegal = function(cedula, idx) {
    const colab = obtenerColaboradorPorCedula(cedula);
    if (!colab || !colab.documentos_legales || !colab.documentos_legales[idx]) return;

    const doc = colab.documentos_legales[idx];
    try {
        const win = window.open();
        if (win) {
            win.document.write(`
                <html>
                    <head>
                        <title>${doc.nombre_archivo}</title>
                        <style>
                            body { margin: 0; display: flex; justify-content: center; align-items: center; background: #222; font-family: sans-serif; }
                            iframe, img { max-width: 100%; max-height: 100%; width: 100%; height: 100%; object-fit: contain; border: none; }
                        </style>
                    </head>
                    <body>
                        ${doc.base64.startsWith('data:application/pdf') 
                            ? `<iframe src="${doc.base64}"></iframe>`
                            : `<img src="${doc.base64}">`
                        }
                    </body>
                </html>
            `);
            win.document.close();
        } else {
            showToast('El navegador bloqueó la ventana de visualización.', 'danger');
        }
    } catch (e) {
        showToast('Error al visualizar el documento.', 'danger');
    }
};

window.eliminarDocumentoLegal = function(cedula, idx) {
    if (!confirm('¿Está seguro de eliminar este documento del expediente?')) return;
    const colab = obtenerColaboradorPorCedula(cedula);
    if (!colab || !colab.documentos_legales) return;

    colab.documentos_legales.splice(idx, 1);
    guardarColaborador(colab);
    actualizarTablaDocumentosLegales(colab);
    showToast('Documento eliminado del expediente.', 'success');
};


// Lógica de Edición de Colaboradores

document.addEventListener('click', function(e) {
    if (e.target && e.target.id === 'btn-cancel-edit') {
        const modalEdit = document.getElementById('modal-edit-colaborador');
        if (modalEdit) modalEdit.style.display = 'none';
    }
});

document.addEventListener('click', function(e) {
    const btn = e.target.closest('.btn-editar-colaborador');
    if (btn) {
        const cedula = btn.getAttribute('data-cedula');
        const nombre = btn.getAttribute('data-nombre');
        const rol = btn.getAttribute('data-rol');
        const estado = btn.getAttribute('data-estado');
        const contacto = btn.getAttribute('data-contacto');
        const cargo = btn.getAttribute('data-cargo') || '';
        const area = btn.getAttribute('data-area') || '';
        const fecha_ingreso = btn.getAttribute('data-fecha-ingreso') || '';
        const fecha_nacimiento = btn.getAttribute('data-fecha-nacimiento') || '';
        const tipo_contrato = btn.getAttribute('data-tipo-contrato') || 'Indefinido';
        const salario_base = btn.getAttribute('data-salario-base') || '';
        const contacto_emergencia = btn.getAttribute('data-contacto-emergencia') || '';
        const jefe_asignado = btn.getAttribute('data-jefe-asignado') || '';
        
        document.getElementById('edit-cedula').value = cedula;
        document.getElementById('edit-nombre').value = nombre;
        document.getElementById('edit-rol').value = rol;
        document.getElementById('edit-estado').value = estado;
        document.getElementById('edit-password').value = '';
        if (document.getElementById('edit-numero-contacto')) {
            document.getElementById('edit-numero-contacto').value = contacto || '';
        }
        if (document.getElementById('edit-cargo')) document.getElementById('edit-cargo').value = cargo;
        if (document.getElementById('edit-area')) document.getElementById('edit-area').value = area;
        if (document.getElementById('edit-fecha-ingreso')) document.getElementById('edit-fecha-ingreso').value = fecha_ingreso;
        if (document.getElementById('edit-fecha-nacimiento')) document.getElementById('edit-fecha-nacimiento').value = fecha_nacimiento;
        if (document.getElementById('edit-tipo-contrato')) document.getElementById('edit-tipo-contrato').value = tipo_contrato;
        
        if (document.getElementById('edit-salario-base')) {
            const sbInput = document.getElementById('edit-salario-base');
            sbInput.value = salario_base;
            // format it if it has value
            if (salario_base) sbInput.value = sbInput.value.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        }
        
        if (contacto_emergencia && contacto_emergencia.includes(' - ')) {
            const parts = contacto_emergencia.split(' - ');
            if (document.getElementById('edit-nombre-emergencia')) document.getElementById('edit-nombre-emergencia').value = parts[0];
            if (document.getElementById('edit-telefono-emergencia')) document.getElementById('edit-telefono-emergencia').value = parts[1];
        } else {
            if (document.getElementById('edit-nombre-emergencia')) document.getElementById('edit-nombre-emergencia').value = contacto_emergencia;
            if (document.getElementById('edit-telefono-emergencia')) document.getElementById('edit-telefono-emergencia').value = '';
        }
        
        if (document.getElementById('edit-jefe-asignado')) document.getElementById('edit-jefe-asignado').value = jefe_asignado;
        
        const modalEdit = document.getElementById('modal-edit-colaborador');
        if (modalEdit) modalEdit.style.display = 'flex';
    }
});

document.addEventListener('submit', function(e) {
    if (e.target && e.target.id === 'form-edit-colaborador') {
        e.preventDefault();
        const cedula = document.getElementById('edit-cedula').value;
        const nombre = document.getElementById('edit-nombre').value;
        const rol = document.getElementById('edit-rol').value;
        const estado = document.getElementById('edit-estado').value;
        const nueva_password = document.getElementById('edit-password').value;
        const numero_contacto = document.getElementById('edit-numero-contacto') ? document.getElementById('edit-numero-contacto').value : '';
        const fecha_ingreso = document.getElementById('edit-fecha-ingreso') ? document.getElementById('edit-fecha-ingreso').value : '';
        const cargo = document.getElementById('edit-cargo') ? document.getElementById('edit-cargo').value : '';
        const area = document.getElementById('edit-area') ? document.getElementById('edit-area').value : '';
        const fecha_nacimiento = document.getElementById('edit-fecha-nacimiento') ? document.getElementById('edit-fecha-nacimiento').value : '';
        const tipo_contrato = document.getElementById('edit-tipo-contrato') ? document.getElementById('edit-tipo-contrato').value : '';
        const salario_base = document.getElementById('edit-salario-base') ? document.getElementById('edit-salario-base').value : '';
        
        let contacto_emergencia = '';
        const n_emergencia = document.getElementById('edit-nombre-emergencia') ? document.getElementById('edit-nombre-emergencia').value : '';
        const t_emergencia = document.getElementById('edit-telefono-emergencia') ? document.getElementById('edit-telefono-emergencia').value : '';
        if (n_emergencia || t_emergencia) {
            contacto_emergencia = `${n_emergencia} - ${t_emergencia}`;
        }
        
        const jefe_asignado = document.getElementById('edit-jefe-asignado') ? document.getElementById('edit-jefe-asignado').value : '';
        
        fetch(window.location.pathname, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify({
                accion: 'editar_colaborador',
                cedula: cedula,
                nombre: nombre,
                rol: rol,
                estado: estado,
                nueva_password: nueva_password,
                numero_contacto: numero_contacto,
                fecha_ingreso: fecha_ingreso,
                cargo: cargo,
                area: area,
                fecha_nacimiento: fecha_nacimiento,
                tipo_contrato: tipo_contrato,
                salario_base: salario_base,
                contacto_emergencia: contacto_emergencia,
                jefe_asignado: jefe_asignado
            })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showToast(data.message, 'success');
                setTimeout(() => {
                    window.location.reload(); // Recargar para reflejar cambios
                }, 1500);
            } else {
                showToast(data.message, 'error');
            }
        })
        .catch(err => {
            showToast('Error de conexión', 'error');
            console.error(err);
        });
    }
});

// Lógica para Borrar Colaborador (Delegación)
document.addEventListener('click', function(e) {
    const btnBorrar = e.target.closest('.btn-borrar-colaborador');
    if (btnBorrar) {
        const cedula = btnBorrar.getAttribute('data-cedula');
        const nombre = btnBorrar.getAttribute('data-nombre');
        
        if (confirm(`¿Estás completamente seguro de que deseas eliminar a ${nombre} (${cedula})? Esta acción no se puede deshacer.`)) {
            fetch(window.location.pathname, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                body: JSON.stringify({
                    accion: 'borrar_colaborador',
                    cedula: cedula
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
            });
        }
    }
});



