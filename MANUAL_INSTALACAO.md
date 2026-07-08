# Manual de Instalação - Sistema Toca Do Lobo

Este manual descreve o passo a passo para instalar e configurar o Sistema Toca Do Lobo com banco de dados MySQL.

## Pré-requisitos
1. Python 3.8 ou superior instalado
2. MySQL Server 8.0 ou superior instalado
3. Acesso de administrador ao computador

---

## Passo 1: Preparar o Banco de Dados MySQL

### 1.1 Conectar ao MySQL como root
Abra o Prompt de Comando ou PowerShell e navegue até o diretório do MySQL (geralmente `C:\Program Files\MySQL\MySQL Server 8.0\bin`), ou adicione o diretório ao PATH do sistema.

Conecte-se ao MySQL com o usuário root:
```bash
mysql -u root -p
```
Digite a senha do usuário root: `43r0moc@`

### 1.2 Criar o banco de dados
No prompt do MySQL, execute:
```sql
CREATE DATABASE IF NOT EXISTS tocadolobo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 1.3 Restaurar o backup do banco de dados
Saia do prompt do MySQL (`EXIT;`) e use os scripts de importação fornecidos no diretório do projeto:

1. **Crie o banco de dados e restaure o dump**:
   - No PowerShell, execute `python fix_products.py` para corrigir a acentuação dos produtos, se necessário.

Alternativamente, você pode usar os seguintes comandos:
```powershell
# Conecte-se ao MySQL e crie o banco
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p43r0moc@ -e "DROP DATABASE IF EXISTS tocadolobo; CREATE DATABASE tocadolobo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Importe o dump (certifique-se de usar o encoding correto)
Get-Content tocadolobo_dump.sql | & "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p43r0moc@ --default-character-set=utf8mb4 tocadolobo

# (Opcional) Corrija os nomes dos produtos com acentuação
python fix_products.py
```

### 1.4 Criar o usuário do banco de dados (opcional, mas recomendado)
Conecte-se novamente ao MySQL como root e crie o usuário `tocadolobo`:
```sql
CREATE USER IF NOT EXISTS 'tocadolobo'@'localhost' IDENTIFIED BY '43r0moc@';
GRANT ALL PRIVILEGES ON tocadolobo.* TO 'tocadolobo'@'localhost';
FLUSH PRIVILEGES;
```

---

## Passo 2: Configurar o Ambiente Python

### 2.1 Instalar as dependências do Python
No diretório do projeto, execute:
```bash
pip install -r requirements.txt
```

### 2.2 Configurar as variáveis de ambiente
Edite o arquivo `.env` no diretório raiz do projeto para usar o banco de dados MySQL:
```env
# Configuração do Banco de Dados
# Para usar SQLite (padrão):
# DATABASE_URL=sqlite:///caixa_bar.db

# Para usar MySQL/MariaDB:
DATABASE_URL=mysql+pymysql://tocadolobo:43r0moc%40@localhost:3306/tocadolobo?charset=utf8mb4
```
**Aviso**: 
- A senha `43r0moc@` tem o caractere `@` que precisa ser codificado como `%40` na URL.
- Adicione `?charset=utf8mb4` ao final da URL para garantir o encoding correto.

---

## Passo 3: Iniciar o Sistema

### 3.1 Iniciar o servidor
Execute o arquivo `run.py` ou clique duas vezes em `INICIAR_SISTEMA.bat`:
```bash
python run.py
```

### 3.2 Acessar o sistema
Abra o navegador e acesse:
- Interface principal: http://localhost:8000
- Painel administrativo: http://localhost:8000/admin

---

## Credenciais de Acesso

### Usuários pré-cadastrados:
1. **Administrador Master**:
   - Usuário: `RTSYSTEM`
   - Senha: `43r0moc@`

2. **Administrador Padrão**:
   - Usuário: `ADM`
   - Senha: `admin123`

---

## Dados de Configuração do Banco de Dados

- **Host**: `localhost`
- **Porta**: `3306`
- **Banco de Dados**: `tocadolobo`
- **Usuários**:
  - `root` (senha: `43r0moc@`)
  - `tocadolobo` (senha: `43r0moc@`)

---

## Problemas Comuns e Soluções

1. **Erro de conexão com o MySQL**:
   - Verifique se o serviço MySQL está em execução (pesquise por "Serviços" no Windows e verifique o serviço "MySQL80" ou similar)
   - Verifique se as credenciais no arquivo `.env` estão corretas

2. **Erro de importação do dump / acentuação incorreta**:
   - Certifique-se de que o arquivo `tocadolobo_dump.sql` está no diretório raiz do projeto
   - Verifique se o usuário MySQL tem permissões de escrita no banco de dados
   - Use o script `fix_products.py` para corrigir nomes de produtos com problemas de acentuação
   - Garanta que a URL de conexão no `.env` inclua `?charset=utf8mb4`
   - Verifique se o arquivo `backend/models.py` inclui `connect_args={"charset": "utf8mb4"}` na configuração do engine

3. **Dependências Python não instaladas**:
   - Certifique-se de que o Python está no PATH do sistema
   - Execute o comando `pip install -r requirements.txt` novamente

---

## Backup e Restauração

### Fazer backup do banco de dados
```bash
mysqldump -u root -p tocadolobo > backup_tocadolobo.sql
```

### Restaurar backup
```bash
# PowerShell:
Get-Content backup_tocadolobo.sql | & "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p43r0moc@ --default-character-set=utf8mb4 tocadolobo
```
