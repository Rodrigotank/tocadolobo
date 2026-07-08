import os
from pathlib import Path
from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
from dotenv import load_dotenv

# Carrega variáveis de ambiente
load_dotenv()

base_dir = Path(__file__).parent.parent

# Tenta ler a URL do banco do .env, senão usa o SQLite padrão
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    DATABASE_URL = f"sqlite:///{base_dir / 'caixa_bar.db'}"

# Configurações do Engine
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    # Para MySQL, adicionamos pool_recycle para evitar queda de conexão por timeout e charset
    engine = create_engine(
        DATABASE_URL, 
        pool_recycle=3600,
        pool_pre_ping=True,
        connect_args={"charset": "utf8mb4"}
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class Categoria(Base):
    __tablename__ = "categorias"
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(100), unique=True, index=True)
    produtos = relationship("Produto", back_populates="categoria")

class Produto(Base):
    __tablename__ = "produtos"
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(255), index=True)
    preco = Column(Float)
    categoria_id = Column(Integer, ForeignKey("categorias.id"))
    e_cozinha = Column(Boolean, default=False)
    estoque_atual = Column(Float, default=0.0)
    estoque_minimo = Column(Float, default=0.0)
    ean = Column(String(100), unique=True, index=True, nullable=True)
    fator_conversao = Column(Float, default=1.0)
    imagem_url = Column(Text, nullable=True)
    categoria = relationship("Categoria", back_populates="produtos")
    itens_comanda = relationship("ItemComanda", back_populates="produto")

class NotaFiscalProcessada(Base):
    __tablename__ = "notas_fiscais_processadas"
    id = Column(Integer, primary_key=True, index=True)
    chave_acesso = Column(String(100), unique=True, index=True)
    data_processamento = Column(DateTime, default=datetime.now)
    xml_nome = Column(String(255), nullable=True)
    valor_total = Column(Float, nullable=True)

class Configuracao(Base):
    __tablename__ = "configuracoes"
    id = Column(Integer, primary_key=True, index=True)
    chave = Column(String(100), unique=True, index=True)
    valor = Column(String(255))

class Fechamento(Base):
    __tablename__ = "fechamentos"
    id = Column(Integer, primary_key=True, index=True)
    data_inicio = Column(DateTime)
    data_fim = Column(DateTime)
    total_vendido = Column(Float)
    dados_json = Column(Text)

class Comanda(Base):
    __tablename__ = "comandas"
    id = Column(Integer, primary_key=True, index=True)
    numero = Column(Integer, unique=True, index=True)
    cliente = Column(String(255))
    mesa = Column(String(50), nullable=True)
    status = Column(String(50), default="aberta")
    data_abertura = Column(DateTime, default=datetime.now)
    data_aguardando = Column(DateTime, nullable=True)
    data_fechamento = Column(DateTime, nullable=True)
    total = Column(Float, default=0.0)
    forma_pagamento = Column(String(50), nullable=True)
    itens = relationship("ItemComanda", back_populates="comanda", cascade="all, delete-orphan")

class ItemComanda(Base):
    __tablename__ = "itens_comanda"
    id = Column(Integer, primary_key=True, index=True)
    comanda_id = Column(Integer, ForeignKey("comandas.id"))
    produto_id = Column(Integer, ForeignKey("produtos.id"))
    quantidade = Column(Integer, default=1)
    observacao = Column(Text, nullable=True)
    entregue = Column(Boolean, default=False)
    comanda = relationship("Comanda", back_populates="itens")
    produto = relationship("Produto", back_populates="itens_comanda")

class Usuario(Base):
    __tablename__ = "usuarios"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, index=True)
    senha = Column(String(255))
    role = Column(String(50), default="venda")

class Log(Base):
    __tablename__ = "logs"
    id = Column(Integer, primary_key=True, index=True)
    usuario = Column(String(100))
    acao = Column(String(100))
    descricao = Column(Text)
    data = Column(DateTime, default=datetime.now)

class FilaImpressao(Base):
    __tablename__ = "fila_impressao"
    id = Column(Integer, primary_key=True, index=True)
    tipo = Column(String(50))
    dados_escpos = Column(Text)
    status = Column(String(50), default="pendente")
    data_criacao = Column(DateTime, default=datetime.now)
    data_impressao = Column(DateTime, nullable=True)
    tentativas = Column(Integer, default=0)

class DispositivoESP32(Base):
    __tablename__ = "dispositivos_esp32"
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(100), nullable=False)
    mac_address = Column(String(50), unique=True, nullable=False, index=True)
    ip_local = Column(String(50), nullable=True)
    impressora_ip = Column(String(50), default="192.168.88.29")
    impressora_porta = Column(Integer, default=9100)
    intervalo_verificacao = Column(Integer, default=5000)
    status = Column(String(20), default="offline")
    ultima_comunicacao = Column(DateTime, nullable=True)
    data_criacao = Column(DateTime, default=datetime.now)

def init_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Inserir categorias padrão se não existirem
        if db.query(Categoria).count() == 0:
            categorias = [
                Categoria(nome="Bebidas"),
                Categoria(nome="Porções e Cozinha"),
                Categoria(nome="Extras"),
                Categoria(nome="Ficha")
            ]
            db.add_all(categorias)
            db.commit()
        
        # Inserir usuários padrão se não existirem
        if db.query(Usuario).count() == 0:
            usuarios = [
                Usuario(username="ADM", senha="admin123", role="admin"),
                Usuario(username="RTSYSTEM", senha="43r0moc@", role="admin")
            ]
            db.add_all(usuarios)
            db.commit()
        
        # Inserir configurações padrão se não existirem
        if db.query(Configuracao).count() == 0:
            configs = [
                Configuracao(chave="hora_inicio", valor="11:00"),
                Configuracao(chave="hora_fim", valor="04:00"),
                Configuracao(chave="senha_sistema", valor="toca@2026**"),
                Configuracao(chave="senha_manutencao", valor="toca@2026**"),
                Configuracao(chave="nome_estabelecimento", valor="Toca do Lobo"),
                Configuracao(chave="endereco_estabelecimento", valor="Rua Paulo Horneaux de Moura 639"),
                Configuracao(chave="telefone_estabelecimento", valor="13 982224243")
            ]
            db.add_all(configs)
            db.commit()
    except Exception as e:
        print(f"Erro ao inserir dados iniciais: {e}")
        db.rollback()
    finally:
        db.close()
