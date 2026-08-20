"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path
from django.conf import settings
from django.conf.urls.static import static

from core.views import home, login_view, admin_config_view, logout_view, global_data_api
from core.secure_media import secure_media_view
from asistencia.views import qr_scan_view, manual_view, permisos_view
from rrhh.views import disciplinario_view, evaluaciones_view, documentos_view, certificados_view, generar_pdf_view
from nomina.views import colillas_view

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # Core
    path('', login_view, name='login'),
    path('logout/', logout_view, name='logout'),
    path('dashboard/', home, name='dashboard'),
    path('config/', admin_config_view, name='admin_config'),
    path('api/global-data/', global_data_api, name='api_data'),
    
    # Asistencia
    path('qr/', qr_scan_view, name='asistencia_qr'),
    path('manual/', manual_view, name='asistencia_manual'),
    path('permisos/', permisos_view, name='asistencia_permisos'),
    
    # RRHH
    path('disciplinario/', disciplinario_view, name='rrhh_disciplinario'),
    path('evaluaciones/', evaluaciones_view, name='rrhh_evaluaciones'),
    path('documentos/', documentos_view, name='rrhh_documentos'),
    path('certificados/', certificados_view, name='rrhh_certificados'),
    path('pdf/<str:tipo>/<int:id>/', generar_pdf_view, name='rrhh_generar_pdf'),
    
    # Nómina
    path('colillas/', colillas_view, name='nomina_colillas'),
    
    # Media Segura
    path('media/<path:path>', secure_media_view, name='secure_media'),
]
