from django.urls import path
from .views import disciplinario_view, evaluaciones_view, documentos_view, certificados_view

urlpatterns = [
    path('disciplinario/', disciplinario_view, name='rrhh_disciplinario'),
    path('evaluaciones/', evaluaciones_view, name='rrhh_evaluaciones'),
    path('documentos/', documentos_view, name='rrhh_documentos'),
    path('certificados/', certificados_view, name='rrhh_certificados'),
]
