import json
from django.contrib.auth.hashers import check_password, make_password
from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from asistencia.models import RegistroAsistencia, SolicitudPermiso, Colaborador
from rrhh.models import ActaDisciplinaria, Evaluacion
from django.db.models import Sum
import holidays
from datetime import timedelta
from django.utils import timezone

from django.shortcuts import redirect
from functools import wraps
from django.shortcuts import redirect
from asistencia.models import Colaborador

def login_required_custom(view_func):
    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        cedula = request.session.get('cedula')
        if not cedula:
            return redirect('login')
        try:
            user = Colaborador.objects.get(cedula=cedula)
            if user.estado != 'ACTIVO':
                request.session.flush()
                return redirect('login')
        except Colaborador.DoesNotExist:
            request.session.flush()
            return redirect('login')
            
        return view_func(request, *args, **kwargs)
    return _wrapped_view

def admin_required_custom(view_func):
    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        cedula = request.session.get('cedula')
        if not cedula or request.session.get('rol') != 'ADMINISTRADOR':
            return redirect('login')
            
        try:
            user = Colaborador.objects.get(cedula=cedula)
            if user.estado != 'ACTIVO' or user.rol != 'ADMINISTRADOR':
                request.session.flush()
                return redirect('login')
        except Colaborador.DoesNotExist:
            request.session.flush()
            return redirect('login')
            
        return view_func(request, *args, **kwargs)
    return _wrapped_view

def logout_view(request):
    request.session.flush()
    return redirect('login')


@login_required_custom
def home(request):
    rol = request.session.get('rol')
    cedula = request.session.get('cedula')
    
    dias_ganados = 0
    dias_usados = 0
    dias_disponibles = 0

    if rol == 'COLABORADOR':
        try:
            colab = Colaborador.objects.get(cedula=cedula)
            total_colabs = 1
            registros = RegistroAsistencia.objects.select_related('colaborador').filter(colaborador=colab)
            actas_pendientes = ActaDisciplinaria.objects.filter(colaborador=colab).count()

            # Cálculo de vacaciones
            now = timezone.localtime(timezone.now()).date()
            dias_laborados = (now - colab.fecha_ingreso).days
            anios_laborados = dias_laborados / 365.25
            dias_ganados = max(0, int(anios_laborados * 15))
            
            vacaciones_aprobadas = SolicitudPermiso.objects.filter(
                colaborador=colab, 
                tipo__iexact='vacaciones', 
                estado='AUTORIZADA'
            )
            
            # Instanciar holidays una sola vez
            co_holidays = holidays.CO(years=range(2000, now.year + 2))
            
            for vac in vacaciones_aprobadas:
                current_date = vac.fecha_inicio
                while current_date <= vac.fecha_fin:
                    if current_date.weekday() != 6 and current_date not in co_holidays:
                        dias_usados += 1
                    current_date += timedelta(days=1)
                    
            dias_disponibles = max(0, dias_ganados - dias_usados)

        except Colaborador.DoesNotExist:
            total_colabs = 0
            registros = RegistroAsistencia.objects.none()
            actas_pendientes = 0
    else:
        total_colabs = Colaborador.objects.count()
        registros = RegistroAsistencia.objects.select_related('colaborador').all()
        actas_pendientes = ActaDisciplinaria.objects.count()
        
        # Calcular vacaciones para todos los colaboradores (Gráfico Admin)
        vacaciones_admin_data = []
        now = timezone.localtime(timezone.now()).date()
        todos_colabs = Colaborador.objects.all()
        todas_vacaciones = SolicitudPermiso.objects.filter(tipo__iexact='vacaciones', estado='AUTORIZADA')
        
        # Instanciar holidays.CO una sola vez para mejorar rendimiento (rango desde 2000 hasta el próximo año)
        rango_anios = range(2000, now.year + 2)
        co_hols_global = holidays.CO(years=rango_anios)
        
        for c in todos_colabs:
            d_laborados = (now - c.fecha_ingreso).days
            a_laborados = d_laborados / 365.25
            d_ganados = max(0, int(a_laborados * 15))
            
            d_usados = 0
            vac_c = todas_vacaciones.filter(colaborador=c)
            
            for v in vac_c:
                curr = v.fecha_inicio
                while curr <= v.fecha_fin:
                    if curr.weekday() != 6 and curr not in co_hols_global:
                        d_usados += 1
                    curr += timedelta(days=1)
            
            d_disp = max(0, d_ganados - d_usados)
            vacaciones_admin_data.append({
                'cedula': str(c.cedula),
                'nombre': c.nombre,
                'ganados': d_ganados,
                'disponibles': d_disp,
                'usados': d_usados
            })
            
        # Serializar colaboradores para el JS
        colabs_data = []
        for c in todos_colabs:
            colabs_data.append({
                'cedula': c.cedula,
                'nombre': c.nombre,
                'rol': c.rol,
                'cargo': 'No definido', # Field not present in model
                'estado': c.estado
            })

    # Preparar registros para el JS del dashboard
    registros_data = []
    for r in registros:
        try:
            semana_calendario = r.fecha.isocalendar()[1]
        except:
            semana_calendario = 0
            
        registros_data.append({
            'id_registro': r.id,
            'cedula_colaborador': r.colaborador.cedula,
            'fecha': str(r.fecha),
            'hora_ingreso': str(r.hora_ingreso) if r.hora_ingreso else '',
            'hora_salida': str(r.hora_salida) if r.hora_salida else '',
            'estado_ingreso': r.estado_ingreso,
            'metricas': {
                'normales': float(r.horas_normales),
                'extras': float(r.horas_extras),
                'permisos': 0.0
            },
            'observaciones': r.observaciones or '',
            'semana_calendario': semana_calendario
        })
    # Preparar actas
    actas_data = []
    for a in ActaDisciplinaria.objects.select_related('colaborador').all():
        actas_data.append({
            'id': a.id,
            'cedula_colaborador': a.colaborador.cedula,
            'fecha_emision': str(a.fecha),
            'estado_acta': 'CONCLUIDA' if a.archivo_adjunto else 'PENDIENTE_FIRMA',
            'gravedad': a.gravedad,
        })

    # Preparar evaluaciones
    eval_data = []
    for e in Evaluacion.objects.select_related('colaborador').all():
        eval_data.append({
            'id': e.id,
            'cedula_colaborador': e.colaborador.cedula,
            'fecha_evaluacion': str(e.fecha_evaluacion),
            'puntaje_global': float(e.puntaje),
            'estado_evaluacion': 'COMPLETADA'
        })

    horas_normales = registros.aggregate(Sum('horas_normales'))['horas_normales__sum'] or 0
    horas_extras = registros.aggregate(Sum('horas_extras'))['horas_extras__sum'] or 0
    retardos = registros.filter(estado_ingreso='RETARDO').count()

    context = {
        'total_colabs': total_colabs,
        'horas_normales': horas_normales,
        'horas_extras': horas_extras,
        'retardos': retardos,
        'actas_pendientes': actas_pendientes,
        'vacaciones_dias_ganados': dias_ganados,
        'vacaciones_dias_usados': dias_usados,
        'vacaciones_dias_disponibles': dias_disponibles,
    }
    return render(request, 'core/dashboard.html', context)

