import os
from django.conf import settings
from django.http import HttpResponseForbidden, FileResponse, Http404
from core.views import login_required_custom
from nomina.models import ColillaPago
from rrhh.models import DocumentoColaborador, ActaDisciplinaria

@login_required_custom
def secure_media_view(request, path):
    """
    Protects media files from unauthorized access.
    Admins can view any file.
    Collaborators can only view files associated with their cedula.
    """
    rol = request.session.get('rol')
    cedula = request.session.get('cedula')
    
    file_path = os.path.join(settings.MEDIA_ROOT, path)
    if not os.path.exists(file_path):
        raise Http404("Archivo no encontrado")

    if rol == 'ADMINISTRADOR':
        return FileResponse(open(file_path, 'rb'))
        
    elif rol == 'COLABORADOR':
        # Check authorization based on path
        is_authorized = False
        
        try:
            if path.startswith('colillas/'):
                # Check if it belongs to the user
                if ColillaPago.objects.filter(archivo_pdf=path, colaborador__cedula=cedula).exists():
                    is_authorized = True
            elif path.startswith('expedientes/'):
                if DocumentoColaborador.objects.filter(archivo=path, colaborador__cedula=cedula).exists():
                    is_authorized = True
            elif path.startswith('disciplinario/'):
                if ActaDisciplinaria.objects.filter(archivo_adjunto=path, colaborador__cedula=cedula).exists():
                    is_authorized = True
        except Exception:
            pass
            
        if is_authorized:
            return FileResponse(open(file_path, 'rb'))
        else:
            return HttpResponseForbidden("No tienes permiso para ver este archivo.")
            
    return HttpResponseForbidden("Acceso denegado.")
