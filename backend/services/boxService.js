const axios = require('axios');
const jwt = require('jsonwebtoken');
const forge = require('node-forge');
const crypto = require('crypto');
const NodeCache = require("node-cache");
require('dotenv').config();

const myCache = new NodeCache({ stdTTL: 60, checkperiod: 120 });

// Fonction pour déchiffrer la clé privée chiffrée
const getDecryptedPrivateKey = () => {
  if (!process.env.BOX_JWT_PRIVATE_KEY) {
    throw new Error("BOX_JWT_PRIVATE_KEY n'est pas défini dans le fichier .env");
  }
  if (!process.env.BOX_JWT_PASSPHRASE) {
    throw new Error("BOX_JWT_PASSPHRASE n'est pas défini dans le fichier .env");
  }

  const encryptedKey = process.env.BOX_JWT_PRIVATE_KEY.replace(/\\n/g, '\n');
  const passphrase = process.env.BOX_JWT_PASSPHRASE;

  try {
    const pki = forge.pki;
    const privateKey = pki.decryptRsaPrivateKey(encryptedKey, passphrase);
    return pki.privateKeyToPem(privateKey);
  } catch (error) {
    console.error("Erreur lors du déchiffrement de la clé privée :", error.message);
    throw new Error("Erreur lors du déchiffrement de la clé privée : " + error.message);
  }
};

// Fonction pour générer un token JWT avec un jti unique et valide
const generateJWT = (forceEnterprise = false) => {
  // Vérification des variables d'environnement critiques
  if (!process.env.BOX_ENTERPRISE_ID) {
    throw new Error("BOX_ENTERPRISE_ID est manquant dans le fichier .env");
  }
  if (!process.env.BOX_SERVICE_CLIENT_ID) {
    throw new Error("BOX_SERVICE_CLIENT_ID est manquant dans le fichier .env");
  }

  // Déterminer le sujet du token : utilisateur ou entreprise
  let subject = process.env.BOX_ENTERPRISE_ID;
  let subjectType = 'enterprise';

  // Si un ID utilisateur est défini et qu'on ne force pas l'entreprise
  if (process.env.BOX_USER_ID && !forceEnterprise) {
    subject = process.env.BOX_USER_ID;
    subjectType = 'user';
    console.log(`🔑 Génération JWT User pour ID: ${subject}`);
  } else {
    console.log(`🔑 Génération JWT Enterprise (Service Account) pour Enterprise ID: ${process.env.BOX_ENTERPRISE_ID}`);
    console.log(`ℹ️  Client ID utilisé : ${process.env.BOX_SERVICE_CLIENT_ID}`);
  }

  const claims = {
    iss: process.env.BOX_SERVICE_CLIENT_ID,
    sub: subject,
    box_sub_type: subjectType,
    aud: 'https://api.box.com/oauth2/token',
    jti: crypto.randomUUID(),
    exp: Math.floor(Date.now() / 1000) + 45
  };

  const privateKey = getDecryptedPrivateKey();

  try {
    const token = jwt.sign(claims, privateKey, { algorithm: 'RS512' });
    return token;
  } catch (error) {
    console.error("Erreur lors de la signature du token JWT :", error.message);
    throw new Error("Erreur lors de la signature du token JWT : " + error.message);
  }
};

const getBoxToken = async () => {
  const cachedToken = myCache.get("box_access_token");
  if (cachedToken) {
    return cachedToken;
  }

  // On force l'utilisation du compte de service (Enterprise) pour les opérations backend
  // Cela évite les erreurs "unauthorized_client" si l'app n'a pas le droit d'impersonner un utilisateur spécifique
  const assertion = generateJWT(true);

  try {
    const response = await axios.post('https://api.box.com/oauth2/token', new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      client_id: process.env.BOX_SERVICE_CLIENT_ID,
      client_secret: process.env.BOX_SERVICE_CLIENT_SECRET,
      assertion: assertion
    }));

    const accessToken = response.data.access_token;
    // Cache le token pour sa durée de validité moins une marge de sécurité
    myCache.set("box_access_token", accessToken, response.data.expires_in - 60);
    return accessToken;
  } catch (error) {
    console.error("Erreur lors de l'obtention du token Box :", error.response?.data || error.message);
    throw new Error("Erreur d'authentification Service Account Box.");
  }
};

