// js/app.js
// Controlador central de navegación SPA, reloj, tema e inicialización de la app

function initApp() {
    // Evitar inicialización doble en la misma carga de página
    if (document.body.getAttribute('data-app-initialized') === 'true') {
        // En una navegación de Turbo, el body cambia, así que esto se reseteará y se ejecutará de nuevo.
        return;
    }
    document.body.setAttribute('data-app-initialized', 'true');

    // 1. Reloj y Fecha Dinámicos (Bogotá/Medellín)
    iniciarRelojYFecha();

    // 2. Control de Tema Claro/Oscuro
    iniciarTema();

    // 4. Simulador de IP de Red
    iniciarSimuladorIP();

    // 6. Detección de Dispositivo
    identificarDispositivo();
    
    // 7. Auto-ocultar nav en scroll (Mobile)
    iniciarAutoOcultarNav();
}

document.addEventListener('turbo:load', initApp);
document.addEventListener('DOMContentLoaded', initApp);

// Si el DOM ya está listo (por caché o porque el script cargó tarde)
if (document.readyState === 'interactive' || document.readyState === 'complete') {
    initApp();
}

window.addEventListener('resize', identificarDispositivo);

// --- DETECCIÓN DE DISPOSITIVO ---
function identificarDispositivo() {
    const isMobile = window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    document.body.classList.add(isMobile ? 'device-mobile' : 'device-desktop');
    document.body.classList.remove(isMobile ? 'device-desktop' : 'device-mobile');
    document.body.setAttribute('data-device', isMobile ? 'mobile' : 'desktop');
    
    const labelEl = document.getElementById('device-label');
    const iconEl = document.getElementById('device-icon');
    
    if (labelEl && iconEl) {
        labelEl.textContent = isMobile ? 'Móvil' : 'Computador';
        labelEl.style.color = isMobile ? 'var(--accent)' : 'var(--success)';
        
        if (isMobile) {
            iconEl.innerHTML = `<svg style="width: 14px; height: 14px; color: var(--accent); opacity: 0.9;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>`;
        } else {
            iconEl.innerHTML = `<svg style="width: 14px; height: 14px; color: var(--success); opacity: 0.9;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>`;
        }
    }
}

// --- RELOJ Y FECHA DINÁMICOS ---
function iniciarRelojYFecha() {
    const clockEl = document.getElementById('live-clock');
    const dateEl = document.getElementById('live-date');

    function actualizarTiempo() {
        const ahora = new Date();

        // Formatear hora para America/Bogota (Medellín, Colombia)
        const opcionesHora = {
            timeZone: 'America/Bogota',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        };
        const horaStr = ahora.toLocaleTimeString('es-CO', opcionesHora);
        if (clockEl) clockEl.textContent = horaStr;

        // Formatear fecha: "Día, mes, año" -> ej. "16, junio, 2026"
        const opcionesFecha = {
            timeZone: 'America/Bogota',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        };
        
        // Formatear usando locale es-CO
        const fechaStr = ahora.toLocaleDateString('es-CO', opcionesFecha);
        const partesFecha = fechaStr.split(' de ');
        // partesFecha[0] = día, partesFecha[1] = mes, partesFecha[2] = año
        if (dateEl && partesFecha.length >= 3) {
            const dia = partesFecha[0];
            const mes = partesFecha[1];
            const anio = partesFecha[2];
            dateEl.textContent = `${dia} ${mes} ${anio}`;
        } else if (dateEl) {
            // Respuesto en caso de formato alterno (fallback seguro)
            dateEl.textContent = fechaStr.replace(/ de /g, ' ');
        }
    }

    actualizarTiempo();
    setInterval(actualizarTiempo, 1000);
}

