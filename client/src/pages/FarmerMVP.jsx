import { useEffect, useState } from 'react';
import apiClient from '../lib/apiClient';

export default function FarmerMVP({ token, currentUser }) {
  const [farms, setFarms] = useState([]);
  const [selectedFarm, setSelectedFarm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch real annotated farm data from backend
  useEffect(() => {
    const fetchFarms = async () => {
      try {
        const response = await apiClient.get('/api/mvp/farmer');
        // API returns { farms: [...], stats: {...}, alertCount: ... }
        // Each farm now has: ownRisk, riskCategory, upstreamSources, nearbyVessels, spreadSource, etc.
        if (response && response.farms && Array.isArray(response.farms)) {
          setFarms(response.farms);
          setSelectedFarm(response.farms[0] || null);
          console.log('✅ Loaded', response.farms.length, 'annotated farms from backend');
        }
      } catch (error) {
        console.error('Error fetching farms:', error);
        setFarms([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchFarms();
  }, []);


  const handleMarkAsRead = (alertId) => {
    // No longer needed - real data doesn't have isRead status
  };

  // Calculate portfolio stats from real farm data
  const criticalFarms = farms.filter(f => f.riskScore > 80).length;
  const highFarms = farms.filter(f => f.riskScore > 60 && f.riskScore <= 80).length;
  const mediumFarms = farms.filter(f => f.riskScore > 30 && f.riskScore <= 60).length;

  const filteredFarms = farms.filter(f => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>Laster...</div>;

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-dark)' }}>
      {/* LEFT SIDEBAR - Farms List */}
      <div style={{
        width: '220px',
        background: 'var(--bg-surface)',
        borderRight: '2px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        overflowX: 'hidden'
      }}>
      {/* Portfolio Stats Banner */}
        <div style={{ background: 'var(--bg-elevated)', padding: '10px', borderBottom: '1px solid var(--border-color)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, fontSize: 9 }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontWeight: 600 }}>Kritisk</p>
            <p style={{ margin: '2px 0 0 0', fontSize: 14, fontWeight: 700, color: 'var(--accent-red)' }}>{criticalFarms}</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontWeight: 600 }}>Høy</p>
            <p style={{ margin: '2px 0 0 0', fontSize: 14, fontWeight: 700, color: 'var(--accent-orange)' }}>{highFarms}</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontWeight: 600 }}>Medium</p>
            <p style={{ margin: '2px 0 0 0', fontSize: 14, fontWeight: 700, color: 'var(--accent-blue)' }}>{mediumFarms}</p>
          </div>
        </div>

        {/* Sidebar Header */}
        <div style={{ padding: '10px', borderBottom: '1px solid var(--border-color)' }}>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 6 }}>
            ANLEGG ({filteredFarms.length})
          </p>
          <input
            type="text"
            placeholder="Søk..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 8px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-color)',
              borderRadius: 4,
              color: 'var(--text-primary)',
              fontSize: 11
            }}
          />
        </div>

        {/* Farms List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {farms.map(farm => {
            const status = farm.riskCategory || (farm.riskScore > 80 ? 'CRITICAL' : farm.riskScore > 60 ? 'HIGH' : 'MEDIUM');
            const statusColor = status === 'CRITICAL' ? 'var(--accent-red)' : status === 'HIGH' ? 'var(--accent-orange)' : 'var(--accent-blue)';
            const statusEmoji = status === 'CRITICAL' ? '🔴' : status === 'HIGH' ? '🟠' : '🔵';
            
            return (
              <div
                key={farm.id}
                onClick={() => setSelectedFarm(farm)}
                style={{
                  padding: '10px',
                  borderBottom: '1px solid var(--border-color)',
                  cursor: 'pointer',
                  background: selectedFarm?.id === farm.id ? 'rgba(212, 165, 116, 0.2)' : 'transparent',
                  borderLeft: selectedFarm?.id === farm.id ? '3px solid var(--accent-gold)' : '3px solid transparent',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (selectedFarm?.id !== farm.id) {
                    e.currentTarget.style.background = 'var(--bg-elevated)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = selectedFarm?.id === farm.id ? 'rgba(212, 165, 116, 0.2)' : 'transparent';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 4, gap: 6 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {farm.name}
                    </p>
                    <p style={{ margin: 0, fontSize: 9, color: 'var(--text-secondary)' }}>
                      {farm.municipality || 'Ukjent'}
                    </p>
                  </div>
                  <span style={{ fontSize: 14 }}>
                    {statusEmoji}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 10 }}>
                  <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 3, padding: '4px 6px' }}>
                    <p style={{ margin: 0, fontSize: 9, color: 'var(--text-secondary)' }}>Risiko</p>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: statusColor }}>
                      {farm.riskScore || farm.ownRisk || 0}%
                    </p>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 3, padding: '4px 6px' }}>
                    <p style={{ margin: 0, fontSize: 9, color: 'var(--text-secondary)' }}>Lus</p>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: farm.liceCount > 5 ? 'var(--accent-red)' : 'var(--text-secondary)' }}>
                      {farm.liceCount || 0}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT MAIN CONTENT */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ background: 'var(--bg-dark)', padding: '12px 16px', borderBottom: '2px solid var(--accent-gold)', position: 'sticky', top: 0, zIndex: 100 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--accent-gold)' }}>
            {selectedFarm?.name || 'Velg anlegg'}
          </h1>
          <p style={{ margin: '2px 0 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
            {selectedFarm?.municipality || ''}
          </p>
        </div>

        {/* Main Content Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 0 }}>
          {selectedFarm ? (
            <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '12px 16px' }}>

              {/* ===== RISIKO & STATUS - Grid ===== */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
                {/* Risk Score */}
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase' }}>
                    Risiko
                  </div>
                  <div style={{
                    fontSize: 32,
                    fontWeight: 700,
                    color: selectedFarm.riskScore > 80 ? 'var(--accent-red)' : selectedFarm.riskScore > 60 ? 'var(--accent-orange)' : 'var(--accent-blue)',
                    marginBottom: 6
                  }}>
                    {selectedFarm.riskScore || selectedFarm.ownRisk || 0}%
                  </div>
                  <div style={{
                    height: 3,
                    background: 'rgba(0,0,0,0.2)',
                    borderRadius: 2,
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${selectedFarm.riskScore || selectedFarm.ownRisk || 0}%`,
                      background: selectedFarm.riskScore > 80 ? 'var(--accent-red)' : selectedFarm.riskScore > 60 ? 'var(--accent-orange)' : 'var(--accent-blue)'
                    }} />
                  </div>
                </div>

                {/* Lice Count */}
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase' }}>
                    🦐 Lus
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: selectedFarm.liceCount > 5 ? 'var(--accent-red)' : 'var(--accent-green)', marginBottom: 4 }}>
                    {selectedFarm.liceCount || 0}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    {selectedFarm.liceCount > 10 ? 'kritisk' : selectedFarm.liceCount > 5 ? 'høy' : 'kontrollert'}
                  </div>
                </div>

                {/* Disease Status */}
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase' }}>
                    🦠 Sykdom
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: selectedFarm.diseaseStatus === 'infected' ? 'var(--accent-red)' : 'var(--accent-green)', marginBottom: 4 }}>
                    {selectedFarm.diseaseStatus ? selectedFarm.diseaseStatus.charAt(0).toUpperCase() + selectedFarm.diseaseStatus.slice(1) : 'OK'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    påvist
                  </div>
                </div>

                {/* Category */}
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase' }}>
                    Kategori
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: selectedFarm.riskCategory === 'CRITICAL' ? 'var(--accent-red)' : selectedFarm.riskCategory === 'HIGH' ? 'var(--accent-orange)' : 'var(--accent-blue)', marginBottom: 4 }}>
                    {selectedFarm.riskCategory || 'MEDIUM'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    ekte data
                  </div>
                </div>
              </div>

              {/* ===== KRITISK: KONTAMINERTE BÅTER ===== */}
              {selectedFarm.contaminatedVisitors && selectedFarm.contaminatedVisitors.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingBottom: 6, borderBottom: '3px solid #DC2626' }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: '#DC2626', margin: 0 }}>
                      🚨 KRITISK: KONTAMINERTE BÅTER - Vektor for smitte ({selectedFarm.contaminatedVisitors.length})
                    </h3>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
                    {selectedFarm.contaminatedVisitors.map((visitor, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: 'rgba(220, 38, 38, 0.15)',
                          border: '2px solid #DC2626',
                          borderRadius: 8,
                          padding: 12
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8, gap: 8 }}>
                          <div style={{ flex: 1 }}>
                            <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#DC2626', marginBottom: 2 }}>
                              {visitor.vesselName}
                            </h4>
                            <p style={{ margin: 0, fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4 }}>
                              {visitor.vesselType || 'Båt'}
                            </p>
                          </div>
                          <div style={{
                            background: '#DC2626',
                            color: '#fff',
                            padding: '8px 12px',
                            borderRadius: 4,
                            fontSize: 12,
                            fontWeight: 700,
                            textAlign: 'center',
                            whiteSpace: 'nowrap'
                          }}>
                            HØY FARE
                          </div>
                        </div>

                        {/* Contamination details */}
                        {visitor.contaminationStatus.records && visitor.contaminationStatus.records.length > 0 && (
                          <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 6, padding: 10, marginBottom: 8 }}>
                            <p style={{ margin: 0, fontSize: 10, fontWeight: 600, color: 'var(--accent-gold)', marginBottom: 6 }}>
                              Var på smittet anlegg:
                            </p>
                            {visitor.contaminationStatus.records.slice(0, 2).map((source, i) => (
                              <div key={i} style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4, paddingBottom: 4, borderBottom: i < 1 ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
                                <p style={{ margin: 0, fontWeight: 600, color: '#DC2626' }}>
                                  📍 {source.facility_name}
                                </p>
                                <p style={{ margin: '2px 0 0 0' }}>
                                  Risiko: {source.facility_risk_score}% • {new Date(source.timestamp).toLocaleDateString('no-NO')}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Days remaining in contamination window */}
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <div style={{ flex: 1, fontSize: 10, color: 'var(--text-secondary)' }}>
                            <p style={{ margin: 0, marginBottom: 2 }}>Besøkt: {new Date(visitor.lastVisitTimestamp).toLocaleDateString('no-NO')}</p>
                            <p style={{ margin: 0 }}>Aktivt i: {visitor.contaminationStatus.hoursRemaining} timer</p>
                          </div>
                          <div style={{
                            background: 'rgba(255,255,255,0.1)',
                            padding: '6px 10px',
                            borderRadius: 3,
                            fontSize: 9,
                            fontWeight: 600,
                            color: 'var(--accent-gold)'
                          }}>
                            ⏱️ {Math.ceil(visitor.contaminationStatus.hoursRemaining / 24)}d left
                          </div>
                        </div>

                        {/* Action for farm */}
                        <div style={{ marginTop: 8, padding: 8, background: 'rgba(0,0,0,0.3)', borderRadius: 4, fontSize: 10, color: 'var(--text-secondary)' }}>
                          <p style={{ margin: 0, marginBottom: 4 }}>
                            ✓ <strong>Tiltak:</strong> Avstand & desinfeksjon ved besøk
                          </p>
                          <p style={{ margin: 0 }}>
                            💬 Kontakt båtoperatør for info om besøket
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ===== POTENSIELLE SMITTE-KILDER (upstream facilities) ===== */}
              {selectedFarm.upstreamSources && selectedFarm.upstreamSources.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingBottom: 6, borderBottom: '2px solid var(--accent-orange)' }}>
                    <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-orange)', margin: 0 }}>
                      🚨 POTENSIELLE SMITTE-KILDER - Anlegg ({selectedFarm.upstreamSources.length})
                    </h3>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                    {selectedFarm.upstreamSources.map((source, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: source.riskScore > 60 ? 'rgba(220, 38, 38, 0.12)' : 'rgba(251, 146, 60, 0.12)',
                          border: `1.5px solid ${source.riskScore > 60 ? 'var(--accent-red)' : 'var(--accent-orange)'}`,
                          borderRadius: 6,
                          padding: 10
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 6, gap: 8 }}>
                          <div style={{ flex: 1 }}>
                            <h4 style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
                              {source.name}
                            </h4>
                            <p style={{ margin: 0, fontSize: 9, color: 'var(--text-secondary)', marginBottom: 4 }}>
                              {source.type === 'facility' ? '🏭' : '🚢'} {source.type === 'facility' ? 'Anlegg' : 'Båt'}
                            </p>
                          </div>
                          <div style={{
                            background: source.riskScore > 60 ? 'var(--accent-red)' : 'var(--accent-orange)',
                            color: '#fff',
                            padding: '4px 8px',
                            borderRadius: 3,
                            fontSize: 11,
                            fontWeight: 600,
                            whiteSpace: 'nowrap'
                          }}>
                            {source.riskScore}%
                          </div>
                        </div>
                        
                        {/* Risk Type Badge */}
                        <div style={{ marginBottom: 6 }}>
                          <span style={{
                            display: 'inline-block',
                            background: source.riskType === 'disease' ? 'rgba(220, 38, 38, 0.2)' : source.riskType === 'lice' ? 'rgba(251, 146, 60, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                            color: source.riskType === 'disease' ? 'var(--accent-red)' : source.riskType === 'lice' ? 'var(--accent-orange)' : '#3B82F6',
                            padding: '3px 8px',
                            borderRadius: 3,
                            fontSize: 9,
                            fontWeight: 600,
                            marginRight: 4
                          }}>
                            {source.riskType === 'disease' ? '🦠 Sykdom' : source.riskType === 'lice' ? '🦐 Lus' : '⚠️ Generell'}
                          </span>
                        </div>

                        {/* Distance & Direction */}
                        <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                          <p style={{ margin: 0 }}>
                            📏 <strong>{source.distanceKm} km</strong> {source.direction || 'ukjent retning'}
                          </p>
                          {source.liceCount !== undefined && (
                            <p style={{ margin: '2px 0 0 0' }}>
                              🦐 {source.liceCount} lus
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ===== SENESTE BÅT-BESØK (siste 2 uker) ===== */}
              {selectedFarm.recentVisits && selectedFarm.recentVisits.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingBottom: 6, borderBottom: '2px solid var(--accent-gold)' }}>
                    <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-gold)', margin: 0 }}>
                      🚢 SENESTE BÅT-BESØK - Siste 2 uker ({selectedFarm.recentVisits.length})
                    </h3>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
                    {selectedFarm.recentVisits.map((visit, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: 'rgba(14, 182, 210, 0.12)',
                          border: '1px solid #06B6D4',
                          borderRadius: 6,
                          padding: 10,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'start',
                          gap: 12
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <h4 style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
                            {visit.vesselName}
                          </h4>
                          <p style={{ margin: 0, fontSize: 9, color: 'var(--text-secondary)', marginBottom: 4 }}>
                            {visit.vesselType || 'Ukjent type'}
                          </p>
                          <p style={{ margin: 0, fontSize: 10, color: 'var(--accent-gold)', fontWeight: 600 }}>
                            📅 {new Date(visit.timestamp).toLocaleDateString('no-NO')} {new Date(visit.timestamp).toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        {visit.distanceKm && (
                          <div style={{
                            background: '#06B6D4',
                            color: '#fff',
                            padding: '4px 8px',
                            borderRadius: 3,
                            fontSize: 10,
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            textAlign: 'center'
                          }}>
                            📏<br />{visit.distanceKm} km
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state - if no sources or visits */}
              {(!selectedFarm.contaminatedVisitors || selectedFarm.contaminatedVisitors.length === 0) && 
               (!selectedFarm.upstreamSources || selectedFarm.upstreamSources.length === 0) && 
               (!selectedFarm.recentVisits || selectedFarm.recentVisits.length === 0) && (
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 20, textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <p style={{ margin: 0, fontSize: 12 }}>✓ Ingen kjente smitte-kilder eller seneste båt-besøk</p>
                  <p style={{ margin: '4px 0 0 0', fontSize: 10 }}>Ekte data fra BarentsWatch + AIS</p>
                </div>
              )}

            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 16, marginBottom: 16 }}>👈 Velg et anlegg fra listen til venstre</p>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