const getAuthorizeURL = () => {
  // On limite les permissions demandées uniquement à la lecture/écriture des fichiers
  // pour éviter d'effrayer l'utilisateur avec des demandes d'administration (Gérer l'entreprise, etc.)
  return `https://account.box.com/api/oauth2/authorize?response_type=code&client_id=${process.env.BOX_CLIENT_ID}&redirect_uri=https://localhost:3001/api/auth/callback&scope=root_readwrite`;
};

const getTokensFromCode = async (code) => {
  try {
    const response = await axios.post('https://api.box.com/oauth2/token', new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      client_id: process.env.BOX_CLIENT_ID,
      client_secret: process.env.BOX_CLIENT_SECRET,
      redirect_uri: 'https://localhost:3001/api/auth/callback'
    }));
    return response.data;
  } catch (error) {
    console.error("Erreur lors de l'échange du code d'autorisation :", error.response?.data || error.message);
    throw new Error("Erreur d'authentification Box.");
  }
};

const getCurrentUser = async (accessToken) => {
  try {
    const response = await axios.get('https://api.box.com/2.0/users/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    return response.data;
  } catch (error) {
    console.error("Erreur lors de la récupération de l'utilisateur :", error.response?.data || error.message);
    throw error;
  }
};

// Fonction pour récupérer les fichiers d'un dossier Box
const getFilesFromBox = async (folderId, accessToken = null) => {
  try {
    const token = accessToken || await getBoxToken();
    
    // Pas besoin de header As-User si le token est déjà un User Token
    const headers = {
      Authorization: `Bearer ${token}`
    };

    const response = await axios.get(`https://api.box.com/2.0/folders/${folderId}/items`, {
      headers: headers,
      params: {
        fields: 'id,name,size,modified_at,type,owned_by,shared_link,item_status,tags',
        limit: 1000,
        offset: 0
      }
    });
    console.log("Réponse Box (nombre d'éléments) :", response.data.entries.length);
    return { entries: response.data.entries };
  } catch (error) {
    console.error("Erreur lors de la récupération des fichiers :", error.response?.data || error.message);
    throw new Error("Erreur lors de la récupération des fichiers : " + JSON.stringify(error.response?.data));
  }
};




// Fonction pour récupérer les métadonnées d'un fichier
const getMetadataFromBox = async (fileId, accessToken = null) => {
  try {
    const token = accessToken || await getBoxToken();
    const response = await axios.get(`https://api.box.com/2.0/files/${fileId}`, {
      headers: {
        Authorization: `Bearer ${token}`
      },
      params: {
        fields: 'name,size,modified_at,created_at,extension,sha1,description,owned_by,shared_link,parent'
      }
    });

    return response.data;
  } catch (error) {
    console.error("Erreur lors de la récupération des métadonnées :", error.response?.data || error.message);
    throw new Error("Erreur lors de la récupération des métadonnées : " + JSON.stringify(error.response?.data));
  }
};

// Fonction pour vérifier les informations du compte de service
const checkServiceAccountPermissions = async (accessToken = null) => {
  try {
    const token = accessToken || await getBoxToken();
    const response = await axios.get('https://api.box.com/2.0/users/me', {
      headers: {
        Authorization: `Bearer ${token}`
      },
      params: {
        fields: 'id,name,login,role,address,avatar_url,created_at,modified_at,language,timezone,space_amount,space_used,max_upload_size,status,job_title,phone,login'
      }
    });

    return response.data;
  } catch (error) {
    console.error("Erreur lors de la récupération des informations sur le compte de service :", error.response?.data || error.message);
    throw new Error("Erreur lors de la récupération des informations sur le compte de service : " + JSON.stringify(error.response?.data));
  }
};

// Fonction pour récupérer les informations d'un dossier
const getFolderInfo = async (folderId, accessToken = null) => {
  try {
    const token = accessToken || await getBoxToken();
    
    // Cache Key
    const cacheKey = `folderInfo_${folderId}_${token.substring(token.length - 10)}`;
    const cachedData = myCache.get(cacheKey);
    if (cachedData) {
        console.log(`[CACHE] Serving folder info for ${folderId}`);
        return cachedData;
    }

    const response = await axios.get(`https://api.box.com/2.0/folders/${folderId}`, {
      headers: {
        Authorization: `Bearer ${token}`
      },
      params: {
        fields: 'id,name,size,created_at,modified_at,item_collection,owned_by'
      }
    });
    console.log("Informations sur le dossier :", response.data);
    
    myCache.set(cacheKey, response.data);
    return response.data;
  } catch (error) {
    console.error("Erreur lors de la récupération des informations du dossier :", error.response?.data || error.message);
    throw new Error("Erreur lors de la récupération des informations du dossier : " + JSON.stringify(error.response?.data));
  }
};

// Fonction pour récupérer le lien de prévisualisation (Embed Link)
const getFilePreviewLink = async (fileId, accessToken = null) => {
  try {
    const token = accessToken || await getBoxToken();
    const response = await axios.get(`https://api.box.com/2.0/files/${fileId}`, {
      headers: {
        Authorization: `Bearer ${token}`
      },
      params: {
        fields: 'expiring_embed_link'
      }
    });
    
    if (response.data.expiring_embed_link && response.data.expiring_embed_link.url) {
        return response.data.expiring_embed_link.url;
    } else {
        throw new Error("Impossible de générer un lien de prévisualisation pour ce fichier.");
    }

  } catch (error) {
    console.error("Erreur lors de la récupération du lien de prévisualisation :", error.response?.data || error.message);
    throw new Error("Erreur lors de la récupération du lien de prévisualisation : " + JSON.stringify(error.response?.data));
  }
};

// Fonction pour récupérer l'URL de téléchargement (User Token Only)
const getDownloadUrl = async (fileId, accessToken) => {
  try {
    // Note: On n'utilise PAS de fallback sur getBoxToken() ici car on veut garantir
    // que c'est l'utilisateur qui fait la demande avec ses propres permissions.
    if (!accessToken) {
        throw new Error("Authentification utilisateur requise pour le téléchargement.");
    }

    // L'API Box pour le contenu renvoie une 302 Found vers l'URL réelle de téléchargement
    // Axios suit les redirections par défaut, mais pour des gros fichiers ou pour contrôler le flux,
    // on peut vouloir récupérer l'URL de redirection.
    // Ici, on laisse axios suivre ou on capture la redirection.
    // L'endpoint est GET /files/:id/content
    
    const response = await axios.get(`https://api.box.com/2.0/files/${fileId}/content`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      maxRedirects: 0, // On veut capturer la redirection 302 nous-mêmes
      validateStatus: status => status >= 200 && status < 400 // Accepter 302 comme succès
    });

    // Si on a une redirection (ce qui est le cas normal pour /content)
    if (response.status === 302 && response.headers.location) {
        return response.headers.location;
    }
    
    // Si Box renvoie le contenu directement (rare pour cette config mais possible pour petits fichiers parfois ?)
    // En général Box API renvoie 302.
    throw new Error("Impossible de récupérer l'URL de téléchargement.");

  } catch (error) {
    // Si Axios capture la 302 comme une erreur (si config différente) ou si vraie erreur
    if (error.response && error.response.status === 302) {
        return error.response.headers.location;
    }
    console.error("Erreur lors de la récupération de l'URL de téléchargement :", error.message);
    // On propage l'erreur pour que le contrôleur puisse renvoyer 403 si c'est le cas
    throw error;
  }
};

