import os
import re

html_files = [
    'asistencia/templates/asistencia/permisos.html',
    'core/templates/core/dashboard.html',
    'rrhh/templates/rrhh/disciplinario.html',
    'rrhh/templates/rrhh/evaluaciones.html'
]

for file_path in html_files:
    if os.path.exists(file_path):
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Remove lines that contain 'window.DJANGO_'
        lines = content.split('\n')
        new_lines = [line for line in lines if 'window.DJANGO_' not in line and 'window.obtener' not in line and 'window.vacaciones_admin' not in line]
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(new_lines))
        print(f"Cleaned {file_path}")
