// js/documents.js
// Módulo 6: Documentos Creados - Archivo histórico y consulta de solicitudes (Solo Administrador)

var activeDocumentFilters = {
    search: '',
    category: 'todos',
    state: 'todos'
};

function inicializarDocuments() {
    // Protección RBAC preventiva
    const config = obtenerConfiguracion();
    const sesion = config.sesion_activa || { rol: 'ADMINISTRADOR', cedula: null };
    
    if (sesion.rol !== 'ADMINISTRADOR') {
        window.location.hash = '#dashboard';
        return;
    }

    configurarFiltrosYEventosDoc();
    renderizarDocumentos();
}

// --- VINCULACIÓN DE EVENTOS PARA FILTROS Y MODAL ---
function configurarFiltrosYEventosDoc() {
    const searchInput = document.getElementById('doc-search-input');
    const categorySelect = document.getElementById('doc-filter-category');
    const stateSelect = document.getElementById('doc-filter-state');
    const btnClear = document.getElementById('btn-clear-doc-filters');
    
    const btnCloseModal = document.getElementById('btn-close-doc-detail');
    const btnPrint = document.getElementById('btn-print-doc');
    const modalOverlay = document.getElementById('modal-document-detail');

    const triggerRender = () => {
        activeDocumentFilters.search = searchInput ? searchInput.value.trim().toLowerCase() : '';
        activeDocumentFilters.category = categorySelect ? categorySelect.value : 'todos';
        activeDocumentFilters.state = stateSelect ? stateSelect.value : 'todos';
        renderizarDocumentos();
    };

    // Filtros de búsqueda
    if (searchInput && !searchInput.dataset.listener) {
        searchInput.dataset.listener = 'true';
        searchInput.addEventListener('input', triggerRender);
    }
    if (categorySelect && !categorySelect.dataset.listener) {
        categorySelect.dataset.listener = 'true';
        categorySelect.addEventListener('change', triggerRender);
    }
    if (stateSelect && !stateSelect.dataset.listener) {
        stateSelect.dataset.listener = 'true';
        stateSelect.addEventListener('change', triggerRender);
    }

    // Botón Limpiar
    if (btnClear && !btnClear.dataset.listener) {
        btnClear.dataset.listener = 'true';
        btnClear.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            if (categorySelect) categorySelect.value = 'todos';
            if (stateSelect) stateSelect.value = 'todos';
            
            activeDocumentFilters = { search: '', category: 'todos', state: 'todos' };
            renderizarDocumentos();
        });
    }

    // Controles de Modal
    if (btnCloseModal && !btnCloseModal.dataset.listener) {
        btnCloseModal.dataset.listener = 'true';
        btnCloseModal.addEventListener('click', () => {
            if (modalOverlay) modalOverlay.style.display = 'none';
        });
    }
    if (btnPrint && !btnPrint.dataset.listener) {
        btnPrint.dataset.listener = 'true';
        btnPrint.addEventListener('click', imprimirDocumentoRecibo);
    }

    // Cerrar modal al hacer clic en el fondo oscuro
    if (modalOverlay && !modalOverlay.dataset.listener) {
        modalOverlay.dataset.listener = 'true';
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                modalOverlay.style.display = 'none';
            }
        });
    }
}

