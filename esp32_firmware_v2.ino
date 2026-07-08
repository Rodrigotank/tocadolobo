/*
 * ESP32 Firmware v2 - Toca do Lobo
 * Suporta registro automático, heartbeat e atualização de configurações
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <WiFiClient.h>

// ==================== CONFIGURAÇÕES ====================
const char* WIFI_SSID = "tank_wifi";
const char* WIFI_PASSWORD = "senha2017";

const char* BACKEND_URL = "http://144.22.210.88:8000"; // Ex: "https://toca-do-lobo.oraclecloud.com"
const char* DISPOSITIVO_NOME = "ESP32-EPSONTM20";

// Intervalos (em ms)
unsigned long intervaloVerificacao = 5000;  // Padrão: 5 segundos
unsigned long intervaloHeartbeat = 30000;    // Padrão: 30 segundos
unsigned long intervaloAtualizacaoConfig = 60000; // Padrão: 1 minuto

// ==================== VARIÁVEIS GLOBAIS ====================
int dispositivoId = -1;
String impressoraIP = "192.168.88.29";
int impressoraPorta = 9100;

unsigned long ultimaVerificacao = 0;
unsigned long ultimoHeartbeat = 0;
unsigned long ultimaAtualizacaoConfig = 0;

// ==================== FUNÇÕES AUXILIARES ====================

String getMacAddress() {
  uint8_t mac[6];
  WiFi.macAddress(mac);
  char macStr[18];
  sprintf(macStr, "%02X:%02X:%02X:%02X:%02X:%02X", 
          mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
  return String(macStr);
}

String urlEncode(String str) {
  String encodedString = "";
  char c;
  char code0;
  char code1;
  char code2;
  for (int i = 0; i < str.length(); i++) {
    c = str.charAt(i);
    if (c == ' ') {
      encodedString += '+';
    } else if (isalnum(c)) {
      encodedString += c;
    } else {
      code1 = (c & 0xf) + '0';
      if ((c & 0xf) > 9) {
        code1 = (c & 0xf) - 10 + 'A';
      }
      c = (c >> 4) & 0xf;
      code0 = c + '0';
      if (c > 9) {
        code0 = c - 10 + 'A';
      }
      code2 = '\0';
      encodedString += '%';
      encodedString += code0;
      encodedString += code1;
    }
  }
  return encodedString;
}

unsigned char b64_lookup(char c) {
  if(c >='A' && c <='Z') return c - 'A';
  if(c >='a' && c <='z') return c - 71;
  if(c >='0' && c <='9') return c + 4;
  if(c == '+') return 62;
  if(c == '/') return 63;
  return 0; // Return 0 instead of -1 to avoid invalid values
}

int base64_dec_len(char * input, int inputLen) {
  int i = 0;
  int numEq = 0;
  for(i = inputLen - 1; i >= 0 && input[i] == '='; i--) {
    numEq++;
  }
  int len = ((6 * inputLen) / 8) - numEq;
  return len > 0 ? len : 0;
}

int base64_decode(char * output, char * input, int inputLen, int outputMaxLen) {
  int i = 0, j = 0;
  int decLen = 0;
  unsigned char a3[3];
  unsigned char a4[4];
  
  while (inputLen > 0 && *input != '=') {
    // Process only valid base64 characters
    char c = *input++;
    inputLen--;
    unsigned char val = b64_lookup(c);
    if (val == 0 && c != 'A') continue; // Skip invalid chars, but allow 'A'
    
    a4[i++] = val;
    if (i == 4) {
      a3[0] = (a4[0] << 2) + ((a4[1] & 0x30) >> 4);
      a3[1] = ((a4[1] & 0xf) << 4) + ((a4[2] & 0x3c) >> 2);
      a3[2] = ((a4[2] & 0x3) << 6) + a4[3];
      
      // Safety check: don't write beyond output buffer
      for (int k = 0; k < 3 && decLen < outputMaxLen; k++) {
        output[decLen++] = a3[k];
      }
      i = 0;
    }
  }
  
  if (i > 1) { // Need at least 2 characters to decode something
    // Pad remaining a4 with zeros
    for (j = i; j < 4; j++) {
      a4[j] = 0;
    }
    
    a3[0] = (a4[0] << 2) + ((a4[1] & 0x30) >> 4);
    a3[1] = ((a4[1] & 0xf) << 4) + ((a4[2] & 0x3c) >> 2);
    a3[2] = ((a4[2] & 0x3) << 6) + a4[3];
    
    int toWrite = i - 1;
    for (j = 0; j < toWrite && decLen < outputMaxLen; j++) {
      output[decLen++] = a3[j];
    }
  }
  
  // Safety: ensure null termination
  if (decLen < outputMaxLen) {
    output[decLen] = '\0';
  }
  
  return decLen;
}

void enviarParaImpressora(String dadosBase64) {
  WiFiClient client;
  
  Serial.print("Conectando à impressora em ");
  Serial.print(impressoraIP);
  Serial.print(":");
  Serial.println(impressoraPorta);
  
  if (client.connect(impressoraIP.c_str(), impressoraPorta)) {
    Serial.println("Conectado à impressora!");
    
    // Decodifica Base64
    int inputLen = dadosBase64.length();
    int decodedLen = base64_dec_len((char*)dadosBase64.c_str(), inputLen);
    // Aloca buffer com espaço extra para segurança
    int bufferSize = decodedLen + 10;
    Serial.print("Tamanho decodificado esperado: ");
    Serial.println(decodedLen);
    Serial.print("Tamanho do buffer alocado: ");
    Serial.println(bufferSize);
    
    char* decoded = new char[bufferSize];
    int actualDecodedLen = base64_decode(decoded, (char*)dadosBase64.c_str(), inputLen, bufferSize);
    Serial.print("Tamanho decodificado real: ");
    Serial.println(actualDecodedLen);
    
    // Envia para impressora
    size_t bytesEnviados = client.write((uint8_t*)decoded, actualDecodedLen);
    client.flush();
    Serial.print("Bytes enviados para impressora: ");
    Serial.println(bytesEnviados);
    
    delete[] decoded;
    client.stop();
    Serial.println("Dados enviados para impressora!");
  } else {
    Serial.println("Falha ao conectar à impressora!");
  }
}

// ==================== FUNÇÕES DE API ====================

bool registrarDispositivo() {
  if (WiFi.status() != WL_CONNECTED) return false;
  
  HTTPClient http;
  String url = String(BACKEND_URL) + "/api/esp32/registrar";
  
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  
  String mac = getMacAddress();
  String ipLocal = WiFi.localIP().toString();
  
  // Cria JSON
  DynamicJsonDocument doc(512);
  doc["nome"] = DISPOSITIVO_NOME;
  doc["mac_address"] = mac;
  doc["ip_local"] = ipLocal;
  doc["impressora_ip"] = impressoraIP;
  doc["impressora_porta"] = impressoraPorta;
  doc["intervalo_verificacao"] = intervaloVerificacao;
  
  String payload;
  serializeJson(doc, payload);
  
  int httpCode = http.POST(payload);
  
  if (httpCode == 200) {
    String response = http.getString();
    DynamicJsonDocument responseDoc(512);
    deserializeJson(responseDoc, response);
    
    if (responseDoc["success"]) {
      dispositivoId = responseDoc["dispositivo"]["id"].as<int>();
      Serial.print("Dispositivo registrado com sucesso! ID: ");
      Serial.println(dispositivoId);
      
      // Atualiza configurações com as do servidor
      impressoraIP = responseDoc["dispositivo"]["impressora_ip"].as<String>();
      impressoraPorta = responseDoc["dispositivo"]["impressora_porta"].as<int>();
      intervaloVerificacao = responseDoc["dispositivo"]["intervalo_verificacao"].as<int>();
      
      http.end();
      return true;
    }
  }
  
  Serial.print("Falha ao registrar dispositivo. Código: ");
  Serial.println(httpCode);
  http.end();
  return false;
}

bool enviarHeartbeat() {
  if (dispositivoId == -1 || WiFi.status() != WL_CONNECTED) return false;
  
  HTTPClient http;
  String url = String(BACKEND_URL) + "/api/esp32/" + String(dispositivoId) + "/ping";
  
  http.begin(url);
  int httpCode = http.POST("");
  
  if (httpCode == 200) {
    Serial.println("Heartbeat enviado com sucesso!");
    http.end();
    return true;
  }
  
  Serial.print("Falha no heartbeat. Código: ");
  Serial.println(httpCode);
  http.end();
  return false;
}

bool atualizarConfiguracoes() {
  if (dispositivoId == -1 || WiFi.status() != WL_CONNECTED) return false;
  
  HTTPClient http;
  String url = String(BACKEND_URL) + "/api/esp32/" + String(dispositivoId) + "/configuracoes";
  
  http.begin(url);
  int httpCode = http.GET();
  
  if (httpCode == 200) {
    String response = http.getString();
    DynamicJsonDocument doc(256);
    deserializeJson(doc, response);
    
    impressoraIP = doc["impressora_ip"].as<String>();
    impressoraPorta = doc["impressora_porta"].as<int>();
    intervaloVerificacao = doc["intervalo_verificacao"].as<int>();
    
    Serial.println("Configurações atualizadas!");
    Serial.print("  Impressora: ");
    Serial.print(impressoraIP);
    Serial.print(":");
    Serial.println(impressoraPorta);
    Serial.print("  Intervalo: ");
    Serial.println(intervaloVerificacao);
    
    http.end();
    return true;
  }
  
  http.end();
  return false;
}

void verificarFilaImpressao() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi desconectado, não verificando fila");
    return;
  }
  
  Serial.println("Verificando fila de impressão...");
  HTTPClient http;
  String url = String(BACKEND_URL) + "/api/esp32/fila/pendentes";
  
  http.begin(url);
  int httpCode = http.GET();
  Serial.print("Código HTTP GET fila: ");
  Serial.println(httpCode);
  
  if (httpCode == 200) {
    String response = http.getString();
    Serial.print("Resposta recebida: ");
    Serial.println(response);
    
    DynamicJsonDocument doc(2048);
    DeserializationError error = deserializeJson(doc, response);
    
    if (error) {
      Serial.print("Erro ao deserializar JSON: ");
      Serial.println(error.c_str());
      http.end();
      return;
    }
    
    JsonArray tarefas = doc.as<JsonArray>();
    Serial.print("Número de tarefas pendentes: ");
    Serial.println(tarefas.size());
    
    for (JsonObject tarefa : tarefas) {
      int tarefaId = tarefa["id"].as<int>();
      String dadosEscpos = tarefa["dados_escpos"].as<String>();
      
      Serial.print("Processando tarefa #");
      Serial.println(tarefaId);
      Serial.print("Tamanho dados Base64: ");
      Serial.println(dadosEscpos.length());
      
      // Marca como "imprimindo"
      String urlIniciar = String(BACKEND_URL) + "/api/esp32/fila/" + String(tarefaId) + "/iniciar";
      HTTPClient httpIniciar;
      httpIniciar.begin(urlIniciar);
      int codeIniciar = httpIniciar.POST("");
      httpIniciar.end();
      
      // Envia para impressora
      enviarParaImpressora(dadosEscpos);
      
      // Marca como concluída
      String urlConcluir = String(BACKEND_URL) + "/api/esp32/fila/" + String(tarefaId) + "/concluir";
      HTTPClient httpConcluir;
      httpConcluir.begin(urlConcluir);
      httpConcluir.POST("");
      httpConcluir.end();
      
      Serial.print("Tarefa #");
      Serial.print(tarefaId);
      Serial.println(" concluída!");
    }
  } else {
    Serial.print("Falha ao verificar fila. Código: ");
    Serial.println(httpCode);
  }
  
  http.end();
}

// ==================== SETUP ====================

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println();
  Serial.println("=================================");
  Serial.println("  ESP32 - Toca do Lobo v2");
  Serial.println("=================================");
  Serial.println();
  
  // Conecta ao Wi-Fi
  Serial.print("Conectando ao Wi-Fi: ");
  Serial.println(WIFI_SSID);
  
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int tentativas = 0;
  while (WiFi.status() != WL_CONNECTED && tentativas < 30) {
    delay(500);
    Serial.print(".");
    tentativas++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.println("Conectado!");
    Serial.print("IP local: ");
    Serial.println(WiFi.localIP());
    Serial.print("MAC: ");
    Serial.println(getMacAddress());
  } else {
    Serial.println();
    Serial.println("Falha ao conectar ao Wi-Fi! Reiniciando...");
    delay(3000);
    ESP.restart();
  }
  
  // Tenta registrar o dispositivo
  Serial.println();
  Serial.println("Registrando dispositivo...");
  
  while (dispositivoId == -1) {
    if (registrarDispositivo()) {
      break;
    }
    Serial.println("Tentando novamente em 5 segundos...");
    delay(5000);
  }
}

// ==================== LOOP ====================

void loop() {
  unsigned long agora = millis();
  
  // Verifica fila de impressão
  if (agora - ultimaVerificacao >= intervaloVerificacao) {
    ultimaVerificacao = agora;
    verificarFilaImpressao();
  }
  
  // Envia heartbeat
  if (agora - ultimoHeartbeat >= intervaloHeartbeat) {
    ultimoHeartbeat = agora;
    if (!enviarHeartbeat()) {
      // Se falhar o heartbeat, tenta re-registrar
      Serial.println("Falha no heartbeat, tentando re-registrar...");
      registrarDispositivo();
    }
  }
  
  // Atualiza configurações
  if (agora - ultimaAtualizacaoConfig >= intervaloAtualizacaoConfig) {
    ultimaAtualizacaoConfig = agora;
    atualizarConfiguracoes();
  }
  
  delay(100);
}
