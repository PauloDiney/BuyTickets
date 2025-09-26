import React, { useState, useEffect } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import './index.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// Gêneros dos filmes para tornar mais realista
const movieGenres = {
  1: 'Ação, Aventura, Ficção Científica',
  2: 'Ação, Drama',
  3: 'Aventura, Ficção Científica, Fantasia',
  4: 'Ação, Aventura, Ficção Científica'
};

function App() {
  const [movies, setMovies] = useState([]);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [selectedSession, setSelectedSession] = useState('');
  const [showPurchaseForm, setShowPurchaseForm] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);
  const [socket, setSocket] = useState(null);

  // Dados do formulário
  const [formData, setFormData] = useState({
    customerName: '',
    customerEmail: '',
    quantity: 1
  });

  // Conectar ao WebSocket
  useEffect(() => {
    const newSocket = io('http://localhost:3001');
    
    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('Conectado ao servidor');
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Desconectado do servidor');
    });

    newSocket.on('purchase_response', (response) => {
      console.log('Resposta da compra recebida:', response);
      
      if (response.status === 'approved') {
        showNotification(
          `✅ Compra aprovada! Seu ticket para "${response.movieTitle}" foi confirmado.`,
          'success'
        );
      } else if (response.status === 'rejected') {
        showNotification(
          `❌ Compra rejeitada. ${response.reason || 'Tente novamente mais tarde.'}`,
          'error'
        );
      }
    });

    setSocket(newSocket);

    return () => newSocket.close();
  }, []);

  // Carregar filmes
  useEffect(() => {
    loadMovies();
  }, []);

  const loadMovies = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/movies`);
      setMovies(response.data);
      setError(null);
    } catch (error) {
      console.error('Erro ao carregar filmes:', error);
      setError('Erro ao carregar filmes. Verifique se o servidor está rodando.');
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleBuyClick = (movie) => {
    setSelectedMovie(movie);
    setSelectedSession('');
    setShowPurchaseForm(true);
    setFormData({
      customerName: '',
      customerEmail: '',
      quantity: 1
    });
  };

  const handleFormChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handlePurchase = async (e) => {
    e.preventDefault();
    
    if (!selectedSession) {
      showNotification('Por favor, selecione uma sessão', 'error');
      return;
    }

    try {
      const purchaseData = {
        movieId: selectedMovie.id,
        session: selectedSession,
        ...formData,
        quantity: parseInt(formData.quantity)
      };

      const response = await axios.post(`${API_BASE_URL}/purchase`, purchaseData);
      
      if (response.data.success) {
        showNotification(
          `Pedido enviado com sucesso! ID: ${response.data.purchaseId}. Aguarde a aprovação do administrador.`,
          'info'
        );
        setShowPurchaseForm(false);
      }
    } catch (error) {
      console.error('Erro na compra:', error);
      const errorMessage = error.response?.data?.error || 'Erro ao processar compra';
      showNotification(errorMessage, 'error');
    }
  };

  const handleCancel = () => {
    setShowPurchaseForm(false);
    setSelectedMovie(null);
    setSelectedSession('');
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Carregando filmes...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Navigation */}
      <nav className="navbar">
        <div className="nav-container">
          <div className="logo">
            🎬 BuyTickets
          </div>
          <ul className="nav-links">
            <li><a href="#filmes">Filmes</a></li>
            <li><a href="#promocoes">Promoções</a></li>
            <li><a href="#cinemas">Cinemas</a></li>
            <li><a href="#contato">Contato</a></li>
          </ul>
        </div>
      </nav>

      {/* Status de conexão */}
      <div className={`status-indicator ${isConnected ? 'status-connected' : 'status-disconnected'}`}>
        {isConnected ? '🟢 Online' : '🔴 Offline'}
      </div>

      {/* Notificações */}
      {notification && (
        <div className={`notification notification-${notification.type}`}>
          {notification.message}
        </div>
      )}

      {/* Hero Section */}
      {!showPurchaseForm && (
        <section className="hero-section">
          <div className="hero-content">
            <h1>Filmes em Cartaz</h1>
            <p>Reserve seu ingresso e garanta o melhor lugar na sala</p>
          </div>
        </section>
      )}

      <div className="container">
        {/* Erro */}
        {error && (
          <div className="error-message">
            {error}
            <br />
            <button onClick={loadMovies} style={{ marginTop: '10px', padding: '5px 10px' }}>
              Tentar novamente
            </button>
          </div>
        )}

        {/* Lista de filmes */}
        {!showPurchaseForm && (
          <section className="movies-section" id="filmes">
            <h2 className="section-title">Escolha seu Filme</h2>
            <div className="movies-grid">
              {movies.map(movie => (
                <div key={movie.id} className="movie-card">
                  <div className="movie-poster">
                    🎬
                  </div>
                  <div className="movie-info">
                    <h3>{movie.title}</h3>
                    <div className="movie-genre">{movieGenres[movie.id]}</div>
                    <div className="movie-price">R$ {movie.price.toFixed(2)}</div>
                    
                    <div className="sessions">
                      <h4>Horários disponíveis:</h4>
                      <div className="sessions-grid">
                        {movie.sessions.map(session => (
                          <div key={session} className="session-btn">
                            {session}
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <button 
                      className="buy-btn"
                      onClick={() => handleBuyClick(movie)}
                    >
                      Comprar Ingresso
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Formulário de compra */}
        {showPurchaseForm && selectedMovie && (
          <div className="purchase-form">
            <h2>Finalizar Compra</h2>
            
            <div className="movie-selected">
              <h3>{selectedMovie.title}</h3>
              <p><strong>Gênero:</strong> {movieGenres[selectedMovie.id]}</p>
              <p><strong>Preço unitário:</strong> R$ {selectedMovie.price.toFixed(2)}</p>
            </div>
            
            <form onSubmit={handlePurchase}>
              <div className="form-group">
                <label>Horário da Sessão:</label>
                <select 
                  value={selectedSession} 
                  onChange={(e) => setSelectedSession(e.target.value)}
                  required
                >
                  <option value="">Selecione um horário</option>
                  {selectedMovie.sessions.map(session => (
                    <option key={session} value={session}>{session}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Nome Completo:</label>
                <input
                  type="text"
                  name="customerName"
                  value={formData.customerName}
                  onChange={handleFormChange}
                  placeholder="Digite seu nome completo"
                  required
                />
              </div>

              <div className="form-group">
                <label>E-mail:</label>
                <input
                  type="email"
                  name="customerEmail"
                  value={formData.customerEmail}
                  onChange={handleFormChange}
                  placeholder="seu@email.com"
                  required
                />
              </div>

              <div className="form-group">
                <label>Quantidade de Ingressos:</label>
                <select
                  name="quantity"
                  value={formData.quantity}
                  onChange={handleFormChange}
                  required
                >
                  {[1,2,3,4,5].map(num => (
                    <option key={num} value={num}>{num} ingresso{num > 1 ? 's' : ''}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <div style={{
                  background: '#333',
                  padding: '15px',
                  borderRadius: '8px',
                  textAlign: 'center',
                  border: '2px solid #ff6b35'
                }}>
                  <strong style={{color: '#ff6b35', fontSize: '1.3rem'}}>
                    Total: R$ {(selectedMovie.price * formData.quantity).toFixed(2)}
                  </strong>
                </div>
              </div>

              <div className="form-actions">
                <button type="submit" className="btn btn-primary">
                  Finalizar Pedido
                </button>
                <button type="button" className="btn btn-secondary" onClick={handleCancel}>
                  Voltar
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-links">
            <a href="#sobre">Sobre</a>
            <a href="#termos">Termos de Uso</a>
            <a href="#privacidade">Privacidade</a>
            <a href="#ajuda">Ajuda</a>
          </div>
          <p>&copy; 2025 BuyTickets. Todos os direitos reservados.</p>
          <p>Sistema de compra de ingressos com mensageria em tempo real</p>
        </div>
      </footer>
    </div>
  );
}

export default App;