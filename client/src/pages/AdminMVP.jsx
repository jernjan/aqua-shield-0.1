import { useState, useEffect } from 'react';
import apiClient from '../lib/apiClient';

const downloadCSV = (filename, data) => {
  const csv = data;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
};

const farmToCSV = (farms) => {
  let csv = 'Navn,Region,Risiko (%),Status\n';
  farms.forEach(farm => {
    const status = farm.riskScore > 60 ? 'Kritisk' : farm.riskScore > 40 ? 'Advarsel' : 'OK';
    csv += `"${farm.name}","${farm.region}",${farm.riskScore},"${status}"\n`;
  });
  return csv;
};

const alertToCSV = (alerts) => {
  let csv = 'Tittel,Anlegg,Region,Alvorlighet,Dato\n';
  alerts.forEach(alert => {
    csv += `"${alert.title}","${alert.facilityName}","${alert.region}","${alert.severity}","${new Date(alert.timestamp).toLocaleDateString('no-NO')}"\n`;
  });
  return csv;
};

const vesselToCSV = (vessels) => {
  let csv = 'Navn,MMSI,Type,Status\n';
  vessels.forEach(v => {
    const status = v.certificates?.some(c => new Date(c.expires) < new Date()) ? 'Utgåtte sertifikater' : 'OK';
    csv += `"${v.name}","${v.mmsi}","${v.type}","${status}"\n`;
  });
  return csv;
};

