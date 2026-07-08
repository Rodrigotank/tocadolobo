# Instalação e Configuração - Toca do LOBO

O **Toca do LOBO** é um sistema de gestão para bares e restaurantes, focado em agilidade no atendimento e controle de estoque.

## 📋 Pré-requisitos
- **Python 3.10 ou superior**: [Baixar aqui](https://www.python.org/downloads/) (Lembre-se de marcar "Add Python to PATH").
- **Dependências**: Instaladas via terminal.

## 🚀 Instalação Rápida

1.  **Copie a pasta** do projeto para o seu computador.
2.  **Abra o terminal** (CMD ou PowerShell) dentro da pasta `TOCADOLOBO`.
3.  **Instale os pacotes necessários**:
    ```bash
    pip install -r requirements.txt
    ```
4.  **Inicie o sistema**:
    - Via script: `python run.py`
    - Ou clicando duas vezes no arquivo: `iniciar.bat`

## 🔑 Acesso Inicial
Ao abrir o sistema pela primeira vez no navegador (`http://localhost:8000`), você verá uma tela de bloqueio.
- **Senha Padrão**: `010203`
- **Senha Master**: `43r0moc@` (Sempre disponível em caso de perda da senha padrão).

## 🖨️ Configuração de Impressora (Epson/Térmica)

O sistema suporta impressoras térmicas via **Rede (TCP/IP)** ou **USB**.

### Opção Rede (Recomendado):
1.  Acesse **Admin** -> Aba **Impressora**.
2.  Selecione **Ethernet (TCP/IP)**.
3.  Insira o **IP da Impressora** (Ex: `192.168.88.29`) e a porta `9100`.
4.  Defina a largura do papel (80mm é o padrão).
5.  Clique em **Salvar**.

### Opção USB:
1.  Identifique o **Vendor ID** e **Product ID** no Gerenciador de Dispositivos do Windows (IDs de Hardware).
2.  No painel Admin, selecione o tipo **USB** e preencha os campos em hexadecimal (Ex: `0x04B8`).

---

## 🛠️ Manutenção e Segurança
A aba **Manutenção 🔒** no painel administrativo exige a senha `0000`. Lá você encontra:
- **Backup Manual**: Gera um arquivo .zip com seus dados.
- **Backups Automáticos**: O sistema gera um backup diário e mantém os últimos 30 dias.
- **Alteração de Senha**: Mude a senha de acesso ao sistema.
- **Zerar Sistema**: Limpeza de histórico para início de novos períodos.

---

# 📖 Funcionamento da Ferramenta

O sistema **Toca do LOBO** foi projetado para ser um PDV (Ponto de Venda) leve e eficiente. Abaixo, as principais funcionalidades:

### 1. Gestão de Atendimento (Comandas)
- **Abertura Rápida**: Abra comandas por nome de cliente ou número de mesa.
- **Lançamento de Itens**: Adicione produtos com observações (ex: "Sem cebola").
- **Fluxo de Cozinha**: Itens de produção (como porções) podem ser enviados para a impressora da cozinha com um clique. O sistema marca o item como "aguardando" e depois permite confirmar a entrega.
- **Visualização**: Antes de imprimir qualquer papel, o sistema mostra um resumo detalhado na tela para conferência.

### 2. Fechamento e Pagamento
- **Múltiplas Formas**: Aceita Dinheiro, PIX, Cartão ou "Marcar" (conta pendente).
- **Cálculo de Troco**: Assistente visual para pagamentos em dinheiro.
- **Recibo Inteligente**: Ao fechar, o sistema tenta imprimir direto na impressora de rede. Se a impressora estiver offline, ele abre automaticamente o diálogo de impressão do Windows.

### 3. Controle de Estoque
- **Baixa Automática**: Toda venda realizada abate a quantidade do estoque atual.
- **Estoque Mínimo**: Defina alertas para cada produto. Itens com estoque baixo ficam destacados em vermelho no painel.
- **Ajustes Rápidos**: Entre com novos produtos ou faça inventário diretamente pela aba de Estoque com botões de entrada e saída.

### 4. Relatórios e Gestão
- **Fechamento de Caixa**: Ao final do turno, gere um resumo de tudo o que foi vendido, agrupado por item e valor total.
- **Relatório por Período**: Filtre suas vendas por qualquer intervalo de datas para saber seu faturamento e quais itens saíram mais.
- **Histórico Completo**: Todas as comandas fechadas ficam arquivadas para consulta posterior.

### 5. Segurança de Dados
- **Backup Automático**: Não se preocupe em perder dados; o sistema se encarrega de criar cópias diárias.
- **Tela de Bloqueio**: Protege seu caixa de acessos não autorizados.
