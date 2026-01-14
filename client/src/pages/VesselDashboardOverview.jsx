import { useState, useEffect } from 'react';
import apiClient from '../lib/apiClient';

export default function VesselDashboardOverview({ userId, currentUser, onNavigate }) {
  const [favorites, setFavorites] = useState([]);
  const [vesselsDetail, setVesselsDetail] = useState({});
  const [loading, setLoading] = useState(true);

  // Load favorites and calculate stats
  useEffect(() => {
    const fetch = async () => {
      try {
        // Get user's favorites
        const favRes = await apiClient.get(`/api/user/favorites/${userId}`);
        const favIds = favRes.favorites?.vessels || [];
        setFavorites(favIds);

        // Fetch all vessels
        const allRes = await apiClient.get(`/api/mvp/vessel?userId=${userId}`);
        const vessels = allRes.vessels || [];
        
        // Build detail map indexed by ID
        const detailMap = {};
        vessels.forEach(v => {
          detailMap[v.id] = v;
        });
        setVesselsDetail(detailMap);
      } catch (err) {
        console.error('Error loading overview:', err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [userId]);

  // Get favorite vessels
  const getFavoriteVessels = () => {
    return favorites.map(id => vesselsDetail[id]).filter(Boolean);
  };

  const favVessels = getFavoriteVessels();
  
  // Calculate statistics
  const stats = {
    total: favVessels.length,
    contaminated: favVessels.filter(v => v.diseaseStatus === 'CONTAMINATED' || v.diseaseStatus === 'infected').length,
    avgLice: favVessels.length > 0 
      ? Math.round(favVessels.reduce((sum, v) => sum + (v.liceCount || 0), 0) / favVessels.length)
      : 0,
    diseaseTypes: [
      ...new Set(favVessels.filter(v => v.diseaseStatus && v.diseaseStatus !== 'OK').map(v => v.diseaseStatus))
    ],
    certExpired: favVessels.filter(v => v.certificates?.some(c => new Date(c.expires) < new Date())).length
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
          ⛵ {currentUser?.name} - Båtflåte Oversikt
        </h1>
        <p style={{ 
          margin: 0, 
          fontSize: 14, 
          color: 'var(--text-secondary)'
        }}>
          Du har {stats.total} favorittbåter opprettet
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
            Total Båter
          </p>
          <p style={{ margin: 0, fontSize: 32, fontWeight: 700, color: 'var(--accent-blue)' }}>
            {stats.total}
          </p>
        </div>

        {/* Contaminated */}
        <div style={{
          background: 'rgba(220,38,38,0.1)',
          border: '2px solid var(--accent-red)',
          borderRadius: 8,
          padding: 16,
          textAlign: 'center'
        }}>
          <p style={{ margin: '0 0 8px 0', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
            🦠 Smittet/Syk
          </p>
          <p style={{ margin: 0, fontSize: 32, fontWeight: 700, color: 'var(--accent-red)' }}>
            {stats.contaminated}
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
          <p style={{ margin: 0, fontSize: 32, fontWeight: 700, color: 'var(--accent-green)' }}>
            {stats.avgLice}
          </p>
        </div>

        {/* Cert Expired */}
        <div style={{
          background: stats.certExpired > 0 ? 'rgba(245,158,11,0.1)' : 'var(--bg-elevated)',
          border: stats.certExpired > 0 ? '2px solid var(--accent-orange)' : '1px solid var(--border-color)',
          borderRadius: 8,
          padding: 16,
          textAlign: 'center'
        }}>
          <p style={{ margin: '0 0 8px 0', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
            📋 Utgåtte Sertifikat
          </p>
          <p style={{ margin: 0, fontSize: 32, fontWeight: 700, color: stats.certExpired > 0 ? 'var(--accent-orange)' : 'var(--accent-green)' }}>
            {stats.certExpired}
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
            Dine Favorittbåter
          </h2>
        </div>

        {favVessels.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)' }}>
            <p style={{ fontSize: 14, marginBottom: 16 }}>
              Du har ikke lagt til noen favorittbåter ennå
            </p>
            <button
              onClick={() => onNavigate?.('vessel-selector')}
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
                <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Båt</th>
                <th style={{ padding: 12, textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>MMSI</th>
                <th style={{ padding: 12, textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Type</th>
                <th style={{ padding: 12, textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Sykdom</th>
                <th style={{ padding: 12, textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Lus</th>
                <th style={{ padding: 12, textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {favVessels.map((vessel, idx) => {
                const hasExpiredCert = vessel.certificates?.some(c => new Date(c.expires) < new Date());
                return (
                  <tr
                    key={vessel.id}
                    onClick={() => onNavigate?.('vessel-selector')}
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(6, 182, 212, 0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)'}
                  >
                    <td style={{ padding: 12, color: 'var(--text-primary)', fontWeight: 500 }}>
                      <div>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{vessel.name}</p>
                        <p style={{ margin: '2px 0 0 0', fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                          {vessel.mmsi}
                        </p>
                      </div>
                    </td>
                    <td style={{ padding: 12, textAlign: 'center', color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: 12, fontWeight: 600 }}>
                      {vessel.mmsi}
                    </td>
                    <td style={{ padding: 12, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>
                      {vessel.type || 'Unknown'}
                    </td>
                    <td style={{ padding: 12, textAlign: 'center' }}>
                      <span style={{
                        padding: '4px 8px',
                        background: vessel.diseaseStatus === 'OK' || !vessel.diseaseStatus ? 'rgba(34,197,94,0.2)' : 'rgba(220,38,38,0.2)',
                        color: vessel.diseaseStatus === 'OK' || !vessel.diseaseStatus ? 'var(--accent-green)' : 'var(--accent-red)',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600
                      }}>
                        {vessel.diseaseStatus || 'OK'}
                      </span>
                    </td>
                    <td style={{ padding: 12, textAlign: 'center', color: 'var(--text-primary)', fontWeight: 500 }}>
                      {vessel.liceCount || 0}
                    </td>
                    <td style={{ padding: 12, textAlign: 'center' }}>
                      {hasExpiredCert ? (
                        <span style={{
                          padding: '4px 8px',
                          background: 'rgba(245,158,11,0.2)',
                          color: 'var(--accent-orange)',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 600
                        }}>
                          Utgått ⚠️
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>OK</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* CTA Button */}
      {favVessels.length > 0 && (
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <button
            onClick={() => onNavigate?.('vessel-selector')}
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
