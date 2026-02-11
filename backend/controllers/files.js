const { getFilesFromBox, getMetadataFromBox, checkServiceAccountPermissions, getFolderInfo, getFilePreviewLink, searchFiles, getMetadataTemplates, getMetadataTemplateSchema, getDownloadUrl } = require('../services/boxService');


const getFiles = async (req, res) => {
  try {
    const { folderId } = req.params;
    let targetFolderId = folderId.replace(/^d_/, '') || '0';
    const accessToken = req.session?.accessToken;

    console.log(`Requête reçue pour récupérer les fichiers du dossier ${targetFolderId}.`);
    const files = await getFilesFromBox(targetFolderId, accessToken);
    console.log(`Envoi des fichiers au client. Nombre de fichiers : ${files.entries.length}`);
    res.json(files);
  } catch (error) {
    console.error("Erreur dans getFiles :", error);
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? "Une erreur est survenue lors de la récupération des fichiers." : error.message });
  }
};

const getMetadata = async (req, res) => {
  try {
    const { fileId } = req.params;
    const accessToken = req.session?.accessToken;
    console.log(`Requête reçue pour récupérer les métadonnées du fichier ${fileId}.`);
    const metadata = await getMetadataFromBox(fileId, accessToken);
    console.log(`Envoi des métadonnées au client.`);
    res.json(metadata);
  } catch (error) {
    console.error("Erreur dans getMetadata :", error);
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? "Erreur serveur." : error.message });
  }
};

const checkPermissions = async (req, res) => {
  try {
    const accessToken = req.session?.accessToken;
    console.log("Requête reçue pour vérifier les permissions du compte de service.");
    const permissions = await checkServiceAccountPermissions(accessToken);
    console.log(`📤 Envoi des informations du compte de service.`);
    res.json(permissions);
  } catch (error) {
    console.error("Erreur dans checkPermissions :", error);
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? "Erreur serveur." : error.message });
  }
};

const getFolderDetails = async (req, res) => {
  try {
    const { folderId } = req.params;
    const accessToken = req.session?.accessToken;
    const folderDetails = await getFolderInfo(folderId || '0', accessToken);
    res.json(folderDetails);
  } catch (error) {
    console.error("Erreur dans getFolderDetails :", error);
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? "Erreur serveur." : error.message });
  }
};

const getPreview = async (req, res) => {
  try {
    const { fileId } = req.params;
    const accessToken = req.session?.accessToken;
    console.log(`Requête reçue pour récupérer le lien de prévisualisation du fichier ${fileId}.`);
    const previewLink = await getFilePreviewLink(fileId, accessToken);
    console.log(`Lien de prévisualisation généré : ${previewLink}`);
    res.json({ url: previewLink });
  } catch (error) {
    console.error("Erreur dans getPreview :", error);
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? "Erreur serveur." : error.message });
  }
};

const downloadFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    // IMPORTANT: On utilise le token de la session utilisateur, PAS le token de service.
    const accessToken = req.session?.accessToken;
    
    if (!accessToken) {
        return res.status(401).json({ error: "Vous devez être connecté pour télécharger des fichiers." });
    }

    console.log(`Requête reçue pour télécharger le fichier ${fileId} (User context).`);
    const downloadUrl = await getDownloadUrl(fileId, accessToken);
    
    if (downloadUrl) {
        res.redirect(downloadUrl);
    } else {
        res.status(404).json({ error: "Lien de téléchargement non trouvé" });
    }
  } catch (error) {
    console.error("Erreur dans downloadFile :", error);
    if (error.response && error.response.status === 403) {
        return res.status(403).json({ error: "Vous n'avez pas les permissions nécessaires pour télécharger ce fichier." });
    }
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? "Erreur de téléchargement." : error.message });
  }
};

const searchFilesController = async (req, res) => {
  try {
    // req.query contient les filtres envoyés par le frontend
    const accessToken = req.session?.accessToken;
    const results = await searchFiles(req.query, accessToken);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? "Erreur serveur." : error.message });
  }
};

const getMetadataTemplatesController = async (req, res) => {
    try {
        const { scope } = req.params;
        // On utilise le Service Account (null) pour récupérer les templates, 
        // car les utilisateurs externes n'ont souvent pas les droits de lister les templates d'entreprise.
        const templates = await getMetadataTemplates(scope, null);
        res.json(templates);
    } catch (error) {
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? "Erreur serveur." : error.message });
  }
};

const getMetadataTemplateSchemaController = async (req, res) => {
    try {
        const { scope, templateKey } = req.params;
        // Idem pour le schéma : on utilise le Service Account pour garantir l'accès à la définition
        const schema = await getMetadataTemplateSchema(scope, templateKey, null);
        res.json(schema);
    } catch (error) {
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? "Erreur serveur." : error.message });
  }
};


module.exports = { getFiles, getMetadata, checkPermissions, getFolderDetails,
  getPreview,
  downloadFile,
  searchFilesController, getMetadataTemplatesController, getMetadataTemplateSchemaController };
