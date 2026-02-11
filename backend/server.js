require('dotenv').config();
const fs = require('fs');
const https = require('https');
const path = require('path');
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit'); // Sécurité : Rate Limiting
const filesRouter = require('./routes/files');
const { getAuthorizeURL, getTokensFromCode } = require('./services/boxService');

const app = express();

// Optimisation : Compression Gzip
app.use(compression());

// Sécurité : Rate Limiting (Limiter les requêtes répétées)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limite chaque IP à 300 requêtes par fenêtre
  standardHeaders: true, // Retourne les headers `RateLimit-*`
  legacyHeaders: false, // Désactive les headers `X-RateLimit-*`
  message: "Trop de requêtes depuis cette IP, veuillez réessayer plus tard."
});
app.use(limiter);

// Sécurité : Headers HTTP (Helmet)
// Configuration CSP pour autoriser les scripts Box et sécuriser l'app
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "*.box.com", "*.boxcdn.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "*.box.com", "*.boxcdn.net"],
      imgSrc: ["'self'", "data:", "*.box.com", "*.boxcdn.net"],
      connectSrc: ["'self'", "*.box.com", "https://upload.box.com", "https://api.box.com"],
      frameSrc: ["'self'", "*.box.com"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [], // Désactivé pour le dev local, à activer en prod si full HTTPS
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// Middleware pour logger les requêtes
app.use((req, res, next) => {
  if (req.params && req.params.folderId) {
    console.log(`ID du dossier dans la requête initiale : ${req.params.folderId}`);
  }
  next();
});

// Configuration CORS (autoriser les cookies/sessions)
// Sécurité : On autorise uniquement l'origine définie dans FRONTEND_URL ou localhost pour le dev
const allowedOrigins = [
    'https://localhost:3000', 
    'http://localhost:3000',
    process.env.FRONTEND_URL // URL de production (ex: https://mon-portail.com)
].filter(Boolean); // Retire les valeurs undefined/null

app.use(cors({
  origin: function (origin, callback) {
    // Autoriser les requêtes sans origine (ex: Postman, scripts serveur) ou si l'origine est dans la liste
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Non autorisé par CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true // Important pour les sessions
}));
console.log("Middleware CORS configuré pour les origines :", allowedOrigins);

app.use(express.json());
console.log("Middleware JSON activé");

// Configuration de la session
app.use(session({
  name: 'box_portal.sid',
  secret: process.env.SESSION_SECRET || 'secret_key_ragni_box_portal',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true, // true requis pour HTTPS
    httpOnly: true,
    maxAge: 3600000 // 1 heure
  }
}));

// Routes d'authentification
app.get('/api/auth/login', (req, res) => {
  const url = getAuthorizeURL();
  res.redirect(url);
});

app.get('/api/auth/callback', async (req, res) => {
  const { code } = req.query;
  console.log("Callback d'authentification reçu avec le code :", code ? "Présent" : "Manquant");
  
  if (!code) {
    return res.status(400).send("Code d'autorisation manquant.");
  }

  try {
    const tokens = await getTokensFromCode(code);
    console.log("Tokens récupérés avec succès. Access Token (fin) :", tokens.access_token.slice(-10));
    
    // Régénérer la session pour la sécurité et la stabilité
    req.session.regenerate((err) => {
      if (err) {
        console.error("Erreur lors de la régénération de la session :", err);
        return res.status(500).send("Erreur de session.");
      }

      req.session.accessToken = tokens.access_token;
      req.session.refreshToken = tokens.refresh_token;
      
      console.log("Sauvegarde de la session (ID: " + req.sessionID + ")...");
      req.session.save((err) => {
        if (err) {
          console.error("Erreur lors de la sauvegarde de la session :", err);
          return res.status(500).send("Erreur de session.");
        }
        console.log("Session sauvegardée. Redirection vers le frontend.");
        // Redirection vers le frontend (HTTPS si possible)
        res.redirect('https://localhost:3000/');
      });
    });
  } catch (error) {
    console.error("Erreur d'authentification :", error);
    res.status(500).send("Erreur d'authentification : " + error.message);
  }
});

app.get('/api/auth/status', (req, res) => {
  if (req.session && req.session.accessToken) {
    res.json({ isAuthenticated: true });
  } else {
    res.json({ isAuthenticated: false });
  }
});

app.get('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Erreur lors de la déconnexion." });
    }
    res.clearCookie('connect.sid');
    res.json({ message: "Déconnexion réussie." });
  });
});

// Middleware de vérification d'authentification pour les routes API
const requireAuth = (req, res, next) => {
    if (!req.session || !req.session.accessToken) {
        return res.status(401).json({ error: "Non authentifié. Veuillez vous connecter." });
    }
    next();
};

// Enregistrer les routes pour les fichiers avec protection
app.use('/api/files', requireAuth, filesRouter);
console.log("Route /api/files enregistrée avec protection");

// Route pour gérer les requêtes directes à /files/0 (redirection)
app.get('/files/:folderId', (req, res) => {
  console.log(`Redirection de /files/${req.params.folderId} vers /api/files/${req.params.folderId}`);
  res.redirect(301, `/api/files/${req.params.folderId}`);
});

// Route pour gérer les requêtes directes à /files (redirection)
app.get('/files', (req, res) => {
  console.log('Redirection de /files vers /api/files');
  res.redirect(301, '/api/files');
});

const PORT = process.env.PORT || 3001;

// Vérifier si les certificats SSL existent pour le développement local
const keyPath = path.join(__dirname, 'server.key');
const certPath = path.join(__dirname, 'server.cert');

if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    // Mode HTTPS (Développement local sécurisé)
    const options = {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath)
    };
    
    https.createServer(options, app).listen(PORT, () => {
        console.log(`🔒 Serveur HTTPS démarré avec succès sur le port ${PORT}`);
    });
} else {
    // Mode HTTP (Production derrière IIS ou fallback)
    app.listen(PORT, () => {
        console.log(`⚠️ Serveur HTTP (non sécurisé) démarré sur le port ${PORT}`);
    });
}

app.use((req, res, next) => {
  console.log(`🌐 Requête reçue : ${req.method} ${req.url}`);
  if (req.params && req.params.folderId) {
    console.log(`ID du dossier dans la requête : ${req.params.folderId}`);
  }
  next();
});