// Fonction pour récupérer les templates de métadonnées
const getMetadataTemplates = async (scope = 'enterprise', accessToken = null) => {
    try {
        const token = accessToken || await getBoxToken();
        const response = await axios.get(`https://api.box.com/2.0/metadata_templates/${scope}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data.entries;
    } catch (error) {
        console.error("Erreur lors de la récupération des templates de métadonnées :", error.response?.data || error.message);
        throw new Error("Erreur lors de la récupération des templates de métadonnées.");
    }
};

// Fonction pour récupérer le schéma d'un template de métadonnées
const getMetadataTemplateSchema = async (scope, templateKey, accessToken = null) => {
    try {
        const token = accessToken || await getBoxToken();
        const response = await axios.get(`https://api.box.com/2.0/metadata_templates/${scope}/${templateKey}/schema`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        console.error(`Erreur lors de la récupération du schéma du template ${templateKey} :`, error.response?.data || error.message);
        throw new Error(`Erreur lors de la récupération du schéma du template ${templateKey}.`);
    }
};

// Fonction pour rechercher des fichiers dans Box
const searchFiles = async (filters, accessToken = null) => {
    try {
        console.log("🔍 [searchFiles] Filtres reçus :", JSON.stringify(filters, null, 2));

        const token = accessToken || await getBoxToken();
        const headers = { Authorization: `Bearer ${token}` };

        const params = {
            fields: 'id,name,size,modified_at,type,owned_by,shared_link,item_status,tags,path_collection',
            limit: 200,
            offset: 0
        };

        // Si un mot-clé est fourni, on l'ajoute. Sinon, Box permet parfois d'omettre query si d'autres filtres sont présents.
        // Si Box exige query, on pourrait devoir gérer ça autrement, mais '*' est souvent littéral.
        if (filters.keyword && filters.keyword.trim() !== '') {
            params.query = filters.keyword;
        }

        // Helper pour gérer les booléens qui arrivent parfois sous forme de string "true"/"false"
        const isTrue = (val) => val === true || val === 'true';

        // --- Gestion des extensions (Types de fichiers) ---
        let extensions = [];
        if (filters.type) {
            if (isTrue(filters.type.boxnote)) extensions.push('boxnote');
            if (isTrue(filters.type.boxcanvas)) extensions.push('boxcanvas');
            if (isTrue(filters.type.pdf)) extensions.push('pdf');
            if (isTrue(filters.type.document)) extensions.push('doc', 'docx', 'txt', 'rtf', 'odt', 'gdoc');
            if (isTrue(filters.type.spreadsheet)) extensions.push('xls', 'xlsx', 'csv', 'ods', 'gsheet');
            if (isTrue(filters.type.presentation)) extensions.push('ppt', 'pptx', 'odp', 'gslide');
            if (isTrue(filters.type.image)) extensions.push('jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'tiff', 'webp');
            if (isTrue(filters.type.audio)) extensions.push('mp3', 'wav', 'aac', 'm4a', 'ogg', 'wma');
            if (isTrue(filters.type.video)) extensions.push('mp4', 'mov', 'avi', 'wmv', 'mkv', 'webm', 'flv');
            if (isTrue(filters.type.drawing)) extensions.push('ai', 'psd', 'eps', 'indd');
            if (isTrue(filters.type.threeD)) extensions.push('obj', 'stl', 'fbx', 'dae', '3ds');
        }
        if (extensions.length > 0) {
            params.file_extensions = extensions.join(',');
            
            // Si pas de mot-clé, on utilise les extensions comme requête pour éviter l'erreur 400 (Query required)
            // Cela permet de trouver "tous les PDF" par exemple, car l'extension est généralement indexée.
            if (!params.query) {
                params.query = extensions.join(' OR ');
            }
        }

        // --- Gestion Type (Fichier / Dossier) ---
        if (filters.type) {
            const types = [];
            if (isTrue(filters.type.folder)) types.push('folder');
            if (isTrue(filters.type.file) || extensions.length > 0) types.push('file');
            
            // Si "Dossiers" et "Fichiers" sont cochés (ou aucun), Box cherche tout par défaut.
            // Si seulement l'un des deux est coché, on filtre.
            if (types.length === 1) {
                params.type = types[0];
            }
        }

        // --- Gestion Date (modified_at_range) ---
        // Format Box: 2012-12-12T10:53:43-08:00,2012-12-12T11:00:00-08:00
        if (filters.date && filters.date !== 'any') {
            const now = new Date();
            let fromDate = new Date();
            
            if (filters.date === 'yesterday') fromDate.setDate(now.getDate() - 2);
            if (filters.date === 'lastWeek') fromDate.setDate(now.getDate() - 7);
            if (filters.date === 'lastMonth') fromDate.setDate(now.getDate() - 30);
            if (filters.date === 'lastYear') fromDate.setDate(now.getDate() - 365);
            
            params.updated_at_range = `${fromDate.toISOString()},${now.toISOString()}`;
        }

        // --- Gestion Taille (size_range) ---
        // Format Box: lower_bound,upper_bound (en octets)
        if (filters.size && filters.size !== 'any') {
            const MB = 1048576;
            if (filters.size === 'small') params.size_range = `,${1 * MB}`; // < 1MB
            if (filters.size === 'medium') params.size_range = `${1 * MB},${5 * MB}`;
            if (filters.size === 'large') params.size_range = `${5 * MB},${25 * MB}`;
            if (filters.size === 'huge') params.size_range = `${25 * MB},${100 * MB}`;
            if (filters.size === 'gigantic') params.size_range = `${100 * MB},${1024 * MB}`;
            if (filters.size === 'massive') params.size_range = `${1024 * MB},`; // > 1GB
        }

        // --- Gestion Propriétaire ---
        // Note: L'API Box demande des owner_user_ids. La recherche par nom est complexe sans lookup.
        // On ajoute le nom au query si présent, c'est le mieux qu'on puisse faire simplement.
        if (filters.owner) {
             params.query = params.query ? `${params.query} "${filters.owner}"` : `"${filters.owner}"`;
        }

        // --- Gestion Tags ---
        // Note: Box n'a pas de filtre tags direct en search simple, mais le query cherche dedans.
        if (filters.tags) {
            params.query = params.query ? `${params.query} ${filters.tags}` : `${filters.tags}`;
        }
        
        // --- Gestion des Filtres de Métadonnées (MDFilters) ---
        if (filters.metadata && filters.metadata.templateKey && filters.metadata.data) {
            const mdFilters = [];
            const dataFilters = {};
            
            // On ne garde que les champs qui ont une valeur sélectionnée
            Object.keys(filters.metadata.data).forEach(key => {
                const value = filters.metadata.data[key];
                if (value && value !== 'any' && value !== '') {
                    dataFilters[key] = value;
                }
            });

            if (Object.keys(dataFilters).length > 0) {
                // Construction du scope correct.
                // Si 'enterprise', on préfère explicitement 'enterprise_ID' pour éviter les ambiguïtés,
                // surtout si l'utilisateur est externe ou si l'API est stricte.
                let scope = filters.metadata.scope || 'enterprise';
                if (scope === 'enterprise' && process.env.BOX_ENTERPRISE_ID) {
                    scope = `enterprise_${process.env.BOX_ENTERPRISE_ID}`;
                }

                mdFilters.push({
                    scope: scope,
                    templateKey: filters.metadata.templateKey,
                    filters: dataFilters
                });
                params.mdfilters = JSON.stringify(mdFilters);
            }
        }

        // --- Fallback Query (Si aucune recherche mot-clé n'est faite) ---
        // Box exige un paramètre 'query' SAUF SI on utilise des filtres de métadonnées (mdfilters).
        // Si mdfilters est présent, on ne doit PAS mettre de query par défaut, ou du moins pas '*',
        // car cela cause une erreur 400 Bad Request avec l'API Box quand mdfilters est utilisé.
        if (!params.query && !params.mdfilters) {
            params.query = '*';
            console.log("Aucun mot-clé fourni et pas de mdfilters. Utilisation du wildcard query :", params.query);
        }

        // Ajout d'une limite pour avoir plus de résultats d'un coup sans pagination excessive
        params.limit = 200;
        params.offset = 0;
        // On cible la racine par défaut si pas de dossier spécifique (évite certaines erreurs 400 en l'absence de query)
        params.ancestor_folder_ids = '0';

        console.log("Paramètres de recherche Box optimisés:", params);

        const response = await axios.get('https://api.box.com/2.0/search', {
            headers: headers,
            params: params
        });

        // Optimisation: On retourne directement les résultats de Box sans re-filtrage JavaScript coûteux.
        // L'API Box a déjà appliqué les filtres de date, taille, type, etc.
        // Le seul cas où un filtrage JS pourrait être utile est pour des règles métier très spécifiques non supportées par l'API,
        // mais pour la performance, on fait confiance au moteur de recherche.

        let entries = response.data.entries || [];
        
        // Petit nettoyage optionnel : s'assurer que les objets ont bien les champs minimums requis par le frontend
        // mais sans filtrer/rejeter des items valides.

        return {
            ...response.data,
            entries,
            total_count: response.data.total_count || entries.length
        };
    } catch (error) {
        console.error("Erreur lors de la recherche Box :", error.response?.data || error.message);
        if (error.response?.data?.context_info) {
             console.error("Détails de l'erreur (context_info) :", JSON.stringify(error.response.data.context_info, null, 2));
        }
        throw new Error("Erreur lors de la recherche.");
    }
};

module.exports = {
  getFilesFromBox,
  getMetadataFromBox,
  checkServiceAccountPermissions,
  getFolderInfo,
  getFilePreviewLink,
  searchFiles,
  getMetadataTemplates,
  getMetadataTemplateSchema,
  getAuthorizeURL,
  getTokensFromCode,
  getCurrentUser,
  getDownloadUrl
};

