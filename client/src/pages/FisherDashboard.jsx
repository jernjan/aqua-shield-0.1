import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import Toast from '../components/Toast.jsx';
import 'leaflet/dist/leaflet.css';

const FisherDashboard = () => {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [vesselPos, setVesselPos] = useState(null);
  const [alert, setAlert] = useState(null);
  const [selectedZone, setSelectedZone] = useState(null);
  const [stats, setStats] = useState(null);
  const [center, setCenter] = useState([67.2675, 14.6735]); // Norway coast

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

  // Simulate vessel GPS position (replace with AIS data)
  const getVesselPosition = () => {
    // Mock position - in production, fetch from AIS API
    return {
      lat: 67.28,
      lon: 14.65,
      speed: 5.2,
      course: 45,
      name: 'MV Kystnavn',
      mmsi: '257891000'
    };
  };

  // Check if vessel in any zone
  const checkVesselInZones = (vessel) => {
    const nearbyZones = zones.filter(z => {
      const dist = calculateDistance(vessel.lat, vessel.lon, z.center?.lat || 67, z.center?.lon || 14);
      return dist < 10; // Within 10km
    });

    if (nearbyZones.length > 0) {
      const zone = nearbyZones[0];
      return {
        inZone: true,
        zone: zone.name,
        disease: zone.disease,
        severity: zone.severity,
        distance: calculateDistance(vessel.lat, vessel.lon, zone.center?.lat || 67, zone.center?.lon || 14)
      };
    }
    return { inZone: false };
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  };

  useEffect(() => {
    fetchZones();
    const interval = setInterval(fetchZones, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const vessel = getVesselPosition();
    setVesselPos(vessel);
    
    const inZone = checkVesselInZones(vessel);
    if (inZone.inZone) {
      setAlert({
        type: 'warning',
        message: `⚠️ UNNGÅ SONE: ${inZone.disease} i ${inZone.zone.toUpperCase()} - Avstand: ${inZone.distance.toFixed(1)}km`,
        duration: 0
      });
    }
  }, [zones]);

  // Color code by disease and severity
  const getZoneColor = (zone) => {
    if (zone.disease === 'ILA') {
      return zone.severity === 'protection' ? '#FF4444' : '#FFaa44';
    }
    return zone.severity === 'protection' ? '#FF8800' : '#FFDD44';
  };

  const zoneRadius = 15000; // 15km in meters

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      {alert && <Toast {...alert} onClose={() => setAlert(null)} />}
      
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
                🌊 Yrkesfisker GPS & Smittesoner
              </h1>
              <p className="text-gray-600 mt-1">Unngå smittede områder for å forhindre sykdomsspredning</p>
            </div>
            <button
              onClick={fetchZones}
              disabled={loading}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              🔄 Oppdater
            </button>
          </div>
        </div>

        {/* Vessel Status */}
        {vesselPos && (
          <div className="bg-white rounded-lg shadow-lg p-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="bg-blue-100 p-3 rounded-lg">
                📍
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-gray-800">{vesselPos.name}</h2>
                <p className="text-sm text-gray-600">
                  📍 {vesselPos.lat.toFixed(4)}°N, {vesselPos.lon.toFixed(4)}°E • 
                  ⚡ {vesselPos.speed} kts • 🧭 {vesselPos.course}°
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">MMSI: {vesselPos.mmsi}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Map */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-lg overflow-hidden" style={{ height: '600px' }}>
              {loading ? (
                <div className="w-full h-full flex items-center justify-center bg-gray-100">
                  <div className="text-center">
                    <div className="animate-spin mb-4">
                      🔄
                    </div>
                    <p className="text-gray-600">Henter smittesoner...</p>
                  </div>
                </div>
              ) : (
                <MapContainer center={center} zoom={9} className="w-full h-full">
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; OpenStreetMap contributors'
                  />
                  
                  {/* Disease Zones */}
                  {zones.map((zone, idx) => (
                    <React.Fragment key={idx}>
                      <Circle
                        center={[zone.center?.lat || 67, zone.center?.lon || 14]}
                        radius={zoneRadius}
                        color={getZoneColor(zone)}
                        weight={2}
                        opacity={0.6}
                        fillOpacity={0.2}
                        onClick={() => setSelectedZone(zone)}
                      >
                        <Popup>
                          <div className="text-sm">
                            <p className="font-bold">{zone.name}</p>
                            <p>Sykdom: {zone.disease}</p>
                            <p>Type: {zone.severity === 'protection' ? 'Beskyttelsessone' : 'Overvåkningssone'}</p>
                            <p>Radiusresult: {zone.radius}km</p>
                          </div>
                        </Popup>
                      </Circle>
                    </React.Fragment>
                  ))}
                  
                  {/* Vessel Position */}
                  {vesselPos && (
                    <Marker position={[vesselPos.lat, vesselPos.lon]}>
                      <Popup>
                        <div className="text-sm">
                          <p className="font-bold">{vesselPos.name}</p>
                          <p>Hastighet: {vesselPos.speed} kts</p>
                          <p>Kurs: {vesselPos.course}°</p>
                        </div>
                      </Popup>
                    </Marker>
                  )}
                </MapContainer>
              )}
            </div>
          </div>

          {/* Sidebar - Zone Statistics & Info */}
          <div className="space-y-4">
            {/* Statistics */}
            {stats && (
              <div className="bg-white rounded-lg shadow-lg p-4">
                <h3 className="font-bold text-gray-800 mb-3">📊 Smittesone Statistikk</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">ILA-soner:</span>
                    <span className="font-semibold text-red-600">{stats.ilaZones || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">PD-soner:</span>
                    <span className="font-semibold text-orange-600">{stats.pdZones || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Beskyttelsessoner:</span>
                    <span className="font-semibold">{stats.protectionZones || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Overvåkningssoner:</span>
                    <span className="font-semibold">{stats.surveillanceZones || 0}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Active Zones List */}
            <div className="bg-white rounded-lg shadow-lg p-4 max-h-96 overflow-y-auto">
              <h3 className="font-bold text-gray-800 mb-3">🎯 Aktive Smittesoner</h3>
              
              {zones.length === 0 ? (
                <p className="text-gray-500 text-sm">Ingen aktive smittesoner</p>
              ) : (
                <div className="space-y-2">
                  {zones.map((zone, idx) => {
                    const color = zone.disease === 'ILA' ? 'red' : 'orange';
                    const severity = zone.severity === 'protection' ? 'Beskyttelse' : 'Overvåking';
                    
                    return (
                      <button
                        key={idx}
                        onClick={() => setSelectedZone(zone)}
                        className={`w-full text-left p-2 rounded border-l-4 border-${color}-500 hover:bg-${color}-50 transition`}
                        style={{
                          borderLeft: `4px solid ${getZoneColor(zone)}`,
                          backgroundColor: selectedZone?.name === zone.name ? '#f0f0f0' : 'white'
                        }}
                      >
                        <p className="font-semibold text-sm text-gray-800">{zone.name}</p>
                        <p className="text-xs text-gray-600">
                          {zone.disease} • {severity}
                        </p>
                        <p className="text-xs text-gray-500">{zone.radius}km radius</p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Selected Zone Details */}
            {selectedZone && (
              <div className="bg-blue-50 rounded-lg shadow-lg p-4 border-l-4 border-blue-600">
                <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                  ℹ️ Sonedetaljer
                </h3>
                <div className="space-y-1 text-sm">
                  <p><strong>Navn:</strong> {selectedZone.name}</p>
                  <p><strong>Sykdom:</strong> {selectedZone.disease}</p>
                  <p><strong>Type:</strong> {selectedZone.severity === 'protection' ? 'Beskyttelsessone' : 'Overvåkningssone'}</p>
                  <p><strong>Radius:</strong> {selectedZone.radius}km</p>
                  <p><strong>Uke:</strong> {selectedZone.week}</p>
                  {vesselPos && (
                    <p>
                      <strong>Avstand fra skip:</strong>{' '}
                      {calculateDistance(
                        vesselPos.lat,
                        vesselPos.lon,
                        selectedZone.center?.lat || 67,
                        selectedZone.center?.lon || 14
                      ).toFixed(1)}km
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Guidelines */}
        <div className="bg-yellow-50 border-l-4 border-yellow-500 rounded-lg p-4 mt-6">
          <h3 className="font-bold text-yellow-900 mb-2 flex items-center gap-2">
            ⚠️ Viktige Retningslinjer
          </h3>
          <ul className="text-sm text-yellow-900 space-y-1">
            <li>✅ Unngå røde soner (ILA-beskyttelsessoner) - Høyeste risiko</li>
            <li>⚠️ Vær forsiktig rundt oransje soner (ILA-overvåkningssoner)</li>
            <li>📊 Rapporter observasjoner fra smittede områder</li>
            <li>🔄 Oppdater fiskeredskaper før du beveger deg til ny sone</li>
            <li>📞 Kontakt fiskerimyndighetene ved mistanke om smitte</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default FisherDashboard;
