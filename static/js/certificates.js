// js/certificates.js
// Controlador para el Módulo 10: Generador de Constancias Laborales

function inicializarCertificates() {
    const config = obtenerConfiguracion();
    const sesion = config.sesion_activa || { rol: 'ADMINISTRADOR', cedula: null };

    const inputCedula = document.getElementById('cert-cedula');
    const inputDirigido = document.getElementById('cert-dirigido');
    const selectSalario = document.getElementById('cert-incluir-salario');
    const formConstancia = document.getElementById('form-generar-constancia');

    const inputNominaCedula = document.getElementById('cert-nomina-cedula');
    const selectNominaMes = document.getElementById('cert-nomina-mes');
    const selectNominaAnio = document.getElementById('cert-nomina-anio');
    const formNomina = document.getElementById('form-descargar-nomina');

    // Limpiar campos por defecto
    if (inputDirigido) inputDirigido.value = '';
    if (selectSalario) selectSalario.value = 'si';

    // Si es un colaborador en sesión activa, pre-llenar su cédula
    if (inputCedula) {
        if (sesion.rol === 'COLABORADOR' && sesion.cedula) {
            inputCedula.value = sesion.cedula;
        } else {
            inputCedula.value = '';
        }
    }

    if (inputNominaCedula) {
        if (sesion.rol === 'COLABORADOR' && sesion.cedula) {
            inputNominaCedula.value = sesion.cedula;
        } else {
            inputNominaCedula.value = '';
        }
    }
    
    if (selectNominaMes) selectNominaMes.value = "0"; // Enero
    if (selectNominaAnio) selectNominaAnio.value = "2026";

    if (formConstancia) {
        formConstancia.onsubmit = function(e) {
            e.preventDefault();

            const cedula = parseInt(inputCedula.value.trim());
            const dirigidoA = inputDirigido.value.trim();
            const incluirSalario = selectSalario.value === 'si';

            if (isNaN(cedula)) {
                showToast('Por favor ingrese un número de cédula válido.', 'danger');
                return;
            }
            if (!dirigidoA) {
                showToast('Debe ingresar a quién va dirigida la constancia.', 'danger');
                return;
            }

            const colab = obtenerColaboradorPorCedula(cedula);
            if (!colab) {
                showToast(`No se encontró ningún colaborador registrado con la cédula ${cedula}.`, 'danger');
                return;
            }

            // Validar estado activo
            if (colab.estado === 'INACTIVO') {
                showToast('Generación bloqueada: El colaborador se encuentra INACTIVO.', 'danger');
                return;
            }

            generarPDFConstanciaLaboral(colab, dirigidoA, incluirSalario);
        };
    }

    if (formNomina) {
        formNomina.onsubmit = function(e) {
            e.preventDefault();

            const cedula = parseInt(inputNominaCedula.value.trim());
            const mes = parseInt(selectNominaMes.value);
            const anio = parseInt(selectNominaAnio.value);

            if (isNaN(cedula)) {
                showToast('Por favor ingrese un número de cédula válido.', 'danger');
                return;
            }

            const colab = obtenerColaboradorPorCedula(cedula);
            if (!colab) {
                showToast(`No se encontró ningún colaborador registrado con la cédula ${cedula}.`, 'danger');
                return;
            }

            const nominas = obtenerNominas();
            const payroll = nominas.find(n => n.cedula_colaborador === cedula && n.periodo_mes === mes && n.periodo_anio === anio);

            if (!payroll) {
                showToast('No se encontró comprobante de pago para el período seleccionado.', 'danger');
                return;
            }

            imprimirConstanciaNominaPdf(colab, payroll);
        };
    }
}

