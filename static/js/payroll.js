// js/payroll.js
// Controlador para el Módulo 8: Colillas de Pago (antes Nómina y Certificados)

// --- GESTIÓN DE INDEXEDDB PARA PDFs ---
var IDB_NAME = 'ColillasDB';
var IDB_VERSION = 1;
var IDB_STORE = 'pdfs';

var dbInstance = null;

function initColillasDB() {
    return new Promise((resolve, reject) => {
        if (dbInstance) return resolve(dbInstance);
        const req = indexedDB.open(IDB_NAME, IDB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(IDB_STORE)) {
                db.createObjectStore(IDB_STORE, { keyPath: 'id' });
            }
        };
        req.onsuccess = (e) => {
            dbInstance = e.target.result;
            resolve(dbInstance);
        };
        req.onerror = (e) => reject(e.target.error);
    });
}

async function saveColillaPDF(id, fileBlob) {
    const db = await initColillasDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        const store = tx.objectStore(IDB_STORE);
        store.put({ id: id, pdfBlob: fileBlob });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
    });
}

async function getColillaPDF(id) {
    const db = await initColillasDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readonly');
        const store = tx.objectStore(IDB_STORE);
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result ? req.result.pdfBlob : null);
        req.onerror = () => reject(tx.error);
    });
}

async function deleteColillaPDF(id) {
    const db = await initColillasDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        const store = tx.objectStore(IDB_STORE);
        store.delete(id);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
    });
}
// ----------------------------------------

function inicializarPayroll() {
    const config = obtenerConfiguracion();
    const sesion = config.sesion_activa || { rol: 'ADMINISTRADOR', cedula: null };

    if (sesion.rol === 'COLABORADOR') {
        // Vista Colaborador (Auto-servicio)
        inicializarPayrollColab(sesion.cedula);
    } else {
        // Vista Administrador / Jefe Inmediato
        inicializarPayrollAdmin();
    }
}

function renderizarHistorialColillasAdmin() {
    const historyBody = document.getElementById('table-payroll-history-body');
    if (!historyBody) return;

    const nominas = obtenerNominas();
    const colaboradores = obtenerColaboradores();

    historyBody.innerHTML = '';
    if (nominas.length === 0) {
        historyBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-secondary);">No hay colillas de pago cargadas.</td></tr>';
    } else {
        // Ordenar por ID descendente
        nominas.sort((a, b) => b.id_nomina - a.id_nomina).forEach(n => {
            const colab = colaboradores.find(c => c.cedula === n.cedula_colaborador);
            const colabNombre = colab ? colab.nombre : `Desconocido (${n.cedula_colaborador})`;
            const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
            const mesStr = meses[n.periodo_mes] || n.periodo_mes;

            historyBody.innerHTML += `
                <tr>
                    <td><strong>${n.cedula_colaborador}</strong></td>
                    <td>${colabNombre}</td>
                    <td>${mesStr}</td>
                    <td>${n.periodo_anio}</td>
                    <td><span class="badge badge-success">PDF ✅</span></td>
                    <td>
                        <button class="btn btn-secondary" style="font-size:0.75rem; padding:4px 8px;" onclick="verColillaAdmin('${n.id_nomina}')">Ver PDF</button>
                        <button class="btn btn-danger" style="font-size:0.75rem; padding:4px 8px;" onclick="eliminarColillaAction(${n.id_nomina})">Eliminar</button>
                    </td>
                </tr>
            `;
        });
    }
}

var pendingFilesToUpload = [];

function inicializarPayrollAdmin() {
    renderizarHistorialColillasAdmin();

    const dropZone = document.getElementById('payroll-drop-zone');
    const fileInput = document.getElementById('payroll-pdf-input');
    const fileCountLabel = document.getElementById('payroll-file-count');
    const btnImport = document.getElementById('btn-import-payroll-pdf');

    if (!dropZone || !fileInput) return;

    // Lógica Drag and Drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.backgroundColor = 'rgba(59, 130, 246, 0.15)';
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.style.backgroundColor = 'rgba(59, 130, 246, 0.05)';
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.backgroundColor = 'rgba(59, 130, 246, 0.05)';
        if (e.dataTransfer.files.length > 0) {
            handleFilesSelection(e.dataTransfer.files);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFilesSelection(e.target.files);
        }
    });

    function handleFilesSelection(files) {
        pendingFilesToUpload = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.pdf'));
        if (fileCountLabel) {
            fileCountLabel.textContent = `${pendingFilesToUpload.length} archivo(s) PDF válidos seleccionados`;
        }
        if (pendingFilesToUpload.length === 0) {
            showToast('No se seleccionaron archivos PDF.', 'warning');
        }
    }

    if (btnImport) {
        btnImport.onclick = async () => {
            if (pendingFilesToUpload.length === 0) {
                showToast('Por favor seleccione al menos un archivo PDF primero.', 'danger');
                return;
            }

            const colaboradores = obtenerColaboradores();
            let nominas = obtenerNominas();
            let exitosos = 0;
            let fallidos = 0;

            const regex = /^(\d+)_(\d+)_(\d+)\.pdf$/i;

            btnImport.disabled = true;
            btnImport.textContent = 'Procesando...';

            for (const file of pendingFilesToUpload) {
                const match = file.name.match(regex);
                if (!match) {
                    fallidos++;
                    console.warn('Nombre inválido:', file.name);
                    continue;
                }

                const cedula = parseInt(match[1]);
                const mes = parseInt(match[2]);
                const anio = parseInt(match[3]);

                const colab = colaboradores.find(c => c.cedula === cedula);
                if (!colab) {
                    fallidos++;
                    console.warn('Colaborador no encontrado:', cedula);
                    continue;
                }

                const nuevaId = Date.now() + Math.floor(Math.random() * 1000);

                const nuevaNomina = {
                    id_nomina: nuevaId,
                    cedula_colaborador: cedula,
                    periodo_mes: mes - 1, // Restamos 1 para que coincida con índices (0-11)
                    periodo_anio: anio,
                    archivo_nombre: file.name
                };

                try {
                    await saveColillaPDF(nuevaId.toString(), file);
                    nominas.push(nuevaNomina);
                    exitosos++;
                } catch (err) {
                    console.error('Error guardando en IndexedDB', err);
                    fallidos++;
                }
            }

            guardarNominas(nominas);
            pendingFilesToUpload = [];
            if (fileCountLabel) fileCountLabel.textContent = '0 archivos seleccionados';
            if (fileInput) fileInput.value = '';

            btnImport.disabled = false;
            btnImport.textContent = 'Procesar e Importar Colillas';
            
            showToast(`Carga masiva completada: ${exitosos} exitosos, ${fallidos} ignorados/fallidos.`, exitosos > 0 ? 'success' : 'warning');
            renderizarHistorialColillasAdmin();
        };
    }
}

