from backend.models import SessionLocal, Produto

db = SessionLocal()
try:
    produtos = db.query(Produto).all()
    print("Produtos no banco de dados:")
    for p in produtos:
        print(f"ID: {p.id}, Nome: {p.nome}")
finally:
    db.close()
