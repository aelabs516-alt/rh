from django.db import models
from asistencia.models import Colaborador
from django.utils import timezone

class ActaDisciplinaria(models.Model):
    GRAVEDADES = [
        ('LEVE', 'Leve'),
        ('GRAVE', 'Grave'),
        ('MUY_GRAVE', 'Muy Grave'),
    ]
    colaborador = models.ForeignKey(Colaborador, on_delete=models.CASCADE)
    fecha = models.DateField(default=timezone.now)
    gravedad = models.CharField(max_length=20, choices=GRAVEDADES)
    descripcion = models.TextField()
    archivo_adjunto = models.FileField(upload_to='disciplinario/', null=True, blank=True)
    semana_relacionada = models.IntegerField(null=True, blank=True)
    anio_relacionado = models.IntegerField(null=True, blank=True)

    def __str__(self):
        return f"Acta {self.colaborador.nombre} - {self.fecha}"

class Evaluacion(models.Model):
    colaborador = models.ForeignKey(Colaborador, on_delete=models.CASCADE)
    periodo = models.CharField(max_length=50) # Ej: Q1 2026
    puntaje = models.DecimalField(max_digits=4, decimal_places=2)
    feedback = models.TextField()
    fecha_evaluacion = models.DateField(default=timezone.now)

    def __str__(self):
        return f"Eval {self.colaborador.nombre} - {self.periodo}"

class DocumentoColaborador(models.Model):
    TIPOS = [
        ('CONTRATO', 'Contrato'),
        ('ID', 'Documento de Identidad'),
        ('CERTIFICADO_SALUD', 'Certificado de Salud'),
        ('OTROS', 'Otros'),
    ]
    colaborador = models.ForeignKey(Colaborador, on_delete=models.CASCADE)
    tipo_documento = models.CharField(max_length=50, choices=TIPOS)
    archivo = models.FileField(upload_to='expedientes/')
    fecha_subida = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.tipo_documento} - {self.colaborador.nombre}"
