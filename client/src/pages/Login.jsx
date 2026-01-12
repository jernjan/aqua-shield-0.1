import { useState, useEffect, useCallback, memo } from 'react';
import { MOCK_USERS } from '../mocks/data';
import styles from './Login.module.css';

// Memoized role button to prevent re-renders
const RoleButton = memo(({ label, desc, icon, onClick }) => (
  <button
    onClick={onClick}
    className={styles.roleBtn}
  >
    <div className={styles.roleIcon}>{icon}</div>
    <div className={styles.roleLabel}>{label}</div>
    <div className={styles.roleDesc}>{desc}</div>
  </button>
));

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

  // Memoize MVP login handler
  const handleMVPRole = useCallback((role) => {
    onMVPLogin(role);
  }, [onMVPLogin]);

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
          setError('Invalid email or password. Try demo accounts: arne@farms.no, berit@farms.no, kare@shipping.no, siri@shipping.no, lars@fisher.no, gunnar@fisher.no, admin@aquashield.no (all password: demo)');
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
        <RoleButton 
          label="Anleggseier"
          desc="Fiskeoppdrett"
          icon="A"
          onClick={() => handleMVPRole('farmer')}
        />

        <RoleButton 
          label="Brønnbåt"
          desc="Transportbåt"
          icon="B"
          onClick={() => handleMVPRole('vessel')}
        />

        <RoleButton 
          label="Admin"
          desc="Din private dashboard"
          icon="⚙️"
          onClick={() => handleMVPRole('admin')}
        />

        <RoleButton 
          label="Analytics"
          desc="Rapporter & Analyse"
          icon="📊"
          onClick={() => handleMVPRole('analytics')}
        />

        <RoleButton 
          label="Yrkesfisker"
          desc="Smittesone-kart"
          icon="🎣"
          onClick={() => handleMVPRole('fisher')}
        />
      </div>
    </div>
  );
}

export default Login;
