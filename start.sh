#!/bin/bash

echo "🚀 Iniciando BuyTickets..."

# Verificar se RabbitMQ está rodando
if ! sudo systemctl is-active --quiet rabbitmq-server; then
    echo "🐰 Iniciando RabbitMQ..."
    sudo systemctl start rabbitmq-server
    sleep 3
fi

# Função para abrir nova aba do terminal
open_terminal() {
    local title=$1
    local command=$2
    local path=$3
    
    # No Codespace, vamos usar tmux para gerenciar as sessões
    if command -v tmux &> /dev/null; then
        tmux new-session -d -s "$title" -c "$path" "$command"
        echo "✅ $title iniciado em sessão tmux: $title"
    else
        echo "ℹ️ Execute manualmente: cd $path && $command"
    fi
}

# Iniciar Backend
echo "🔧 Iniciando Backend..."
open_terminal "backend" "npm start" "/workspaces/BuyTickets/backend"

# Aguardar backend inicializar
sleep 3

# Iniciar Frontend
echo "🎨 Iniciando Frontend..."
open_terminal "frontend" "npm start" "/workspaces/BuyTickets/frontend"

# Iniciar Admin Panel
echo "👑 Iniciando Admin Panel..."
open_terminal "admin" "PORT=3002 npm start" "/workspaces/BuyTickets/admin-panel"

echo ""
echo "🎉 Sistema iniciado!"
echo ""
echo "📺 Para ver as sessões ativas:"
echo "tmux list-sessions"
echo ""
echo "🔗 Para conectar a uma sessão:"
echo "tmux attach-session -t backend"
echo "tmux attach-session -t frontend"
echo "tmux attach-session -t admin"
echo ""
echo "🌐 URLs dos serviços:"
echo "- Backend API: http://localhost:3001"
echo "- Frontend: http://localhost:3000"  
echo "- Admin Panel: http://localhost:3002"
echo ""
echo "🛑 Para parar tudo:"
echo "./stop.sh"