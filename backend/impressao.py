
import sys
import os
import socket
import base64
from pathlib import Path
from datetime import datetime

try:
    from config_impressora import carregar_config, salvar_config
    from .models import SessionLocal, FilaImpressao
except ImportError:
    sys.path.insert(0, str(Path(__file__).parent.parent))
    from config_impressora import carregar_config, salvar_config
    from models import SessionLocal, FilaImpressao


class ImpressoraEthernet:
    def __init__(self, ip, porta=9100, timeout=5):
        self.ip = ip
        self.porta = porta
        self.timeout = timeout
        self.sock = None
    
    def conectar(self):
        try:
            self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.sock.settimeout(self.timeout)
            self.sock.connect((self.ip, self.porta))
            return True
        except Exception as e:
            print(f'Erro ao conectar à impressora {self.ip}:{self.porta}: {e}')
            return False
    
    def desconectar(self):
        try:
            if self.sock:
                self.sock.close()
        except:
            pass
    
    def enviar(self, dados):
        try:
            if not self.sock:
                return False
            if isinstance(dados, str):
                dados = dados.encode('cp850', errors='replace')
            self.sock.sendall(dados)
            return True
        except Exception as e:
            print(f'Erro ao enviar dados: {e}')
            return False
    
    def inicializar(self):
        self.enviar(b'\x1b\x40')
    
    def alinhar_centro(self):
        self.enviar(b'\x1b\x61\x01')
    
    def alinhar_esquerda(self):
        self.enviar(b'\x1b\x61\x00')
    
    def negrito_ligar(self):
        self.enviar(b'\x1b\x45\x01')
    
    def negrito_desligar(self):
        self.enviar(b'\x1b\x45\x00')
    
    def fonte_aumentar(self):
        self.enviar(b'\x1b\x21\x11')
    
    def fonte_normal(self):
        self.enviar(b'\x1b\x21\x00')
    
    def cortar_papel(self):
        self.enviar(b'\x1d\x56\x41\x00')
    
    def texto(self, texto):
        self.enviar(texto + '\n')


def adicionar_na_fila(tipo, dados_bytes):
    """Adiciona uma tarefa de impressão na fila"""
    db = SessionLocal()
    try:
        dados_base64 = base64.b64encode(dados_bytes).decode('utf-8')
        nova_tarefa = FilaImpressao(
            tipo=tipo,
            dados_escpos=dados_base64,
            status='pendente'
        )
        db.add(nova_tarefa)
        db.commit()
        db.refresh(nova_tarefa)
        return nova_tarefa.id
    finally:
        db.close()


def get_impressora():
    config = carregar_config()
    if not config['ativada']:
        return None
    
    if config['tipo'] == 'esp32':
        return 'fila'
    
    if config['tipo'] == 'ethernet':
        ip = config.get('ip', '192.168.88.29')
        porta = config.get('porta', 9100)
        impressora = ImpressoraEthernet(ip, porta)
        if impressora.conectar():
            return impressora
        else:
            return None
    
    if config['tipo'] == 'usb':
        try:
            from escpos.printer import Usb
            if config['usb_vendor_id'] and config['usb_product_id']:
                return Usb(config['usb_vendor_id'], config['usb_product_id'])
            else:
                return Usb()
        except Exception as e:
            print(f'Erro ao conectar à impressora USB: {e}')
            return None
    
    return None


