import { useState } from 'react'
import axios from 'axios'

function Login({ onLogin, onToast }) {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register'
      const payload = isLogin
        ? { email, password }
        : { email, password, name, phone }

      const response = await axios.post(endpoint, payload)
      const { token, user } = response.data

      onLogin(token, user)
    } catch (err) {
      onToast(err.response?.data?.error || 'Feil ved autentisering', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
        <h1 style={{ textAlign: 'center', marginBottom: '20px' }}>🐟 AquaShield</h1>
        <p style={{ textAlign: 'center', marginBottom: '30px', color: '#666' }}>
          Varsling for norsk akvakultur
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '4px' }}>E-post:</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '4px' }}>Passord:</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ width: '100%' }}
            />
          </div>

          {!isLogin && (
            <>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px' }}>Navn:</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px' }}>Telefon:</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
            </>
          )}

          <button
            type="submit"
            className="primary"
            style={{ width: '100%', marginBottom: '12px' }}
            disabled={loading}
          >
            {loading ? 'Venter...' : isLogin ? 'Logg inn' : 'Registrer'}
          </button>
        </form>

        <button
          onClick={() => setIsLogin(!isLogin)}
          className="secondary"
          style={{ width: '100%' }}
        >
          {isLogin ? 'Opprett bruker' : 'Allerede bruker?'}
        </button>
      </div>
    </div>
  )
}

export default Login