export default function AdminMVP({ token, currentUser }) {
  const [activeTab, setActiveTab] = useState('risks');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRegion, setFilterRegion] = useState('all');
  const [outbreakConfirmation, setOutbreakConfirmation] = useState({}); // Track confirmed/denied alerts
  const [backendAlerts, setBackendAlerts] = useState([]); // Alerts from backend datalogger
  const [realOutbreaks, setRealOutbreaks] = useState([]); // Real outbreak data from BarentsWatch
  const [outbreakStats, setOutbreakStats] = useState(null); // Outbreak statistics
  const [loadingOutbreaks, setLoadingOutbreaks] = useState(false); // Loading state
  const [lastOutbreakRefresh, setLastOutbreakRefresh] = useState(null); // Track last refresh time
  const [facilityAlerts, setFacilityAlerts] = useState([]); // Facility risk alerts from alert service
  const [alertStats, setAlertStats] = useState(null) // Alert statistics
  const [riskAssessment, setRiskAssessment] = useState(null) // Risk assessment data
  const [loadingRisks, setLoadingRisks] = useState(false) // Risk loading state
  const [selectedRiskyFacility, setSelectedRiskyFacility] = useState(null) // Selected facility for detail view
  const [loadingAlerts, setLoadingAlerts] = useState(false)

  // Fetch alerts from backend on mount
  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const response = await apiClient.get('/api/datalog/alerts');
        const data = response.data;
        if (data.ok && data.alerts) {
          setBackendAlerts(data.alerts);
          console.log(`Fetched ${data.alerts.length} alerts from backend`);
        }
      } catch (err) {
        console.error('Error fetching alerts:', err);
      }
    };
    fetchAlerts();
  }, [];

  // Fetch facility risk alerts and statistics
  useEffect(() => {
    const fetchFacilityAlerts = async () => {
      try {
        setLoadingAlerts(true);
        console.log('📡 Fetching facility risk alerts...');
        const response = await apiClient.get('/api/alerts/active');
        const data = response.data;
        
        if (data.ok && data.alerts) {
          setFacilityAlerts(data.alerts);
          // Cache to localStorage
          localStorage.setItem('facilityAlerts_cache', JSON.stringify({
            data: data.alerts,
            timestamp: Date.now()
          }));
          console.log(`✓ Fetched ${data.alerts.length} active facility alerts`);
        }

        // Also fetch alert stats
        const statsResponse = await apiClient.get('/api/alerts/stats');
        const statsData = statsResponse.data;
        if (statsData.ok) {
          setAlertStats(statsData.stats);
          localStorage.setItem('alertStats_cache', JSON.stringify({
            data: statsData.stats,
            timestamp: Date.now()
          }));
          console.log('✓ Fetched alert statistics');
        }
      } catch (err) {
        console.error('Error fetching facility alerts:', err);
        // Try to load from cache on error
        try {
          const cached = JSON.parse(localStorage.getItem('facilityAlerts_cache') || '{}');
          if (cached.data) {
            setFacilityAlerts(cached.data);
            console.log('ℹ️ Loaded alerts from cache');
          }
        } catch (e) {}
      } finally {
        setLoadingAlerts(false);
      }
    };

    fetchFacilityAlerts();
    // Refresh every 1 hour for active monitoring (was 5 min - too aggressive)
    const interval = setInterval(fetchFacilityAlerts, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch Risk Assessment from new risk engine
  useEffect(() => {
    const fetchRisks = async () => {
      try {
        setLoadingRisks(true);
        console.log('📊 Fetching risk assessment...');
        const response = await apiClient.get('/api/admin/risks');
        const data = response.data;
        
        if (data && data.summary) {
          setRiskAssessment(data);
          console.log(`✓ Risk assessment loaded: ${data.summary.risky} risky facilities`);
        }
      } catch (err) {
        console.error('Error fetching risk assessment:', err);
      } finally {
        setLoadingRisks(false);
      }
    };

    fetchRisks();
    // Refresh every 30 minutes
    const interval = setInterval(fetchRisks, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch real outbreak data from BarentsWatch Fishhealth API
  useEffect(() => {
    const fetchOutbreaks = async () => {
      try {
        setLoadingOutbreaks(true);
        console.log('🔄 Fetching real outbreak data from BarentsWatch API...');
        const response = await apiClient.get('/api/barentswatch/outbreaks?weeks=12');
        const data = response.data;
        
        if (data.ok && data.outbreaks) {
          setRealOutbreaks(data.outbreaks);
          setLastOutbreakRefresh(new Date());
          // Cache to localStorage
          localStorage.setItem('realOutbreaks_cache', JSON.stringify({
            data: data.outbreaks,
            timestamp: Date.now()
          }));
          console.log(`✓ Fetched ${data.outbreaks.length} real outbreaks from BarentsWatch`);
          
          // Also fetch stats
          const statsResponse = await apiClient.get('/api/barentswatch/stats?weeks=12');
          const statsData = statsResponse.data;
          if (statsData.ok) {
            setOutbreakStats(statsData.stats);
            localStorage.setItem('outbreakStats_cache', JSON.stringify({
              data: statsData.stats,
              timestamp: Date.now()
            }));
            console.log('✓ Fetched outbreak statistics');
          }
        } else {
          console.warn('No outbreak data or API error:', data);
        }
      } catch (err) {
        console.error('Error fetching outbreak data:', err);
        // Try to load from cache on error
        try {
          const cached = JSON.parse(localStorage.getItem('realOutbreaks_cache') || '{}');
          if (cached.data) {
            setRealOutbreaks(cached.data);
            console.log('ℹ️ Loaded outbreaks from cache');
          }
        } catch (e) {}
      } finally {
        setLoadingOutbreaks(false);
      }
    };
    
    fetchOutbreaks();
    // Refresh once per day (24 hours) to save API bandwidth
    const interval = setInterval(fetchOutbreaks, 24 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Mock data for demo
  const farms = [
    { id: 1, name: 'Anlegg Nord-Trøndelag', region: 'Nord-Trøndelag', riskScore: 78 },
    { id: 2, name: 'Anlegg Troms', region: 'Troms & Finnmark', riskScore: 65 },
    { id: 3, name: 'Anlegg Hordaland', region: 'Hordaland', riskScore: 45 },
    { id: 4, name: 'Anlegg Sogn', region: 'Sogn & Fjordane', riskScore: 32 },
    { id: 5, name: 'Anlegg Møre', region: 'Møre og Romsdal', riskScore: 55 },
    { id: 6, name: 'Anlegg Vest-Agder', region: 'Vest-Agder', riskScore: 42 },
  ];

  const vessels = [
    { id: 1, name: 'MV Nordlys', mmsi: '123456789', type: 'Service Vessel', certificates: [] },
    { id: 2, name: 'MV Atlantica', mmsi: '987654321', type: 'Transport', certificates: [] },
  ];

  const allFarmAlerts = {
    1: [
      { title: 'Høy lus-risiko', severity: 'risikofylt', timestamp: new Date(), region: 'Nord-Trøndelag', facilityName: 'Anlegg Nord-Trøndelag' },
      { title: 'Temperatur over grense', severity: 'høy oppmerksomhet', timestamp: new Date(), region: 'Nord-Trøndelag', facilityName: 'Anlegg Nord-Trøndelag' },
    ],
    2: [
      { title: 'Båtkontakt registrert', severity: 'moderat', timestamp: new Date(), region: 'Troms & Finnmark', facilityName: 'Anlegg Troms' },
    ],
  };

  // Calculate stats - simplified
  const criticalFarms = farms.filter(f => f.riskScore > 60).length;
  const warningFarms = farms.filter(f => f.riskScore > 40 && f.riskScore <= 60).length;
  
  const totalAlertCount = Object.values(allFarmAlerts).reduce((sum, alerts) => sum + alerts.length, 0);
  const criticalAlertCount = Object.values(allFarmAlerts).reduce((sum, alerts) => sum + alerts.filter(a => a.severity === 'risikofylt').length, 0);
  
  const totalAlerts = totalAlertCount;
  const criticalAlerts = criticalAlertCount;
  const avgRisk = farms.length > 0 ? Math.round(farms.reduce((sum, f) => sum + f.riskScore, 0) / farms.length) : 0;

  // Use backend alerts if available, otherwise fallback to mock data
  const allAlerts = backendAlerts.length > 0 ? backendAlerts : Object.values(allFarmAlerts).flat();
  const filteredAlerts = allAlerts.filter(a => {
    const matchesSearch = a.title?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRegion = filterRegion === 'all' || a.region === filterRegion;
    return matchesSearch && matchesRegion;
  });

  const regions = [...new Set(farms.map(f => f.region))].filter(Boolean).sort();

  const expiredCerts = vessels.filter(v => 
    v.certificates?.some(c => new Date(c.expires) < new Date())
  ).length;

  // Handle outbreak confirmation
  const handleOutbreakConfirmation = async (alertIndex, confirmed) => {
    const alertId = `alert_${alertIndex}`;
    
    // Optimistically update UI
    setOutbreakConfirmation(prev => ({
      ...prev,
      [alertId]: confirmed ? 'confirmed' : 'denied'
    }));

    // Send to datalogger backend
    try {
      const response = await fetch('http://localhost:3001/api/datalog/alert/' + alertId + '/outbreak', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          confirmed: confirmed,
          notes: `Confirmed by Admin on ${new Date().toLocaleDateString('no-NO')}`
        })
      });

      if (response.ok) {
        console.log(`✓ Alert ${alertId} marked as ${confirmed ? 'confirmed outbreak' : 'false positive'}`);
      }
    } catch (err) {
      console.error('Error updating outbreak confirmation:', err);
      // Revert optimistic update on error
      setOutbreakConfirmation(prev => {
        const newState = { ...prev };
        delete newState[alertId];
        return newState;
      });
    }
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 50px)', background: 'var(--bg-dark)' }}>
      {/* LEFT SIDEBAR */}
      <div style={{ width: 220, background: 'var(--bg-surface)', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        {/* Master Stats */}
        <div style={{ background: 'var(--bg-dark)', padding: '10px', borderBottom: '1px solid var(--border-color)' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Master oversikt
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 9 }}>
            <div style={{ background: 'rgba(220, 38, 38, 0.15)', borderRadius: 3, padding: '6px 8px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 8, color: 'var(--text-secondary)' }}>Kritisk</p>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--accent-red)' }}>
                {criticalFarms}
              </p>
            </div>
            <div style={{ background: 'rgba(251, 146, 60, 0.15)', borderRadius: 3, padding: '6px 8px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 8, color: 'var(--text-secondary)' }}>Advarsel</p>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--accent-orange)' }}>
                {warningFarms}
              </p>
            </div>
            <div style={{ background: 'rgba(220, 38, 38, 0.15)', borderRadius: 3, padding: '6px 8px', textAlign: 'center', gridColumn: '1 / -1' }}>
              <p style={{ margin: 0, fontSize: 8, color: 'var(--text-secondary)' }}>Kritiske varsler</p>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--accent-red)' }}>
                {criticalAlerts}
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ padding: '10px', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[
            { id: 'risks', label: '⚠️ Risiko-analyse', icon: '⚠️' },
            { id: 'overview', label: '📊 Oversikt', icon: '📊' },
            { id: 'facility-alerts', label: '🚨 Risiko-varsler', icon: '🚨' },
            { id: 'outbreaks', label: '🦐 Utbrudd (Real)', icon: '🦐' },
            { id: 'alerts', label: '📝 Varsler', icon: '📝' },
            { id: 'farms', label: '🐟 Anlegg', icon: '🐟' },
            { id: 'vessels', label: '🚢 Båter', icon: '🚢' },
            { id: 'regions', label: '🗺️ Regioner', icon: '🗺️' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '8px 10px',
                background: activeTab === tab.id ? 'rgba(212, 165, 116, 0.2)' : 'transparent',
                border: activeTab === tab.id ? '1px solid var(--accent-gold)' : '1px solid transparent',
                borderRadius: 3,
                color: activeTab === tab.id ? 'var(--accent-gold)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: activeTab === tab.id ? 600 : 400,
                transition: 'all 0.15s ease',
                textAlign: 'left'
              }}
              onMouseEnter={(e) => {
                if (activeTab !== tab.id) e.currentTarget.style.background = 'var(--bg-elevated)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = activeTab === tab.id ? 'rgba(212, 165, 116, 0.2)' : 'transparent';
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search/Filter - shown in alerts/farms tabs */}
        {(activeTab === 'alerts' || activeTab === 'farms') && (
          <div style={{ padding: '10px', borderBottom: '1px solid var(--border-color)' }}>
            <input
              type="text"
              placeholder="Søk..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 8px',
                fontSize: 11,
                background: 'var(--bg-dark)',
                border: '1px solid var(--border-color)',
                borderRadius: 3,
                color: 'var(--text-primary)',
                boxSizing: 'border-box'
              }}
            />
            {regions.length > 1 && (
              <select
                value={filterRegion}
                onChange={(e) => setFilterRegion(e.target.value)}
                style={{
                  width: '100%',
                  marginTop: 6,
                  padding: '6px 8px',
                  fontSize: 10,
                  background: 'var(--bg-dark)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 3,
                  color: 'var(--text-primary)',
                  boxSizing: 'border-box'
                }}
              >
                <option value="all">Alle regioner</option>
                {regions.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      {/* RIGHT MAIN CONTENT */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ background: 'var(--bg-dark)', padding: '12px 16px', borderBottom: '2px solid var(--accent-gold)', position: 'sticky', top: 0, zIndex: 100 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--accent-gold)' }}>
            ADMIN
          </h1>
          <p style={{ margin: '2px 0 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
            Ditt administratorpanel
          </p>
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 0 }}>
          {/* RISK ANALYSIS TAB */}
          {activeTab === 'risks' && (
            <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '12px 16px' }}>
              {loadingRisks ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                  ⏳ Laster risiko-analyse...
                </div>
              ) : riskAssessment ? (
                <>
                  {/* Summary Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 16 }}>
                    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 12, textAlign: 'center' }}>
                      <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', margin: 0, marginBottom: 6, textTransform: 'uppercase' }}>Total</p>
                      <p style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent-gold)', margin: 0 }}>{riskAssessment.metadata.total_facilities}</p>
                    </div>
                    <div style={{ background: 'rgba(220, 38, 38, 0.1)', border: '2px solid #DC2626', borderRadius: 6, padding: 12, textAlign: 'center' }}>
                      <p style={{ fontSize: 10, fontWeight: 600, color: '#DC2626', margin: 0, marginBottom: 6, textTransform: 'uppercase' }}>🔴 Kritisk</p>
                      <p style={{ fontSize: 28, fontWeight: 700, color: '#DC2626', margin: 0 }}>{riskAssessment.summary.critical}</p>
                    </div>
                    <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '2px solid #F59E0B', borderRadius: 6, padding: 12, textAlign: 'center' }}>
                      <p style={{ fontSize: 10, fontWeight: 600, color: '#F59E0B', margin: 0, marginBottom: 6, textTransform: 'uppercase' }}>🟠 Høy</p>
                      <p style={{ fontSize: 28, fontWeight: 700, color: '#F59E0B', margin: 0 }}>{riskAssessment.summary.high}</p>
                    </div>
                    <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '2px solid #3B82F6', borderRadius: 6, padding: 12, textAlign: 'center' }}>
                      <p style={{ fontSize: 10, fontWeight: 600, color: '#3B82F6', margin: 0, marginBottom: 6, textTransform: 'uppercase' }}>🟡 Medium</p>
                      <p style={{ fontSize: 28, fontWeight: 700, color: '#3B82F6', margin: 0 }}>{riskAssessment.summary.medium}</p>
                    </div>
                    <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '2px solid #10B981', borderRadius: 6, padding: 12, textAlign: 'center' }}>
                      <p style={{ fontSize: 10, fontWeight: 600, color: '#10B981', margin: 0, marginBottom: 6, textTransform: 'uppercase' }}>✓ Grønn</p>
                      <p style={{ fontSize: 28, fontWeight: 700, color: '#10B981', margin: 0 }}>{riskAssessment.summary.safe}</p>
                    </div>
                  </div>

                  {/* Risk Facilities List */}
                  {riskAssessment.risky.length > 0 ? (
                    <>
                      <h3 style={{ color: 'var(--accent-gold)', fontSize: 14, fontWeight: 600, marginBottom: 12, marginTop: 0 }}>⚠️ Risiko-anlegg ({riskAssessment.risky.length})</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
                        {riskAssessment.risky.map((facility, idx) => (
                          <div
                            key={idx}
                            onClick={() => setSelectedRiskyFacility(selectedRiskyFacility?.id === facility.id ? null : facility)}
                            style={{
                              background: 'var(--bg-elevated)',
                              border: facility.riskLevel === 'CRITICAL' ? '2px solid #DC2626' : facility.riskLevel === 'HIGH' ? '2px solid #F59E0B' : '2px solid #3B82F6',
                              borderRadius: 6,
                              padding: 12,
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(212, 165, 116, 0.1)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                                  {facility.name} ({facility.municipality})
                                </p>
                                <p style={{ margin: '4px 0 0 0', fontSize: 11, color: 'var(--text-secondary)' }}>
                                  Lus: {facility.liceCount} | Status: {facility.diseaseStatus || 'OK'}
                                </p>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: facility.riskLevel === 'CRITICAL' ? '#DC2626' : facility.riskLevel === 'HIGH' ? '#F59E0B' : '#3B82F6' }}>
                                  {facility.ownRisk}
                                </p>
                                <p style={{ margin: '2px 0 0 0', fontSize: 10, fontWeight: 600, color: facility.riskLevel === 'CRITICAL' ? '#DC2626' : facility.riskLevel === 'HIGH' ? '#F59E0B' : '#3B82F6' }}>
                                  {facility.riskLevel}
                                </p>
                              </div>
                            </div>

                            {/* Expanded detail view */}
                            {selectedRiskyFacility?.id === facility.id && (
                              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-color)' }}>
                                <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', margin: '0 0 8px 0', textTransform: 'uppercase' }}>
                                  Kan smitte følgende anlegg:
                                </p>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                                  {facility.transmissionTargets.slice(0, 6).map((target, tidx) => (
                                    <div key={tidx} style={{ background: 'var(--bg-dark)', padding: 8, borderRadius: 4, fontSize: 10 }}>
                                      <p style={{ margin: '0 0 4px 0', fontWeight: 600, color: 'var(--text-primary)' }}>
                                        {target.name}
                                      </p>
                                      <p style={{ margin: '0 0 2px 0', color: 'var(--text-secondary)' }}>
                                        Risk: <span style={{ color: '#F59E0B', fontWeight: 600 }}>{target.transmissionRisk.score}</span>
                                      </p>
                                      <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                                        {target.transmissionRisk.distance.toFixed(1)} km
                                      </p>
                                    </div>
                                  ))}
                                </div>
                                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-color)' }}>
                                  <button style={{
                                    background: '#DC2626',
                                    color: 'white',
                                    border: 'none',
                                    padding: '8px 12px',
                                    borderRadius: 4,
                                    fontSize: 11,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    marginRight: 8
                                  }}>
                                    📢 Send varsel til anlegg
                                  </button>
                                  <button style={{
                                    background: '#F59E0B',
                                    color: 'white',
                                    border: 'none',
                                    padding: '8px 12px',
                                    borderRadius: 4,
                                    fontSize: 11,
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                  }}>
                                    ⛵ Send varsel til båter
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div style={{ background: 'var(--bg-elevated)', padding: 40, textAlign: 'center', borderRadius: 6 }}>
                      <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>✓ Ingen anlegg over risikoterskelen (70+)</p>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                  Ingen risiko-data tilgjengelig
                </div>
              )}
            </div>
          )}

          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '12px 16px' }}>
              {/* Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 12, textAlign: 'center' }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', margin: 0, marginBottom: 8, textTransform: 'uppercase' }}>
                    Totale anlegg
                  </p>
                  <p style={{ fontSize: 32, fontWeight: 700, color: 'var(--accent-gold)', margin: 0 }}>
                    {farms.length}
                  </p>
                </div>
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 12, textAlign: 'center' }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', margin: 0, marginBottom: 8, textTransform: 'uppercase' }}>
                    Kritisk risiko
                  </p>
                  <p style={{ fontSize: 32, fontWeight: 700, color: 'var(--accent-red)', margin: 0 }}>
                    {criticalFarms}
                  </p>
                </div>
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 12, textAlign: 'center' }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', margin: 0, marginBottom: 8, textTransform: 'uppercase' }}>
                    Totale varsler
                  </p>
                  <p style={{ fontSize: 32, fontWeight: 700, color: 'var(--accent-orange)', margin: 0 }}>
                    {totalAlerts}
                  </p>
                </div>
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 12, textAlign: 'center' }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', margin: 0, marginBottom: 8, textTransform: 'uppercase' }}>
                    Gj.snitt risiko
                  </p>
                  <p style={{ fontSize: 32, fontWeight: 700, color: 'var(--accent-green)', margin: 0 }}>
                    {avgRisk}%
                  </p>
                </div>
              </div>

              {/* Regional Breakdown */}
              {regions.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-gold)', margin: '0 0 8px 0', paddingBottom: 6, borderBottom: '2px solid var(--accent-gold)' }}>
                    🗺️ Regional fordeling
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                    {regions.map(region => {
                      const regionFarms = farms.filter(f => f.region === region);
                      const regionCritical = regionFarms.filter(f => f.riskScore > 60).length;
                      const regionAvgRisk = regionFarms.length > 0 ? Math.round(regionFarms.reduce((sum, f) => sum + f.riskScore, 0) / regionFarms.length) : 0;
                      return (
                        <div key={region} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 12 }}>
                          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--accent-gold)', marginBottom: 8 }}>
                            {region}
                          </p>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11 }}>
                            <div>
                              <p style={{ margin: 0, fontSize: 9, color: 'var(--text-secondary)' }}>Anlegg</p>
                              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                                {regionFarms.length}
                              </p>
                            </div>
                            <div>
                              <p style={{ margin: 0, fontSize: 9, color: 'var(--text-secondary)' }}>Kritisk</p>
                              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--accent-red)' }}>
                                {regionCritical}
                              </p>
                            </div>
                            <div style={{ gridColumn: '1 / -1', paddingTop: 6, borderTop: '1px solid var(--border-color)' }}>
                              <p style={{ margin: 0, fontSize: 9, color: 'var(--text-secondary)' }}>Gj.snitt risiko</p>
                              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--accent-gold)' }}>
                                {regionAvgRisk}%
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Vessel Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 12 }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', margin: 0, marginBottom: 8, textTransform: 'uppercase' }}>
                    🚢 Båter
                  </p>
                  <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent-gold)', margin: 0 }}>
                    {vessels.length}
                  </p>
                  <p style={{ fontSize: 10, color: 'var(--text-secondary)', margin: '6px 0 0 0' }}>
                    {expiredCerts} utgåtte sertifikater
                  </p>
                </div>
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 12 }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', margin: 0, marginBottom: 8, textTransform: 'uppercase' }}>
                    ⏰ Anlegg oversikt
                  </p>
                  <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent-green)', margin: 0 }}>
                    {farms.length}
                  </p>
                  <p style={{ fontSize: 10, color: 'var(--text-secondary)', margin: '6px 0 0 0' }}>
                    totalt registrert
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ALERTS TAB */}
          {activeTab === 'alerts' && (
            <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-red)', margin: 0, paddingBottom: 6, borderBottom: '2px solid var(--accent-red)' }}>
                  🚨 Varsler ({filteredAlerts.length})
                </h3>
                <button
                  onClick={() => downloadCSV('varsler.csv', alertToCSV(filteredAlerts))}
                  style={{
                    padding: '6px 12px',
                    background: 'var(--accent-red)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 3,
                    cursor: 'pointer',
                    fontSize: 10,
                    fontWeight: 600
                  }}
                >
                  📥 Eksporter CSV
                </button>
              </div>
              <div style={{ display: 'grid', gap: 6, maxHeight: '600px', overflowY: 'auto' }}>
                {filteredAlerts.slice(0, 50).map((alert, idx) => {
                  const isCritical = alert.severity === 'risikofylt';
                  const isWarning = alert.severity === 'høy oppmerksomhet';
                  const alertId = `alert_${idx}`;
                  const confirmationStatus = outbreakConfirmation[alertId];

                  return (
                    <div
                      key={idx}
                      style={{
                        background: confirmationStatus === 'confirmed' ? 'rgba(34, 197, 94, 0.1)' : confirmationStatus === 'denied' ? 'rgba(107, 114, 128, 0.1)' : isCritical ? 'rgba(220, 38, 38, 0.1)' : isWarning ? 'rgba(251, 146, 60, 0.1)' : 'var(--bg-surface)',
                        border: confirmationStatus === 'confirmed' ? '1.5px solid #22c55e' : confirmationStatus === 'denied' ? '1px solid var(--text-secondary)' : isCritical ? '1.5px solid var(--accent-red)' : isWarning ? '1px solid var(--accent-orange)' : '1px solid var(--border-color)',
                        borderLeft: confirmationStatus === 'confirmed' ? '3px solid #22c55e' : confirmationStatus === 'denied' ? '3px solid #6b7280' : isCritical ? '3px solid var(--accent-red)' : isWarning ? '3px solid var(--accent-orange)' : '3px solid var(--border-color)',
                        borderRadius: 4,
                        padding: 10
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 6 }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
                            {alert.title} {alert.facilityName && `(${alert.facilityName})`}
                            {confirmationStatus === 'confirmed' && <span style={{ marginLeft: 6, color: '#22c55e', fontSize: 10 }}>✓ Bekreftet utbrudd</span>}
                            {confirmationStatus === 'denied' && <span style={{ marginLeft: 6, color: '#6b7280', fontSize: 10 }}>✗ Falsk alarm</span>}
                          </p>
                          <p style={{ margin: '2px 0 0 0', fontSize: 10, color: 'var(--text-secondary)' }}>
                            {alert.region} • {new Date(alert.timestamp).toLocaleDateString('no-NO')}
                          </p>
                        </div>
                        <span style={{ fontSize: 12, marginLeft: 8 }}>
                          {confirmationStatus === 'confirmed' ? '✅' : confirmationStatus === 'denied' ? '❌' : isCritical ? '🔴' : isWarning ? '🟠' : '🟢'}
                        </span>
                      </div>

                      {/* Confirmation Buttons */}
                      {!confirmationStatus && (
                        <div style={{ display: 'flex', gap: 6, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border-color)' }}>
                          <button
                            onClick={() => handleOutbreakConfirmation(idx, true)}
                            style={{
                              flex: 1,
                              padding: '6px 8px',
                              background: '#22c55e',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 3,
                              cursor: 'pointer',
                              fontSize: 10,
                              fontWeight: 600,
                              transition: 'opacity 0.2s'
                            }}
                            onMouseOver={(e) => e.target.style.opacity = '0.8'}
                            onMouseOut={(e) => e.target.style.opacity = '1'}
                          >
                            ✓ Bekreftet utbrudd
                          </button>
                          <button
                            onClick={() => handleOutbreakConfirmation(idx, false)}
                            style={{
                              flex: 1,
                              padding: '6px 8px',
                              background: '#6b7280',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 3,
                              cursor: 'pointer',
                              fontSize: 10,
                              fontWeight: 600,
                              transition: 'opacity 0.2s'
                            }}
                            onMouseOver={(e) => e.target.style.opacity = '0.8'}
                            onMouseOut={(e) => e.target.style.opacity = '1'}
                          >
                            ✗ Falsk alarm
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* FARMS TAB */}
          {activeTab === 'farms' && (
            <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-gold)', margin: 0, paddingBottom: 6, borderBottom: '2px solid var(--accent-gold)' }}>
                  🐟 Anlegg ({farms.length})
                </h3>
                <button
                  onClick={() => downloadCSV('anlegg.csv', farmToCSV(farms))}
                  style={{
                    padding: '6px 12px',
                    background: 'var(--accent-gold)',
                    color: '#111',
                    border: 'none',
                    borderRadius: 3,
                    cursor: 'pointer',
                    fontSize: 10,
                    fontWeight: 600
                  }}
                >
                  📥 Eksporter CSV
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {farms.slice(0, 30).map(farm => (
                  <div 
                    key={farm.id} 
                    style={{ 
                      background: 'var(--bg-elevated)', 
                      border: '1px solid var(--border-color)', 
                      borderRadius: 6, 
                      padding: 10,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      position: 'relative'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--accent-gold)';
                      e.currentTarget.style.background = 'var(--bg-dark)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                      e.currentTarget.style.background = 'var(--bg-elevated)';
                    }}
                  >
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {farm.name}
                    </p>
                    <p style={{ margin: '2px 0 0 0', fontSize: 10, color: 'var(--text-secondary)' }}>
                      {farm.region}
                    </p>
                    <p style={{ margin: '4px 0 0 0', fontSize: 9, color: farm.riskScore > 60 ? 'var(--accent-red)' : farm.riskScore > 40 ? 'var(--accent-orange)' : 'var(--accent-green)' }}>
                      Risiko: {farm.riskScore}%
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* VESSELS TAB */}
          {activeTab === 'vessels' && (
            <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-green)', margin: 0, paddingBottom: 6, borderBottom: '2px solid var(--accent-green)' }}>
                  🚢 Båter ({vessels.length})
                </h3>
                <button
                  onClick={() => downloadCSV('bater.csv', vesselToCSV(vessels))}
                  style={{
                    padding: '6px 12px',
                    background: 'var(--accent-green)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 3,
                    cursor: 'pointer',
                    fontSize: 10,
                    fontWeight: 600
                  }}
                >
                  📥 Eksporter CSV
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                {vessels.slice(0, 20).map(vessel => (
                  <div key={vessel.id} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 10 }}>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {vessel.name}
                    </p>
                    <p style={{ margin: '2px 0 0 0', fontSize: 10, color: 'var(--text-secondary)' }}>
                      MMSI: {vessel.mmsi} • {vessel.type}
                    </p>
                    {vessel.certificates?.some(c => new Date(c.expires) < new Date()) && (
                      <p style={{ margin: '4px 0 0 0', fontSize: 9, color: 'var(--accent-red)' }}>
                        🔴 Utgåtte sertifikater
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FACILITY RISK ALERTS TAB */}
          {activeTab === 'facility-alerts' && (
            <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-red)', margin: 0, paddingBottom: 6, borderBottom: '2px solid var(--accent-red)' }}>
                    🚨 Risiko-varsler til Anlegg
                  </h3>
                  <p style={{ fontSize: 9, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                    Automatiske varsler når ML-modellen registrerer økt risiko
                  </p>
                </div>
                <button
                  onClick={async () => {
                    setLoadingAlerts(true);
                    try {
                      const response = await apiClient.get('/api/alerts/active');
                      const data = response.data;
                      if (data.ok && data.alerts) {
                        setFacilityAlerts(data.alerts);
                      }
                      const statsResponse = await apiClient.get('/api/alerts/stats');
                      const statsData = statsResponse.data;
                      if (statsData.ok) {
                        setAlertStats(statsData.stats);
                      }
                    } catch (err) {
                      console.error('Manual refresh error:', err);
                    } finally {
                      setLoadingAlerts(false);
                    }
                  }}
                  disabled={loadingAlerts}
                  style={{
                    padding: '6px 10px',
                    background: loadingAlerts ? 'var(--bg-dark)' : 'var(--accent-red)',
                    color: loadingAlerts ? 'var(--text-secondary)' : '#fff',
                    border: 'none',
                    borderRadius: 3,
                    cursor: loadingAlerts ? 'default' : 'pointer',
                    fontSize: 10,
                    fontWeight: 600,
                    opacity: loadingAlerts ? 0.6 : 1
                  }}
                >
                  {loadingAlerts ? '⏳ Laster...' : '🔄 Oppdater nå'}
                </button>
              </div>

              {/* Alert Statistics */}
              {alertStats && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 14 }}>
                  <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 12, textAlign: 'center' }}>
                    <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', margin: 0, marginBottom: 8, textTransform: 'uppercase' }}>
                      Totalt
                    </p>
                    <p style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent-gold)', margin: 0 }}>
                      {alertStats.total}
                    </p>
                  </div>
                  <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 12, textAlign: 'center' }}>
                    <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', margin: 0, marginBottom: 8, textTransform: 'uppercase' }}>
                      Aktiv
                    </p>
                    <p style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent-red)', margin: 0 }}>
                      {alertStats.pending}
                    </p>
                  </div>
                  <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 12, textAlign: 'center' }}>
                    <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', margin: 0, marginBottom: 8, textTransform: 'uppercase' }}>
                      Kritisk
                    </p>
                    <p style={{ fontSize: 28, fontWeight: 700, color: '#dc2626', margin: 0 }}>
                      {alertStats.critical}
                    </p>
                  </div>
                  <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 12, textAlign: 'center' }}>
                    <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', margin: 0, marginBottom: 8, textTransform: 'uppercase' }}>
                      Bekreftet
                    </p>
                    <p style={{ fontSize: 28, fontWeight: 700, color: '#22c55e', margin: 0 }}>
                      {alertStats.acknowledged}
                    </p>
                  </div>
                </div>
              )}

              {/* Active Alerts List */}
              <div style={{ display: 'grid', gap: 8, maxHeight: '700px', overflowY: 'auto' }}>
                {facilityAlerts.length > 0 ? facilityAlerts.map((alert, idx) => {
                  const severityEmoji = alert.severity === 'CRITICAL' ? '🔴' : '🟠';
                  const statusColor = alert.status === 'PENDING' ? 'var(--accent-red)' : alert.status === 'SENT' ? 'var(--accent-orange)' : alert.status === 'ACKNOWLEDGED' ? '#22c55e' : '#6b7280';

                  return (
                    <div
                      key={idx}
                      style={{
                        background: 'var(--bg-surface)',
                        border: `1.5px solid ${statusColor}`,
                        borderLeft: `3px solid ${statusColor}`,
                        borderRadius: 6,
                        padding: 12
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 14 }}>{severityEmoji}</span>
                            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                              {alert.disease}
                            </p>
                            <span style={{ fontSize: 9, padding: '2px 6px', background: statusColor, color: '#fff', borderRadius: 3 }}>
                              {alert.status}
                            </span>
                          </div>
                          <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary)' }}>
                            Anlegg: {alert.facilityId} • Risiko: {alert.riskScore}/100 ({alert.riskLevel})
                          </p>
                          <p style={{ margin: '4px 0 0 0', fontSize: 10, color: 'var(--text-secondary)' }}>
                            {new Date(alert.timestamp).toLocaleString('no-NO')}
                          </p>
                        </div>
                      </div>

                      <div style={{ background: 'rgba(0, 0, 0, 0.2)', padding: 8, borderRadius: 3, marginBottom: 8, fontSize: 10, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                        "{alert.message}"
                      </div>

                      {alert.status === 'PENDING' && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={async () => {
                              try {
                                await apiClient.patch(`/api/alerts/${alert.id}/acknowledge`, {
                                  acknowledgedBy: 'Admin'
                                });
                                setFacilityAlerts(facilityAlerts.map(a => a.id === alert.id ? { ...a, status: 'ACKNOWLEDGED' } : a));
                              } catch (err) {
                                console.error('Error acknowledging alert:', err);
                              }
                            }}
                            style={{
                              flex: 1,
                              padding: '6px 8px',
                              background: '#22c55e',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 3,
                              cursor: 'pointer',
                              fontSize: 10,
                              fontWeight: 600
                            }}
                          >
                            ✓ Anlegget varslet
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                await apiClient.patch(`/api/alerts/${alert.id}/resolve`, {});
                                setFacilityAlerts(facilityAlerts.filter(a => a.id !== alert.id));
                              } catch (err) {
                                console.error('Error resolving alert:', err);
                              }
                            }}
                            style={{
                              flex: 1,
                              padding: '6px 8px',
                              background: '#6b7280',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 3,
                              cursor: 'pointer',
                              fontSize: 10,
                              fontWeight: 600
                            }}
                          >
                            ✗ Løst
                          </button>
                        </div>
                      )}
                    </div>
                  );
                }) : (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
                    <p style={{ fontSize: 12, margin: 0 }}>🟢 Ingen aktive risiko-varsler</p>
                    <p style={{ fontSize: 10, margin: '4px 0 0 0' }}>Alle anlegg er innenfor trygge risiko-nivåer</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* REAL OUTBREAKS TAB - BarentsWatch Fishhealth API */}
          {activeTab === 'outbreaks' && (
            <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-green)', margin: 0, paddingBottom: 6, borderBottom: '2px solid var(--accent-green)' }}>
                    🦐 Real Outbreaks fra BarentsWatch
                  </h3>
                  {lastOutbreakRefresh && (
                    <p style={{ fontSize: 9, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                      Sist oppdatert: {lastOutbreakRefresh.toLocaleString('no-NO')}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    onClick={async () => {
                      setLoadingOutbreaks(true);
                      try {
                        const response = await apiClient.get('/api/barentswatch/outbreaks?weeks=12');
                        const data = response.data;
                        if (data.ok && data.outbreaks) {
                          setRealOutbreaks(data.outbreaks);
                          setLastOutbreakRefresh(new Date());
                          const statsResponse = await apiClient.get('/api/barentswatch/stats?weeks=12');
                          const statsData = statsResponse.data;
                          if (statsData.ok) {
                            setOutbreakStats(statsData.stats);
                          }
                        }
                      } catch (err) {
                        console.error('Manual refresh error:', err);
                      } finally {
                        setLoadingOutbreaks(false);
                      }
                    }}
                    disabled={loadingOutbreaks}
                    style={{
                      padding: '6px 10px',
                      background: loadingOutbreaks ? 'var(--bg-dark)' : 'var(--accent-green)',
                      color: loadingOutbreaks ? 'var(--text-secondary)' : '#fff',
                      border: 'none',
                      borderRadius: 3,
                      cursor: loadingOutbreaks ? 'default' : 'pointer',
                      fontSize: 10,
                      fontWeight: 600,
                      opacity: loadingOutbreaks ? 0.6 : 1
                    }}
                  >
                    {loadingOutbreaks ? '⏳ Laster...' : '🔄 Oppdater nå'}
                  </button>
                  <span style={{ fontSize: 10, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {realOutbreaks.length} utbrudd
                  </span>
                </div>
              </div>

              {/* Outbreak Statistics */}
              {outbreakStats && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
                  <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 12, textAlign: 'center' }}>
                    <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', margin: 0, marginBottom: 8, textTransform: 'uppercase' }}>
                      Totalt
                    </p>
                    <p style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent-gold)', margin: 0 }}>
                      {outbreakStats.total}
                    </p>
                  </div>
                  <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 12, textAlign: 'center' }}>
                    <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', margin: 0, marginBottom: 8, textTransform: 'uppercase' }}>
                      Aktive
                    </p>
                    <p style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent-red)', margin: 0 }}>
                      {outbreakStats.activeCount}
                    </p>
                  </div>
                  <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 12, textAlign: 'center' }}>
                    <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', margin: 0, marginBottom: 8, textTransform: 'uppercase' }}>
                      ISA
                    </p>
                    <p style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent-red)', margin: 0 }}>
                      {outbreakStats.byDisease['Infectious Salmon Anaemia'] || 0}
                    </p>
                  </div>
                  <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 12, textAlign: 'center' }}>
                    <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', margin: 0, marginBottom: 8, textTransform: 'uppercase' }}>
                      PD
                    </p>
                    <p style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent-orange)', margin: 0 }}>
                      {outbreakStats.byDisease['Pancreatic Disease'] || 0}
                    </p>
                  </div>
                </div>
              )}

              {/* Real Outbreak List */}
              {realOutbreaks.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 10 }}>
                  {realOutbreaks.slice(0, 50).map((outbreak, idx) => (
                    <div 
                      key={outbreak.id || idx} 
                      style={{ 
                        background: outbreak.severity === 'kritisk' ? 'rgba(220, 38, 38, 0.1)' : 
                                   outbreak.severity === 'høy' ? 'rgba(251, 146, 60, 0.1)' :
                                   outbreak.severity === 'moderat' ? 'rgba(250, 204, 21, 0.1)' :
                                   'rgba(34, 197, 94, 0.1)',
                        border: outbreak.severity === 'kritisk' ? '1px solid var(--accent-red)' :
                               outbreak.severity === 'høy' ? '1px solid var(--accent-orange)' :
                               outbreak.severity === 'moderat' ? '1px solid var(--accent-gold)' :
                               '1px solid var(--accent-green)',
                        borderRadius: 6, 
                        padding: 12
                      }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12 }}>
                        <div>
                          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                            {outbreak.diseaseName} ({outbreak.diseaseCode})
                          </p>
                          <p style={{ margin: '4px 0 0 0', fontSize: 11, color: 'var(--text-secondary)' }}>
                            Anlegg: {outbreak.facilityName || `#${outbreak.localityNo}`}
                          </p>
                          <p style={{ margin: '2px 0 0 0', fontSize: 10, color: 'var(--text-secondary)' }}>
                            Status: {outbreak.status === 'active' ? '🔴 Aktiv' : '✓ Avsluttet'} 
                            {outbreak.startDate && ` • Start: ${new Date(outbreak.startDate).toLocaleDateString('no-NO')}`}
                          </p>
                          {outbreak.location && (
                            <p style={{ margin: '2px 0 0 0', fontSize: 10, color: 'var(--text-secondary)' }}>
                              📍 Lokasjon: {outbreak.location.lat?.toFixed(2)}, {outbreak.location.lng?.toFixed(2)}
                            </p>
                          )}
                        </div>
                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                          <span style={{ 
                            padding: '4px 8px',
                            background: outbreak.severity === 'kritisk' ? 'var(--accent-red)' :
                                       outbreak.severity === 'høy' ? 'var(--accent-orange)' :
                                       outbreak.severity === 'moderat' ? 'var(--accent-gold)' :
                                       'var(--accent-green)',
                            color: '#fff',
                            borderRadius: 3,
                            fontSize: 10,
                            fontWeight: 600,
                            whiteSpace: 'nowrap'
                          }}>
                            {outbreak.severity?.toUpperCase() || 'UKJENT'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ 
                  background: 'var(--bg-elevated)', 
                  border: '1px dashed var(--border-color)',
                  borderRadius: 6,
                  padding: 20,
                  textAlign: 'center',
                  color: 'var(--text-secondary)'
                }}>
                  <p style={{ margin: 0, fontSize: 12 }}>
                    📡 Laster outbreak data fra BarentsWatch Fishhealth API...
                  </p>
                  <p style={{ margin: '4px 0 0 0', fontSize: 10, color: 'var(--text-secondary)' }}>
                    Hvis denne meldingen vedvarer, sjekk browser-konsollen for feil
                  </p>
                </div>
              )}
            </div>
          )}

          {/* REGIONS TAB */}
          {activeTab === 'regions' && (

            <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '12px 16px' }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-orange)', margin: '0 0 8px 0', paddingBottom: 6, borderBottom: '2px solid var(--accent-orange)' }}>
                🗺️ Regioner
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                {regions.map(region => {
                  const regionFarms = farms.filter(f => f.region === region);
                  const regionCritical = regionFarms.filter(f => f.riskScore > 60).length;
                  const regionWarning = regionFarms.filter(f => f.riskScore > 40 && f.riskScore <= 60).length;
                  const regionAvgRisk = regionFarms.length > 0 ? Math.round(regionFarms.reduce((sum, f) => sum + f.riskScore, 0) / regionFarms.length) : 0;
                  return (
                    <div key={region} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 12 }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--accent-gold)', marginBottom: 10 }}>
                        {region}
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11 }}>
                        <div>
                          <p style={{ margin: 0, fontSize: 9, color: 'var(--text-secondary)', marginBottom: 2 }}>Anlegg</p>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                            {regionFarms.length}
                          </p>
                        </div>
                        <div>
                          <p style={{ margin: 0, fontSize: 9, color: 'var(--text-secondary)', marginBottom: 2 }}>Kritisk</p>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--accent-red)' }}>
                            {regionCritical}
                          </p>
                        </div>
                        <div>
                          <p style={{ margin: 0, fontSize: 9, color: 'var(--text-secondary)', marginBottom: 2 }}>Advarsel</p>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--accent-orange)' }}>
                            {regionWarning}
                          </p>
                        </div>
                        <div>
                          <p style={{ margin: 0, fontSize: 9, color: 'var(--text-secondary)', marginBottom: 2 }}>Gj.snitt</p>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--accent-gold)' }}>
                            {regionAvgRisk}%
                          </p>
                        </div>
                      </div>
                    </div>
                  )})}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
