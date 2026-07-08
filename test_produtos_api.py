
import requests

response = requests.get("http://localhost:8001/api/produtos")
print("Status code:", response.status_code)
produtos = response.json()
print(f"Total de produtos:", len(produtos))
for p in produtos:
    print(f"ID {p['id']} - {p['nome']} - imagem_url: {repr(p.get('imagem_url'))}")

print("\n\nCategorias:")
response = requests.get("http://localhost:8001/api/categorias")
print(response.json())
