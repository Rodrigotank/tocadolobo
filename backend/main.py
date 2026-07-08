import sys
import os
from pathlib import Path

from fastapi import FastAPI, Depends, HTTPException, Request, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import JSONResponse, FileResponse
import asyncio
import shutil
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime, time, timedelta
from sqlalchemy import cast, String, text, inspect
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

try:
    from .models import SessionLocal, init_db, Comanda, ItemComanda, Produto, Categoria, Usuario, Configuracao, Fechamento, Log, NotaFiscalProcessada, FilaImpressao, DispositivoESP32
    from .impressao import imprimir_cozinha_direto, imprimir_comanda_direto, imprimir_recibo_direto, imprimir_fechamento_direto
except ImportError:
    from models import SessionLocal, init_db, Comanda, ItemComanda, Produto, Categoria, Usuario, Configuracao, Fechamento, Log, NotaFiscalProcessada, FilaImpressao, DispositivoESP32
    from impressao import imprimir_cozinha_direto, imprimir_comanda_direto, imprimir_recibo_direto, imprimir_fechamento_direto

# Para upload de imagens
from fastapi import File, UploadFile
from fastapi.responses import FileResponse
import uuid
import shutil
from PIL import Image
from io import BytesIO

try:
    from config_impressora import carregar_config, salvar_config
except ImportError:
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).parent.parent))
    from config_impressora import carregar_config, salvar_config

app = FastAPI(title="Sistema de Caixa - Bar/Lanchonete")

base_dir = Path(__file__).parent.parent
static_dir = base_dir / "frontend" / "static"
templates_dir = base_dir / "frontend" / "templates"
uploads_dir = base_dir / "uploads"

# Cria diretório de uploads se não existir
uploads_dir.mkdir(exist_ok=True)

templates = Jinja2Templates(directory=str(templates_dir))

# Tipos de arquivos permitidos (apenas imagens)
TIPOS_PERMITIDOS = {"jpeg", "jpg", "png", "gif", "webp"}
TAMANHO_MAXIMO = 5 * 1024 * 1024  # 5MB

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.on_event("startup")
async def startup_event():
    init_db()
    
    # Migração manual (adicionar colunas se não existirem)
    db = SessionLocal()
    try:
        inspector = inspect(db.bind)
        columns = [c['name'] for c in inspector.get_columns('produtos')]
        
        if "ean" not in columns:
            db.execute(text("ALTER TABLE produtos ADD COLUMN ean VARCHAR(100)"))
        if "fator_conversao" not in columns:
            db.execute(text("ALTER TABLE produtos ADD COLUMN fator_conversao FLOAT DEFAULT 1.0"))
        if "imagem_url" not in columns:
            db.execute(text("ALTER TABLE produtos ADD COLUMN imagem_url VARCHAR(255)"))
        
        db.commit()
    except Exception as e:
        print(f"Erro na migração: {e}")
        db.rollback()
    finally:
        db.close()

    # Inicia a rotina de backup automático em segundo plano
    asyncio.create_task(rotina_backup_automatico())

async def rotina_backup_automatico():
    """Verifica a cada hora se já existe um backup do dia atual. Se não existir, cria um."""
    while True:
        try:
            backup_dir = base_dir / "backups"
            backup_dir.mkdir(exist_ok=True)
            
            hoje = datetime.now().strftime("%Y%m%d")
            ja_existe = False
            
            # Verifica se já existe um arquivo com a data de hoje no nome
            for f in backup_dir.glob(f"auto_backup_{hoje}*.zip"):
                ja_existe = True
                break
            
            if not ja_existe:
                print(f"[{datetime.now()}] Iniciando backup automático diário...")
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                zip_filename = f"auto_backup_{timestamp}.zip"
                zip_path = backup_dir / zip_filename
                
                with zipfile.ZipFile(zip_path, 'w') as zipf:
                    # Se for SQLite, faz backup do arquivo .db
                    db_url = os.getenv("DATABASE_URL", "")
                    if not db_url or db_url.startswith("sqlite"):
                        db_file = base_dir / "caixa_bar.db"
                        if db_file.exists():
                            zipf.write(db_file, arcname="caixa_bar.db")
                    else:
                        # Se for MySQL, apenas cria um arquivo texto indicando que o backup deve ser via mysqldump
                        zipf.writestr("BACKUP_INFO.txt", f"Backup realizado em {datetime.now()}. O banco de dados MySQL deve ser backapeado via mysqldump.")
                    
                    config_file = base_dir / "impressora.json"
                    if config_file.exists():
                        zipf.write(config_file, arcname="impressora.json")
                
                print(f"[{datetime.now()}] Backup automático concluído: {zip_filename}")
                
                # Limpeza: Mantém apenas os últimos 30 backups automáticos para não lotar o disco
                backups_auto = sorted(list(backup_dir.glob("auto_backup_*.zip")), reverse=True)
                if len(backups_auto) > 30:
                    for old_backup in backups_auto[30:]:
                        old_backup.unlink()
                        print(f"Removendo backup antigo: {old_backup.name}")

        except Exception as e:
            print(f"Erro na rotina de backup: {e}")
            
        # Espera 1 hora antes de verificar novamente
        await asyncio.sleep(3600)

@app.get("/api/sistema/backups/listar")
async def listar_backups():
    try:
        backup_dir = base_dir / "backups"
        if not backup_dir.exists():
            return []
        
        backups = []
        for f in backup_dir.glob("*.zip"):
            stats = f.stat()
            backups.append({
                "nome": f.name,
                "tamanho": f"{stats.st_size / 1024 / 1024:.2f} MB",
                "data": datetime.fromtimestamp(stats.st_mtime).strftime("%d/%m/%Y %H:%M:%S"),
                "tipo": "Automático" if f.name.startswith("auto_") else "Manual"
            })
        
        # Ordena pelos mais recentes
        backups.sort(key=lambda x: x['nome'], reverse=True)
        return backups
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/sistema/backups")
async def listar_backups_compat():
    return await listar_backups()

