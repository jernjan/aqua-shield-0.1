import { useState, useEffect } from 'react';
import apiClient from '../lib/apiClient';

export default function VesselSelector({ userId, currentUser, onBack }) {
  const [allVessels, setAllVessels] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [selectedVessel, setSelectedVessel] = useState(null);
  const [vesselDetails, setVesselDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Load all vessels and favorites
  useEffect(() => {
    const fetch = async () => {
      try {
        // Get all vessels
        const vesselRes = await apiClient.get('/api/mvp/vessel');
        setAllVessels(vesselRes.vessels || []);

        // Get user's favorites
        const favRes = await apiClient.get(`/api/user/favorites/${userId}`);
        setFavorites(favRes.favorites?.vessels || []);
      } catch (err) {
        console.error('Error loading vessels:', err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [userId]);

  // Load detailed info when vessel selected
  useEffect(() => {
    if (!selectedVessel) return;

    const fetch = async () => {
      try {
        const res = await apiClient.get(`/api/user/vessel/${selectedVessel}/detailed`);
        setVesselDetails(res);
      } catch (err) {
        console.error('Error loading vessel details:', err);
      }
    };
    fetch();
  }, [selectedVessel]);

  const toggleFavorite = async (vesselId) => {
    try {
      const isFav = favorites.includes(vesselId);
      const endpoint = isFav ? '/remove' : '/add';
      
      await apiClient.post(`/api/user/favorites/${userId}${endpoint}`, {
        resourceId: vesselId,
        resourceType: 'vessel'
      });

      if (isFav) {
        setFavorites(favorites.filter(id => id !== vesselId));
      } else {
        if (favorites.length < 10) {
          setFavorites([...favorites, vesselId]);
        }
      }
    } catch (err) {
      console.error('Error toggling favorite:', err);
    }
  };

  const filtered = allVessels.filter(v =>
    v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.mmsi?.toString().includes(searchQuery)
  );

  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: '300px 1fr', 
      gap: 16,
      minHeight: '100vh',
      background: 'var(--bg-dark)',
      padding: 16
    }}>
      {/* LEFT: Vessel List */}
      <div style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-color)',
        borderRadius: 8,
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '100vh',
        overflow: 'hidden'
      }}>
        <div style={{ padding: 12, borderBottom: '1px solid var(--border-color)' }}>
          <button
            onClick={onBack}
            style={{
              width: '100%',
              padding: 8,
              background: 'var(--accent-gold)',
              color: '#000',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontWeight: 600,
              marginBottom: 12
            }}
          >
            ← Tilbake
          </button>
          
          <input
            type="text"
            placeholder="Søk båter..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: 8,
              background: 'var(--bg-dark)',
              border: '1px solid var(--border-color)',
              borderRadius: 4,
              color: 'var(--text-primary)',
              fontSize: 12,
              boxSizing: 'border-box'
            }}
          />
          
          <p style={{
            fontSize: 11,
            color: 'var(--text-secondary)',
            margin: '8px 0 0 0'
          }}>
            {favorites.length}/10 favoritter
          </p>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <p style={{ padding: 12, color: 'var(--text-secondary)', fontSize: 12 }}>
              Ingen båter funnet
            </p>
          ) : (
            filtered.map(vessel => {
              const isFav = favorites.includes(vessel.id);
              return (
                <button
                  key={vessel.id}
                  onClick={() => setSelectedVessel(vessel.id)}
                  style={{
                    width: '100%',
                    padding: 10,
                    background: selectedVessel === vessel.id ? 'rgba(6,182,212,0.2)' : 'transparent',
                    border: 'none',
                    borderBottom: '1px solid var(--border-color)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={(e) => e.target.style.background = selectedVessel === vessel.id ? 'rgba(6,182,212,0.2)' : 'transparent'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {vessel.name}
                      </p>
                      <p style={{ margin: '2px 0 0 0', fontSize: 10, color: 'var(--text-secondary)' }}>
                        {vessel.mmsi || 'N/A'}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(vessel.id);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: 16,
                        cursor: 'pointer',
                        padding: 0
                      }}
                    >
                      {isFav ? '★' : '☆'}
                    </button>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT: Details */}
      <div style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-color)',
        borderRadius: 8,
        padding: 16,
        overflowY: 'auto',
        maxHeight: '100vh'
      }}>
        {loading ? (
          <p style={{ color: 'var(--text-secondary)' }}>Laster...</p>
        ) : !selectedVessel ? (
          <p style={{ color: 'var(--text-secondary)' }}>Velg en båt for å se detaljer</p>
        ) : vesselDetails ? (
          <div>
            <h2 style={{ margin: 0, color: 'var(--accent-gold)', marginBottom: 16 }}>
              {vesselDetails.vessel.name}
            </h2>

            {/* Disease/Risk Status */}
            <div style={{
              background: vesselDetails.riskLevel === 'HIGH' ? 'rgba(220,38,38,0.1)' : 'rgba(34,197,94,0.1)',
              border: `1px solid ${vesselDetails.riskLevel === 'HIGH' ? 'var(--accent-red)' : 'var(--accent-green)'}`,
              borderRadius: 6,
              padding: 12,
              marginBottom: 16
            }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>
                Sjukdomsstatus: {vesselDetails.diseaseStatus}
              </p>
              <p style={{ margin: '4px 0 0 0', fontSize: 13, fontWeight: 700 }}>
                Lusetall: {vesselDetails.liceCount}
              </p>
            </div>

            {/* Vessel Info */}
            <div style={{
              background: 'var(--bg-dark)',
              border: '1px solid var(--border-color)',
              borderRadius: 6,
              padding: 12,
              marginBottom: 16,
              fontSize: 12
            }}>
              <p style={{ margin: '0 0 4px 0' }}>
                <strong>MMSI:</strong> {vesselDetails.vessel.mmsi || 'N/A'}
              </p>
              <p style={{ margin: '0 0 4px 0' }}>
                <strong>Type:</strong> {vesselDetails.vessel.type || 'Unknown'}
              </p>
              <p style={{ margin: 0 }}>
                <strong>Posisjon:</strong> {vesselDetails.vessel.lastPosition?.lat?.toFixed(2)}°N / {vesselDetails.vessel.lastPosition?.lng?.toFixed(2)}°E
              </p>
            </div>

            {/* Recent Facility Visits */}
            <div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: 14, fontWeight: 600, color: 'var(--accent-blue)' }}>
                🏥 Nylige besøk ({vesselDetails.recentVisits.length})
              </h3>
              {vesselDetails.recentVisits.length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Ingen registrerte besøk</p>
              ) : (
                vesselDetails.recentVisits.map((visit, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: visit.riskAtVisit > 60 ? 'rgba(220,38,38,0.1)' : 'rgba(107,114,128,0.1)',
                      border: `1px solid ${visit.riskAtVisit > 60 ? 'var(--accent-red)' : 'var(--border-color)'}`,
                      borderRadius: 4,
                      padding: 10,
                      marginBottom: 8,
                      fontSize: 12
                    }}
                  >
                    <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {visit.facilityName}
                    </p>
                    <p style={{ margin: '2px 0 0 0', color: 'var(--text-secondary)' }}>
                      Risiko: {visit.riskAtVisit}/100 | {new Date(visit.lastVisit).toLocaleDateString('no-NO')}
                    </p>
                  </div>
                ))
              )}
            </div>

            {/* Alert Trigger - For Farm Owners */}
            {vesselDetails.diseaseStatus === 'CONTAMINATED' && (
              <div style={{
                background: 'rgba(220,38,38,0.15)',
                border: '2px solid var(--accent-red)',
                borderRadius: 6,
                padding: 12,
                marginTop: 16,
                fontSize: 12
              }}>
                <p style={{ margin: '0 0 8px 0', fontWeight: 600, color: 'var(--accent-red)' }}>
                  ⚠️ VARSEL: Kontaminert båt
                </p>
                <p style={{ margin: 0, color: 'var(--text-primary)' }}>
                  Denne båten har registrert sykdom. Anlegg som besøkes av denne båten bør varsles.
                </p>
              </div>
            )}
          </div>
        ) : (
          <p style={{ color: 'var(--text-secondary)' }}>Kunne ikke laste detaljer</p>
        )}
      </div>
    </div>
  );
}
