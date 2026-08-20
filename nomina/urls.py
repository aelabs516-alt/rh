from django.urls import path
from .views import colillas_view

urlpatterns = [
    path('colillas/', colillas_view, name='nomina_colillas'),
]
