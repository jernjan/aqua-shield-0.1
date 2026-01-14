import { useState } from 'react';

export default function RoleSelector({ onRoleSelect, currentRole }) {
  const [selectedRole, setSelectedRole] = useState(currentRole || 'farmer');

  const roles = [
    { id: 'farmer', label: '🐟 Anleggsbruker', color: '#8B5CF6', desc: 'Overvåk dine anlegg' },
    { id: 'brønnbåt', label: '⛵ Båtoperatør', color: '#06B6D4', desc: 'Overvåk din båt' },
    { id: 'admin', label: '⚙️ Administrator', color: '#F59E0B', desc: 'Administrasjon' }
  ];

  const handleSelectRole = (roleId) => {
    setSelectedRole(roleId);
    onRoleSelect(roleId);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      padding: 20
    }}>
      <div>
        <h2 style={{ margin: '0 0 8px 0', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
          Velg rolle
        </h2>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
          Velg din rolle for å komme i gang
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
        {roles.map(role => (
          <button
            key={role.id}
            onClick={() => handleSelectRole(role.id)}
            style={{
              padding: '16px 20px',
              background: selectedRole === role.id ? role.color : 'rgba(255,255,255,0.05)',
              color: selectedRole === role.id ? '#000' : 'var(--text-primary)',
              border: `2px solid ${selectedRole === role.id ? role.color : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: 14,
              transition: 'all 0.2s ease',
              textAlign: 'left',
              display: 'flex',
              flexDirection: 'column',
              gap: 6
            }}
            onMouseEnter={(e) => {
              if (selectedRole !== role.id) {
                e.target.style.background = 'rgba(255,255,255,0.1)';
                e.target.style.transform = 'scale(1.02)';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedRole !== role.id) {
                e.target.style.background = 'rgba(255,255,255,0.05)';
                e.target.style.transform = 'scale(1)';
              }
            }}
          >
            <span style={{ fontSize: 16 }}>{role.label}</span>
            <span style={{ fontSize: 11, opacity: 0.7, fontWeight: 400 }}>{role.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
