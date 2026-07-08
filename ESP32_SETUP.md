
# Configuração do ESP32 para Impressão

## Visão Geral

Este sistema permite que o Toca do Lobo (na nuvem) imprima em uma impressora local usando um ESP32. O fluxo é:

1. Toca do Lobo (nuvem) → Adiciona tarefa na fila do banco de dados
2. ESP32 (rede local) → Verifica fila periodicamente
3. ESP32 → Imprime na impressora TCP/IP local
4. ESP32 → Marca tarefa como concluída

## Passo a Passo

### 1. Configurar o Backend (Toca do Lobo)

1.1 Ajuste o arquivo `impressora.json` para usar o tipo "esp32":
```json
{
  "tipo": "esp32",
  "ativada": true,
  "esp32_impressora_ip": "192.168.88.29",
  "esp32_impressora_porta": 9100
}
```

### 2. Preparar o ESP32

2.1 Instalar a IDE Arduino: https://www.arduino.cc/en/software

2.2 Adicionar suporte ao ESP32 na IDE Arduino:
- File → Preferences
- Adicione na "Additional Boards Manager URLs":
  `https://dl.espressif.com/dl/package_esp32_index.json`
- Tools → Board → Boards Manager
- Pesquise por "ESP32" e instale o pacote "esp32 by Espressif Systems"

2.3 Instalar bibliotecas necessárias (via Library Manager):
- ArduinoJson (by Benoit Blanchon)
- Base64 (by Densaugeo)

2.4 Editar o arquivo `esp32_firmware.ino`:
- Altere as configurações no topo do arquivo:
  ```cpp
  const char* WIFI_SSID = "SEU_WIFI_SSID";       // Seu nome de Wi-Fi
  const char* WIFI_PASS = "SUA_SENHA_WIFI";     // Sua senha do Wi-Fi
  const char* BACKEND_URL = "http://SEU_BACKEND:8000"; // URL do backend (ex: http://192.168.1.100:8000)
  const char* IMPRESSORA_IP = "192.168.88.29";  // IP da sua impressora
  const int IMPRESSORA_PORT = 9100;               // Porta da impressora (normalmente 9100)
  ```

2.5 Carregar o firmware no ESP32:
- Conecte o ESP32 ao computador via USB
- Selecione a placa: Tools → Board → ESP32 Arduino → ESP32 Dev Module
- Selecione a porta: Tools → Port → (a porta do seu ESP32)
- Clique no botão "Upload" (ícone de seta para a direita)

### 3. Testar o Sistema

3.1 Verifique o Serial Monitor da IDE Arduino (baud rate 115200) para ver os logs do ESP32

3.2 Faça um pedido no Toca do Lobo e veja se a impressão acontece!

## Rotas API para ESP32

| Rota | Método | Descrição |
|------|--------|-----------|
| `/api/esp32/fila/pendentes` | GET | Retorna até 10 tarefas pendentes |
| `/api/esp32/fila/{id}/iniciar` | POST | Marca tarefa como "imprimindo" |
| `/api/esp32/fila/{id}/concluir` | POST | Marca tarefa como concluída |
| `/api/esp32/fila/{id}/falha` | POST | Marca tarefa como falha |
| `/api/esp32/fila/limpar-concluidos` | DELETE | Limpa tarefas concluídas |

## Estrutura da Tarefa de Impressão

Cada tarefa na fila contém:
- `id`: ID único da tarefa
- `tipo`: Tipo de impressão ("cozinha", "comanda", "recibo", "fechamento")
- `dados_escpos`: Dados ESC/POS em Base64 (o que realmente é enviado para a impressora)
- `status`: Status da tarefa ("pendente", "imprimindo", "concluido", "falha")
- `data_criacao`: Data de criação
- `data_impressao`: Data de impressão (quando concluída)
- `tentativas`: Número de tentativas de impressão

## Dúvidas Comuns

### P: O ESP32 não conecta ao Wi-Fi
R: Verifique o SSID e senha no firmware. Certifique-se de que a rede Wi-Fi é 2.4GHz (o ESP32 não suporta 5GHz).

### P: A impressora não imprime
R: Verifique:
1. O IP e porta da impressora no firmware
2. Se a impressora está ligada e conectada à rede
3. Se a impressora suporta ESC/POS (a maioria das impressoras térmicas suporta)

### P: Quero usar impressora USB no ESP32
R: É possível, mas você precisará de um módulo USB Host para ESP32 e modificar o firmware para usar a biblioteca correspondente.
