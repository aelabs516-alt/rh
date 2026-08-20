from django.urls import path
from .views import qr_scan, manual_view, permisos_view

urlpatterns = [
    path('marcacion/', qr_scan, name='qr_scan'),
    path('manual/', manual_view, name='asistencia_manual'),
    path('permisos/', permisos_view, name='asistencia_permisos'),
]
