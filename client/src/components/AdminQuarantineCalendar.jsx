import { useState, useMemo } from 'react';

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfMonth(date) {
  const d = new Date(date);
  d.setDate(1);
  return d;
}

function endOfMonth(date) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return d;
}

function toYMD(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function AdminQuarantineCalendar({ vessels = [], allTasks = [] }) {
  const [cursor, setCursor] = useState(new Date());
  const [selectedVessel, setSelectedVessel] = useState(null);

  // Get quarantines for selected vessel or all vessels
  const quarantines = useMemo(() => {
    const tasks = selectedVessel
      ? allTasks.filter(t => t.vesselId === selectedVessel.id)
      : allTasks;
    return tasks
      .filter(t => (t.type || '').toLowerCase() === 'karantene')
      .map(t => ({
        id: t.id,
        vesselId: t.vesselId,
        vesselName: vessels.find(v => v.id === t.vesselId)?.name || 'Unknown',
        start: new Date(t.dueDate),
        due: new Date(t.dueDate),
        name: t.name,
        duration: t.duration || 0,
      }))
      .map(t => ({
        ...t,
        start: addDays(t.start, -(t.duration || 0)),
      }));
  }, [selectedVessel, vessels, allTasks]);

  const weeks = useMemo(() => {
    const first = startOfMonth(cursor);
    const last = endOfMonth(cursor);
    const firstWeekday = (first.getDay() + 6) % 7;
    const daysInMonth = last.getDate();
    const cells = [];
    for (let i = 0; i < firstWeekday; i++) {
      const d = new Date(first);
      d.setDate(first.getDate() - (firstWeekday - i));
      cells.push({ date: d, inMonth: false });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(first);
      d.setDate(i);
      cells.push({ date: d, inMonth: true });
    }
    while (cells.length % 7 !== 0) {
      const d = new Date(last);
      d.setDate(last.getDate() + (cells.length % 7 === 0 ? 0 : 1));
      last.setDate(last.getDate() + 1);
      cells.push({ date: new Date(last), inMonth: false });
    }
    const w = [];
    for (let i = 0; i < cells.length; i += 7) {
      w.push(cells.slice(i, i + 7));
    }
    return w;
  }, [cursor]);

  const dayCount = (day) => quarantines.filter(q => day >= new Date(toYMD(q.start)) && day <= new Date(toYMD(q.due))).length;
  const dayVessels = (day) => {
    const active = quarantines.filter(q => day >= new Date(toYMD(q.start)) && day <= new Date(toYMD(q.due)));
    return [...new Set(active.map(a => a.vesselName))];
  };

  const monthLabel = new Intl.DateTimeFormat('no-NO', { month: 'long', year: 'numeric' }).format(cursor);

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 4, padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <button onClick={() => setCursor(addDays(startOfMonth(cursor), -1))} style={{ padding: '6px 8px', fontSize: 12 }}>←</button>
        <div style={{ fontWeight: 600, fontSize: 13 }}>{monthLabel}</div>
        <button onClick={() => setCursor(addDays(endOfMonth(cursor), 1))} style={{ padding: '6px 8px', fontSize: 12 }}>→</button>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Filtrer etter båt:</label>
        <select
          value={selectedVessel?.id || ''}
          onChange={(e) => setSelectedVessel(vessels.find(v => v.id === e.target.value) || null)}
          style={{
            width: '100%',
            padding: '6px 8px',
            background: 'var(--bg-dark)',
            border: '1px solid var(--border-color)',
            borderRadius: 3,
            color: 'var(--text-primary)',
            fontSize: 12,
          }}
        >
          <option value="">Alle båter</option>
          {vessels.map(v => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>
        <div>Man</div><div>Tir</div><div>Ons</div><div>Tor</div><div>Fre</div><div>Lør</div><div>Søn</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 12 }}>
        {weeks.map((week, idx) => (
          <div key={idx} style={{ display: 'contents' }}>
            {week.map((cell, j) => {
              const count = dayCount(cell.date);
              const vList = dayVessels(cell.date);
              return (
                <div
                  key={j}
                  style={{
                    padding: 8,
                    border: `1px solid ${count > 1 ? 'var(--accent-red)' : count > 0 ? 'var(--border-color)' : 'var(--border-color)'}`,
                    borderRadius: 3,
                    background: count > 0 ? 'rgba(212, 165, 116, 0.1)' : 'var(--bg-elevated)',
                    opacity: cell.inMonth ? 1 : 0.6,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{new Date(cell.date).getDate()}</div>
                  {count > 0 && (
                    <div style={{ marginTop: 4, fontSize: 9, color: 'var(--accent-gold)', lineHeight: 1.2 }}>
                      {vList.map((v, i) => (
                        <div key={i} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {v}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {quarantines.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12, padding: 12 }}>
          Ingen karantener registrert
        </div>
      )}
    </div>
  );
}
