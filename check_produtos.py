
from backend.models import SessionLocal, Produto

db = SessionLocal()
try:
    produtos = db.query(Produto).all()
    print("Total de produtos:", len(produtos))
    for p in produtos:
        print(f"ID: {p.id}, Nome: {p.nome}, Imagem URL: '{p.imagem_url}'")
finally:
    db.close()
