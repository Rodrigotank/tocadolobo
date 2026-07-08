
import os
from pathlib import Path

BASE_DIR = Path(__file__).parent

IMPRESSORA_CONFIG = {
    'tipo': 'ethernet',
    'ip': '192.168.88.29',
    'porta': 9100,
    'usb_vendor_id': None,
    'usb_product_id': None,
    'largura': 80,
    'ativada': False,
    'esp32_impressora_ip': '192.168.88.29',
    'esp32_impressora_porta': 9100
}

CONFIG_FILE = BASE_DIR / 'impressora.json'

import json

def carregar_config():
    global IMPRESSORA_CONFIG
    if CONFIG_FILE.exists():
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            IMPRESSORA_CONFIG = json.load(f)
    return IMPRESSORA_CONFIG

def salvar_config(config):
    global IMPRESSORA_CONFIG
    IMPRESSORA_CONFIG = config
    with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
        json.dump(config, f, ensure_ascii=False, indent=2)
    return IMPRESSORA_CONFIG

carregar_config()
