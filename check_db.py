
import os
from pathlib import Path
from dotenv import load_dotenv

# Carrega o arquivo .env
env_path = Path(__file__).parent / '.env'
if env_path.exists():
    load_dotenv(dotenv_path=env_path)

from backend.models import SessionLocal, init_db, Produto

init_db()
db = SessionLocal()
produtos = db.query(Produto).all()
print("=== PRODUTOS NO BANCO DE DADOS ===")
for p in produtos:
    print(f"ID: {p.id}, Nome: {p.nome}, Imagem URL: '{p.imagem_url}'")
db.close()
