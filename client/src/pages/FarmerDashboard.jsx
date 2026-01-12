import { useState, useEffect } from 'react';
import apiClient from '../lib/apiClient';

// Dashboard with professional improvements: search, alert modal, better UX
export default function FarmerDashboard({ token, currentUser }) {
  const [facilities, setFacilities] = useState([]);
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all'); // all, critical, high, medium
  const [searchQuery, setSearchQuery] = useState(''); // NEW: search functionality
  const [showAlertModal, setShowAlertModal] = useState(false); // NEW: alert modal
  const [alertMessage, setAlertMessage] = useState(''); // NEW: alert message

  useEffect(() => {
    const fetchFacilities = async () => {
      try {
        setLoading(true);
        const data = await apiClient.get('/api/farmer/my-facilities');
        if (data && data.facilities) {
          setFacilities(data.facilities);
          setSummary(data.summary);
          if (data.facilities.length > 0) {
            setSelectedFacility(data.facilities[0]);
          }
        }
      } catch (err) {
        console.error('Error fetching facilities:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchFacilities();
  }, []);

  // NEW: Alert when facility becomes critical
  useEffect(() => {
    if (selectedFacility?.riskCategory === 'CRITICAL' && selectedFacility?.shouldAlert) {
      setAlertMessage(`🚨 KRITISK: ${selectedFacility.name} har nådd kritisk risiko (${selectedFacility.ownRisk}%)`);
      setShowAlertModal(true);
    }
  }, [selectedFacility?.id, selectedFacility?.riskCategory]);

  // NEW: Combined filter + search
  const filteredFacilities = facilities.filter(f => {
    const matchesCategory = filter === 'all' || f.riskCategory === filter.toUpperCase();
    const matchesSearch = searchQuery === '' || 
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.municipality.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const selectedFacilityData = selectedFacility;

  return (
    <>
      {/* NEW: Alert Modal */}
      {showAlertModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'var(--bg-dark)',
            border: '3px solid #DC2626',
            borderRadius: 8,
            padding: 24,
            maxWidth: 400,
            textAlign: 'center'
          }}>
            <p style={{ margin: 0, fontSize: 36 }}>🚨</p>
            <h2 style={{ margin: '12px 0', fontSize: 20, fontWeight: 700, color: '#DC2626' }}>
              KRITISK RISIKO
            </h2>
            <p style={{ margin: '12px 0', fontSize: 14, color: 'var(--text-secondary)' }}>
              {alertMessage}
            </p>
            <p style={{ margin: '8px 0', fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
              Anbefalinger finner du under "Risikofaktorer" nedenfor.
            </p>
            <button
              onClick={() => setShowAlertModal(false)}
              style={{
                marginTop: 16,
                padding: '10px 20px',
                background: 'var(--accent-gold)',
                border: 'none',
                borderRadius: 4,
                color: 'var(--bg-dark)',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: 14
              }}
            >
              Lukk
            </button>
          </div>
        </div>
      )}
    <div style={{ display: 'flex', height: 'calc(100vh - 50px)', background: 'var(--bg-dark)' }}>
      {/* Sidebar - Facility List */}
      <div style={{ width: 320, background: 'var(--bg-surface)', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div style={{ background: 'var(--bg-dark)', padding: '12px', borderBottom: '1px solid var(--border-color)' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--accent-gold)' }}>Mine Anlegg</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: 10, color: 'var(--text-secondary)' }}>Risiko-oversikt</p>
        </div>

        {summary && (
          <div style={{ padding: '10px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-color)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 9 }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Kritisk</p>
              <p style={{ margin: '2px 0 0 0', fontSize: 14, fontWeight: 700, color: '#DC2626' }}>{summary.critical}</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Høy</p>
              <p style={{ margin: '2px 0 0 0', fontSize: 14, fontWeight: 700, color: '#F59E0B' }}>{summary.high}</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Medium</p>
              <p style={{ margin: '2px 0 0 0', fontSize: 14, fontWeight: 700, color: '#3B82F6' }}>{summary.medium}</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Totalt</p>
              <p style={{ margin: '2px 0 0 0', fontSize: 14, fontWeight: 700, color: 'var(--accent-gold)' }}>{summary.total}</p>
            </div>
          </div>
        )}

        <div style={{ padding: '8px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: 4 }}>
          {['all', 'critical', 'high', 'medium'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                flex: 1,
                padding: '4px 6px',
                background: filter === f ? 'rgba(212, 165, 116, 0.2)' : 'transparent',
                border: filter === f ? '1px solid var(--accent-gold)' : '1px solid var(--border-color)',
                borderRadius: 3,
                color: filter === f ? 'var(--accent-gold)' : 'var(--text-secondary)',
                fontSize: 8,
                fontWeight: filter === f ? 600 : 400,
                cursor: 'pointer'
              }}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* NEW: Search Box */}
        <div style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>
          <input
            type="text"
            placeholder="🔍 Søk anlegg..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 10px',
              background: 'var(--bg-dark)',
              border: '1px solid var(--border-color)',
              borderRadius: 4,
              color: 'var(--text-primary)',
              fontSize: 11,
              fontFamily: 'inherit'
            }}
          />
          {searchQuery && (
            <p style={{ margin: '4px 0 0 0', fontSize: 9, color: 'var(--text-secondary)' }}>
              {filteredFacilities.length} resultat
            </p>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 0 }}>
          {filteredFacilities.map((facility) => (
            <div
              key={facility.id}
              onClick={() => setSelectedFacility(facility)}
              style={{
                padding: '10px',
                borderBottom: '1px solid var(--border-color)',
                background: selectedFacility?.id === facility.id ? 'rgba(212, 165, 116, 0.15)' : 'transparent',
                cursor: 'pointer',
                borderLeft: selectedFacility?.id === facility.id ? '3px solid var(--accent-gold)' : '3px solid transparent',
                transition: 'all 0.15s ease'
              }}
            >
              <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>{facility.name}</p>
              <p style={{ margin: '2px 0 0 0', fontSize: 9, color: 'var(--text-secondary)' }}>{facility.municipality}</p>
              <div style={{ marginTop: 4, display: 'flex', gap: 6, fontSize: 8 }}>
                <span style={{
                  background: facility.riskCategory === 'CRITICAL' ? 'rgba(220,38,38,0.3)' : facility.riskCategory === 'HIGH' ? 'rgba(245,158,11,0.3)' : 'rgba(59,130,246,0.3)',
                  padding: '2px 6px',
                  borderRadius: 2,
                  color: facility.riskCategory === 'CRITICAL' ? '#DC2626' : facility.riskCategory === 'HIGH' ? '#F59E0B' : '#3B82F6',
                  fontWeight: 600
                }}>
                  {facility.ownRisk}%
                </span>
                {facility.shouldAlert && (
                  <span style={{ background: 'rgba(220,38,38,0.3)', padding: '2px 6px', borderRadius: 2, color: '#DC2626', fontWeight: 600 }}>
                    🚨 Alert
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div style={{ background: 'var(--bg-dark)', padding: '16px', borderBottom: '2px solid var(--accent-gold)', position: 'sticky', top: 0, zIndex: 100 }}>
          {selectedFacilityData ? (
            <div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--accent-gold)' }}>{selectedFacilityData.name}</h1>
              <p style={{ margin: '4px 0 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>{selectedFacilityData.municipality} • Risiko: {selectedFacilityData.ownRisk}%</p>
            </div>
          ) : (
            <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Velg et anlegg</p>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Laster...</div>
          ) : selectedFacilityData ? (
            <>
              {/* Big Risk Score Card */}
              <div style={{
                background: 'var(--bg-elevated)',
                border: selectedFacilityData.riskCategory === 'CRITICAL' ? '3px solid #DC2626' : selectedFacilityData.riskCategory === 'HIGH' ? '3px solid #F59E0B' : '3px solid #3B82F6',
                borderRadius: 8,
                padding: 24,
                textAlign: 'center',
                marginBottom: 16
              }}>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Nåværende risiko</p>
                <p style={{
                  margin: '8px 0 0 0',
                  fontSize: 64,
                  fontWeight: 700,
                  color: selectedFacilityData.riskCategory === 'CRITICAL' ? '#DC2626' : selectedFacilityData.riskCategory === 'HIGH' ? '#F59E0B' : '#3B82F6'
                }}>
                  {selectedFacilityData.ownRisk}%
                </p>
                <p style={{ margin: '4px 0 0 0', fontSize: 14, color: selectedFacilityData.riskCategory === 'CRITICAL' ? '#DC2626' : selectedFacilityData.riskCategory === 'HIGH' ? '#F59E0B' : '#3B82F6', fontWeight: 600 }}>
                  {selectedFacilityData.riskCategory}
                </p>
              </div>

              {/* Forecast Card */}
              {selectedFacilityData.forecast && (
                <div style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 6,
                  padding: 16,
                  marginBottom: 16
                }}>
                  <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--accent-gold)', marginBottom: 12 }}>7-Dagers Prognose</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: 12, borderRadius: 4, border: '1px solid #3B82F6' }}>
                      <p style={{ margin: 0, fontSize: 10, color: 'var(--text-secondary)' }}>Prognose</p>
                      <p style={{ margin: '4px 0 0 0', fontSize: 20, fontWeight: 700, color: '#3B82F6' }}>{selectedFacilityData.forecast.forecast7d}%</p>
                    </div>
                    <div style={{ background: 'rgba(14, 182, 210, 0.1)', padding: 12, borderRadius: 4, border: '1px solid #06B6D4' }}>
                      <p style={{ margin: 0, fontSize: 10, color: 'var(--text-secondary)' }}>Trend</p>
                      <p style={{ margin: '4px 0 0 0', fontSize: 16, fontWeight: 700, color: '#06B6D4', textTransform: 'capitalize' }}>
                        {selectedFacilityData.forecast.trend === 'increasing' ? '📈' : selectedFacilityData.forecast.trend === 'decreasing' ? '📉' : '➡️'}
                      </p>
                    </div>
                    <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: 12, borderRadius: 4, border: '1px solid #F59E0B' }}>
                      <p style={{ margin: 0, fontSize: 10, color: 'var(--text-secondary)' }}>Handling?</p>
                      <p style={{ margin: '4px 0 0 0', fontSize: 12, fontWeight: 700, color: '#F59E0B' }}>
                        {selectedFacilityData.forecast.daysToAlert >= 0 ? `Om ${selectedFacilityData.forecast.daysToAlert} dager` : '✅ OK'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Risk Drivers */}
              {selectedFacilityData && (
                <div style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 6,
                  padding: 16
                }}>
                  <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--accent-gold)', marginBottom: 12 }}>Risikofaktorer</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div style={{ background: 'rgba(220, 38, 38, 0.1)', padding: 10, borderRadius: 4 }}>
                      <p style={{ margin: 0, fontSize: 10, color: 'var(--text-secondary)' }}>Lus</p>
                      <p style={{ margin: '4px 0 0 0', fontSize: 18, fontWeight: 700, color: '#DC2626' }}>{selectedFacilityData.liceCount}</p>
                    </div>
                    <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: 10, borderRadius: 4 }}>
                      <p style={{ margin: 0, fontSize: 10, color: 'var(--text-secondary)' }}>Sykdom</p>
                      <p style={{ margin: '4px 0 0 0', fontSize: 14, fontWeight: 700, color: '#F59E0B', textTransform: 'capitalize' }}>{selectedFacilityData.diseaseStatus || 'Ingen'}</p>
                    </div>
                  </div>
                  <p style={{ margin: '12px 0 0 0', fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    Sist oppdatert: {new Date(selectedFacilityData.lastUpdate).toLocaleString('no-NO')}
                  </p>
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Ingen anlegg valgt</div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
