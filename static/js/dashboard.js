// js/dashboard.js
// Lógica del Módulo de Dashboard Analítico con Indicadores, Gráficos (Chart.js), Consolidado Neto por Colaborador y Auditoría
Chart.register(ChartDataLabels);
// Lógica del Módulo de Dashboard Analítico con Indicadores, Gráficos (Chart.js), Consolidado Neto por Colaborador y Auditoría

var chartHorasExtrasInstance = null;
var chartVacacionesAcumuladasInstance = null;
var chartActasTotalesInstance = null;
var chartActasPendientesInstance = null;

function inicializarDashboard() {
    refrescarSelectFiltroColaboradores();
    setupListenersFiltros();
    actualizarDashboardCompleto();
}

function refrescarSelectFiltroColaboradores() {
    const select = document.getElementById('filter-colaborador');
    if (!select) return;

    const colaboradores = obtenerColaboradores();
    const valorSeleccionado = select.value || 'all';

    select.innerHTML = '<option value="all">Todos los Empleados</option>';
    colaboradores.forEach(c => {
        select.innerHTML += `<option value="${c.cedula}">${c.nombre} (${c.cedula})</option>`;
    });

    select.value = valorSeleccionado;
}

function setupListenersFiltros() {
    const filterYear = document.getElementById('filter-year');
    const filterMonth = document.getElementById('filter-month');
    const filterDay = document.getElementById('filter-day');
    const filterColab = document.getElementById('filter-colaborador');
    const btnReset = document.getElementById('btn-reset-filters');

    // Ocultar o mostrar el selector de colaborador en base al rol
    const config = obtenerConfiguracion();
    const sesion = config.sesion_activa || { rol: 'ADMINISTRADOR', cedula: null };
    const colabContainer = document.getElementById('filter-colaborador-container');
    if (colabContainer) {
        if (sesion.rol === 'COLABORADOR') {
            colabContainer.style.display = 'none';
        } else {
            colabContainer.style.display = 'block';
        }
    }

    const inputs = [filterYear, filterMonth, filterDay, filterColab];
    inputs.forEach(input => {
        if (input && !input.dataset.listener) {
            input.dataset.listener = 'true';
            input.addEventListener('change', () => {
                if (input === filterDay && filterDay.value) {
                    filterYear.disabled = true;
                    filterMonth.disabled = true;
                } else if (input === filterDay && !filterDay.value) {
                    filterYear.disabled = false;
                    filterMonth.disabled = false;
                }
                actualizarDashboardCompleto();
            });
        }
    });

    if (btnReset && !btnReset.dataset.listener) {
        btnReset.dataset.listener = 'true';
        btnReset.addEventListener('click', () => {
            if (filterYear) {
                filterYear.value = '2026';
                filterYear.disabled = false;
            }
            if (filterMonth) {
                filterMonth.value = '5'; // Junio (0-indexed)
                filterMonth.disabled = false;
            }
            if (filterDay) {
                filterDay.value = '';
            }
            if (filterColab) {
                filterColab.value = 'all';
            }
            actualizarDashboardCompleto();
            showToast('Filtros del dashboard reiniciados', 'info');
        });
    }
}

// --- OBTENER REGISTROS FILTRADOS ---
function obtenerRegistrosFiltrados() {
    const registros = obtenerRegistros();
    const yearVal = document.getElementById('filter-year').value;
    const monthVal = document.getElementById('filter-month').value;
    const dayVal = document.getElementById('filter-day').value;

    const config = obtenerConfiguracion();
    const sesion = config.sesion_activa || { rol: 'ADMINISTRADOR', cedula: null };
    
    let colabVal = 'all';
    if (sesion.rol === 'COLABORADOR') {
        colabVal = sesion.cedula.toString();
    } else {
        const filterColabEl = document.getElementById('filter-colaborador');
        if (filterColabEl) colabVal = filterColabEl.value;
    }

    return registros.filter(r => {
        const [rYear, rMonthStr, rDayStr] = r.fecha.split('-');
        const rMonth = parseInt(rMonthStr) - 1;

        if (colabVal !== 'all' && r.cedula_colaborador != colabVal) {
            return false;
        }

        if (dayVal) {
            return r.fecha === dayVal;
        }

        if (yearVal !== 'all' && rYear !== yearVal) {
            return false;
        }

        if (monthVal !== 'all' && rMonth !== parseInt(monthVal)) {
            return false;
        }

        return true;
    });
}

