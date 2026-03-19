import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/Login.css'

const DEMO_USERS = [
  {
    id: 1,
    name: '🐟 Anlegg',
    role: 'Anleggsbruker',
    email: 'anlegg@example.com',
    description: 'Laksefarmer'
  },
  {
    id: 2,
    name: '⛵ Båt',
    role: 'Administrator',
    email: 'bat@example.com',
    description: 'Wellbåt operatør'
  },
  {
    id: 3,
    name: '⚙️ Administrator',
    role: 'Administrator',
    email: 'admin@example.com',
    description: 'System administrator'
  }
]

function Login() {
  const [selectedUser, setSelectedUser] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser')
    if (savedUser) {
      navigate('/dashboard')
    }
  }, [navigate])

  const handleSelectUser = (user) => {
    localStorage.setItem('currentUser', JSON.stringify(user))
    setSelectedUser(user)
    setTimeout(() => navigate('/dashboard'), 300)
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>🌊 AquaShield</h1>
        <p className="subtitle">Akvakultur Varsling System</p>

        <div className="demo-notice">
          <p>Demo-modus: Velg bruker for å fortsette (ingen passord nødvendig)</p>
        </div>

        <div className="users-grid">
          {DEMO_USERS.map((user) => (
            <button
              key={user.id}
              className={'user-card' + (selectedUser?.id === user.id ? ' selected' : '')}
              onClick={() => handleSelectUser(user)}
            >
              <div className="user-emoji">{user.name.split(' ')[0]}</div>
              <h3>{user.name.substring(2)}</h3>
              <p className="role">{user.role}</p>
              <p className="description">{user.description}</p>
            </button>
          ))}
        </div>

        <div className="info-box">
          <h4>ℹ️ Om denne demoen</h4>
          <ul>
            <li>Velg en bruker ovenfor for å logge inn</li>
            <li>Alle funksjoner er tilgjengelige for testing</li>
            <li>Data blir hentet fra BarentsWatch API</li>
            <li>Ingen autentisering er påkrevd for MVP</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default Login
