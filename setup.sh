#!/bin/bash

echo "🚀 Configurando BuyTickets para Codespace..."

# Atualizar sistema
echo "📦 Atualizando sistema..."
sudo apt update

# Instalar RabbitMQ
echo "🐰 Instalando RabbitMQ..."
sudo apt install -y rabbitmq-server

# Iniciar RabbitMQ
echo "▶️ Iniciando RabbitMQ..."
sudo systemctl start rabbitmq-server
sudo systemctl enable rabbitmq-server

# Aguardar RabbitMQ inicializar
echo "⏳ Aguardando RabbitMQ inicializar..."
sleep 5

# Verificar status do RabbitMQ
sudo systemctl status rabbitmq-server --no-pager

# Instalar dependências do backend
echo "📦 Instalando dependências do backend..."
cd /workspaces/BuyTickets/backend
npm install

# Instalar dependências do frontend
echo "📦 Instalando dependências do frontend..."
cd /workspaces/BuyTickets/frontend
npm install

# Instalar dependências do admin
echo "📦 Instalando dependências do admin..."
cd /workspaces/BuyTickets/admin-panel
npm install

echo "✅ Setup concluído!"
echo ""
echo "🚀 Para iniciar o sistema:"
echo "1. Backend: cd backend && npm start"
echo "2. Frontend: cd frontend && npm start"
echo "3. Admin: cd admin-panel && npm start"
echo ""
echo "🌐 URLs:"
echo "- Backend API: http://localhost:3001"
echo "- Frontend: http://localhost:3000"
echo "- Admin Panel: http://localhost:3002"
echo ""
echo "👑 Credenciais Admin:"
echo "- Usuário: admin"
echo "- Senha: admin123"