// --- ACTUALIZAR DASHBOARD COMPLETO ---
function actualizarDashboardCompleto() {
    const registrosFiltrados = obtenerRegistrosFiltrados();

    // 1. Métricas Básicas
    const metricas = calcularMetricasAcumuladas(registrosFiltrados);
    document.getElementById('metric-normal-hours').textContent = `${metricas.normales.toFixed(1)}h`;
    document.getElementById('metric-extra-hours').textContent = `${metricas.extras.toFixed(1)}h`;
    document.getElementById('metric-permisos-hours').textContent = `${metricas.permisos.toFixed(1)}h`;

    // 2. Métrica: Balance Neto (Extras - Permisos)
    const balanceNeto = metricas.extras - metricas.permisos;
    const lblBalance = document.getElementById('metric-balance-hours');
    const subtextBalance = document.getElementById('metric-balance-subtext');
    const cardBalance = document.getElementById('metric-balance-card');

    if (lblBalance && subtextBalance && cardBalance) {
        if (balanceNeto > 0) {
            lblBalance.textContent = `+${balanceNeto.toFixed(1)}h`;
            lblBalance.style.color = 'var(--success)';
            subtextBalance.textContent = 'Saldo Neto a Favor (Extras)';
            subtextBalance.style.color = 'var(--success)';
            cardBalance.style.borderLeftColor = 'var(--success)';
        } else if (balanceNeto < 0) {
            lblBalance.textContent = `${balanceNeto.toFixed(1)}h`;
            lblBalance.style.color = 'var(--danger)';
            subtextBalance.textContent = 'Saldo Neto en Contra (Permisos)';
            subtextBalance.style.color = 'var(--danger)';
            cardBalance.style.borderLeftColor = 'var(--danger)';
        } else {
            lblBalance.textContent = '0.0h';
            lblBalance.style.color = 'var(--text-primary)';
            subtextBalance.textContent = 'Sin Novedad / Al Día';
            subtextBalance.style.color = 'var(--text-secondary)';
            cardBalance.style.borderLeftColor = 'var(--accent)';
        }
    }

    // 3. Métrica: Llegadas Tarde (Contador)
    const retardosCount = registrosFiltrados.filter(r => r.estado_ingreso === 'RETARDO').length;
    const lblRetardos = document.getElementById('metric-retardos-count');
    if (lblRetardos) {
        lblRetardos.textContent = retardosCount.toString();
    }

    // 3.5. Métrica: Widget Disciplinario (Actas por período)
    const actas = typeof obtenerActas === 'function' ? obtenerActas() : [];
    const yearVal = document.getElementById('filter-year').value;
    const monthVal = document.getElementById('filter-month').value;
    const dayVal = document.getElementById('filter-day').value;

    const configDashboard = obtenerConfiguracion();
    const sesionDashboard = configDashboard.sesion_activa || { rol: 'ADMINISTRADOR', cedula: null };
    
    let colabValDashboard = 'all';
    if (sesionDashboard.rol === 'COLABORADOR') {
        colabValDashboard = sesionDashboard.cedula.toString();
    } else {
        const filterColabEl = document.getElementById('filter-colaborador');
        if (filterColabEl) colabValDashboard = filterColabEl.value;
    }

    const actasFiltradas = actas.filter(a => {
        const [aYear, aMonthStr, aDayStr] = a.fecha_emision.split('-');
        const aMonth = parseInt(aMonthStr) - 1;

        if (colabValDashboard !== 'all' && a.cedula_colaborador != colabValDashboard) {
            return false;
        }

        if (dayVal) {
            return a.fecha_emision === dayVal;
        }

        if (yearVal !== 'all' && aYear !== yearVal) {
            return false;
        }

        if (monthVal !== 'all' && aMonth !== parseInt(monthVal)) {
            return false;
        }

        return true;
    });

    const actasConcluidas = actasFiltradas.filter(a => a.estado_acta === 'CONCLUIDA').length;
    const actasPendientes = actasFiltradas.filter(a => a.estado_acta === 'PENDIENTE_FIRMA').length;

    const lblConcluidas = document.getElementById('metric-actas-concluidas');
    const lblPendientes = document.getElementById('metric-actas-pendientes');
    if (lblConcluidas) lblConcluidas.textContent = actasConcluidas.toString();
    if (lblPendientes) lblPendientes.textContent = actasPendientes.toString();

    // Mostrar barra de alerta para colaboradores con actas pendientes
    const dashboardAlert = document.getElementById('dashboard-disciplinary-alert');
    if (dashboardAlert) {
        if (sesionDashboard.rol === 'COLABORADOR') {
            const tienePendientesColab = actas.some(a => 
                a.cedula_colaborador === sesionDashboard.cedula && 
                a.estado_acta === 'PENDIENTE_FIRMA'
            );
            dashboardAlert.style.display = tienePendientesColab ? 'block' : 'none';
        } else {
            dashboardAlert.style.display = 'none';
        }
    }

    // Métrica: Desempeño Promedio
    const lblPerformance = document.getElementById('metric-performance-score');
    if (lblPerformance) {
        const evaluaciones = typeof obtenerEvaluaciones === 'function' ? obtenerEvaluaciones() : [];
        let evsFiltradas = [];

        if (sesionDashboard.rol === 'COLABORADOR') {
            evsFiltradas = evaluaciones.filter(e => e.cedula_colaborador === sesionDashboard.cedula);
        } else {
            const filterColabEl = document.getElementById('filter-colaborador');
            const colabSelected = filterColabEl ? filterColabEl.value : 'all';
            if (colabSelected !== 'all') {
                evsFiltradas = evaluaciones.filter(e => e.cedula_colaborador == colabSelected);
            } else {
                evsFiltradas = evaluaciones;
            }
        }
        
        const lblPerformanceDisplay = document.getElementById('metric-performance');
        if (lblPerformanceDisplay) {
            if (evsFiltradas.length > 0) {
                const sum = evsFiltradas.reduce((acc, ev) => acc + (ev.nota_final || 0), 0);
                const avg = sum / evsFiltradas.length;
                lblPerformanceDisplay.textContent = avg.toFixed(2);
            } else {
                lblPerformanceDisplay.textContent = 'N/A';
            }
        }
    }

    // 5. Gráficos
    const actasFiltradasForGraph = obtenerActasFiltradas();
    renderizarGraficoHorasExtras(registrosFiltrados);
    renderizarGraficoVacaciones();
    renderizarGraficoActasTotales(actasFiltradasForGraph);
    renderizarGraficoActasPendientes(actasFiltradasForGraph);
}

