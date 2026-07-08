from backend.models import SessionLocal, Produto

db = SessionLocal()
try:
    produto11 = db.query(Produto).filter(Produto.id == 11).first()
    produto11.nome = "Hambúrguer"
    
    produto12 = db.query(Produto).filter(Produto.id == 12).first()
    produto12.nome = "Porção de Calabresa"
    
    produto32 = db.query(Produto).filter(Produto.id == 32).first()
    produto32.nome = "Caldo de Mocotó"
    
    db.commit()
    print("Produtos atualizados com sucesso!")
except Exception as e:
    db.rollback()
    print(f"Erro: {e}")
finally:
    db.close()