// --- RENDERIZAR TABLA DE DOCUMENTOS ---
function renderizarDocumentos() {
    const tbody = document.getElementById('table-documents-body');
    if (!tbody) return;

    const documentos = obtenerDocumentos();
    
    // Aplicar filtros
    let filtrados = documentos.filter(doc => {
        // Filtro por texto (Cédula o Nombre)
        const matchSearch = !activeDocumentFilters.search || 
            String(doc.cedula_colaborador).includes(activeDocumentFilters.search) ||
            doc.nombre_colaborador.toLowerCase().includes(activeDocumentFilters.search);

        // Filtro por Categoría
        const matchCategory = activeDocumentFilters.category === 'todos' || doc.categoria === activeDocumentFilters.category;

        // Filtro por Estado
        const matchState = activeDocumentFilters.state === 'todos' || doc.estado === activeDocumentFilters.state;

        return matchSearch && matchCategory && matchState;
    });

    // Ordenar de más reciente a más antiguo
    filtrados.sort((a, b) => b.id_documento - a.id_documento);

    tbody.innerHTML = '';

    if (filtrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-secondary); font-size:0.85rem;">No se encontraron documentos que coincidan con la búsqueda.</td></tr>`;
        return;
    }

    filtrados.forEach(doc => {
        const codDoc = `DOC-${String(doc.id_documento).padStart(6, '0')}`;
        const categoriaLabel = doc.categoria === 'permiso' ? 'Permiso / Ausencia' : 'Vacaciones';
        
        let badgeEstado = '';
        if (doc.estado === 'PENDIENTE') {
            badgeEstado = `<span class="badge badge-warning">Pendiente</span>`;
        } else if (doc.estado === 'AUTORIZADA') {
            badgeEstado = `<span class="badge badge-success" style="background-color: var(--success-light); color: var(--success);">Autorizada</span>`;
        } else if (doc.estado === 'RECHAZADA') {
            badgeEstado = `<span class="badge badge-danger" style="background-color: var(--danger-light); color: var(--danger);">Rechazada</span>`;
        }

        tbody.innerHTML += `
            <tr>
                <td style="font-weight:700; color:var(--accent);">${codDoc}</td>
                <td>
                    <div style="font-weight:600;">${doc.nombre_colaborador}</div>
                    <div style="font-size:0.75rem; color:var(--text-secondary);">Cédula: ${doc.cedula_colaborador}</div>
                </td>
                <td>${doc.fecha_solicitud}</td>
                <td><span class="badge badge-info">${categoriaLabel}</span></td>
                <td style="font-weight:600;">${doc.total_calculado}</td>
                <td>${badgeEstado}</td>
                <td>
                    <div style="display:flex; gap:6px;">
                        <button class="btn btn-secondary btn-sm" onclick="verDetalleDocumento(${doc.id_documento})" style="padding: 6px 12px; font-size: 0.75rem;">Ver Recibo</button>
                        <button class="btn btn-secondary btn-sm" onclick="confirmarEliminarDocumento(${doc.id_documento})" style="padding: 6px 12px; font-size: 0.75rem; background-color: var(--danger); border-color: var(--danger); color: white;">Eliminar</button>
                    </div>
                </td>
            </tr>
        `;
    });
}

