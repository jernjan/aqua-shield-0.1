import { useState } from 'react';
import styles from './Login.module.css';

function Login({ onLogin }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Demo users from server
  const DEMO_USERS = [
    { id: 'movi', name: 'Movi Anleggsbruker', role: 'farmer', icon: '🐟' },
    { id: 'aakerblå', name: 'Aakerblå Båtrederi', role: 'brønnbåt', icon: '⛵' },
    { id: 'admin', name: 'Administrator', role: 'admin', icon: '⚙️' }
  ];

  const handleLogin = async (userId) => {
    setLoading(true);
    setError('');

    try {
      // Find the user
      const user = DEMO_USERS.find(u => u.id === userId);
      if (!user) {
        setError('Bruker ikke funnet');
        setLoading(false);
        return;
      }

      // Save to localStorage
      localStorage.setItem('aquashield_user', JSON.stringify(user));
      
      // Call parent handler with user data
      onLogin(user.id, user);
    } catch (err) {
      setError(err.message || 'Login feilet');
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>🐠 AQUASHIELD</h1>
        <p className={styles.subtitle}>Smittevern for norsk akvakultur</p>
      </div>

      <div className={styles.card}>
        <h2 style={{ marginTop: 0, marginBottom: 24, fontSize: 18, color: 'var(--text-primary)' }}>
          Velg bruker for å logge inn
        </h2>

        {error && (
          <div style={{
            color: '#ff6b6b',
            marginBottom: '1rem',
            padding: '0.75rem',
            backgroundColor: 'rgba(255,107,107,0.1)',
            borderRadius: '4px',
            fontSize: 12
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gap: 12, marginBottom: 24 }}>
          {DEMO_USERS.map(user => (
            <button
              key={user.id}
              onClick={() => handleLogin(user.id)}
              disabled={loading}
              style={{
                padding: '16px 20px',
                background: 'var(--bg-elevated)',
                border: '2px solid var(--border-color)',
                borderRadius: 8,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                transition: 'all 0.2s ease',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                color: 'var(--text-primary)',
                fontWeight: 500,
                fontSize: 14
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.target.style.borderColor = 'var(--accent-gold)';
                  e.target.style.background = 'rgba(217, 119, 6, 0.1)';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.target.style.borderColor = 'var(--border-color)';
                  e.target.style.background = 'var(--bg-elevated)';
                }
              }}
            >
              <span style={{ fontSize: 20 }}>{user.icon}</span>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 2 }}>{user.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Rolle: {user.role === 'farmer' ? 'Anleggsbruker' : user.role === 'vessel' ? 'Båtoperatør' : 'Administrator'}
                </div>
              </div>
            </button>
          ))}
        </div>

        <div style={{
          padding: 12,
          background: 'rgba(59, 130, 246, 0.1)',
          border: '1px solid #3B82F6',
          borderRadius: 6,
          fontSize: 12,
          color: '#3B82F6',
          lineHeight: '1.5'
        }}>
          <strong>Demo-brukere:</strong> Velg bruker over for å logge inn. Ingen passord nødvendig.
        </div>
      </div>
    </div>
  );
}

export default Login;
