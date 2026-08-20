from core.views import login_required_custom, admin_required_custom
from django.shortcuts import render
from django.http import JsonResponse
from nomina.models import ColillaPago
from asistencia.models import Colaborador
import json

@login_required_custom
def colillas_view(request):
    if request.method == 'POST':
        # Only ADMIN can upload
        if request.session.get('rol') != 'ADMINISTRADOR':
            return JsonResponse({'success': False, 'message': 'Acceso denegado.'})
            
        accion = request.POST.get('accion')
        if accion == 'subir_colilla':
            try:
                cedula = request.POST.get('cedula')
                mes = request.POST.get('mes')
                anio = request.POST.get('anio')
                archivo = request.FILES.get('archivo')
                
                if not archivo:
                    return JsonResponse({'success': False, 'message': 'No se proporcionó ningún archivo.'})
                if not archivo.name.lower().endswith('.pdf'):
                    return JsonResponse({'success': False, 'message': 'El archivo debe ser un PDF.'})
                
                # Custom filename to avoid conflicts
                archivo.name = f"colilla_{cedula}_{mes}_{anio}.pdf"
                
                colab = Colaborador.objects.get(cedula=cedula)
                ColillaPago.objects.create(
                    colaborador=colab,
                    mes=mes,
                    anio=anio,
                    archivo_pdf=archivo
                )
                return JsonResponse({'success': True, 'message': 'Colilla subida exitosamente'})
            except Exception as e:
                return JsonResponse({'success': False, 'message': str(e)})

    colillas = ColillaPago.objects.select_related('colaborador').all().order_by('-fecha_subida')
    colaboradores = Colaborador.objects.all()
    return render(request, 'nomina/colillas.html', {'colillas': colillas, 'colaboradores': colaboradores})
