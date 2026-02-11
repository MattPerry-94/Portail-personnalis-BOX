import React, { useState, useEffect } from 'react';
import axios from 'axios';

const FilterPanel = ({ filters, setFilters, onClose }) => {
  // État local pour "tamponner" les filtres avant application
  const [localFilters, setLocalFilters] = useState(filters);
  
  // États pour les métadonnées
  const [templates, setTemplates] = useState([]);
  const [schema, setSchema] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [loadingSchema, setLoadingSchema] = useState(false);

  const [expandedSections, setExpandedSections] = useState({
    keyword: true,
    metadata: true,
    type: true,
    date: true,
    owner: true,
    size: true,
    tags: true
  });

  // Synchroniser l'état local si les filtres sont réinitialisés depuis le parent
  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  // Charger les templates de métadonnées au montage
  useEffect(() => {
      const fetchTemplates = async () => {
          setLoadingTemplates(true);
          try {
              const response = await axios.get('/api/files/metadata/templates/enterprise');
              setTemplates(response.data);
          } catch (error) {
              console.error("Erreur chargement templates:", error);
          } finally {
              setLoadingTemplates(false);
          }
      };
      fetchTemplates();
  }, []);

  // Charger le schéma si un template est déjà sélectionné (ex: rechargement)
  const templateKey = localFilters.metadata?.templateKey;
  
  useEffect(() => {
    const fetchSchema = async (key) => {
        setLoadingSchema(true);
        try {
            const response = await axios.get(`/api/files/metadata/templates/enterprise/${key}/schema`);
            if (response.data && response.data.fields) {
                setSchema(response.data.fields);
            }
        } catch (error) {
            console.error("Erreur chargement schéma:", error);
        } finally {
            setLoadingSchema(false);
        }
    };

    if (templateKey) {
        fetchSchema(templateKey);
    } else {
        setSchema([]);
    }
  }, [templateKey]);

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleInputChange = (key, value) => {
    setLocalFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleTypeChange = (type) => {
    setLocalFilters(prev => ({
      ...prev,
      type: { ...prev.type, [type]: !prev.type[type] }
    }));
  };

  const handleTemplateChange = (e) => {
      const templateKey = e.target.value;
      setLocalFilters(prev => ({
          ...prev,
          metadata: {
              ...prev.metadata,
              templateKey: templateKey,
              data: {} // Reset data when template changes
          }
      }));
  };

  const handleMetadataFieldChange = (key, value) => {
      setLocalFilters(prev => ({
          ...prev,
          metadata: {
              ...prev.metadata,
              data: {
                  ...prev.metadata.data,
                  [key]: value
              }
          }
      }));
  };

  const handleSearch = () => {
    setFilters(localFilters);
  };

  const handleClear = () => {
    const resetFilters = {
        keyword: '',
        type: { 
            folder: false, file: false,
            boxnote: false, boxcanvas: false, pdf: false, document: false,
            spreadsheet: false, presentation: false, image: false, audio: false,
            video: false, drawing: false, threeD: false
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
    };
    setLocalFilters(resetFilters);
    setFilters(resetFilters);
  };

  const sectionStyle = {
    borderBottom: '1px solid #eee',
    padding: '15px 0'
  };

  const headerStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    cursor: 'pointer',
    fontWeight: 'bold',
    marginBottom: '10px'
  };

  return (
    <div style={{
      width: '300px',
      height: '100%',
      boxSizing: 'border-box',
      backgroundColor: 'white',
      borderLeft: '1px solid #ddd',
      padding: '20px 20px 80px 20px',
      position: 'fixed',
      top: 0,
      right: 0,
      zIndex: 100,
      boxShadow: '-2px 0 5px rgba(0,0,0,0.1)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#111827' }}>Filtres</h3>
        <button 
          onClick={onClose} 
          style={{ 
            background: 'none', 
            border: 'none', 
            fontSize: '18px', 
            cursor: 'pointer',
            color: '#6b7280'
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Mot-clé */}
        <div style={sectionStyle}>
            <div style={headerStyle} onClick={() => toggleSection('keyword')}>
            Mot-clé <span>{expandedSections.keyword ? '▲' : '▼'}</span>
            </div>
            {expandedSections.keyword && (
            <input
              type="text"
              placeholder="Mot-clé"
              value={localFilters.keyword}
              onChange={(e) => handleInputChange('keyword', e.target.value)}
              style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' }}
            />
            )}
        </div>

        {/* Métadonnées */}
        <div style={sectionStyle}>
            <div style={headerStyle} onClick={() => toggleSection('metadata')}>
            Métadonnées <span>{expandedSections.metadata ? '▲' : '▼'}</span>
            </div>
            {expandedSections.metadata && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {loadingTemplates ? (
                    <div>Chargement des modèles...</div>
                ) : (
                    <select 
                      value={localFilters.metadata?.templateKey || ''} 
                      onChange={handleTemplateChange}
                      style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', backgroundColor: '#f9fafb' }}
                    >
                        <option value="">Sélectionner un modèle</option>
                        {templates.map(tpl => (
                            <option key={tpl.templateKey} value={tpl.templateKey}>
                                {tpl.displayName}
                            </option>
                        ))}
                    </select>
                )}

                {loadingSchema && <div>Chargement des champs...</div>}
                
                {localFilters.metadata?.templateKey && schema.map(field => {
                    // On ne gère que les champs texte et enum pour l'instant
                    if (field.type === 'enum' || field.type === 'multiSelect') {
                        return (
                            <div key={field.key}>
                                <label style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', display: 'block', color: '#374151' }}>{field.displayName}</label>
                                <select
                                  value={localFilters.metadata.data[field.key] || ''}
                                  onChange={(e) => handleMetadataFieldChange(field.key, e.target.value)}
                                  style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', backgroundColor: '#f9fafb' }}
                                >
                                    <option value="">Sélectionner une valeur</option>
                                    {field.options.map(opt => (
                                        <option key={opt.key} value={opt.key}>{opt.key}</option>
                                    ))}
                                </select>
                            </div>
                        );
                    } else if (field.type === 'string' || field.type === 'float') {
                        return (
                            <div key={field.key}>
                                <label style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', display: 'block', color: '#374151' }}>{field.displayName}</label>
                                <input
                                  type="text"
                                  value={localFilters.metadata.data[field.key] || ''}
                                  onChange={(e) => handleMetadataFieldChange(field.key, e.target.value)}
                                  style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' }}
                                />
                            </div>
                        );
                    }
                    return null;
                })}
            </div>
            )}
        </div>

        {/* Type */}
        <div style={sectionStyle}>
            <div style={headerStyle} onClick={() => toggleSection('type')}>
            Type <span>{expandedSections.type ? '▲' : '▼'}</span>
            </div>
            {expandedSections.type && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  checked={localFilters.type.folder}
                  onChange={() => handleTypeChange('folder')}
                />
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>📁 Dossiers</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  checked={localFilters.type.file}
                  onChange={() => handleTypeChange('file')}
                />
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>📄 Fichiers</span>
                </label>
                
                {/* Sous-types */}
                <div style={{ marginLeft: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                        <input type="checkbox" checked={localFilters.type.boxnote} onChange={() => handleTypeChange('boxnote')} />
                        <span>📝 Box Note</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                        <input type="checkbox" checked={localFilters.type.boxcanvas} onChange={() => handleTypeChange('boxcanvas')} />
                        <span>🎨 Box Canvas</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                        <input type="checkbox" checked={localFilters.type.pdf} onChange={() => handleTypeChange('pdf')} />
                        <span>📕 PDF</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                        <input type="checkbox" checked={localFilters.type.document} onChange={() => handleTypeChange('document')} />
                        <span>📘 Document</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                        <input type="checkbox" checked={localFilters.type.spreadsheet} onChange={() => handleTypeChange('spreadsheet')} />
                        <span>📗 Feuille de calcul</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                        <input type="checkbox" checked={localFilters.type.presentation} onChange={() => handleTypeChange('presentation')} />
                        <span>📙 Présentation</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                        <input type="checkbox" checked={localFilters.type.image} onChange={() => handleTypeChange('image')} />
                        <span>🖼️ Image</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                        <input type="checkbox" checked={localFilters.type.audio} onChange={() => handleTypeChange('audio')} />
                        <span>🎵 Audio</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                        <input type="checkbox" checked={localFilters.type.video} onChange={() => handleTypeChange('video')} />
                        <span>▶️ Vidéo</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                        <input type="checkbox" checked={localFilters.type.drawing} onChange={() => handleTypeChange('drawing')} />
                        <span>✏️ Dessin</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                        <input type="checkbox" checked={localFilters.type.threeD} onChange={() => handleTypeChange('threeD')} />
                        <span>🧊 3D</span>
                    </label>
                </div>
            </div>
            )}
        </div>

        {/* Date de mise à jour */}
        <div style={sectionStyle}>
            <div style={headerStyle} onClick={() => toggleSection('date')}>
            Date de mise à jour <span>{expandedSections.date ? '▲' : '▼'}</span>
            </div>
            {expandedSections.date && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {['any', 'yesterday', 'lastWeek', 'lastMonth', 'lastYear'].map(opt => (
                <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                    type="radio"
                    name="dateFilter"
                    checked={localFilters.date === opt}
                    onChange={() => handleInputChange('date', opt)}
                    />
                    {opt === 'any' && "N'importe quand"}
                    {opt === 'yesterday' && "Hier"}
                    {opt === 'lastWeek' && "La semaine dernière"}
                    {opt === 'lastMonth' && "Le mois dernier"}
                    {opt === 'lastYear' && "L'année dernière"}
                </label>
                ))}
            </div>
            )}
        </div>

        {/* Propriétaire */}
        <div style={sectionStyle}>
            <div style={headerStyle} onClick={() => toggleSection('owner')}>
            Propriétaire <span>{expandedSections.owner ? '▲' : '▼'}</span>
            </div>
            {expandedSections.owner && (
            <input
                type="text"
                placeholder="Noms ou e-mails"
                value={localFilters.owner}
                onChange={(e) => handleInputChange('owner', e.target.value)}
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
            )}
        </div>

        {/* Taille */}
        <div style={sectionStyle}>
            <div style={headerStyle} onClick={() => toggleSection('size')}>
            Taille <span>{expandedSections.size ? '▲' : '▼'}</span>
            </div>
            {expandedSections.size && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {['any', 'small', 'medium', 'large', 'huge', 'gigantic', 'massive'].map(opt => (
                <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                    type="radio"
                    name="sizeFilter"
                    checked={localFilters.size === opt}
                    onChange={() => handleInputChange('size', opt)}
                    />
                    {opt === 'any' && "Toute taille"}
                    {opt === 'small' && "0 - 1 MB"}
                    {opt === 'medium' && "1 - 5 MB"}
                    {opt === 'large' && "5 - 25 MB"}
                    {opt === 'huge' && "25 - 100 MB"}
                    {opt === 'gigantic' && "100 MB - 1 GB"}
                    {opt === 'massive' && "1 GB+"}
                </label>
                ))}
            </div>
            )}
        </div>

        {/* Balises */}
        <div style={sectionStyle}>
            <div style={headerStyle} onClick={() => toggleSection('tags')}>
            Balises <span>{expandedSections.tags ? '▲' : '▼'}</span>
            </div>
            {expandedSections.tags && (
            <input
                type="text"
                placeholder="Entrez une balise..."
                value={localFilters.tags}
                onChange={(e) => handleInputChange('tags', e.target.value)}
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
            )}
        </div>
      </div>

      {/* Footer avec bouton Rechercher */}
      <div style={{ 
          marginTop: '20px', 
          paddingTop: '20px', 
          borderTop: '1px solid #ddd',
          display: 'flex',
          gap: '10px'
      }}>
          <button 
            onClick={handleClear}
            style={{
                padding: '10px 15px',
                backgroundColor: '#f5f5f5',
                color: '#333',
                border: '1px solid #ddd',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                flex: 1
            }}
          >
              Effacer
          </button>
          <button 
            onClick={handleSearch}
            style={{
                padding: '10px 15px',
                backgroundColor: '#0061D5',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                flex: 1
            }}
          >
              Rechercher
          </button>
      </div>

    </div>
  );
};

export default FilterPanel;
