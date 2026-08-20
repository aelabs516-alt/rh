from core.views import login_required_custom, admin_required_custom
from django.shortcuts import render
from django.http import JsonResponse
import json
from rrhh.models import ActaDisciplinaria, Evaluacion, DocumentoColaborador
from asistencia.models import Colaborador, RegistroAsistencia

@login_required_custom
def disciplinario_view(request):
    if request.method == 'POST':
        if request.session.get('rol') != 'ADMINISTRADOR':
            return JsonResponse({'success': False, 'message': 'Acceso denegado.'})
        data = json.loads(request.body)
        if data.get('accion') == 'crear_acta':
            try:
                colab = Colaborador.objects.get(cedula=data.get('cedula'))
                ActaDisciplinaria.objects.create(
                    colaborador=colab,
                    fecha=data.get('fecha_emision'),
                    gravedad=data.get('tipo_falta'),
                    descripcion=data.get('decision', 'N/A'),
                    semana_relacionada=data.get('semana_relacionada'),
                    anio_relacionado=data.get('anio_relacionado')
                )
                return JsonResponse({'success': True, 'message': 'Acta generada exitosamente'})
            except Exception as e:
                return JsonResponse({'success': False, 'message': str(e)})
        elif data.get('accion') == 'eliminar_acta':
            try:
                acta = ActaDisciplinaria.objects.get(id=data.get('id_acta'))
                acta.delete()
                return JsonResponse({'success': True, 'message': 'Acta eliminada exitosamente'})
            except Exception as e:
                return JsonResponse({'success': False, 'message': str(e)})

    actas = ActaDisciplinaria.objects.select_related('colaborador').all().order_by('-fecha')
    colaboradores = Colaborador.objects.all()
    registros = RegistroAsistencia.objects.select_related('colaborador').all()
    

    
    return render(request, 'rrhh/disciplinario.html', {
        'actas': actas, 
        'colaboradores': colaboradores,
    })

@login_required_custom
def evaluaciones_view(request):
    if request.method == 'POST':
        if request.session.get('rol') != 'ADMINISTRADOR':
            return JsonResponse({'success': False, 'message': 'Acceso denegado.'})
        data = json.loads(request.body)
        if data.get('accion') == 'guardar_evaluacion':
            try:
                colab = Colaborador.objects.get(cedula=data.get('cedula'))
                Evaluacion.objects.create(
                    colaborador=colab,
                    periodo=data.get('periodo'),
                    fecha_evaluacion=data.get('fecha'),
                    puntaje=data.get('puntaje_global'),
                    feedback=data.get('feedback'),
                )
                return JsonResponse({'success': True, 'message': 'Evaluación guardada exitosamente'})
            except Exception as e:
                return JsonResponse({'success': False, 'message': str(e)})

    evaluaciones = Evaluacion.objects.select_related('colaborador').all().order_by('-fecha_evaluacion')
    colaboradores = Colaborador.objects.all()
    
    eval_data = []
    for e in evaluaciones:
        eval_data.append({
            'id_evaluacion': e.id,
            'cedula_colaborador': e.colaborador.cedula,
            'nombre_colaborador': e.colaborador.nombre,
            'ciclo': e.periodo,
            'fecha': str(e.fecha_evaluacion),
            'puntaje_global': float(e.puntaje),
            'feedback_jefe': e.feedback,
            'estado': 'COMPLETADA'
        })
    
    colabs_data = []
    for c in colaboradores:
        colabs_data.append({
            'cedula': c.cedula,
            'nombre': c.nombre,
            'rol': c.rol,
        })
    
    return render(request, 'rrhh/evaluaciones.html', {
        'evaluaciones': evaluaciones, 
        'colaboradores': colaboradores,
    })

@login_required_custom
def documentos_view(request):
    if request.method == 'POST':
        if request.session.get('rol') != 'ADMINISTRADOR':
            return JsonResponse({'success': False, 'message': 'Acceso denegado.'})
        # Handles multipart form data for file uploads
        accion = request.POST.get('accion')
        if accion == 'subir_documento':
            try:
                cedula = request.POST.get('cedula')
                tipo_documento = request.POST.get('tipo_documento')
                archivo = request.FILES.get('archivo')
                
                if not archivo:
                    return JsonResponse({'success': False, 'message': 'No se proporcionó ningún archivo.'})
                ext = archivo.name.split('.')[-1].lower()
                if ext not in ['pdf', 'jpg', 'jpeg', 'png']:
                    return JsonResponse({'success': False, 'message': 'Solo se permiten archivos PDF o Imágenes.'})
                    
                archivo.name = f"{tipo_documento}_{cedula}.{ext}"
                
                colab = Colaborador.objects.get(cedula=cedula)
                DocumentoColaborador.objects.create(
                    colaborador=colab,
                    tipo_documento=tipo_documento,
                    archivo=archivo
                )
                return JsonResponse({'success': True, 'message': 'Documento subido exitosamente'})
            except Exception as e:
                return JsonResponse({'success': False, 'message': str(e)})

    documentos = DocumentoColaborador.objects.select_related('colaborador').all().order_by('-fecha_carga')
    colaboradores = Colaborador.objects.all()
    return render(request, 'rrhh/documentos.html', {'documentos': documentos, 'colaboradores': colaboradores})

@login_required_custom
def certificados_view(request):
    colaboradores = Colaborador.objects.all()
    return render(request, 'rrhh/certificados.html', {'colaboradores': colaboradores})


@login_required_custom
def generar_pdf_view(request, tipo, id):
    # tipo: 'constancia' o 'acta'
    rol = request.session.get('rol')
    cedula_sesion = request.session.get('cedula')
    
    if tipo == 'acta':
        try:
            acta = ActaDisciplinaria.objects.get(id=id)
            if rol == 'COLABORADOR' and acta.colaborador.cedula != cedula_sesion:
                return JsonResponse({'error': 'No tienes permiso para ver esta acta.'})
            context = {'acta': acta, 'tipo': 'acta'}
            return render(request, 'rrhh/print_layout.html', context)
        except:
            return JsonResponse({'error': 'Acta no encontrada'})
    elif tipo == 'constancia':
        try:
            # We use 'id' as cedula in this case
            if rol == 'COLABORADOR' and str(id) != str(cedula_sesion):
                return JsonResponse({'error': 'No tienes permiso para generar esta constancia.'})
            colab = Colaborador.objects.get(cedula=id)
            context = {'colab': colab, 'tipo': 'constancia'}
            return render(request, 'rrhh/print_layout.html', context)
        except:
            return JsonResponse({'error': 'Colaborador no encontrado'})
    return JsonResponse({'error': 'Tipo no soportado'})