// --- CONTROL DE TEMA CLARO/OSCURO ---
function iniciarTema() {
    const themeSwitch = document.getElementById('theme-toggle-switch');
    if (!themeSwitch) return;
    
    // Obtener preferencia de la base de datos
    const config = obtenerConfiguracion();
    let temaActual = config.tema || 'light';

    function aplicarTema(tema) {
        if (tema === 'dark') {
            document.body.classList.add('dark-mode');
            themeSwitch.checked = true;
        } else {
            document.body.classList.remove('dark-mode');
            themeSwitch.checked = false;
        }
        
        // Guardar en config
        config.tema = tema;
        guardarConfiguracion(config);
    }

    // Aplicar tema guardado inicialmente
    aplicarTema(temaActual);

    // Event listener
    themeSwitch.addEventListener('change', () => {
        const nuevoTema = themeSwitch.checked ? 'dark' : 'light';
        aplicarTema(nuevoTema);
        showToast(`Tema visual cambiado a ${nuevoTema === 'dark' ? 'Modo Oscuro' : 'Modo Claro'}`, 'info');
    });
}

// --- ENRUTADOR DE SPA ---
function iniciarEnrutador() {
    const viewMap = {
        '#dashboard': { id: 'view-dashboard', title: 'Dashboard Analítico', init: () => typeof inicializarDashboard === 'function' && inicializarDashboard() },
        '#creation': { id: 'view-creation', title: 'Gestión de Personal y Horarios', init: () => typeof inicializarCreation === 'function' && inicializarCreation() },
        '#admin': { id: 'view-admin', title: 'Consola de Control de Tiempos', init: () => typeof inicializarAdmin === 'function' && inicializarAdmin() },
        '#qr': { id: 'view-qr', title: 'Ingreso o Salida', init: () => typeof inicializarQR === 'function' && inicializarQR() },
        '#requests': { id: 'view-requests', title: 'Gestión de Permisos y Vacaciones', init: () => typeof inicializarRequests === 'function' && inicializarRequests() },
        '#documents': { id: 'view-documents', title: 'Documentos Creados', init: () => typeof inicializarDocuments === 'function' && inicializarDocuments() },
        '#disciplinary': { id: 'view-disciplinary', title: 'Gestión de Actas Disciplinarias', init: () => typeof inicializarDisciplinary === 'function' && inicializarDisciplinary() },
        '#payroll': { id: 'view-payroll', title: 'Colillas de Pago', init: () => typeof inicializarPayroll === 'function' && inicializarPayroll() },
        '#evaluations': { id: 'view-evaluations', title: 'Evaluación de Desempeño', init: () => typeof inicializarEvaluations === 'function' && inicializarEvaluations() },
        '#certificates': { id: 'view-certificates', title: 'Generación de Constancia Laboral', init: () => typeof inicializarCertificates === 'function' && inicializarCertificates() }
    };

    const menuItems = {
        '#dashboard': document.getElementById('menu-dashboard'),
        '#creation': document.getElementById('menu-creation'),
        '#admin': document.getElementById('menu-admin'),
        '#qr': document.getElementById('menu-qr'),
        '#requests': document.getElementById('menu-requests'),
        '#documents': document.getElementById('menu-documents'),
        '#disciplinary': document.getElementById('menu-disciplinary'),
        '#payroll': document.getElementById('menu-payroll'),
        '#evaluations': document.getElementById('menu-evaluations'),
        '#certificates': document.getElementById('menu-certificates')
    };

    const pageTitleDisplay = document.getElementById('page-title-display');

    function navegar() {
        let hash = window.location.hash || '#dashboard';
        
        // Control de acceso para colaboradores (RBAC)
        const config = obtenerConfiguracion();
        const sesion = config.sesion_activa || { rol: 'ADMINISTRADOR', cedula: null };
        if (sesion.rol === 'COLABORADOR') {
            if (hash !== '#qr' && hash !== '#requests' && hash !== '#disciplinary' && hash !== '#payroll' && hash !== '#evaluations') {
                hash = '#qr';
                window.location.hash = '#qr';
                return;
            }
        } else {
            // Si el hash no es válido, ir al dashboard
            if (!viewMap[hash]) {
                hash = '#dashboard';
            }
        }

        // Restringir el módulo de Constancias únicamente al ADMINISTRADOR GLOBAL
        if (hash === '#certificates' && (sesion.rol !== 'ADMINISTRADOR' || sesion.cedula !== null)) {
            hash = sesion.rol === 'COLABORADOR' ? '#qr' : '#dashboard';
            window.location.hash = hash;
            return;
        }

        // 1. Ocultar todas las páginas y quitar active del menú
        document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
        Object.values(menuItems).forEach(item => {
            if (item) item.classList.remove('active');
        });

        // 2. Activar la página seleccionada
        const targetView = viewMap[hash];
        const pageEl = document.getElementById(targetView.id);
        if (pageEl) pageEl.classList.add('active');

        const menuEl = menuItems[hash];
        if (menuEl) menuEl.classList.add('active');

        // 3. Cambiar título del header
        if (pageTitleDisplay) pageTitleDisplay.textContent = targetView.title;

        // 4. Detener cámara por defecto al cambiar de vista
        if (window.stopCamera) window.stopCamera();

        // 5. Inicializar módulo específico
        targetView.init();
        
        // 6. Iniciar cámara si es la vista QR
        if (hash === '#qr' && window.startCamera) {
            window.startCamera();
        }
    }

    // Escuchar cambios de hash
    window.addEventListener('hashchange', navegar);

    // Navegación inicial
    navegar();
}

