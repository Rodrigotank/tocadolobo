
import PyInstaller.__main__
import os
from pathlib import Path

base_dir = Path(__file__).parent

PyInstaller.__main__.run([
    'run.py',
    '--name=TocaDoLobo',
    '--onedir',
    '--windowed',
    '--icon=NONE',
    '--add-data', f'{base_dir / "frontend"};frontend',
    '--add-data', f'{base_dir / "backend"};backend',
    '--hidden-import', 'uvicorn',
    '--hidden-import', 'fastapi',
    '--hidden-import', 'sqlalchemy',
    '--hidden-import', 'pydantic',
    '--hidden-import', 'jinja2',
])

print("Build concluído! O executável está na pasta dist/")
