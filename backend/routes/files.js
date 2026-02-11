const express = require('express');
const router = express.Router();
const { getFiles, getMetadata, checkPermissions, getFolderDetails, getPreview, searchFilesController, getMetadataTemplatesController, getMetadataTemplateSchemaController, downloadFile } = require('../controllers/files');

// Route de recherche (DOIT être avant /:folderId pour éviter les conflits)
router.get('/search', searchFilesController);

// Routes Métadonnées (avant /:folderId)
router.get('/metadata/templates/:scope', getMetadataTemplatesController);
router.get('/metadata/templates/:scope/:templateKey/schema', getMetadataTemplateSchemaController);

router.get('/folderinfo/:folderId?', getFolderDetails);

// Route pour récupérer le lien de prévisualisation d'un fichier
router.get('/preview/:fileId', getPreview);

// Route pour télécharger un fichier
router.get('/download/:fileId', downloadFile);

// Route pour récupérer les fichiers d'un dossier
router.get('/:folderId?', (req, res, next) => {
  console.log(`ID du dossier dans la route : ${req.params.folderId}`);
  next();
}, getFiles);

// Route pour récupérer les métadonnées d'un fichier
router.get('/metadata/:fileId', getMetadata);

// Route pour vérifier les permissions du compte de service
router.get('/permissions/check', checkPermissions);

module.exports = router;