// --- SIMULADOR DE IP DE RED ---
function iniciarSimuladorIP() {
    const ipInput = document.getElementById('simulated-ip-input');
    const badge = document.getElementById('ip-status-badge');
    const scanCapturedIp = document.getElementById('scan-captured-ip');
    const scanIpBadge = document.getElementById('scan-ip-badge');

    function validarIP(ip) {
        const config = obtenerConfiguracion();
        const ipsAutorizadas = config.ips_autorizadas || [];
        const esValida = ipsAutorizadas.includes(ip);

        // Actualizar header badge
        if (badge) {
            if (esValida) {
                badge.className = 'badge badge-success';
                badge.textContent = 'Autorizada';
            } else {
                badge.className = 'badge badge-danger';
                badge.textContent = 'No Autorizada';
            }
        }

        // Actualizar simulador QR (si el DOM existe)
        if (scanCapturedIp) scanCapturedIp.textContent = ip;
        if (scanIpBadge) {
            if (esValida) {
                scanIpBadge.className = 'badge badge-success';
                scanIpBadge.textContent = 'Válida (En Sede)';
            } else {
                scanIpBadge.className = 'badge badge-danger';
                scanIpBadge.textContent = 'Acceso Restringido (Fuera)';
            }
        }

        // Guardar IP simulada actual en la DB
        config.ip_simulada = ip;
        guardarConfiguracion(config);
    }

    if (ipInput) {
        // Cargar IP guardada
        const config = obtenerConfiguracion();
        ipInput.value = config.ip_simulada || '192.168.1.25';
        validarIP(ipInput.value);

        // Detectar cambios en la IP simulada
        ipInput.addEventListener('input', (e) => {
            validarIP(e.target.value.trim());
        });
    }
}

