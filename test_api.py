
import requests

try:
    r = requests.get('http://localhost:8000/api/produtos')
    data = r.json()
    print(f"Total de produtos: {len(data)}")
    for p in data[:5]:
        print(f"ID {p.get('id')}, {p.get('nome')}, imagem_url: {repr(p.get('imagem_url'))}")
except Exception as e:
    print(f"Erro: {e}")