function generarPDFConstanciaLaboral(colab, dirigidoA, incluirSalario) {
    const meses = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];
    const ahora = new Date();
    const dia = String(ahora.getDate()).padStart(2, '0');
    const mes = meses[ahora.getMonth()];
    const anio = ahora.getFullYear();
    const lugarFechaExpedicion = `Medellín, ${dia} de ${mes} de ${anio}`;
    const sanitizar = (str) => String(str).replace(/[&<>'"]/g, match => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[match]));
    const dirSeguro = sanitizar(dirigidoA);

    const win = window.open('', '', 'width=900,height=800');
    if (win) {
        win.document.write(`
            <html>
                <head>
                    <title>Constancia Laboral - ${colab.nombre}</title>
                    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Great+Vibes&display=swap" rel="stylesheet">
                    <style>
                        @page {
                            size: letter;
                            margin: 2cm;
                        }
                        html, body {
                            width: 100%;
                            height: 100%;
                            margin: 0;
                            padding: 0;
                            font-family: 'Poppins', sans-serif;
                            font-size: 11pt;
                            line-height: 1.8;
                            color: #1e293b;
                            background-color: #ffffff;
                            box-sizing: border-box;
                        }
                        .page-container {
                            position: relative;
                            width: 100%;
                            height: 100%;
                            min-height: 100%;
                            box-sizing: border-box;
                            padding-bottom: 220px; /* Espacio reservado para firma y footer */
                        }
                        .header {
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            margin-bottom: 40px;
                            border-bottom: 1.5px solid #e2e8f0;
                            padding-bottom: 15px;
                        }
                        .logo {
                            max-height: 150px; /* Tamaño del logo triplicado */
                            width: auto;
                            display: block;
                        }
                        .date-expedicion {
                            font-size: 10.5pt;
                            color: #475569;
                            font-weight: 500;
                        }
                        .destinatario {
                            text-align: center;
                            font-weight: bold;
                            font-size: 11pt;
                            margin-top: 50px;
                            margin-bottom: 35px;
                            text-transform: uppercase;
                            color: #0f172a;
                            letter-spacing: 0.5px;
                        }
                        .content {
                            text-align: justify;
                            font-size: 11pt;
                            line-height: 2;
                            color: #334155;
                        }
                        .content p {
                            margin-bottom: 20px;
                        }
                        .signature-container {
                            position: absolute;
                            bottom: 80px; /* Justo arriba del footer */
                            left: 0;
                            page-break-inside: avoid;
                        }
                        .signature-line {
                            width: 250px;
                            border-top: 1px solid #94a3b8;
                            margin-top: 10px;
                            margin-bottom: 8px;
                        }
                        .footer {
                            position: absolute;
                            bottom: 0;
                            left: 0;
                            right: 0;
                            text-align: center;
                            font-size: 9.5pt;
                            color: #64748b;
                            border-top: 1.5px solid #e2e8f0;
                            padding-top: 15px;
                            line-height: 1.5;
                        }
                        @media print {
                            @page {
                                size: letter;
                                margin: 2cm;
                            }
                            body {
                                margin: 0;
                                padding: 0;
                            }
                            .page-container {
                                position: absolute;
                                height: 100%;
                                width: 100%;
                                box-sizing: border-box;
                            }
                            .footer {
                                position: absolute;
                                bottom: 0;
                                left: 0;
                                right: 0;
                            }
                            .signature-container {
                                position: absolute;
                                bottom: 80px;
                            }
                        }
                    </style>
                </head>
                <body>
                    <div class="page-container">
                        <div class="header">
                            <div style="display: flex; flex-direction: column; align-items: flex-start;">
                                <img src="images/logo.png" class="logo" alt="Logo">
                                <span style="font-size: 8.5pt; color: #475569; margin-top: 5px; font-weight: 500; letter-spacing: 0.5px;">NIT: 901818992-1</span>
                            </div>
                            <div class="date-expedicion">
                                ${lugarFechaExpedicion}
                            </div>
                        </div>

                        <div class="destinatario">
                            DIRIGIDO A: ${dirSeguro}
                        </div>

                        <div class="content">
                            <p>
                                Certificamos que el señor(a) <strong>${colab.nombre}</strong>, identificado(a) con Cédula de ciudadanía <strong>${colab.cedula}</strong>, labora en nuestra empresa desde el día <strong>${colab.fecha_ingreso || 'N/A'}</strong> desempeñando el cargo de <strong>${colab.cargo || 'N/A'}</strong> en el área de ${colab.area || 'N/A'}.
                            </p>
                            ${incluirSalario ? `
                            <p>
                                Actualmente devenga un salario básico mensual de <strong>$${colab.salario_base ? colab.salario_base.toLocaleString('es-CO') : '0'}</strong> (pesos colombianos).
                            </p>
                            ` : ''}
                            <p>
                                La presente certificación se expide a solicitud de ${dirSeguro} en Medellín el ${dia} de ${mes} de ${anio}.
                            </p>
                        </div>

                        <div class="signature-container">
                            <p style="margin-bottom: 5px;">Atentamente, adjunto firma representante legal</p>
                            
                            <!-- Firma manuscrita digitalizada de Melissa Lancheros -->
                            <img src="images/firma_melissa.png" style="max-height: 70px; display: block; margin-bottom: 2px; margin-left: 10px;" alt="Firma Representante Legal">
                            <div class="signature-line" style="margin-top: 2px;"></div>
                            <strong>Melissa Lancheros</strong><br>
                            <span style="color: #64748b;">Representante Legal</span><br>
                            <span style="color: #64748b;">Cel: +57 3005610774</span>
                        </div>

                        <div class="footer">
                            <strong>Tecnología y Movilidad SAS</strong><br>
                            Carrera 43 A # 18 Sur – 174 Local 252 – Medellin, Antioquia<br>
                            Tel: +57 3026606677 | www.tecnologiaymovilidad.com
                        </div>
                    </div>

                    <script>
                        window.onload = function() {
                            window.print();
                            setTimeout(function() { window.close(); }, 500);
                        };
                    </script>
                </body>
            </html>
        `);
        win.document.close();
    } else {
        showToast('El navegador bloqueó la ventana de visualización.', 'danger');
    }
}

function imprimirConstanciaNominaPdf(colab, payroll) {
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const periodoStr = `${meses[payroll.periodo_mes].toUpperCase()} ${payroll.periodo_anio}`;

    const rodamiento = payroll.auxilio_rodamiento || 0;
    const prima = payroll.prima_servicios || 0;
    const salud = payroll.fondo_salud || 0;
    const pension = payroll.fondo_pension || 0;
    const deducciones = payroll.deducciones_nomina || 0;
    const totalDeducido = (payroll.total_pagado - payroll.neto_pagar) || 0;
    const permisosDeducidos = Math.max(0, totalDeducido - salud - pension - deducciones);
    const extrasVal = Math.max(0, payroll.total_pagado - (payroll.salario_base + rodamiento + prima));

    const win = window.open('', '', 'width=900,height=800');
    if (win) {
        win.document.write(`
            <html>
                <head>
                    <title>Comprobante de Pago - ${colab.nombre}</title>
                    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
                    <style>
                        body {
                            font-family: 'Poppins', sans-serif;
                            padding: 40px;
                            color: #1e293b;
                            background: #ffffff;
                            line-height: 1.6;
                        }
                        .payslip-box {
                            border: 1px solid #cbd5e1;
                            border-radius: 8px;
                            padding: 30px;
                            max-width: 800px;
                            margin: 0 auto;
                        }
                        .header-title {
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            border-bottom: 2px solid #018C8C;
                            padding-bottom: 15px;
                            margin-bottom: 30px;
                        }
                        .header-title h2 {
                            color: #018C8C;
                            margin: 0;
                            font-weight: 700;
                            font-size: 1.4rem;
                        }
                        .info-grid {
                            display: grid;
                            grid-template-columns: 1fr 1fr;
                            gap: 15px;
                            margin-bottom: 30px;
                            font-size: 0.9rem;
                            background-color: #f8fafc;
                            padding: 15px;
                            border-radius: 6px;
                        }
                        table {
                            width: 100%;
                            border-collapse: collapse;
                            margin-bottom: 30px;
                            font-size: 0.9rem;
                        }
                        th, td {
                            padding: 10px;
                            text-align: left;
                            border-bottom: 1px solid #e2e8f0;
                        }
                        th {
                            background-color: #f1f5f9;
                            font-weight: 600;
                            font-size: 0.8rem;
                            text-transform: uppercase;
                            color: #475569;
                        }
                        .text-right {
                            text-align: right;
                        }
                        .total-row {
                            font-weight: 700;
                            background-color: #f8fafc;
                            border-top: 2px solid #cbd5e1;
                        }
                        .neto-box {
                            display: flex;
                            justify-content: flex-end;
                            align-items: center;
                            gap: 15px;
                            border-top: 2px dashed #cbd5e1;
                            padding-top: 15px;
                            margin-top: 20px;
                        }
                        .neto-lbl {
                            font-size: 1rem;
                            font-weight: 600;
                            color: #475569;
                        }
                        .neto-val {
                            font-size: 1.5rem;
                            font-weight: 800;
                            color: #018C8C;
                        }
                        .footer {
                            margin-top: 40px;
                            text-align: center;
                            font-size: 0.75rem;
                            color: #64748b;
                        }
                        @media print {
                            body { padding: 0; }
                            .payslip-box { border: none; padding: 0; }
                        }
                    </style>
                </head>
                <body>
                    <div class="payslip-box">
                        <div class="header-title">
                            <div>
                                <h2>TECNOLOGIA Y MOVILIDAD SAS</h2>
                                <span style="font-size:0.8rem; color:#64748b;">NIT: 901818992-1</span>
                            </div>
                            <div style="text-align: right;">
                                <strong style="color: #018C8C; font-size: 0.9rem;">COMPROBANTE DE PAGO</strong><br>
                                <span style="font-size: 0.8rem; color: #64748b;">PERIODO: ${periodoStr}</span>
                            </div>
                        </div>

                        <div class="info-grid">
                            <div>
                                <span style="color:#64748b;">Colaborador:</span> <strong>${colab.nombre}</strong><br>
                                <span style="color:#64748b;">Cédula:</span> <strong>${colab.cedula}</strong><br>
                                <span style="color:#64748b;">Cargo:</span> <span>${colab.cargo || 'N/A'}</span>
                            </div>
                            <div>
                                <span style="color:#64748b;">Área:</span> <span>${colab.area || 'N/A'}</span><br>
                                <span style="color:#64748b;">Tipo Contrato:</span> <span>${colab.tipo_contrato || 'Indefinido'}</span><br>
                                <span style="color:#64748b;">Salario Básico:</span> <strong>$${(colab.salario_base || 0).toLocaleString('es-CO')}</strong>
                            </div>
                        </div>

                        <table>
                            <thead>
                                <tr>
                                    <th>Concepto / Horas</th>
                                    <th class="text-right">Devengado</th>
                                    <th class="text-right">Deducciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>Sueldo Básico Ordinario</td>
                                    <td class="text-right">$${(payroll.salario_base || colab.salario_base || 0).toLocaleString('es-CO')}</td>
                                    <td class="text-right">-</td>
                                </tr>
                                <tr>
                                    <td>Horas Extras Reportadas</td>
                                    <td class="text-right">${payroll.horas_extras || 0}h / $${extrasVal.toLocaleString('es-CO')}</td>
                                    <td class="text-right">-</td>
                                </tr>
                                <tr>
                                    <td>Auxilio Rodamiento</td>
                                    <td class="text-right">${rodamiento > 0 ? `$${rodamiento.toLocaleString('es-CO')}` : '-'}</td>
                                    <td class="text-right">-</td>
                                </tr>
                                <tr>
                                    <td>Prima de Servicios</td>
                                    <td class="text-right">${prima > 0 ? `$${prima.toLocaleString('es-CO')}` : '-'}</td>
                                    <td class="text-right">-</td>
                                </tr>
                                <tr>
                                    <td>Descuento Horas de Permiso</td>
                                    <td class="text-right">-</td>
                                    <td class="text-right">${payroll.horas_permiso > 0 ? `${payroll.horas_permiso}h / -$${permisosDeducidos.toLocaleString('es-CO')}` : '-'}</td>
                                </tr>
                                <tr>
                                    <td>Fondo de Salud</td>
                                    <td class="text-right">-</td>
                                    <td class="text-right">${salud > 0 ? `-$${salud.toLocaleString('es-CO')}` : '-'}</td>
                                </tr>
                                <tr>
                                    <td>Fondo de Pensión</td>
                                    <td class="text-right">-</td>
                                    <td class="text-right">${pension > 0 ? `-$${pension.toLocaleString('es-CO')}` : '-'}</td>
                                </tr>
                                <tr>
                                    <td>Deducciones de Nómina</td>
                                    <td class="text-right">-</td>
                                    <td class="text-right">${deducciones > 0 ? `-$${deducciones.toLocaleString('es-CO')}` : '-'}</td>
                                </tr>
                                <tr class="total-row">
                                    <td>TOTAL GENERAL</td>
                                    <td class="text-right" style="color: #10b981;">$${payroll.total_pagado.toLocaleString('es-CO')}</td>
                                    <td class="text-right" style="color: #ef4444;">$${totalDeducido.toLocaleString('es-CO')}</td>
                                </tr>
                            </tbody>
                        </table>

                        <div class="neto-box">
                            <span class="neto-lbl">NETO A PAGAR:</span>
                            <span class="neto-val">$${payroll.neto_pagar.toLocaleString('es-CO')}</span>
                        </div>

                        <div class="footer">
                            Este documento es una constancia de nómina oficial emitida por Tecnologia y Movilidad SAS.
                        </div>
                    </div>

                    <script>
                        window.onload = function() {
                            window.print();
                            setTimeout(function() { window.close(); }, 500);
                        };
                    </script>
                </body>
            </html>
        `);
        win.document.close();
    } else {
        showToast('El navegador bloqueó la ventana de visualización.', 'danger');
    }
}
