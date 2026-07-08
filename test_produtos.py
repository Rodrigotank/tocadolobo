
import requests

response = requests.get("http://localhost:8001/api/produtos")
produtos = response.json()

print(f"Total produtos: {len(produtos)}")
print()
for p in produtos[:5]:
    print(f"ID: {p['id']}, Nome: {p['nome']}")
    print(f"Imagem URL: {p.get('imagem_url')}")
    print()