// --- UTILERÍA: NOTIFICACIONES FLOTANTES (TOAST) ---
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Icono según el tipo
    let svgIcon = '';
    if (type === 'success') {
        svgIcon = `<svg style="width:20px; height:20px; color:var(--success);" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
    } else if (type === 'danger') {
        svgIcon = `<svg style="width:20px; height:20px; color:var(--danger);" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`;
    } else {
        svgIcon = `<svg style="width:20px; height:20px; color:var(--accent);" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
    }

    toast.innerHTML = `
        ${svgIcon}
        <div>${message}</div>
    `;

    container.appendChild(toast);

    // Remover automáticamente después de 4 segundos
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s reverse ease-in';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// --- SIMULADOR DE SESIÓN Y ROLES (RBAC) ---
function iniciarSesionSimulada() {
    const btnSession = document.getElementById('btn-session-modal');
    const modalLogin = document.getElementById('modal-login-session');
    const btnCloseLogin = document.getElementById('btn-close-login');
    const btnSubmitLogin = document.getElementById('btn-submit-login');
    const userSelect = document.getElementById('login-user-select');
    const passwordContainer = document.getElementById('login-password-container');
    const passwordInput = document.getElementById('login-password-input');

    if (!btnSession || !modalLogin) return;

    function checkPasswordVisibility() {
        if (!passwordContainer) return;
        passwordContainer.style.display = 'block';
    }

    userSelect.addEventListener('change', checkPasswordVisibility);

    // Abrir modal
    btnSession.addEventListener('click', () => {
        poblarSelectorLogin();
        if (passwordInput) passwordInput.value = '';
        checkPasswordVisibility();
        modalLogin.style.display = 'flex';
    });

    // Cerrar modal
    if (btnCloseLogin) {
        btnCloseLogin.addEventListener('click', () => {
            modalLogin.style.display = 'none';
        });
    }

    // Procesar Login
    if (btnSubmitLogin) {
        btnSubmitLogin.addEventListener('click', () => {
            const val = userSelect.value;
            const config = obtenerConfiguracion();
            
            if (val === 'ADMINISTRADOR') {
                const pass = passwordInput ? passwordInput.value : '';
                if (pass !== config.admin_password) {
                    showToast('Contraseña de administrador incorrecta', 'danger');
                    if (passwordInput) passwordInput.focus();
                    return;
                }
                config.sesion_activa = { rol: 'ADMINISTRADOR', cedula: null };
            } else {
                const colab = obtenerColaboradorPorCedula(parseInt(val));
                if (colab) {
                    const pass = passwordInput ? passwordInput.value : '';
                    // Si el colaborador tiene contraseña asignada, validarla. Si no, permitir si está en blanco.
                    if (colab.contrasena && pass !== colab.contrasena) {
                        showToast('Contraseña incorrecta', 'danger');
                        if (passwordInput) passwordInput.focus();
                        return;
                    } else if (!colab.contrasena && pass !== '') {
                        showToast('Este perfil antiguo no tiene contraseña configurada. Ingrese con el campo vacío y edite el perfil.', 'warning');
                        return;
                    }
                    
                    if (colab.rol === 'JEFE_INMEDIATO') {
                        config.sesion_activa = { rol: 'ADMINISTRADOR', cedula: colab.cedula };
                    } else {
                        config.sesion_activa = { rol: 'COLABORADOR', cedula: colab.cedula };
                    }
                }
            }

            guardarConfiguracion(config);
            modalLogin.style.display = 'none';
            
            // Aplicar cambios en UI y vistas
            actualizarUIPorRol();
            actualizarSessionUserDisplay();
            
            const selectedText = userSelect.options[userSelect.selectedIndex].text;
            showToast(`Sesión iniciada como: ${selectedText}`, 'success');
        });
    }

    function poblarSelectorLogin() {
        const groupJefes = document.getElementById('login-group-jefes');
        const groupColabs = document.getElementById('login-group-colabs');
        if (!groupJefes || !groupColabs) return;

        const colaboradores = obtenerColaboradores();
        const jefes = colaboradores.filter(c => c.rol === 'JEFE_INMEDIATO');
        const colabs = colaboradores.filter(c => c.rol === 'COLABORADOR' || !c.rol);

        groupJefes.innerHTML = '';
        jefes.forEach(j => {
            groupJefes.innerHTML += `<option value="${j.cedula}">${j.nombre} (Cédula: ${j.cedula})</option>`;
        });

        groupColabs.innerHTML = '';
        colabs.forEach(c => {
            groupColabs.innerHTML += `<option value="${c.cedula}">${c.nombre} (Cédula: ${c.cedula})</option>`;
        });

        // Seleccionar valor actual en el select
        const config = obtenerConfiguracion();
        const sesion = config.sesion_activa || { rol: 'ADMINISTRADOR', cedula: null };
        if (sesion.rol === 'ADMINISTRADOR' && !sesion.cedula) {
            userSelect.value = 'ADMINISTRADOR';
        } else if (sesion.cedula) {
            userSelect.value = sesion.cedula.toString();
        }
    }

    // Inicializar visualización del botón
    actualizarSessionUserDisplay();
    actualizarUIPorRol();
}