// --- VER DETALLE DEL DOCUMENTO (CARGAR MODAL RECIBO) ---
function verDetalleDocumento(idDoc) {
    const documentos = obtenerDocumentos();
    const doc = documentos.find(d => d.id_documento === parseInt(idDoc));

    if (!doc) {
        showToast('Documento no encontrado.', 'danger');
        return;
    }

    const modalOverlay = document.getElementById('modal-document-detail');
    if (!modalOverlay) return;

    // Configurar recibo
    const elTitle = document.getElementById('doc-receipt-title');
    const elId = document.getElementById('doc-receipt-id');
    const elEmision = document.getElementById('doc-receipt-emision');
    const elStatus = document.getElementById('doc-receipt-status');
    const elColabNombre = document.getElementById('doc-receipt-colab-nombre');
    const elColabCedula = document.getElementById('doc-receipt-colab-cedula');
    const elColabContacto = document.getElementById('doc-receipt-colab-contacto');
    const elCategory = document.getElementById('doc-receipt-category');
    
    const rowPermiso = document.getElementById('doc-receipt-row-permiso');
    const elPermisoDetail = document.getElementById('doc-receipt-permiso-detail');
    const elPeriod = document.getElementById('doc-receipt-period');
    const elTotal = document.getElementById('doc-receipt-total');
    const elObs = document.getElementById('doc-receipt-obs');

    // 1. Título y Código
    if (elTitle) {
        elTitle.textContent = doc.categoria === 'permiso' 
            ? 'CONSTANCIA DE SOLICITUD DE PERMISO' 
            : 'CONSTANCIA DE SOLICITUD DE VACACIONES';
    }
    if (elId) elId.textContent = `DOC-${String(doc.id_documento).padStart(6, '0')}`;
    if (elEmision) elEmision.textContent = doc.fecha_solicitud;
    
    // 2. Estado
    if (elStatus) {
        elStatus.textContent = doc.estado;
        if (doc.estado === 'PENDIENTE') {
            elStatus.style.color = '#f59e0b';
        } else if (doc.estado === 'AUTORIZADA') {
            elStatus.style.color = '#10b981';
        } else {
            elStatus.style.color = '#ef4444';
        }
    }

    // 3. Datos Colaborador
    if (elColabNombre) elColabNombre.textContent = doc.nombre_colaborador;
    if (elColabCedula) elColabCedula.textContent = doc.cedula_colaborador;
    if (elColabContacto) elColabContacto.textContent = doc.contacto;

    // 4. Detalle Solicitud
    const sanitizar = (str) => String(str).replace(/[&<>'"]/g, match => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[match]));

    if (elCategory) elCategory.textContent = doc.categoria === 'permiso' ? 'Permiso / Ausencia' : 'Vacaciones';

    if (doc.categoria === 'permiso') {
        if (rowPermiso) rowPermiso.style.display = 'table-row';
        if (elPermisoDetail) {
            elPermisoDetail.textContent = sanitizar(doc.tipo_permiso) + (doc.tipo_permiso === 'Otro' ? ' (' + sanitizar(doc.otro_detalle) + ')' : '');
        }
        if (elPeriod) {
            elPeriod.textContent = doc.cobertura_dia_completo ? 'Jornada Completa' : `${doc.hora_salida} a ${doc.hora_regreso}`;
        }
    } else {
        // Vacaciones
        if (rowPermiso) rowPermiso.style.display = 'none';
        if (elPeriod) {
            elPeriod.textContent = `Desde: ${doc.fecha_inicio_vacaciones} | Hasta: ${doc.fecha_fin_vacaciones} | Total días a disfrutar: ${doc.total_calculado}`;
        }
    }

    if (elTotal) elTotal.textContent = sanitizar(doc.total_calculado);
    if (elObs) elObs.textContent = doc.observaciones ? sanitizar(doc.observaciones) : '(Sin observaciones del colaborador)';

    // Mostrar modal
    modalOverlay.style.display = 'flex';
}

// --- IMPRIMIR DOCUMENTO (EN VENTANA INDEPENDIENTE LIMPIA) ---
function imprimirDocumentoRecibo() {
    const receiptContent = document.getElementById('document-receipt-content');
    if (!receiptContent) return;

    const receiptHtml = receiptContent.innerHTML;
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    
    if (!printWindow) {
        showToast('Por favor, permita las ventanas emergentes para imprimir.', 'warning');
        return;
    }

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Imprimir Constancia - Antigravity</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');
                body {
                    font-family: 'Courier New', Courier, monospace;
                    margin: 40px;
                    color: #000000;
                    background-color: #ffffff;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                }
                td {
                    padding: 4px 0;
                }
                @media print {
                    body {
                        margin: 0;
                    }
                    .no-print {
                        display: none;
                    }
                }
            </style>
        </head>
        <body onload="window.print(); window.close();">
            ${receiptHtml}
        </body>
        </html>
    `);
    printWindow.document.close();
}

// --- CONFIRMAR Y ELIMINAR DOCUMENTO ---
function confirmarEliminarDocumento(idDoc) {
    const documentos = obtenerDocumentos();
    const doc = documentos.find(d => d.id_documento === parseInt(idDoc));
    if (!doc) return;

    const codDoc = `DOC-${String(doc.id_documento).padStart(6, '0')}`;
    if (confirm(`¿Está seguro de que desea eliminar permanentemente el documento ${codDoc} (${doc.nombre_colaborador}) de los registros?`)) {
        // 1. Eliminar de la base de datos de documentos
        eliminarDocumento(doc.id_documento);

        // 2. Eliminar de la base de datos de solicitudes si corresponde
        if (doc.id_solicitud && typeof eliminarSolicitud === 'function') {
            eliminarSolicitud(doc.id_solicitud);
        }

        showToast(`Registro ${codDoc} eliminado exitosamente.`, 'success');

        // 3. Refrescar vistas locales
        renderizarDocumentos();

        // 4. Refrescar vistas de solicitudes (aprobaciones admin y tracking)
        if (typeof refrescarTablas === 'function') {
            refrescarTablas();
        }
    }
}
