// js/db.js
// Manejo de Persistencia de Datos local (LocalStorage) para Antigravity

var DB_KEY_COLABORADORES = 'intigravity_colaboradores';
var DB_KEY_HORARIOS = 'intigravity_horarios';
var DB_KEY_REGISTROS = 'intigravity_registros';
var DB_KEY_CONFIG = 'intigravity_config';
var DB_KEY_SOLICITUDES = 'intigravity_solicitudes';
var DB_KEY_DOCUMENTOS = 'intigravity_documentos';
var DB_KEY_ACTAS = 'intigravity_actas';
var DB_KEY_NOMINA = 'intigravity_nomina';
var DB_KEY_EVALUACIONES = 'intigravity_evaluaciones';

// Sanitización global para prevenir Stored XSS en innerHTML
window.escapeHTML = function(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>'"]/g, match => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[match]));
};
// Inicializar base de datos con datos de prueba si está vacía
function inicializarDB() {
    // Migración preventiva: si detectamos la estructura vieja o falta de contraseñas, reiniciamos
    const colabsRaw = localStorage.getItem(DB_KEY_COLABORADORES);
    const configRaw = localStorage.getItem(DB_KEY_CONFIG);
    let necesitaReinicio = false;

    // Forzar reinicio de datos para pruebas en blanco (solicitado por el usuario)
    const KEY_PRUEBAS_EN_BLANCO = 'intigravity_pruebas_en_blanco_hrms_v1';
    if (!localStorage.getItem(KEY_PRUEBAS_EN_BLANCO)) {
        necesitaReinicio = true;
        localStorage.setItem(KEY_PRUEBAS_EN_BLANCO, 'true');
    }
    
    if (colabsRaw) {
        try {
            const listObj = JSON.parse(colabsRaw);
            const tieneJefeSinContrasena = listObj.some(c => c.rol === 'JEFE_INMEDIATO' && !c.contrasena);
            const tieneColabSinCargo = listObj.some(c => !c.cargo || !c.area);
            const tieneColabSinEstado = listObj.some(c => !c.estado);
            if (listObj.length > 0 && (('horarios_por_dia' in listObj[0]) || !('rol' in listObj[0]) || tieneJefeSinContrasena || tieneColabSinCargo || tieneColabSinEstado)) {
                necesitaReinicio = true;
            }
        } catch(e) {
            necesitaReinicio = true;
        }
    }

    // Forzar reinicio si aún existen registros de prueba antiguos
    const registrosRaw = localStorage.getItem(DB_KEY_REGISTROS);
    if (registrosRaw) {
        try {
            const listReg = JSON.parse(registrosRaw);
            if (listReg.length > 0 && listReg.some(r => r.id_registro === 1 || r.id_registro === 2)) {
                necesitaReinicio = true;
            }
        } catch(e) {
            necesitaReinicio = true;
        }
    }
    
    if (configRaw) {
        try {
            const configObj = JSON.parse(configRaw);
            if (!configObj || !('admin_password' in configObj)) {
                necesitaReinicio = true;
            }
        } catch(e) {
            necesitaReinicio = true;
        }
    }

    if (necesitaReinicio) {
        localStorage.removeItem(DB_KEY_COLABORADORES);
        localStorage.removeItem(DB_KEY_REGISTROS);
        localStorage.removeItem(DB_KEY_ACTAS);
        localStorage.removeItem(DB_KEY_SOLICITUDES);
        localStorage.removeItem(DB_KEY_DOCUMENTOS);
        localStorage.removeItem(DB_KEY_CONFIG);
        localStorage.removeItem(DB_KEY_HORARIOS);
        localStorage.removeItem(DB_KEY_NOMINA);
        localStorage.removeItem(DB_KEY_EVALUACIONES);
    }

    // 1. Horarios por defecto (Turnos)
    if (!localStorage.getItem(DB_KEY_HORARIOS)) {
        const horariosDefecto = [
            { codigo: 'DIU', nombre: 'Diurno Estándar', hora_inicio: '08:00', hora_fin: '17:00' },
            { codigo: 'MED', nombre: 'Media Jornada Mañana', hora_inicio: '08:00', hora_fin: '12:00' },
            { codigo: 'TAR', nombre: 'Tarde', hora_inicio: '14:00', hora_fin: '22:00' },
            { codigo: 'NOC', nombre: 'Nocturno', hora_inicio: '22:00', hora_fin: '06:00' }
        ];
        localStorage.setItem(DB_KEY_HORARIOS, JSON.stringify(horariosDefecto));
    }

    // 2. Colaboradores por defecto con Matriz de Turnos Múltiples y Roles
    if (!localStorage.getItem(DB_KEY_COLABORADORES)) {
        const colaboradoresDefecto = [
            {
                cedula: 9900,
                nombre: 'Mauricio Restrepo (Jefe TI)',
                rol: 'JEFE_INMEDIATO',
                contrasena: '9900',
                cargo: 'Jefe de TI',
                area: 'Tecnología',
                fecha_nacimiento: '1980-08-15',
                contacto_emergencia: 'Liliana Gomez - 3154433221',
                fecha_ingreso: '2018-05-10',
                tipo_contrato: 'Indefinido',
                salario_base: 6500000,
                estado: 'ACTIVO',
                documentos_legales: [],
                firma_jefe_canvas: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAASwAAACWCAYAAAB55928AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAALEgAACxIB0t1+/AAAABZ0RVh0Q3JlYXRpb24gVGltZQAwNi8xNy8yNlW7Y90AAB1JSURBVHja7Z15fFTVtf9/595ZJ5kks2eyTzIhISFACAKyioC7oIKtViu21urL',
                matriz_turnos: []
            },
            {
                cedula: 10102020,
                nombre: 'Juan Fernando Restrepo',
                rol: 'COLABORADOR',
                jefe_asignado_cedula: 9900,
                cargo: 'Analista de TI',
                area: 'Tecnología',
                fecha_nacimiento: '1992-03-24',
                contacto_emergencia: 'Claudia Restrepo - 3105556677',
                fecha_ingreso: '2021-02-01',
                tipo_contrato: 'Indefinido',
                salario_base: 3200000,
                estado: 'ACTIVO',
                documentos_legales: [],
                matriz_turnos: [
                    { codigo_horario: 'DIU', dias_semana_asignados: ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes'] }
                ]
            },
            {
                cedula: 10203030,
                nombre: 'Diana Carolina Gomez',
                rol: 'COLABORADOR',
                jefe_asignado_cedula: 9900,
                cargo: 'Analista de Calidad',
                area: 'Gestión Humana',
                fecha_nacimiento: '1995-11-05',
                contacto_emergencia: 'Andrés Gómez - 3217766554',
                fecha_ingreso: '2023-08-16',
                tipo_contrato: 'Término Fijo',
                salario_base: 2800000,
                estado: 'ACTIVO',
                documentos_legales: [],
                matriz_turnos: [
                    { codigo_horario: 'DIU', dias_semana_asignados: ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes'] },
                    { codigo_horario: 'MED', dias_semana_asignados: ['Sabado'] }
                ]
            },
            {
                cedula: 10304040,
                nombre: 'Carlos Mario Bedoya',
                rol: 'COLABORADOR',
                jefe_asignado_cedula: 9900,
                cargo: 'Operario de Planta',
                area: 'Producción',
                fecha_nacimiento: '1988-06-12',
                contacto_emergencia: 'Sandra Bedoya - 3149988776',
                fecha_ingreso: '2022-10-01',
                tipo_contrato: 'Obra/Labor',
                salario_base: 1800000,
                estado: 'ACTIVO',
                documentos_legales: [],
                matriz_turnos: [
                    { codigo_horario: 'TAR', dias_semana_asignados: ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes'] }
                ]
            },
            {
                cedula: 10405050,
                nombre: 'Laura Camila Ortiz',
                rol: 'COLABORADOR',
                jefe_asignado_cedula: 9900,
                cargo: 'Operario de Turno',
                area: 'Producción',
                fecha_nacimiento: '1998-09-30',
                contacto_emergencia: 'Martha Ortiz - 3004455667',
                fecha_ingreso: '2024-01-10',
                tipo_contrato: 'Obra/Labor',
                salario_base: 1800000,
                estado: 'ACTIVO',
                documentos_legales: [],
                matriz_turnos: [
                    { codigo_horario: 'NOC', dias_semana_asignados: ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Domingo'] }
                ]
            }
        ];
        localStorage.setItem(DB_KEY_COLABORADORES, JSON.stringify(colaboradoresDefecto));
    }

    // 3. Configuración del Sistema
    if (!localStorage.getItem(DB_KEY_CONFIG)) {
        const configDefecto = {
            zona_horaria: 'America/Bogota',
            formato_fecha: 'DD, MMMM, YYYY',
            formato_hora: 'HH:MM',
            tipografia: 'Poppins',
            tema: 'light',
            ips_autorizadas: ['192.168.1.1', '192.168.1.25', '186.28.150.12', '127.0.0.1', '::1'],
            ip_simulada: '192.168.1.25',
            admin_password: '123456',
            sesion_activa: { rol: 'ADMINISTRADOR', cedula: null } // Rol por defecto
        };
        localStorage.setItem(DB_KEY_CONFIG, JSON.stringify(configDefecto));
    }

    // 4. Registros de Tiempo por defecto (En blanco para pruebas)
    if (!localStorage.getItem(DB_KEY_REGISTROS)) {
        localStorage.setItem(DB_KEY_REGISTROS, JSON.stringify([]));
    }

    // 5. Solicitudes de Permisos y Vacaciones por defecto (En blanco para pruebas)
    if (!localStorage.getItem(DB_KEY_SOLICITUDES)) {
        localStorage.setItem(DB_KEY_SOLICITUDES, JSON.stringify([]));
    }

    // 6. Documentos Creados por defecto (En blanco para pruebas)
    if (!localStorage.getItem(DB_KEY_DOCUMENTOS)) {
        localStorage.setItem(DB_KEY_DOCUMENTOS, JSON.stringify([]));
    }

    // 7. Actas disciplinarias por defecto (En blanco para pruebas)
    if (!localStorage.getItem(DB_KEY_ACTAS)) {
        localStorage.setItem(DB_KEY_ACTAS, JSON.stringify([]));
    }

    // 8. Nómina quincenal/mensual
    if (!localStorage.getItem(DB_KEY_NOMINA)) {
        localStorage.setItem(DB_KEY_NOMINA, JSON.stringify([]));
    }

    // 9. Evaluaciones de desempeño
    if (!localStorage.getItem(DB_KEY_EVALUACIONES)) {
        localStorage.setItem(DB_KEY_EVALUACIONES, JSON.stringify([]));
    }

    // Forzar actualización de contraseña de administrador global
    const configRawLoc = localStorage.getItem(DB_KEY_CONFIG);
    if (configRawLoc) {
        try {
            const configObj = JSON.parse(configRawLoc);
            if (configObj && configObj.admin_password !== '123456') {
                configObj.admin_password = '123456';
                localStorage.setItem(DB_KEY_CONFIG, JSON.stringify(configObj));
            }
        } catch(e) {}
    }
}


// --- OPERACIONES DE COLABORADORES ---
function obtenerColaboradores() {
    const data = JSON.parse(localStorage.getItem(DB_KEY_COLABORADORES)) || [];
    return data.map(c => {
        if (c.nombre) c.nombre = window.escapeHTML(c.nombre);
        if (c.cargo) c.cargo = window.escapeHTML(c.cargo);
        if (c.area) c.area = window.escapeHTML(c.area);
        return c;
    });
}

function guardarColaborador(colaborador) {
    const colaboradores = obtenerColaboradores();
    const index = colaboradores.findIndex(c => c.cedula === parseInt(colaborador.cedula));
    
    if (index !== -1) {
        colaboradores[index] = colaborador;
    } else {
        colaboradores.push(colaborador);
    }
    localStorage.setItem(DB_KEY_COLABORADORES, JSON.stringify(colaboradores));
    return true;
}

function eliminarColaborador(cedula) {
    let colaboradores = obtenerColaboradores();
    colaboradores = colaboradores.filter(c => c.cedula !== parseInt(cedula));
    localStorage.setItem(DB_KEY_COLABORADORES, JSON.stringify(colaboradores));
    return true;
}

window.obtenerColaboradorPorCedula = function(cedula) {
    const colaboradores = obtenerColaboradores();
    return colaboradores.find(c => c.cedula === parseInt(cedula));
}

function actualizarCedulaColaborador(oldCedula, newCedula) {
    oldCedula = parseInt(oldCedula);
    newCedula = parseInt(newCedula);
    if (oldCedula === newCedula) return;

    // 1. Actualizar en Colaboradores
    const colaboradores = obtenerColaboradores();
    colaboradores.forEach(c => {
        if (c.cedula === oldCedula) {
            c.cedula = newCedula;
        }
        if (c.jefe_asignado_cedula === oldCedula) {
            c.jefe_asignado_cedula = newCedula;
        }
    });
    localStorage.setItem(DB_KEY_COLABORADORES, JSON.stringify(colaboradores));

    // 2. Actualizar en Registros
    const registros = obtenerRegistros();
    registros.forEach(r => {
        if (r.cedula_colaborador === oldCedula) {
            r.cedula_colaborador = newCedula;
        }
    });
    localStorage.setItem(DB_KEY_REGISTROS, JSON.stringify(registros));

    // 3. Actualizar en Solicitudes
    const solicitudes = obtenerSolicitudes();
    solicitudes.forEach(s => {
        if (s.cedula_colaborador === oldCedula) {
            s.cedula_colaborador = newCedula;
        }
    });
    localStorage.setItem(DB_KEY_SOLICITUDES, JSON.stringify(solicitudes));

    // 4. Actualizar en Documentos
    const documentos = obtenerDocumentos();
    documentos.forEach(d => {
        if (d.cedula_colaborador === oldCedula) {
            d.cedula_colaborador = newCedula;
        }
    });
    localStorage.setItem(DB_KEY_DOCUMENTOS, JSON.stringify(documentos));

    // 5. Actualizar en Actas
    const actas = obtenerActas();
    actas.forEach(a => {
        if (a.cedula_colaborador === oldCedula) {
            a.cedula_colaborador = newCedula;
        }
    });
    localStorage.setItem(DB_KEY_ACTAS, JSON.stringify(actas));

    // 6. Actualizar en Nómina
    const nominas = obtenerNominas();
    nominas.forEach(n => {
        if (n.cedula_colaborador === oldCedula) {
            n.cedula_colaborador = newCedula;
        }
    });
    localStorage.setItem(DB_KEY_NOMINA, JSON.stringify(nominas));

    // 7. Actualizar en Evaluaciones
    const evaluaciones = obtenerEvaluaciones();
    evaluaciones.forEach(e => {
        if (e.cedula_colaborador === oldCedula) {
            e.cedula_colaborador = newCedula;
        }
    });
    localStorage.setItem(DB_KEY_EVALUACIONES, JSON.stringify(evaluaciones));

    // 8. Actualizar en Config (Sesión activa)
    const config = obtenerConfiguracion();
    if (config.sesion_activa && config.sesion_activa.cedula === oldCedula) {
        config.sesion_activa.cedula = newCedula;
        guardarConfiguracion(config);
    }
}

// --- OPERACIONES DE HORARIOS ---
function obtenerHorarios() {
    return JSON.parse(localStorage.getItem(DB_KEY_HORARIOS)) || [];
}

function guardarHorario(horario) {
    const horarios = obtenerHorarios();
    const index = horarios.findIndex(h => h.codigo.toUpperCase() === horario.codigo.toUpperCase());
    
    if (index !== -1) {
        horarios[index] = horario;
    } else {
        horarios.push(horario);
    }
    localStorage.setItem(DB_KEY_HORARIOS, JSON.stringify(horarios));
    return true;
}

function eliminarHorario(codigo) {
    let horarios = obtenerHorarios();
    horarios = horarios.filter(h => h.codigo.toUpperCase() !== codigo.toUpperCase());
    localStorage.setItem(DB_KEY_HORARIOS, JSON.stringify(horarios));
    return true;
}

function obtenerHorarioPorCodigo(codigo) {
    if (!codigo) return null;
    const horarios = obtenerHorarios();
    return horarios.find(h => h.codigo.toUpperCase() === codigo.toUpperCase());
}

// --- OPERACIONES DE REGISTROS DE TIEMPO ---
function obtenerRegistros() {
    return JSON.parse(localStorage.getItem(DB_KEY_REGISTROS)) || [];
}

function guardarRegistro(registro) {
    const registros = obtenerRegistros();
    
    if (!registro.id_registro) {
        const maxId = registros.reduce((max, r) => r.id_registro > max ? r.id_registro : max, 0);
        registro.id_registro = maxId + 1;
        registros.push(registro);
    } else {
        const index = registros.findIndex(r => r.id_registro === parseInt(registro.id_registro));
        if (index !== -1) {
            registros[index] = registro;
        } else {
            registros.push(registro);
        }
    }
    localStorage.setItem(DB_KEY_REGISTROS, JSON.stringify(registros));
    return registro;
}

function eliminarRegistro(id_registro) {
    let registros = obtenerRegistros();
    registros = registros.filter(r => r.id_registro !== parseInt(id_registro));
    localStorage.setItem(DB_KEY_REGISTROS, JSON.stringify(registros));
    return true;
}

// --- CONFIGURACIÓN ---
function obtenerConfiguracion() {
    return JSON.parse(localStorage.getItem(DB_KEY_CONFIG)) || {};
}

function guardarConfiguracion(config) {
    if (config.sesion_activa) {
        // Blindar la sesión asegurando que no se inyecten roles falsos 
        // Si no es ADMINISTRADOR explícito, debe ser COLABORADOR con cédula válida
        if (config.sesion_activa.rol !== 'ADMINISTRADOR' && typeof config.sesion_activa.cedula !== 'number') {
            config.sesion_activa.rol = 'COLABORADOR';
        }
    }
    localStorage.setItem(DB_KEY_CONFIG, JSON.stringify(config));
    return true;
}

// --- OPERACIONES DE SOLICITUDES ---
function obtenerSolicitudes() {
    const data = JSON.parse(localStorage.getItem(DB_KEY_SOLICITUDES)) || [];
    return data.map(s => {
        if (s.observaciones) s.observaciones = window.escapeHTML(s.observaciones);
        if (s.otro_detalle) s.otro_detalle = window.escapeHTML(s.otro_detalle);
        return s;
    });
}

function guardarSolicitud(solicitud) {
    const solicitudes = obtenerSolicitudes();
    if (!solicitud.id_solicitud) {
        const maxId = solicitudes.reduce((max, s) => s.id_solicitud > max ? s.id_solicitud : max, 0);
        solicitud.id_solicitud = maxId + 1;
        solicitudes.push(solicitud);
    } else {
        const index = solicitudes.findIndex(s => s.id_solicitud === parseInt(solicitud.id_solicitud));
        if (index !== -1) {
            solicitudes[index] = solicitud;
        } else {
            solicitudes.push(solicitud);
        }
    }
    localStorage.setItem(DB_KEY_SOLICITUDES, JSON.stringify(solicitudes));
    return solicitud;
}

function eliminarSolicitud(id_solicitud) {
    let solicitudes = obtenerSolicitudes();
    solicitudes = solicitudes.filter(s => s.id_solicitud !== parseInt(id_solicitud));
    localStorage.setItem(DB_KEY_SOLICITUDES, JSON.stringify(solicitudes));
    return true;
}

// --- OPERACIONES DE DOCUMENTOS ---
function obtenerDocumentos() {
    return JSON.parse(localStorage.getItem(DB_KEY_DOCUMENTOS)) || [];
}

function guardarDocumento(documento) {
    const documentos = obtenerDocumentos();
    if (!documento.id_documento) {
        const maxId = documentos.reduce((max, d) => d.id_documento > max ? d.id_documento : max, 0);
        documento.id_documento = maxId > 0 ? maxId + 1 : 1001;
        documentos.push(documento);
    } else {
        const index = documentos.findIndex(d => d.id_documento === parseInt(documento.id_documento));
        if (index !== -1) {
            documentos[index] = documento;
        } else {
            documentos.push(documento);
        }
    }
    localStorage.setItem(DB_KEY_DOCUMENTOS, JSON.stringify(documentos));
    return documento;
}

function eliminarDocumento(id_documento) {
    let documentos = obtenerDocumentos();
    documentos = documentos.filter(d => d.id_documento !== parseInt(id_documento));
    localStorage.setItem(DB_KEY_DOCUMENTOS, JSON.stringify(documentos));
    return true;
}

// --- OPERACIONES DE ACTAS DISCIPLINARIAS ---
function obtenerActas() {
    const data = JSON.parse(localStorage.getItem(DB_KEY_ACTAS)) || [];
    return data.map(a => {
        if (a.descargos_colaborador) a.descargos_colaborador = window.escapeHTML(a.descargos_colaborador);
        if (a.decision) a.decision = window.escapeHTML(a.decision);
        return a;
    });
}

function guardarActa(acta) {
    const actas = obtenerActas();
    if (!acta.id_acta) {
        const maxId = actas.reduce((max, a) => a.id_acta > max ? a.id_acta : max, 0);
        acta.id_acta = maxId > 0 ? maxId + 1 : 1;
        actas.push(acta);
    } else {
        const index = actas.findIndex(a => a.id_acta === parseInt(acta.id_acta));
        if (index !== -1) {
            actas[index] = acta;
        } else {
            actas.push(acta);
        }
    }
    localStorage.setItem(DB_KEY_ACTAS, JSON.stringify(actas));
    return acta;
}

function eliminarActa(id_acta) {
    let actas = obtenerActas();
    actas = actas.filter(a => a.id_acta !== parseInt(id_acta));
    localStorage.setItem(DB_KEY_ACTAS, JSON.stringify(actas));
    return true;
}

// --- OPERACIONES DE NÓMINA ---
function obtenerNominas() {
    return JSON.parse(localStorage.getItem(DB_KEY_NOMINA)) || [];
}

function guardarNomina(nomina) {
    const nominas = obtenerNominas();
    if (!nomina.id_nomina) {
        const maxId = nominas.reduce((max, n) => n.id_nomina > max ? n.id_nomina : max, 0);
        nomina.id_nomina = maxId > 0 ? maxId + 1 : 1;
        nominas.push(nomina);
    } else {
        const index = nominas.findIndex(n => n.id_nomina === parseInt(nomina.id_nomina));
        if (index !== -1) {
            nominas[index] = nomina;
        } else {
            nominas.push(nomina);
        }
    }
    localStorage.setItem(DB_KEY_NOMINA, JSON.stringify(nominas));
    return nomina;
}

function eliminarNomina(id_nomina) {
    let nominas = obtenerNominas();
    nominas = nominas.filter(n => n.id_nomina !== parseInt(id_nomina));
    localStorage.setItem(DB_KEY_NOMINA, JSON.stringify(nominas));
    return true;
}

// --- OPERACIONES DE EVALUACIONES ---
function obtenerEvaluaciones() {
    const data = JSON.parse(localStorage.getItem(DB_KEY_EVALUACIONES)) || [];
    return data.map(e => {
        if (e.comentarios_finales) e.comentarios_finales = window.escapeHTML(e.comentarios_finales);
        return e;
    });
}

function guardarEvaluacion(evaluacion) {
    const evaluaciones = obtenerEvaluaciones();
    if (!evaluacion.id_evaluacion) {
        const maxId = evaluaciones.reduce((max, e) => e.id_evaluacion > max ? e.id_evaluacion : max, 0);
        evaluacion.id_evaluacion = maxId > 0 ? maxId + 1 : 1;
        evaluaciones.push(evaluacion);
    } else {
        const index = evaluaciones.findIndex(e => e.id_evaluacion === parseInt(evaluacion.id_evaluacion));
        if (index !== -1) {
            evaluaciones[index] = evaluacion;
        } else {
            evaluaciones.push(evaluacion);
        }
    }
    localStorage.setItem(DB_KEY_EVALUACIONES, JSON.stringify(evaluaciones));
    return evaluacion;
}

function obtenerEvaluacionPorId(id) {
    const evaluaciones = obtenerEvaluaciones();
    return evaluaciones.find(e => e.id_evaluacion === parseInt(id));
}

// --- UTILERÍAS DE FECHA Y HORAS ---

function horaAMinutos(horaStr) {
    if (!horaStr) return 0;
    const [hrs, mins] = horaStr.split(':').map(Number);
    return (hrs * 60) + mins;
}

function minutosAHorasDecimal(minutos) {
    return Math.round((minutos / 60) * 100) / 100;
}

function obtenerDiaSemana(fechaStr) {
    if (!fechaStr) return '';
    const date = new Date(fechaStr + 'T00:00:00');
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return dias[date.getDay()];
}

function normalizarDiaSemana(dia) {
    return dia.replace('Miércoles', 'Miercoles').replace('Sábado', 'Sabado');
}

// Obtener semana calendario ISO (Paso 1 del Algoritmo de Reincidencia)
function obtenerSemanaCalendario(fechaStr) {
    if (!fechaStr) return 0;
    const date = new Date(fechaStr + 'T00:00:00');
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    return Math.ceil((((d - yearStart) / 86400000) + 1)/7);
}

// Helper para obtener el turno de un colaborador para una fecha dada
function obtenerTurnoColaboradorPorFecha(colaborador, fechaStr) {
    if (!colaborador || !colaborador.matriz_turnos) return null;
    const diaSemana = obtenerDiaSemana(fechaStr);
    const diaNormalizado = normalizarDiaSemana(diaSemana);

    const asignacion = colaborador.matriz_turnos.find(t => 
        t.dias_semana_asignados.includes(diaSemana) || 
        t.dias_semana_asignados.includes(diaNormalizado)
    );

    return asignacion ? obtenerHorarioPorCodigo(asignacion.codigo_horario) : null;
}

// --- MOTOR DE CÁLCULO DE HORAS ---
/**
 * Calcula las horas laboradas, aplicando el umbral de 30 minutos para extras
 */
function calcularHorasLaboradas(horaIngreso, horaSalida, shiftInicio, shiftFin, registro = null) {
    let ing = horaAMinutos(horaIngreso);
    let sal = horaAMinutos(horaSalida);

    if (sal < ing) {
        sal += 1440;
    }

    const totalTrabajado = sal - ing;

    if (!shiftInicio || !shiftFin) {
        return {
            normales: 0,
            extras: minutosAHorasDecimal(totalTrabajado),
            permisos: 0
        };
    }

    let shIni = horaAMinutos(shiftInicio);
    let shFin = horaAMinutos(shiftFin);

    if (shFin < shIni) {
        shFin += 1440;
    }

    const shiftDuracion = shFin - shIni;

    // Calcular solapamiento
    let overlap = Math.max(0, Math.min(sal, shFin) - Math.max(ing, shIni));

    // Ajustes de medianoche
    if (shFin > 1440 && sal <= 1440) {
        const overlapDesplazado = Math.max(0, Math.min(sal, shFin - 1440) - Math.max(ing, shIni - 1440));
        overlap = Math.max(overlap, overlapDesplazado);
    } else if (sal > 1440 && shFin <= 1440) {
        const overlapDesplazado = Math.max(0, Math.min(sal - 1440, shFin) - Math.max(ing - 1440, shIni));
        overlap = Math.max(overlap, overlapDesplazado);
    }

    // --- REGLA 3.3: UMBRAL DE 30 MINUTOS PARA HORAS EXTRAS ---
    let extraMinutos = totalTrabajado - overlap;
    let extrasVal = 0;

    let diffSalida = sal - shFin;
    if (diffSalida >= 30) {
        extrasVal = Math.max(0, extraMinutos);
    } else {
        extrasVal = 0;
    }

    let permisos = Math.max(0, shiftDuracion - overlap);
    let normales = Math.max(0, totalTrabajado - (totalTrabajado - overlap) - permisos);

    // --- EXONERACIÓN POR PERMISO REMUNERADO ---
    if (registro && registro.tipo_permiso && registro.estado_permiso === 'APROBADO' && registro.tipo_permiso !== 'Otros') {
        // Se exonera el permiso, sumando ese tiempo como horas normales trabajadas
        normales += permisos;
        permisos = 0;
    }

    return {
        normales: minutosAHorasDecimal(normales),
        extras: minutosAHorasDecimal(extrasVal),
        permisos: minutosAHorasDecimal(permisos)
    };
}

inicializarDB();
