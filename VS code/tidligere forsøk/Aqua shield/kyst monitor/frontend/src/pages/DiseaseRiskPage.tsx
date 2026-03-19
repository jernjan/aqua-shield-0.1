import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000/api',
  timeout: 10000,
});

// Add authorization token
api.interceptors.request.use((config) => {
  if (config.method !== 'options') {
    const token = localStorage.getItem('token') || localStorage.getItem('access_token') || 'demo-token-test'
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

interface DiseaseOccurrence {
  id: number;
  farm_id: number;
  disease_type: string;
  severity: string;
  location_lat: number;
  location_lon: number;
  detected_at: string;
  lice_count?: number;
  is_resolved: boolean;
  created_at: string;
}

interface InfectionZone {
  id: number;
  disease_type: string;
  center_lat: number;
  center_lon: number;
  radius_km: number;
  severity: string;
  water_current_direction?: string;
  water_current_speed_knots?: number;
  is_active: boolean;
  created_at: string;
}

interface FarmRisk {
  farm_id: number;
  farm_name: string;
  overall_risk_score: number;
  risk_level: string;
  vessel_risks: Array<{
    vessel_name: string;
    transmission_probability: number;
    distance_km: number;
  }>;
  zone_risks: Array<{
    disease_type: string;
    risk_probability: number;
    distance_km: number;
  }>;
}

export default function DiseaseRiskPage() {
  const [diseases, setDiseases] = useState<DiseaseOccurrence[]>([]);
  const [zones, setZones] = useState<InfectionZone[]>([]);
  const [farmRisks, setFarmRisks] = useState<FarmRisk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'diseases' | 'zones' | 'risks' | 'predictions'>('diseases');

  useEffect(() => {
    loadDiseaseData();
  }, []);

  const loadDiseaseData = async () => {
    try {
      setLoading(true);
      const [diseasesRes, zonesRes, risksRes] = await Promise.all([
        api.get('/disease/occurrences?days=30'),
        api.get('/disease/zones?active_only=true'),
        api.get('/disease/all-farms-risk')
      ]);

      setDiseases(diseasesRes.data || []);
      setZones(zonesRes.data || []);
      setFarmRisks(risksRes.data?.farms_by_risk || []);
    } catch (err) {
      setError('Failed to load disease data: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-900';
      case 'HIGH':
        return 'bg-red-600';
      case 'MEDIUM':
        return 'bg-yellow-600';
      case 'LOW':
        return 'bg-blue-600';
      default:
        return 'bg-gray-600';
    }
  };

  const getRiskBadgeClass = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return 'text-white bg-red-900 px-3 py-1 rounded-full text-sm font-bold';
      case 'HIGH':
        return 'text-white bg-red-600 px-3 py-1 rounded-full text-sm font-bold';
      case 'MEDIUM':
        return 'text-white bg-yellow-600 px-3 py-1 rounded-full text-sm font-bold';
      case 'LOW':
        return 'text-white bg-blue-600 px-3 py-1 rounded-full text-sm font-bold';
      default:
        return 'text-white bg-gray-600 px-3 py-1 rounded-full text-sm font-bold';
    }
  };

  const diseaseStats = diseases.length > 0
    ? {
        total: diseases.length,
        active: diseases.filter(d => !d.is_resolved).length,
        resolved: diseases.filter(d => d.is_resolved).length,
        byType: Object.entries(
          diseases.reduce((acc: Record<string, number>, d) => {
            acc[d.disease_type] = (acc[d.disease_type] || 0) + 1;
            return acc;
          }, {})
        ).map(([name, value]) => ({ name: name.replace(/_/g, ' '), value }))
      }
    : { total: 0, active: 0, resolved: 0, byType: [] };

  const farmRiskStats = farmRisks.length > 0
    ? Object.entries(
        farmRisks.reduce((acc: Record<string, number>, r) => {
          acc[r.risk_level] = (acc[r.risk_level] || 0) + 1;
          return acc;
        }, {})
      ).map(([name, value]) => ({ name, value }))
    : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-xl font-semibold">Loading disease risk data...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">🦠 Disease Risk Management</h1>
          <p className="text-gray-400">Real-time disease tracking, infection zone monitoring, and risk predictions</p>
        </div>

        {error && (
          <div className="bg-red-900 border border-red-500 text-red-200 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-700">
          {(['diseases', 'zones', 'risks', 'predictions'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 font-semibold border-b-2 ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Disease Occurrences Tab */}
        {activeTab === 'diseases' && (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                <div className="text-3xl font-bold text-blue-400">{diseaseStats.total}</div>
                <div className="text-gray-400 text-sm">Total Occurrences</div>
              </div>
              <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                <div className="text-3xl font-bold text-red-500">{diseaseStats.active}</div>
                <div className="text-gray-400 text-sm">Active Cases</div>
              </div>
              <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                <div className="text-3xl font-bold text-green-500">{diseaseStats.resolved}</div>
                <div className="text-gray-400 text-sm">Resolved</div>
              </div>
              <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                <div className="text-3xl font-bold text-yellow-500">{zones.length}</div>
                <div className="text-gray-400 text-sm">Active Zones</div>
              </div>
            </div>

            {/* Chart */}
            {diseaseStats.byType.length > 0 && (
              <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                <h3 className="text-xl font-semibold mb-4">Disease Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={diseaseStats.byType}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {diseaseStats.byType.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={['#ef4444', '#f59e0b', '#3b82f6', '#10b981'][index % 4]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Disease List */}
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
              <h3 className="text-xl font-semibold mb-4">Recent Disease Occurrences</h3>
              <div className="space-y-4">
                {diseases.length === 0 ? (
                  <p className="text-gray-400">No disease occurrences recorded</p>
                ) : (
                  diseases.map(disease => (
                    <div key={disease.id} className="bg-gray-700 p-4 rounded border border-gray-600">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold text-lg">{disease.disease_type.replace(/_/g, ' ')}</p>
                          <p className="text-sm text-gray-400">Farm ID: {disease.farm_id}</p>
                        </div>
                        <span className={getRiskBadgeClass(disease.severity)}>
                          {disease.severity}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-400">Detected</p>
                          <p>{new Date(disease.detected_at).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Location</p>
                          <p>{disease.location_lat.toFixed(2)}°, {disease.location_lon.toFixed(2)}°</p>
                        </div>
                        {disease.lice_count && (
                          <div>
                            <p className="text-gray-400">Lice Count</p>
                            <p className="font-semibold">{disease.lice_count}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-gray-400">Status</p>
                          <p className={disease.is_resolved ? 'text-green-400' : 'text-red-400'}>
                            {disease.is_resolved ? '✓ Resolved' : '⚠ Active'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Infection Zones Tab */}
        {activeTab === 'zones' && (
          <div className="space-y-6">
            {zones.length === 0 ? (
              <div className="bg-gray-800 p-8 rounded-lg border border-gray-700 text-center">
                <p className="text-gray-400">No active infection zones</p>
              </div>
            ) : (
              zones.map(zone => (
                <div key={zone.id} className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-semibold">{zone.disease_type.replace(/_/g, ' ')} Zone</h3>
                      <p className="text-sm text-gray-400">Zone ID: {zone.id}</p>
                    </div>
                    <span className={getRiskBadgeClass(zone.severity)}>
                      {zone.severity}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="bg-gray-700 p-3 rounded">
                      <p className="text-gray-400">Center</p>
                      <p>{zone.center_lat.toFixed(2)}°N, {zone.center_lon.toFixed(2)}°E</p>
                    </div>
                    <div className="bg-gray-700 p-3 rounded">
                      <p className="text-gray-400">Radius</p>
                      <p className="font-semibold">{zone.radius_km.toFixed(1)} km</p>
                    </div>
                    <div className="bg-gray-700 p-3 rounded">
                      <p className="text-gray-400">Water Current</p>
                      <p>{zone.water_current_direction || 'N/A'} @ {zone.water_current_speed_knots?.toFixed(2) || 'N/A'} knots</p>
                    </div>
                    <div className="bg-gray-700 p-3 rounded">
                      <p className="text-gray-400">Status</p>
                      <p className="font-semibold text-green-400">● Active</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Farm Risk Analysis Tab */}
        {activeTab === 'risks' && (
          <div className="space-y-6">
            {/* Risk Distribution Chart */}
            {farmRiskStats.length > 0 && (
              <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                <h3 className="text-xl font-semibold mb-4">Farm Risk Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={farmRiskStats}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                    <XAxis dataKey="name" stroke="#999" />
                    <YAxis stroke="#999" />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #444' }} />
                    <Bar dataKey="value" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Farm Risk List */}
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
              <h3 className="text-xl font-semibold mb-4">Farm Risk Analysis</h3>
              <div className="space-y-4">
                {farmRisks.length === 0 ? (
                  <p className="text-gray-400">No farms to analyze</p>
                ) : (
                  farmRisks.map(farm => (
                    <div key={farm.farm_id} className="bg-gray-700 p-4 rounded border-l-4 border-blue-500">
                      <div className="flex items-start justify-between mb-3">
                        <h4 className="font-semibold text-lg">{farm.farm_name}</h4>
                        <span className={getRiskBadgeClass(farm.risk_level)}>
                          {farm.risk_level}
                        </span>
                      </div>

                      <div className="mb-3 bg-gray-600 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full ${
                            farm.overall_risk_score > 0.7 ? 'bg-red-500' :
                            farm.overall_risk_score > 0.5 ? 'bg-yellow-500' :
                            'bg-green-500'
                          }`}
                          style={{ width: `${farm.overall_risk_score * 100}%` }}
                        />
                      </div>

                      {farm.vessel_risks.length > 0 && (
                        <div className="text-sm mb-2">
                          <p className="text-gray-400 font-semibold">Vessel Risks ({farm.vessel_risks.length}):</p>
                          {farm.vessel_risks.map((vr, i) => (
                            <p key={i} className="text-xs ml-2">
                              • {vr.vessel_name}: {(vr.transmission_probability * 100).toFixed(0)}% ({vr.distance_km.toFixed(1)}km away)
                            </p>
                          ))}
                        </div>
                      )}

                      {farm.zone_risks.length > 0 && (
                        <div className="text-sm">
                          <p className="text-gray-400 font-semibold">Zone Risks ({farm.zone_risks.length}):</p>
                          {farm.zone_risks.map((zr, i) => (
                            <p key={i} className="text-xs ml-2">
                              • {zr.disease_type}: {(zr.risk_probability * 100).toFixed(0)}% ({zr.distance_km.toFixed(1)}km away)
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Predictions Tab */}
        {activeTab === 'predictions' && (
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <h3 className="text-xl font-semibold mb-4">ML Predictions (Coming Soon)</h3>
            <p className="text-gray-400">Disease transmission predictions will appear here as ML model generates them.</p>
          </div>
        )}
      </div>
    </div>
  );
}