def gerar_escpos_cozinha(comanda):
    """Gera os dados ESC/POS para comanda de cozinha"""
    dados = bytearray()
    
    # Inicializar
    dados += b'\x1b\x40'
    # Alinhar centro
    dados += b'\x1b\x61\x01'
    # Negrito on
    dados += b'\x1b\x45\x01'
    # Fonte aumentar
    dados += b'\x1b\x21\x11'
    dados += ('=' * 30 + '\n').encode('cp850', errors='replace')
    dados += ('COMANDA COZINHA\n').encode('cp850', errors='replace')
    dados += ('=' * 30 + '\n').encode('cp850', errors='replace')
    # Negrito off
    dados += b'\x1b\x45\x00'
    # Fonte normal
    dados += b'\x1b\x21\x00'
    # Alinhar esquerda
    dados += b'\x1b\x61\x00'
    dados += (f'Cliente: {comanda["cliente"]}\n').encode('cp850', errors='replace')
    dados += (f'Comanda: #{comanda["numero"]}\n').encode('cp850', errors='replace')
    dados += (f'Data: {datetime.now().strftime("%d/%m/%Y %H:%M")}\n').encode('cp850', errors='replace')
    dados += ('-' * 30 + '\n').encode('cp850', errors='replace')
    
    for item in comanda['itens']:
        if item['e_cozinha'] and not item.get('entregue', False):
            dados += (f'{item["quantidade"]}x {item["produto_nome"]}\n').encode('cp850', errors='replace')
            if item['observacao']:
                dados += (f'  Obs: {item["observacao"]}\n').encode('cp850', errors='replace')
    
    # Alinhar centro
    dados += b'\x1b\x61\x01'
    dados += ('=' * 30 + '\n').encode('cp850', errors='replace')
    # Cortar papel
    dados += b'\x1d\x56\x41\x00'
    
    return bytes(dados)


def imprimir_cozinha_direto(comanda):
    config = carregar_config()
    impressora = get_impressora()
    if not impressora:
        return False
    
    # Se for ESP32, adicionar na fila
    if config['tipo'] == 'esp32':
        try:
            dados_escpos = gerar_escpos_cozinha(comanda)
            adicionar_na_fila('cozinha', dados_escpos)
            return True
        except Exception as e:
            print(f'Erro ao adicionar na fila ESP32: {e}')
            return False
    
    try:
        if config['tipo'] == 'ethernet':
            impressora.inicializar()
            impressora.alinhar_centro()
            impressora.negrito_ligar()
            impressora.fonte_aumentar()
            impressora.texto('=' * 30)
            impressora.texto('COMANDA COZINHA')
            impressora.texto('=' * 30)
            impressora.negrito_desligar()
            impressora.fonte_normal()
            impressora.alinhar_esquerda()
            impressora.texto(f'Cliente: {comanda["cliente"]}')
            impressora.texto(f'Comanda: #{comanda["numero"]}')
            impressora.texto(f'Data: {datetime.now().strftime("%d/%m/%Y %H:%M")}')
            impressora.texto('-' * 30)
            
            for item in comanda['itens']:
                if item['e_cozinha'] and not item.get('entregue', False):
                    impressora.texto(f'{item["quantidade"]}x {item["produto_nome"]}')
                    if item['observacao']:
                        impressora.texto(f'  Obs: {item["observacao"]}')
            
            impressora.alinhar_centro()
            impressora.texto('=' * 30)
            impressora.cortar_papel()
            impressora.desconectar()
            return True
        else:
            try:
                impressora.set(align='center')
                impressora.text('=' * 30 + '\n')
                impressora.text('COMANDA COZINHA\n')
                impressora.text('=' * 30 + '\n')
                impressora.set(align='left')
                impressora.text(f'Cliente: {comanda["cliente"]}\n')
                impressora.text(f'Comanda: #{comanda["numero"]}\n')
                impressora.text(f'Data: {datetime.now().strftime("%d/%m/%Y %H:%M")}\n')
                impressora.text('-' * 30 + '\n')
                
                for item in comanda['itens']:
                    if item['e_cozinha'] and not item.get('entregue', False):
                        impressora.text(f'{item["quantidade"]}x {item["produto_nome"]}\n')
                        if item['observacao']:
                            impressora.text(f'  Obs: {item["observacao"]}\n')
                
                impressora.text('=' * 30 + '\n')
                impressora.cut()
                return True
            finally:
                try:
                    impressora.close()
                except:
                    pass
    except Exception as e:
        print(f'Erro ao imprimir para cozinha: {e}')
        return False
    finally:
        if config['tipo'] == 'ethernet':
            try:
                impressora.desconectar()
            except:
                pass


