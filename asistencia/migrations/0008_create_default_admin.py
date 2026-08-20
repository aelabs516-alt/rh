from django.db import migrations
from django.contrib.auth.hashers import make_password

def create_admin(apps, schema_editor):
    Colaborador = apps.get_model('asistencia', 'Colaborador')
    if not Colaborador.objects.filter(cedula=999999999).exists():
        Colaborador.objects.create(
            cedula=999999999,
            nombre='Administrador Principal',
            rol='ADMINISTRADOR',
            estado='ACTIVO',
            password=make_password('admin123')
        )

class Migration(migrations.Migration):
    dependencies = [
        ('asistencia', '0007_alter_solicitudpermiso_estado'),
    ]

    operations = [
        migrations.RunPython(create_admin),
    ]