@app.get("/api/sistema/backups/download/{nome}")
async def download_backup_especifico(nome: str):
    try:
        backup_path = base_dir / "backups" / nome
        if not backup_path.exists():
            raise HTTPException(status_code=404, detail="Arquivo não encontrado")
            
        return FileResponse(
            path=backup_path, 
            filename=nome, 
            media_type='application/zip'
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ComandaCreate(BaseModel):
    cliente: str
    mesa: Optional[str] = None

class ItemComandaCreate(BaseModel):
    produto_id: int
    quantidade: int = 1
    observacao: Optional[str] = None

class FechamentoComanda(BaseModel):
    forma_pagamento: str
    valor_pago: Optional[float] = None

class ConfigUpdate(BaseModel):
    hora_inicio: Optional[str] = None
    hora_fim: Optional[str] = None
    nome_estabelecimento: Optional[str] = None
    endereco_estabelecimento: Optional[str] = None
    telefone_estabelecimento: Optional[str] = None

class ProdutoCreateUpdate(BaseModel):
    nome: str
    preco: float
    categoria_id: int
    e_cozinha: bool = False
    estoque_atual: Optional[float] = 0.0
    estoque_minimo: Optional[float] = 0.0
    ean: Optional[str] = None
    fator_conversao: Optional[float] = 1.0
    imagem_url: Optional[str] = None

class ItemXML(BaseModel):
    cProd: str
    xProd: str
    NCM: str
    cEAN: str
    uCom: str
    qCom: float
    vUnCom: float
    vProd: float
    # Campos para mapeamento no sistema
    produto_id: Optional[int] = None
    fator_conversao: float = 1.0
    criar_novo: bool = False
    categoria_id: Optional[int] = None

class ProcessarXML(BaseModel):
    chave_acesso: str
    itens: List[ItemXML]
    total_nota: float

# Schemas para ESP32
class ESP32Registro(BaseModel):
    nome: str
    mac_address: str
    ip_local: Optional[str] = None
    impressora_ip: str = "192.168.88.29"
    impressora_porta: int = 9100
    intervalo_verificacao: int = 5000


class ESP32ConfiguracaoUpdate(BaseModel):
    nome: Optional[str] = None
    impressora_ip: Optional[str] = None
    impressora_porta: Optional[int] = None
    intervalo_verificacao: Optional[int] = None


# Senha Master
SENHA_MASTER = "43r0moc@"

class EstoqueAjuste(BaseModel):
    produto_id: int
    quantidade: float
    tipo: str  # 'entrada' ou 'saida' ou 'balanco'

@app.get("/")
async def read_root(request: Request, db: Session = Depends(get_db)):
    # Se o acesso for pela porta 8888, exibe o cardápio automaticamente
    host = request.headers.get("host", "")
    if ":8888" in host:
        return await cardapio_virtual(request, db)
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/cardapio")
async def cardapio_route(request: Request, db: Session = Depends(get_db)):
    """Rota direta para o cardápio virtual"""
    return await cardapio_virtual(request, db)

@app.get("/admin")
async def admin_panel(request: Request):
    return templates.TemplateResponse("admin.html", {"request": request})

@app.get("/api/comandas")
async def get_comandas(db: Session = Depends(get_db)):
    comandas = db.query(Comanda).order_by(Comanda.id.desc()).all()
    result = []
    for c in comandas:
        total = 0
        for item in c.itens:
            if item.produto:
                total += item.produto.preco * item.quantidade
        
        result.append({
            "id": c.id,
            "numero": c.numero,
            "cliente": c.cliente,
            "mesa": c.mesa,
            "status": c.status,
            "data_abertura": c.data_abertura.isoformat(),
            "data_aguardando": c.data_aguardando.isoformat() if c.data_aguardando else None,
            "total": total,
            "forma_pagamento": c.forma_pagamento
        })
    return result

@app.get("/api/comandas/{comanda_id}")
async def get_comanda(comanda_id: int, db: Session = Depends(get_db)):
    comanda = db.query(Comanda).filter(Comanda.id == comanda_id).first()
    if not comanda:
        raise HTTPException(status_code=404, detail="Comanda não encontrada")
    
    # Força a atualização dos dados para garantir que os itens recém-adicionados apareçam
    db.refresh(comanda)
    
    itens = []
    for item in comanda.itens:
        if item.produto:
            itens.append({
                "id": item.id,
                "produto_id": item.produto_id,
                "produto_nome": item.produto.nome,
                "quantidade": item.quantidade,
                "preco_unitario": item.produto.preco,
                "subtotal": item.produto.preco * item.quantidade,
                "observacao": item.observacao,
                "e_cozinha": item.produto.e_cozinha,
                "entregue": item.entregue
            })
    
    total = sum(item["subtotal"] for item in itens)
    
    return {
        "id": comanda.id,
        "numero": comanda.numero,
        "cliente": comanda.cliente,
        "mesa": comanda.mesa,
        "status": comanda.status,
        "data_abertura": comanda.data_abertura.isoformat(),
        "data_aguardando": comanda.data_aguardando.isoformat() if comanda.data_aguardando else None,
        "data_fechamento": comanda.data_fechamento.isoformat() if comanda.data_fechamento else None,
        "itens": itens,
        "total": total,
        "forma_pagamento": comanda.forma_pagamento
    }

@app.post("/api/comandas")
async def create_comanda(comanda: ComandaCreate, request: Request, db: Session = Depends(get_db)):
    usuario = request.headers.get("X-User", "Sistema")
    ultima_comanda = db.query(Comanda).order_by(Comanda.id.desc()).first()
    novo_numero = (ultima_comanda.numero + 1) if ultima_comanda else 1
    
    nova_comanda = Comanda(
        numero=novo_numero,
        cliente=comanda.cliente,
        mesa=comanda.mesa,
        status="aberta"
    )
    db.add(nova_comanda)
    db.commit()
    db.refresh(nova_comanda)
    
    registrar_log(db, usuario, "venda", f"Abriu comanda #{nova_comanda.numero} para {nova_comanda.cliente}")
    return {"id": nova_comanda.id, "numero": nova_comanda.numero}

@app.post("/api/comandas/{comanda_id}/itens")
async def add_item(comanda_id: int, item_data: ItemComandaCreate, request: Request, db: Session = Depends(get_db)):
    usuario = request.headers.get("X-User", "Sistema")
    comanda = db.query(Comanda).filter(Comanda.id == comanda_id).first()
    if not comanda:
        raise HTTPException(status_code=404, detail="Comanda não encontrada")
    
    if comanda.status == "fechada":
        raise HTTPException(status_code=400, detail="Não é possível adicionar itens a uma comanda fechada!")
    
    produto = db.query(Produto).filter(Produto.id == item_data.produto_id).first()
    if not produto:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    
    novo_item = ItemComanda(
        comanda_id=comanda_id,
        produto_id=item_data.produto_id,
        quantidade=item_data.quantidade,
        observacao=item_data.observacao,
        entregue=False
    )
    db.add(novo_item)
    db.commit()
    
    registrar_log(db, usuario, "venda", f"Adicionou {item_data.quantidade}x {produto.nome} na comanda #{comanda.numero}")
    
    # Força a atualização da comanda para que o novo item seja incluído na lista de itens
    db.refresh(comanda)
    
    atualizar_status_comanda(comanda_id, db)
    
    return {"id": novo_item.id, "status": comanda.status}

def atualizar_status_comanda(comanda_id, db):
    comanda = db.query(Comanda).filter(Comanda.id == comanda_id).first()
    if not comanda:
        return
    
    itens_cozinha_nao_entregues = db.query(ItemComanda).join(Produto).filter(
        ItemComanda.comanda_id == comanda_id,
        Produto.e_cozinha == True,
        ItemComanda.entregue == False
    ).all()
    
    if len(itens_cozinha_nao_entregues) > 0:
        if comanda.status != "aguardando_cozinha":
            comanda.data_aguardando = datetime.now()
        comanda.status = "aguardando_cozinha"
    elif comanda.status != "fechada":
        comanda.status = "aberta"
        comanda.data_aguardando = None
    
    db.commit()

@app.delete("/api/comandas/{comanda_id}/itens/{item_id}")
async def remove_item(comanda_id: int, item_id: int, request: Request, db: Session = Depends(get_db)):
    usuario = request.headers.get("X-User", "Sistema")
    comanda = db.query(Comanda).filter(Comanda.id == comanda_id).first()
    if not comanda:
        raise HTTPException(status_code=404, detail="Comanda não encontrada")
    
    if comanda.status == "fechada":
        raise HTTPException(status_code=400, detail="Não é possível remover itens de uma comanda fechada!")

    item = db.query(ItemComanda).filter(ItemComanda.id == item_id, ItemComanda.comanda_id == comanda_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item não encontrado")
    
    nome_prod = item.produto.nome if item.produto else "Produto"
    db.delete(item)
    db.commit()
    
    registrar_log(db, usuario, "cancelamento", f"Removeu {item.quantidade}x {nome_prod} da comanda #{comanda.numero}")
    
    atualizar_status_comanda(comanda_id, db)
    
    return {"message": "Item removido com sucesso"}

@app.post("/api/comandas/{comanda_id}/entregar")
async def entregar_comanda(comanda_id: int, request: Request, db: Session = Depends(get_db)):
    usuario = request.headers.get("X-User", "Sistema")
    comanda = db.query(Comanda).filter(Comanda.id == comanda_id).first()
    if not comanda:
        raise HTTPException(status_code=404, detail="Comanda não encontrada")
    
    if comanda.status == "fechada":
        raise HTTPException(status_code=400, detail="Comanda já está fechada!")
    
    itens_cozinha_nao_entregues = db.query(ItemComanda).join(Produto).filter(
        ItemComanda.comanda_id == comanda_id,
        Produto.e_cozinha == True,
        ItemComanda.entregue == False
    ).all()
    
    for item in itens_cozinha_nao_entregues:
        item.entregue = True
    
    db.commit()
    
    registrar_log(db, usuario, "venda", f"Marcar entregue itens de cozinha da comanda #{comanda.numero}")
    
    atualizar_status_comanda(comanda_id, db)
    
    db.refresh(comanda)
    
    return {"message": "Itens marcados como entregues!", "status": comanda.status}

@app.post("/api/comandas/{comanda_id}/fechar")
async def fechar_comanda(comanda_id: int, fechamento: FechamentoComanda, request: Request, db: Session = Depends(get_db)):
    usuario = request.headers.get("X-User", "Sistema")
    comanda = db.query(Comanda).filter(Comanda.id == comanda_id).first()
    if not comanda:
        raise HTTPException(status_code=404, detail="Comanda não encontrada")
    
    if comanda.status == "fechada":
        raise HTTPException(status_code=400, detail="Esta comanda já foi fechada e não pode ser alterada!")
    
    if fechamento.forma_pagamento != "marcar" and comanda.status == "aguardando_cozinha":
        raise HTTPException(status_code=400, detail="Comanda está aguardando entrega! Marque como entregue primeiro.")
    
    total = sum(item.produto.preco * item.quantidade for item in comanda.itens)
    comanda.total = total
    comanda.forma_pagamento = fechamento.forma_pagamento
    
    if fechamento.forma_pagamento == "marcar":
        message = "Comanda marcada para pagar depois"
        registrar_log(db, usuario, "venda", f"Marcou comanda #{comanda.numero} (Total: R$ {total:.2f})")
    else:
        # Baixa no estoque
        for item in comanda.itens:
            if item.produto:
                item.produto.estoque_atual -= item.quantidade
                
        comanda.status = "fechada"
        comanda.data_fechamento = datetime.now()
        message = "Comanda fechada com sucesso"
        registrar_log(db, usuario, "finalizacao", f"Finalizou comanda #{comanda.numero} via {fechamento.forma_pagamento} (Total: R$ {total:.2f})")
    
    db.commit()
    db.refresh(comanda)
    
    return {"message": message, "total": total, "status": comanda.status}

@app.post("/api/estoque/xml/ler")
async def ler_xml_estoque(file: UploadFile = File(...), db: Session = Depends(get_db)):
    try:
        content = await file.read()
        root = ET.fromstring(content)
        
        # Namespace da NFe
        ns = {'nfe': 'http://www.portalfiscal.inf.br/nfe'}
        
        # Chave de Acesso (Id da tag infNFe)
        infNFe = root.find('.//nfe:infNFe', ns)
        if infNFe is None:
            raise HTTPException(status_code=400, detail="XML inválido: tag infNFe não encontrada")
        
        chave_acesso = infNFe.attrib.get('Id', '').replace('NFe', '')
        
        # Verificar se a nota já foi processada
        existente = db.query(NotaFiscalProcessada).filter(NotaFiscalProcessada.chave_acesso == chave_acesso).first()
        if existente:
            raise HTTPException(status_code=400, detail=f"Esta Nota Fiscal já foi processada em {existente.data_processamento.strftime('%d/%m/%Y')}")

        # Total da Nota
        total_nota = 0.0
        vNF = root.find('.//nfe:total/nfe:ICMSTot/nfe:vNF', ns)
        if vNF is not None:
            total_nota = float(vNF.text)

        # Itens da Nota
        itens = []
        det_list = root.findall('.//nfe:det', ns)
        for det in det_list:
            prod = det.find('nfe:prod', ns)
            if prod is not None:
                cEAN = prod.find('nfe:cEAN', ns).text if prod.find('nfe:cEAN', ns) is not None else ""
                # Se for SEM GTIN, tratar como vazio
                if cEAN == "SEM GTIN": cEAN = ""
                
                item_xml = {
                    "cProd": prod.find('nfe:cProd', ns).text,
                    "xProd": prod.find('nfe:xProd', ns).text,
                    "NCM": prod.find('nfe:NCM', ns).text if prod.find('nfe:NCM', ns) is not None else "",
                    "cEAN": cEAN,
                    "uCom": prod.find('nfe:uCom', ns).text,
                    "qCom": float(prod.find('nfe:qCom', ns).text),
                    "vUnCom": float(prod.find('nfe:vUnCom', ns).text),
                    "vProd": float(prod.find('nfe:vProd', ns).text),
                    "produto_id": None,
                    "fator_conversao": 1.0
                }
                
                # Tentar encontrar produto pelo EAN
                if cEAN:
                    produto_sistema = db.query(Produto).filter(Produto.ean == cEAN).first()
                    if produto_sistema:
                        item_xml["produto_id"] = produto_sistema.id
                        item_xml["fator_conversao"] = produto_sistema.fator_conversao
                
                itens.append(item_xml)
                
        return {
            "chave_acesso": chave_acesso,
            "total_nota": total_nota,
            "itens": itens
        }
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=400, detail=f"Erro ao ler XML: {str(e)}")

@app.post("/api/estoque/xml/processar")
async def processar_xml_estoque(dados: ProcessarXML, request: Request, db: Session = Depends(get_db)):
    usuario = request.headers.get("X-User", "Sistema")
    
    # Verificar novamente a chave para evitar race conditions
    existente = db.query(NotaFiscalProcessada).filter(NotaFiscalProcessada.chave_acesso == dados.chave_acesso).first()
    if existente:
        raise HTTPException(status_code=400, detail="Esta Nota Fiscal já foi processada.")
    
    try:
        for item in dados.itens:
            produto = None
            
            # Se for para criar novo produto
            if item.criar_novo and item.categoria_id:
                # Verificar se já existe um produto com este nome ou EAN
                produto_existente = None
                if item.cEAN:
                    produto_existente = db.query(Produto).filter(Produto.ean == item.cEAN).first()
                
                if not produto_existente:
                    # Criar novo produto com preço sugerido (custo + margem 0 por padrão, usuário ajusta depois)
                    # Usamos vUnCom como preço inicial (preço de custo)
                    novo_produto = Produto(
                        nome=item.xProd,
                        preco=item.vUnCom, # Preço de custo inicial
                        categoria_id=item.categoria_id,
                        ean=item.cEAN if item.cEAN else None,
                        estoque_atual=0.0,
                        fator_conversao=item.fator_conversao
                    )
                    db.add(novo_produto)
                    db.flush() # Para pegar o ID
                    produto = novo_produto
                    registrar_log(db, usuario, "manutencao", f"Produto criado via XML: {produto.nome}")
                else:
                    produto = produto_existente
            
            # Se já tem produto_id mapeado
            elif item.produto_id:
                produto = db.query(Produto).filter(Produto.id == item.produto_id).first()

            if produto:
                # Atualiza EAN se o produto não tinha
                if item.cEAN and not produto.ean:
                    produto.ean = item.cEAN
                
                # Calcula quantidade a adicionar
                qtd_adicionar = item.qCom * item.fator_conversao
                produto.estoque_atual += qtd_adicionar
                produto.fator_conversao = item.fator_conversao # Salva o fator usado para a próxima vez
                
                registrar_log(db, usuario, "estoque", f"Entrada XML: {produto.nome} +{qtd_adicionar} (NFe: {dados.chave_acesso})")
        
        # Registrar a nota como processada
        nova_nota = NotaFiscalProcessada(
            chave_acesso=dados.chave_acesso,
            valor_total=dados.total_nota
        )
        db.add(nova_nota)
        db.commit()
        
        return {"message": "Estoque atualizado com sucesso!"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao processar estoque: {str(e)}")

@app.get("/api/produtos")
async def get_produtos(db: Session = Depends(get_db)):
    produtos = db.query(Produto).all()
    result = []
    for p in produtos:
        result.append({
            "id": p.id,
            "nome": p.nome,
            "preco": p.preco,
            "categoria_id": p.categoria_id,
            "categoria_nome": p.categoria.nome if p.categoria else None,
            "e_cozinha": p.e_cozinha,
            "estoque_atual": p.estoque_atual,
            "estoque_minimo": p.estoque_minimo,
            "ean": p.ean,
            "fator_conversao": p.fator_conversao,
            "imagem_url": p.imagem_url
        })
    return result

@app.get("/api/produtos/{produto_id}")
async def get_produto(produto_id: int, db: Session = Depends(get_db)):
    produto = db.query(Produto).filter(Produto.id == produto_id).first()
    if not produto:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    return {
        "id": produto.id,
        "nome": produto.nome,
        "preco": produto.preco,
        "categoria_id": produto.categoria_id,
        "categoria_nome": produto.categoria.nome if produto.categoria else None,
        "e_cozinha": produto.e_cozinha,
        "estoque_atual": produto.estoque_atual,
        "estoque_minimo": produto.estoque_minimo,
        "ean": produto.ean,
        "fator_conversao": produto.fator_conversao,
        "imagem_url": produto.imagem_url
    }

@app.post("/api/produtos")
async def create_produto(produto: ProdutoCreateUpdate, request: Request, db: Session = Depends(get_db)):
    usuario = request.headers.get("X-User", "Sistema")
    novo_produto = Produto(
        nome=produto.nome,
        preco=produto.preco,
        categoria_id=produto.categoria_id,
        e_cozinha=produto.e_cozinha,
        estoque_atual=produto.estoque_atual,
        estoque_minimo=produto.estoque_minimo,
        ean=produto.ean,
        fator_conversao=produto.fator_conversao,
        imagem_url=produto.imagem_url
    )
    db.add(novo_produto)
    db.commit()
    db.refresh(novo_produto)
    registrar_log(db, usuario, "manutencao", f"Cadastrou produto: {novo_produto.nome}")
    return {
        "id": novo_produto.id,
        "nome": novo_produto.nome,
        "preco": novo_produto.preco,
        "categoria_id": novo_produto.categoria_id,
        "e_cozinha": novo_produto.e_cozinha,
        "estoque_atual": novo_produto.estoque_atual,
        "estoque_minimo": novo_produto.estoque_minimo,
        "ean": novo_produto.ean,
        "fator_conversao": novo_produto.fator_conversao,
        "imagem_url": novo_produto.imagem_url
    }

@app.put("/api/produtos/{produto_id}")
async def update_produto(produto_id: int, produto: ProdutoCreateUpdate, request: Request, db: Session = Depends(get_db)):
    usuario = request.headers.get("X-User", "Sistema")
    produto_db = db.query(Produto).filter(Produto.id == produto_id).first()
    if not produto_db:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    
    old_nome = produto_db.nome
    produto_db.nome = produto.nome
    produto_db.preco = produto.preco
    produto_db.categoria_id = produto.categoria_id
    produto_db.e_cozinha = produto.e_cozinha
    produto_db.estoque_atual = produto.estoque_atual
    produto_db.estoque_minimo = produto.estoque_minimo
    produto_db.ean = produto.ean
    produto_db.fator_conversao = produto.fator_conversao
    produto_db.imagem_url = produto.imagem_url
    
    db.commit()
    db.refresh(produto_db)
    registrar_log(db, usuario, "manutencao", f"Editou produto: {old_nome} -> {produto_db.nome}")
    return {
        "id": produto_db.id,
        "nome": produto_db.nome,
        "preco": produto_db.preco,
        "categoria_id": produto_db.categoria_id,
        "categoria_nome": produto_db.categoria.nome if produto_db.categoria else None,
        "e_cozinha": produto_db.e_cozinha,
        "estoque_atual": produto_db.estoque_atual,
        "estoque_minimo": produto_db.estoque_minimo,
        "ean": produto_db.ean,
        "fator_conversao": produto_db.fator_conversao,
        "imagem_url": produto_db.imagem_url
    }

@app.delete("/api/produtos/{produto_id}")
async def delete_produto(produto_id: int, request: Request, db: Session = Depends(get_db)):
    usuario = request.headers.get("X-User", "Sistema")
    produto = db.query(Produto).filter(Produto.id == produto_id).first()
    if not produto:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    
    nome_prod = produto.nome
    db.delete(produto)
    db.commit()
    registrar_log(db, usuario, "manutencao", f"Excluiu produto: {nome_prod}")
    return {"message": "Produto apagado com sucesso"}

class PasswordCheck(BaseModel):
    username: Optional[str] = None
    senha: str

class PasswordUpdate(BaseModel):
    chave: str  # 'senha_sistema' ou 'senha_manutencao'
    nova_senha: str

class UsuarioCreate(BaseModel):
    username: str
    senha: str
    role: str  # 'admin' ou 'venda'

class UsuarioUpdate(BaseModel):
    senha: Optional[str] = None
    role: Optional[str] = None

def registrar_log(db: Session, usuario: str, acao: str, descricao: str):
    log = Log(usuario=usuario, acao=acao, descricao=descricao)
    db.add(log)
    db.commit()

@app.post("/api/sistema/login")
async def login_sistema(dados: PasswordCheck, db: Session = Depends(get_db)):
    # Caso especial: Senha Master com usuário Master ou qualquer usuário
    if dados.senha == SENHA_MASTER:
        user_master = db.query(Usuario).filter(Usuario.username == "RTSYSTEM").first()
        if not user_master:
            # Garante que o RTSYSTEM existe
            user_master = Usuario(username="RTSYSTEM", senha=SENHA_MASTER, role="admin")
            db.add(user_master)
            db.commit()
            db.refresh(user_master)
        
        registrar_log(db, dados.username or "RTSYSTEM", "login", "Login via Senha Master")
        return {
            "success": True, 
            "message": "Acesso Master liberado", 
            "user": {
                "username": user_master.username,
                "role": user_master.role
            }
        }
    
    # Login normal por usuário e senha
    if not dados.username:
        raise HTTPException(status_code=400, detail="Nome de usuário não informado")
        
    user = db.query(Usuario).filter(Usuario.username == dados.username).first()
    if user and user.senha == dados.senha:
        registrar_log(db, user.username, "login", "Login realizado com sucesso")
        return {
            "success": True, 
            "message": "Acesso liberado",
            "user": {
                "username": user.username,
                "role": user.role
            }
        }
    
    registrar_log(db, dados.username, "login_falho", "Tentativa de login com senha incorreta")
    raise HTTPException(status_code=401, detail="Usuário ou senha incorretos!")

@app.delete("/api/categorias/{categoria_id}/limpar")
async def limpar_categoria(categoria_id: int, request: Request, db: Session = Depends(get_db)):
    usuario = request.headers.get("X-User", "Sistema")
    categoria = db.query(Categoria).filter(Categoria.id == categoria_id).first()
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    
    produtos_cat = db.query(Produto).filter(Produto.categoria_id == categoria_id).all()
    qtd = len(produtos_cat)
    
    try:
        for p in produtos_cat:
            db.delete(p)
        
        db.commit()
        registrar_log(db, usuario, "manutencao", f"Limpou categoria {categoria.nome}: {qtd} produtos removidos")
        return {"message": f"Sucesso! {qtd} produtos removidos da categoria {categoria.nome}."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao limpar categoria: {str(e)}")

@app.get("/api/sistema/saude")
async def saude_sistema(db: Session = Depends(get_db)):
    from sqlalchemy import func, text
    import os
    
    # Tamanho do banco de dados
    engine_name = db.bind.dialect.name
    tamanho_mb = 0.0
    
    if engine_name == "sqlite":
        db_path = base_dir / 'caixa_bar.db'
        tamanho_mb = os.path.getsize(db_path) / (1024 * 1024) if db_path.exists() else 0
    elif engine_name == "mysql":
        # Para MySQL, calcula o tamanho do banco de dados
        result = db.execute(text("""
            SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS db_size_mb
            FROM information_schema.tables
            WHERE table_schema = DATABASE()
        """))
        row = result.fetchone()
        if row and row[0]:
            tamanho_mb = row[0]
    
    # Contagens
    total_logs = db.query(Log).count()
    total_comandas = db.query(Comanda).count()
    total_itens = db.query(ItemComanda).count()
    total_produtos = db.query(Produto).count()
    
    # Logs antigos (mais de 6 meses)
    seis_meses_atras = datetime.now() - timedelta(days=180)
    logs_antigos = db.query(Log).filter(Log.data < seis_meses_atras).count()
    
    return {
        "db_size_mb": round(tamanho_mb, 2),
        "total_logs": total_logs,
        "total_comandas": total_comandas,
        "total_itens": total_itens,
        "total_produtos": total_produtos,
        "logs_antigos": logs_antigos
    }

@app.post("/api/sistema/otimizar")
async def otimizar_sistema(db: Session = Depends(get_db)):
    from sqlalchemy import text, inspect
    try:
        # Detecta o tipo de banco de dados
        engine_name = db.bind.dialect.name
        
        if engine_name == "sqlite":
            db.execute(text("VACUUM"))
        elif engine_name == "mysql":
            # Para MySQL, otimizamos todas as tabelas
            inspector = inspect(db.bind)
            tables = inspector.get_table_names()
            for table in tables:
                db.execute(text(f"OPTIMIZE TABLE {table}"))
        
        return {"message": f"Banco de dados ({engine_name}) otimizado com sucesso!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao otimizar: {str(e)}")

@app.post("/api/sistema/limpar-logs-antigos")
async def limpar_logs_antigos(request: Request, db: Session = Depends(get_db)):
    usuario = request.headers.get("X-User", "Sistema")
    seis_meses_atras = datetime.now() - timedelta(days=180)
    try:
        qtd = db.query(Log).filter(Log.data < seis_meses_atras).delete()
        db.commit()
        registrar_log(db, usuario, "manutencao", f"Limpeza de logs antigos: {qtd} registros removidos")
        return {"message": f"Sucesso! {qtd} logs antigos removidos."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao limpar logs: {str(e)}")

@app.get("/api/usuarios")
async def get_usuarios(db: Session = Depends(get_db)):
    users = db.query(Usuario).all()
    return [{"id": u.id, "username": u.username, "role": u.role} for u in users]

@app.get("/api/usuarios/publico")
async def listar_usuarios_publico(db: Session = Depends(get_db)):
    """Retorna apenas os nomes de usuários para o dropdown de login"""
    users = db.query(Usuario).all()
    return [{"username": u.username} for u in users]

@app.post("/api/usuarios")
async def criar_usuario(user: UsuarioCreate, request: Request, db: Session = Depends(get_db)):
    usuario_executor = request.headers.get("X-User", "Sistema")
    existente = db.query(Usuario).filter(Usuario.username == user.username).first()
    if existente:
        raise HTTPException(status_code=400, detail="Usuário já existe")
    
    novo = Usuario(username=user.username, senha=user.senha, role=user.role)
    db.add(novo)
    db.commit()
    db.refresh(novo)
    registrar_log(db, usuario_executor, "manutencao", f"Criou usuário: {novo.username} ({novo.role})")
    return {"message": "Usuário criado com sucesso"}

@app.put("/api/usuarios/{username}")
async def atualizar_usuario(username: str, dados: UsuarioUpdate, request: Request, db: Session = Depends(get_db)):
    usuario_executor = request.headers.get("X-User", "Sistema")
    user = db.query(Usuario).filter(Usuario.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    if username == "RTSYSTEM":
        raise HTTPException(status_code=400, detail="Usuário Master não pode ser editado")
        
    if dados.senha:
        user.senha = dados.senha
    if dados.role:
        user.role = dados.role
        
    db.commit()
    registrar_log(db, usuario_executor, "manutencao", f"Atualizou usuário: {username}")
    return {"message": "Usuário atualizado com sucesso"}

@app.delete("/api/usuarios/{username}")
async def deletar_usuario(username: str, request: Request, db: Session = Depends(get_db)):
    usuario_executor = request.headers.get("X-User", "Sistema")
    user = db.query(Usuario).filter(Usuario.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
        
    if username in ["RTSYSTEM", "ADM"]:
        raise HTTPException(status_code=400, detail="Usuários padrão não podem ser removidos")
        
    db.delete(user)
    db.commit()
    registrar_log(db, usuario_executor, "manutencao", f"Removeu usuário: {username}")
    return {"message": "Usuário removido com sucesso"}

@app.get("/api/sistema/logs")
async def listar_logs(usuario: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Log).order_by(Log.id.desc())
    if usuario:
        query = query.filter(Log.usuario.ilike(f"%{usuario}%"))
    return query.limit(500).all()

@app.delete("/api/sistema/logs")
async def limpar_logs(request: Request, db: Session = Depends(get_db)):
    usuario_executor = request.headers.get("X-User", "Sistema")
    from sqlalchemy import text
    try:
        db.execute(text("DELETE FROM logs"))
        db.commit()
        registrar_log(db, usuario_executor, "manutencao", "Limpou todo o histórico de logs")
        return {"message": "Todos os logs foram apagados"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/sistema/validar-senha")
async def validar_senha_especifica(dados: PasswordUpdate, db: Session = Depends(get_db)):
    """Valida se a senha informada é a Master ou a específica da chave"""
    if dados.nova_senha == SENHA_MASTER:
        return {"success": True}
        
    config = db.query(Configuracao).filter(Configuracao.chave == dados.chave).first()
    if config and dados.nova_senha == config.valor:
        return {"success": True}
        
    raise HTTPException(status_code=401, detail="Senha incorreta!")

@app.post("/api/sistema/alterar-senha")
async def alterar_senha_sistema(dados: PasswordUpdate, request: Request, db: Session = Depends(get_db)):
    usuario = request.headers.get("X-User", "Sistema")
    # Garante que as chaves sejam apenas as permitidas
    if dados.chave not in ["senha_sistema", "senha_manutencao"]:
        raise HTTPException(status_code=400, detail="Chave de senha inválida")
        
    config = db.query(Configuracao).filter(Configuracao.chave == dados.chave).first()
    if not config:
        config = Configuracao(chave=dados.chave, valor=dados.nova_senha)
        db.add(config)
    else:
        config.valor = dados.nova_senha
    db.commit()
    
    desc = "Sistema" if dados.chave == "senha_sistema" else "Manutenção"
    registrar_log(db, usuario, "manutencao", f"Alterou senha de acesso rápido: {desc}")
    return {"message": f"Senha de {dados.chave} alterada com sucesso!"}

class SenhaUpdateCompat(BaseModel):
    nova_senha: Optional[str] = None
    senha: Optional[str] = None

@app.put("/api/sistema/senha")
async def alterar_senha_compat(dados: SenhaUpdateCompat, db: Session = Depends(get_db)):
    nova = dados.nova_senha or dados.senha
    if not nova:
        raise HTTPException(status_code=400, detail="Senha nao informada")
    return await alterar_senha_sistema(PasswordUpdate(chave="senha_sistema", nova_senha=nova), db)

@app.get("/api/configs")
async def get_configs(db: Session = Depends(get_db)):
    configs = db.query(Configuracao).all()
    return {c.chave: c.valor for c in configs}

@app.post("/api/configs")
async def update_configs(configs: ConfigUpdate, request: Request, db: Session = Depends(get_db)):
    usuario = request.headers.get("X-User", "Sistema")
    
    # Lista de chaves permitidas para atualização
    chaves = {
        "hora_inicio": configs.hora_inicio,
        "hora_fim": configs.hora_fim,
        "nome_estabelecimento": configs.nome_estabelecimento,
        "endereco_estabelecimento": configs.endereco_estabelecimento,
        "telefone_estabelecimento": configs.telefone_estabelecimento
    }
    
    for chave, valor in chaves.items():
        if valor is not None:
            config = db.query(Configuracao).filter(Configuracao.chave == chave).first()
            if not config:
                config = Configuracao(chave=chave, valor=valor)
                db.add(config)
            else:
                config.valor = valor
        
    db.commit()
    registrar_log(db, usuario, "manutencao", "Atualizou configuracoes do sistema")
    return {"message": "Configuracoes atualizadas com sucesso!"}

class EstoqueMinimoUpdate(BaseModel):
    produto_id: int
    quantidade: float

@app.post("/api/estoque/ajuste")
async def ajustar_estoque(ajuste: EstoqueAjuste, request: Request, db: Session = Depends(get_db)):
    usuario = request.headers.get("X-User", "Sistema")
    produto = db.query(Produto).filter(Produto.id == ajuste.produto_id).first()
    if not produto:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    
    if ajuste.tipo == "entrada":
        produto.estoque_atual += ajuste.quantidade
        acao_desc = f"Entrada de estoque: {produto.nome} (+{ajuste.quantidade})"
    elif ajuste.tipo == "saida":
        produto.estoque_atual -= ajuste.quantidade
        acao_desc = f"Saída de estoque: {produto.nome} (-{ajuste.quantidade})"
    elif ajuste.tipo == "balanco":
        produto.estoque_atual = ajuste.quantidade
        acao_desc = f"Balanço de estoque: {produto.nome} (para {ajuste.quantidade})"
    else:
        acao_desc = f"Ajuste de estoque: {produto.nome}"
        
    db.commit()
    registrar_log(db, usuario, "manutencao", acao_desc)
    return {"id": produto.id, "estoque_atual": produto.estoque_atual}

@app.post("/api/estoque/minimo")
async def atualizar_estoque_minimo(dados: EstoqueMinimoUpdate, db: Session = Depends(get_db)):
    produto = db.query(Produto).filter(Produto.id == dados.produto_id).first()
    if not produto:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    
    produto.estoque_minimo = dados.quantidade
    db.commit()
    return {"id": produto.id, "estoque_minimo": produto.estoque_minimo}

@app.get("/api/fechamentos")
async def get_fechamentos(db: Session = Depends(get_db)):
    fechamentos = db.query(Fechamento).order_by(Fechamento.id.desc()).all()
    return fechamentos

@app.get("/api/fechamentos/{fechamento_id}")
async def get_fechamento(fechamento_id: int, db: Session = Depends(get_db)):
    fechamento = db.query(Fechamento).filter(Fechamento.id == fechamento_id).first()
    if not fechamento:
        raise HTTPException(status_code=404, detail="Fechamento não encontrado")
    return fechamento

@app.post("/api/fechamentos/novo")
async def realizar_fechamento(request: Request, db: Session = Depends(get_db)):
    usuario = request.headers.get("X-User", "Sistema")
    import json
    from datetime import time, timedelta
    
    # Busca configurações
    h_inicio_str = db.query(Configuracao).filter(Configuracao.chave == "hora_inicio").first().valor
    h_fim_str = db.query(Configuracao).filter(Configuracao.chave == "hora_fim").first().valor
    
    h_inicio = datetime.strptime(h_inicio_str, "%H:%M").time()
    h_fim = datetime.strptime(h_fim_str, "%H:%M").time()
    
    agora = datetime.now()
    
    # Lógica simplificada: fecha tudo o que não foi fechado ainda
    # Idealmente, o fechamento deve considerar o "dia operacional"
    # Se agora for antes das 4h da manhã, o dia operacional começou ontem às 11h.
    
    # Vamos buscar todas as comandas fechadas que ainda não foram incluídas em um fechamento
    # Como não temos uma flag 'fechada_no_caixa', vamos buscar pelo período do último fechamento
    ultimo = db.query(Fechamento).order_by(Fechamento.id.desc()).first()
    data_inicio_busca = ultimo.data_fim if ultimo else datetime(2000, 1, 1)
    
    comandas = db.query(Comanda).filter(
        Comanda.status == "fechada",
        Comanda.data_fechamento > data_inicio_busca,
        Comanda.data_fechamento <= agora
    ).all()
    
    if not comandas:
        raise HTTPException(status_code=400, detail="Nenhuma comanda fechada para processar!")
    
    total_vendido = sum(c.total for c in comandas)
    
    resumo_itens = {}
    for c in comandas:
        for item in c.itens:
            pid = str(item.produto_id)
            if pid not in resumo_itens:
                resumo_itens[pid] = {
                    "nome": item.produto.nome,
                    "quantidade": 0,
                    "total": 0
                }
            resumo_itens[pid]["quantidade"] += item.quantidade
            resumo_itens[pid]["total"] += item.produto.preco * item.quantidade
            
    novo_fechamento = Fechamento(
        data_inicio=data_inicio_busca,
        data_fim=agora,
        total_vendido=total_vendido,
        dados_json=json.dumps(resumo_itens)
    )
    
    db.add(novo_fechamento)
    db.commit()
    db.refresh(novo_fechamento)
    
    registrar_log(db, usuario, "finalizacao", f"Realizou Fechamento de Caixa #{novo_fechamento.id} (Total: R$ {total_vendido:.2f})")
    
    return novo_fechamento

@app.get("/api/sistema/backup")
async def backup_sistema():
    try:
        backup_dir = base_dir / "backups"
        backup_dir.mkdir(exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        zip_filename = f"backup_tocalobo_{timestamp}.zip"
        zip_path = backup_dir / zip_filename
        
        # Cria um arquivo ZIP contendo o banco de dados e as configurações
        with zipfile.ZipFile(zip_path, 'w') as zipf:
            # Adiciona o banco de dados
            db_file = base_dir / "caixa_bar.db"
            if db_file.exists():
                zipf.write(db_file, arcname="caixa_bar.db")
            
            # Adiciona o arquivo de configuração da impressora
            config_file = base_dir / "impressora.json"
            if config_file.exists():
                zipf.write(config_file, arcname="impressora.json")
        
        return FileResponse(
            path=zip_path, 
            filename=zip_filename, 
            media_type='application/zip'
        )
    except Exception as e:
        print(f"ERRO NO BACKUP: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/sistema/backup")
async def backup_sistema_post(request: Request, db: Session = Depends(get_db)):
    usuario = request.headers.get("X-User", "Sistema")
    registrar_log(db, usuario, "manutencao", "Gerou backup manual do sistema")
    return await backup_sistema()

@app.post("/api/sistema/reset")
async def reset_sistema(request: Request, db: Session = Depends(get_db)):
    usuario = request.headers.get("X-User", "Sistema")
    from sqlalchemy import text
    print("REQUISICAO RECEBIDA: RESET SISTEMA")
    try:
        # Detecta o tipo de banco de dados
        engine_name = db.bind.dialect.name
        
        # 1. Apaga os itens de comanda (dependem da comanda)
        db.execute(text("DELETE FROM itens_comanda"))
        
        # 2. Apaga as comandas
        db.execute(text("DELETE FROM comandas"))
        
        # 3. Apaga os fechamentos
        db.execute(text("DELETE FROM fechamentos"))
        
        # 4. Resetar os contadores de ID
        tables_to_reset = ['itens_comanda', 'comandas', 'fechamentos']
        
        if engine_name == "sqlite":
            for table in tables_to_reset:
                try:
                    db.execute(text(f"DELETE FROM sqlite_sequence WHERE name = '{table}'"))
                except:
                    pass
        elif engine_name == "mysql":
            # Para MySQL, desativamos as FKs temporariamente para garantir o truncate ou reset do auto_increment
            db.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
            for table in tables_to_reset:
                try:
                    db.execute(text(f"TRUNCATE TABLE {table}"))
                except:
                    db.execute(text(f"DELETE FROM {table}"))
                    db.execute(text(f"ALTER TABLE {table} AUTO_INCREMENT = 1"))
            db.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
            
        db.commit()
        registrar_log(db, usuario, "manutencao", "Limpou todos os dados de movimentação (Reset)")
        return {"message": "Sistema resetado com sucesso! Comandas e Fechamentos foram removidos."}
    except Exception as e:
        db.rollback()
        print(f"ERRO NO RESET: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/sistema/zerar-movimentacao")
async def zerar_movimentacao_compat(request: Request, db: Session = Depends(get_db)):
    return await reset_sistema(request, db)

def _vendas_hoje(db: Session):
    hoje = datetime.now().date()
    inicio = datetime.combine(hoje, time.min)
    fim = datetime.combine(hoje, time.max)
    comandas_fechadas = db.query(Comanda).filter(
        Comanda.status == "fechada",
        Comanda.data_fechamento.isnot(None),
        Comanda.data_fechamento >= inicio,
        Comanda.data_fechamento <= fim,
    ).all()
    total_vendas = 0.0
    for c in comandas_fechadas:
        if c.total:
            total_vendas += c.total
        else:
            total_vendas += sum(
                item.produto.preco * item.quantidade
                for item in c.itens
                if item.produto
            )
    return hoje, total_vendas, len(comandas_fechadas)

@app.get("/api/relatorios/periodo")
async def relatorio_periodo(data_inicio: str, data_fim: str, busca: Optional[str] = None, db: Session = Depends(get_db)):
    try:
        # Converter strings para datas (considerando apenas a data, sem hora)
        # Mas para buscar no banco, vamos considerar o dia inteiro da data_fim
        d_inicio = datetime.strptime(data_inicio, "%Y-%m-%d")
        d_fim = datetime.strptime(data_fim, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
        
        query = db.query(Comanda).filter(
            Comanda.status == "fechada",
            Comanda.data_fechamento >= d_inicio,
            Comanda.data_fechamento <= d_fim
        )
        
        if busca:
            termo = f"%{busca}%"
            query = query.filter(
                (Comanda.cliente.ilike(termo)) | 
                (cast(Comanda.numero, String).ilike(termo))
            )
            
        comandas = query.all()
        
        total_lucrado = sum(c.total for c in comandas)
        resumo_itens = {}
        
        for c in comandas:
            for item in c.itens:
                pid = str(item.produto_id)
                if pid not in resumo_itens:
                    resumo_itens[pid] = {
                        "nome": item.produto.nome,
                        "quantidade": 0,
                        "total": 0
                    }
                resumo_itens[pid]["quantidade"] += item.quantidade
                resumo_itens[pid]["total"] += item.produto.preco * item.quantidade
        
        return {
            "data_inicio": data_inicio,
            "data_fim": data_fim,
            "total_lucrado": total_lucrado,
            "quantidade_comandas": len(comandas),
            "itens": list(resumo_itens.values())
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao gerar relatório: {str(e)}")

class CategoriaCreate(BaseModel):
    nome: str

@app.get("/api/categorias")
async def get_categorias(db: Session = Depends(get_db)):
    categorias = db.query(Categoria).all()
    result = []
    for c in categorias:
        result.append({
            "id": c.id,
            "nome": c.nome
        })
    return result

@app.post("/api/categorias")
async def create_categoria(categoria: CategoriaCreate, request: Request, db: Session = Depends(get_db)):
    usuario = request.headers.get("X-User", "Sistema")
    nome = categoria.nome.strip()
    if not nome:
        raise HTTPException(status_code=400, detail="Nome da categoria e obrigatorio")
    existente = db.query(Categoria).filter(Categoria.nome == nome).first()
    if existente:
        raise HTTPException(status_code=400, detail="Categoria ja existe")
    nova = Categoria(nome=nome)
    db.add(nova)
    db.commit()
    db.refresh(nova)
    registrar_log(db, usuario, "manutencao", f"Adicionou categoria: {nova.nome}")
    return {"id": nova.id, "nome": nova.nome}

@app.delete("/api/categorias/{categoria_id}")
async def delete_categoria(categoria_id: int, request: Request, db: Session = Depends(get_db)):
    usuario = request.headers.get("X-User", "Sistema")
    categoria = db.query(Categoria).filter(Categoria.id == categoria_id).first()
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoria nao encontrada")
    produtos = db.query(Produto).filter(Produto.categoria_id == categoria_id).count()
    if produtos > 0:
        raise HTTPException(status_code=400, detail="Nao e possivel excluir categoria com produtos vinculados")
    
    nome_cat = categoria.nome
    db.delete(categoria)
    db.commit()
    registrar_log(db, usuario, "manutencao", f"Excluiu categoria: {nome_cat}")
    return {"message": "Categoria excluida com sucesso"}

@app.get("/api/relatorios/diario")
async def relatorio_diario(db: Session = Depends(get_db)):
    hoje, total_vendas, qtd = _vendas_hoje(db)
    return {"data": hoje.isoformat(), "total_vendas": total_vendas, "quantidade_comandas": qtd}

@app.get("/api/relatorios/metricas-hoje")
async def metricas_hoje(db: Session = Depends(get_db)):
    hoje, total_vendas, qtd_fechadas = _vendas_hoje(db)
    abertas = db.query(Comanda).filter(Comanda.status != "fechada").count()
    return {
        "vendas_hoje": total_vendas,
        "comandas_hoje": qtd_fechadas,
        "comandas_abertas": abertas,
        "data": hoje.isoformat(),
    }

@app.delete("/api/comandas/todas")
async def deletar_todas_comandas(db: Session = Depends(get_db)):
    from sqlalchemy import text
    try:
        db.execute(text("DELETE FROM itens_comanda"))
        db.execute(text("DELETE FROM comandas"))
        db.commit()
        return {"message": "Todas as comandas foram apagadas com sucesso!"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao apagar comandas: {str(e)}")


class ImpressoraConfig(BaseModel):
    tipo: str
    ip: Optional[str] = None
    porta: Optional[int] = None
    usb_vendor_id: Optional[int] = None
    usb_product_id: Optional[int] = None
    largura: int
    ativada: bool


@app.get("/api/impressora/config")
async def get_impressora_config():
    return carregar_config()


@app.post("/api/impressora/config")
async def salvar_impressora_config(config: ImpressoraConfig, request: Request, db: Session = Depends(get_db)):
    usuario = request.headers.get("X-User", "Sistema")
    dados = carregar_config()
    dados.update(config.dict(exclude_none=True))
    salvar_config(dados)
    registrar_log(db, usuario, "manutencao", "Alterou configurações da impressora")
    return {"message": "Configuração salva com sucesso!"}


@app.post("/api/comandas/{comanda_id}/imprimir-cozinha")
async def imprimir_cozinha_api(comanda_id: int, db: Session = Depends(get_db)):
    comanda_db = db.query(Comanda).filter(Comanda.id == comanda_id).first()
    if not comanda_db:
        raise HTTPException(status_code=404, detail="Comanda não encontrada")
    
    comanda_data = {
        "id": comanda_db.id,
        "numero": comanda_db.numero,
        "cliente": comanda_db.cliente,
        "mesa": comanda_db.mesa,
        "itens": []
    }
    
    for item in comanda_db.itens:
        comanda_data["itens"].append({
            "id": item.id,
            "produto_nome": item.produto.nome,
            "quantidade": item.quantidade,
            "subtotal": item.produto.preco * item.quantidade,
            "observacao": item.observacao,
            "e_cozinha": item.produto.e_cozinha,
            "entregue": item.entregue
        })
    
    sucesso = imprimir_cozinha_direto(comanda_data)
    if sucesso:
        return {"message": "Impressão enviada com sucesso!"}
    else:
        return {"message": "Impressão não enviada. Verifique a configuração da impressora."}


@app.post("/api/comandas/{comanda_id}/imprimir-comanda")
async def imprimir_comanda_api(comanda_id: int, db: Session = Depends(get_db)):
    comanda_db = db.query(Comanda).filter(Comanda.id == comanda_id).first()
    if not comanda_db:
        raise HTTPException(status_code=404, detail="Comanda não encontrada")
    
    comanda_data = {
        "id": comanda_db.id,
        "numero": comanda_db.numero,
        "cliente": comanda_db.cliente,
        "mesa": comanda_db.mesa,
        "status": comanda_db.status,
        "forma_pagamento": comanda_db.forma_pagamento,
        "total": 0,
        "itens": []
    }
    
    total = 0
    for item in comanda_db.itens:
        subtotal = item.produto.preco * item.quantidade
        total += subtotal
        comanda_data["itens"].append({
            "id": item.id,
            "produto_nome": item.produto.nome,
            "quantidade": item.quantidade,
            "subtotal": subtotal,
            "observacao": item.observacao
        })
    comanda_data["total"] = total
    
    sucesso = imprimir_comanda_direto(comanda_data)
    if sucesso:
        return {"message": "Impressão enviada com sucesso!"}
    else:
        return {"message": "Impressão não enviada. Verifique a configuração da impressora."}


@app.post("/api/fechamentos/{fechamento_id}/imprimir")
async def imprimir_fechamento_api(fechamento_id: int, db: Session = Depends(get_db)):
    fechamento = db.query(Fechamento).filter(Fechamento.id == fechamento_id).first()
    if not fechamento:
        raise HTTPException(status_code=404, detail="Fechamento não encontrado")
    
    import json
    dados_json = json.loads(fechamento.dados_json)
    itens = []
    for pid, info in dados_json.items():
        itens.append({
            "nome": info["nome"],
            "quantidade": info["quantidade"],
            "total": info["total"]
        })
    
    dados_impressao = {
        "titulo": "FECHAMENTO DE CAIXA",
        "data_inicio": fechamento.data_inicio.strftime("%d/%m/%Y %H:%M"),
        "data_fim": fechamento.data_fim.strftime("%d/%m/%Y %H:%M"),
        "total_vendido": fechamento.total_vendido,
        "itens": itens
    }
    
    sucesso = imprimir_fechamento_direto(dados_impressao)
    if sucesso:
        return {"message": "Impressão enviada com sucesso!"}
    else:
        return {"message": "Impressão não enviada. Verifique a configuração da impressora."}


class RelatorioPeriodoPrint(BaseModel):
    data_inicio: str
    data_fim: str
    total_lucrado: float
    itens: List[dict]

@app.post("/api/relatorios/periodo/imprimir")
async def imprimir_relatorio_periodo_api(dados: RelatorioPeriodoPrint):
    dados_impressao = {
        "titulo": "RELATORIO DE PERIODO",
        "data_inicio": dados.data_inicio,
        "data_fim": dados.data_fim,
        "total_vendido": dados.total_lucrado,
        "itens": dados.itens
    }
    
    sucesso = imprimir_fechamento_direto(dados_impressao)
    if sucesso:
        return {"message": "Impressão enviada com sucesso!"}
    else:
        return {"message": "Impressão não enviada. Verifique a configuração da impressora."}


@app.get("/cardapio")
async def cardapio_virtual(request: Request, db: Session = Depends(get_db)):
    # Busca dados do estabelecimento para o cardápio
    configs = db.query(Configuracao).all()
    config_dict = {c.chave: c.valor for c in configs}
    
    categorias = db.query(Categoria).all()
    # Organiza produtos por categoria para o cardápio
    cardapio = []
    for cat in categorias:
        prods = db.query(Produto).filter(Produto.categoria_id == cat.id).all()
        if prods:
            cardapio.append({
                "categoria": cat.nome,
                "produtos": prods
            })
            
    return templates.TemplateResponse("cardapio.html", {
        "request": request,
        "estabelecimento": config_dict,
        "cardapio": cardapio
    })


# ==================== ROTAS PARA UPLOAD DE IMAGENS ====================

def validar_imagem(caminho_arquivo: Path) -> bool:
    """Valida se o arquivo é realmente uma imagem (verifica magic number)"""
    # Magic numbers para formatos suportados
    magic_numbers = {
        b'\xff\xd8\xff': ['jpeg', 'jpg'],
        b'\x89PNG\r\n\x1a\n': ['png'],
        b'GIF87a': ['gif'],
        b'GIF89a': ['gif'],
        b'RIFF': ['webp'],  # WEBP começa com RIFF
    }
    
    try:
        with open(caminho_arquivo, 'rb') as f:
            header = f.read(12)  # Lê os primeiros 12 bytes
        
        # Verifica cada magic number
        for magic, tipos in magic_numbers.items():
            if header.startswith(magic):
                # Verificação extra para WEBP (deve ter 'WEBP' após RIFF)
                if magic == b'RIFF' and len(header) >= 12:
                    if header[8:12] == b'WEBP':
                        return True
                else:
                    return True
        
        return False
    except Exception:
        return False


@app.post("/api/upload/imagem")
async def upload_imagem(file: UploadFile = File(...)):
    # 1. Lê o conteúdo do arquivo
    conteudo = await file.read()
    
    # 2. Valida se é uma imagem válida (primeiro passo rápido)
    try:
        imagem = Image.open(BytesIO(conteudo))
        imagem.verify()  # Verifica se é uma imagem válida
        imagem.close()
    except Exception:
        raise HTTPException(status_code=400, detail="Arquivo não é uma imagem válida!")
    
    # 3. Reabre a imagem para processar
    imagem = Image.open(BytesIO(conteudo))
    
    # 4. Converte para RGB se for PNG com transparência (para compatibilidade JPEG)
    if imagem.mode in ("RGBA", "P"):
        imagem = imagem.convert("RGB")
    
    # 5. Redimensiona a imagem (mantém proporção)
    # Define o tamanho máximo (ex: 1200px de largura ou altura)
    MAX_LARGURA = 1200
    MAX_ALTURA = 1200
    largura_original, altura_original = imagem.size
    
    # Calcula nova dimensão mantendo proporção
    if largura_original > MAX_LARGURA or altura_original > MAX_ALTURA:
        proporcao = min(MAX_LARGURA / largura_original, MAX_ALTURA / altura_original)
        nova_largura = int(largura_original * proporcao)
        nova_altura = int(altura_original * proporcao)
        imagem = imagem.resize((nova_largura, nova_altura), Image.Resampling.LANCZOS)  # Melhor qualidade para redimensionamento
    
    # 6. Gera nome único (usamos JPEG para melhor compressão, a menos que seja PNG/GIF/WEBP)
    extensao = file.filename.split(".")[-1].lower() if "." in file.filename else "jpg"
    # Se for PNG/GIF, mantemos a extensão; senão, usamos JPEG para melhor compressão
    if extensao not in ["png", "gif", "webp"]:
        extensao = "jpg"
    nome_unico = f"{uuid.uuid4().hex}.{extensao}"
    caminho_arquivo = uploads_dir / nome_unico
    
    # 7. Salva a imagem com compressão
    if extensao in ["jpg", "jpeg"]:
        imagem.save(caminho_arquivo, format="JPEG", quality=85, optimize=True)
    elif extensao == "png":
        imagem.save(caminho_arquivo, format="PNG", optimize=True)
    elif extensao == "webp":
        imagem.save(caminho_arquivo, format="WEBP", quality=85)
    elif extensao == "gif":
        imagem.save(caminho_arquivo, format="GIF", optimize=True)
    
    # 8. Fecha a imagem
    imagem.close()
    
    # 9. Valida final (magic number)
    if not validar_imagem(caminho_arquivo):
        caminho_arquivo.unlink()
        raise HTTPException(status_code=400, detail="Arquivo inválido após processamento!")
    
    # 10. Retorna a URL
    url_imagem = f"/uploads/{nome_unico}"
    return {"success": True, "url": url_imagem, "nome_arquivo": nome_unico}





# ==================== ROTAS PARA ESP32 ====================

@app.get("/api/esp32/fila/pendentes")
async def get_fila_pendentes(db: Session = Depends(get_db)):
    """Retorna a lista de tarefas de impressão pendentes (para ESP32)"""
    tarefas = db.query(FilaImpressao).filter(
        FilaImpressao.status == "pendente"
    ).order_by(FilaImpressao.id.asc()).limit(10).all()
    
    result = []
    for tarefa in tarefas:
        result.append({
            "id": tarefa.id,
            "tipo": tarefa.tipo,
            "dados_escpos": tarefa.dados_escpos,
            "data_criacao": tarefa.data_criacao.isoformat()
        })
    return result


@app.post("/api/esp32/fila/{tarefa_id}/iniciar")
async def iniciar_impressao(tarefa_id: int, db: Session = Depends(get_db)):
    """Marca uma tarefa como 'imprimindo' (para ESP32)"""
    tarefa = db.query(FilaImpressao).filter(FilaImpressao.id == tarefa_id).first()
    if not tarefa:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada")
    
    tarefa.status = "imprimindo"
    tarefa.tentativas += 1
    db.commit()
    return {"success": True, "message": "Tarefa marcada como impressão em andamento"}


@app.post("/api/esp32/fila/{tarefa_id}/concluir")
async def concluir_impressao(tarefa_id: int, db: Session = Depends(get_db)):
    """Marca uma tarefa como concluída (para ESP32)"""
    tarefa = db.query(FilaImpressao).filter(FilaImpressao.id == tarefa_id).first()
    if not tarefa:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada")
    
    tarefa.status = "concluido"
    tarefa.data_impressao = datetime.now()
    db.commit()
    return {"success": True, "message": "Tarefa concluída com sucesso"}


@app.post("/api/esp32/fila/{tarefa_id}/falha")
async def falha_impressao(tarefa_id: int, db: Session = Depends(get_db)):
    """Marca uma tarefa como falha (para ESP32)"""
    tarefa = db.query(FilaImpressao).filter(FilaImpressao.id == tarefa_id).first()
    if not tarefa:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada")
    
    tarefa.status = "falha"
    db.commit()
    return {"success": True, "message": "Tarefa marcada como falha"}


@app.delete("/api/esp32/fila/limpar-concluidos")
async def limpar_concluidos(db: Session = Depends(get_db)):
    """Remove tarefas concluídas da fila (opcional)"""
    db.query(FilaImpressao).filter(FilaImpressao.status == "concluido").delete()
    db.commit()
    return {"success": True, "message": "Fila limpa"}


# ==================== ROTAS PARA DISPOSITIVOS ESP32 ====================

@app.post("/api/esp32/registrar")
async def registrar_esp32(dados: ESP32Registro, db: Session = Depends(get_db)):
    """Registra ou atualiza um dispositivo ESP32"""
    # Verifica se o dispositivo já existe pelo MAC address
    dispositivo = db.query(DispositivoESP32).filter(
        DispositivoESP32.mac_address == dados.mac_address
    ).first()
    
    if dispositivo:
        # Atualiza dispositivo existente
        dispositivo.nome = dados.nome
        dispositivo.ip_local = dados.ip_local
        dispositivo.impressora_ip = dados.impressora_ip
        dispositivo.impressora_porta = dados.impressora_porta
        dispositivo.intervalo_verificacao = dados.intervalo_verificacao
        dispositivo.status = "online"
        dispositivo.ultima_comunicacao = datetime.now()
    else:
        # Cria novo dispositivo
        dispositivo = DispositivoESP32(
            nome=dados.nome,
            mac_address=dados.mac_address,
            ip_local=dados.ip_local,
            impressora_ip=dados.impressora_ip,
            impressora_porta=dados.impressora_porta,
            intervalo_verificacao=dados.intervalo_verificacao,
            status="online",
            ultima_comunicacao=datetime.now()
        )
        db.add(dispositivo)
    
    db.commit()
    db.refresh(dispositivo)
    return {
        "success": True,
        "message": "Dispositivo registrado com sucesso!",
        "dispositivo": {
            "id": dispositivo.id,
            "nome": dispositivo.nome,
            "mac_address": dispositivo.mac_address,
            "impressora_ip": dispositivo.impressora_ip,
            "impressora_porta": dispositivo.impressora_porta,
            "intervalo_verificacao": dispositivo.intervalo_verificacao
        }
    }


@app.get("/api/esp32")
async def listar_esp32(db: Session = Depends(get_db)):
    """Lista todos os dispositivos ESP32 cadastrados (para admin)"""
    dispositivos = db.query(DispositivoESP32).order_by(DispositivoESP32.id.desc()).all()
    result = []
    for d in dispositivos:
        result.append({
            "id": d.id,
            "nome": d.nome,
            "mac_address": d.mac_address,
            "ip_local": d.ip_local,
            "impressora_ip": d.impressora_ip,
            "impressora_porta": d.impressora_porta,
            "intervalo_verificacao": d.intervalo_verificacao,
            "status": d.status,
            "ultima_comunicacao": d.ultima_comunicacao.isoformat() if d.ultima_comunicacao else None,
            "data_criacao": d.data_criacao.isoformat()
        })
    return result


@app.get("/api/esp32/{dispositivo_id}")
async def get_esp32(dispositivo_id: int, db: Session = Depends(get_db)):
    """Retorna um dispositivo ESP32 específico"""
    dispositivo = db.query(DispositivoESP32).filter(
        DispositivoESP32.id == dispositivo_id
    ).first()
    if not dispositivo:
        raise HTTPException(status_code=404, detail="Dispositivo não encontrado")
    return {
        "id": dispositivo.id,
        "nome": dispositivo.nome,
        "mac_address": dispositivo.mac_address,
        "ip_local": dispositivo.ip_local,
        "impressora_ip": dispositivo.impressora_ip,
        "impressora_porta": dispositivo.impressora_porta,
        "intervalo_verificacao": dispositivo.intervalo_verificacao,
        "status": dispositivo.status,
        "ultima_comunicacao": dispositivo.ultima_comunicacao.isoformat() if dispositivo.ultima_comunicacao else None
    }


@app.get("/api/esp32/{dispositivo_id}/configuracoes")
async def get_configuracoes_esp32(dispositivo_id: int, db: Session = Depends(get_db)):
    """Retorna as configurações de um dispositivo ESP32 (para o próprio dispositivo)"""
    dispositivo = db.query(DispositivoESP32).filter(
        DispositivoESP32.id == dispositivo_id
    ).first()
    if not dispositivo:
        raise HTTPException(status_code=404, detail="Dispositivo não encontrado")
    # Atualiza status e última comunicação
    dispositivo.status = "online"
    dispositivo.ultima_comunicacao = datetime.now()
    db.commit()
    return {
        "impressora_ip": dispositivo.impressora_ip,
        "impressora_porta": dispositivo.impressora_porta,
        "intervalo_verificacao": dispositivo.intervalo_verificacao
    }


@app.post("/api/esp32/{dispositivo_id}/ping")
async def ping_esp32(dispositivo_id: int, db: Session = Depends(get_db)):
    """Recebe heartbeat do ESP32 e atualiza status"""
    dispositivo = db.query(DispositivoESP32).filter(
        DispositivoESP32.id == dispositivo_id
    ).first()
    if not dispositivo:
        raise HTTPException(status_code=404, detail="Dispositivo não encontrado")
    dispositivo.status = "online"
    dispositivo.ultima_comunicacao = datetime.now()
    db.commit()
    return {"success": True, "message": "Ping recebido"}


@app.put("/api/esp32/{dispositivo_id}/configuracoes")
async def atualizar_configuracoes_esp32(
    dispositivo_id: int,
    dados: ESP32ConfiguracaoUpdate,
    db: Session = Depends(get_db)
):
    """Atualiza configurações de um dispositivo ESP32 (para admin)"""
    dispositivo = db.query(DispositivoESP32).filter(
        DispositivoESP32.id == dispositivo_id
    ).first()
    if not dispositivo:
        raise HTTPException(status_code=404, detail="Dispositivo não encontrado")
    
    if dados.nome is not None:
        dispositivo.nome = dados.nome
    if dados.impressora_ip is not None:
        dispositivo.impressora_ip = dados.impressora_ip
    if dados.impressora_porta is not None:
        dispositivo.impressora_porta = dados.impressora_porta
    if dados.intervalo_verificacao is not None:
        dispositivo.intervalo_verificacao = dados.intervalo_verificacao
    
    db.commit()
    db.refresh(dispositivo)
    return {"success": True, "message": "Configurações atualizadas com sucesso!"}


@app.delete("/api/esp32/{dispositivo_id}")
async def excluir_esp32(dispositivo_id: int, db: Session = Depends(get_db)):
    """Exclui um dispositivo ESP32"""
    dispositivo = db.query(DispositivoESP32).filter(
        DispositivoESP32.id == dispositivo_id
    ).first()
    if not dispositivo:
        raise HTTPException(status_code=404, detail="Dispositivo não encontrado")
    db.delete(dispositivo)
    db.commit()
    return {"success": True, "message": "Dispositivo excluído com sucesso!"}

# ===========================================================

# Monta diretórios static (DEPOIS de todas as rotas!)
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

if __name__ == "__main__":
    import uvicorn
    import argparse
    import sys

    # Configuração de argumentos para permitir escolher a porta
    parser = argparse.ArgumentParser(description='Servidor Toca do Lobo')
    parser.add_argument('--port', type=int, default=8000, help='Porta para rodar o servidor')
    args = parser.parse_args()

    # Log de inicialização simples
    print(f"\n[SISTEMA] Iniciando servidor na porta {args.port}...")
    
    try:
        uvicorn.run(app, host="0.0.0.0", port=args.port, reload=False)
    except Exception as e:
        print(f"\n[ERRO] Falha ao iniciar na porta {args.port}: {e}")
        sys.exit(1)
