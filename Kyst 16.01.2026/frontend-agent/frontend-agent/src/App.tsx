import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import './App.css';

function Dashboard() {
  return (
    <div>
      <h2>Agent Dashboard</h2>
      <ul>
        <li><Link to="/status">Agentstatus</Link></li>
        <li><Link to="/data">Datavisualisering</Link></li>
        <li><Link to="/notifications">Varsler</Link></li>
      </ul>
    </div>
  );
}

function AgentStatus() {
  const agents = [
    { name: 'API-agent', type: 'backend', status: 'OK', lastCheck: '2026-01-20 10:15' },
    { name: 'ML-agent', type: 'backend', status: 'OK', lastCheck: '2026-01-20 10:15' },
    { name: 'Ingestion-agent', type: 'backend', status: 'OK', lastCheck: '2026-01-20 10:15' },
    { name: 'Frontend-agent', type: 'frontend', status: 'OK', lastCheck: '2026-01-20 10:15' },
    { name: 'Notification-agent', type: 'backend', status: 'OK', lastCheck: '2026-01-20 10:15' },
  ];

  return (
    <div>
      <h3>Status for alle agenter</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>Navn</th>
            <th>Type</th>
            <th>Status</th>
            <th>Sist sjekket</th>
          </tr>
        </thead>
        <tbody>
          {agents.map(agent => (
            <tr key={agent.name}>
              <td>{agent.name}</td>
              <td>{agent.type}</td>
              <td style={{ color: agent.status === 'OK' ? 'green' : 'red' }}>{agent.status}</td>
              <td>{agent.lastCheck}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DataVisualization() {
  return <div><h3>Datavisualisering</h3><p>Her kommer grafer og analyser.</p></div>;
}

function Notifications() {
  return <div><h3>Varsler</h3><p>Her vises systemvarsler og meldinger.</p></div>;
}

function App() {
  return (
    <Router>
      <div className="dashboard-layout">
        <header>
          <h1>Kyst Monitor Dashboard</h1>
          <nav>
            <Link to="/">Hjem</Link> |{' '}
            <Link to="/status">Agentstatus</Link> |{' '}
            <Link to="/data">Datavisualisering</Link> |{' '}
            <Link to="/notifications">Varsler</Link>
          </nav>
        </header>
        <main>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/status" element={<AgentStatus />} />
            <Route path="/data" element={<DataVisualization />} />
            <Route path="/notifications" element={<Notifications />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