function actualizarSessionUserDisplay() {
    const display = document.getElementById('session-user-display');
    if (!display) return;

    const config = obtenerConfiguracion();
    const sesion = config.sesion_activa || { rol: 'ADMINISTRADOR', cedula: null };

    if (sesion.rol === 'ADMINISTRADOR' && !sesion.cedula) {
        display.textContent = 'Administrador Global';
    } else if (sesion.cedula) {
        const colab = obtenerColaboradorPorCedula(sesion.cedula);
        if (colab) {
            display.textContent = colab.nombre;
        } else {
            display.textContent = 'Sesión Activa';
        }
    } else {
        display.textContent = 'Sesión Activa';
    }
}


function actualizarUIPorRol() {
    const config = obtenerConfiguracion();
    const sesion = config.sesion_activa || { rol: 'ADMINISTRADOR', cedula: null };
    
    const menuDashboard = document.getElementById('menu-dashboard');
    const menuCreation = document.getElementById('menu-creation');
    const menuAdmin = document.getElementById('menu-admin');
    const menuQr = document.getElementById('menu-qr');
    const menuRequests = document.getElementById('menu-requests');
    const menuDisciplinary = document.getElementById('menu-disciplinary');
    const menuDocuments = document.getElementById('menu-documents');
    const menuPayroll = document.getElementById('menu-payroll');
    const menuEvaluations = document.getElementById('menu-evaluations');
    const menuCertificates = document.getElementById('menu-certificates');

    if (sesion.rol === 'COLABORADOR') {
        if (menuDashboard) menuDashboard.style.display = 'none';
        if (menuCreation) menuCreation.style.display = 'none';
        if (menuAdmin) menuAdmin.style.display = 'none';
        if (menuDocuments) menuDocuments.style.display = 'none';
        if (menuQr) menuQr.style.display = 'block';
        if (menuRequests) menuRequests.style.display = 'block';
        if (menuDisciplinary) menuDisciplinary.style.display = 'block';
        if (menuPayroll) menuPayroll.style.display = 'block';
        if (menuEvaluations) menuEvaluations.style.display = 'block';
        if (menuCertificates) menuCertificates.style.display = 'none';

        // Ocultar paneles de admin, mostrar de colaborador
        const payrollAdmin = document.getElementById('payroll-admin-panel');
        const payrollColab = document.getElementById('payroll-colab-panel');
        const evalAdmin = document.getElementById('evaluations-admin-panel');
        const evalColab = document.getElementById('evaluations-colab-panel');
        if (payrollAdmin) payrollAdmin.style.display = 'none';
        if (payrollColab) payrollColab.style.display = 'block';
        if (evalAdmin) evalAdmin.style.display = 'none';
        if (evalColab) evalColab.style.display = 'block';

        const hash = window.location.hash || '#qr';
        if (hash !== '#qr' && hash !== '#requests' && hash !== '#disciplinary' && hash !== '#payroll' && hash !== '#evaluations') {
            window.location.hash = '#qr';
            return;
        }
    } else {
        if (menuDashboard) menuDashboard.style.display = 'block';
        if (menuCreation) menuCreation.style.display = 'block';
        if (menuAdmin) menuAdmin.style.display = 'block';
        if (menuQr) menuQr.style.display = 'block';
        if (menuRequests) menuRequests.style.display = 'block';
        if (menuDisciplinary) menuDisciplinary.style.display = 'block';
        if (menuDocuments) menuDocuments.style.display = 'block';
        if (menuPayroll) menuPayroll.style.display = 'block';
        if (menuEvaluations) menuEvaluations.style.display = 'block';
        if (menuCertificates) menuCertificates.style.display = (sesion.rol === 'ADMINISTRADOR' && !sesion.cedula) ? 'block' : 'none';

        // Mostrar paneles de admin, ocultar de colaborador
        const payrollAdmin = document.getElementById('payroll-admin-panel');
        const payrollColab = document.getElementById('payroll-colab-panel');
        const evalAdmin = document.getElementById('evaluations-admin-panel');
        const evalColab = document.getElementById('evaluations-colab-panel');
        if (payrollAdmin) payrollAdmin.style.display = 'block';
        if (payrollColab) payrollColab.style.display = 'none';
        if (evalAdmin) evalAdmin.style.display = 'block';
        if (evalColab) evalColab.style.display = 'none';
    }

    // Volver a cargar la vista actual para refrescar sus componentes según el rol
    const hash = window.location.hash || '#dashboard';
    if (hash === '#dashboard' && typeof inicializarDashboard === 'function') {
        inicializarDashboard();
    } else if (hash === '#creation' && typeof inicializarCreation === 'function') {
        inicializarCreation();
    } else if (hash === '#admin' && typeof inicializarAdmin === 'function') {
        inicializarAdmin();
    } else if (hash === '#qr' && typeof inicializarQR === 'function') {
        inicializarQR();
    } else if (hash === '#requests' && typeof inicializarRequests === 'function') {
        inicializarRequests();
    } else if (hash === '#documents' && typeof inicializarDocuments === 'function') {
        inicializarDocuments();
    } else if (hash === '#disciplinary' && typeof inicializarDisciplinary === 'function') {
        inicializarDisciplinary();
    } else if (hash === '#payroll' && typeof inicializarPayroll === 'function') {
        inicializarPayroll();
    } else if (hash === '#evaluations' && typeof inicializarEvaluations === 'function') {
        inicializarEvaluations();
    } else if (hash === '#certificates' && typeof inicializarCertificates === 'function') {
        inicializarCertificates();
    }
}

