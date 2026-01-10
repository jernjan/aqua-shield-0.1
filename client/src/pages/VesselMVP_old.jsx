import { useEffect, useState } from 'react';
import Tooltip from '../components/Tooltip';
import VesselChecklist from '../components/VesselChecklist';
import QuarantineCalendar from '../components/QuarantineCalendar';
import { generateICSFromQuarantine } from '../lib/ics';
import { findOverlappingQuarantine, formatOverlapWarning } from '../lib/overlapDetection';
import styles from './Dashboard.module.css';

export default function VesselMVP({ token, currentUser }) {
  const [vessels, setVessels] = useState([]);
  const [selectedVessel, setSelectedVessel] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [disinfections, setDisinfections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('name');
  const [qStart, setQStart] = useState('');
  const [qDuration, setQDuration] = useState(7);
  const [dDate, setDDate] = useState('');
  const [dChemical, setDChemical] = useState('');
  const [dOperator, setDOperator] = useState('');
  const [dComment, setDComment] = useState('');
  
  const overlapWarning = qStart && qDuration ? (() => {
    const due = new Date(qStart);
    due.setDate(due.getDate() + Number(qDuration));
    const overlaps = findOverlappingQuarantine(qStart, due.toISOString(), tasks);
    return overlaps.length > 0 ? formatOverlapWarning(overlaps) : null;
  })() : null;

  const exportICS = () => {
    if (!selectedVessel) return;
    const ics = generateICSFromQuarantine(tasks, selectedVessel.name);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `karantene-${selectedVessel.name}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    const url = currentUser?.id ? `/api/mvp/vessel?userId=${encodeURIComponent(currentUser.id)}` : '/api/mvp/vessel'
    fetch(url)
      .then(r => r.json())
      .then(data => {
        const sortedVessels = [...data.vessels].sort((a, b) => {
          if (sortBy === 'name') return a.name.localeCompare(b.name);
          if (sortBy === 'recent') return new Date(b.lastPosition.timestamp) - new Date(a.lastPosition.timestamp);
          return 0;
        });
        setVessels(sortedVessels);
        if (sortedVessels.length > 0) {
          setSelectedVessel(sortedVessels[0]);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch vessels', err);
        setLoading(false);
      });
  }, [sortBy]);

  useEffect(() => {
    if (!selectedVessel) return;
    fetch(`/api/mvp/vessel/${selectedVessel.id}/tasks`)
      .then(r => r.json())
      .then(data => setTasks(data.tasks || []))
      .catch(err => console.error('Failed to fetch vessel tasks', err));
    
    fetch(`/api/mvp/vessel/${selectedVessel.id}/disinfections`)
      .then(r => r.json())
      .then(data => setDisinfections(data.disinfections || []))
      .catch(err => console.error('Failed to fetch disinfections', err));
  }, [selectedVessel]);

  const addDemoTask = async () => {
    if (!selectedVessel) return;
    try {
      const res = await fetch(`/api/mvp/vessel/${selectedVessel.id}/task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'vedlikehold', name: 'Planlagt vedlikehold' }),
      });
      const data = await res.json();
      if (data && data.task) setTasks(prev => [data.task, ...prev]);
    } catch (err) {
      console.error('Failed to add task', err);
    }
  };

  const addQuarantine = async () => {
    if (!selectedVessel || !qStart || !qDuration) return;
    try {
      const due = new Date(qStart);
      due.setDate(due.getDate() + Number(qDuration));
      const res = await fetch(`/api/mvp/vessel/${selectedVessel.id}/task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'karantene', name: 'Planlagt karantene', dueDate: due.toISOString(), duration: Number(qDuration) }),
      });
      const data = await res.json();
      if (data && data.task) setTasks(prev => [data.task, ...prev]);
      setQStart('');
      setQDuration(7);
    } catch (err) {
      console.error('Failed to add quarantine task', err);
    }
  };

  const toggleTaskComplete = async (taskId, done) => {
    if (!selectedVessel) return;
    try {
      const res = await fetch(`/api/mvp/vessel/${selectedVessel.id}/task/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: done ? 'fullført' : 'planned' }),
      });
      const data = await res.json();
      if (data && data.task) {
        setTasks(prev => prev.map(t => t.id === taskId ? data.task : t));
      }
    } catch (err) {
      console.error('Failed to update task status', err);
    }
  };

  const addDisinfection = async () => {
    if (!selectedVessel || !dDate || !dChemical || !dOperator) return;
    try {
      const res = await fetch(`/api/mvp/vessel/${selectedVessel.id}/disinfection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          date: dDate, 
          chemical: dChemical, 
          operator: dOperator,
          comment: dComment,
          reportedBy: currentUser?.id || 'unknown'
        }),
      });
      const data = await res.json();
      if (data && data.disinfection) {
        setDisinfections(prev => [data.disinfection, ...prev]);
        setDDate('');
        setDChemical('');
        setDOperator('');
        setDComment('');
      }
    } catch (err) {
      console.error('Failed to add disinfection', err);
    }
  };

  if (loading) return <div className={styles.container}>Laster båter...</div>;

  const expiredCerts = vessels.filter(v => 
    v.certificates.some(c => new Date(c.expires) < new Date())
  ).length;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>BRØNNBÅT</h1>
                <h4 style={{ fontSize: 13, marginTop: 20, marginBottom: 12, color: 'var(--accent-gold)', fontWeight: 600 }}>
                  Planlagte tiltak / oppgaver
                </h4>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                  <button onClick={addDemoTask} style={{ padding: '6px 10px', background: 'var(--accent-gold)', color: '#111', border: 'none', borderRadius: 3, fontSize: 12, cursor: 'pointer' }}>+ Legg til demo-oppgave</button>
                </div>
                {tasks.length === 0 ? (
                  <div style={{ color: 'var(--text-secondary)', fontSize: 12, padding: 10 }}>
                    Ingen oppgaver registrert for denne båten
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {tasks.map((t) => (
                      <div key={t.id} style={{ padding: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 3, fontSize: 12 }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>{t.name}
                          <span style={{ marginLeft: 8, color: 'var(--accent-gold)', fontSize: 11 }}>({t.type})</span>
                        </div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>
                          Frist: {new Date(t.dueDate).toLocaleDateString('no-NO')} • Varighet: {t.duration} dager
                        </div>
                        {t.chemicals && t.chemicals.length > 0 && (
                          <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>
                            Kjemikalier: {t.chemicals.join(', ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <h4 style={{ fontSize: 13, marginTop: 20, marginBottom: 12, color: 'var(--accent-gold)', fontWeight: 600 }}>
                  Sjekkliste
                </h4>
                <VesselChecklist tasks={tasks} onToggleComplete={toggleTaskComplete} />

                <h4 style={{ fontSize: 13, marginTop: 20, marginBottom: 12, color: 'var(--accent-gold)', fontWeight: 600 }}>
                  Karantene-kalender
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <QuarantineCalendar tasks={tasks} />
                  </div>
                  <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 4, padding: 12 }}>
                    <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8 }}>Planlegg karantene</div>
                    {overlapWarning && (
                      <div style={{ marginBottom: 8, padding: 8, border: '1px solid var(--accent-orange)', background: 'rgba(255, 107, 53, 0.1)', borderRadius: 3, fontSize: 11 }}>
                        <div style={{ fontWeight: 600, color: 'var(--accent-orange)', marginBottom: 4 }}>{overlapWarning.title}</div>
                        {overlapWarning.ranges.map((r, i) => (
                          <div key={i} style={{ color: 'var(--text-secondary)', marginBottom: 2 }}>
                            {r}
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, alignItems: 'end' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Startdato</label>
                        <input type="date" value={qStart} onChange={(e) => setQStart(e.target.value)} style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: 3, color: 'var(--text-primary)', fontSize: 12 }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Varighet (dager)</label>
                        <input type="number" min="1" value={qDuration} onChange={(e) => setQDuration(e.target.value)} style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: 3, color: 'var(--text-primary)', fontSize: 12 }} />
                      </div>
                      <div style={{ gridColumn: '1 / span 2', display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                        <button onClick={addQuarantine} style={{ padding: '6px 10px', background: 'var(--accent-gold)', color: '#111', border: 'none', borderRadius: 3, fontSize: 12, cursor: 'pointer' }}>+ Legg til karantene</button>
                        <button onClick={exportICS} style={{ padding: '6px 10px', background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 3, fontSize: 12, cursor: 'pointer' }}>Eksporter kalender (.ics)</button>
                      </div>
                    </div>
                  </div>
                </div>

                <h4 style={{ fontSize: 13, marginTop: 20, marginBottom: 12, color: 'var(--accent-gold)', fontWeight: 600 }}>
                  Desinfeksjon
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 4, padding: 12 }}>
                    <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 12 }}>Rapporter desinfeksjon</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Desinfeksjonsdato</label>
                        <input type="date" value={dDate} onChange={(e) => setDDate(e.target.value)} style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: 3, color: 'var(--text-primary)', fontSize: 12 }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Desinfeksjonsmiddel</label>
                        <input type="text" value={dChemical} onChange={(e) => setDChemical(e.target.value)} placeholder="f.eks. Iodine 500ppm" style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: 3, color: 'var(--text-primary)', fontSize: 12 }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Utført av</label>
                        <input type="text" value={dOperator} onChange={(e) => setDOperator(e.target.value)} placeholder="Navn på operator/firma" style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: 3, color: 'var(--text-primary)', fontSize: 12 }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Kommentar</label>
                        <textarea value={dComment} onChange={(e) => setDComment(e.target.value)} placeholder="F.eks. område, varighet, observasjoner..." style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: 3, color: 'var(--text-primary)', fontSize: 12, fontFamily: 'monospace', minHeight: 60 }} />
                      </div>
                      <button onClick={addDisinfection} style={{ padding: '8px 10px', background: 'var(--accent-gold)', color: '#111', border: 'none', borderRadius: 3, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>+ Rapporter desinfeksjon</button>
                    </div>
                  </div>
                  <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 4, padding: 12 }}>
                    <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 12 }}>Desinfeksjon-historikk</div>
                    {disinfections.length === 0 ? (
                      <div style={{ color: 'var(--text-secondary)', fontSize: 12, padding: 10 }}>
                        Ingen desinfeksjoner registrert
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 400, overflowY: 'auto' }}>
                        {disinfections.map((d) => (
                          <div key={d.id} style={{ padding: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 3, fontSize: 11 }}>
                            <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--accent-gold)' }}>
                              {new Date(d.date).toLocaleDateString('no-NO')}
                            </div>
                            <div style={{ marginBottom: 4 }}>
                              <span style={{ color: 'var(--text-secondary)' }}>Middel:</span> {d.chemical}
                            </div>
                            <div style={{ marginBottom: 4 }}>
                              <span style={{ color: 'var(--text-secondary)' }}>Operator:</span> {d.operator}
                            </div>
                            {d.comment && (
                              <div style={{ marginBottom: 4, color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: 10 }}>
                                {d.comment}
                              </div>
                            )}
                            <div style={{ color: 'var(--text-secondary)', fontSize: 10 }}>
                              Rapportert av {d.reportedBy} {d.reportedAt ? '• ' + new Date(d.reportedAt).toLocaleDateString('no-NO') : ''}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

          <p className={styles.subtitle}>Transportbåter - Posisjoner, last og compliance</p>
        </div>
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Flåte</span>
            <span className={styles.statValue}>{vessels.length}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Utgåtte sertifikater</span>
            <span className={`${styles.statValue} ${expiredCerts > 0 ? styles.critical : ''}`}>
              {expiredCerts}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.sidebar}>
          <div style={{ marginBottom: 12 }}>
            <h3 className={styles.sidebarTitle}>BÅTER ({vessels.length})</h3>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 10 }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Sorter etter:</label>
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  background: 'var(--bg-dark)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '3px',
                  color: 'var(--text-primary)',
                  fontSize: '11px',
                }}
              >
                <option value="name">Navn</option>
                <option value="recent">Sist oppdatert</option>
              </select>
            </div>
          </div>
          
          <div className={styles.list}>
            {vessels.map(vessel => (
              <button
                key={vessel.id}
                onClick={() => setSelectedVessel(vessel)}
                className={`${styles.listItem} ${selectedVessel?.id === vessel.id ? styles.active : ''}`}
              >
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{vessel.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>
                  MMSI: {vessel.mmsi}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                  {vessel.type}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.main}>
          {selectedVessel && (
            <>
              <div className={styles.detail}>
                <div className={styles.detailTitle}>{selectedVessel.name}</div>
                
                <div className={styles.grid}>
                  <div className={styles.card}>
                    <span className={styles.cardLabel}>
                      <Tooltip text="Maritime Mobile Service Identity">MMSI</Tooltip>
                    </span>
                    <span className={styles.cardValue} style={{ fontFamily: 'monospace', fontSize: 13 }}>
                      {selectedVessel.mmsi}
                    </span>
                  </div>

                  <div className={styles.card}>
                    <span className={styles.cardLabel}>
                      <Tooltip text="Internasjonalt skip-identifikasjonsnummer">IMO</Tooltip>
                    </span>
                    <span className={styles.cardValue} style={{ fontFamily: 'monospace', fontSize: 13 }}>
                      {selectedVessel.imoNumber}
                    </span>
                  </div>

                  <div className={styles.card}>
                    <span className={styles.cardLabel}>
                      <Tooltip text="Kallsignal for radiokommunikasjon">Kallsignal</Tooltip>
                    </span>
                    <span className={styles.cardValue} style={{ fontFamily: 'monospace', fontSize: 13 }}>
                      {selectedVessel.callSign}
                    </span>
                  </div>

                  <div className={styles.card}>
                    <span className={styles.cardLabel}>
                      <Tooltip text="Type transportbåt">Type</Tooltip>
                    </span>
                    <span className={styles.cardValue}>{selectedVessel.type}</span>
                  </div>

                  <div className={styles.card}>
                    <span className={styles.cardLabel}>
                      <Tooltip text="Båtens eier">Rederiet</Tooltip>
                    </span>
                    <span className={styles.cardValue}>{selectedVessel.owner}</span>
                  </div>

                  <div className={styles.card}>
                    <span className={styles.cardLabel}>
                      <Tooltip text="Ansvarlig kaptein">Kaptein</Tooltip>
                    </span>
                    <span className={styles.cardValue}>{selectedVessel.captain}</span>
                  </div>

                  <div className={styles.card}>
                    <span className={styles.cardLabel}>
                      <Tooltip text="Siste kjent posisjon">Posisjon</Tooltip>
                    </span>
                    <span className={styles.cardValue} style={{ fontSize: 12 }}>
                      {selectedVessel.lastPosition.lat.toFixed(2)}°N / {selectedVessel.lastPosition.lng.toFixed(2)}°E
                    </span>
                  </div>

                  <div className={styles.card}>
                    <span className={styles.cardLabel}>
                      <Tooltip text="Når posisjonen sist ble oppdatert">Oppdatert</Tooltip>
                    </span>
                    <span className={styles.cardValue} style={{ fontSize: 11 }}>
                      {new Date(selectedVessel.lastPosition.timestamp).toLocaleDateString('no-NO')}
                    </span>
                  </div>

                  <div className={styles.card}>
                    <span className={styles.cardLabel}>
                      <Tooltip text="Type last i hold">Last</Tooltip>
                    </span>
                    <span className={styles.cardValue}>{selectedVessel.cargo.type}</span>
                  </div>

                  <div className={styles.card}>
                    <span className={styles.cardLabel}>
                      <Tooltip text="Mengde last">Antall tonn</Tooltip>
                    </span>
                    <span className={styles.cardValue}>{selectedVessel.cargo.quantity}</span>
                  </div>

                  <div className={styles.card}>
                    <span className={styles.cardLabel}>
                      <Tooltip text="Dokumentasjonsstatus">Status</Tooltip>
                    </span>
                    <span className={`${styles.cardValue} ${
                      selectedVessel.documentationStatus === 'godkjent' ? '' : 
                      selectedVessel.documentationStatus === 'utløpt' ? styles.warning : ''
                    }`}>
                      {selectedVessel.documentationStatus}
                    </span>
                  </div>

                  <div className={styles.card}>
                    <span className={styles.cardLabel}>
                      <Tooltip text="Antall dokumenterte fangster">Fangster</Tooltip>
                    </span>
                    <span className={styles.cardValue}>{selectedVessel.catches}</span>
                  </div>
                </div>

                <h4 style={{ fontSize: 13, marginTop: 20, marginBottom: 12, color: 'var(--accent-gold)', fontWeight: 600 }}>
                  Sertifikater
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {selectedVessel.certificates.map((cert, idx) => (
                    <div 
                      key={idx}
                      style={{
                        padding: 10,
                        background: 'var(--bg-elevated)',
                        border: `1px solid ${new Date(cert.expires) < new Date() ? 'var(--accent-red)' : 'var(--border-color)'}`,
                        borderRadius: 3,
                        fontSize: 12,
                      }}
                    >
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>
                        {cert.type}
                        {new Date(cert.expires) < new Date() && (
                          <span style={{ marginLeft: 8, color: 'var(--accent-red)', fontSize: 11 }}>⚠️ UTGÅTT</span>
                        )}
                      </div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>
                        Utløper: {new Date(cert.expires).toLocaleDateString('no-NO')}
                      </div>
                    </div>
                  ))}
                </div>

                <h4 style={{ fontSize: 13, marginTop: 20, marginBottom: 12, color: 'var(--accent-gold)', fontWeight: 600 }}>
                  Risikoflater
                </h4>
                {selectedVessel.riskZonesEntered.length === 0 ? (
                  <div style={{ color: 'var(--text-secondary)', fontSize: 12, padding: 10 }}>
                    Ingen risikosoner besøkt
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {selectedVessel.riskZonesEntered.map((zone, idx) => (
                      <div 
                        key={idx}
                        style={{
                          padding: 10,
                          background: 'var(--bg-elevated)',
                          border: `1px solid ${
                            zone.riskLevel === 'høy oppmerksomhet' ? 'var(--accent-orange)' :
                            zone.riskLevel === 'moderat' ? 'var(--accent-gold)' :
                            'var(--border-color)'
                          }`,
                          borderLeft: `3px solid ${
                            zone.riskLevel === 'høy oppmerksomhet' ? 'var(--accent-orange)' :
                            zone.riskLevel === 'moderat' ? 'var(--accent-gold)' :
                            'var(--accent-green)'
                          }`,
                          borderRadius: 3,
                          fontSize: 12,
                        }}
                      >
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>
                          {zone.zone}
                          <span style={{ marginLeft: 8, color: 'var(--accent-gold)', fontSize: 11 }}>
                            {zone.riskLevel}
                          </span>
                        </div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginBottom: 2 }}>
                          {zone.distance} km away
                        </div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>
                          {new Date(zone.timestamp).toLocaleDateString('no-NO')} — {zone.status}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <h4 style={{ fontSize: 13, marginTop: 20, marginBottom: 12, color: 'var(--accent-gold)', fontWeight: 600 }}>
                  Compliance-handlinger
                </h4>
                {selectedVessel.complianceActions.length === 0 ? (
                  <div style={{ color: 'var(--text-secondary)', fontSize: 12, padding: 10 }}>
                    Ingen handlinger registrert
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {selectedVessel.complianceActions.map((action, idx) => (
                      <div 
                        key={idx}
                        style={{
                          padding: 10,
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--border-color)',
                          borderLeft: action.verified ? '3px solid var(--accent-green)' : '3px solid var(--accent-gold)',
                          borderRadius: 3,
                          fontSize: 12,
                        }}
                      >
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>
                          {action.action}
                          {action.verified && (
                            <span style={{ marginLeft: 8, color: 'var(--accent-green)', fontSize: 11 }}>✓ VERIFISERT</span>
                          )}
                        </div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginBottom: 2 }}>
                          {action.location}
                        </div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>
                          {new Date(action.date).toLocaleDateString('no-NO')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
