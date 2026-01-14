import { useState, useEffect } from 'react';
import apiClient from '../lib/apiClient';

export default function FarmerDashboardOverview({ userId, currentUser, onNavigate }) {
  const [favorites, setFavorites] = useState([]);
  const [facilitiesDetail, setFacilitiesDetail] = useState({});
  const [riskSources, setRiskSources] = useState({});
  const [loading, setLoading] = useState(true);

  // Load favorites and calculate stats
  useEffect(() => {
    const fetch = async () => {
      try {
        // Get user's favorites
        const favRes = await apiClient.get(`/api/user/favorites/${userId}`);
        const favIds = favRes.favorites?.facilities || [];
        setFavorites(favIds);

        // Fetch ALL facilities (not filtered by user)
        const allRes = await apiClient.get(`/api/mvp/farmer`);
        const facilities = allRes.farms || [];
        
        // Build detail map indexed by ID
        const detailMap = {};
        facilities.forEach(f => {
          detailMap[f.id] = f;
        });
        setFacilitiesDetail(detailMap);

        // Load risk sources for each favorite
        const sourcesMap = {};
        for (const favId of favIds) {
          try {
            const detailedRes = await apiClient.get(`/api/user/facility/${favId}/detailed`);
            sourcesMap[favId] = detailedRes;
          } catch (err) {
            console.error(`Error loading details for ${favId}:`, err);
          }
        }
        setRiskSources(sourcesMap);
      } catch (err) {
        console.error('Error loading overview:', err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [userId]);

  // Calculate statistics
  const getFavoriteFacilities = () => {
    return favorites.map(id => facilitiesDetail[id]).filter(Boolean);
  };

  const favFacilities = getFavoriteFacilities();
  
  const stats = {
    total: favFacilities.length,
    critical: favFacilities.filter(f => f.riskScore > 80 || f.riskCategory === 'CRITICAL').length,
    high: favFacilities.filter(f => f.riskScore > 60 && f.riskScore <= 80 || f.riskCategory === 'HIGH').length,
    medium: favFacilities.filter(f => f.riskScore > 30 && f.riskScore <= 60).length,
    low: favFacilities.filter(f => f.riskScore <= 30).length,
    infected: favFacilities.filter(f => f.contaminatedVisitors && f.contaminatedVisitors.length > 0).length,
    avgLice: favFacilities.length > 0 
      ? Math.round(favFacilities.reduce((sum, f) => sum + (f.liceCount || 0), 0) / favFacilities.length)
      : 0,
    diseaseTypes: [
      ...new Set(favFacilities.filter(f => f.diseaseStatus && f.diseaseStatus !== 'OK').map(f => f.diseaseStatus))
    ]
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
        Laster...
      </div>
    );
  }

  return (
    <div style={{ 
      background: 'var(--bg-dark)', 
      minHeight: '100vh', 
      padding: '24px',
      maxWidth: '1400px',
      margin: '0 auto'
    }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ 
          margin: '0 0 8px 0', 
          fontSize: 28, 
          fontWeight: 700,
          color: 'var(--text-primary)'
        }}>
          🐟 {currentUser?.name} - Anleggsøversikt
        </h1>
        <p style={{ 
          margin: 0, 
          fontSize: 14, 
          color: 'var(--text-secondary)'
        }}>
          Du har {stats.total} favorittanlegg opprettet
        </p>
      </div>

      {/* Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16,
        marginBottom: 32
      }}>
        {/* Total */}
        <div style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-color)',
          borderRadius: 8,
          padding: 16,
          textAlign: 'center'
        }}>
          <p style={{ margin: '0 0 8px 0', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
            Total Anlegg
          </p>
          <p style={{ margin: 0, fontSize: 32, fontWeight: 700, color: 'var(--accent-gold)' }}>
            {stats.total}
          </p>
        </div>

        {/* Critical */}
        <div style={{
          background: 'rgba(220,38,38,0.1)',
          border: '2px solid var(--accent-red)',
          borderRadius: 8,
          padding: 16,
          textAlign: 'center'
        }}>
          <p style={{ margin: '0 0 8px 0', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
            🔴 Kritisk
          </p>
          <p style={{ margin: 0, fontSize: 32, fontWeight: 700, color: 'var(--accent-red)' }}>
            {stats.critical}
          </p>
        </div>

        {/* High */}
        <div style={{
          background: 'rgba(245,158,11,0.1)',
          border: '2px solid var(--accent-orange)',
          borderRadius: 8,
          padding: 16,
          textAlign: 'center'
        }}>
          <p style={{ margin: '0 0 8px 0', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
            🟠 Høy
          </p>
          <p style={{ margin: 0, fontSize: 32, fontWeight: 700, color: 'var(--accent-orange)' }}>
            {stats.high}
          </p>
        </div>

        {/* Infected */}
        <div style={{
          background: 'rgba(139,92,246,0.1)',
          border: '2px solid #8B5CF6',
          borderRadius: 8,
          padding: 16,
          textAlign: 'center'
        }}>
          <p style={{ margin: '0 0 8px 0', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
            🦠 Smittet
          </p>
          <p style={{ margin: 0, fontSize: 32, fontWeight: 700, color: '#8B5CF6' }}>
            {stats.infected}
          </p>
        </div>

        {/* Avg Lice */}
        <div style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-color)',
          borderRadius: 8,
          padding: 16,
          textAlign: 'center'
        }}>
          <p style={{ margin: '0 0 8px 0', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
            🦐 Gj.snitt Lus
          </p>
          <p style={{ margin: 0, fontSize: 32, fontWeight: 700, color: 'var(--accent-blue)' }}>
            {stats.avgLice}
          </p>
        </div>

        {/* Diseases */}
        <div style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-color)',
          borderRadius: 8,
          padding: 16,
          textAlign: 'center'
        }}>
          <p style={{ margin: '0 0 8px 0', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
            Sykdomstyper
          </p>
          <p style={{ margin: 0, fontSize: 28, fontWeight: 700, color: 'var(--text-primary)' }}>
            {stats.diseaseTypes.length}
          </p>
          <p style={{ margin: '4px 0 0 0', fontSize: 10, color: 'var(--text-secondary)' }}>
            {stats.diseaseTypes.join(', ') || 'Ingen'}
          </p>
        </div>
      </div>

      {/* Favorites Table */}
      <div style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-color)',
        borderRadius: 8,
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '16px',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-dark)'
        }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
            Dine Favorittanlegg
          </h2>
        </div>

        {favFacilities.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)' }}>
            <p style={{ fontSize: 14, marginBottom: 16 }}>
              Du har ikke lagt til noen favorittanlegg ennå
            </p>
            <button
              onClick={() => onNavigate?.('farm-selector')}
              style={{
                padding: '10px 20px',
                background: 'var(--accent-gold)',
                color: '#000',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 14
              }}
            >
              ⭐ Velg Favoritter
            </button>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-dark)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Anlegg</th>
                <th style={{ padding: 12, textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Risiko</th>
                <th style={{ padding: 12, textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Lus</th>
                <th style={{ padding: 12, textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Sykdom</th>
                <th style={{ padding: 12, textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Smittet</th>
                <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Risikokilde</th>
              </tr>
            </thead>
            <tbody>
              {favFacilities.map((facility, idx) => {
                const details = riskSources[facility.id] || {};
                const contaminatedVessels = details.contamination?.sources || [];
                const nearbyRiskyFacilities = (details.distances || []).filter(d => d.risk === 'HIGH').slice(0, 2);
                
                // Build risk source string
                const riskSourceParts = [];
                if (contaminatedVessels.length > 0) {
                  riskSourceParts.push(`${contaminatedVessels.length} båt${contaminatedVessels.length !== 1 ? 'er' : ''}`);
                }
                if (nearbyRiskyFacilities.length > 0) {
                  riskSourceParts.push(`${nearbyRiskyFacilities.length} nabo(er)`);
                }
                if (facility.diseaseStatus && facility.diseaseStatus !== 'OK') {
                  riskSourceParts.push(facility.diseaseStatus);
                }
                const riskSource = riskSourceParts.length > 0 ? riskSourceParts.join(' • ') : 'Egen risiko';
                
                return (
                  <tr
                    key={facility.id}
                    onClick={() => onNavigate?.('farm-selector')}
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(212, 165, 116, 0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)'}
                  >
                    <td style={{ padding: 12, color: 'var(--text-primary)', fontWeight: 500 }}>
                      <div>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{facility.name}</p>
                        <p style={{ margin: '2px 0 0 0', fontSize: 11, color: 'var(--text-secondary)' }}>
                          {facility.municipality}
                        </p>
                      </div>
                    </td>
                    <td style={{ padding: 12, textAlign: 'center' }}>
                      <div style={{
                        display: 'inline-block',
                        background: facility.riskScore > 80 ? 'rgba(220,38,38,0.2)' : 
                                    facility.riskScore > 60 ? 'rgba(245,158,11,0.2)' : 
                                    'rgba(59,130,246,0.2)',
                        border: `2px solid ${facility.riskScore > 80 ? 'var(--accent-red)' : 
                                             facility.riskScore > 60 ? 'var(--accent-orange)' : 
                                             'var(--accent-blue)'}`,
                        borderRadius: 4,
                        padding: '4px 8px',
                        fontSize: 12,
                        fontWeight: 700,
                        color: facility.riskScore > 80 ? 'var(--accent-red)' : 
                               facility.riskScore > 60 ? 'var(--accent-orange)' : 
                               'var(--accent-blue)'
                      }}>
                        {facility.riskScore || 0}%
                      </div>
                    </td>
                    <td style={{ padding: 12, textAlign: 'center', color: 'var(--text-primary)', fontWeight: 500 }}>
                      {facility.liceCount || 0}
                    </td>
                    <td style={{ padding: 12, textAlign: 'center' }}>
                      <span style={{
                        padding: '4px 8px',
                        background: facility.diseaseStatus === 'OK' ? 'rgba(34,197,94,0.2)' : 'rgba(220,38,38,0.2)',
                        color: facility.diseaseStatus === 'OK' ? 'var(--accent-green)' : 'var(--accent-red)',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600
                      }}>
                        {facility.diseaseStatus || 'OK'}
                      </span>
                    </td>
                    <td style={{ padding: 12, textAlign: 'center' }}>
                      {facility.contaminatedVisitors && facility.contaminatedVisitors.length > 0 ? (
                        <span style={{
                          padding: '4px 8px',
                          background: 'rgba(220,38,38,0.2)',
                          color: 'var(--accent-red)',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 600
                        }}>
                          {facility.contaminatedVisitors.length} båt{facility.contaminatedVisitors.length !== 1 ? 'er' : ''}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>-</span>
                      )}
                    </td>
                    <td style={{ padding: 12, color: 'var(--text-primary)', fontSize: 12 }}>
                      <span style={{ opacity: 0.8 }}>{riskSource}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* CTA Button */}
      {favFacilities.length > 0 && (
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <button
            onClick={() => onNavigate?.('farm-selector')}
            style={{
              padding: '12px 24px',
              background: 'var(--accent-gold)',
              color: '#000',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 14,
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
            onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
          >
            📋 Se Detaljert Oversikt
          </button>
        </div>
      )}
    </div>
  );
}