def gerar_escpos_comanda(comanda):
    """Gera os dados ESC/POS para resumo da comanda"""
    dados = bytearray()
    
    status_traduzido = {
        "aberta": "ABERTA",
        "fechada": "FECHADA",
        "aguardando_cozinha": "AGUARDANDO COZINHA"
    }.get(comanda.get("status", "aberta"), comanda.get("status", "aberta").upper())

    pagamento_traduzido = {
        "dinheiro": "DINHEIRO",
        "pix": "PIX",
        "cartao": "CARTÃO",
        "marcar": "MARCADO"
    }.get(comanda.get("forma_pagamento"), "N/A")
    
    # Inicializar
    dados += b'\x1b\x40'
    # Alinhar centro
    dados += b'\x1b\x61\x01'
    # Negrito on
    dados += b'\x1b\x45\x01'
    dados += ('=' * 30 + '\n').encode('cp850', errors='replace')
    dados += ('RESUMO DA COMANDA\n').encode('cp850', errors='replace')
    dados += ('=' * 30 + '\n').encode('cp850', errors='replace')
    # Negrito off
    dados += b'\x1b\x45\x00'
    # Alinhar esquerda
    dados += b'\x1b\x61\x00'
    dados += (f'Comanda: #{comanda["numero"]}\n').encode('cp850', errors='replace')
    dados += (f'Cliente: {comanda["cliente"]}\n').encode('cp850', errors='replace')
    dados += (f'Data: {datetime.now().strftime("%d/%m/%Y %H:%M")}\n').encode('cp850', errors='replace')
    dados += (f'Status: {status_traduzido}\n').encode('cp850', errors='replace')
    dados += ('-' * 30 + '\n').encode('cp850', errors='replace')
    dados += ('Item                           Qtd   Total\n').encode('cp850', errors='replace')
    
    for item in comanda['itens']:
        nome = item["produto_nome"]
        nome_limitado = (nome[:28] + '..') if len(nome) > 30 else nome.ljust(30)
        qtd_str = str(item["quantidade"]).center(3)
        total_str = f'R$ {item["subtotal"]:>7.2f}'.replace('.', ',')
        dados += (f'{nome_limitado} {qtd_str} {total_str}\n').encode('cp850', errors='replace')
        if item.get('observacao'):
            dados += (f'  Obs: {item["observacao"]}\n').encode('cp850', errors='replace')
    
    dados += ('-' * 30 + '\n').encode('cp850', errors='replace')
    # Negrito on
    dados += b'\x1b\x45\x01'
    # Fonte aumentar
    dados += b'\x1b\x21\x11'
    dados += (f'Total: R$ {comanda["total"]:.2f}\n'.replace('.', ',')).encode('cp850', errors='replace')
    # Fonte normal
    dados += b'\x1b\x21\x00'
    dados += (f'Pagamento: {pagamento_traduzido}\n').encode('cp850', errors='replace')
    # Negrito off
    dados += b'\x1b\x45\x00'
    # Alinhar centro
    dados += b'\x1b\x61\x01'
    dados += ('=' * 30 + '\n').encode('cp850', errors='replace')
    # Cortar papel
    dados += b'\x1d\x56\x41\x00'
    
    return bytes(dados)