function calcularMetricasAcumuladas(registros) {
    let normales = 0;
    let extras = 0;
    let permisos = 0;

    registros.forEach(r => {
        normales += r.metricas.normales || 0;
        extras += r.metricas.extras || 0;
        permisos += r.metricas.permisos || 0;
    });

    return { normales, extras, permisos };
}

// --- PANEL DE AUDITORÍA DEL ADMINISTRADOR ---
function actualizarPanelAuditoriaAdmin() {
    const adminSection = document.getElementById('dashboard-admin-section');
    if (!adminSection) return;

    const config = obtenerConfiguracion();
    const sesion = config.sesion_activa || { rol: 'ADMINISTRADOR', cedula: null };

    if (sesion.rol !== 'ADMINISTRADOR') {
        adminSection.style.display = 'none';
        return;
    }

    adminSection.style.display = 'block';

    const colaboradores = obtenerColaboradores();
    const registros = obtenerRegistros();
    
    // Semana actual (hoy en Medellín)
    const hoy = obtenerFechaActualMedellin();
    const semanaActual = obtenerSemanaCalendario(hoy);
    
    let criticalCount = 0;
    const criticalListEl = document.getElementById('admin-critical-list');
    if (criticalListEl) criticalListEl.innerHTML = '';

    colaboradores.forEach(c => {
        // Contar retardos de este colab en la semana actual
        const retardosSemana = registros.filter(r => 
            r.cedula_colaborador === c.cedula && 
            r.semana_calendario === semanaActual && 
            r.estado_ingreso === 'RETARDO'
        );

        if (retardosSemana.length >= 3) {
            criticalCount++;
            if (criticalListEl) {
                const item = document.createElement('div');
                item.className = 'motivo-chip danger-border';
                item.innerHTML = `
                    <div>
                        <strong>${c.nombre}</strong> (Cédula: ${c.cedula})
                        <br><small style="color:var(--danger); font-weight:600;">⚠️ Acumula ${retardosSemana.length} retardos esta semana (Semana ${semanaActual}).</small>
                    </div>
                    <span class="badge badge-danger">Crítico</span>
                `;
                criticalListEl.appendChild(item);
            }
        }
    });

    const lblCriticalCount = document.getElementById('admin-critical-count');
    if (lblCriticalCount) lblCriticalCount.textContent = criticalCount.toString();

    if (criticalCount === 0 && criticalListEl) {
        criticalListEl.innerHTML = '<div style="font-size:0.8rem; color:var(--text-secondary); text-align:center; padding:10px;">Sin incidentes críticos esta semana.</div>';
    }

    // 2. Bitácora de Motivos (Justificaciones)
    const motivosListEl = document.getElementById('admin-motivos-list');
    if (motivosListEl) motivosListEl.innerHTML = '';

    // Filtrar registros del periodo actual que tengan desviación y observaciones no vacías
    const registrosFiltrados = obtenerRegistrosFiltrados();
    const registrosConMotivo = registrosFiltrados.filter(r => 
        r.observaciones && 
        r.observaciones !== 'Asistencia normal.' && 
        r.observaciones !== 'Registro automático vía QR.' && 
        r.observaciones !== 'Registro automático (Salida vía QR).' &&
        (r.metricas.extras > 0 || r.metricas.permisos > 0)
    );

    registrosConMotivo.forEach(r => {
        const c = obtenerColaboradorPorCedula(r.cedula_colaborador);
        const nombreColab = c ? c.nombre : `ID: ${r.cedula_colaborador}`;
        
        if (motivosListEl) {
            const item = document.createElement('div');
            let badgeText = 'Permiso';
            let badgeClass = 'badge-warning';
            if (r.metricas.extras > 0) {
                badgeText = 'Horas Extras';
                badgeClass = 'badge-success';
            }

            item.className = `motivo-chip`;
            if (r.metricas.extras > 0) {
                item.style.borderLeft = '4px solid var(--success)';
            } else {
                item.style.borderLeft = '4px solid var(--warning)';
            }

            item.innerHTML = `
                <div style="flex-grow:1; padding-right:10px; text-align: left;">
                    <strong>${nombreColab}</strong> <small style="color:var(--text-secondary);">${r.fecha}</small>
                    <div style="font-size:0.75rem; color:var(--text-primary); margin-top:4px; font-style:italic;">"${r.observaciones}"</div>
                </div>
                <span class="badge ${badgeClass}" style="font-size:0.6rem;">${badgeText}</span>
            `;
            motivosListEl.appendChild(item);
        }
    });

    if (registrosConMotivo.length === 0 && motivosListEl) {
        motivosListEl.innerHTML = '<div style="font-size:0.8rem; color:var(--text-secondary); text-align:center; padding:10px;">No hay justificaciones registradas en este periodo.</div>';
    }
}

