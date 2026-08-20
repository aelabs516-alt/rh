from django.db import models
from asistencia.models import Colaborador
from django.utils import timezone

def get_current_year():
    return timezone.now().year

class ColillaPago(models.Model):
    MESES = [
        (1, 'Enero'), (2, 'Febrero'), (3, 'Marzo'), (4, 'Abril'),
        (5, 'Mayo'), (6, 'Junio'), (7, 'Julio'), (8, 'Agosto'),
        (9, 'Septiembre'), (10, 'Octubre'), (11, 'Noviembre'), (12, 'Diciembre')
    ]
    colaborador = models.ForeignKey(Colaborador, on_delete=models.CASCADE)
    mes = models.IntegerField(choices=MESES)
    anio = models.IntegerField(default=get_current_year)
    archivo_pdf = models.FileField(upload_to='colillas/')
    fecha_subida = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Colilla {self.colaborador.nombre} - {self.mes}/{self.anio}"
