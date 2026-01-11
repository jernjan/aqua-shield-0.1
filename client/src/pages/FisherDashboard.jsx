import React, { useState, useEffect } from 'react';
import Toast from '../components/Toast.jsx';

const FisherDashboard = () => {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [alert, setAlert] = useState(null);
  const [filterDisease, setFilterDisease] = useState('all');

  // Fetch disease zones
  const fetchZones = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/disease-zones/all');
      if (!response.ok) throw new Error('Failed to fetch zones');
      
      const data = await response.json();
      setZones(data.zones || []);
      setStats(data.stats);
      setError(null);
    } catch (err) {
      setError(err.message);
      setAlert({ type: 'error', message: `Feil: ${err.message}`, duration: 5000 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchZones();
    const interval = setInterval(fetchZones, 300000); // Refresh every 5 min
    return () => clearInterval(interval);
  }, []);

  // Filter zones by disease
  const filteredZones = filterDisease === 'all' 
    ? zones 
    : zones.filter(z => z.disease === filterDisease);

  // Get severity color and label
  const getSeverityInfo = (severity) => {
    return severity === 'protection' 
      ? { color: 'text-red-600', bg: 'bg-red-100', label: 'Beskyttelsessone (Høy risiko)' }
      : { color: 'text-orange-600', bg: 'bg-orange-100', label: 'Overvåkningssone (Moderat risiko)' };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      {alert && <Toast {...alert} onClose={() => setAlert(null)} />}
      
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            🎣 Yrkesfisker Smittesoner
          </h1>
          <p className="text-gray-600">Aktive smittesoner for ILA og PD - Unngå disse områdene</p>
        </div>

        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">ILA-soner</div>
              <div className="text-2xl font-bold text-red-600">{stats.ilaZones || 0}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">PD-soner</div>
              <div className="text-2xl font-bold text-orange-600">{stats.pdZones || 0}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">Beskyttelse</div>
              <div className="text-2xl font-bold text-gray-800">{stats.protectionZones || 0}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">Overvåking</div>
              <div className="text-2xl font-bold text-gray-800">{stats.surveillanceZones || 0}</div>
            </div>
          </div>
        )}

        {/* Filter & Refresh */}
        <div className="bg-white rounded-lg shadow-lg p-4 mb-6 flex gap-4 items-center">
          <button
            onClick={fetchZones}
            disabled={loading}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            🔄 Oppdater
          </button>
          
          <div className="flex gap-2">
            <button
              onClick={() => setFilterDisease('all')}
              className={`px-4 py-2 rounded-lg ${filterDisease === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-800'}`}
            >
              Alle
            </button>
            <button
              onClick={() => setFilterDisease('ILA')}
              className={`px-4 py-2 rounded-lg ${filterDisease === 'ILA' ? 'bg-red-600 text-white' : 'bg-red-100 text-red-600'}`}
            >
              ILA
            </button>
            <button
              onClick={() => setFilterDisease('PD')}
              className={`px-4 py-2 rounded-lg ${filterDisease === 'PD' ? 'bg-orange-600 text-white' : 'bg-orange-100 text-orange-600'}`}
            >
              PD
            </button>
          </div>
        </div>

        {/* Zones List */}
        <div className="space-y-3">
          {loading ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <div className="text-gray-600">Henter smittesoner...</div>
            </div>
          ) : filteredZones.length === 0 ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
              <div className="text-green-700 font-semibold">✅ Ingen aktive smittesoner</div>
              <div className="text-green-600 text-sm mt-1">Det er trygt å fiske i hele området nå</div>
            </div>
          ) : (
            filteredZones.map((zone, idx) => {
              const severity = getSeverityInfo(zone.severity);
              return (
                <div key={idx} className={`${severity.bg} rounded-lg shadow p-4 border-l-4 ${severity.color}`}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className={`font-bold ${severity.color} text-lg`}>{zone.name}</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                        <div>
                          <div className="text-xs text-gray-600">Sykdom</div>
                          <div className="font-semibold text-gray-800">{zone.disease}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-600">Type</div>
                          <div className="font-semibold text-gray-800">
                            {zone.severity === 'protection' ? 'Beskyttelse' : 'Overvåking'}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-600">Radius</div>
                          <div className="font-semibold text-gray-800">{zone.radius}km</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-600">Uke</div>
                          <div className="font-semibold text-gray-800">{zone.week}</div>
                        </div>
                      </div>
                      {zone.center && (
                        <div className="mt-2 text-xs text-gray-600">
                          📍 {zone.center.lat?.toFixed(3)}°N, {zone.center.lon?.toFixed(3)}°E
                        </div>
                      )}
                    </div>
                    <div className={`px-3 py-1 rounded text-sm font-semibold ${severity.color}`}>
                      {zone.severity === 'protection' ? '⛔ Høy risiko' : '⚠️ Moderat'}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Guidelines */}
        <div className="bg-yellow-50 border-l-4 border-yellow-500 rounded-lg p-4 mt-8">
          <h3 className="font-bold text-yellow-900 mb-2">
            ⚠️ Sikkerhetsvarsler
          </h3>
          <ul className="text-sm text-yellow-900 space-y-1">
            <li>🛑 <strong>Røde soner (Beskyttelsessone):</strong> Unngå helt - høyeste smittefare</li>
            <li>🟠 <strong>Orange soner (Overvåkningssone):</strong> Utvid forsiktighet - mulig smittefare</li>
            <li>🧹 <strong>Rengjøring:</strong> Vask redskaper grundig ved sonegrenser</li>
            <li>📞 <strong>Rapport:</strong> Meld observasjoner til Mattilsynet umiddelbart</li>
            <li>📅 <strong>Oppdater:</strong> Soner oppdateres hver uke - sjekk ofte</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default FisherDashboard;