def gerar_escpos_recibo(comanda):
    """Gera os dados ESC/POS para recibo"""
    dados = bytearray()
    
    # Inicializar
    dados += b'\x1b\x40'
    # Alinhar centro
    dados += b'\x1b\x61\x01'
    # Negrito on
    dados += b'\x1b\x45\x01'
    dados += ('=' * 30 + '\n').encode('cp850', errors='replace')
    dados += ('TOCA DO LOBO\n').encode('cp850', errors='replace')
    dados += ('=' * 30 + '\n').encode('cp850', errors='replace')
    # Negrito off
    dados += b'\x1b\x45\x00'
    # Alinhar esquerda
    dados += b'\x1b\x61\x00'
    dados += (f'Comanda: #{comanda["numero"]}\n').encode('cp850', errors='replace')
    dados += (f'Cliente: {comanda["cliente"]}\n').encode('cp850', errors='replace')
    dados += (f'Data: {datetime.now().strftime("%d/%m/%Y %H:%M")}\n').encode('cp850', errors='replace')
    dados += ('-' * 30 + '\n').encode('cp850', errors='replace')
    
    for item in comanda['itens']:
        dados += (f'{item["quantidade"]}x {item["produto_nome"]}\n').encode('cp850', errors='replace')
        dados += (f'  R$ {item["subtotal"]:.2f}\n'.replace('.', ',')).encode('cp850', errors='replace')
    
    dados += ('-' * 30 + '\n').encode('cp850', errors='replace')
    # Negrito on
    dados += b'\x1b\x45\x01'
    dados += (f'Total: R$ {comanda["total"]:.2f}\n'.replace('.', ',')).encode('cp850', errors='replace')
    # Negrito off
    dados += b'\x1b\x45\x00'
    dados += (f'Pagamento: {comanda["forma_pagamento"]}\n').encode('cp850', errors='replace')
    # Alinhar centro
    dados += b'\x1b\x61\x01'
    dados += ('=' * 30 + '\n').encode('cp850', errors='replace')
    dados += ('Obrigado pela preferência!\n').encode('cp850', errors='replace')
    # Cortar papel
    dados += b'\x1d\x56\x41\x00'
    
    return bytes(dados)


def gerar_escpos_fechamento(dados_fechamento):
    """Gera os dados ESC/POS para fechamento de caixa"""
    dados = bytearray()
    
    titulo = dados_fechamento.get('titulo', 'FECHAMENTO DE CAIXA')
    data_inicio = dados_fechamento.get('data_inicio', '')
    data_fim = dados_fechamento.get('data_fim', '')
    total_vendido = dados_fechamento.get('total_vendido', 0)
    itens = dados_fechamento.get('itens', [])
    
    # Inicializar
    dados += b'\x1b\x40'
    # Alinhar centro
    dados += b'\x1b\x61\x01'
    # Negrito on
    dados += b'\x1b\x45\x01'
    dados += ('=' * 30 + '\n').encode('cp850', errors='replace')
    dados += (f'{titulo}\n').encode('cp850', errors='replace')
    dados += ('=' * 30 + '\n').encode('cp850', errors='replace')
    # Negrito off
    dados += b'\x1b\x45\x00'
    # Alinhar esquerda
    dados += b'\x1b\x61\x00'
    dados += (f'Inicio: {data_inicio}\n').encode('cp850', errors='replace')
    dados += (f'Fim:    {data_fim}\n').encode('cp850', errors='replace')
    dados += ('-' * 30 + '\n').encode('cp850', errors='replace')
    dados += ('Item                           Qtd   Total\n').encode('cp850', errors='replace')
    
    for item in itens:
        nome = item.get("nome", item.get("produto_nome", "Item"))
        nome_limitado = (nome[:28] + '..') if len(nome) > 30 else nome.ljust(30)
        qtd_str = str(item["quantidade"]).center(3)
        total_str = f'R$ {item["total"]:>7.2f}'.replace('.', ',')
        dados += (f'{nome_limitado} {qtd_str} {total_str}\n').encode('cp850', errors='replace')
    
    dados += ('-' * 30 + '\n').encode('cp850', errors='replace')
    # Negrito on
    dados += b'\x1b\x45\x01'
    # Fonte aumentar
    dados += b'\x1b\x21\x11'
    dados += (f'TOTAL GERAL: R$ {total_vendido:.2f}\n'.replace('.', ',')).encode('cp850', errors='replace')
    # Fonte normal
    dados += b'\x1b\x21\x00'
    # Negrito off
    dados += b'\x1b\x45\x00'
    # Alinhar centro
    dados += b'\x1b\x61\x01'
    dados += ('=' * 30 + '\n').encode('cp850', errors='replace')
    # Cortar papel
    dados += b'\x1d\x56\x41\x00'
    
    return bytes(dados)


