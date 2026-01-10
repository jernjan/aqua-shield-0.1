import { useEffect, useState } from 'react';
import QuarantineCalendar from '../components/QuarantineCalendar';
import { generateICSFromQuarantine } from '../lib/ics';

export default function VesselMVP({ token, currentUser }) {
  const [vessels, setVessels] = useState([]);
  const [selectedVessel, setSelectedVessel] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [disinfections, setDisinfections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [qStart, setQStart] = useState('');
  const [qDuration, setQDuration] = useState(7);
  const [dDate, setDDate] = useState('');
  const [dChemical, setDChemical] = useState('');
  const [dOperator, setDOperator] = useState('');
  const [dComment, setDComment] = useState('');

  // Load all vessels
  useEffect(() => {
    // Mock data for vessels
    const mockVessels = [
      { id: 1, name: 'MV Nordlys', mmsi: '123456789', type: 'Service Vessel', status: 'Active' },
      { id: 2, name: 'MV Atlantica', mmsi: '987654321', type: 'Transport', status: 'Active' },
    ];

    setVessels(mockVessels);
    setSelectedVessel(mockVessels[0]);
    setLoading(false);
  }, [currentUser?.id]);

  // Load selected vessel's tasks and disinfections
  useEffect(() => {
    if (!selectedVessel) return;
    
    // Mock data for tasks and disinfections
    const mockTasks = [
      { id: 1, type: 'karantene', name: 'Planlagt karantene', dueDate: new Date(Date.now() + 7*24*60*60*1000).toISOString(), duration: 7 },
    ];
    
    const mockDisinfections = [
      { id: 1, date: new Date().toISOString(), chemical: 'Sodium hypochlorite', operator: 'John Doe', comment: 'Routine disinfection' },
    ];

    setTasks(mockTasks);
    setDisinfections(mockDisinfections);
  }, [selectedVessel]);

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
      if (data?.task) setTasks(prev => [data.task, ...prev]);
      setQStart('');
      setQDuration(7);
    } catch (err) {
      console.error('Failed to add quarantine', err);
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
      if (data?.disinfection) {
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

  const toggleTaskComplete = async (taskId, currentStatus) => {
    if (!selectedVessel) return;
    try {
      const res = await fetch(`/api/mvp/vessel/${selectedVessel.id}/task/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: currentStatus === 'fullført' ? 'planned' : 'fullført' }),
      });
      const data = await res.json();
      if (data?.task) {
        setTasks(prev => prev.map(t => t.id === taskId ? data.task : t));
      }
    } catch (err) {
      console.error('Failed to update task', err);
    }
  };

  if (loading) return <div style={{ padding: 20, color: 'var(--text-secondary)' }}>Laster båter...</div>;

  // Portfolio stats
  const expiredCerts = vessels.filter(v => 
    v.certificates?.some(c => new Date(c.expires) < new Date())
  ).length;
  const filteredVessels = vessels.filter(v => 
    v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (v.mmsi && v.mmsi.includes(searchQuery))
  );

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 50px)', background: 'var(--bg-dark)' }}>
      {/* LEFT SIDEBAR */}
      <div style={{ width: 220, background: 'var(--bg-surface)', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        {/* Portfolio Stats Banner */}
        <div style={{ background: 'var(--bg-dark)', padding: '10px', borderBottom: '1px solid var(--border-color)' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Flåte oversikt
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <div style={{ background: 'rgba(220, 38, 38, 0.15)', borderRadius: 3, padding: '6px 8px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 9, color: 'var(--text-secondary)' }}>Utgåtte</p>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--accent-red)' }}>
                {expiredCerts}
              </p>
            </div>
            <div style={{ background: 'rgba(212, 165, 116, 0.15)', borderRadius: 3, padding: '6px 8px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 9, color: 'var(--text-secondary)' }}>Total</p>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--accent-gold)' }}>
                {vessels.length}
              </p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: '10px', borderBottom: '1px solid var(--border-color)' }}>
          <input
            type="text"
            placeholder="Søk båt..."
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
          <p style={{ margin: '4px 0 0 0', fontSize: 9, color: 'var(--text-secondary)' }}>
            {filteredVessels.length} båt{filteredVessels.length !== 1 ? 'er' : ''}
          </p>
        </div>

        {/* Vessels List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredVessels.map(vessel => {
            const hasExpiredCert = vessel.certificates?.some(c => new Date(c.expires) < new Date());
            return (
              <div
                key={vessel.id}
                onClick={() => setSelectedVessel(vessel)}
                style={{
                  padding: '10px',
                  borderBottom: '1px solid var(--border-color)',
                  cursor: 'pointer',
                  background: selectedVessel?.id === vessel.id ? 'rgba(212, 165, 116, 0.2)' : 'transparent',
                  borderLeft: selectedVessel?.id === vessel.id ? '3px solid var(--accent-gold)' : '3px solid transparent',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (selectedVessel?.id !== vessel.id) {
                    e.currentTarget.style.background = 'var(--bg-elevated)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = selectedVessel?.id === vessel.id ? 'rgba(212, 165, 116, 0.2)' : 'transparent';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 4, gap: 6 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {vessel.name}
                    </p>
                    <p style={{ margin: 0, fontSize: 9, color: 'var(--text-secondary)' }}>
                      {vessel.type}
                    </p>
                  </div>
                  {hasExpiredCert && <span style={{ fontSize: 12 }}>🔴</span>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 9 }}>
                  <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 3, padding: '4px 6px' }}>
                    <p style={{ margin: 0, fontSize: 8, color: 'var(--text-secondary)' }}>MMSI</p>
                    <p style={{ margin: 0, fontSize: 10, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                      {vessel.mmsi}
                    </p>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 3, padding: '4px 6px' }}>
                    <p style={{ margin: 0, fontSize: 8, color: 'var(--text-secondary)' }}>Karantene</p>
                    <p style={{ margin: 0, fontSize: 10, fontWeight: 600, color: tasks.filter(t => t.type === 'karantene').length > 0 ? 'var(--accent-orange)' : 'var(--text-secondary)' }}>
                      {tasks.filter(t => t.type === 'karantene').length}
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
            {selectedVessel?.name || 'Velg båt'}
          </h1>
          <p style={{ margin: '2px 0 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
            {selectedVessel?.owner || ''} • {selectedVessel?.type || ''}
          </p>
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 0 }}>
          {selectedVessel ? (
            <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '12px 16px' }}>
              {/* ===== VESSEL INFO CARDS ===== */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 10 }}>
                  <p style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-secondary)', margin: 0, marginBottom: 6, textTransform: 'uppercase' }}>MMSI</p>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-gold)', margin: 0, fontFamily: 'monospace' }}>
                    {selectedVessel.mmsi}
                  </p>
                </div>
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 10 }}>
                  <p style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-secondary)', margin: 0, marginBottom: 6, textTransform: 'uppercase' }}>IMO</p>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-gold)', margin: 0, fontFamily: 'monospace' }}>
                    {selectedVessel.imoNumber}
                  </p>
                </div>
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 10 }}>
                  <p style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-secondary)', margin: 0, marginBottom: 6, textTransform: 'uppercase' }}>Kaptein</p>
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                    {selectedVessel.captain || '-'}
                  </p>
                </div>
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 10 }}>
                  <p style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-secondary)', margin: 0, marginBottom: 6, textTransform: 'uppercase' }}>Posisjon</p>
                  <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent-green)', margin: 0 }}>
                    {selectedVessel.lastPosition?.lat?.toFixed(2)}°N / {selectedVessel.lastPosition?.lng?.toFixed(2)}°E
                  </p>
                </div>
              </div>

              {/* ===== SERTIFIKATER ===== */}
              {selectedVessel.certificates && selectedVessel.certificates.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-red)', margin: '0 0 8px 0', paddingBottom: 6, borderBottom: '2px solid var(--accent-red)' }}>
                    📜 Sertifikater ({selectedVessel.certificates.length})
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                    {selectedVessel.certificates.map((cert, idx) => {
                      const isExpired = new Date(cert.expires) < new Date();
                      const daysLeft = Math.floor((new Date(cert.expires) - new Date()) / (24 * 3600 * 1000));
                      return (
                        <div
                          key={idx}
                          style={{
                            background: isExpired ? 'rgba(220, 38, 38, 0.1)' : daysLeft < 30 ? 'rgba(251, 146, 60, 0.1)' : 'var(--bg-surface)',
                            border: isExpired ? '1.5px solid var(--accent-red)' : daysLeft < 30 ? '1px solid var(--accent-orange)' : '1px solid var(--border-color)',
                            borderRadius: 4,
                            padding: 10
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 4 }}>
                            <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
                              {cert.type}
                            </p>
                            {isExpired && <span style={{ fontSize: 12 }}>🔴</span>}
                            {daysLeft < 30 && daysLeft >= 0 && <span style={{ fontSize: 12 }}>🟠</span>}
                          </div>
                          <p style={{ margin: 0, fontSize: 10, color: 'var(--text-secondary)' }}>
                            {isExpired ? 'UTGÅTT' : `${daysLeft} dager igjen`} • {new Date(cert.expires).toLocaleDateString('no-NO')}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ===== KARANTENE & DESINFEKSJON ===== */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                {/* Karantene-kalender */}
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 10 }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', margin: 0, marginBottom: 8, textTransform: 'uppercase' }}>
                    📅 Karantene-kalender
                  </p>
                  <QuarantineCalendar tasks={tasks} />
                </div>

                {/* Planlegg karantene */}
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 10 }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', margin: 0, marginBottom: 8, textTransform: 'uppercase' }}>
                    ⏰ Planlegg karantene
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 10, color: 'var(--text-secondary)', marginBottom: 3 }}>Startdato</label>
                      <input
                        type="date"
                        value={qStart}
                        onChange={(e) => setQStart(e.target.value)}
                        style={{ width: '100%', padding: '6px 8px', fontSize: 11, background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: 3, color: 'var(--text-primary)', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 10, color: 'var(--text-secondary)', marginBottom: 3 }}>Varighet (dager)</label>
                      <input
                        type="number"
                        min="1"
                        value={qDuration}
                        onChange={(e) => setQDuration(e.target.value)}
                        style={{ width: '100%', padding: '6px 8px', fontSize: 11, background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: 3, color: 'var(--text-primary)', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={addQuarantine}
                        style={{ flex: 1, padding: '6px 10px', background: 'var(--accent-gold)', color: '#111', border: 'none', borderRadius: 3, fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s ease' }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                      >
                        + Legg til
                      </button>
                      <button
                        onClick={exportICS}
                        style={{ flex: 1, padding: '6px 10px', background: 'var(--bg-dark)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 3, fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s ease' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-dark)'}
                      >
                        📥 Eksport
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* ===== KARANTENE OPPGAVER ===== */}
              {tasks.filter(t => t.type === 'karantene').length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-orange)', margin: '0 0 8px 0', paddingBottom: 6, borderBottom: '2px solid var(--accent-orange)' }}>
                    ⏱️ Planlagte karantener ({tasks.filter(t => t.type === 'karantene').length})
                  </h3>
                  <div style={{ display: 'grid', gap: 6, maxHeight: '200px', overflowY: 'auto' }}>
                    {tasks.filter(t => t.type === 'karantene').map(task => (
                      <div
                        key={task.id}
                        style={{
                          background: task.status === 'fullført' ? 'rgba(34, 197, 94, 0.1)' : 'var(--bg-surface)',
                          border: task.status === 'fullført' ? '1px solid var(--accent-green)' : '1px solid var(--border-color)',
                          borderRadius: 4,
                          padding: 8,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                        onClick={() => toggleTaskComplete(task.id, task.status)}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = task.status === 'fullført' ? 'rgba(34, 197, 94, 0.1)' : 'var(--bg-surface)'}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
                              {task.name}
                            </p>
                            <p style={{ margin: '2px 0 0 0', fontSize: 10, color: 'var(--text-secondary)' }}>
                              Frist: {new Date(task.dueDate).toLocaleDateString('no-NO')} • {task.duration} dager
                            </p>
                          </div>
                          <span style={{ fontSize: 14 }}>
                            {task.status === 'fullført' ? '✅' : '⏳'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ===== DESINFEKSJON ===== */}
              <div style={{ marginBottom: 14 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-green)', margin: '0 0 8px 0', paddingBottom: 6, borderBottom: '2px solid var(--accent-green)' }}>
                  🧴 Desinfeksjon
                </h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {/* Rapportformular */}
                  <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 10 }}>
                    <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', margin: 0, marginBottom: 8, textTransform: 'uppercase' }}>
                      Rapporter desinfeksjon
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <input
                        type="date"
                        value={dDate}
                        onChange={(e) => setDDate(e.target.value)}
                        placeholder="Dato"
                        style={{ padding: '6px 8px', fontSize: 11, background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: 3, color: 'var(--text-primary)' }}
                      />
                      <input
                        type="text"
                        value={dChemical}
                        onChange={(e) => setDChemical(e.target.value)}
                        placeholder="Desinfeksjonsmiddel"
                        style={{ padding: '6px 8px', fontSize: 11, background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: 3, color: 'var(--text-primary)' }}
                      />
                      <input
                        type="text"
                        value={dOperator}
                        onChange={(e) => setDOperator(e.target.value)}
                        placeholder="Operator/firma"
                        style={{ padding: '6px 8px', fontSize: 11, background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: 3, color: 'var(--text-primary)' }}
                      />
                      <textarea
                        value={dComment}
                        onChange={(e) => setDComment(e.target.value)}
                        placeholder="Kommentar"
                        style={{ padding: '6px 8px', fontSize: 11, background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: 3, color: 'var(--text-primary)', minHeight: 60, fontFamily: 'monospace' }}
                      />
                      <button
                        onClick={addDisinfection}
                        style={{ padding: '8px 10px', background: 'var(--accent-gold)', color: '#111', border: 'none', borderRadius: 3, fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s ease' }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                      >
                        + Rapporter
                      </button>
                    </div>
                  </div>

                  {/* Historikk */}
                  <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 10 }}>
                    <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', margin: 0, marginBottom: 8, textTransform: 'uppercase' }}>
                      Historikk ({disinfections.length})
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '300px', overflowY: 'auto' }}>
                      {disinfections.length === 0 ? (
                        <p style={{ fontSize: 10, color: 'var(--text-secondary)', margin: 0 }}>Ingen registrert</p>
                      ) : (
                        disinfections.map(d => (
                          <div
                            key={d.id}
                            style={{
                              background: 'rgba(34, 197, 94, 0.1)',
                              border: '1px solid var(--accent-green)',
                              borderRadius: 3,
                              padding: 8
                            }}
                          >
                            <p style={{ margin: 0, fontSize: 10, fontWeight: 600, color: 'var(--accent-gold)' }}>
                              ✓ {new Date(d.date).toLocaleDateString('no-NO')}
                            </p>
                            <p style={{ margin: '2px 0 0 0', fontSize: 9, color: 'var(--text-secondary)' }}>
                              {d.chemical} • {d.operator}
                            </p>
                            {d.comment && (
                              <p style={{ margin: '2px 0 0 0', fontSize: 9, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                {d.comment}
                              </p>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ===== RISIKO SONER ===== */}
              {selectedVessel.riskZonesEntered && selectedVessel.riskZonesEntered.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-orange)', margin: '0 0 8px 0', paddingBottom: 6, borderBottom: '2px solid var(--accent-orange)' }}>
                    ⚠️ Besøkt risikosoner ({selectedVessel.riskZonesEntered.length})
                  </h3>
                  <div style={{ display: 'grid', gap: 6, maxHeight: '200px', overflowY: 'auto' }}>
                    {selectedVessel.riskZonesEntered.map((zone, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: zone.riskLevel === 'høy oppmerksomhet' ? 'rgba(251, 146, 60, 0.1)' : 'rgba(212, 165, 116, 0.1)',
                          border: zone.riskLevel === 'høy oppmerksomhet' ? '1px solid var(--accent-orange)' : '1px solid var(--accent-gold)',
                          borderLeft: zone.riskLevel === 'høy oppmerksomhet' ? '3px solid var(--accent-orange)' : '3px solid var(--accent-gold)',
                          borderRadius: 4,
                          padding: 8
                        }}
                      >
                        <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
                          {zone.zone}
                        </p>
                        <p style={{ margin: '2px 0 0 0', fontSize: 10, color: 'var(--text-secondary)' }}>
                          {zone.riskLevel} • {zone.distance} km • {new Date(zone.timestamp).toLocaleDateString('no-NO')}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
              Velg en båt fra listen
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
