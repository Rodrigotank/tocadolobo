#!/bin/bash
echo "=== Configurando Portas e Firewall ==="
sudo iptables -I INPUT 6 -p tcp --dport 8888 -j ACCEPT
sudo iptables -t nat -A PREROUTING -p tcp --dport 8888 -j REDIRECT --to-port 8000
if command -v netfilter-persistent &> /dev/null; then
    sudo netfilter-persistent save
fi
echo "Porta 8888 liberada e redirecionada para 8000!"
