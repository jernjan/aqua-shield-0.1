import { useEffect, useState } from 'react';
import { severityCompare } from '../lib/riskTerms';

export default function FarmerMVP({ token, currentUser }) {
  const [farms, setFarms] = useState([]);
  const [selectedFarm, setSelectedFarm] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [visitingVessels, setVisitingVessels] = useState([]);
  const [activeQuarantines, setActiveQuarantines] = useState([]);
  const [diseaseRisks, setDiseaseRisks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandAllDiseases, setExpandAllDiseases] = useState(false);

  useEffect(() => {
    fetch('/api/mvp/farmer')
      .then(r => r.json())
      .then(data => {
        setFarms(data.farms || []);
        if (data.farms?.length > 0) setSelectedFarm(data.farms[0]);
        setLoading(false);
      })
      .catch(err => { console.error(err); setLoading(false); });
  }, []);

  useEffect(() => {
    if (!selectedFarm) return;
    Promise.all([
      fetch(`/api/mvp/farmer/${selectedFarm.id}`).then(r => r.json()),
      fetch(`/api/mvp/farm/${selectedFarm.id}/visiting-vessels`).then(r => r.json()),
      fetch(`/api/mvp/admin/quarantines`).then(r => r.json()),
      fetch(`/api/mvp/farm/${selectedFarm.id}/disease-risks`).then(r => r.json()),
    ]).then(([a, v, q, d]) => {
      setAlerts(a.alerts || []);
      setVisitingVessels(v.visitingVessels || []);
      setActiveQuarantines(q.quarantines || []);
      setDiseaseRisks(d.risks || []);
    }).catch(err => console.error(err));
  }, [selectedFarm]);

  const sortedAlerts = [...alerts].sort((a, b) => severityCompare(a.severity, b.severity));

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>Laster...</div>;

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-dark)' }}>
      {/* LEFT SIDEBAR */}
      <div style={{ width: '200px', background: 'var(--bg-surface)', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div style={{ padding: '12px', borderBottom: '1px solid var(--border-color)' }}>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 6 }}>
            ANLEGG ({farms.length})
          </p>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {farms.map(farm => (
            <div
              key={farm.id}
              onClick={() => setSelectedFarm(farm)}
              style={{
                padding: '10px',
                borderBottom: '1px solid var(--border-color)',
                cursor: 'pointer',
                background: selectedFarm?.id === farm.id ? 'rgba(212, 165, 116, 0.2)' : 'transparent',
                borderLeft: selectedFarm?.id === farm.id ? '3px solid var(--accent-gold)' : '3px solid transparent',
                transition: 'all 0.1s'
              }}
              onMouseEnter={(e) => { if (selectedFarm?.id !== farm.id) e.currentTarget.style.background = 'var(--bg-elevated)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = selectedFarm?.id === farm.id ? 'rgba(212, 165, 116, 0.2)' : 'transparent'; }}
            >
              <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                {farm.name}
              </p>
              <p style={{ margin: 0, fontSize: 9, color: 'var(--text-secondary)' }}>
                {farm.region}
              </p>
              <p style={{ margin: 0, fontSize: 10, fontWeight: 600, color: farm.riskScore > 60 ? 'var(--accent-red)' : farm.riskScore > 40 ? 'var(--accent-orange)' : 'var(--accent-green)' }}>
                {farm.riskScore}%
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT MAIN CONTENT */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        {/* HEADER */}
        <div style={{ background: 'var(--bg-dark)', padding: '10px 16px', borderBottom: '1px solid var(--accent-gold)', position: 'sticky', top: 0, zIndex: 100 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--accent-gold)' }}>
            {selectedFarm?.name || 'Velg anlegg'}
          </h1>
          <p style={{ margin: '2px 0 0 0', fontSize: 11, color: 'var(--text-secondary)' }}>
            {selectedFarm?.region || ''}
          </p>
        </div>

        {/* CONTENT */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          {selectedFarm ? (
            <div style={{ maxWidth: 'none' }}>
              {/* RISK CARDS - 4 columns */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 5, padding: 10, textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: 9, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 }}>Risiko</p>
                  <p style={{ margin: 0, fontSize: 28, fontWeight: 700, color: selectedFarm?.riskScore > 60 ? 'var(--accent-red)' : 'var(--accent-orange)' }}>
                    {selectedFarm?.riskScore || 0}%
                  </p>
                </div>
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 5, padding: 10, textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: 9, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 }}>Varsler</p>
                  <p style={{ margin: 0, fontSize: 28, fontWeight: 700, color: 'var(--accent-red)' }}>
                    {alerts.length}
                  </p>
                </div>
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 5, padding: 10, textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: 9, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 }}>Sykdom</p>
                  <p style={{ margin: 0, fontSize: 28, fontWeight: 700, color: 'var(--accent-orange)' }}>
                    {diseaseRisks.length}
                  </p>
                </div>
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 5, padding: 10, textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: 9, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 }}>Båter</p>
                  <p style={{ margin: 0, fontSize: 28, fontWeight: 700, color: 'var(--accent-gold)' }}>
                    {visitingVessels.length}
                  </p>
                </div>
              </div>

              {/* VARSLER LISTE */}
              {alerts.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <h3 style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', paddingBottom: 6, borderBottom: '1px solid var(--border-color)', marginBottom: 8 }}>
                    📋 Varsler
                  </h3>
                  <div style={{ display: 'grid', gap: 3, maxHeight: '180px', overflowY: 'auto' }}>
                    {sortedAlerts.slice(0, 10).map((alert, idx) => (
                      <div key={idx} style={{ background: 'var(--bg-surface)', border: `1px solid ${alert.severity === 'risikofylt' ? 'var(--accent-red)' : 'var(--border-color)'}`, borderRadius: 4, padding: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, fontSize: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 10, fontWeight: 600, color: 'var(--text-primary)' }}>{alert.title}</p>
                          <p style={{ margin: 0, fontSize: 9, color: 'var(--text-secondary)' }}>{new Date(alert.timestamp).toLocaleDateString('no-NO')}</p>
                        </div>
                        <div style={{ background: alert.severity === 'risikofylt' ? 'var(--accent-red)' : 'var(--accent-orange)', color: '#fff', padding: '2px 5px', borderRadius: 2, fontSize: 8, fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {alert.severity}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SYKDOMSRISIKO */}
              {diseaseRisks.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid var(--accent-orange)' }}>
                    <h3 style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                      🦠 Sykdomsrisiko
                    </h3>
                    {diseaseRisks.length > 3 && (
                      <button onClick={() => setExpandAllDiseases(!expandAllDiseases)} style={{ background: expandAllDiseases ? 'var(--accent-orange)' : 'var(--bg-elevated)', color: expandAllDiseases ? '#fff' : 'var(--accent-orange)', border: '1px solid var(--accent-orange)', borderRadius: 3, padding: '3px 6px', cursor: 'pointer', fontSize: 10, fontWeight: 600 }}>
                        {expandAllDiseases ? '⇧ Færre' : `⇩ Alle (${diseaseRisks.length})`}
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'grid', gap: 6, maxHeight: '250px', overflowY: 'auto' }}>
                    {(expandAllDiseases ? diseaseRisks : diseaseRisks.slice(0, 3)).map((risk, idx) => (
                      <div key={idx} style={{ background: risk.riskScore > 70 ? 'rgba(220, 38, 38, 0.1)' : 'rgba(251, 146, 60, 0.1)', border: risk.riskScore > 70 ? '1px solid var(--accent-red)' : '1px solid var(--accent-orange)', borderRadius: 5, padding: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 6, gap: 6 }}>
                          <div style={{ flex: 1 }}>
                            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 1 }}>
                              {risk.disease}
                            </p>
                            <p style={{ margin: 0, fontSize: 9, color: 'var(--text-secondary)' }}>
                              {risk.sourceType === 'boat_traffic' ? '🚢' : '🌊'} {risk.source}
                            </p>
                          </div>
                          <div style={{ background: risk.riskScore > 70 ? 'var(--accent-red)' : 'var(--accent-orange)', color: '#fff', padding: '3px 6px', borderRadius: 2, fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {risk.riskScore}%
                          </div>
                        </div>
                        <div style={{ fontSize: 9, color: 'var(--text-secondary)', lineHeight: '1.2' }}>
                          <p style={{ margin: 0 }}>⏱️ {risk.manifestationDaysMin}-{risk.manifestationDaysMax}d</p>
                          <p style={{ margin: 0 }}>💀 {risk.fatality === 'høy' ? 'Høy' : risk.fatality === 'moderat' ? 'Moderat' : 'Lav'} dødlighet</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* BÅTER */}
              {visitingVessels.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <h3 style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', paddingBottom: 6, borderBottom: '1px solid var(--accent-gold)', marginBottom: 8 }}>
                    🚢 Besøkende båter
                  </h3>
                  <div style={{ display: 'grid', gap: 3, maxHeight: '180px', overflowY: 'auto' }}>
                    {visitingVessels.slice(0, 5).map((vessel, idx) => {
                      const days = vessel.dayseSinceDisinfection || 0;
                      const risk = days > 7 || activeQuarantines.some(q => q.vessel_id === vessel.id);
                      return (
                        <div key={idx} style={{ background: risk ? 'rgba(220, 38, 38, 0.08)' : 'var(--bg-surface)', border: risk ? '1px solid var(--accent-red)' : '1px solid var(--border-color)', borderRadius: 4, padding: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                          <div>
                            <p style={{ margin: 0, fontSize: 10, fontWeight: 600, color: 'var(--text-primary)' }}>
                              {vessel.name} {risk && '🚨'}
                            </p>
                            <p style={{ margin: '1px 0 0 0', fontSize: 8, color: 'var(--text-secondary)' }}>{vessel.id}</p>
                          </div>
                          <div style={{ background: days > 7 ? 'rgba(220, 38, 38, 0.2)' : 'rgba(34, 197, 94, 0.2)', color: days > 7 ? 'var(--accent-red)' : 'var(--accent-green)', padding: '3px 5px', borderRadius: 2, fontSize: 9, fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap' }}>
                            {days > 7 ? '⚠️' : '✓'}<br/>{days}d
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)', textAlign: 'center' }}>
              👈 Velg et anlegg fra listen
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
