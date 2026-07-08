import streamlit as st
import os
from dotenv import load_dotenv
from datetime import datetime
import pandas as pd

# Carregar variáveis de ambiente
load_dotenv()

# Configuração inicial da página
st.set_page_config(
    page_title="Toca Do Lobo - Sistema de Caixa",
    page_icon="🍺",
    layout="wide",
    initial_sidebar_state="expanded"
)

# --- Autenticação Básica (simulada por enquanto) ---
def check_password():
    """Retorna True se o usuário inserir a senha correta."""
    def password_entered():
        """Verifica se a senha está correta."""
        if (
            st.session_state["username"] == os.getenv("ADMIN_USER", "ADM")
            and st.session_state["password"] == os.getenv("ADMIN_PASS", "admin123")
        ):
            st.session_state["password_correct"] = True
            del st.session_state["password"]  # Não armazene a senha
            del st.session_state["username"]
        else:
            st.session_state["password_correct"] = False

    if "password_correct" not in st.session_state:
        # Primeiro acesso, mostra a tela de login
        st.header("🔐 Login - Toca Do Lobo")
        st.text_input("Usuário", key="username")
        st.text_input("Senha", type="password", key="password")
        st.button("Entrar", on_click=password_entered)
        return False
    elif not st.session_state["password_correct"]:
        # Senha incorreta, mostra a tela de login novamente
        st.header("🔐 Login - Toca Do Lobo")
        st.text_input("Usuário", key="username")
        st.text_input("Senha", type="password", key="password")
        st.error("Usuário ou senha incorretos")
        st.button("Entrar", on_click=password_entered)
        return False
    else:
        # Senha correta
        return True


if not check_password():
    st.stop()  # Não continue se o login não for bem-sucedido

# --- Menu Lateral ---
st.sidebar.title("🍺 Toca Do Lobo")
st.sidebar.markdown("---")
page = st.sidebar.radio(
    "Navegação",
    ["🏠 Início", "📝 Pedidos", "📦 Produtos", "📊 Relatórios", "⚙️ Admin"],
    index=0
)

# --- Dados Simulados (por enquanto, usaremos dados de exemplo ---
# Vamos usar o banco de dados SQLite existente para testes!
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from backend.models import Base, Usuario, Produto, Categoria, Comanda, ItemComanda

# Conectar ao banco de dados SQLite existente (para testes)
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./caixa_bar.db")
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Inicializar o banco de dados (se não existir)
Base.metadata.create_all(bind=engine)

# Obter sessão do banco de dados
def get_db():
    db = SessionLocal()
    try:
        return db
    finally:
        db.close()

# --- Páginas do App ---
if page == "🏠 Início":
    st.title("🏠 Bem-vindo ao Toca Do Lobo!")
    
    # Cards com estatísticas rápidas
    col1, col2, col3 = st.columns(3)
    
    db = get_db()
    total_produtos = db.query(Produto).count()
    comandas_abertas = db.query(Comanda).filter(Comanda.status == "aberta").count()
    comandas_fechadas = db.query(Comanda).filter(Comanda.status == "fechada").count()
    
    with col1:
        st.metric("Total de Produtos", total_produtos)
    with col2:
        st.metric("Comandas Abertas", comandas_abertas)
    with col3:
        st.metric("Comandas Fechadas Hoje", comandas_fechadas)
        
    st.markdown("---")
    st.write("Selecione uma opção no menu lateral para começar!")
    
