import React, { useState, useEffect } from 'react';
import axios from 'axios';
import FilterPanel from './FilterPanel';

const FilesList = () => {
  // const [files, setFiles] = useState([]); // Removed unused state
  const [filteredFiles, setFilteredFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // State for filters
  const [filters, setFilters] = useState({
    keyword: '',
    type: { 
      folder: false, 
      file: false,
      // Subtypes
      boxnote: false,
      boxcanvas: false,
      pdf: false,
      document: false,
      spreadsheet: false,
      presentation: false,
      image: false,
      audio: false,
      video: false,
      drawing: false,
      threeD: false
    },
    date: 'any',
    owner: '',
    size: 'any',
    tags: '',
    metadata: {
        templateKey: '',
        scope: 'enterprise',
        data: {}
    }
  });
  
  const [showFilters, setShowFilters] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState('0');
  const [folderHistory, setFolderHistory] = useState([]);
  // Cache pour la navigation rapide (Stale-While-Revalidate)
  const [folderCache, setFolderCache] = useState({});
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewFileId, setPreviewFileId] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  useEffect(() => {
    // Helper to check if any filter is active
    const isFilterActive = () => {
        if (filters.keyword) return true;
        if (filters.date !== 'any') return true;
        if (filters.size !== 'any') return true;
        if (filters.owner) return true;
        if (filters.tags) return true;
        if (filters.metadata && filters.metadata.templateKey) return true;
        const typeValues = Object.values(filters.type);
        if (typeValues.some(v => v === true)) return true;
        return false;
    };

    const fetchData = async () => {
      try {
        if (isFilterActive()) {
             setLoading(true);
             console.log("Mode Recherche activé", filters);
             const response = await axios.get('/api/files/search', { params: filters });
             setFilteredFiles(response.data.entries || []);
             setLoading(false);
        } else {
             console.log("Mode Navigation dossier", currentFolderId);
             
             // Stratégie de Cache : Afficher immédiatement si disponible
             if (folderCache[currentFolderId]) {
                 console.log("Données chargées depuis le cache pour", currentFolderId);
                 setFilteredFiles(folderCache[currentFolderId]);
                 setLoading(false); // On affiche tout de suite
             } else {
                 setLoading(true); // Sinon on montre le loading
             }

             // Récupération des données fraîches (background update)
             const response = await axios.get(`/api/files/${currentFolderId}`);
             
             // Mise à jour de l'état et du cache
             setFilteredFiles(response.data.entries);
             setFolderCache(prev => ({
                 ...prev,
                 [currentFolderId]: response.data.entries
             }));
             setLoading(false);
        }
      } catch (error) {
        console.error("Erreur lors de la récupération des données :", error);
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(() => {
        fetchData();
    }, 300); // Debounce de 300ms pour éviter trop d'appels pendant la frappe

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFolderId, filters]);

  const handleDownload = (fileId, e) => {
    if (e) e.stopPropagation();
    
    // DÉTECTION ENVIRONNEMENT DE DEV :
    // Si on est en local sur le port 3000, on force l'appel vers le port 3001.
    // Cela évite que le serveur de dev React n'intercepte la requête (ce qui cause le rechargement de la page).
    const isLocalDev = window.location.hostname === 'localhost' && window.location.port === '3000';
    const baseUrl = isLocalDev ? 'https://localhost:3001' : '';
    
    const url = `${baseUrl}/api/files/download/${fileId}`;
    
    // Navigation directe pour le téléchargement (évite le nouvel onglet)
    // Le backend renvoyant un fichier (Content-Disposition: attachment) ou une redirection vers un fichier,
    // le navigateur restera sur la page actuelle tout en lançant le téléchargement.
    window.location.assign(url);
  };

  const handleFolderClick = (folderId) => {
    setFolderHistory([...folderHistory, currentFolderId]);
    setCurrentFolderId(folderId);
    // Reset filters when changing folder
    setFilters({
      keyword: '',
      type: { 
        folder: false, 
        file: false,
        // Subtypes
        boxnote: false,
        boxcanvas: false,
        pdf: false,
        document: false,
        spreadsheet: false,
        presentation: false,
        image: false,
        audio: false,
        video: false,
        drawing: false,
        threeD: false
      },
      date: 'any',
      owner: '',
      size: 'any',
      tags: '',
      metadata: {
          templateKey: '',
          scope: 'enterprise',
          data: {}
      }
    });
  };

  const handleFileClick = async (fileId) => {
    try {
      const response = await axios.get(`/api/files/preview/${fileId}`);
      if (response.data.url) {
        setPreviewUrl(response.data.url);
        setPreviewFileId(fileId);
        setIsPreviewOpen(true);
      } else {
        alert("Impossible de charger la prévisualisation.");
      }
    } catch (error) {
      console.error("Erreur lors de la récupération de la prévisualisation :", error);
      alert("Erreur lors de l'ouverture du fichier.");
    }
  };

  const closePreview = () => {
    setIsPreviewOpen(false);
    setPreviewUrl(null);
    setPreviewFileId(null);
  };

  const handleBackClick = () => {
    if (folderHistory.length === 0) return;
    const previousFolderId = folderHistory[folderHistory.length - 1];
    const newHistory = folderHistory.slice(0, -1);
    setFolderHistory(newHistory);
    setCurrentFolderId(previousFolderId);
  };

  if (loading) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center', color: '#6b7280', fontSize: '14px' }}>
        Chargement...
      </div>
    );
  }

  return (
    <div className="files-card" style={{ position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <div className="files-header-title">Liste des fichiers</div>
          <div className="files-header-subtitle">Parcourez, filtrez et prévisualisez les contenus partagés.</div>
        </div>
        <div className="files-actions">
            {currentFolderId !== '0' && (
            <button 
                onClick={handleBackClick}
                className="btn btn-secondary"
            >
                ⬅ Retour
            </button>
            )}
            <button 
                className="btn btn-primary"
                onClick={() => setShowFilters(!showFilters)}
            >
                {showFilters ? 'Masquer Filtres' : 'Filtres'}
            </button>
        </div>
      </div>
      
      {/* Filter Panel */}
      {showFilters && (
        <FilterPanel 
            filters={filters} 
            setFilters={setFilters} 
            onClose={() => setShowFilters(false)} 
        />
      )}

      {/* Main Content */}
      <div style={{ marginRight: showFilters ? '320px' : '0', transition: 'margin-right 0.3s' }}>
        {filteredFiles.length === 0 ? (
          <p style={{ paddingTop: '8px', fontSize: '14px', color: '#6b7280' }}>Aucun fichier trouvé</p>
        ) : (
          <table className="files-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Taille</th>
                <th>Date de modification</th>
              </tr>
            </thead>
            <tbody>
              {filteredFiles.map((file) => (
                <tr key={file.id}>
                  <td>
                    {file.type === 'folder' ? (
                      <span 
                        onClick={() => handleFolderClick(file.id)}
                        className="file-name-cell file-name-folder"
                        style={{ cursor: 'pointer' }}
                      >
                        📁 {file.name}
                      </span>
                    ) : (
                      <span 
                        onClick={() => handleFileClick(file.id)}
                        className="file-name-cell file-name-main"
                        style={{ cursor: 'pointer' }}
                      >
                        📄 {file.name}
                      </span>
                    )}
                  </td>
                  <td>{file.size ? (file.size / 1024).toFixed(2) + ' Ko' : '-'}</td>
                  <td>{file.modified_at ? new Date(file.modified_at).toLocaleDateString() : '-'}</td>
                  <td>
                    {file.type !== 'folder' && (
                        <button
                            onClick={(e) => handleDownload(file.id, e)}
                            className="btn-icon-download"
                            title="Télécharger"
                            style={{ 
                                background: 'transparent', 
                                border: '1px solid #e5e7eb', 
                                borderRadius: '6px',
                                cursor: 'pointer', 
                                padding: '4px 8px',
                                fontSize: '14px',
                                color: '#0061D5'
                            }}
                        >
                            ⬇️
                        </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal de prévisualisation */}
      {isPreviewOpen && (
        <div className="preview-modal-backdrop">
          <div className="preview-modal">
            <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 10, display: 'flex', gap: '10px' }}>
                {previewFileId && (
                    <button
                        onClick={(e) => handleDownload(previewFileId, e)}
                        className="preview-close"
                        style={{ backgroundColor: '#0061D5', borderColor: '#0061D5', display: 'flex', alignItems: 'center', gap: '5px' }}
                    >
                        ⬇ Télécharger
                    </button>
                )}
                <button 
                onClick={closePreview}
                className="preview-close"
                >
                ✕ Fermer
                </button>
            </div>
            <iframe 
              src={previewUrl} 
              title="Prévisualisation Box"
              style={{ width: '100%', height: '100%', border: 'none' }}
              allowFullScreen
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default FilesList;