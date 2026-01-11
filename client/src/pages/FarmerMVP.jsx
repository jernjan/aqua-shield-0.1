import { useEffect, useState } from 'react';
import { MOCK_FARMS, MOCK_FARM_ALERTS, getMockFarmData } from '../mocks/data';
import { severityCompare } from '../lib/riskTerms';
import OutbreakReport from '../components/OutbreakReport';

export default function FarmerMVP({ token, currentUser }) {
  const [farms, setFarms] = useState([]);
  const [selectedFarm, setSelectedFarm] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [visitingVessels, setVisitingVessels] = useState([]);
  const [activeQuarantines, setActiveQuarantines] = useState([]);
  const [diseaseRisks, setDiseaseRisks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandAllDiseases, setExpandAllDiseases] = useState(false);
  const [allFarmAlerts, setAllFarmAlerts] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAlertType, setFilterAlertType] = useState('all');
  const [showReportForm, setShowReportForm] = useState(false);

  useEffect(() => {
    setFarms(MOCK_FARMS);
    setSelectedFarm(MOCK_FARMS[0]);
    setAllFarmAlerts(MOCK_FARM_ALERTS);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!selectedFarm) return;
    
    const mockFarmData = getMockFarmData(selectedFarm.id);

    setAlerts(mockFarmData.alerts);
    setVisitingVessels(mockFarmData.visitingVessels);
    setActiveQuarantines(mockFarmData.quarantines);
    setDiseaseRisks(mockFarmData.diseases);
  }, [selectedFarm]);

  const handleMarkAsRead = (alertId) => {
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, isRead: true } : a));
  };

  const sortedAlerts = [...alerts].sort((a, b) => severityCompare(a.severity, b.severity));

  const filteredAlerts = filterAlertType === 'all' 
    ? sortedAlerts 
    : sortedAlerts.filter(a => a.type === filterAlertType);

  const filteredFarms = farms.filter(f => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    f.region.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate portfolio stats
  const criticalFarms = farms.filter(f => f.riskScore > 60).length;
  const warningFarms = farms.filter(f => f.riskScore > 40 && f.riskScore <= 60).length;
  const totalAlerts = Object.values(allFarmAlerts).reduce((sum, arr) => sum + arr.length, 0);
  const criticalAlerts = Object.values(allFarmAlerts).reduce((sum, arr) => 
    sum + arr.filter(a => a.severity === 'risikofylt').length, 0
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
        <div style={{ background: 'var(--bg-elevated)', padding: '10px', borderBottom: '1px solid var(--border-color)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 9 }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontWeight: 600 }}>Kritisk</p>
            <p style={{ margin: '2px 0 0 0', fontSize: 14, fontWeight: 700, color: 'var(--accent-red)' }}>{criticalFarms}</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontWeight: 600 }}>Advarsel</p>
            <p style={{ margin: '2px 0 0 0', fontSize: 14, fontWeight: 700, color: 'var(--accent-orange)' }}>{warningFarms}</p>
          </div>
          <div style={{ textAlign: 'center', gridColumn: '1 / -1' }}>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontWeight: 600 }}>Varsler</p>
            <p style={{ margin: '2px 0 0 0', fontSize: 14, fontWeight: 700, color: 'var(--accent-red)' }}>{totalAlerts} {criticalAlerts > 0 && `(${criticalAlerts}🔴)`}</p>
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
            const farmAlerts = allFarmAlerts[farm.id] || [];
            const criticalAlerts = farmAlerts.filter(a => a.severity === 'risikofylt').length;
            const status = farm.riskScore > 60 ? 'kritisk' : farm.riskScore > 40 ? 'advarsel' : 'ok';
            const statusColor = status === 'kritisk' ? 'var(--accent-red)' : status === 'advarsel' ? 'var(--accent-orange)' : 'var(--accent-green)';
            const statusEmoji = status === 'kritisk' ? '🔴' : status === 'advarsel' ? '🟠' : '🟢';
            
            // Check for expiring licenses
            const expiringLicense = farm.licenses && farm.licenses.some(lic => {
              const daysLeft = Math.floor((new Date(lic.expires) - new Date()) / (24 * 3600 * 1000));
              return daysLeft < 60 && daysLeft > 0;
            });
            
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
                      {farm.region}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                    {expiringLicense && <span style={{ fontSize: 12 }}>🟡</span>}
                    <span style={{ fontSize: 14 }}>
                      {statusEmoji}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 10 }}>
                  <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 3, padding: '4px 6px' }}>
                    <p style={{ margin: 0, fontSize: 9, color: 'var(--text-secondary)' }}>Risiko</p>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: statusColor }}>
                      {farm.riskScore}%
                    </p>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 3, padding: '4px 6px' }}>
                    <p style={{ margin: 0, fontSize: 9, color: 'var(--text-secondary)' }}>Varsler</p>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: farmAlerts.length > 0 ? 'var(--accent-red)' : 'var(--text-secondary)' }}>
                      {farmAlerts.length} {criticalAlerts > 0 && `(${criticalAlerts} 🔴)`}
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
            {selectedFarm?.region || ''}
          </p>
        </div>

        {/* Main Content Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 0 }}>
          {selectedFarm ? (
            <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '12px 16px' }}>
              {/* ===== REPORT BUTTON ===== */}
              <div style={{ marginBottom: 16 }}>
                <button
                  onClick={() => setShowReportForm(true)}
                  style={{
                    padding: '10px 16px',
                    background: 'var(--accent-red)',
                    border: 'none',
                    borderRadius: 4,
                    color: '#fff',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: 13,
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
                  onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                >
                  🚨 Meld Inn Utbrudd
                </button>
              </div>

              {/* ===== VARSLER - TOP PRIORITY ===== */}
              {alerts.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-red)', margin: 0, paddingBottom: 6, borderBottom: '2px solid var(--accent-red)' }}>
                      🚨 VARSLER ({alerts.length})
                    </h3>
                    {/* Filter buttons */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {['all', 'lus-risiko', 'alger', 'båtkontakt', 'temperatur', 'dødeligheit'].map(type => {
                        const count = type === 'all' ? alerts.length : alerts.filter(a => a.type === type).length;
                        const isActive = filterAlertType === type;
                        return (
                          <button
                            key={type}
                            onClick={() => setFilterAlertType(type)}
                            style={{
                              padding: '4px 10px',
                              borderRadius: 3,
                              border: isActive ? '2px solid var(--accent-gold)' : '1px solid var(--border-color)',
                              background: isActive ? 'rgba(212, 165, 116, 0.2)' : 'transparent',
                              color: isActive ? 'var(--accent-gold)' : 'var(--text-secondary)',
                              fontSize: 10,
                              fontWeight: isActive ? 600 : 500,
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'var(--bg-elevated)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = isActive ? 'rgba(212, 165, 116, 0.2)' : 'transparent';
                            }}
                          >
                            {type === 'all' ? 'Alle' : type.charAt(0).toUpperCase() + type.slice(1)} ({count})
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  
                  <div style={{ display: 'grid', gap: 4, maxHeight: '220px', overflowY: 'auto' }}>
                    {sortedAlerts
                      .filter(a => filterAlertType === 'all' || a.type === filterAlertType)
                      .map((alert, idx) => {
                      // Determine color based on source and severity
                      const isInfoSource = ['Met.no', 'Kystvarsling'].includes(alert.dataSource);
                      const isCritical = alert.severity === 'risikofylt' && !isInfoSource;
                      const isWarning = alert.severity === 'høy oppmerksomhet' && !isInfoSource;
                      
                      let bgColor, borderColor, badgeColor;
                      if (isCritical) {
                        bgColor = 'rgba(220, 38, 38, 0.15)';
                        borderColor = '1.5px solid var(--accent-red)';
                        badgeColor = 'var(--accent-red)';
                      } else if (isWarning) {
                        bgColor = 'rgba(251, 146, 60, 0.12)';
                        borderColor = '1px solid var(--accent-orange)';
                        badgeColor = 'var(--accent-orange)';
                      } else {
                        bgColor = 'var(--bg-surface)';
                        borderColor = '1px solid var(--border-color)';
                        badgeColor = 'var(--accent-green)';
                      }

                      return (
                        <div key={idx} style={{
                          background: bgColor,
                          border: borderColor,
                          borderRadius: 4,
                          padding: 8,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: 8
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                              {alert.title} {alert.dataSource && `(${alert.dataSource})`}
                            </p>
                            <p style={{ margin: 0, fontSize: 10, color: 'var(--text-secondary)' }}>
                              {new Date(alert.timestamp).toLocaleDateString('no-NO')} • {alert.type}
                            </p>
                          </div>
                          <div style={{
                            background: badgeColor,
                            color: '#fff',
                            padding: '3px 6px',
                            borderRadius: 3,
                            fontSize: 9,
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            textAlign: 'center'
                          }}>
                            {isCritical ? '🔴' : isWarning ? '🟠' : '🔵'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ===== RISIKO & STATUS - 4 columns ===== */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
                {/* Risk Score */}
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase' }}>
                    Risiko
                  </div>
                  <div style={{
                    fontSize: 32,
                    fontWeight: 700,
                    color: selectedFarm?.riskScore > 60 ? 'var(--accent-red)' : selectedFarm?.riskScore > 40 ? 'var(--accent-orange)' : 'var(--accent-green)',
                    marginBottom: 6
                  }}>
                    {selectedFarm?.riskScore || 0}%
                  </div>
                  <div style={{
                    height: 3,
                    background: 'rgba(0,0,0,0.2)',
                    borderRadius: 2,
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${selectedFarm?.riskScore || 0}%`,
                      background: selectedFarm?.riskScore > 60 ? 'var(--accent-red)' : selectedFarm?.riskScore > 40 ? 'var(--accent-orange)' : 'var(--accent-green)'
                    }} />
                  </div>
                </div>

                {/* Active Alerts */}
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase' }}>
                    Varsler
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--accent-red)', marginBottom: 4 }}>
                    {alerts.length}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    {alerts.filter(a => !a.isRead).length} nye
                  </div>
                </div>

                {/* Disease Risks */}
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase' }}>
                    Sykdom
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--accent-orange)', marginBottom: 4 }}>
                    {diseaseRisks.length}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    påvist
                  </div>
                </div>

                {/* Visiting Vessels */}
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase' }}>
                    Båter
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--accent-gold)', marginBottom: 4 }}>
                    {visitingVessels.length}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    uke
                  </div>
                </div>
              </div>

              {/* ===== DØDELIGHEIT TREND ===== */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 14 }}>
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 10 }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', margin: 0, marginBottom: 6, textTransform: 'uppercase' }}>
                    📊 Dødeligheit
                  </p>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <div style={{ fontSize: 26, fontWeight: 700, color: selectedFarm?.mortalities?.thisWeek > 500 ? 'var(--accent-red)' : 'var(--accent-orange)' }}>
                      {selectedFarm?.mortalities?.thisWeek || 0}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      denne uke
                      <p style={{ margin: '2px 0 0 0', fontSize: 9 }}>
                        {selectedFarm?.mortalities?.trend === 'opp' ? '📈' : '📉'} {selectedFarm?.mortalities?.trend === 'opp' ? 'opp' : 'ned'} vs forrige
                      </p>
                    </div>
                  </div>
                  
                  {/* Simple trend bars */}
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'flex-end', gap: 3, height: 40 }}>
                    {[
                      selectedFarm?.mortalities?.thisWeek || 0,
                      Math.max(0, (selectedFarm?.mortalities?.thisWeek || 0) * (selectedFarm?.mortalities?.trend === 'opp' ? 0.7 : 1.3)),
                      Math.max(0, (selectedFarm?.mortalities?.thisWeek || 0) * (selectedFarm?.mortalities?.trend === 'opp' ? 0.5 : 1.6)),
                      Math.max(0, (selectedFarm?.mortalities?.thisWeek || 0) * (selectedFarm?.mortalities?.trend === 'opp' ? 0.3 : 2.0))
                    ].map((val, i) => (
                      <div
                        key={i}
                        style={{
                          flex: 1,
                          height: `${Math.max(3, (val / (selectedFarm?.mortalities?.thisWeek || 1)) * 100)}%`,
                          background: val > 500 ? 'var(--accent-red)' : val > 200 ? 'var(--accent-orange)' : 'var(--accent-green)',
                          borderRadius: 2,
                          opacity: 0.7 + (i * 0.075)
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* ===== HAVSTRØM & SMITTE-RISIKO ===== */}
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 10 }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', margin: 0, marginBottom: 6, textTransform: 'uppercase' }}>
                    🌊 Havstrøm
                  </p>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600, marginBottom: 4 }}>
                    {selectedFarm?.currentDirection || 'Ukjent'}
                  </div>
                  <div style={{
                    display: 'inline-block',
                    background: selectedFarm?.downstreamRisk === 'nedstrøms' ? 'rgba(220, 38, 38, 0.2)' : selectedFarm?.downstreamRisk === 'samme-område' ? 'rgba(251, 146, 60, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                    color: selectedFarm?.downstreamRisk === 'nedstrøms' ? 'var(--accent-red)' : selectedFarm?.downstreamRisk === 'samme-område' ? 'var(--accent-orange)' : 'var(--accent-green)',
                    padding: '4px 8px',
                    borderRadius: 3,
                    fontSize: 10,
                    fontWeight: 600
                  }}>
                    {selectedFarm?.downstreamRisk === 'nedstrøms' ? '⚠️ Nedstrøms' : selectedFarm?.downstreamRisk === 'samme-område' ? '⚠ Samme område' : '✓ Oppstrøms'}
                  </div>
                </div>

                {/* ===== SMITTE-RISIKO (Upstream critical farms) ===== */}
                {selectedFarm?.downstreamRisk !== 'oppstrøms' && (
                  <div style={{ background: 'var(--bg-elevated)', border: '1.5px solid var(--accent-orange)', borderRadius: 6, padding: 10 }}>
                    <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent-orange)', margin: 0, marginBottom: 6, textTransform: 'uppercase' }}>
                      ⚠️ Smitte-risiko fra oppstrøms
                    </p>
                    {farms.length > 0 ? (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        {farms
                          .filter(f => f.id !== selectedFarm.id && f.riskScore > 60 && f.riskScore > selectedFarm.riskScore * 0.8)
                          .slice(0, 4)
                          .map(f => (
                            <div
                              key={f.id}
                              onClick={() => setSelectedFarm(f)}
                              style={{
                                background: f.riskScore > 60 ? 'rgba(220, 38, 38, 0.1)' : 'rgba(251, 146, 60, 0.1)',
                                border: `1px solid ${f.riskScore > 60 ? 'var(--accent-red)' : 'var(--accent-orange)'}`,
                                borderRadius: 4,
                                padding: 6,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(212, 165, 116, 0.15)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = f.riskScore > 60 ? 'rgba(220, 38, 38, 0.1)' : 'rgba(251, 146, 60, 0.1)';
                              }}
                            >
                              <p style={{ margin: 0, fontSize: 10, fontWeight: 600, color: 'var(--text-primary)' }}>
                                {f.name}
                              </p>
                              <p style={{ margin: 0, fontSize: 9, color: 'var(--text-secondary)' }}>
                                🔴 Risiko: {f.riskScore}%
                              </p>
                            </div>
                          ))}
                        {farms.filter(f => f.id !== selectedFarm.id && f.riskScore > 60).length === 0 && (
                          <p style={{ fontSize: 10, color: 'var(--text-secondary)', gridColumn: '1 / -1' }}>
                            ✓ Ingen kritiske anlegg oppstrøms
                          </p>
                        )}
                      </div>
                    ) : (
                      <p style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Laster data...</p>
                    )}
                  </div>
                )}
              </div>

              {/* ===== INSPEKSJONER & LISENSER ===== */}
              {selectedFarm?.inspectionHistory && selectedFarm.inspectionHistory.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px 0', paddingBottom: 6, borderBottom: '1px solid var(--border-color)' }}>
                    📋 Sist inspeksjon
                  </h3>
                  <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 4, padding: 8 }}>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>
                      {new Date(selectedFarm.inspectionHistory[0].date).toLocaleDateString('no-NO')} - {selectedFarm.inspectionHistory[0].inspector}
                    </p>
                    <p style={{ margin: 0, fontSize: 10, color: 'var(--text-secondary)' }}>
                      {selectedFarm.inspectionHistory[0].findings} funn • Status: {selectedFarm.inspectionHistory[0].status}
                    </p>
                  </div>
                </div>
              )}

              {selectedFarm?.licenses && selectedFarm.licenses.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px 0', paddingBottom: 6, borderBottom: '1px solid var(--border-color)' }}>
                    🎫 Lisenser
                  </h3>
                  <div style={{ display: 'grid', gap: 4 }}>
                    {selectedFarm.licenses.map((lic, idx) => {
                      const daysLeft = Math.floor((new Date(lic.expires) - new Date()) / (24 * 3600 * 1000));
                      const isExpiring = daysLeft < 60;
                      return (
                        <div key={idx} style={{ background: 'var(--bg-surface)', border: isExpiring ? '1px solid var(--accent-orange)' : '1px solid var(--border-color)', borderRadius: 4, padding: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10 }}>
                          <div>
                            <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>{lic.type}</p>
                            <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{new Date(lic.expires).toLocaleDateString('no-NO')}</p>
                          </div>
                          <div style={{ background: isExpiring ? 'var(--accent-orange)' : 'var(--accent-green)', color: '#fff', padding: '3px 6px', borderRadius: 2, fontSize: 9, fontWeight: 600 }}>
                            {isExpiring ? `${daysLeft}d` : '✓'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ALERTS STATUS BANNER - Compact */}
              {alerts.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', margin: 0, marginBottom: 6, textTransform: 'uppercase', paddingBottom: 6, borderBottom: '1px solid var(--border-color)' }}>
                    Detaljer
                  </p>
                </div>
              )}

              {/* Disease Risks - Compact */}
              {diseaseRisks.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid var(--accent-orange)' }}>
                    <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                      🦠 Sykdomsrisiko
                    </h3>
                    {diseaseRisks.length > 3 && (
                      <button
                        onClick={() => setExpandAllDiseases(!expandAllDiseases)}
                        style={{
                          background: expandAllDiseases ? 'var(--accent-orange)' : 'var(--bg-elevated)',
                          color: expandAllDiseases ? '#fff' : 'var(--accent-orange)',
                          border: '1px solid var(--accent-orange)',
                          borderRadius: 3,
                          padding: '4px 8px',
                          cursor: 'pointer',
                          fontSize: 11,
                          fontWeight: 600
                        }}
                      >
                        {expandAllDiseases ? '⇧ Færre' : `⇩ Alle (${diseaseRisks.length})`}
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'grid', gap: 8, maxHeight: '300px', overflowY: 'auto' }}>
                    {(expandAllDiseases ? diseaseRisks : diseaseRisks.slice(0, 3)).map((risk, idx) => (
                      <div key={idx} style={{
                        background: risk.riskScore > 70 ? 'rgba(220, 38, 38, 0.1)' : 'rgba(251, 146, 60, 0.1)',
                        border: risk.riskScore > 70 ? '1px solid var(--accent-red)' : '1px solid var(--accent-orange)',
                        borderRadius: 6,
                        padding: 10
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8, gap: 8 }}>
                          <div style={{ flex: 1 }}>
                            <h4 style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
                              {risk.disease}
                            </h4>
                            <p style={{ margin: 0, fontSize: 10, color: 'var(--text-secondary)' }}>
                              {risk.sourceType === 'boat_traffic' ? '🚢' : '🌊'} {risk.source || 'Ukjent'}
                            </p>
                          </div>
                          <div style={{
                            background: risk.riskScore > 70 ? 'var(--accent-red)' : 'var(--accent-orange)',
                            color: '#fff',
                            padding: '4px 8px',
                            borderRadius: 3,
                            fontSize: 11,
                            fontWeight: 600,
                            whiteSpace: 'nowrap'
                          }}>
                            {risk.riskScore}%
                          </div>
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: '1.3' }}>
                          <p style={{ margin: 0, marginBottom: 3 }}>⏱️ {risk.manifestationDaysMin}-{risk.manifestationDaysMax} dager</p>
                          <p style={{ margin: 0 }}>💀 {risk.fatality === 'høy' ? 'Høy' : risk.fatality === 'moderat' ? 'Moderat' : 'Lav'} dødlighet</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Visiting Vessels - Compact */}
              {visitingVessels.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px 0', paddingBottom: 6, borderBottom: '1px solid var(--accent-gold)' }}>
                    🚢 Besøkende båter
                  </h3>
                  <div style={{ display: 'grid', gap: 4, maxHeight: '200px', overflowY: 'auto' }}>
                    {visitingVessels.slice(0, 5).map((vessel, idx) => {
                      const daysSinceDisinfection = vessel.dayseSinceDisinfection || 0;
                      const isHighRisk = daysSinceDisinfection > 7 || activeQuarantines.some(q => q.vessel_id === vessel.id);
                      
                      return (
                        <div key={idx} style={{
                          background: isHighRisk ? 'rgba(220, 38, 38, 0.08)' : 'var(--bg-surface)',
                          border: isHighRisk ? '1px solid var(--accent-red)' : '1px solid var(--border-color)',
                          borderRadius: 4,
                          padding: 8,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 8,
                          fontSize: 11
                        }}>
                          <div>
                            <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
                              {vessel.name} {isHighRisk && '🚨'}
                            </p>
                            <p style={{ margin: '2px 0 0 0', fontSize: 9, color: 'var(--text-secondary)' }}>
                              {vessel.id}
                            </p>
                          </div>
                          <div style={{
                            background: daysSinceDisinfection > 7 ? 'rgba(220, 38, 38, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                            color: daysSinceDisinfection > 7 ? 'var(--accent-red)' : 'var(--accent-green)',
                            padding: '4px 8px',
                            borderRadius: 3,
                            fontSize: 10,
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            textAlign: 'center'
                          }}>
                            {daysSinceDisinfection > 7 ? '⚠️' : '✓'}<br />{daysSinceDisinfection}d
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 16, marginBottom: 16 }}>👈 Velg et anlegg fra listen til venstre for å se detaljer</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Outbreak Report Modal */}
      {showReportForm && selectedFarm && (
        <OutbreakReport
          farm={selectedFarm}
          onSubmit={(data) => {
            console.log('Outbreak reported:', data);
            // Refresh alerts from backend
            setShowReportForm(false);
          }}
          onClose={() => setShowReportForm(false)}
        />
      )}
    </div>
  );
}
