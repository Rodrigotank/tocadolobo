
import pymysql
from dotenv import load_dotenv
import os

load_dotenv()

# Parse DATABASE_URL
db_url = os.getenv('DATABASE_URL')
print(f"Using database URL: {db_url}")

# For mysql+pymysql://root:password@localhost:3306/dbname
if db_url.startswith('mysql'):
    # Split the URL
    # Remove the protocol
    url = db_url.replace('mysql+pymysql://', '')
    # Split into user:pass@host:port/dbname
    user_pass, rest = url.split('@', 1)
    user, password = user_pass.split(':', 1)
    host_port, db_name = rest.split('/', 1)
    host, port_str = host_port.split(':', 1)
    port = int(port_str)
    
    print(f"Connecting to {user}@{host}:{port}/{db_name}")
    
    # Connect
    conn = pymysql.connect(
        host=host,
        port=port,
        user=user,
        password=password,
        database=db_name
    )
    cursor = conn.cursor(pymysql.cursors.DictCursor)
    
    cursor.execute("SELECT * FROM usuarios")
    users = cursor.fetchall()
    print("\nUsuários no banco de dados:")
    for u in users:
        print(f"  ID: {u['id']}, Username: {u['username']}, Role: {u['role']}")
    
    cursor.close()
    conn.close()
else:
    print("Usando SQLite, não MySQL")
