import { useState, useEffect } from 'react';
import { AlertCircle, Play, RefreshCw, Check, Clock } from 'lucide-react';

export default function AdminPanel() {
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState('snapshots'); // 'snapshots' or 'vessels'
  const [vessels, setVessels] = useState(null);

  // Load snapshots on mount
  useEffect(() => {
    loadSnapshots();
  }, []);

  const loadSnapshots = async () => {
    try {
      const response = await fetch('/api/admin/snapshot/list');
      const data = await response.json();
      setSnapshots(data.snapshots || []);
    } catch (err) {
      setMessage(`Error loading snapshots: ${err.message}`);
    }
  };

  const runSnapshot = async () => {
    if (loading) return;
    setLoading(true);
    setMessage('Creating snapshot... (this may take 10-30 seconds)');

    try {
      const response = await fetch('/api/admin/snapshot/create', { method: 'POST' });
      const data = await response.json();

      if (data.success) {
        setMessage(`✅ Snapshot created! ID: ${data.snapshot.snapshot_id} (${data.snapshot.forecast_count} forecasts)`);
        loadSnapshots();
      } else {
        setMessage(`❌ Error: ${data.error}`);
      }
    } catch (err) {
      setMessage(`❌ Failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const validateSnapshot = async (snapshotId) => {
    if (loading) return;
    setLoading(true);
    setMessage(`Validating snapshot ${snapshotId}...`);

    try {
      const response = await fetch(`/api/admin/snapshot/${snapshotId}/validate`, { method: 'POST' });
      const data = await response.json();

      if (data.success) {
        setMessage(`✅ Validation complete!`);
        loadSnapshots();
      } else {
        setMessage(`⚠️ ${data.error}`);
      }
    } catch (err) {
      setMessage(`❌ Failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadVesselAnalysis = async () => {
    try {
      const response = await fetch('/api/admin/vessel-tracking/analysis');
      const data = await response.json();
      setVessels(data);
      setMessage('Vessel analysis loaded');
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-indigo-900 mb-2">AquaShield Model Training</h1>
          <p className="text-gray-600">Snapshot System & Vessel Tracking Administration</p>
        </div>

        {/* Messages */}
        {message && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-blue-800">{message}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setActiveTab('snapshots')}
            className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
              activeTab === 'snapshots'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-indigo-600 border border-indigo-200'
            }`}
          >
            📸 Snapshots
          </button>
          <button
            onClick={() => {
              setActiveTab('vessels');
              loadVesselAnalysis();
            }}
            className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
              activeTab === 'vessels'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-indigo-600 border border-indigo-200'
            }`}
          >
            🚢 Vessel Tracking
          </button>
        </div>

        {/* SNAPSHOTS TAB */}
        {activeTab === 'snapshots' && (
          <div className="space-y-6">
            {/* Create Snapshot Button */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold text-indigo-900 mb-4">Create New Snapshot</h2>
              <button
                onClick={runSnapshot}
                disabled={loading}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-bold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-all"
              >
                {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                {loading ? 'Creating Snapshot...' : 'Run Snapshot (2687 × 4 scenarios)'}
              </button>
              <p className="text-sm text-gray-600 mt-2">Estimated time: 10-30 seconds</p>
            </div>

            {/* Snapshots List */}
            {snapshots.length > 0 ? (
              <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                <div className="px-6 py-4 bg-indigo-50 border-b">
                  <h2 className="text-xl font-bold text-indigo-900">Recent Snapshots</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Snapshot ID</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Created</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Forecasts</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Validation Date</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snapshots.map((snap) => (
                        <tr key={snap.snapshot_id} className="border-b hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm font-mono text-indigo-600">
                            {snap.snapshot_id.substring(0, 20)}...
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-700">
                            {new Date(snap.created_at).toLocaleDateString('no-NO')}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-700">{snap.total_forecasts}</td>
                          <td className="px-6 py-4 text-sm">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                snap.status === 'validated'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}
                            >
                              {snap.status === 'validated' ? (
                                <span className="flex items-center gap-1">
                                  <Check className="w-3 h-3" /> Validated
                                </span>
                              ) : (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" /> Pending
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-700">
                            {new Date(snap.validation_date).toLocaleDateString('no-NO')}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            {snap.status !== 'validated' &&
                              new Date(snap.validation_date) <= new Date() && (
                                <button
                                  onClick={() => validateSnapshot(snap.snapshot_id)}
                                  disabled={loading}
                                  className="text-indigo-600 hover:text-indigo-800 font-semibold disabled:text-gray-400"
                                >
                                  Validate
                                </button>
                              )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-lg p-8 text-center">
                <p className="text-gray-600 mb-4">No snapshots yet. Create one to get started!</p>
              </div>
            )}
          </div>
        )}

        {/* VESSEL TRACKING TAB */}
        {activeTab === 'vessels' && (
          <div className="space-y-6">
            {vessels ? (
              <>
                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white rounded-lg shadow-lg p-6">
                    <p className="text-gray-600 text-sm mb-2">Total Visits</p>
                    <p className="text-3xl font-bold text-indigo-600">{vessels.total_visits}</p>
                  </div>
                  <div className="bg-white rounded-lg shadow-lg p-6">
                    <p className="text-gray-600 text-sm mb-2">Unique Vessels</p>
                    <p className="text-3xl font-bold text-indigo-600">{vessels.unique_vessels}</p>
                  </div>
                  <div className="bg-white rounded-lg shadow-lg p-6">
                    <p className="text-gray-600 text-sm mb-2">Facilities Visited</p>
                    <p className="text-3xl font-bold text-indigo-600">{vessels.unique_facilities}</p>
                  </div>
                </div>

                {/* Transmission Paths */}
                {vessels.transmission_paths && vessels.transmission_paths.length > 0 && (
                  <div className="bg-white rounded-lg shadow-lg p-6">
                    <h2 className="text-xl font-bold text-indigo-900 mb-4">🔗 Transmission Paths</h2>
                    <div className="space-y-3">
                      {vessels.transmission_paths.slice(0, 10).map((path, idx) => (
                        <div key={idx} className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
                          <p className="font-semibold text-indigo-900">
                            {path.vessel_name} ({path.vessel_type})
                          </p>
                          <p className="text-sm text-gray-700 mt-1">
                            Visited {path.facility_count} facilities: {path.facilities.join(' → ')}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white rounded-lg shadow-lg p-8 text-center">
                <p className="text-gray-600">Loading vessel data...</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
