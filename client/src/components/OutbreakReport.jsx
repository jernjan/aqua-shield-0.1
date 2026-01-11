import { useState } from 'react';

export default function OutbreakReport({ farm, onSubmit, onClose }) {
  const [formData, setFormData] = useState({
    diseaseType: 'lus',
    severity: 'høy',
    description: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const diseaseTypes = [
    { value: 'lus', label: 'Lus (Sea Lice)' },
    { value: 'spd', label: 'Salmon Pancreas Disease (SPD)' },
    { value: 'isa', label: 'Infectious Salmon Anaemia (ISA)' },
    { value: 'hvs', label: 'Hitra Virus Syndrome (HVS)' },
    { value: 'annet', label: 'Annet' },
  ];

  const severityLevels = [
    { value: 'lav', label: '🟢 Lav', color: '#27ae60' },
    { value: 'moderat', label: '🟡 Moderat', color: '#f39c12' },
    { value: 'høy', label: '🔴 Høy', color: '#e74c3c' },
    { value: 'kritisk', label: '⚫ Kritisk', color: '#c0392b' },
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:3001/api/datalog/alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          farmId: farm.id,
          farmName: farm.name,
          title: `${formData.diseaseType.toUpperCase()} - ${formData.severity}`,
          severity: formData.severity,
          type: 'disease',
          description: formData.description,
          timestamp: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSuccess(true);
        setTimeout(() => {
          onSubmit && onSubmit(data);
          onClose && onClose();
        }, 1500);
      } else {
        const err = await response.json();
        setError(err.message || 'Feil ved innsending');
      }
    } catch (err) {
      setError(`Feil: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
    }}>
      <div style={{
        background: 'var(--bg-surface)',
        border: `1px solid var(--border-color)`,
        borderRadius: 8,
        padding: 32,
        maxWidth: 500,
        width: '90%',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      }}>
        <h2 style={{ marginBottom: 8, color: 'var(--accent-gold)' }}>🚨 Meld Inn Utbrudd</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 14 }}>
          Anlegg: <strong>{farm.name}</strong>
        </p>

        {success ? (
          <div style={{
            background: 'rgba(39, 174, 96, 0.1)',
            border: '1px solid var(--accent-green)',
            borderRadius: 4,
            padding: 16,
            color: 'var(--accent-green)',
            textAlign: 'center',
          }}>
            ✓ Utbrudd meldt inn! Alert sendt til Mattilsynet.
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Disease Type */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
                Sykdomstype:
              </label>
              <select
                name="diseaseType"
                value={formData.diseaseType}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: 10,
                  background: 'var(--bg-dark)',
                  border: `1px solid var(--border-color)`,
                  borderRadius: 4,
                  color: 'var(--text-primary)',
                  fontSize: 14,
                }}
              >
                {diseaseTypes.map(d => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>

            {/* Severity */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
                Alvorlighetsgrad:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {severityLevels.map(level => (
                  <button
                    key={level.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, severity: level.value }))}
                    style={{
                      padding: 10,
                      background: formData.severity === level.value ? level.color : 'var(--bg-dark)',
                      border: `2px solid ${level.color}`,
                      borderRadius: 4,
                      color: formData.severity === level.value ? '#fff' : 'var(--text-primary)',
                      cursor: 'pointer',
                      fontWeight: 600,
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {level.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
                Beskrivelse (valgfritt):
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Beskriv situasjonen..."
                style={{
                  width: '100%',
                  padding: 10,
                  background: 'var(--bg-dark)',
                  border: `1px solid var(--border-color)`,
                  borderRadius: 4,
                  color: 'var(--text-primary)',
                  fontSize: 14,
                  minHeight: 100,
                  fontFamily: 'inherit',
                }}
              />
            </div>

            {error && (
              <div style={{
                background: 'rgba(231, 76, 60, 0.1)',
                border: '1px solid var(--accent-red)',
                borderRadius: 4,
                padding: 10,
                color: 'var(--accent-red)',
                marginBottom: 20,
                fontSize: 13,
              }}>
                {error}
              </div>
            )}

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: 12,
                  background: 'var(--bg-dark)',
                  border: `1px solid var(--border-color)`,
                  borderRadius: 4,
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  transition: 'all 0.2s ease',
                  opacity: loading ? 0.5 : 1,
                }}
              >
                Avbryt
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{
                  flex: 1,
                  padding: 12,
                  background: loading ? 'var(--text-secondary)' : 'var(--accent-red)',
                  border: 'none',
                  borderRadius: 4,
                  color: '#fff',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  transition: 'all 0.2s ease',
                }}
              >
                {loading ? '⏳ Sender...' : '🚨 Meld Inn'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