def imprimir_comanda_direto(comanda):
    config = carregar_config()
    impressora = get_impressora()
    if not impressora:
        return False
    
    # Se for ESP32, adicionar na fila
    if config['tipo'] == 'esp32':
        try:
            dados_escpos = gerar_escpos_comanda(comanda)
            adicionar_na_fila('comanda', dados_escpos)
            return True
        except Exception as e:
            print(f'Erro ao adicionar na fila ESP32: {e}')
            return False
    
    try:
        status_traduzido = {
            "aberta": "ABERTA",
            "fechada": "FECHADA",
            "aguardando_cozinha": "AGUARDANDO COZINHA"
        }.get(comanda.get("status", "aberta"), comanda.get("status", "aberta").upper())

        pagamento_traduzido = {
            "dinheiro": "DINHEIRO",
            "pix": "PIX",
            "cartao": "CARTÃO",
            "marcar": "MARCADO"
        }.get(comanda.get("forma_pagamento"), "N/A")

        if config['tipo'] == 'ethernet':
            impressora.inicializar()
            impressora.alinhar_centro()
            impressora.negrito_ligar()
            impressora.texto('=' * 30)
            impressora.texto('RESUMO DA COMANDA')
            impressora.texto('=' * 30)
            impressora.negrito_desligar()
            impressora.alinhar_esquerda()
            impressora.texto(f'Comanda: #{comanda["numero"]}')
            impressora.texto(f'Cliente: {comanda["cliente"]}')
            impressora.texto(f'Data: {datetime.now().strftime("%d/%m/%Y %H:%M")}')
            impressora.texto(f'Status: {status_traduzido}')
            impressora.texto('-' * 30)
            
            # Cabeçalho da tabela de itens (Aprox 48 colunas para 80mm)
            impressora.texto('Item                           Qtd   Total')
            
            for item in comanda['itens']:
                nome = item["produto_nome"]
                # Aumentado para 30 caracteres
                nome_limitado = (nome[:28] + '..') if len(nome) > 30 else nome.ljust(30)
                qtd_str = str(item["quantidade"]).center(3)
                total_str = f'R$ {item["subtotal"]:>7.2f}'.replace('.', ',')
                impressora.texto(f'{nome_limitado} {qtd_str} {total_str}')
                if item.get('observacao'):
                    impressora.texto(f'  Obs: {item["observacao"]}')
            
            impressora.texto('-' * 30)
            impressora.negrito_ligar()
            impressora.fonte_aumentar()
            impressora.texto(f'Total: R$ {comanda["total"]:.2f}'.replace('.', ','))
            impressora.fonte_normal()
            impressora.texto(f'Pagamento: {pagamento_traduzido}')
            impressora.negrito_desligar()
            impressora.alinhar_centro()
            impressora.texto('=' * 30)
            impressora.cortar_papel()
            impressora.desconectar()
            return True
        else:
            try:
                impressora.set(align='center')
                impressora.text('=' * 30 + '\n')
                impressora.text('RESUMO DA COMANDA\n')
                impressora.text('=' * 30 + '\n')
                impressora.set(align='left')
                impressora.text(f'Comanda: #{comanda["numero"]}\n')
                impressora.text(f'Cliente: {comanda["cliente"]}\n')
                impressora.text(f'Data: {datetime.now().strftime("%d/%m/%Y %H:%M")}\n')
                impressora.text(f'Status: {status_traduzido}\n')
                impressora.text('-' * 30 + '\n')
                
                # Cabeçalho da tabela de itens
                impressora.text('Item                           Qtd   Total\n')

                for item in comanda['itens']:
                    nome = item["produto_nome"]
                    nome_limitado = (nome[:28] + '..') if len(nome) > 30 else nome.ljust(30)
                    qtd_str = str(item["quantidade"]).center(3)
                    total_str = f'R$ {item["subtotal"]:>7.2f}'.replace('.', ',')
                    impressora.text(f'{nome_limitado} {qtd_str} {total_str}\n')
                    if item.get('observacao'):
                        impressora.text(f'  Obs: {item["observacao"]}\n')
                
                impressora.text('-' * 30 + '\n')
                impressora.text(f'Total: R$ {comanda["total"]:.2f}\n'.replace('.', ','))
                impressora.text(f'Pagamento: {pagamento_traduzido}\n')
                impressora.text('=' * 30 + '\n')
                impressora.cut()
                return True
            finally:
                try:
                    impressora.close()
                except:
                    pass
    except Exception as e:
        print(f'Erro ao imprimir comanda: {e}')
        return False
    finally:
        if config['tipo'] == 'ethernet':
            try:
                impressora.desconectar()
            except:
                pass


