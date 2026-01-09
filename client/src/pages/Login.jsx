import { useState } from 'react';
import styles from './Login.module.css';

function Login({ onLogin, onMVPLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const payload = isLogin
        ? { email, password }
        : { email, password, name, phone };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (response.ok) {
        onLogin(data.token, data.user);
      } else {
        console.error(data.error);
      }
    } catch (err) {
      console.error('Auth error:', err);
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
          onClick={() => onMVPLogin('public')}
          className={styles.roleBtn}
        >
          <div className={styles.roleIcon}>O</div>
          <div className={styles.roleLabel}>Offentlig</div>
          <div className={styles.roleDesc}>Område-varsler</div>
        </button>
      </div>
    </div>
  );
}

export default Login;
