import json
from django.test import TestCase, Client
from django.urls import reverse
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from datetime import timedelta
from asistencia.models import Colaborador
from nomina.models import ColillaPago
from rrhh.models import ActaDisciplinaria, DocumentoColaborador

from django.contrib.auth.hashers import make_password

class SistemaIntegradoTest(TestCase):
    def setUp(self):
        self.client = Client()
        
        # Crear un admin
        self.admin = Colaborador.objects.create(
            cedula=1111,
            nombre="Admin Test",
            numero_contacto="1111",
            rol="ADMINISTRADOR",
            estado="ACTIVO",
            fecha_ingreso=timezone.now().date(),
            password=make_password("adminpass")
        )
        
        # Crear un colaborador
        self.colab1 = Colaborador.objects.create(
            cedula=2222,
            nombre="Colab Uno",
            numero_contacto="2222",
            rol="COLABORADOR",
            estado="ACTIVO",
            fecha_ingreso=timezone.now().date() - timedelta(days=365),
            password=make_password("colabpass")
        )
        
        # Crear otro colaborador
        self.colab2 = Colaborador.objects.create(
            cedula=3333,
            nombre="Colab Dos",
            numero_contacto="3333",
            rol="COLABORADOR",
            estado="ACTIVO",
            fecha_ingreso=timezone.now().date(),
            password=make_password("colabpass")
        )

    def test_auth_and_security(self):
        # 1. Acceso sin login debe fallar (redirect a login)
        resp = self.client.get(reverse('dashboard'))
        self.assertEqual(resp.status_code, 302)
        
        # 2. Login como colaborador
        resp = self.client.post(reverse('login'), 
                                json.dumps({'cedula': '2222', 'password': 'colabpass', 'user_type': 'COLABORADOR'}), 
                                content_type="application/json")
        self.assertEqual(resp.status_code, 200)
        
        # Parse the JSON response
        data = json.loads(resp.content)
        self.assertTrue(data.get('success'))
        
        # Try to upload a colilla as COLABORADOR (should be denied)
        # Note: file uploads use multipart/form-data
        pdf = SimpleUploadedFile("file.pdf", b"file_content", content_type="application/pdf")
        resp = self.client.post(reverse('nomina_colillas'), {'accion': 'subir_colilla', 'cedula': '2222', 'mes': '1', 'anio': '2026', 'archivo': pdf})
        data = json.loads(resp.content)
        self.assertFalse(data.get('success'))
        self.assertIn('denegado', data.get('message').lower())
        
    def test_qr_attendance(self):
        # Login as colab1
        self.client.post(reverse('login'), 
                         json.dumps({'cedula': '2222', 'password': 'colabpass', 'user_type': 'COLABORADOR'}), 
                         content_type="application/json")
        
        # INGRESO
        resp = self.client.post(reverse('asistencia_qr'), 
            json.dumps({'tipo': 'INGRESO', 'cedula': '2222'}), 
            content_type="application/json"
        )
        data = json.loads(resp.content)
        self.assertTrue(data.get('success'), data)
        self.assertIn('registrado exitosamente', data.get('message'))
        
        # INGRESO AGAIN (should handle gracefully)
        resp = self.client.post(reverse('asistencia_qr'), 
            json.dumps({'tipo': 'INGRESO', 'cedula': '2222'}), 
            content_type="application/json"
        )
        data = json.loads(resp.content)
        self.assertFalse(data.get('success'))
        
        # SALIDA
        resp = self.client.post(reverse('asistencia_qr'), 
            json.dumps({'tipo': 'SALIDA', 'cedula': '2222'}), 
            content_type="application/json"
        )
        data = json.loads(resp.content)
        self.assertTrue(data.get('success'))
        self.assertIn('registrado exitosamente', data.get('message'))

    def test_media_protection(self):
        # 1. Crear una colilla manualmente
        pdf = SimpleUploadedFile("colilla_2222_1_2026.pdf", b"file_content", content_type="application/pdf")
        colilla = ColillaPago.objects.create(
            colaborador=self.colab1,
            mes=1,
            anio=2026,
            archivo_pdf=pdf
        )
        
        file_url = colilla.archivo_pdf.name # e.g. colillas/colilla_2222_1_2026.pdf
        
        # Accessing without login -> Redirect to login (302)
        resp = self.client.get(f'/media/{file_url}')
        self.assertEqual(resp.status_code, 302)
        
        # Login as colab2 (not owner) -> Forbidden (403)
        self.client.post(reverse('login'), 
                         json.dumps({'cedula': '3333', 'password': 'colabpass', 'user_type': 'COLABORADOR'}), 
                         content_type="application/json")
        resp = self.client.get(f'/media/{file_url}')
        self.assertEqual(resp.status_code, 403)
        
        # Login as colab1 (owner) -> Success (200)
        self.client.post(reverse('login'), 
                         json.dumps({'cedula': '2222', 'password': 'colabpass', 'user_type': 'COLABORADOR'}), 
                         content_type="application/json")
        resp = self.client.get(f'/media/{file_url}')
        self.assertEqual(resp.status_code, 200)
        
        # Login as Admin -> Success (200)
        self.client.post(reverse('login'), 
                         json.dumps({'cedula': '1111', 'password': 'adminpass', 'user_type': 'ADMINISTRADOR'}), 
                         content_type="application/json")
        resp = self.client.get(f'/media/{file_url}')
        self.assertEqual(resp.status_code, 200)
