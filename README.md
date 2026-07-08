# Sistema de Caixa e Comandas - Toca do LOBO

Aplicativo completo de gerenciamento de caixa e comandas utilizando FastAPI (Python) no backend e interface web responsiva com Bootstrap.

## Funcionalidades Principais

### 1. Tela Inicial
- Botão para abrir nova comanda
- Lista de comandas abertas e fechadas
- Busca por número da comanda ou nome do cliente
- Indicadores de status visual (Verde=Aberta, Vermelho=Fechada, Amarelo=Aguardando Cozinha)

### 2. Abertura de Comanda
- Número automático
- Nome do cliente obrigatório
- Número da mesa (opcional)
- Data e hora automaticamente registradas

### 3. Tela de Pedidos (Otimizada para Touchscreen)
- Produtos organizados por categorias (Bebidas, Porções, etc.)
- Botões grandes para toque
- Campo para observações
- Subtotal em tempo real
- Ajuste de quantidade

### 4. Fechamento de Comanda
- Resumo completo
- Formas de pagamento: Dinheiro, PIX, Cartão
- Cálculo de troco
- Impressão de recibo

### 5. Painel Administrativo
- Dashboard com vendas do dia
- Cadastro e lista de produtos
- Histórico de comandas

## Tecnologias Utilizadas

- **Backend:** Python 3.8+ + FastAPI
- **Frontend:** HTML5, CSS3, JavaScript + Bootstrap 5
- **Banco de Dados:** SQLite
- **Servidor:** Uvicorn

## Instalação

1. **Clone ou baixe o projeto**

2. **Crie um ambiente virtual (opcional, mas recomendado):**
   ```bash
   python -m venv venv
   ```

3. **Ative o ambiente virtual:**
   - Windows:
     ```bash
     venv\Scripts\activate
     ```
   - Linux/Mac:
     ```bash
     source venv/bin/activate
     ```

4. **Instale as dependências:**
   ```bash
   pip install -r requirements.txt
   ```

## Execução

1. **Inicie o servidor:**
   ```bash
   python run.py
   ```

2. **Acesse no navegador:**
   - Interface principal: http://localhost:8000
   - Painel Admin: http://localhost:8000/admin
   - Documentação da API: http://localhost:8000/docs

## Estrutura do Projeto

```
caixa-bar/
├── backend/
│   ├── __init__.py
│   ├── main.py          # FastAPI - Rotas e API
│   └── models.py        # SQLAlchemy - Modelos do Banco de Dados
├── frontend/
│   ├── templates/
│   │   ├── index.html   # Tela principal
│   │   └── admin.html   # Painel administrativo
│   └── static/
│       ├── css/
│       │   └── style.css
│       └── js/
│           └── app.js
├── requirements.txt
├── run.py               # Script de execução
└── README.md
```

## Banco de Dados

O sistema usa SQLite e cria automaticamente:
- Categorias padrão
- Produtos de exemplo
- Usuário admin (username: admin, senha: admin123)

## Funcionamento em Rede Local

Para acessar de outros dispositivos na rede:
1. Verifique o IP do computador servidor
2. Acesse no navegador: http://SEU_IP:8000

## Observações

- O sistema de impressão térmica ESC/POS está pronto para integração
- Recomendado usar Chrome ou Firefox para melhor experiência
- Interface responsiva para smartphones e tablets
