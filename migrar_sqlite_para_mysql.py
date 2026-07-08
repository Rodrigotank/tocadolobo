import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from backend.models import Base, Categoria, Produto, Usuario, Comanda, ItemComanda, Log, Configuracao
from dotenv import load_dotenv

load_dotenv()

# Configurações
SQLITE_URL = "sqlite:///caixa_bar.db"
MYSQL_URL = os.getenv("DATABASE_URL")

if not MYSQL_URL:
    print("ERRO: DATABASE_URL não encontrada no .env")
    exit()

# Engines e Sessions
engine_sqlite = create_engine(SQLITE_URL)
SessionSqlite = sessionmaker(bind=engine_sqlite)

engine_mysql = create_engine(MYSQL_URL)
SessionMysql = sessionmaker(bind=engine_mysql)

def migrar():
    sqlite = SessionSqlite()
    mysql = SessionMysql()

    print("🚀 Iniciando migração de SQLite para MySQL...")

    # Ordem de migração para respeitar Chaves Estrangeiras
    modelos = [Categoria, Usuario, Configuracao, Log, Produto, Comanda, ItemComanda]

    for modelo in modelos:
        nome_tabela = modelo.__tablename__
        print(f"📦 Migrando tabela: {nome_tabela}...")
        
        # Busca dados do SQLite
        itens = sqlite.query(modelo).all()
        
        if not itens:
            print(f"  - Tabela {nome_tabela} está vazia. Pulando.")
            continue

        # Limpa tabela no MySQL antes de inserir (opcional)
        mysql.execute(text(f"SET FOREIGN_KEY_CHECKS = 0;"))
        mysql.query(modelo).delete()
        
        # Insere no MySQL
        for item in itens:
            # Expunge remove o objeto da sessão SQLite para podermos adicionar na MySQL
            sqlite.expunge(item)
            mysql.add(item)
        
        try:
            mysql.commit()
            print(f"  ✅ {len(itens)} registros migrados.")
        except Exception as e:
            mysql.rollback()
            print(f"  ❌ Erro ao migrar {nome_tabela}: {e}")
        finally:
            mysql.execute(text(f"SET FOREIGN_KEY_CHECKS = 1;"))

    sqlite.close()
    mysql.close()
    print("\n✨ Migração concluída com sucesso!")

if __name__ == "__main__":
    migrar()
