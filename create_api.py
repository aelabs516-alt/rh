import os
import re

# We need to extract the JSON payload building from 'home' and put it in 'global_data_api'
# Actually, I'll just append it to core/views.py
api_code = '''

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
        
    # Config
    from rrhh.models import ConfiguracionSistema
    config = ConfiguracionSistema.objects.first()
    config_data = {}
    if config:
        config_data = {
            'horas_llegada_tarde': config.horas_llegada_tarde,
            'dias_ausencia_injustificada': config.dias_ausencia_injustificada,
            'salidas_tempranas': config.salidas_tempranas,
            'dias_descanso_semanal': config.dias_descanso_semanal,
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
'''

with open('core/views.py', 'a', encoding='utf-8') as f:
    f.write(api_code)
    
print("Added global_data_api to core/views.py")
