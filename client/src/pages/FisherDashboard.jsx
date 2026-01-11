import React, { useState, useEffect } from 'react';
import Toast from '../components/Toast.jsx';
import QuarantineCalendar from '../components/QuarantineCalendar';
import { generateICSFromQuarantine } from '../lib/ics';
import apiClient from '../lib/apiClient';

const FisherDashboard = () => {
  // Fisher selection & zone tracking
  const [fishers, setFishers] = useState([]);
  const [selectedFisher, setSelectedFisher] = useState(null);
  const [zones, setZones] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [zoneAvoidances, setZoneAvoidances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [alert, setAlert] = useState(null);
  const [tab, setTab] = useState('tasks'); // 'tasks', 'avoidances', 'calendar'
  
  // Quarantine form
  const [qStart, setQStart] = useState('');
  const [qDuration, setQDuration] = useState(7);
  
  // Form states for tasks
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskName, setTaskName] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskDuration, setTaskDuration] = useState(7);
  
  // Form states for zone avoidance
  const [showZoneForm, setShowZoneForm] = useState(false);
  const [zoneName, setZoneName] = useState('');
  const [zoneDisease, setZoneDisease] = useState('ILA');
  const [zoneReason, setZoneReason] = useState('');

  // Fetch all fishers
  const fetchFishers = async () => {
    try {
      const response = await apiClient.get('/api/mvp/fisher');
      if (!response.ok) throw new Error('Failed to fetch fishers');
      const data = await response.json();
      setFishers(data);
      if (data.length > 0 && !selectedFisher) {
        setSelectedFisher(data[0]);
      }
    } catch (err) {
      setAlert({ type: 'error', message: `Feil: ${err.message}`, duration: 5000 });
    }
  };

  // Fetch zones
  const fetchZones = async () => {
    try {
      const response = await apiClient.get('/api/disease-zones/all');
      if (!response.ok) throw new Error('Failed to fetch zones');
      const data = await response.json();
      setZones(data.zones || []);
      setStats(data.stats);
    } catch (err) {
      console.warn('Zone fetch warning:', err.message);
    }
  };

  // Load fisher's tasks and zone avoidances
  const loadFisherData = async (fisher) => {
    if (!fisher) return;
    try {
      const [tasksRes, avoidancesRes] = await Promise.all([
        apiClient.get(`/api/mvp/fisher/${fisher.id}/tasks`),
        apiClient.get(`/api/mvp/fisher/${fisher.id}/zone-avoidances`)
      ]);
      
      if (tasksRes.ok) {
        const tasksData = await tasksRes.json();
        setTasks(tasksData.tasks || []);
      }
      if (avoidancesRes.ok) {
        const avoidData = await avoidancesRes.json();
        setZoneAvoidances(avoidData.avoidances || []);
      }
    } catch (err) {
      console.warn('Fisher data load warning:', err.message);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchFishers(), fetchZones()]);
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (selectedFisher) {
      loadFisherData(selectedFisher);
    }
  }, [selectedFisher]);

  // Add task
  const handleAddTask = async () => {
    if (!selectedFisher || !taskName || !taskDueDate) {
      setAlert({ type: 'warning', message: 'Fyll inn alle felt', duration: 3000 });
      return;
    }
    try {
      const response = await apiClient.post(`/api/mvp/fisher/${selectedFisher.id}/task`, {
        name: taskName,
        dueDate: taskDueDate,
        duration: taskDuration,
        type: 'kontroll'
      });
      if (!response.ok) throw new Error('Failed to add task');
      const data = await response.json();
      if (data.task) {
        setTasks(prev => [data.task, ...prev]);
        setTaskName('');
        setTaskDueDate('');
        setTaskDuration(7);
        setShowTaskForm(false);
        setAlert({ type: 'success', message: 'Oppgave lagt til', duration: 3000 });
      }
    } catch (err) {
      setAlert({ type: 'error', message: err.message, duration: 5000 });
    }
  };

  // Toggle task complete
  const handleToggleTask = async (task) => {
    if (!selectedFisher) return;
    try {
      const response = await apiClient.patch(`/api/mvp/fisher/${selectedFisher.id}/task/${task.id}`, {
        completed: !task.completed
      });
      if (!response.ok) throw new Error('Failed to update task');
      const data = await response.json();
      setTasks(prev => prev.map(t => t.id === task.id ? data.task : t));
    } catch (err) {
      setAlert({ type: 'error', message: err.message, duration: 5000 });
    }
  };

  // Record zone avoidance
  const handleRecordZoneAvoidance = async () => {
    if (!selectedFisher || !zoneName || !zoneDisease) {
      setAlert({ type: 'warning', message: 'Fyll inn sone og sykdom', duration: 3000 });
      return;
    }
    try {
      const response = await apiClient.post(`/api/mvp/fisher/${selectedFisher.id}/zone-avoidance`, {
        zoneName,
        disease: zoneDisease,
        reason: zoneReason,
        timestamp: new Date().toISOString()
      });
      if (!response.ok) throw new Error('Failed to record avoidance');
      const data = await response.json();
      if (data.avoidance) {
        setZoneAvoidances(prev => [data.avoidance, ...prev]);
        setZoneName('');
        setZoneDisease('ILA');
        setZoneReason('');
        setShowZoneForm(false);
        setAlert({ type: 'success', message: 'Sone-unngåelse registrert ✅', duration: 3000 });
      }
    } catch (err) {
      setAlert({ type: 'error', message: err.message, duration: 5000 });
    }
  };

  // Add quarantine
  const handleAddQuarantine = async () => {
    if (!selectedFisher || !qStart || !qDuration) {
      setAlert({ type: 'warning', message: 'Fyll inn startdato og varighet', duration: 3000 });
      return;
    }
    try {
      const due = new Date(qStart);
      due.setDate(due.getDate() + Number(qDuration));
      const response = await apiClient.post(`/api/mvp/fisher/${selectedFisher.id}/task`, {
        name: 'Karantene',
        dueDate: due.toISOString(),
        duration: Number(qDuration),
        type: 'karantene'
      });
      if (!response.ok) throw new Error('Failed to add quarantine');
      const data = await response.json();
      if (data.task) {
        setTasks(prev => [data.task, ...prev]);
        setQStart('');
        setQDuration(7);
        setAlert({ type: 'success', message: 'Karantene lagt til', duration: 3000 });
      }
    } catch (err) {
      setAlert({ type: 'error', message: err.message, duration: 5000 });
    }
  };

  // Export calendar
  const exportICS = () => {
    if (!selectedFisher) return;
    const ics = generateICSFromQuarantine(tasks, selectedFisher.name);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `karantene-${selectedFisher.name}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setAlert({ type: 'success', message: 'Kalender eksportert', duration: 3000 });
  };

  return (
    <div style={{ backgroundColor: 'var(--bg-dark)', minHeight: '100vh', padding: 0 }}>
      {alert && <Toast {...alert} onClose={() => setAlert(null)} />}
      
      {/* Header */}
      <div style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)', padding: 16 }}>
        <h1 style={{ margin: '0 0 4px 0', fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
          🎣 Yrkesfisker Tracking
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)' }}>
          Oppgaver, sone-unngåelse og smittezone-data
        </p>
      </div>

      {/* Fisher Selector - Horizontal */}
      <div style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)', padding: '12px 16px', overflowX: 'auto', whiteSpace: 'nowrap' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {fishers.map(fisher => (
            <button
              key={fisher.id}
              onClick={() => setSelectedFisher(fisher)}
              style={{
                padding: '8px 12px',
                borderRadius: 4,
                border: selectedFisher?.id === fisher.id ? '2px solid var(--accent-gold)' : '1px solid var(--border-color)',
                backgroundColor: selectedFisher?.id === fisher.id ? 'rgba(212, 165, 116, 0.15)' : 'var(--bg-dark)',
                color: selectedFisher?.id === fisher.id ? 'var(--accent-gold)' : 'var(--text-primary)',
                cursor: 'pointer',
                flexShrink: 0,
                fontSize: 13,
                fontWeight: 600,
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (selectedFisher?.id !== fisher.id) {
                  e.target.style.borderColor = 'var(--accent-gold)';
                  e.target.style.color = 'var(--accent-gold)';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedFisher?.id !== fisher.id) {
                  e.target.style.borderColor = 'var(--border-color)';
                  e.target.style.color = 'var(--text-primary)';
                }
              }}
            >
              {fisher.name.split(' ')[0]}
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                {fisher.homePort}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      {selectedFisher ? (
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 300px', height: 'calc(100vh - 180px)' }}>
          {/* LEFT: Fisher Info */}
          <div style={{ backgroundColor: 'var(--bg-surface)', borderRight: '1px solid var(--border-color)', padding: 16, overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              📋 Info
            </h3>
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ backgroundColor: 'var(--bg-dark)', padding: 10, borderRadius: 4, borderLeft: '3px solid var(--accent-gold)' }}>
                <p style={{ margin: '0 0 4px 0', fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Navn</p>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{selectedFisher.name}</p>
              </div>
              <div style={{ backgroundColor: 'var(--bg-dark)', padding: 10, borderRadius: 4, borderLeft: '3px solid var(--accent-gold)' }}>
                <p style={{ margin: '0 0 4px 0', fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Lisens</p>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--accent-gold)' }}>{selectedFisher.license}</p>
              </div>
              <div style={{ backgroundColor: 'var(--bg-dark)', padding: 10, borderRadius: 4, borderLeft: '3px solid var(--accent-gold)' }}>
                <p style={{ margin: '0 0 4px 0', fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Port</p>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{selectedFisher.homePort}</p>
              </div>
              <div style={{ backgroundColor: 'var(--bg-dark)', padding: 10, borderRadius: 4, borderLeft: '3px solid var(--accent-gold)' }}>
                <p style={{ margin: '0 0 4px 0', fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Fang</p>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{selectedFisher.catches}kg</p>
              </div>
            </div>
          </div>

          {/* CENTER: Tasks & Calendar */}
          <div style={{ backgroundColor: 'var(--bg-dark)', display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-color)', overflowY: 'auto' }}>
            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)' }}>
              <button
                onClick={() => setTab('tasks')}
                style={{
                  flex: 1,
                  padding: 12,
                  border: 'none',
                  backgroundColor: tab === 'tasks' ? 'var(--bg-dark)' : 'var(--bg-surface)',
                  borderBottom: tab === 'tasks' ? '2px solid var(--accent-gold)' : 'none',
                  color: tab === 'tasks' ? 'var(--accent-gold)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  transition: 'all 0.2s ease',
                }}
              >
                📋 Oppgaver
              </button>
              <button
                onClick={() => setTab('calendar')}
                style={{
                  flex: 1,
                  padding: 12,
                  border: 'none',
                  backgroundColor: tab === 'calendar' ? 'var(--bg-dark)' : 'var(--bg-surface)',
                  borderBottom: tab === 'calendar' ? '2px solid var(--accent-gold)' : 'none',
                  color: tab === 'calendar' ? 'var(--accent-gold)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  transition: 'all 0.2s ease',
                }}
              >
                📅 Karantene
              </button>
            </div>

            {/* Tasks Tab */}
            {tab === 'tasks' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 16, overflowY: 'auto', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Oppgaver ({tasks.length})</h3>
                  <button
                    onClick={() => setShowTaskForm(!showTaskForm)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: 'var(--accent-gold)',
                      color: '#000',
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    + Ny
                  </button>
                </div>

                {/* Add Task Form */}
                {showTaskForm && (
                  <div style={{ backgroundColor: 'var(--bg-surface)', padding: 12, borderRadius: 4, display: 'grid', gap: 8 }}>
                    <input
                      type="text"
                      placeholder="Oppgave"
                      value={taskName}
                      onChange={(e) => setTaskName(e.target.value)}
                      style={{ padding: '8px 10px', borderRadius: 4, border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-dark)', color: 'var(--text-primary)', fontSize: 13 }}
                    />
                    <input
                      type="date"
                      value={taskDueDate}
                      onChange={(e) => setTaskDueDate(e.target.value)}
                      style={{ padding: '8px 10px', borderRadius: 4, border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-dark)', color: 'var(--text-primary)', fontSize: 13 }}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={handleAddTask}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          backgroundColor: 'var(--accent-gold)',
                          color: '#000',
                          border: 'none',
                          borderRadius: 4,
                          cursor: 'pointer',
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        Lagre
                      </button>
                      <button
                        onClick={() => setShowTaskForm(false)}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          backgroundColor: 'var(--border-color)',
                          color: 'var(--text-primary)',
                          border: 'none',
                          borderRadius: 4,
                          cursor: 'pointer',
                          fontSize: 12,
                        }}
                      >
                        Avbryt
                      </button>
                    </div>
                  </div>
                )}

                {/* Tasks List */}
                <div style={{ display: 'grid', gap: 6, overflowY: 'auto' }}>
                  {tasks.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Ingen oppgaver</p>
                  ) : (
                    tasks.map(task => (
                      <button
                        key={task.id}
                        onClick={() => handleToggleTask(task)}
                        style={{
                          padding: 10,
                          borderRadius: 4,
                          border: 'none',
                          backgroundColor: task.completed ? 'var(--bg-success)' : 'var(--bg-surface)',
                          color: task.completed ? 'var(--text-secondary)' : 'var(--text-primary)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          borderLeft: task.completed ? '3px solid var(--text-success)' : '3px solid var(--accent-gold)',
                          textDecoration: task.completed ? 'line-through' : 'none',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                          {task.completed ? '✓' : '○'} {task.name}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                          {new Date(task.dueDate).toLocaleDateString('no')}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Calendar Tab */}
            {tab === 'calendar' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 16, overflowY: 'auto', gap: 12 }}>
                <div style={{ backgroundColor: 'var(--bg-surface)', padding: 12, borderRadius: 4, display: 'grid', gap: 8 }}>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Planlegg Karantene</h3>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4, textTransform: 'uppercase' }}>Startdato</label>
                    <input
                      type="date"
                      value={qStart}
                      onChange={(e) => setQStart(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 4, border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-dark)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4, textTransform: 'uppercase' }}>Varighet</label>
                    <select
                      value={qDuration}
                      onChange={(e) => setQDuration(parseInt(e.target.value))}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 4, border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-dark)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' }}
                    >
                      {[1,3,7,14,21,30].map(d => <option key={d} value={d}>{d} dager</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={handleAddQuarantine}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        backgroundColor: 'var(--accent-red)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 4,
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      Legg til
                    </button>
                    <button
                      onClick={exportICS}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        backgroundColor: 'var(--text-secondary)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 4,
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      📥 Eksporter
                    </button>
                  </div>
                </div>

                {/* Calendar */}
                <div style={{ flex: 1 }}>
                  <QuarantineCalendar tasks={tasks} />
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Zones & Avoidances */}
          <div style={{ backgroundColor: 'var(--bg-surface)', padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Statistics */}
            {stats && (
              <div style={{ backgroundColor: 'var(--bg-dark)', padding: 12, borderRadius: 4, borderLeft: '3px solid var(--accent-gold)' }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  📊 Smittesoner
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div style={{ backgroundColor: 'rgba(220, 38, 38, 0.1)', padding: 8, borderRadius: 4, textAlign: 'center' }}>
                    <p style={{ margin: '0 0 4px 0', fontSize: 11, color: 'var(--text-secondary)' }}>ILA</p>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--accent-red)' }}>{stats.ilaZones || 0}</p>
                  </div>
                  <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: 8, borderRadius: 4, textAlign: 'center' }}>
                    <p style={{ margin: '0 0 4px 0', fontSize: 11, color: 'var(--text-secondary)' }}>PD</p>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'rgb(245, 158, 11)' }}>{stats.pdZones || 0}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Zone Avoidance Form */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>🚫 Unngåelser</h3>
              <button
                onClick={() => setShowZoneForm(!showZoneForm)}
                style={{
                  padding: '6px 12px',
                  backgroundColor: 'var(--accent-gold)',
                  color: '#000',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                + Ny
              </button>
            </div>

            {showZoneForm && (
              <div style={{ backgroundColor: 'var(--bg-dark)', padding: 12, borderRadius: 4, display: 'grid', gap: 8 }}>
                <input
                  type="text"
                  placeholder="Sonennavn"
                  value={zoneName}
                  onChange={(e) => setZoneName(e.target.value)}
                  style={{ padding: '8px 10px', borderRadius: 4, border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 13 }}
                />
                <select
                  value={zoneDisease}
                  onChange={(e) => setZoneDisease(e.target.value)}
                  style={{ padding: '8px 10px', borderRadius: 4, border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 13 }}
                >
                  <option value="ILA">ILA</option>
                  <option value="PD">PD</option>
                </select>
                <input
                  type="text"
                  placeholder="Grunn (valgfritt)"
                  value={zoneReason}
                  onChange={(e) => setZoneReason(e.target.value)}
                  style={{ padding: '8px 10px', borderRadius: 4, border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 13 }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={handleRecordZoneAvoidance}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      backgroundColor: 'var(--accent-gold)',
                      color: '#000',
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    Registrer
                  </button>
                  <button
                    onClick={() => setShowZoneForm(false)}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      backgroundColor: 'var(--border-color)',
                      color: 'var(--text-primary)',
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: 12,
                    }}
                  >
                    Avbryt
                  </button>
                </div>
              </div>
            )}

            {/* Avoidances List */}
            <div style={{ display: 'grid', gap: 6, overflowY: 'auto' }}>
              {zoneAvoidances.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Ingen unngåelser</p>
              ) : (
                zoneAvoidances.map(avoidance => (
                  <div
                    key={avoidance.id}
                    style={{
                      padding: 10,
                      borderRadius: 4,
                      backgroundColor: 'var(--bg-dark)',
                      borderLeft: avoidance.disease === 'ILA' ? '3px solid var(--accent-red)' : '3px solid rgb(245, 158, 11)',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {avoidance.zoneName}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                      {avoidance.disease} • {new Date(avoidance.timestamp).toLocaleDateString('no')}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
          Velg en fisker for å begynne
        </div>
      )}
    </div>
  );
};

export default FisherDashboard;
