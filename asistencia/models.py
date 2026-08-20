from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone

class Colaborador(models.Model):
    ROLES = [
        ('ADMINISTRADOR', 'Administrador'),
        ('COLABORADOR', 'Colaborador'),
    ]
    ESTADOS = [
        ('ACTIVO', 'Activo'),
        ('INACTIVO', 'Inactivo'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, null=True, blank=True)
    cedula = models.BigIntegerField(unique=True)
    nombre = models.CharField(max_length=200)
    rol = models.CharField(max_length=50, choices=ROLES, default='COLABORADOR')
    estado = models.CharField(max_length=50, choices=ESTADOS, default='ACTIVO')
    password = models.CharField(max_length=128, blank=True, null=True)
    numero_contacto = models.CharField(max_length=50, blank=True, null=True)
    fecha_ingreso = models.DateField(default=timezone.now)
    
    cargo = models.CharField(max_length=150, blank=True, null=True)
    area = models.CharField(max_length=150, blank=True, null=True)
    fecha_nacimiento = models.DateField(blank=True, null=True)
    tipo_contrato = models.CharField(max_length=100, blank=True, null=True)
    salario_base = models.BigIntegerField(blank=True, null=True)
    contacto_emergencia = models.CharField(max_length=255, blank=True, null=True)
    jefe_asignado = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='subordinados')

    def __str__(self):
        return f"{self.nombre} ({self.cedula})"

class Turno(models.Model):
    DIAS = [
        ('Lunes', 'Lunes'), ('Martes', 'Martes'), ('Miércoles', 'Miércoles'),
        ('Jueves', 'Jueves'), ('Viernes', 'Viernes'), ('Sábado', 'Sábado'), ('Domingo', 'Domingo')
    ]
    colaborador = models.ForeignKey(Colaborador, on_delete=models.CASCADE, related_name='turnos')
    dia_semana = models.CharField(max_length=20, choices=DIAS)
    hora_inicio = models.TimeField()
    hora_fin = models.TimeField()

    def __str__(self):
        return f"{self.colaborador.nombre} - {self.dia_semana}"

class RegistroAsistencia(models.Model):
    ESTADOS_INGRESO = [
        ('A_TIEMPO', 'A Tiempo'),
        ('RETARDO', 'Retardo'),
    ]
    ESTADOS_PERMISO = [
        ('PENDIENTE', 'Pendiente'),
        ('APROBADO', 'Aprobado'),
        ('RECHAZADO', 'Rechazado'),
    ]

    colaborador = models.ForeignKey(Colaborador, on_delete=models.CASCADE, related_name='registros')
    fecha = models.DateField()
    hora_ingreso = models.TimeField(null=True, blank=True)
    hora_salida = models.TimeField(null=True, blank=True)
    
    ip_dispositivo = models.GenericIPAddressField(null=True, blank=True)
    estado_ingreso = models.CharField(max_length=50, choices=ESTADOS_INGRESO, default='A_TIEMPO')
    alerta_reincidencia_activa = models.BooleanField(default=False)
    
    tipo_permiso = models.CharField(max_length=100, null=True, blank=True)
    estado_permiso = models.CharField(max_length=50, choices=ESTADOS_PERMISO, null=True, blank=True)
    incapacidad_presentada = models.BooleanField(default=False)
    
    horas_normales = models.FloatField(default=0)
    horas_extras = models.FloatField(default=0)
    
    observaciones = models.TextField(null=True, blank=True)
    
    # Será manejado por MinIO en producción (gracias a django-storages en settings.py)
    foto_captura = models.ImageField(upload_to='capturas_faciales/', null=True, blank=True)

    def __str__(self):
        return f"Registro {self.fecha} - {self.colaborador.nombre}"


class SolicitudPermiso(models.Model):
    ESTADOS = [
        ('PENDIENTE', 'Pendiente'),
        ('AUTORIZADA', 'Autorizada'),
        ('RECHAZADA', 'Rechazada'),
    ]
    colaborador = models.ForeignKey(Colaborador, on_delete=models.CASCADE)
    tipo = models.CharField(max_length=50)
    fecha_inicio = models.DateField()
    fecha_fin = models.DateField()
    motivo = models.TextField()
    estado = models.CharField(max_length=20, choices=ESTADOS, default='PENDIENTE')
    soporte_documento = models.FileField(upload_to='permisos/', null=True, blank=True)

    def __str__(self):
        return f"Permiso {self.colaborador.nombre} - {self.tipo}"
