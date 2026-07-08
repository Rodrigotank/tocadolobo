# Configuração do MySQL - Toca do Lobo

Este guia explica como configurar o banco de dados MySQL para o projeto na VM da Oracle Cloud.

## 1. Criar o Banco de Dados e Usuário

Acesse o MySQL via terminal no servidor:
```bash
sudo mysql -u root
```

Execute os comandos SQL abaixo:
```sql
-- Criar o banco de dados
CREATE DATABASE IF NOT EXISTS tocadolobo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Criar o usuário e definir senha
CREATE USER 'user_toca'@'localhost' IDENTIFIED BY 'TocaDoLobo2024!';

-- Conceder permissões
GRANT ALL PRIVILEGES ON tocadolobo.* TO 'user_toca'@'localhost';

-- Aplicar alterações
FLUSH PRIVILEGES;
EXIT;
```

## 2. Configurar o arquivo .env

Crie ou edite o arquivo `.env` na raiz da pasta `TOCADOLOBO/` com a URL de conexão:

```env
DATABASE_URL=mysql+pymysql://user_toca:TocaDoLobo2024!@localhost:3306/tocadolobo
```

## 3. Instalar Dependências

Certifique-se de instalar os drivers do MySQL:
```bash
pip install -r requirements.txt
```

## 4. Iniciar o Sistema

Ao iniciar o sistema pela primeira vez, o SQLAlchemy criará automaticamente todas as tabelas e inserirá os dados padrão (usuários ADM, RTSYSTEM, categorias iniciais, etc).

```bash
python run.py
```

---
**Nota:** O sistema detectará automaticamente se deve usar SQLite ou MySQL com base na variável `DATABASE_URL` no arquivo `.env`.