// --- TABLA CONSOLIDADO NETO (EXTRAS - PERMISOS) ---
function actualizarTablaConsolidado(registrosFiltrados) {
    const tbody = document.getElementById('table-consolidado-body');
    if (!tbody) return;

    const config = obtenerConfiguracion();
    const sesion = config.sesion_activa || { rol: 'ADMINISTRADOR', cedula: null };

    let colaboradores = obtenerColaboradores();
    tbody.innerHTML = '';

    // Si es rol colaborador, solo ve su propio registro
    if (sesion.rol === 'COLABORADOR') {
        colaboradores = colaboradores.filter(c => c.cedula === sesion.cedula);
    }

    if (colaboradores.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-secondary);">No hay colaboradores creados en el sistema.</td></tr>';
        return;
    }

    // Optimización O(N): Pre-calcular agrupaciones para evitar O(N*M)
    const agrupadosPorColab = {};
    registrosFiltrados.forEach(log => {
        if (!agrupadosPorColab[log.cedula_colaborador]) {
            agrupadosPorColab[log.cedula_colaborador] = { extras: 0, permisos: 0 };
        }
        agrupadosPorColab[log.cedula_colaborador].extras += log.metricas.extras || 0;
        agrupadosPorColab[log.cedula_colaborador].permisos += log.metricas.permisos || 0;
    });

    colaboradores.forEach(c => {
        const stats = agrupadosPorColab[c.cedula] || { extras: 0, permisos: 0 };
        const totalExtras = stats.extras;
        const totalPermisos = stats.permisos;

        // Consolidar: Sumar horas extras y restar horas de permiso
        const balanceNeto = totalExtras - totalPermisos;

        let balanceClass = '';
        let balanceText = '';
        let estadoBadge = '';

        if (balanceNeto > 0) {
            balanceClass = 'style="font-weight:700; color:var(--success);"';
            balanceText = `+${balanceNeto.toFixed(2)}h`;
            estadoBadge = '<span class="badge badge-success">Extra a Liquidar</span>';
        } else if (balanceNeto < 0) {
            balanceClass = 'style="font-weight:700; color:var(--danger);"';
            balanceText = `${balanceNeto.toFixed(2)}h`;
            estadoBadge = '<span class="badge badge-danger">Permiso a Descontar</span>';
        } else {
            balanceClass = 'style="font-weight:600; color:var(--text-secondary);"';
            balanceText = '0.00h';
            estadoBadge = '<span class="badge" style="background-color:var(--bg-secondary); color:var(--text-secondary);">Al Día</span>';
        }

        // Obtener un resumen de los días asignados desde la matriz
        const resumenTurnos = [];
        if (c.matriz_turnos) {
            c.matriz_turnos.forEach(line => {
                const diasCortos = line.dias_semana_asignados.map(d => d.substring(0, 2)).join(',');
                resumenTurnos.push(`${line.codigo_horario}(${diasCortos})`);
            });
        }
        const turnosDisplay = resumenTurnos.length > 0 ? resumenTurnos.join(' | ') : 'Sin turnos';

        tbody.innerHTML += `
            <tr>
                <td style="font-weight:600;">${c.nombre} <br><small style="color:var(--text-secondary);">${c.cedula}</small></td>
                <td><small style="color:var(--text-secondary);">${turnosDisplay}</small></td>
                <td style="font-weight:600; color:var(--success);">${totalExtras.toFixed(2)}h</td>
                <td style="font-weight:600; color:var(--warning);">${totalPermisos.toFixed(2)}h</td>
                <td ${balanceClass}>${balanceText}</td>
                <td>${estadoBadge}</td>
            </tr>
        `;
    });
}

