from core.views import login_required_custom, admin_required_custom
from django.shortcuts import render
from django.http import JsonResponse
from .models import Colaborador, RegistroAsistencia, SolicitudPermiso
from django.utils import timezone
from django.core.files.base import ContentFile
import base64
import json
import uuid

def qr_scan_view(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            cedula = data.get('cedula')
            tipo = data.get('tipo')  # INGRESO o SALIDA
            foto_b64 = data.get('foto')

            # Obtener Colaborador
            try:
                colaborador = Colaborador.objects.get(cedula=cedula)
                if colaborador.estado != 'ACTIVO':
                    return JsonResponse({'success': False, 'message': 'Colaborador inactivo.'})
            except Colaborador.DoesNotExist:
                return JsonResponse({'success': False, 'message': 'Colaborador no encontrado.'})

            today = timezone.localtime(timezone.now()).date()
            now_time = timezone.localtime(timezone.now()).time()

            # Buscar si ya existe un registro para hoy
            registro = RegistroAsistencia.objects.filter(colaborador=colaborador, fecha=today).first()
            
            if tipo == 'INGRESO':
                if registro and registro.hora_ingreso:
                    return JsonResponse({'success': False, 'message': 'Ya se ha registrado el ingreso de hoy.'})
                if not registro:
                    registro = RegistroAsistencia(colaborador=colaborador, fecha=today, ip_dispositivo=request.META.get('REMOTE_ADDR'))
                registro.hora_ingreso = now_time

            elif tipo == 'SALIDA':
                if not registro or not registro.hora_ingreso:
                    return JsonResponse({'success': False, 'message': 'No se puede registrar salida sin un ingreso previo hoy.'})
                if registro.hora_salida:
                    return JsonResponse({'success': False, 'message': 'Ya se ha registrado la salida de hoy.'})
                
                registro.hora_salida = now_time
                
                # Calcular horas normales y extras (Asumiendo jornada de 8 horas)
                from datetime import datetime
                t1 = datetime.combine(today, registro.hora_ingreso)
                t2 = datetime.combine(today, registro.hora_salida)
                diff = (t2 - t1).total_seconds() / 3600.0
                
                if diff > 8:
                    registro.horas_normales = 8
                    registro.horas_extras = round(diff - 8, 2)
                else:
                    registro.horas_normales = round(diff, 2)
                    registro.horas_extras = 0

            else:
                return JsonResponse({'success': False, 'message': 'Tipo de marcación inválido.'})

            # Procesar foto de forma segura
            if foto_b64 and ';base64,' in foto_b64:
                try:
                    format, imgstr = foto_b64.split(';base64,') 
                    ext = format.split('/')[-1]
                    # Limitar extensión a imagenes conocidas
                    if ext not in ['jpeg', 'jpg', 'png']:
                        ext = 'jpg'
                    filename = f"{cedula}_{uuid.uuid4().hex}.{ext}"
                    # Protección básica tamaño
                    decoded_img = base64.b64decode(imgstr)
                    if len(decoded_img) < 5 * 1024 * 1024: # max 5MB
                        registro.foto_captura.save(filename, ContentFile(decoded_img), save=False)
                except Exception as img_e:
                    print("Error procesando imagen:", img_e) # Log without crashing main process

            registro.save()
            return JsonResponse({'success': True, 'message': f'{tipo} registrado exitosamente para {colaborador.nombre}.'})

        except Exception as e:
            return JsonResponse({'success': False, 'message': str(e)})
            
    return render(request, 'asistencia/qr_scan.html')

@login_required_custom
def manual_view(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        accion = data.get('accion')
        if accion == 'registrar_manual':
            try:
                colab = Colaborador.objects.get(cedula=data.get('cedula'))
                fecha = data.get('fecha')
                h_ingreso = data.get('hora_ingreso')
                h_salida = data.get('hora_salida')
                
                # Check for duplicates
                if RegistroAsistencia.objects.filter(colaborador=colab, fecha=fecha).exists():
                    return JsonResponse({'success': False, 'message': 'Ya existe un registro manual para este colaborador en esta fecha.'})
                
                registro = RegistroAsistencia(
                    colaborador=colab,
                    fecha=fecha,
                    hora_ingreso=h_ingreso,
                    hora_salida=h_salida,
                    observaciones=data.get('observaciones', '')
                )
                
                if h_ingreso and h_salida:
                    from datetime import datetime
                    fmt = "%H:%M"
                    try:
                        t1 = datetime.strptime(h_ingreso, fmt)
                        t2 = datetime.strptime(h_salida, fmt)
                        diff = (t2 - t1).total_seconds() / 3600.0
                        if diff < 0:
                            return JsonResponse({'success': False, 'message': 'La hora de salida no puede ser anterior a la de ingreso.'})
                            
                        if diff > 8:
                            registro.horas_normales = 8
                            registro.horas_extras = round(diff - 8, 2)
                        else:
                            registro.horas_normales = round(diff, 2)
                            registro.horas_extras = 0
                    except ValueError:
                        pass # Ignorar fallo de formato, se guardan horas en 0
                
                registro.save()
                return JsonResponse({'success': True, 'message': 'Registro guardado exitosamente'})
            except Exception as e:
                return JsonResponse({'success': False, 'message': str(e)})

    registros = RegistroAsistencia.objects.all().order_by('-fecha', '-id')
    colaboradores = Colaborador.objects.all()
    return render(request, 'asistencia/manual.html', {'registros': registros, 'colaboradores': colaboradores})

@login_required_custom
def permisos_view(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        accion = data.get('accion')
        if accion == 'solicitar_permiso':
            try:
                colab = Colaborador.objects.get(cedula=data.get('cedula'))
                SolicitudPermiso.objects.create(
                    colaborador=colab,
                    tipo=data.get('tipo'),
                    fecha_inicio=data.get('fecha_inicio'),
                    fecha_fin=data.get('fecha_fin'),
                    motivo=data.get('motivo'),
                    estado='PENDIENTE'
                )
                return JsonResponse({'success': True, 'message': 'Permiso solicitado exitosamente'})
            except Exception as e:
                return JsonResponse({'success': False, 'message': str(e)})
        elif accion == 'cambiar_estado':
            if request.session.get('rol') != 'ADMINISTRADOR':
                return JsonResponse({'success': False, 'message': 'Acceso denegado.'})
            try:
                permiso_id = data.get('id')
                nuevo_estado = data.get('nuevo_estado')
                permiso = SolicitudPermiso.objects.get(id=permiso_id)
                permiso.estado = nuevo_estado
                permiso.save()
                return JsonResponse({'success': True, 'message': f'Estado cambiado a {nuevo_estado}'})
            except Exception as e:
                return JsonResponse({'success': False, 'message': str(e)})
        elif accion == 'eliminar_solicitud':
            if request.session.get('rol') != 'ADMINISTRADOR':
                return JsonResponse({'success': False, 'message': 'Acceso denegado.'})
            try:
                permiso_id = data.get('id')
                permiso = SolicitudPermiso.objects.get(id=permiso_id)
                permiso.delete()
                return JsonResponse({'success': True, 'message': 'Solicitud eliminada exitosamente'})
            except Exception as e:
                return JsonResponse({'success': False, 'message': str(e)})

    permisos = SolicitudPermiso.objects.all().order_by('-id')
    colaboradores = Colaborador.objects.all()
    
    colabs_data = []
    for c in colaboradores:
        colabs_data.append({
            'cedula': c.cedula,
            'nombre': c.nombre,
            'numero_contacto': c.numero_contacto or 'No registrado'
        })
    colaboradores_json = json.dumps(colabs_data)
    
    permisos_data = []
    for p in permisos:
        permisos_data.append({
            'id_solicitud': p.id,
            'cedula_colaborador': p.colaborador.cedula,
            'nombre_colaborador': p.colaborador.nombre,
            'fecha_solicitud': str(p.fecha_inicio),
            'categoria': 'vacaciones' if p.tipo.lower() == 'vacaciones' else 'permiso',
            'tipo_permiso': p.tipo,
            'fecha_inicio_vacaciones': str(p.fecha_inicio),
            'fecha_fin_vacaciones': str(p.fecha_fin),
            'total_calculado': str((p.fecha_fin - p.fecha_inicio).days) + ' días' if p.fecha_inicio != p.fecha_fin else '1 día',
            'observaciones': p.motivo,
            'estado': p.estado
        })
    permisos_json = json.dumps(permisos_data)
    
    return render(request, 'asistencia/permisos.html', {'permisos': permisos, 'colaboradores': colaboradores, 'colaboradores_json': colaboradores_json, 'permisos_json': permisos_json})

