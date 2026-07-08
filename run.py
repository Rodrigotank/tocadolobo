import uvicorn
import os
import argparse

if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    parser = argparse.ArgumentParser(description='Servidor Toca do Lobo')
    parser.add_argument('--port', type=int, default=8000, help='Porta para rodar o servidor')
    args = parser.parse_args()
    
    uvicorn.run("backend.main:app", host="0.0.0.0", port=args.port, reload=False)
