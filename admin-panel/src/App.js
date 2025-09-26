import React, { useState, useEffect } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import './index.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [token, setToken] = useState(localStorage.getItem('adminToken'));
  const [pendingRequests, setPendingRequests] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);
  const [socket, setSocket] = useState(null);
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    rejected: 0
  });

  // Dados do formulário de login
  const [loginData, setLoginData] = useState({
    username: '',
    password: ''
  });

  // Verificar autenticação
  useEffect(() => {
    if (token) {
      setIsAuthenticated(true);
      setupAxiosDefaults();
      connectWebSocket();
      loadPendingRequests();
    }
  }, [token]);

  const setupAxiosDefaults = () => {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  };

  const connectWebSocket = () => {
    const newSocket = io('http://localhost:3001');
    
    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('Conectado ao servidor');
      // Join admin room
      newSocket.emit('join_admin', token);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Desconectado do servidor');
    });

    newSocket.on('admin_notification', (notification) => {
      console.log('Notificação recebida:', notification);
      
      if (notification.type === 'new_purchase_request') {
        showNotification('🔔 Nova solicitação de compra recebida!', 'new');
        loadPendingRequests(); // Recarregar lista
      }
    });

    setSocket(newSocket);
  };

  const loadPendingRequests = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/admin/pending-requests`);
      setPendingRequests(response.data);
      
      // Atualizar estatísticas
      setStats(prev => ({
        ...prev,
        pending: response.data.length
      }));
      
      setError(null);
    } catch (error) {
      console.error('Erro ao carregar pedidos:', error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        handleLogout();
      } else {
        setError('Erro ao carregar pedidos pendentes');
      }
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      const response = await axios.post(`${API_BASE_URL}/admin/login`, loginData);
      
      if (response.data.success) {
        const newToken = response.data.token;
        setToken(newToken);
        localStorage.setItem('adminToken', newToken);
        setIsAuthenticated(true);
        setupAxiosDefaults();
        connectWebSocket();
        showNotification('Login realizado com sucesso!', 'success');
      }
    } catch (error) {
      console.error('Erro no login:', error);
      const errorMessage = error.response?.data?.error || 'Erro ao fazer login';
      showNotification(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('adminToken');
    setIsAuthenticated(false);
    delete axios.defaults.headers.common['Authorization'];
    if (socket) {
      socket.disconnect();
    }
    setPendingRequests([]);
    setStats({ pending: 0, approved: 0, rejected: 0 });
  };

  const handleProcessRequest = async (purchaseId, action, reason = '') => {
    try {
      const response = await axios.post(`${API_BASE_URL}/admin/process-request`, {
        purchaseId,
        action,
        reason
      });

      if (response.data.success) {
        showNotification(response.data.message, 'success');
        
        // Remover da lista local
        setPendingRequests(prev => prev.filter(req => req.purchaseId !== purchaseId));
        
        // Atualizar estatísticas
        setStats(prev => ({
          pending: prev.pending - 1,
          approved: action === 'approve' ? prev.approved + 1 : prev.approved,
          rejected: action === 'reject' ? prev.rejected + 1 : prev.rejected
        }));
      }
    } catch (error) {
      console.error('Erro ao processar pedido:', error);
      const errorMessage = error.response?.data?.error || 'Erro ao processar pedido';
      showNotification(errorMessage, 'error');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const formatCurrency = (value) => {
    return `R$ ${value.toFixed(2)}`;
  };

  // Tela de login
  if (!isAuthenticated) {
    return (
      <div className="container">
        {notification && (
          <div className={`notification notification-${notification.type}`}>
            {notification.message}
          </div>
        )}

        <form className="login-form" onSubmit={handleLogin}>
          <h2>🔐 Login Administrativo</h2>
          
          <div className="form-group">
            <label>Usuário:</label>
            <input
              type="text"
              value={loginData.username}
              onChange={(e) => setLoginData({...loginData, username: e.target.value})}
              required
              placeholder="admin"
            />
          </div>

          <div className="form-group">
            <label>Senha:</label>
            <input
              type="password"
              value={loginData.password}
              onChange={(e) => setLoginData({...loginData, password: e.target.value})}
              required
              placeholder="admin123"
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    );
  }

  // Dashboard administrativo
  return (
    <div className="container">
      {/* Status de conexão */}
      <div className={`status-indicator ${isConnected ? 'status-connected' : 'status-disconnected'}`}>
        {isConnected ? '🟢 Conectado' : '🔴 Desconectado'}
      </div>

      {/* Botão de logout */}
      <button className="logout-btn" onClick={handleLogout}>
        🚪 Sair
      </button>

      {/* Notificações */}
      {notification && (
        <div className={`notification notification-${notification.type}`}>
          {notification.message}
        </div>
      )}

      {/* Header */}
      <div className="header">
        <h1>👑 Painel Administrativo</h1>
        <p>Gerenciamento de solicitações de compra</p>
      </div>

      <div className="dashboard">
        {/* Estatísticas */}
        <div className="stats-grid">
          <div className="stat-card">
            <h3>Pendentes</h3>
            <div className="stat-number">{stats.pending}</div>
          </div>
          <div className="stat-card">
            <h3>Aprovados</h3>
            <div className="stat-number">{stats.approved}</div>
          </div>
          <div className="stat-card">
            <h3>Rejeitados</h3>
            <div className="stat-number">{stats.rejected}</div>
          </div>
        </div>

        {/* Lista de pedidos */}
        <div className="requests-section">
          <h2>
            📋 Solicitações Pendentes
            {loading && <span style={{fontSize: '1rem'}}>🔄</span>}
          </h2>

          {error && (
            <div className="error-message">
              {error}
              <br />
              <button onClick={loadPendingRequests} style={{ marginTop: '10px', padding: '5px 10px' }}>
                Tentar novamente
              </button>
            </div>
          )}

          {pendingRequests.length === 0 && !loading && !error && (
            <div className="empty-state">
              <div className="empty-state-icon">✅</div>
              <p>Nenhuma solicitação pendente</p>
            </div>
          )}

          {pendingRequests.map(request => (
            <div key={request.purchaseId} className="request-card">
              <div className="request-header">
                <div className="request-id">ID: {request.purchaseId.slice(0, 8)}</div>
                <div className="request-time">{formatDate(request.createdAt)}</div>
              </div>

              <div className="request-details">
                <div className="detail-group">
                  <div className="detail-label">Cliente</div>
                  <div className="detail-value">{request.customerName}</div>
                </div>
                <div className="detail-group">
                  <div className="detail-label">Email</div>
                  <div className="detail-value">{request.customerEmail}</div>
                </div>
                <div className="detail-group">
                  <div className="detail-label">Filme</div>
                  <div className="detail-value">{request.movieTitle}</div>
                </div>
                <div className="detail-group">
                  <div className="detail-label">Sessão</div>
                  <div className="detail-value">{request.session}</div>
                </div>
                <div className="detail-group">
                  <div className="detail-label">Quantidade</div>
                  <div className="detail-value">{request.quantity} ingresso(s)</div>
                </div>
                <div className="detail-group">
                  <div className="detail-label">Total</div>
                  <div className="detail-value">{formatCurrency(request.totalPrice)}</div>
                </div>
              </div>

              <div className="request-actions">
                <button
                  className="btn-approve"
                  onClick={() => handleProcessRequest(request.purchaseId, 'approve')}
                >
                  ✅ Aprovar
                </button>
                <button
                  className="btn-reject"
                  onClick={() => {
                    const reason = prompt('Motivo da rejeição (opcional):');
                    handleProcessRequest(request.purchaseId, 'reject', reason || '');
                  }}
                >
                  ❌ Rejeitar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;