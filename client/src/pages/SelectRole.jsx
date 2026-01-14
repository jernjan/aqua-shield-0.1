import { useState } from 'react';
import RoleSelector from '../components/RoleSelector';

export default function SelectRole({ onRoleSelected }) {
  const [selectedRole, setSelectedRole] = useState('farmer');

  const handleContinue = () => {
    if (onRoleSelected) {
      onRoleSelected(selectedRole);
    }
  };

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      background: 'var(--bg-dark)',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        background: 'var(--bg-surface)',
        border: '2px solid var(--border-color)',
        borderRadius: 12,
        padding: '40px',
        maxWidth: '400px',
        width: '90%',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 30 }}>
          <h1 style={{ margin: '0 0 8px 0', fontSize: 28, fontWeight: 700, color: 'var(--accent-gold)' }}>
            🐠 AquaShield
          </h1>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
            Smittevern for norsk akvakultur
          </p>
        </div>

        <RoleSelector onRoleSelect={setSelectedRole} currentRole={selectedRole} />

        <button
          onClick={handleContinue}
          style={{
            marginTop: 24,
            width: '100%',
            padding: '14px 20px',
            background: 'var(--accent-gold)',
            color: '#000',
            border: 'none',
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 14,
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = 'scale(1.02)';
            e.target.style.boxShadow = '0 4px 12px rgba(217, 119, 6, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'scale(1)';
            e.target.style.boxShadow = 'none';
          }}
        >
          → Gå videre
        </button>
      </div>
    </div>
  );
}
