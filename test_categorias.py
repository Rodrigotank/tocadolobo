
import requests

try:
    r_prod = requests.get('http://localhost:8000/api/produtos')
    prods = r_prod.json()
    print(f"Produtos carregados: {len(prods)}")
    r_cat = requests.get('http://localhost:8000/api/categorias')
    cats = r_cat.json()
    print(f"Categorias carregadas: {len(cats)}")
    for cat in cats:
        print(f"ID {cat.get('id')}, nome {cat.get('nome')}")
except Exception as e:
    print(f"Erro: {e}")