// --- RENDERIZADO DE GRÁFICOS ---
function renderizarGraficoDiario(registros) {
    const ctx = document.getElementById('chart-daily-hours');
    if (!ctx) return;

    const esOscuro = document.body.classList.contains('dark-mode');
    const colorTexto = esOscuro ? '#94a3b8' : '#64748b';
    const colorGrid = esOscuro ? '#334155' : '#e2e8f0';

    const datosPorDia = {};
    const monthVal = document.getElementById('filter-month').value;
    const yearVal = document.getElementById('filter-year').value;
    const dayVal = document.getElementById('filter-day').value;
    
    let diasList = [];

    if (dayVal) {
        diasList = [dayVal];
        datosPorDia[dayVal] = { normales: 0, extras: 0 };
    } else if (monthVal !== 'all' && yearVal !== 'all') {
        const totalDias = new Date(parseInt(yearVal), parseInt(monthVal) + 1, 0).getDate();
        const mesPad = String(parseInt(monthVal) + 1).padStart(2, '0');
        
        for (let d = 1; d <= totalDias; d++) {
            const diaPad = String(d).padStart(2, '0');
            const fechaStr = `${yearVal}-${mesPad}-${diaPad}`;
            diasList.push(fechaStr);
            datosPorDia[fechaStr] = { normales: 0, extras: 0 };
        }
    }

    registros.forEach(r => {
        if (!datosPorDia[r.fecha]) {
            datosPorDia[r.fecha] = { normales: 0, extras: 0 };
            if (!diasList.includes(r.fecha)) {
                diasList.push(r.fecha);
            }
        }
        datosPorDia[r.fecha].normales += r.metricas.normales || 0;
        datosPorDia[r.fecha].extras += r.metricas.extras || 0;
    });

    if (!dayVal && monthVal === 'all') {
        diasList.sort();
    }

    const normalesData = diasList.map(d => datosPorDia[d] ? datosPorDia[d].normales : 0);
    const extrasData = diasList.map(d => datosPorDia[d] ? datosPorDia[d].extras : 0);
    const labels = diasList.map(d => {
        const partes = d.split('-');
        return partes.length === 3 ? partes[2] : d;
    });

    if (chartDailyInstance) {
        chartDailyInstance.destroy();
    }

    chartDailyInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Horas Normales',
                    data: normalesData,
                    backgroundColor: esOscuro ? '#818cf8' : '#6366f1',
                    borderRadius: 4
                },
                {
                    label: 'Horas Extras',
                    data: extrasData,
                    backgroundColor: esOscuro ? '#34d399' : '#10b981',
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: colorTexto, font: { family: 'Poppins' } } },
                tooltip: { titleFont: { family: 'Poppins' }, bodyFont: { family: 'Poppins' } }
            },
            scales: {
                x: {
                    stacked: true,
                    grid: { display: false },
                    ticks: { color: colorTexto, font: { family: 'Poppins', size: 10 } }
                },
                y: {
                    stacked: true,
                    grid: { color: colorGrid },
                    ticks: { color: colorTexto, font: { family: 'Poppins' } }
                }
            }
        }
    });
}

function renderizarGraficoDistribucion(metricas) {
    const ctx = document.getElementById('chart-dist-hours');
    if (!ctx) return;

    const esOscuro = document.body.classList.contains('dark-mode');
    const colorTexto = esOscuro ? '#94a3b8' : '#64748b';

    if (chartDistInstance) {
        chartDistInstance.destroy();
    }

    const total = metricas.normales + metricas.extras + metricas.permisos;
    if (total === 0) {
        chartDistInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Sin Datos'],
                datasets: [{
                    data: [1],
                    backgroundColor: [esOscuro ? '#334155' : '#cbd5e1']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: colorTexto, font: { family: 'Poppins' } } }
                }
            }
        });
        return;
    }

    chartDistInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Normales', 'Extras', 'Permisos'],
            datasets: [{
                data: [metricas.normales, metricas.extras, metricas.permisos],
                backgroundColor: [
                    esOscuro ? '#818cf8' : '#6366f1',
                    esOscuro ? '#34d399' : '#10b981',
                    esOscuro ? '#fbbf24' : '#f59e0b'
                ],
                borderWidth: esOscuro ? 2 : 0,
                borderColor: esOscuro ? '#1e293b' : '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: colorTexto, font: { family: 'Poppins', size: 11 } }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const val = context.raw || 0;
                            const pct = ((val / total) * 100).toFixed(1);
                            return ` ${context.label}: ${val.toFixed(1)}h (${pct}%)`;
                        }
                    }
                }
            },
            cutout: '65%'
        }
    });
}

