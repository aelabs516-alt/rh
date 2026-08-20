import os

files_to_clean = [
    'core/views.py',
    'rrhh/views.py',
    'asistencia/views.py'
]

for file_path in files_to_clean:
    if os.path.exists(file_path):
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            
        new_lines = []
        for line in lines:
            if '_json = json.dumps(' in line:
                continue
            if "_json':" in line:
                continue
            new_lines.append(line)
            
        with open(file_path, 'w', encoding='utf-8') as f:
            f.writelines(new_lines)
        print(f"Cleaned python {file_path}")