def login_view(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        user_type = data.get('user_type')
        cedula = data.get('cedula')
        password = data.get('password')

        if not cedula:
            return JsonResponse({'success': False, 'message': 'Cédula es requerida'})

        try:
            colab = Colaborador.objects.get(cedula=cedula)
            
            # Verificar rol y contraseña
            if colab.rol == user_type and colab.password and check_password(password, colab.password):
                if colab.estado != 'ACTIVO':
                    return JsonResponse({'success': False, 'message': 'Usuario inactivo'})
                
                request.session['rol'] = colab.rol
                request.session['cedula'] = cedula
                request.session['nombre'] = colab.nombre
                return JsonResponse({'success': True, 'message': f'Bienvenido {colab.nombre}'})
            else:
                return JsonResponse({'success': False, 'message': 'Credenciales incorrectas'})
        except Colaborador.DoesNotExist:
            return JsonResponse({'success': False, 'message': 'Credenciales incorrectas'})
                
    return render(request, 'core/login.html')

@admin_required_custom
def admin_config_view(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        accion = data.get('accion')
        
        if accion == 'crear_colaborador':
            cedula = data.get('cedula')
            nombre = data.get('nombre')
            rol = data.get('rol')
            estado = data.get('estado')
            numero_contacto = data.get('numero_contacto')
            fecha_ingreso = data.get('fecha_ingreso')
            
            cargo = data.get('cargo')
            area = data.get('area')
            fecha_nacimiento = data.get('fecha_nacimiento')
            tipo_contrato = data.get('tipo_contrato')
            salario_base_str = str(data.get('salario_base', '')).replace('.', '').strip()
            salario_base = int(salario_base_str) if salario_base_str.isdigit() else None
            contacto_emergencia = data.get('contacto_emergencia')
            jefe_asignado_id = data.get('jefe_asignado')
            
            try:
                if Colaborador.objects.filter(cedula=cedula).exists():
                    return JsonResponse({'success': False, 'message': f'La cédula {cedula} ya se encuentra registrada en el sistema.'})
                    
                colab_kwargs = {
                    'cedula': cedula,
                    'nombre': nombre,
                    'rol': rol,
                    'estado': estado if estado else 'ACTIVO',
                    'numero_contacto': numero_contacto,
                    'password': make_password(str(cedula)),
                    'cargo': cargo,
                    'area': area,
                    'tipo_contrato': tipo_contrato,
                    'salario_base': salario_base,
                    'contacto_emergencia': contacto_emergencia,
                }
                if fecha_ingreso:
                    colab_kwargs['fecha_ingreso'] = fecha_ingreso
                if fecha_nacimiento:
                    colab_kwargs['fecha_nacimiento'] = fecha_nacimiento
                if jefe_asignado_id and str(jefe_asignado_id).isdigit():
                    colab_kwargs['jefe_asignado_id'] = int(jefe_asignado_id)
                    
                c = Colaborador.objects.create(**colab_kwargs)
                return JsonResponse({'success': True, 'message': 'Colaborador creado exitosamente'})
            except Exception as e:
                return JsonResponse({'success': False, 'message': f'Error al crear colaborador: {str(e)}'})
                
        elif accion == 'editar_colaborador':
            cedula = data.get('cedula')
            nombre = data.get('nombre')
            rol = data.get('rol')
            estado = data.get('estado')
            nueva_pass = data.get('nueva_password')
            numero_contacto = data.get('numero_contacto')
            fecha_ingreso = data.get('fecha_ingreso')
            cargo = data.get('cargo')
            area = data.get('area')
            fecha_nacimiento = data.get('fecha_nacimiento')
            tipo_contrato = data.get('tipo_contrato')
            salario_base_str = str(data.get('salario_base', '')).replace('.', '').strip()
            salario_base = int(salario_base_str) if salario_base_str.isdigit() else None
            contacto_emergencia = data.get('contacto_emergencia')
            jefe_asignado_id = data.get('jefe_asignado')
            
            try:
                colab = Colaborador.objects.get(cedula=cedula)
                
                # Actualizar datos básicos
                colab.nombre = nombre
                colab.rol = rol
                colab.estado = estado
                colab.numero_contacto = numero_contacto
                if fecha_ingreso:
                    colab.fecha_ingreso = fecha_ingreso
                colab.cargo = cargo
                colab.area = area
                if fecha_nacimiento:
                    colab.fecha_nacimiento = fecha_nacimiento
                colab.tipo_contrato = tipo_contrato
                if salario_base is not None:
                    colab.salario_base = salario_base
                colab.contacto_emergencia = contacto_emergencia
                if jefe_asignado_id and str(jefe_asignado_id).isdigit():
                    colab.jefe_asignado_id = int(jefe_asignado_id)
                else:
                    colab.jefe_asignado = None
                
                # Actualizar contraseña si se envió
                if nueva_pass and nueva_pass.strip() != '':
                    current_rol = request.session.get('rol')
                    if colab.rol == 'ADMINISTRADOR' and current_rol != 'ADMINISTRADOR':
                        return JsonResponse({'success': False, 'message': 'No tienes permisos para cambiar la clave de otro Administrador'})
                    colab.password = make_password(nueva_pass)
                
                colab.save()
                return JsonResponse({'success': True, 'message': 'Colaborador actualizado exitosamente'})
            except Colaborador.DoesNotExist:
                return JsonResponse({'success': False, 'message': 'Colaborador no encontrado'})
            except Exception as e:
                return JsonResponse({'success': False, 'message': f'Error al actualizar: {str(e)}'})

        elif accion == 'borrar_colaborador':
            cedula = data.get('cedula')
            try:
                colab = Colaborador.objects.get(cedula=cedula)
                if colab.rol == 'ADMINISTRADOR' and request.session.get('rol') != 'ADMINISTRADOR':
                    return JsonResponse({'success': False, 'message': 'No tienes permisos para borrar a un Administrador'})
                # Delete related records if necessary, but Django CASCADE usually handles it
                colab.delete()
                return JsonResponse({'success': True, 'message': 'Colaborador eliminado exitosamente'})
            except Colaborador.DoesNotExist:
                return JsonResponse({'success': False, 'message': 'Colaborador no encontrado'})
            except Exception as e:
                return JsonResponse({'success': False, 'message': f'Error al eliminar: {str(e)}'})
                
    colaboradores = Colaborador.objects.all()
    return render(request, 'core/admin_config.html', {'colaboradores': colaboradores})


@login_required_custom
def global_data_api(request):
    import json
    from django.http import JsonResponse
    from django.utils import timezone
    from asistencia.models import RegistroAsistencia, SolicitudPermiso, Colaborador
    from rrhh.models import ActaDisciplinaria, Evaluacion
    
    rol = request.session.get('rol')
    cedula = request.session.get('cedula')
    
    # Filter based on role
    if rol == 'COLABORADOR':
        try:
            colab = Colaborador.objects.get(cedula=cedula)
            todos_colabs = [colab]
            registros = RegistroAsistencia.objects.select_related('colaborador').filter(colaborador=colab).order_by('-fecha', '-id')
            todas_vacaciones = SolicitudPermiso.objects.select_related('colaborador').filter(colaborador=colab, tipo__iexact='vacaciones', estado='AUTORIZADA')
            actas = ActaDisciplinaria.objects.select_related('colaborador').filter(colaborador=colab)
            evaluaciones = Evaluacion.objects.select_related('colaborador').filter(colaborador=colab)
        except Colaborador.DoesNotExist:
            todos_colabs = []
            registros = []
            todas_vacaciones = []
            actas = []
            evaluaciones = []
    else:
        todos_colabs = Colaborador.objects.all()
        registros = RegistroAsistencia.objects.select_related('colaborador').all().order_by('-fecha', '-id')
        todas_vacaciones = SolicitudPermiso.objects.select_related('colaborador').filter(tipo__iexact='vacaciones', estado='AUTORIZADA')
        actas = ActaDisciplinaria.objects.select_related('colaborador').all()
        evaluaciones = Evaluacion.objects.select_related('colaborador').all()
        
    # Colaboradores
    colabs_data = []
    for c in todos_colabs:
        colabs_data.append({
            'cedula': c.cedula,
            'nombre': c.nombre,
            'estado': c.estado,
            'cargo': c.cargo,
            'area': c.area,
        })
        
    # Vacaciones
    vacaciones_admin_data = []
    for c in todos_colabs:
        if c.estado == 'ACTIVO':
            now = timezone.localtime(timezone.now()).date()
            dias_laborados = (now - c.fecha_ingreso).days
            anios_laborados = dias_laborados / 365.25
            d_ganados = max(0, int(anios_laborados * 15))
            vacs = [v for v in todas_vacaciones if v.colaborador_id == c.id]
            d_usados = 0
            for vac in vacs:
                current_date = vac.fecha_inicio
                while current_date <= vac.fecha_fin:
                    if current_date.weekday() != 6:
                        d_usados += 1
                    current_date += timezone.timedelta(days=1)
            vacaciones_admin_data.append({
                'nombre': c.nombre,
                'cedula': c.cedula,
                'dias_ganados': d_ganados,
                'dias_usados': d_usados,
                'dias_disponibles': max(0, d_ganados - d_usados)
            })
            
    # Registros
    registros_data = []
    for r in registros:
        registros_data.append({
            'id': r.id,
            'cedula': r.colaborador.cedula,
            'nombre': r.colaborador.nombre,
            'fecha': r.fecha.strftime('%Y-%m-%d'),
            'hora_ingreso': r.hora_ingreso.strftime('%H:%M:%S') if r.hora_ingreso else None,
            'hora_salida': r.hora_salida.strftime('%H:%M:%S') if r.hora_salida else None,
            'horas_normales': float(r.horas_normales),
            'horas_extras': float(r.horas_extras),
            'semana_calendario': r.fecha.isocalendar()[1] if r.fecha else 0
        })
        
    # Actas
    actas_data = []
    for a in actas:
        actas_data.append({
            'id': a.id,
            'cedula': a.colaborador.cedula,
            'nombre': a.colaborador.nombre,
            'fecha': a.fecha.strftime('%Y-%m-%d'),
            'motivo': a.motivo,
            'gravedad': a.gravedad,
            'semana_relacionada': a.semana_relacionada,
            'anio_relacionado': a.anio_relacionado,
        })
        
    # Evaluaciones
    eval_data = []
    for e in evaluaciones:
        eval_data.append({
            'cedula': e.colaborador.cedula,
            'nombre': e.colaborador.nombre,
            'fecha_evaluacion': e.fecha_evaluacion.strftime('%Y-%m-%d'),
            'puntaje': e.puntaje,
            'observaciones': e.observaciones,
            'estado_evaluacion': 'COMPLETADA'
        })
        
    config_data = {
        'sesion_activa': {
            'rol': rol,
            'cedula': cedula
        }
    }
        
    # Permisos
    permisos = SolicitudPermiso.objects.select_related('colaborador').all()
    permisos_data = []
    for p in permisos:
        permisos_data.append({
            'id': p.id,
            'cedula': p.colaborador.cedula,
            'nombre': p.colaborador.nombre,
            'tipo': p.tipo,
            'fecha_inicio': p.fecha_inicio.strftime('%Y-%m-%d'),
            'fecha_fin': p.fecha_fin.strftime('%Y-%m-%d'),
            'estado': p.estado,
            'motivo': p.motivo,
        })

    return JsonResponse({
        'colaboradores': colabs_data,
        'vacaciones_admin': vacaciones_admin_data,
        'registros': registros_data,
        'actas': actas_data,
        'evaluaciones': eval_data,
        'configuracion': config_data,
        'permisos': permisos_data,
    })
