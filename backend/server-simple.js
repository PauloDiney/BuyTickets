require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Configurações
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Dados em memória
const movies = [
  { id: 1, title: 'Vingadores: Ultimato', price: 25.00, sessions: ['14:00', '17:00', '20:00'] },
  { id: 2, title: 'Top Gun: Maverick', price: 22.00, sessions: ['15:00', '18:00', '21:00'] },
  { id: 3, title: 'Avatar: O Caminho da Água', price: 28.00, sessions: ['13:00', '16:00', '19:00'] },
  { id: 4, title: 'Homem-Aranha: Sem Volta Para Casa', price: 24.00, sessions: ['14:30', '17:30', '20:30'] }
];

const purchaseRequests = new Map(); // armazena pedidos pendentes
const adminUsers = new Map(); // usuários admin conectados

// Middleware de autenticação
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.sendStatus(401);
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// Rotas da API

// Listar filmes disponíveis
app.get('/api/movies', (req, res) => {
  res.json(movies);
});

// Fazer pedido de compra
app.post('/api/purchase', async (req, res) => {
  try {
    const { movieId, session, customerName, customerEmail, quantity } = req.body;
    
    // Validações
    if (!movieId || !session || !customerName || !customerEmail || !quantity) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
    }
    
    const movie = movies.find(m => m.id === parseInt(movieId));
    if (!movie) {
      return res.status(404).json({ error: 'Filme não encontrado' });
    }
    
    if (!movie.sessions.includes(session)) {
      return res.status(400).json({ error: 'Sessão não disponível' });
    }
    
    // Criar pedido
    const purchaseId = uuidv4();
    const totalPrice = movie.price * quantity;
    
    const purchaseRequest = {
      purchaseId,
      movieId,
      movieTitle: movie.title,
      session,
      customerName,
      customerEmail,
      quantity,
      unitPrice: movie.price,
      totalPrice,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    
    // Armazenar pedido
    purchaseRequests.set(purchaseId, purchaseRequest);
    
    // Notificar admins em tempo real
    io.to('admin').emit('admin_notification', {
      type: 'new_purchase_request',
      purchaseRequest
    });
    
    res.json({
      success: true,
      purchaseId,
      message: 'Pedido enviado para análise'
    });
    
  } catch (error) {
    console.error('Erro ao processar compra:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Login admin
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Verificar credenciais
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      const token = jwt.sign(
        { username, role: 'admin' },
        JWT_SECRET,
        { expiresIn: '24h' }
      );
      
      res.json({
        success: true,
        token,
        user: { username, role: 'admin' }
      });
    } else {
      res.status(401).json({ error: 'Credenciais inválidas' });
    }
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Listar pedidos pendentes (admin)
app.get('/api/admin/pending-requests', authenticateToken, (req, res) => {
  const pendingRequests = Array.from(purchaseRequests.values())
    .filter(request => request.status === 'pending')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  res.json(pendingRequests);
});

// Aprovar/Rejeitar pedido (admin)
app.post('/api/admin/process-request', authenticateToken, async (req, res) => {
  try {
    const { purchaseId, action, reason } = req.body; // action: 'approve' ou 'reject'
    
    if (!purchaseId || !action) {
      return res.status(400).json({ error: 'purchaseId e action são obrigatórios' });
    }
    
    const request = purchaseRequests.get(purchaseId);
    if (!request) {
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }
    
    // Atualizar status
    request.status = action === 'approve' ? 'approved' : 'rejected';
    request.processedAt = new Date().toISOString();
    request.processedBy = req.user.username;
    if (reason) request.reason = reason;
    
    // Enviar resposta via WebSocket para o usuário
    io.emit('purchase_response', request);
    
    res.json({
      success: true,
      message: `Pedido ${action === 'approve' ? 'aprovado' : 'rejeitado'} com sucesso`
    });
    
  } catch (error) {
    console.error('Erro ao processar pedido:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// WebSocket para comunicação em tempo real
io.on('connection', (socket) => {
  console.log('🔌 Cliente conectado:', socket.id);
  
  // Join room admin se for admin
  socket.on('join_admin', (token) => {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded.role === 'admin') {
        socket.join('admin');
        adminUsers.set(socket.id, decoded.username);
        console.log('👑 Admin conectado:', decoded.username);
      }
    } catch (error) {
      console.error('Token inválido:', error);
    }
  });
  
  socket.on('disconnect', () => {
    console.log('🔌 Cliente desconectado:', socket.id);
    adminUsers.delete(socket.id);
  });
});

// Inicializar servidor
server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`🌐 API disponível em http://localhost:${PORT}/api`);
  console.log(`👑 Admin: username=${ADMIN_USERNAME}, password=${ADMIN_PASSWORD}`);
  console.log(`📝 Modo simplificado - sem RabbitMQ`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Desligando servidor...');
  process.exit(0);
});