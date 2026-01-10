import { useState, useEffect } from 'react';
import styles from './Login.module.css';

// Mock users matching backend
const MOCK_USERS = {
  'arne@farms.no': { id: 'user_1', name: 'Arne Anleggmann', email: 'arne@farms.no', role: 'farmer', password: 'demo' },
  'berit@farms.no': { id: 'user_2', name: 'Berit Fiskeoppdrett', email: 'berit@farms.no', role: 'farmer', password: 'demo' },
  'kare@shipping.no': { id: 'user_3', name: 'Kåre Båtrederi', email: 'kare@shipping.no', role: 'vessel_operator', password: 'demo' },
  'siri@shipping.no': { id: 'user_4', name: 'Siri Sjøtransport', email: 'siri@shipping.no', role: 'vessel_operator', password: 'demo' },
};

function Login({ onLogin, onMVPLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState('');

  useEffect(() => {
    // Check for existing session
    const saved = localStorage.getItem('aquashield_user');
    if (saved) {
      const user = JSON.parse(saved);
      onLogin(user.id, user);
    }
  }, [onLogin]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        // Mock login - check MOCK_USERS
        const user = MOCK_USERS[email];
        if (user && user.password === password) {
          // Save to localStorage for persistence
          localStorage.setItem('aquashield_user', JSON.stringify(user));
          onLogin(user.id, user);
        } else {
          setError('Invalid email or password. Try: arne@farms.no, berit@farms.no, kare@shipping.no, siri@shipping.no (all password: demo)');
        }
      } else {
        // Registration not implemented for demo
        setError('Registration not available in demo mode');
      }
    } catch (err) {
      setError(err.message || 'Authentication error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>AQUASHIELD</h1>
        <p className={styles.subtitle}>Varslingssystem for norsk akvakultur</p>
      </div>

      <div className={styles.card}>
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${isLogin ? styles.active : ''}`}
            onClick={() => setIsLogin(true)}
          >
            Logg inn
          </button>
          <button
            className={`${styles.tab} ${!isLogin ? styles.active : ''}`}
            onClick={() => setIsLogin(false)}
          >
            Registrer
          </button>
        </div>
  {error && <div style={{ color: '#ff6b6b', marginBottom: '1rem', padding: '0.75rem', backgroundColor: 'rgba(255,107,107,0.1)', borderRadius: '4px' }}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label className={styles.label}>E-post</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={styles.input}
              placeholder="din@email.no"
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Passord</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={styles.input}
              placeholder="••••••••"
            />
          </div>

          {!isLogin && (
            <>
              <div className={styles.formGroup}>
                <label className={styles.label}>Navn</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className={styles.input}
                  placeholder="Ditt navn"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Telefon</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={styles.input}
                  placeholder="+47 XXX XX XXX"
                />
              </div>
            </>
          )}

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={loading}
          >
            {loading ? 'Behandler...' : isLogin ? 'Logg inn' : 'Registrer'}
          </button>
        </form>
      </div>

      <div className={styles.divider}>
        <span>Eller velg rolle for demo</span>
      </div>

      <div className={styles.mvpRoles}>
        <button
          onClick={() => onMVPLogin('farmer')}
          className={styles.roleBtn}
        >
          <div className={styles.roleIcon}>A</div>
          <div className={styles.roleLabel}>Anleggseier</div>
          <div className={styles.roleDesc}>Fiskeoppdrett</div>
        </button>

        <button
          onClick={() => onMVPLogin('vessel')}
          className={styles.roleBtn}
        >
          <div className={styles.roleIcon}>B</div>
          <div className={styles.roleLabel}>Brønnbåt</div>
          <div className={styles.roleDesc}>Transportbåt</div>
        </button>

        <button
          onClick={() => onMVPLogin('admin')}
          className={styles.roleBtn}
        >
          <div className={styles.roleIcon}>R</div>
          <div className={styles.roleLabel}>Regulator</div>
          <div className={styles.roleDesc}>Mattilsynet</div>
        </button>

        <button
          onClick={() => onMVPLogin('analytics')}
          className={styles.roleBtn}
        >
          <div className={styles.roleIcon}>📊</div>
          <div className={styles.roleLabel}>Analytics</div>
          <div className={styles.roleDesc}>Rapporter & Analyse</div>
        </button>
      </div>
    </div>
  );
}

export default Login;
