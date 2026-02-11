import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import FilesList from './components/FilesList';
import Login from './components/Login';

// Configuration pour CORS avec le backend sur le port 3001
axios.defaults.baseURL = 'https://localhost:3001';
axios.defaults.withCredentials = true;

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(null); // null = loading

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await axios.get('/api/auth/status');
        setIsAuthenticated(response.data.isAuthenticated);
      } catch (error) {
        console.error("Erreur de vérification d'auth :", error);
        setIsAuthenticated(false);
      }
    };
    checkAuth();
  }, []);

  const handleLogout = async () => {
    try {
      await axios.get('/api/auth/logout');
      setIsAuthenticated(false);
    } catch (error) {
      console.error("Erreur lors de la déconnexion :", error);
    }
  };

  if (isAuthenticated === null) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh', 
        backgroundColor: '#f3f4f6',
        color: '#4b5563' 
      }}>
        Chargement...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <div className="App">
      <header className="App-header">
            <div className="header-content">
              <div className="logos-wrapper">
                <img src="/box-logo.png" alt="Box" className="Box-logo" />
                <span className="collaboration-x">✕</span>
                <img src="/logo.png" alt="Groupe RAGNI" className="App-logo" />
              </div>
              
              <h1>Portail Box</h1>
              
              <button 
                  onClick={handleLogout}
                  className="btn btn-primary"
                  style={{ marginLeft: 'auto' }}
              >
                  Déconnexion
              </button>
            </div>
          </header>
      <main>
        <FilesList />
      </main>
    </div>
  );
}

export default App;