function renderizarGraficoRanking(registros) {
    const ctx = document.getElementById('chart-ranking-extras');
    if (!ctx) return;

    const esOscuro = document.body.classList.contains('dark-mode');
    const colorTexto = esOscuro ? '#94a3b8' : '#64748b';
    const colorGrid = esOscuro ? '#334155' : '#e2e8f0';

    const config = obtenerConfiguracion();
    const sesion = config.sesion_activa || { rol: 'ADMINISTRADOR', cedula: null };

    // Si es colaborador visualizador, no tiene sentido el ranking general, así que lo ocultamos o mostramos solo su récord
    const chartCard = ctx.closest('.glass-card');
    if (sesion.rol === 'COLABORADOR') {
        if (chartCard) chartCard.style.display = 'none';
        return;
    } else {
        if (chartCard) chartCard.style.display = 'block';
    }

    const acumExtras = {};
    registros.forEach(r => {
        const extras = r.metricas.extras || 0;
        if (extras > 0) {
            if (!acumExtras[r.cedula_colaborador]) {
                acumExtras[r.cedula_colaborador] = 0;
            }
            acumExtras[r.cedula_colaborador] += extras;
        }
    });

    const rankingArray = Object.keys(acumExtras).map(cedula => {
        const colab = obtenerColaboradorPorCedula(cedula);
        return {
            nombre: colab ? colab.nombre : `ID: ${cedula}`,
            extras: acumExtras[cedula]
        };
    });

    rankingArray.sort((a, b) => b.extras - a.extras);
    const topRanking = rankingArray.slice(0, 5);

    const labels = topRanking.map(item => item.nombre);
    const data = topRanking.map(item => item.extras);

    if (chartRankingInstance) {
        chartRankingInstance.destroy();
    }

    if (topRanking.length === 0) {
        chartRankingInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Sin horas extras acumuladas'],
                datasets: [{
                    data: [0],
                    backgroundColor: [esOscuro ? '#1e293b' : '#f1f5f9']
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { color: colorTexto } },
                    y: { ticks: { color: colorTexto } }
                }
            }
        });
        return;
    }

    chartRankingInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Horas Extras Acumuladas',
                data: data,
                backgroundColor: esOscuro ? 'rgba(52, 211, 153, 0.85)' : 'rgba(16, 185, 129, 0.85)',
                borderColor: esOscuro ? '#34d399' : '#10b981',
                borderWidth: 1,
                borderRadius: 4,
                barThickness: 20
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { titleFont: { family: 'Poppins' }, bodyFont: { family: 'Poppins' } }
            },
            scales: {
                x: {
                    grid: { color: colorGrid },
                    ticks: { color: colorTexto, font: { family: 'Poppins' } }
                },
                y: {
                    grid: { display: false },
                    ticks: { color: colorTexto, font: { family: 'Poppins', size: 11 } }
                }
            }
        }
    });
}

function renderizarGraficoVacacionesAdmin() {
    const ctxVacAdmin = document.getElementById('chart-vacaciones-admin');
    const dataVacAdminEl = document.getElementById('vacaciones-admin-data');
    if (!ctxVacAdmin || !dataVacAdminEl) return;

    let dataAdmin = JSON.parse(dataVacAdminEl.textContent);

    const filterColabEl = document.getElementById('filter-colaborador');
    if (filterColabEl && filterColabEl.value !== 'all') {
        dataAdmin = dataAdmin.filter(d => d.cedula == filterColabEl.value);
    }

    const esOscuro = document.body.classList.contains('dark-mode');
    const colorTexto = esOscuro ? '#94a3b8' : '#64748b';
    const colorGrid = esOscuro ? '#334155' : '#e2e8f0';

    const labels = dataAdmin.map(d => d.nombre);
    const dataDisfrutados = dataAdmin.map(d => d.usados);
    const dataDisponibles = dataAdmin.map(d => d.disponibles);

    if (chartVacAdminInstance) {
        chartVacAdminInstance.destroy();
    }

    chartVacAdminInstance = new Chart(ctxVacAdmin, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Días Disfrutados',
                    data: dataDisfrutados,
                    backgroundColor: esOscuro ? 'rgba(245, 158, 11, 0.85)' : '#f59e0b',
                    borderRadius: 4
                },
                {
                    label: 'Días Disponibles',
                    data: dataDisponibles,
                    backgroundColor: esOscuro ? 'rgba(16, 185, 129, 0.85)' : '#10b981',
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { stacked: true, grid: { color: colorGrid }, ticks: { color: colorTexto, font: { family: 'Poppins' } } },
                y: { stacked: true, grid: { color: colorGrid }, ticks: { color: colorTexto, font: { family: 'Poppins' } } }
            },
            plugins: {
                legend: { labels: { color: colorTexto, font: { family: 'Poppins' } } }
            }
        }
    });
}


