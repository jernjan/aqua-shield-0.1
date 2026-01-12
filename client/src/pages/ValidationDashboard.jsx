import React, { useState, useEffect } from 'react'
import './ValidationDashboard.css'

export default function ValidationDashboard() {
  const [metrics, setMetrics] = useState(null)
  const [pending, setPending] = useState(null)
  const [selectedFacility, setSelectedFacility] = useState(null)
  const [facilityHistory, setFacilityHistory] = useState(null)
  const [loading, setLoading] = useState(false)
  const [validating, setValidating] = useState(false)
  const [metricsHistory, setMetricsHistory] = useState([]) // NEW: Track metrics over time

  // Load metrics and pending forecasts
  useEffect(() => {
    loadDashboard()
    const interval = setInterval(loadDashboard, 60000) // Refresh every minute
    return () => clearInterval(interval)
  }, [])

  // NEW: Track metrics history for trend graph
  useEffect(() => {
    if (metrics && metrics.accuracy !== null) {
      setMetricsHistory(prev => {
        const newHistory = [...prev, {
          timestamp: new Date().getTime(),
          accuracy: metrics.accuracy,
          precision: metrics.precision,
          recall: metrics.recall
        }];
        // Keep only last 30 days of data
        return newHistory.slice(-30);
      });
    }
  }, [metrics?.accuracy]);

  async function loadDashboard() {
    try {
      setLoading(true)
      const [metricsRes, pendingRes] = await Promise.all([
        fetch('/api/admin/validation/metrics'),
        fetch('/api/admin/validation/pending')
      ])
      
      if (!metricsRes.ok || !pendingRes.ok) {
        throw new Error('API error')
      }
      
      const metricsData = await metricsRes.json()
      const pendingData = await pendingRes.json()
      
      setMetrics(metricsData)
      setPending(pendingData)
    } catch (err) {
      console.error('Error loading dashboard:', err)
      // Set default empty state on error
      setMetrics({
        totalForecasts: 0,
        validatedForecasts: 0,
        pendingValidation: 0,
        accuracy: 0,
        precision: 0,
        recall: 0,
        falsePositiveRate: 0,
        results: { TP: 0, FP: 0, TN: 0, FN: 0 }
      })
      setPending({ count: 0, forecasts: [] })
    } finally {
      setLoading(false)
    }
  }

  async function loadFacilityHistory(facilityId) {
    try {
      const res = await fetch(`/api/admin/validation/facility/${facilityId}`)
      const data = await res.json()
      setFacilityHistory(data)
      setSelectedFacility(facilityId)
    } catch (err) {
      console.error('Error loading facility history:', err)
    }
  }

  async function autoValidate() {
    try {
      setValidating(true)
      const res = await fetch('/api/admin/validation/auto-validate', { method: 'POST' })
      const data = await res.json()
      setMetrics(data.metrics)
      await loadDashboard()
    } catch (err) {
      console.error('Error auto-validating:', err)
    } finally {
      setValidating(false)
    }
  }

  async function validateForecast(forecastId) {
    try {
      const res = await fetch(`/api/admin/validation/validate/${forecastId}`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      const data = await res.json()
      setMetrics(data.metrics)
      await loadDashboard()
      if (selectedFacility) {
        await loadFacilityHistory(selectedFacility)
      }
    } catch (err) {
      console.error('Error validating forecast:', err)
    }
  }

  if (!metrics || !pending) {
    return <div className="validation-dashboard loading">Laster data...</div>
  }

  return (
    <div className="validation-dashboard">
      <h1>🔍 Validerings-Dashboard</h1>
      <p className="subtitle">Sammenlign prognoser mot faktiske BarentsWatch-data</p>

      {/* Metrics Cards */}
      <div className="metrics-grid">
        <div className="metric-card accuracy">
          <div className="metric-label">Nøyaktighet</div>
          <div className="metric-value">{metrics.accuracy}%</div>
          <div className="metric-detail">
            {metrics.results.TP + metrics.results.TN} av {metrics.validatedForecasts} validert
          </div>
        </div>

        <div className="metric-card precision">
          <div className="metric-label">Presisjon</div>
          <div className="metric-value">{metrics.precision}%</div>
          <div className="metric-detail">
            Når vi sier "HØY RISIKO", har vi rett {metrics.precision}% av gangen
          </div>
        </div>

        <div className="metric-card recall">
          <div className="metric-label">Sensitivitet (Recall)</div>
          <div className="metric-value">{metrics.recall}%</div>
          <div className="metric-detail">
            Vi fanger opp {metrics.recall}% av faktiske utbrudd
          </div>
        </div>

        <div className="metric-card fpr">
          <div className="metric-label">False Positive Rate</div>
          <div className="metric-value">{metrics.falsePositiveRate}%</div>
          <div className="metric-detail">
            {metrics.results.FP} falskalarm av {metrics.results.FP + metrics.results.TN} normale dager
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="summary-box">
        <div className="summary-stat">
          <span>Totale Prognoser:</span>
          <strong>{metrics.totalForecasts}</strong>
        </div>
        <div className="summary-stat">
          <span>Validert:</span>
          <strong>{metrics.validatedForecasts}</strong>
        </div>
        <div className="summary-stat">
          <span>Venter Validering:</span>
          <strong className="pending">{metrics.pendingValidation}</strong>
        </div>
      </div>

      {/* NEW: Accuracy Trend Graph */}
      {metricsHistory.length > 1 && (
        <div style={{
          background: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          padding: 24,
          marginBottom: 24
        }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 700, color: '#1f2937' }}>
            📈 Trend (Siste {metricsHistory.length} målinger)
          </h3>
          
          {/* Simple line graph using SVG */}
          <svg width="100%" height="200" style={{ background: '#f9fafb', borderRadius: 4 }} viewBox="0 0 500 150">
            {/* Grid lines */}
            <line x1="40" y1="130" x2="490" y2="130" stroke="#d1d5db" strokeWidth="1" />
            <line x1="40" y1="90" x2="490" y2="90" stroke="#d1d5db" strokeWidth="1" />
            <line x1="40" y1="50" x2="490" y2="50" stroke="#d1d5db" strokeWidth="1" />
            
            {/* Y-axis labels */}
            <text x="5" y="135" fontSize="10" fill="#6b7280">0%</text>
            <text x="5" y="95" fontSize="10" fill="#6b7280">50%</text>
            <text x="5" y="55" fontSize="10" fill="#6b7280">100%</text>
            
            {/* Accuracy line */}
            <polyline
              points={metricsHistory.map((d, i) => `${40 + (i / (metricsHistory.length - 1)) * 450},${130 - (d.accuracy / 100) * 80}`).join(' ')}
              fill="none"
              stroke="#3B82F6"
              strokeWidth="2"
            />
            
            {/* Current accuracy point */}
            {metricsHistory.length > 0 && (
              <circle
                cx={40 + 450}
                cy={130 - (metricsHistory[metricsHistory.length - 1].accuracy / 100) * 80}
                r="4"
                fill="#3B82F6"
              />
            )}
          </svg>
          
          <p style={{ marginTop: 12, fontSize: 12, color: '#6b7280' }}>
            Nåværende nøyaktighet: <strong style={{ color: '#3B82F6' }}>{metrics.accuracy}%</strong>
            {metricsHistory.length > 1 && (
              <>
                {' | Trend: '}
                <strong style={{ color: metricsHistory[metricsHistory.length - 1].accuracy >= metricsHistory[metricsHistory.length - 2].accuracy ? '#10B981' : '#EF4444' }}>
                  {metricsHistory[metricsHistory.length - 1].accuracy >= metricsHistory[metricsHistory.length - 2].accuracy ? '📈 Forbedring' : '📉 Nedbør'}
                </strong>
              </>
            )}
          </p>
        </div>
      )}

      {/* Result Breakdown */}
      <div className="results-breakdown">
        <h3>Prognose-Resultat (Confusion Matrix)</h3>
        <div className="result-items">
          <div className="result-item tp">
            <div className="result-label">True Positive</div>
            <div className="result-count">{metrics.results.TP}</div>
            <div className="result-desc">Prognostisert HØY → Faktisk HØY ✅</div>
          </div>
          <div className="result-item fp">
            <div className="result-label">False Positive</div>
            <div className="result-count">{metrics.results.FP}</div>
            <div className="result-desc">Prognostisert HØY → Faktisk LAV ❌</div>
          </div>
          <div className="result-item tn">
            <div className="result-label">True Negative</div>
            <div className="result-count">{metrics.results.TN}</div>
            <div className="result-desc">Prognostisert LAV → Faktisk LAV ✅</div>
          </div>
          <div className="result-item fn">
            <div className="result-label">False Negative</div>
            <div className="result-count">{metrics.results.FN}</div>
            <div className="result-desc">Prognostisert LAV → Faktisk HØY ❌</div>
          </div>
        </div>
      </div>

      {/* Validation Controls */}
      <div className="validation-controls">
        <button 
          onClick={autoValidate} 
          disabled={validating || pending.count === 0}
          className="btn-primary"
        >
          {validating ? '⏳ Validerer...' : `✅ Validér ${pending.count} Prognoser (24h+ gamle)`}
        </button>
      </div>

      {/* Pending Forecasts */}
      {pending.count > 0 && (
        <div className="pending-section">
          <h3>⏳ Venter Validering ({pending.count} stk)</h3>
          {/* NEW: Improved table view */}
          <div style={{ overflowX: 'auto', marginBottom: 24 }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 13,
              background: 'white'
            }}>
              <thead>
                <tr style={{ background: '#f3f4f6', borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: 12, textAlign: 'left', fontWeight: 700, color: '#374151' }}>Anlegg</th>
                  <th style={{ padding: 12, textAlign: 'left', fontWeight: 700, color: '#374151' }}>Prognose</th>
                  <th style={{ padding: 12, textAlign: 'left', fontWeight: 700, color: '#374151' }}>Trend</th>
                  <th style={{ padding: 12, textAlign: 'left', fontWeight: 700, color: '#374151' }}>Lus</th>
                  <th style={{ padding: 12, textAlign: 'left', fontWeight: 700, color: '#374151' }}>Status</th>
                  <th style={{ padding: 12, textAlign: 'left', fontWeight: 700, color: '#374151' }}>Prognostisert</th>
                  <th style={{ padding: 12, textAlign: 'center', fontWeight: 700, color: '#374151' }}>Handling</th>
                </tr>
              </thead>
              <tbody>
                {pending.forecasts.slice(0, 20).map((f, idx) => (
                  <tr key={f.id} style={{ 
                    borderBottom: '1px solid #e5e7eb',
                    background: idx % 2 === 0 ? 'white' : '#f9fafb',
                    hover: { background: '#f3f4f6' }
                  }}>
                    <td style={{ padding: 12, fontWeight: 600, color: '#1f2937' }}>{f.facilityName}</td>
                    <td style={{ padding: 12, color: f.forecastRisk >= 70 ? '#DC2626' : f.forecastRisk >= 50 ? '#F59E0B' : '#10B981' }}>
                      <strong>{f.forecastRisk}%</strong>
                    </td>
                    <td style={{ padding: 12 }}>
                      {f.forecastTrend === 'increasing' ? '📈' : f.forecastTrend === 'decreasing' ? '📉' : '➡️'} {f.forecastTrend}
                    </td>
                    <td style={{ padding: 12, color: '#666' }}>{f.liceCount}</td>
                    <td style={{ padding: 12, color: '#666' }}>{f.diseaseStatus}</td>
                    <td style={{ padding: 12, fontSize: 12, color: '#666' }}>
                      {new Date(f.createdAt).toLocaleDateString('no-NO')}
                    </td>
                    <td style={{ padding: 12, textAlign: 'center' }}>
                      <button
                        onClick={() => validateForecast(f.id)}
                        style={{
                          padding: '6px 12px',
                          background: '#10B981',
                          color: 'white',
                          border: 'none',
                          borderRadius: 4,
                          cursor: 'pointer',
                          fontWeight: 600,
                          fontSize: 12
                        }}
                      >
                        Validér
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pending.count > 20 && (
            <p style={{ color: '#666', fontSize: 12, marginBottom: 16 }}>
              Viser 20 av {pending.count} prognoser. Klikk "Validér {pending.count} Prognoser" ovenfor for rask validering.
            </p>
          )}
        </div>
      )}

      {/* Facility History */}
      <div className="history-section">
        <h3>📊 Anleggshistorikk</h3>
        <p className="section-desc">Klikk på et anlegg nedenfor for å se prognose-resultatene</p>
        
        {facilityHistory && (
          <div className="facility-detail">
            <div className="facility-header">
              <h4>{facilityHistory.facilityId}</h4>
              <span className="count">Totalt: {facilityHistory.count} prognoser</span>
            </div>
            
            <div className="history-list">
              {facilityHistory.history.map((entry, idx) => (
                <div key={idx} className={`history-entry result-${entry.result || 'pending'}`}>
                  <div className="entry-date">
                    {new Date(entry.createdAt).toLocaleDateString('no-NO')}
                  </div>
                  <div className="entry-forecast">
                    <span className="badge forecast">Progn: {entry.forecastRisk}%</span>
                    <span className="trend">{entry.forecastTrend}</span>
                  </div>
                  {entry.validated && (
                    <div className="entry-actual">
                      <span className="badge actual">Faktisk: {entry.actualRisk}%</span>
                      <span className={`result-badge ${entry.result}`}>
                        {entry.result === 'TP' && '✅ True Pos'}
                        {entry.result === 'FP' && '❌ False Pos'}
                        {entry.result === 'TN' && '✅ True Neg'}
                        {entry.result === 'FN' && '❌ False Neg'}
                      </span>
                    </div>
                  )}
                  {!entry.validated && (
                    <div className="entry-status pending">
                      ⏳ Venter validering
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <button onClick={() => setFacilityHistory(null)} className="btn-small">
          Tilbake
        </button>
      </div>

      {/* Info Box */}
      <div className="info-box">
        <h4>📝 Hvordan valideringen fungerer:</h4>
        <ol>
          <li><strong>Prognose lagres:</strong> Når risiko beregnes, lagres prognosen (eks: "75% risiko om 5 dager")</li>
          <li><strong>Ventetid:</strong> Systemet venter 24+ timer slik at BarentsWatch har oppdatert data</li>
          <li><strong>Sammenligning:</strong> Systemet sjekker BarentsWatch mot prognosen</li>
          <li><strong>Resultat markeres:</strong>
            <ul>
              <li><strong>TP:</strong> Prognostiserte HØY risiko → faktisk så HØY risiko ✅</li>
              <li><strong>FP:</strong> Prognostiserte HØY risiko → faktisk var det LAV ❌ (falskalarm)</li>
              <li><strong>TN:</strong> Prognostiserte LAV risiko → faktisk var det LAV ✅</li>
              <li><strong>FN:</strong> Prognostiserte LAV risiko → faktisk så HØY risiko ❌ (misset det)</li>
            </ul>
          </li>
          <li><strong>Metrikker:</strong> Fra disse markene beregner systemet nøyaktighet, presisjon, og sensitivitet</li>
        </ol>
      </div>
    </div>
  )
}