def imprimir_recibo_direto(comanda):
    config = carregar_config()
    impressora = get_impressora()
    if not impressora:
        return False
    
    # Se for ESP32, adicionar na fila
    if config['tipo'] == 'esp32':
        try:
            dados_escpos = gerar_escpos_recibo(comanda)
            adicionar_na_fila('recibo', dados_escpos)
            return True
        except Exception as e:
            print(f'Erro ao adicionar na fila ESP32: {e}')
            return False
    
    try:
        if config['tipo'] == 'ethernet':
            impressora.inicializar()
            impressora.alinhar_centro()
            impressora.negrito_ligar()
            impressora.texto('=' * 30)
            impressora.texto('TOCA DO LOBO')
            impressora.texto('=' * 30)
            impressora.negrito_desligar()
            impressora.alinhar_esquerda()
            impressora.texto(f'Comanda: #{comanda["numero"]}')
            impressora.texto(f'Cliente: {comanda["cliente"]}')
            impressora.texto(f'Data: {datetime.now().strftime("%d/%m/%Y %H:%M")}')
            impressora.texto('-' * 30)
            
            for item in comanda['itens']:
                impressora.texto(f'{item["quantidade"]}x {item["produto_nome"]}')
                impressora.texto(f'  R$ {item["subtotal"]:.2f}'.replace('.', ','))
            
            impressora.texto('-' * 30)
            impressora.negrito_ligar()
            impressora.texto(f'Total: R$ {comanda["total"]:.2f}'.replace('.', ','))
            impressora.negrito_desligar()
            impressora.texto(f'Pagamento: {comanda["forma_pagamento"]}')
            impressora.alinhar_centro()
            impressora.texto('=' * 30)
            impressora.texto('Obrigado pela preferência!')
            impressora.cortar_papel()
            impressora.desconectar()
            return True
        else:
            try:
                impressora.set(align='center')
                impressora.text('=' * 30 + '\n')
                impressora.text('TOCA DO LOBO\n')
                impressora.text('=' * 30 + '\n')
                impressora.set(align='left')
                impressora.text(f'Comanda: #{comanda["numero"]}\n')
                impressora.text(f'Cliente: {comanda["cliente"]}\n')
                impressora.text(f'Data: {datetime.now().strftime("%d/%m/%Y %H:%M")}\n')
                impressora.text('-' * 30 + '\n')
                
                for item in comanda['itens']:
                    impressora.text(f'{item["quantidade"]}x {item["produto_nome"]}\n')
                    impressora.text(f'  R$ {item["subtotal"]:.2f}\n'.replace('.', ','))
                
                impressora.text('-' * 30 + '\n')
                impressora.text(f'Total: R$ {comanda["total"]:.2f}\n'.replace('.', ','))
                impressora.text(f'Pagamento: {comanda["forma_pagamento"]}\n')
                impressora.text('=' * 30 + '\n')
                impressora.text('Obrigado pela preferência!\n')
                impressora.cut()
                return True
            finally:
                try:
                    impressora.close()
                except:
                    pass
    except Exception as e:
        print(f'Erro ao imprimir recibo: {e}')
        return False
    finally:
        if config['tipo'] == 'ethernet':
            try:
                impressora.desconectar()
            except:
                pass