async function verColillaAdmin(idStr) {
    const blob = await getColillaPDF(idStr);
    if (!blob) {
        showToast('No se encontró el archivo PDF en la base de datos.', 'danger');
        return;
    }
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
}

window.eliminarColillaAction = async function(id) {
    if (confirm('¿Está seguro de eliminar esta colilla de pago?')) {
        let nominas = obtenerNominas();
        nominas = nominas.filter(n => n.id_nomina !== id);
        guardarNominas(nominas);
        await deleteColillaPDF(id.toString());
        showToast('Colilla eliminada con éxito', 'success');
        renderizarHistorialColillasAdmin();
    }
};

function inicializarPayrollColab(cedula) {
    const colab = obtenerColaboradorPorCedula(cedula);
    if (!colab) return;

    const certBlockMsg = document.getElementById('payroll-cert-block-msg');
    const btnGenerateCert = document.getElementById('btn-generate-work-cert');
    const btnSearch = document.getElementById('btn-search-payslip');

    // Control de estado ACTIVO / INACTIVO para certificados
    if (colab.estado === 'INACTIVO') {
        if (certBlockMsg) certBlockMsg.style.display = 'block';
        if (btnGenerateCert) {
            btnGenerateCert.disabled = true;
            btnGenerateCert.style.opacity = '0.5';
            btnGenerateCert.style.cursor = 'not-allowed';
        }
    } else {
        if (certBlockMsg) certBlockMsg.style.display = 'none';
        if (btnGenerateCert) {
            btnGenerateCert.disabled = false;
            btnGenerateCert.style.opacity = '1';
            btnGenerateCert.style.cursor = 'pointer';
        }
    }

    if (btnSearch) {
        btnSearch.onclick = async function() {
            const year = parseInt(document.getElementById('payroll-search-year').value);
            const month = parseInt(document.getElementById('payroll-search-month').value);

            const nominas = obtenerNominas();
            const payroll = nominas.find(n => n.cedula_colaborador === colab.cedula && n.periodo_mes === month && n.periodo_anio === year);

            if (!payroll) {
                showToast('No se encontró ninguna colilla de pago cargada para el período seleccionado.', 'danger');
                return;
            }

            const blob = await getColillaPDF(payroll.id_nomina.toString());
            if (!blob) {
                showToast('El archivo PDF de la colilla no está disponible o está dañado.', 'danger');
                return;
            }

            showToast('Abriendo PDF de la colilla...', 'success');
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
        };
    }

    // Lógica para certificados laborales de los colaboradores
    if (btnGenerateCert) {
        btnGenerateCert.onclick = null;
        btnGenerateCert.onclick = function() {
            if (colab.estado === 'INACTIVO') {
                showToast('Descarga bloqueada: Colaborador INACTIVO', 'danger');
                return;
            }

            const inputDirigido = document.getElementById('payroll-colab-cert-dirigido');
            const selectSalario = document.getElementById('payroll-colab-cert-incluir-salario');

            const dirigidoA = inputDirigido ? inputDirigido.value.trim() : '';
            const incluirSalario = selectSalario ? selectSalario.value === 'si' : true;

            if (!dirigidoA) {
                showToast('Debe ingresar a quién va dirigida la certificación.', 'danger');
                return;
            }

            if (typeof generarPDFConstanciaLaboral === 'function') {
                generarPDFConstanciaLaboral(colab, dirigidoA, incluirSalario);
            } else {
                showToast('Error: El generador de constancias no está inicializado.', 'danger');
            }
        };
    }
}