// --- AUTO OCULTAR NAV EN MÓVIL ---
function iniciarAutoOcultarNav() {
    let lastScrollY = window.scrollY;
    const asideEl = document.querySelector('aside');
    
    window.addEventListener('scroll', () => {
        if (window.innerWidth <= 992) { // Solo en modo móvil (o tablet donde aplica el nav top)
            if (window.scrollY > lastScrollY && window.scrollY > 60) {
                // Scroll Down
                asideEl.classList.add('nav-hidden');
            } else {
                // Scroll Up
                asideEl.classList.remove('nav-hidden');
            }
        } else {
            // Asegurarse de que no esté oculta en desktop
            asideEl.classList.remove('nav-hidden');
        }
        lastScrollY = window.scrollY;
    });
}



// Funcionalidad global de Django CSRF
window.getCookie = function(name) {
    var cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        var cookies = document.cookie.split(';');
        for (var i = 0; i < cookies.length; i++) {
            var cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
};

document.addEventListener('turbo:load', async () => {
    if (typeof window.obtenerDatosCompletos === 'function') {
        await window.obtenerDatosCompletos();
    }
    
    if (document.getElementById('filter-colaborador') && typeof inicializarDashboard === 'function') {
        inicializarDashboard();
    }
    if (document.getElementById('admin-filtro-estado') && typeof inicializarAdmin === 'function') {
        inicializarAdmin();
    }
    if (document.getElementById('form-gestion-colaborador') && typeof inicializarCreation === 'function') {
        inicializarCreation();
    }
    if (document.getElementById('btn-registrar-entrada') && typeof inicializarQR === 'function') {
        inicializarQR();
    }
    if (document.getElementById('btn-solicitar-permiso') && typeof inicializarRequests === 'function') {
        inicializarRequests();
    }
    if (document.getElementById('filter-fecha-inicio') && typeof inicializarDisciplinary === 'function') {
        inicializarDisciplinary();
    }
    if (document.getElementById('btn-generar-colilla') && typeof inicializarPayroll === 'function') {
        inicializarPayroll();
    }
    if (document.getElementById('filter-evaluaciones-colaborador') && typeof inicializarEvaluations === 'function') {
        inicializarEvaluations();
    }
    if (document.getElementById('btn-generar-certificado') && typeof inicializarCertificates === 'function') {
        inicializarCertificates();
    }
});
