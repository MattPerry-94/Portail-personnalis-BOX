import React from 'react';

const Login = () => {
  const handleLogin = () => {
    // Redirige vers la route du backend qui initie l'auth OAuth
    // Attention : on utilise window.location.href pour une redirection complète
    window.location.href = 'https://localhost:3001/api/auth/login';
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-logos">
           <img src="/box-logo.png" alt="Box" className="login-logo-box" />
           <span className="login-x">✕</span>
           <img src="/logo.png" alt="Ragni" className="login-logo-ragni" />
        </div>
        
        <h2 className="login-title">Portail Partenaire</h2>
        <p className="login-description">
          Bienvenue sur l'espace sécurisé de partage de documents.<br/>
          Veuillez vous authentifier pour accéder à vos dossiers.
        </p>
        
        <button onClick={handleLogin} className="login-btn">
          <span>Se connecter avec Box</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5 12H19" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 5L19 12L12 19" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <div className="login-footer">
            © {new Date().getFullYear()} Groupe RAGNI. Accès sécurisé.
        </div>
      </div>
    </div>
  );
};

export default Login;
