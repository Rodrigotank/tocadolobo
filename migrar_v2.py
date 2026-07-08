import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from backend.models import Base, Categoria, Produto, Usuario, Comanda, ItemComanda, Log, Configuracao
from dotenv import load_dotenv

load_dotenv()

MYSQL_URL = os.getenv("DATABASE_URL")
SQLITE_URL = "sqlite:///caixa_bar.db"

engine_sqlite = create_engine(SQLITE_URL)
engine_mysql = create_engine(MYSQL_URL)
SessionSqlite = sessionmaker(bind=engine_sqlite)
SessionMysql = sessionmaker(bind=engine_mysql)

def migrar():
    sqlite = SessionSqlite()
    mysql = SessionMysql()

    # Tabelas para migrar
    modelos = [Categoria, Usuario, Configuracao, Log, Produto, Comanda, ItemComanda]

    print("🚀 Iniciando Migração V2...")
    
    # Desativa checagem de chaves estrangeiras para limpeza total
    mysql.execute(text("SET FOREIGN_KEY_CHECKS = 0;"))
    
    for modelo in modelos:
        print(f"📦 Tabela: {modelo.__tablename__}")
        
        # 1. Pega dados do SQLite
        itens = sqlite.query(modelo).all()
        
        # 2. Limpa tabela no MySQL
        mysql.execute(text(f"TRUNCATE TABLE {modelo.__tablename__};"))
        
        # 3. Migra um por um
        for item in itens:
            sqlite.expunge(item)
            mysql.merge(item) # Merge é mais seguro que add para IDs existentes
            if modelo == Usuario:
                print(f"   👤 Movendo usuário: {item.username}")

        mysql.commit()
        print(f"   ✅ {len(itens)} registros commitados.")

    mysql.execute(text("SET FOREIGN_KEY_CHECKS = 1;"))
    print("\n✨ Migração V2 Concluída!")
    sqlite.close()
    mysql.close()

if __name__ == "__main__":
    migrar()