def imprimir_fechamento_direto(dados):
    config = carregar_config()
    impressora = get_impressora()
    if not impressora:
        return False
    
    # Se for ESP32, adicionar na fila
    if config['tipo'] == 'esp32':
        try:
            dados_escpos = gerar_escpos_fechamento(dados)
            adicionar_na_fila('fechamento', dados_escpos)
            return True
        except Exception as e:
            print(f'Erro ao adicionar na fila ESP32: {e}')
            return False
    
    try:
        titulo = dados.get('titulo', 'FECHAMENTO DE CAIXA')
        data_inicio = dados.get('data_inicio', '')
        data_fim = dados.get('data_fim', '')
        total_vendido = dados.get('total_vendido', 0)
        itens = dados.get('itens', [])

        if config['tipo'] == 'ethernet':
            impressora.inicializar()
            impressora.alinhar_centro()
            impressora.negrito_ligar()
            impressora.texto('=' * 30)
            impressora.texto(titulo)
            impressora.texto('=' * 30)
            impressora.negrito_desligar()
            impressora.alinhar_esquerda()
            impressora.texto(f'Inicio: {data_inicio}')
            impressora.texto(f'Fim:    {data_fim}')
            impressora.texto('-' * 30)
            
            # Cabeçalho da tabela de itens
            impressora.texto('Item                           Qtd   Total')
            
            for item in itens:
                nome = item.get("nome", item.get("produto_nome", "Item"))
                nome_limitado = (nome[:28] + '..') if len(nome) > 30 else nome.ljust(30)
                qtd_str = str(item["quantidade"]).center(3)
                total_str = f'R$ {item["total"]:>7.2f}'.replace('.', ',')
                impressora.texto(f'{nome_limitado} {qtd_str} {total_str}')
            
            impressora.texto('-' * 30)
            impressora.negrito_ligar()
            impressora.fonte_aumentar()
            impressora.texto(f'TOTAL GERAL: R$ {total_vendido:.2f}'.replace('.', ','))
            impressora.fonte_normal()
            impressora.negrito_desligar()
            impressora.alinhar_centro()
            impressora.texto('=' * 30)
            impressora.cortar_papel()
            impressora.desconectar()
            return True
        else:
            try:
                impressora.set(align='center')
                impressora.text('=' * 30 + '\n')
                impressora.text(f'{titulo}\n')
                impressora.text('=' * 30 + '\n')
                impressora.set(align='left')
                impressora.text(f'Inicio: {data_inicio}\n')
                impressora.text(f'Fim:    {data_fim}\n')
                impressora.text('-' * 30 + '\n')
                
                # Cabeçalho da tabela de itens
                impressora.text('Item                           Qtd   Total\n')

                for item in itens:
                    nome = item.get("nome", item.get("produto_nome", "Item"))
                    nome_limitado = (nome[:28] + '..') if len(nome) > 30 else nome.ljust(30)
                    qtd_str = str(item["quantidade"]).center(3)
                    total_str = f'R$ {item["total"]:>7.2f}'.replace('.', ',')
                    impressora.text(f'{nome_limitado} {qtd_str} {total_str}\n')
                
                impressora.text('-' * 30 + '\n')
                impressora.text(f'TOTAL GERAL: R$ {total_vendido:.2f}\n'.replace('.', ','))
                impressora.text('=' * 30 + '\n')
                impressora.cut()
                return True
            finally:
                try:
                    impressora.close()
                except:
                    pass
    except Exception as e:
        print(f'Erro ao imprimir fechamento: {e}')
        return False
    finally:
        if config['tipo'] == 'ethernet':
            try:
                impressora.desconectar()
            except:
                pass
