import { useState, useEffect } from 'react';
import apiClient from '../lib/apiClient';

export default function FarmSelector({ userId, currentUser, onBack }) {
  const [allFacilities, setAllFacilities] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [facilityDetails, setFacilityDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Load all facilities and favorites
  useEffect(() => {
    const fetch = async () => {
      try {
        // Get all facilities
        const farmsRes = await apiClient.get('/api/mvp/farmer');
        setAllFacilities(farmsRes.farms || []);

        // Get user's favorites
        const favRes = await apiClient.get(`/api/user/favorites/${userId}`);
        setFavorites(favRes.favorites?.facilities || []);
      } catch (err) {
        console.error('Error loading facilities:', err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [userId]);

  // Load detailed info when facility selected
  useEffect(() => {
    if (!selectedFacility) return;

    const fetch = async () => {
      try {
        const res = await apiClient.get(`/api/user/facility/${selectedFacility}/detailed`);
        setFacilityDetails(res);
      } catch (err) {
        console.error('Error loading facility details:', err);
      }
    };
    fetch();
  }, [selectedFacility]);

  const toggleFavorite = async (facilityId) => {
    try {
      const isFav = favorites.includes(facilityId);
      const endpoint = isFav ? '/remove' : '/add';
      
      console.log(`Toggling favorite: ${facilityId}, userId: ${userId}, endpoint: ${endpoint}`);
      
      const result = await apiClient.post(`/api/user/favorites/${userId}${endpoint}`, {
        resourceId: facilityId,
        resourceType: 'facility'
      });
      
      console.log('Toggle result:', result);

      if (isFav) {
        setFavorites(favorites.filter(id => id !== facilityId));
      } else {
        if (favorites.length < 10) {
          setFavorites([...favorites, facilityId]);
        } else {
          console.warn('Max 10 favoritter nådd');
        }
      }
    } catch (err) {
      console.error('Error toggling favorite:', err);
      alert(`Feil ved lagring: ${err.message}`);
    }
  };

  const filtered = allFacilities.filter(f =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.region?.toLowerCase().includes(searchQuery.toLowerCase())
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
      {/* LEFT: Facility List */}
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
            placeholder="Søk anlegg..."
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
              Ingen anlegg funnet
            </p>
          ) : (
            filtered.map(farm => {
              const isFav = favorites.includes(farm.id);
              return (
                <button
                  key={farm.id}
                  onClick={() => setSelectedFacility(farm.id)}
                  style={{
                    width: '100%',
                    padding: 10,
                    background: selectedFacility === farm.id ? 'rgba(217,119,6,0.2)' : 'transparent',
                    border: 'none',
                    borderBottom: '1px solid var(--border-color)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={(e) => e.target.style.background = selectedFacility === farm.id ? 'rgba(217,119,6,0.2)' : 'transparent'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {farm.name}
                      </p>
                      <p style={{ margin: '2px 0 0 0', fontSize: 10, color: 'var(--text-secondary)' }}>
                        {farm.region}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(farm.id);
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
        ) : !selectedFacility ? (
          <p style={{ color: 'var(--text-secondary)' }}>Velg et anlegg for å se detaljer</p>
        ) : facilityDetails ? (
          <div>
            <h2 style={{ margin: 0, color: 'var(--accent-gold)', marginBottom: 16 }}>
              {facilityDetails.facility.name}
            </h2>

            {/* Risk Status */}
            <div style={{
              background: facilityDetails.facility.riskLevel === 'HIGH' ? 'rgba(220,38,38,0.1)' : 'rgba(107,114,128,0.1)',
              border: `1px solid ${facilityDetails.facility.riskLevel === 'HIGH' ? 'var(--accent-red)' : 'var(--border-color)'}`,
              borderRadius: 6,
              padding: 12,
              marginBottom: 16
            }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>
                Risikostatus: {facilityDetails.facility.riskLevel}
              </p>
              <p style={{ margin: '4px 0 0 0', fontSize: 13, fontWeight: 700 }}>
                {facilityDetails.facility.riskScore}/100
              </p>
            </div>

            {/* Contamination Sources */}
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: 14, fontWeight: 600, color: 'var(--accent-orange)' }}>
                🦠 Smittekilder ({facilityDetails.contamination.sources.length})
              </h3>
              {facilityDetails.contamination.sources.length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Ingen smittekilder registrert</p>
              ) : (
                facilityDetails.contamination.sources.map((source, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'var(--bg-dark)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 4,
                      padding: 10,
                      marginBottom: 8,
                      fontSize: 12
                    }}
                  >
                    <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {source.vesselName}
                    </p>
                    <p style={{ margin: '2px 0 0 0', color: 'var(--text-secondary)' }}>
                      Lusetall: {source.liceCount} | Status: {source.diseaseStatus}
                    </p>
                  </div>
                ))
              )}
            </div>

            {/* Nearby Facilities by Distance */}
            <div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: 14, fontWeight: 600, color: 'var(--accent-blue)' }}>
                📍 Nærmeste anlegg
              </h3>
              {facilityDetails.distances.map((dist, idx) => (
                <div
                  key={idx}
                  style={{
                    background: dist.risk === 'HIGH' ? 'rgba(220,38,38,0.1)' : 'rgba(107,114,128,0.1)',
                    border: `1px solid ${dist.risk === 'HIGH' ? 'var(--accent-red)' : 'var(--border-color)'}`,
                    borderRadius: 4,
                    padding: 10,
                    marginBottom: 6,
                    fontSize: 12
                  }}
                >
                  <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {dist.facilityName}
                  </p>
                  <p style={{ margin: '2px 0 0 0', color: 'var(--text-secondary)' }}>
                    {dist.distance} km | Risiko: {dist.risk}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p style={{ color: 'var(--text-secondary)' }}>Kunne ikke laste detaljer</p>
        )}
      </div>
    </div>
  );
}
