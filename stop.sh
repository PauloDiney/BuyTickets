#!/bin/bash

echo "🛑 Parando BuyTickets..."

# Parar sessões tmux
if command -v tmux &> /dev/null; then
    echo "🔧 Parando Backend..."
    tmux kill-session -t backend 2>/dev/null || echo "Backend já parado"
    
    echo "🎨 Parando Frontend..."
    tmux kill-session -t frontend 2>/dev/null || echo "Frontend já parado"
    
    echo "👑 Parando Admin Panel..."
    tmux kill-session -t admin 2>/dev/null || echo "Admin já parado"
else
    echo "ℹ️ Pare manualmente os processos Node.js rodando nas portas 3000, 3001 e 3002"
    echo "Use: lsof -ti:3000,3001,3002 | xargs kill"
fi

# Matar processos nas portas específicas como backup
echo "🧹 Limpando portas..."
lsof -ti:3000,3001,3002 | xargs kill 2>/dev/null || echo "Nenhum processo encontrado nas portas"

echo "✅ Sistema parado!"