elif page == "📝 Pedidos":
    st.title("📝 Pedidos e Comandas")
    
    st.markdown("---")
    st.subheader("Comandas Abertas")
    
    db = get_db()
    comandas = db.query(Comanda).filter(Comanda.status == "aberta").all()
    
    if not comandas:
        st.info("Nenhuma comanda aberta no momento!")
    else:
        for comanda in comandas:
            with st.expander(f"Comanda #{comanda.numero} - {comanda.cliente}", expanded=True):
                st.write(f"Data de Abertura: {comanda.data_abertura.strftime('%d/%m/%Y %H:%M')}")
                
                # Itens da comanda
                itens = comanda.itens
                if itens:
                    df_itens = pd.DataFrame([
                        {
                            "Produto": item.produto.nome,
                            "Quantidade": item.quantidade,
                            "Preço Unitário": f"R$ {item.produto.preco:.2f}",
                            "Total": f"R$ {item.quantidade * item.produto.preco:.2f}"
                        } for item in itens
                    ])
                    st.dataframe(df_itens, use_container_width=True)
                else:
                    st.info("Nenhum item nesta comanda.")
                
                # Total da comanda
                total_comanda = sum(item.quantidade * item.produto.preco for item in itens)
                st.metric("Total da Comanda", f"R$ {total_comanda:.2f}")
                
                col1, col2 = st.columns(2)
                with col1:
                    if st.button("Fechar Comanda", key=f"fechar_{comanda.id}"):
                        comanda.status = "fechada"
                        comanda.total = total_comanda
                        comanda.data_fechamento = datetime.now()
                        db.commit()
                        st.success(f"Comanda #{comanda.numero} fechada com sucesso!")
                        st.rerun()
                with col2:
                    st.button("Editar Comanda", key=f"editar_{comanda.id}")
    
    st.markdown("---")
    st.subheader("Abrir Nova Comanda")
    
    with st.form("nova_comanda"):
        numero = st.number_input("Número da Comanda", min_value=1, step=1)
        cliente = st.text_input("Nome do Cliente")
        mesa = st.text_input("Mesa (opcional)")
        
        submitted = st.form_submit_button("Abrir Comanda")
        if submitted:
            db = get_db()
            nova_comanda = Comanda(
                numero=numero,
                cliente=cliente,
                mesa=mesa,
                status="aberta",
                data_abertura=datetime.now()
            )
            db.add(nova_comanda)
            db.commit()
            st.success(f"Comanda #{numero} aberta com sucesso!")
            st.rerun()

elif page == "📦 Produtos":
    st.title("📦 Produtos")
    
    db = get_db()
    produtos = db.query(Produto).all()
    
    st.markdown("---")
    col1, col2 = st.columns(2)
    with col1:
        st.subheader("Lista de Produtos")
    with col2:
        st.subheader("Adicionar Novo Produto")
        
    with col1:
        if not produtos:
            st.info("Nenhum produto cadastrado!")
        else:
            df_produtos = pd.DataFrame([
                {
                    "ID": produto.id,
                    "Nome": produto.nome,
                    "Preço": f"R$ {produto.preco:.2f}",
                    "Categoria": produto.categoria.nome if produto.categoria else "Sem Categoria",
                    "Estoque": produto.estoque_atual
                } for produto in produtos
            ])
            st.dataframe(df_produtos, use_container_width=True)
            
    with col2:
        with st.form("novo_produto"):
            nome = st.text_input("Nome do Produto")
            preco = st.number_input("Preço", min_value=0.0, step=0.01, format="%.2f")
            categorias = db.query(Categoria).all()
            categoria_opcoes = {cat.id: cat.nome for cat in categorias}
            categoria_id = st.selectbox("Categoria", options=categoria_opcoes.keys(), format_func=lambda x: categoria_opcoes[x])
            estoque = st.number_input("Estoque Atual", min_value=0.0, step=1.0)
            
            submitted = st.form_submit_button("Adicionar Produto")
            if submitted:
                novo_produto = Produto(
                    nome=nome,
                    preco=preco,
                    categoria_id=categoria_id,
                    estoque_atual=estoque
                )
                db.add(novo_produto)
                db.commit()
                st.success(f"Produto '{nome}' adicionado com sucesso!")
                st.rerun()

elif page == "📊 Relatórios":
    st.title("📊 Relatórios")
    
    st.markdown("---")
    st.write("Esta seção mostrará relatórios de vendas, estoque e mais!")
    st.info("Funcionalidade em desenvolvimento...")

elif page == "⚙️ Admin":
    st.title("⚙️ Administração")
    
    st.markdown("---")
    st.subheader("Configurações do Sistema")
    
    col1, col2 = st.columns(2)
    with col1:
        st.write("Usuários Cadastrados:")
        db = get_db()
        usuarios = db.query(Usuario).all()
        df_usuarios = pd.DataFrame([
            {
                "ID": usuario.id,
                "Usuário": usuario.username,
                "Perfil": usuario.role
            } for usuario in usuarios
        ])
        st.dataframe(df_usuarios, use_container_width=True)
        
    with col2:
        st.write("Outras Configurações:")
        st.info("Configurações adicionais serão adicionadas em breve!")
