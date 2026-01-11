import React, { useState, useEffect } from 'react';
import Toast from '../components/Toast.jsx';

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
  
  // Form states
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskName, setTaskName] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskDuration, setTaskDuration] = useState(7);
  
  const [showZoneForm, setShowZoneForm] = useState(false);
  const [zoneName, setZoneName] = useState('');
  const [zoneDisease, setZoneDisease] = useState('ILA');
  const [zoneReason, setZoneReason] = useState('');

  // Fetch all fishers
  const fetchFishers = async () => {
    try {
      const response = await fetch('/api/mvp/fisher');
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
      const response = await fetch('/api/disease-zones/all');
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
        fetch(`/api/mvp/fisher/${fisher.id}/tasks`),
        fetch(`/api/mvp/fisher/${fisher.id}/zone-avoidances`)
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
      const response = await fetch(`/api/mvp/fisher/${selectedFisher.id}/task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: taskName,
          dueDate: taskDueDate,
          duration: taskDuration,
          type: 'kontroll'
        })
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
      const response = await fetch(`/api/mvp/fisher/${selectedFisher.id}/task/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !task.completed })
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
      const response = await fetch(`/api/mvp/fisher/${selectedFisher.id}/zone-avoidance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zoneName,
          disease: zoneDisease,
          reason: zoneReason,
          timestamp: new Date().toISOString()
        })
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      {alert && <Toast {...alert} onClose={() => setAlert(null)} />}
      
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            🎣 Yrkesfisker Tracking
          </h1>
          <p className="text-gray-600">Oppgaver, sone-unngåelse og smittezone-data (samme system som brønnbåt)</p>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left: Fisher Selection & Summary */}
          <div className="space-y-4">
            {/* Fisher List */}
            <div className="bg-white rounded-lg shadow-lg p-4">
              <h2 className="font-bold text-gray-800 mb-3">Velg Fisker</h2>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {fishers.map(fisher => (
                  <button
                    key={fisher.id}
                    onClick={() => setSelectedFisher(fisher)}
                    className={`w-full text-left p-3 rounded-lg border-2 transition ${
                      selectedFisher?.id === fisher.id
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-semibold text-gray-800">{fisher.name}</div>
                    <div className="text-xs text-gray-600">{fisher.homePort}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Selected Fisher Info */}
            {selectedFisher && (
              <div className="bg-blue-50 rounded-lg shadow p-4 border border-blue-200">
                <h3 className="font-bold text-gray-800 mb-2">📋 Info</h3>
                <div className="space-y-1 text-sm">
                  <p><strong>Navn:</strong> {selectedFisher.name}</p>
                  <p><strong>Lisens:</strong> {selectedFisher.license}</p>
                  <p><strong>Port:</strong> {selectedFisher.homePort}</p>
                  <p><strong>Fang:</strong> {selectedFisher.catches}kg</p>
                </div>
              </div>
            )}
          </div>

          {/* Middle: Tasks */}
          <div className="space-y-4">
            {/* Tasks Header */}
            <div className="bg-white rounded-lg shadow-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <h2 className="font-bold text-gray-800">📋 Oppgaver</h2>
                <button
                  onClick={() => setShowTaskForm(!showTaskForm)}
                  className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                >
                  + Ny
                </button>
              </div>

              {/* Add Task Form */}
              {showTaskForm && selectedFisher && (
                <div className="mb-3 p-3 bg-gray-50 rounded border">
                  <input
                    type="text"
                    placeholder="Oppgave"
                    value={taskName}
                    onChange={(e) => setTaskName(e.target.value)}
                    className="w-full px-2 py-1 border rounded mb-2 text-sm"
                  />
                  <input
                    type="date"
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="w-full px-2 py-1 border rounded mb-2 text-sm"
                  />
                  <select
                    value={taskDuration}
                    onChange={(e) => setTaskDuration(parseInt(e.target.value))}
                    className="w-full px-2 py-1 border rounded mb-2 text-sm"
                  >
                    {[1,3,7,14,30].map(d => <option key={d} value={d}>{d} dager</option>)}
                  </select>
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddTask}
                      className="flex-1 px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                    >
                      Lagre
                    </button>
                    <button
                      onClick={() => setShowTaskForm(false)}
                      className="flex-1 px-3 py-2 bg-gray-300 text-gray-800 rounded text-sm hover:bg-gray-400"
                    >
                      Avbryt
                    </button>
                  </div>
                </div>
              )}

              {/* Tasks List */}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {tasks.length === 0 ? (
                  <p className="text-gray-500 text-sm">Ingen oppgaver</p>
                ) : (
                  tasks.map(task => (
                    <button
                      key={task.id}
                      onClick={() => handleToggleTask(task)}
                      className={`w-full text-left p-2 rounded text-sm border-l-4 transition ${
                        task.completed
                          ? 'bg-green-50 border-green-400 line-through text-gray-600'
                          : 'bg-white border-blue-400 text-gray-800 hover:bg-blue-50'
                      }`}
                    >
                      <div className="font-semibold">{task.completed ? '✓' : '○'} {task.name}</div>
                      <div className="text-xs text-gray-600">{new Date(task.dueDate).toLocaleDateString('no')}</div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right: Zones & Avoidances */}
          <div className="space-y-4">
            {/* Statistics */}
            {stats && (
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="font-bold text-gray-800 mb-2">📊 Smittesoner</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-red-50 p-2 rounded">
                    <div className="text-xs text-gray-600">ILA</div>
                    <div className="font-bold text-red-600">{stats.ilaZones || 0}</div>
                  </div>
                  <div className="bg-orange-50 p-2 rounded">
                    <div className="text-xs text-gray-600">PD</div>
                    <div className="font-bold text-orange-600">{stats.pdZones || 0}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Zone Avoidance Form */}
            <div className="bg-white rounded-lg shadow-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <h2 className="font-bold text-gray-800">🚫 Unngåelser</h2>
                <button
                  onClick={() => setShowZoneForm(!showZoneForm)}
                  className="px-3 py-1 bg-orange-600 text-white rounded text-sm hover:bg-orange-700"
                >
                  + Ny
                </button>
              </div>

              {showZoneForm && selectedFisher && (
                <div className="mb-3 p-3 bg-gray-50 rounded border">
                  <input
                    type="text"
                    placeholder="Sonennavn"
                    value={zoneName}
                    onChange={(e) => setZoneName(e.target.value)}
                    className="w-full px-2 py-1 border rounded mb-2 text-sm"
                  />
                  <select
                    value={zoneDisease}
                    onChange={(e) => setZoneDisease(e.target.value)}
                    className="w-full px-2 py-1 border rounded mb-2 text-sm"
                  >
                    <option value="ILA">ILA</option>
                    <option value="PD">PD</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Grunn (valgfritt)"
                    value={zoneReason}
                    onChange={(e) => setZoneReason(e.target.value)}
                    className="w-full px-2 py-1 border rounded mb-2 text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleRecordZoneAvoidance}
                      className="flex-1 px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                    >
                      Registrer
                    </button>
                    <button
                      onClick={() => setShowZoneForm(false)}
                      className="flex-1 px-3 py-2 bg-gray-300 text-gray-800 rounded text-sm hover:bg-gray-400"
                    >
                      Avbryt
                    </button>
                  </div>
                </div>
              )}

              {/* Avoidances List */}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {zoneAvoidances.length === 0 ? (
                  <p className="text-gray-500 text-sm">Ingen registrerte unngåelser</p>
                ) : (
                  zoneAvoidances.map(avoidance => (
                    <div key={avoidance.id} className={`p-2 rounded text-sm border-l-4 ${
                      avoidance.disease === 'ILA'
                        ? 'bg-red-50 border-red-400'
                        : 'bg-orange-50 border-orange-400'
                    }`}>
                      <div className="font-semibold">{avoidance.zoneName}</div>
                      <div className="text-xs text-gray-600">
                        {avoidance.disease} • {new Date(avoidance.timestamp).toLocaleDateString('no')}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Guidelines */}
        <div className="bg-yellow-50 border-l-4 border-yellow-500 rounded-lg p-4 mt-6">
          <h3 className="font-bold text-yellow-900 mb-2">⚠️ Retningslinjer</h3>
          <ul className="text-sm text-yellow-900 space-y-1">
            <li>📋 <strong>Oppgaver:</strong> Registrer inspeksjoner og vedlikehold av redskaper</li>
            <li>🚫 <strong>Unngåelser:</strong> Registrer smittesoner du unngår - dette blir ML-treningsdata</li>
            <li>🧹 <strong>Rengjøring:</strong> Vask redskaper grundig ved sonegrenser</li>
            <li>📞 <strong>Rapport:</strong> Meld observasjoner av smitte til Mattilsynet umiddelbart</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default FisherDashboard;
