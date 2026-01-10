import { useMemo, useState } from 'react';

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

export default function QuarantineCalendar({ tasks = [] }) {
  const [cursor, setCursor] = useState(new Date());

  const quarantines = useMemo(() => {
    return tasks
      .filter(t => (t.type || '').toLowerCase() === 'karantene')
      .map(t => {
        const due = new Date(t.dueDate);
        const start = addDays(due, -(t.duration || 0));
        return { id: t.id, start, due, name: t.name };
      });
  }, [tasks]);

  const weeks = useMemo(() => {
    const first = startOfMonth(cursor);
    const last = endOfMonth(cursor);
    // Monday as first day of week
    const firstWeekday = (first.getDay() + 6) % 7; // 0..6 with Monday=0
    const daysInMonth = last.getDate();
    const cells = [];
    // Leading days from previous month
    for (let i = 0; i < firstWeekday; i++) {
      const d = new Date(first);
      d.setDate(first.getDate() - (firstWeekday - i));
      cells.push({ date: d, inMonth: false });
    }
    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(first);
      d.setDate(i);
      cells.push({ date: d, inMonth: true });
    }
    // Trailing days to complete weeks
    while (cells.length % 7 !== 0) {
      const d = new Date(last);
      d.setDate(last.getDate() + (cells.length % 7 === 0 ? 0 : 1));
      last.setDate(last.getDate() + 1);
      cells.push({ date: new Date(last), inMonth: false });
    }
    // Group into weeks
    const w = [];
    for (let i = 0; i < cells.length; i += 7) {
      w.push(cells.slice(i, i + 7));
    }
    return w;
  }, [cursor]);

  const activeCount = (day) => quarantines.filter(q => day >= new Date(toYMD(q.start)) && day <= new Date(toYMD(q.due))).length;

  const dayBadge = (day) => {
    const active = quarantines.filter(q => day >= new Date(toYMD(q.start)) && day <= new Date(toYMD(q.due)));
    if (active.length === 0) return null;
    return (
      <div style={{ marginTop: 4, fontSize: 10, color: 'var(--accent-gold)' }}>
        {active.length} karantene
      </div>
    );
  };

  const monthLabel = new Intl.DateTimeFormat('no-NO', { month: 'long', year: 'numeric' }).format(cursor);

  // Overlap detection: count days in current month with >1 active quarantines
  const firstDay = startOfMonth(cursor);
  const daysInMonth = endOfMonth(cursor).getDate();
  let overlapDays = 0;
  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(firstDay);
    d.setDate(i);
    if (activeCount(d) > 1) overlapDays++;
  }

  // Build detailed overlap report (limit to 10 days for brevity)
  const overlapDetails = [];
  for (let i = 1; i <= daysInMonth && overlapDetails.length < 10; i++) {
    const d = new Date(firstDay);
    d.setDate(i);
    const active = quarantines.filter(q => d >= new Date(toYMD(q.start)) && d <= new Date(toYMD(q.due)));
    if (active.length > 1) {
      overlapDetails.push({ date: new Date(d), items: active.map(a => a.name) });
    }
  }

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 4, padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <button onClick={() => setCursor(addDays(startOfMonth(cursor), -1))} style={{ padding: '6px 8px', fontSize: 12 }}>←</button>
        <div style={{ fontWeight: 600, fontSize: 13 }}>{monthLabel}</div>
        <button onClick={() => setCursor(addDays(endOfMonth(cursor), 1))} style={{ padding: '6px 8px', fontSize: 12 }}>→</button>
      </div>
      {overlapDays > 0 && (
        <div style={{ marginBottom: 8, padding: 8, border: '1px solid var(--accent-orange)', background: 'rgba(255, 107, 53, 0.1)', borderRadius: 3, fontSize: 11 }}>
          Overlappende karantener: {overlapDays} dager denne måneden
          {overlapDetails.length > 0 && (
            <div style={{ marginTop: 6 }}>
              {overlapDetails.map((o, i) => (
                <div key={i} style={{ display: 'flex', gap: 8 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{o.date.toLocaleDateString('no-NO')}:</span>
                  <span style={{ color: 'var(--text-primary)' }}>{o.items.join(', ')}</span>
                </div>
              ))}
              {overlapDays > overlapDetails.length && (
                <div style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
                  + {overlapDays - overlapDetails.length} flere dager med overlapp
                </div>
              )}
            </div>
          )}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>
        <div>Man</div><div>Tir</div><div>Ons</div><div>Tor</div><div>Fre</div><div>Lør</div><div>Søn</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
        {weeks.map((week, idx) => (
          <div key={idx} style={{ display: 'contents' }}>
            {week.map((cell, j) => (
              <div key={j} style={{
                padding: 8,
                border: `1px solid ${activeCount(cell.date) > 1 ? 'var(--accent-red)' : 'var(--border-color)'}`,
                borderRadius: 3,
                background: activeCount(cell.date) > 0 ? 'rgba(212, 165, 116, 0.1)' : 'var(--bg-elevated)',
                opacity: cell.inMonth ? 1 : 0.6,
              }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>
                  {new Date(cell.date).getDate()}
                </div>
                {dayBadge(cell.date)}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