function obtenerActasFiltradas() {
    const actas = window.DJANGO_ACTAS_DATA || [];
    
    const config = obtenerConfiguracion();
    const sesion = config.sesion_activa || { rol: 'ADMINISTRADOR', cedula: null };
    
    let colabVal = 'all';
    if (sesion.rol === 'COLABORADOR') {
        colabVal = sesion.cedula.toString();
    } else {
        const filterColabEl = document.getElementById('filter-colaborador');
        if (filterColabEl) colabVal = filterColabEl.value;
    }

    return actas.filter(a => {
        if (colabVal !== 'all' && a.cedula_colaborador != colabVal) {
            return false;
        }
        return true;
    });
}

function renderizarGraficoHorasExtras(registros) {
    const ctx = document.getElementById('chart-horas-extras');
    if (!ctx) return;
    
    const esOscuro = document.body.classList.contains('dark-mode');
    const colorTexto = esOscuro ? '#94a3b8' : '#64748b';
    const colorGrid = esOscuro ? '#334155' : '#e2e8f0';

    const agrupados = {};
    registros.forEach(r => {
        if (!agrupados[r.cedula_colaborador]) {
            agrupados[r.cedula_colaborador] = 0;
        }
        agrupados[r.cedula_colaborador] += r.metricas.extras || 0;
    });

    const colaboradores = window.DJANGO_COLABORADORES_DATA || [];
    const getNombre = (ced) => {
        const colab = colaboradores.find(c => c.cedula == ced);
        return colab ? colab.nombre : ced;
    };

    const dataArr = Object.keys(agrupados)
        .map(ced => ({ cedula: ced, nombre: getNombre(ced), extras: agrupados[ced] }))
        .filter(item => item.extras > 0)
        .sort((a, b) => b.extras - a.extras);
        
    const labels = dataArr.map(d => d.nombre);
    const extrasData = dataArr.map(d => d.extras);

    if (chartHorasExtrasInstance) {
        chartHorasExtrasInstance.destroy();
    }

    chartHorasExtrasInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Horas Extras',
                data: extrasData,
                backgroundColor: esOscuro ? 'rgba(99, 102, 241, 0.85)' : '#6366f1',
                borderRadius: 4
            }]
        },
        plugins: [ChartDataLabels],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { grid: { color: colorGrid }, ticks: { color: colorTexto, font: { family: 'Poppins' } } },
                y: { grid: { color: colorGrid }, ticks: { color: colorTexto, font: { family: 'Poppins' } } }
            },
            plugins: {
                legend: { labels: { color: colorTexto, font: { family: 'Poppins' } } },
                datalabels: {
                    color: '#ffffff',
                    font: { weight: 'bold', family: 'Poppins' },
                    anchor: 'center',
                    align: 'center',
                    formatter: function(value) {
                        return value > 0 ? value : '';
                    }
                }
            }
        }
    });
}

function renderizarGraficoVacaciones() {
    const ctx = document.getElementById('chart-vacaciones-acumuladas');
    const dataVacAdminEl = document.getElementById('vacaciones-admin-data');
    if (!ctx || !dataVacAdminEl) return;

    let dataAdmin = [];
    try {
        dataAdmin = JSON.parse(dataVacAdminEl.textContent);
    } catch(e) {}

    const filterColabEl = document.getElementById('filter-colaborador');
    if (filterColabEl && filterColabEl.value !== 'all') {
        dataAdmin = dataAdmin.filter(d => d.cedula == filterColabEl.value);
    }

    const esOscuro = document.body.classList.contains('dark-mode');
    const colorTexto = esOscuro ? '#94a3b8' : '#64748b';
    const colorGrid = esOscuro ? '#334155' : '#e2e8f0';

    const labels = dataAdmin.map(d => d.nombre);
    const dataGanados = dataAdmin.map(d => d.ganados);
    const dataDisfrutados = dataAdmin.map(d => d.usados);
    const dataDisponibles = dataAdmin.map(d => d.disponibles);

    if (chartVacacionesAcumuladasInstance) {
        chartVacacionesAcumuladasInstance.destroy();
    }

    chartVacacionesAcumuladasInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Vacaciones Pendientes',
                    data: dataDisponibles,
                    backgroundColor: esOscuro ? 'rgba(16, 185, 129, 0.85)' : '#10b981',
                    borderRadius: 4
                }
            ]
        },
        plugins: [ChartDataLabels],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { grid: { color: colorGrid }, ticks: { color: colorTexto, font: { family: 'Poppins' } } },
                y: { grid: { color: colorGrid }, ticks: { color: colorTexto, font: { family: 'Poppins' } } }
            },
            plugins: {
                legend: { labels: { color: colorTexto, font: { family: 'Poppins' } } },
                datalabels: {
                    color: '#ffffff',
                    font: { weight: 'bold', family: 'Poppins' },
                    anchor: 'center',
                    align: 'center',
                    formatter: function(value) {
                        return value > 0 ? value : '';
                    }
                }
            }
        }
    });
}

