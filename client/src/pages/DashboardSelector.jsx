import React from 'react'
import './DashboardSelector.css'

export default function DashboardSelector({ onSelectDashboard, user }) {
  const dashboards = [
    {
      id: 'farmer-dashboard',
      title: '🌾 Mine Anlegg',
      description: 'Se risiko for alle dine lakseanlegg, 7-dagers prognose og anbefalte tiltak',
      icon: '🌾',
      color: '#10B981',
      roles: ['farmer', 'admin']
    },
    {
      id: 'vessel-dashboard',
      title: '⛵ Båt-Oversikt',
      description: 'Se anlegg i nærheten, avstand og nødvendige karantenetiltak',
      icon: '⛵',
      color: '#06B6D4',
      roles: ['vessel', 'admin', 'brønnbåt'] // brønnbåt is vessel role in MVP
    },
    {
      id: 'mvp-admin',
      title: '📊 Admin-Panel',
      description: 'Administratorverktøy: Risiko-analyse, validering, distribusjon, monitoring',
      icon: '📊',
      color: '#F59E0B',
      roles: ['admin']
    },
    {
      id: 'validation-dashboard',
      title: '✅ Validering',
      description: 'Spor prognoser mot faktiske data, nøyaktighet og presisjon',
      icon: '✅',
      color: '#8B5CF6',
      roles: ['admin']
    }
  ];

  // Filter dashboards based on user role
  const userRole = user?.role || 'farmer';
  const availableDashboards = dashboards.filter(d => d.roles.includes(userRole));

  return (
    <div className="dashboard-selector">
      <div className="selector-header">
        <h1>🎯 Velg Dashbord</h1>
        <p className="selector-subtitle">Hva ønsker du å gjøre?</p>
      </div>

      <div className="dashboards-grid">
        {availableDashboards.map(dashboard => (
          <div 
            key={dashboard.id}
            className="dashboard-card"
            onClick={() => onSelectDashboard(dashboard.id)}
            style={{ borderTopColor: dashboard.color }}
          >
            <div className="card-icon">{dashboard.icon}</div>
            <h3>{dashboard.title}</h3>
            <p>{dashboard.description}</p>
            <div className="card-footer">
              <span className="arrow">→</span>
            </div>
          </div>
        ))}
      </div>

      <div className="selector-info">
        <div className="info-box">
          <h4>💡 Tips:</h4>
          <ul>
            <li><strong>Mine Anlegg:</strong> Din daglige oversikt over anlegg og risiko</li>
            <li><strong>Båt-Oversikt:</strong> Sjekk anlegg i nærheten før du drar</li>
            <li><strong>Admin-Panel:</strong> Systemadministrasjon og analyse</li>
            <li><strong>Validering:</strong> Spor nøyaktigheten av systemet over tid</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
