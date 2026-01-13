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
  
  // BACKTESTING STATE
  const [activeTab, setActiveTab] = useState('validation') // 'validation' or 'backtesting'
  const [btStartDate, setBtStartDate] = useState('2024-01-01')
  const [btEndDate, setBtEndDate] = useState('2024-12-31')
  const [btStep, setBtStep] = useState('7days')
  const [btJobId, setBtJobId] = useState(null)
  const [btJobStatus, setBtJobStatus] = useState(null)
  const [btResults, setBtResults] = useState(null)
  const [btLoading, setBtLoading] = useState(false)
  const [btMode, setBtMode] = useState('setup') // 'setup', 'running', 'results'

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

  // BACKTESTING FUNCTIONS
  async function startBacktest() {
    try {
      setBtLoading(true)
      setBtMode('running')
      setBtResults(null)

      const res = await fetch('/api/admin/backtest/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate: btStartDate, endDate: btEndDate, step: btStep })
      })

      if (!res.ok) throw new Error('Failed to start backtest')
      
      const data = await res.json()
      setBtJobId(data.jobId)
      
      // Start monitoring
      monitorBacktest(data.jobId)
    } catch (err) {
      console.error('Backtest error:', err)
      setBtMode('setup')
    } finally {
      setBtLoading(false)
    }
  }

  async function monitorBacktest(jobId) {
    const checkInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/admin/backtest/status/${jobId}`)
        if (!res.ok) return

        const status = await res.json()
        setBtJobStatus(status)

        if (status.status === 'completed') {
          clearInterval(checkInterval)
          setBtResults(status.result)
          setBtMode('results')
        }
      } catch (err) {
        console.error('Monitor error:', err)
      }
    }, 20000) // Check every 20 seconds
  }

  if (!metrics || !pending) {
    return <div className="validation-dashboard loading">Laster data...</div>
  }

  return (
    <div className="validation-dashboard">
      <h1>🔍 Validerings-Dashboard</h1>
      <p className="subtitle">Sammenlign prognoser mot faktiske BarentsWatch-data</p>

      {/* TAB SELECTOR */}
      <div style={{
        display: 'flex',
        gap: 8,
        marginBottom: 24,
        borderBottom: '2px solid #e5e7eb',
        paddingBottom: 12
      }}>
        <button
          onClick={() => setActiveTab('validation')}
          style={{
            padding: '8px 16px',
            background: activeTab === 'validation' ? '#3B82F6' : 'transparent',
            color: activeTab === 'validation' ? 'white' : '#6B7280',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: 14
          }}
        >
          ✅ Validering (Forecast-basert)
        </button>
        <button
          onClick={() => setActiveTab('backtesting')}
          style={{
            padding: '8px 16px',
            background: activeTab === 'backtesting' ? '#3B82F6' : 'transparent',
            color: activeTab === 'backtesting' ? 'white' : '#6B7280',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: 14
          }}
        >
          🧪 Backtesting (Historisk data)
        </button>
      </div>

      {/* BACKTESTING TAB */}
      {activeTab === 'backtesting' && (
        <div style={{ marginTop: 24 }}>
          {btMode === 'setup' && (
            <div style={{
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              padding: 24,
              marginBottom: 24
            }}>
              <h2 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 700 }}>🧪 Backtesting</h2>
              <p style={{ color: '#666', marginBottom: 20 }}>
                Velg en historisk periode, kjør algoritmen som om det var på den tiden, og se hvor nøyaktig den ville ha vært.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 14 }}>Startdato</label>
                  <input
                    type="date"
                    value={btStartDate}
                    onChange={(e) => setBtStartDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: 4,
                      fontSize: 14
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 14 }}>Sluttdato</label>
                  <input
                    type="date"
                    value={btEndDate}
                    onChange={(e) => setBtEndDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: 4,
                      fontSize: 14
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 14 }}>Tidssteg</label>
                  <select
                    value={btStep}
                    onChange={(e) => setBtStep(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: 4,
                      fontSize: 14
                    }}
                  >
                    <option value="1day">Daglig</option>
                    <option value="7days">Ukentlig (7 dager)</option>
                    <option value="14days">Annenhver uke (14 dager)</option>
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button
                    onClick={startBacktest}
                    disabled={btLoading}
                    style={{
                      width: '100%',
                      padding: '10px 16px',
                      background: '#3B82F6',
                      color: 'white',
                      border: 'none',
                      borderRadius: 4,
                      cursor: btLoading ? 'not-allowed' : 'pointer',
                      fontWeight: 600,
                      opacity: btLoading ? 0.6 : 1
                    }}
                  >
                    {btLoading ? '⏳ Starter...' : '🚀 Start'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {btMode === 'running' && btJobStatus && (
            <div style={{
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              padding: 24,
              marginBottom: 24
            }}>
              <h2 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 700 }}>⏳ Backtesting kjører...</h2>
              <div style={{ background: '#f3f4f6', borderRadius: 4, padding: 16, marginBottom: 16 }}>
                <div style={{
                  background: '#dbeafe',
                  height: 8,
                  borderRadius: 4,
                  overflow: 'hidden'
                }}>
                  <div
                    style={{
                      width: `${btJobStatus.progress}%`,
                      height: '100%',
                      background: '#3B82F6',
                      transition: 'width 0.3s'
                    }}
                  />
                </div>
                <p style={{ marginTop: 12, fontWeight: 600, color: '#1f2937' }}>
                  {btJobStatus.progress}% - Prosesserer {btJobStatus.currentDate}
                </p>
                <p style={{ marginTop: 4, fontSize: 12, color: '#6b7280' }}>
                  Periode: {btJobStatus.startDate} til {btJobStatus.endDate}
                </p>
              </div>
            </div>
          )}

          {btMode === 'results' && btResults && (
            <div style={{
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              padding: 24,
              marginBottom: 24
            }}>
              <h2 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 700 }}>✅ Backtesting Fullført!</h2>
              
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr 1fr',
                gap: 16,
                marginBottom: 24
              }}>
                <div style={{
                  background: '#f0fdf4',
                  border: '1px solid #dcfce7',
                  borderRadius: 6,
                  padding: 16
                }}>
                  <div style={{ fontSize: 12, color: '#166534', fontWeight: 600 }}>Nøyaktighet</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#16a34a', marginTop: 4 }}>
                    {(btResults.sensitivity * 100).toFixed(1)}%
                  </div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>True Positive Rate</div>
                </div>

                <div style={{
                  background: '#fef3c7',
                  border: '1px solid #fcd34d',
                  borderRadius: 6,
                  padding: 16
                }}>
                  <div style={{ fontSize: 12, color: '#92400e', fontWeight: 600 }}>Spesifisitet</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#f59e0b', marginTop: 4 }}>
                    {(btResults.specificity * 100).toFixed(1)}%
                  </div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>True Negative Rate</div>
                </div>

                <div style={{
                  background: '#dbeafe',
                  border: '1px solid #93c5fd',
                  borderRadius: 6,
                  padding: 16
                }}>
                  <div style={{ fontSize: 12, color: '#1e40af', fontWeight: 600 }}>Presisjon</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#3b82f6', marginTop: 4 }}>
                    {(btResults.precision * 100).toFixed(1)}%
                  </div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>Positive Predictive Value</div>
                </div>

                <div style={{
                  background: '#f5e6ff',
                  border: '1px solid #e9d5ff',
                  borderRadius: 6,
                  padding: 16
                }}>
                  <div style={{ fontSize: 12, color: '#6b21a8', fontWeight: 600 }}>F1 Score</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#a855f7', marginTop: 4 }}>
                    {btResults.f1.toFixed(3)}
                  </div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>Harmonisk gjennomsnitt</div>
                </div>
              </div>

              <div style={{
                background: '#f9fafb',
                borderRadius: 6,
                padding: 16,
                marginBottom: 16
              }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 700 }}>Confusion Matrix</h3>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr 1fr',
                  gap: 12
                }}>
                  <div style={{ textAlign: 'center', padding: 12, background: '#ecfdf5', borderRadius: 4 }}>
                    <div style={{ fontSize: 12, color: '#65a30d', fontWeight: 600 }}>TP</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#16a34a' }}>{btResults.truePositives}</div>
                    <div style={{ fontSize: 10, color: '#6b7280', marginTop: 4 }}>Korrekt prognose HØY</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: 12, background: '#fef2f2', borderRadius: 4 }}>
                    <div style={{ fontSize: 12, color: '#dc2626', fontWeight: 600 }}>FP</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#dc2626' }}>{btResults.falsePositives}</div>
                    <div style={{ fontSize: 10, color: '#6b7280', marginTop: 4 }}>Falskalarm</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: 12, background: '#eff6ff', borderRadius: 4 }}>
                    <div style={{ fontSize: 12, color: '#0369a1', fontWeight: 600 }}>TN</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#3b82f6' }}>{btResults.trueNegatives}</div>
                    <div style={{ fontSize: 10, color: '#6b7280', marginTop: 4 }}>Korrekt prognose LAV</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: 12, background: '#fef3f2', borderRadius: 4 }}>
                    <div style={{ fontSize: 12, color: '#ea580c', fontWeight: 600 }}>FN</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#f97316' }}>{btResults.falseNegatives}</div>
                    <div style={{ fontSize: 10, color: '#6b7280', marginTop: 4 }}>Misset utbrudd</div>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setBtMode('setup')}
                style={{
                  padding: '10px 16px',
                  background: '#3B82F6',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Kjør ny test
              </button>
            </div>
          )}
        </div>
      )}

      {/* VALIDATION TAB - ORIGINAL CONTENT */}
      {activeTab === 'validation' && (
        <div>
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
      )}

      {/* BACKTESTING TAB */}
      {activeTab === 'backtesting' && (
        <div className="backtesting-section">
          {/* Backtesting content will be here */}
          <p>Backtesting mode (to be implemented)</p>
        </div>
      )}
    </div>
  )
}
