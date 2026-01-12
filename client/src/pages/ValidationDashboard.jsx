import React, { useState, useEffect } from 'react'
import './ValidationDashboard.css'

export default function ValidationDashboard() {
  const [metrics, setMetrics] = useState(null)
  const [pending, setPending] = useState(null)
  const [selectedFacility, setSelectedFacility] = useState(null)
  const [facilityHistory, setFacilityHistory] = useState(null)
  const [loading, setLoading] = useState(false)
  const [validating, setValidating] = useState(false)

  // Load metrics and pending forecasts
  useEffect(() => {
    loadDashboard()
    const interval = setInterval(loadDashboard, 60000) // Refresh every minute
    return () => clearInterval(interval)
  }, [])

  async function loadDashboard() {
    try {
      setLoading(true)
      const [metricsRes, pendingRes] = await Promise.all([
        fetch('/api/admin/validation/metrics'),
        fetch('/api/admin/validation/pending')
      ])
      
      const metricsData = await metricsRes.json()
      const pendingData = await pendingRes.json()
      
      setMetrics(metricsData)
      setPending(pendingData)
    } catch (err) {
      console.error('Error loading dashboard:', err)
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
          <div className="pending-list">
            {pending.forecasts.slice(0, 10).map(f => (
              <div key={f.id} className="pending-item">
                <div className="pending-info">
                  <div className="facility-name">{f.facilityName}</div>
                  <div className="forecast-details">
                    Prognose: {f.forecastRisk}% ({f.forecastTrend}) • Lus: {f.liceCount} • {f.diseaseStatus}
                  </div>
                  <div className="forecast-date">
                    Prognostisert: {new Date(f.createdAt).toLocaleDateString('no-NO')}
                  </div>
                </div>
                <button
                  onClick={() => validateForecast(f.id)}
                  className="btn-small"
                >
                  Validér nå
                </button>
              </div>
            ))}
          </div>
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
