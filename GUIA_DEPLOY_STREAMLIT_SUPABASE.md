# Guia de Deploy - Toca Do Lobo (Streamlit + Supabase)

Este guia explica como migrar o sistema para o **Streamlit Community Cloud** (gratuita) e usar o **Supabase** (gratuita) como banco de dados!

---

## 1. Preparar o Projeto

Os arquivos que você precisa para o deploy são:
- `streamlit_app.py` (arquivo principal do app Streamlit)
- `requirements-streamlit.txt` (dependências do projeto)
- `backend/` (pasta com os modelos SQLAlchemy)
- `.env` (variáveis de ambiente - NÃO FAÇA COMMIT DESTE ARQUIVO NO GITHUB!)

---

## 2. Configurar o Supabase (Banco de Dados Gratuito)

### 2.1 Criar uma Conta no Supabase
1. Acesse https://supabase.com/ e clique em "Start your project"
2. Crie uma conta (usando GitHub, e-mail, etc.)

### 2.2 Criar um Novo Projeto
1. Clique em "New Project"
2. Preencha os campos:
   - Name: `toca-do-lobo`
   - Database Password: Crie uma senha segura (anote-a!)
   - Region: Escolha a mais próxima de você (ex: `São Paulo`)
3. Clique em "Create new project" (isso pode levar alguns minutos!)

### 2.3 Obter as Credenciais do Supabase
Quando o projeto estiver pronto:
1. Vá para a aba `Project Settings` → `Database`
2. Copie a "Connection String" (selecione `URI` e marque `Pooler Mode: Session` e `Transaction Mode: Transaction`)
3. A URL se parecerá com isso:
   ```
   postgresql://postgres:[SENHA]@[HOST]:6543/postgres?sslmode=require
   ```
   Anote essa URL!

### 2.4 Migrar o Banco de Dados para o Supabase
Vamos migrar os dados do SQLite/MySQL para o PostgreSQL do Supabase:
1. No painel do Supabase, vá para a aba `SQL Editor`
2. Clique em "New query" e execute o seguinte SQL para criar as tabelas (você também pode adaptar o seu `tocadolobo_dump.sql` para PostgreSQL!):
   ```sql
   -- Categorias
   CREATE TABLE IF NOT EXISTS categorias (
       id SERIAL PRIMARY KEY,
       nome VARCHAR(100) UNIQUE
   );
   
   -- Produtos
   CREATE TABLE IF NOT EXISTS produtos (
       id SERIAL PRIMARY KEY,
       nome VARCHAR(255),
       preco DOUBLE PRECISION,
       categoria_id INTEGER REFERENCES categorias(id),
       e_cozinha BOOLEAN DEFAULT FALSE,
       estoque_atual DOUBLE PRECISION DEFAULT 0.0,
       estoque_minimo DOUBLE PRECISION DEFAULT 0.0,
       ean VARCHAR(100) UNIQUE,
       fator_conversao DOUBLE PRECISION DEFAULT 1.0,
       imagem_url TEXT
   );
   
   -- Comandas
   CREATE TABLE IF NOT EXISTS comandas (
       id SERIAL PRIMARY KEY,
       numero INTEGER UNIQUE,
       cliente VARCHAR(255),
       mesa VARCHAR(50),
       status VARCHAR(50) DEFAULT 'aberta',
       data_abertura TIMESTAMP DEFAULT NOW(),
       data_aguardando TIMESTAMP,
       data_fechamento TIMESTAMP,
       total DOUBLE PRECISION DEFAULT 0.0,
       forma_pagamento VARCHAR(50)
   );
   
   -- Itens de Comanda
   CREATE TABLE IF NOT EXISTS itens_comanda (
       id SERIAL PRIMARY KEY,
       comanda_id INTEGER REFERENCES comandas(id) ON DELETE CASCADE,
       produto_id INTEGER REFERENCES produtos(id),
       quantidade INTEGER DEFAULT 1,
       observacao TEXT,
       entregue BOOLEAN DEFAULT FALSE
   );
   
   -- Usuários
   CREATE TABLE IF NOT EXISTS usuarios (
       id SERIAL PRIMARY KEY,
       username VARCHAR(100) UNIQUE,
       senha VARCHAR(255),
       role VARCHAR(50) DEFAULT 'venda'
   );
   
   -- Outras tabelas (copie do seu tocadolobo_dump.sql, adaptando para PostgreSQL!)
   ```
3. Para migrar os dados, você pode:
   - Usar a ferramenta de importação do Supabase (na aba `Table Editor`)
   - Ou converter seu `tocadolobo_dump.sql` para PostgreSQL e importar via `SQL Editor`

---

## 3. Preparar o Projeto para Deploy

### 3.1 Inicializar o Git (se ainda não tiver)
1. Abra o terminal na pasta do projeto
2. Execute:
   ```bash
   git init
   ```

### 3.2 Criar um Arquivo .gitignore
Crie um arquivo `.gitignore` na raiz do projeto com o seguinte conteúdo para não enviar dados sensíveis:
```
# Dados sensíveis
.env
*.db
*.sqlite
*.sqlite3

# Arquivos temporários
__pycache__/
*.pyc
*.pyo
*.pyd

# Streamlit
.streamlit/secrets.toml

# Outros
.DS_Store
```

### 3.3 Criar Repositório no GitHub
1. Acesse https://github.com/ e crie um novo repositório
2. Siga as instruções para fazer o push do seu projeto para o GitHub

---

## 4. Deploy no Streamlit Community Cloud

### 4.1 Acessar o Streamlit Community Cloud
1. Acesse https://share.streamlit.io/
2. Faça login com sua conta do GitHub

### 4.2 Criar um Novo App
1. Clique em "New app"
2. Selecione o repositório GitHub que você criou
3. Selecione o branch (geralmente `main` ou `master`)
4. Em "Main file path", escreva: `streamlit_app.py`
5. Clique em "Advanced settings..." e adicione as variáveis de ambiente:
   - Nome: `DATABASE_URL`
   - Valor: A URL do Supabase que você copiou (ex: `postgresql://postgres:SUA_SENHA@db.xxx.supabase.co:6543/postgres?sslmode=require`)
   - Adicione também:
     - `ADMIN_USER`: `ADM`
     - `ADMIN_PASS`: `admin123`
6. Clique em "Deploy!"

---

## 5. Testar o App
Quando o deploy estiver concluído, o Streamlit abrirá automaticamente o app! Você pode compartilhar o link com quem quiser!

---

## Funcionalidades Gratuítas Disponíveis
- **Streamlit Community Cloud**: Hospedagem gratuita para apps públicos, com limites razoáveis (perfeito para pequenos negócios!)
- **Supabase Free Tier**: Banco de dados PostgreSQL com 500MB de espaço, 2GB de transferência mensal e mais!