function renderizarGraficoActasTotales(actas) {
    const ctx = document.getElementById('chart-actas-totales');
    if (!ctx) return;
    
    const esOscuro = document.body.classList.contains('dark-mode');
    const colorTexto = esOscuro ? '#94a3b8' : '#64748b';
    const colorGrid = esOscuro ? '#334155' : '#e2e8f0';

    const agrupados = {};
    actas.forEach(a => {
        if (!agrupados[a.cedula_colaborador]) {
            agrupados[a.cedula_colaborador] = 0;
        }
        agrupados[a.cedula_colaborador]++;
    });

    const colaboradores = window.DJANGO_COLABORADORES_DATA || [];
    const getNombre = (ced) => {
        const colab = colaboradores.find(c => c.cedula == ced);
        return colab ? colab.nombre : ced;
    };

    const labels = Object.keys(agrupados).map(ced => getNombre(ced));
    const counts = Object.values(agrupados);

    if (chartActasTotalesInstance) {
        chartActasTotalesInstance.destroy();
    }

    chartActasTotalesInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total de Actas Disciplinarias',
                data: counts,
                backgroundColor: esOscuro ? 'rgba(239, 68, 68, 0.85)' : '#ef4444',
                borderRadius: 4
            }]
        },
        plugins: [ChartDataLabels],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { grid: { color: colorGrid }, ticks: { color: colorTexto, font: { family: 'Poppins' } } },
                y: { grid: { color: colorGrid }, ticks: { color: colorTexto, font: { family: 'Poppins' }, stepSize: 1 } }
            },
            plugins: {
                legend: { labels: { color: colorTexto, font: { family: 'Poppins' } } },
                datalabels: {
                    color: '#ffffff',
                    font: { weight: 'bold', family: 'Poppins' },
                    anchor: 'center',
                    align: 'center',
                    formatter: function(value) {
                        return value > 0 ? value : '';
                    }
                }
            }
        }
    });
}

function renderizarGraficoActasPendientes(actas) {
    const ctx = document.getElementById('chart-actas-pendientes');
    if (!ctx) return;

    const esOscuro = document.body.classList.contains('dark-mode');
    const colorTexto = esOscuro ? '#94a3b8' : '#64748b';
    const colorGrid = esOscuro ? '#334155' : '#e2e8f0';

    const agrupados = {};
    actas.forEach(a => {
        if (a.estado_acta === 'PENDIENTE_FIRMA') {
            if (!agrupados[a.cedula_colaborador]) {
                agrupados[a.cedula_colaborador] = 0;
            }
            agrupados[a.cedula_colaborador]++;
        }
    });

    const colaboradores = window.DJANGO_COLABORADORES_DATA || [];
    const getNombre = (ced) => {
        const colab = colaboradores.find(c => c.cedula == ced);
        return colab ? colab.nombre : ced;
    };

    const labels = Object.keys(agrupados).map(ced => getNombre(ced));
    const counts = Object.values(agrupados);

    if (chartActasPendientesInstance) {
        chartActasPendientesInstance.destroy();
    }

    chartActasPendientesInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Actas Pendientes por Firmar',
                data: counts,
                backgroundColor: esOscuro ? 'rgba(245, 158, 11, 0.85)' : '#f59e0b',
                borderRadius: 4
            }]
        },
        plugins: [ChartDataLabels],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { grid: { color: colorGrid }, ticks: { color: colorTexto, font: { family: 'Poppins' } } },
                y: { grid: { color: colorGrid }, ticks: { color: colorTexto, font: { family: 'Poppins' }, stepSize: 1 } }
            },
            plugins: {
                legend: { labels: { color: colorTexto, font: { family: 'Poppins' } } },
                datalabels: {
                    color: '#ffffff',
                    font: { weight: 'bold', family: 'Poppins' },
                    anchor: 'center',
                    align: 'center',
                    formatter: function(value) {
                        return value > 0 ? value : '';
                    }
                }
            }
        }
    });
}

// Auto-inicialización para soportar navegación asíncrona (HTMX)
setTimeout(() => {
    if (document.getElementById('filter-colaborador')) {
        if (typeof inicializarDashboard === 'function') {
            inicializarDashboard();
        }
    }
}, 150);



