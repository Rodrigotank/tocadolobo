
import pymysql
from urllib.parse import urlparse, unquote
import os
from dotenv import load_dotenv

load_dotenv()

db_url = os.getenv("DATABASE_URL")
parsed = urlparse(db_url)

user = parsed.username
password = unquote(parsed.password)
host = parsed.hostname
port = parsed.port
db_name = parsed.path.lstrip("/")

conn = pymysql.connect(
    host=host,
    port=port,
    user=user,
    password=password,
    database=db_name,
    charset="utf8mb4"
)

cursor = conn.cursor(pymysql.cursors.DictCursor)
cursor.execute("SELECT id, nome, imagem_url FROM produtos LIMIT 10")
print("Produtos e suas imagens:")
print("-"*80)
for p in cursor.fetchall():
    print(f"ID: {p['id']}, Nome: {p['nome']}, Imagem URL: {p['imagem_url']}")
    print()

conn.close()
