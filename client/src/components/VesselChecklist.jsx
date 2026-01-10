import { useMemo } from 'react';

// Checklist for vessel tasks with server persistence via parent callback
export default function VesselChecklist({ tasks = [], onToggleComplete }) {
  const items = useMemo(() => {
    return tasks.map(t => ({
      id: t.id,
      title: t.name,
      type: t.type,
      dueDate: t.dueDate,
      duration: t.duration,
      chemicals: t.chemicals || [],
      done: (t.status || '').toLowerCase() === 'fullført',
    }))
  }, [tasks]);

  if (items.length === 0) {
    return <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Ingen sjekkpunkter</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map(i => (
        <div key={i.id} style={{ padding: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 3, fontSize: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 600 }}>
              {i.title}
              <span style={{ marginLeft: 8, color: 'var(--accent-gold)', fontSize: 11 }}>({i.type})</span>
            </div>
            <label style={{ fontSize: 11 }}>
              <input type="checkbox" checked={i.done} onChange={() => onToggleComplete && onToggleComplete(i.id, !i.done)} />{' '}Fullført
            </label>
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginTop: 4 }}>
            Frist: {new Date(i.dueDate).toLocaleDateString('no-NO')} • Varighet: {i.duration} dager
          </div>
          {i.chemicals.length > 0 && (
            <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginTop: 2 }}>
              Kjemikalier: {i.chemicals.join(', ')}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
