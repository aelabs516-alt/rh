import os
import django
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from asistencia.models import RegistroAsistencia, SolicitudPermiso, Colaborador
from rrhh.models import ActaDisciplinaria, Evaluacion, DocumentoColaborador
from nomina.models import ColillaPago
from django.contrib.auth.models import User

print('Eliminando Actas Disciplinarias...')
ActaDisciplinaria.objects.all().delete()
print('Eliminando Evaluaciones...')
Evaluacion.objects.all().delete()
print('Eliminando Documentos...')
DocumentoColaborador.objects.all().delete()
print('Eliminando Registros de Asistencia...')
RegistroAsistencia.objects.all().delete()
print('Eliminando Solicitudes de Permiso...')
SolicitudPermiso.objects.all().delete()
print('Eliminando Colillas de Pago...')
ColillaPago.objects.all().delete()



print('Eliminando Colaboradores (excepto Admin Principal)...')
Colaborador.objects.exclude(cedula=999999999).delete()

print('Datos de prueba eliminados exitosamente.')
