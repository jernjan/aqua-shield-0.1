// Overlap detection helpers

export function findOverlappingQuarantine(newStart, newEnd, existingTasks = []) {
  const quarantines = existingTasks.filter(t => (t.type || '').toLowerCase() === 'karantene');
  const newDueDate = new Date(newEnd);
  const newStartDate = new Date(newStart);
  newStartDate.setHours(0, 0, 0, 0);
  newDueDate.setHours(0, 0, 0, 0);

  return quarantines.filter(q => {
    const qStart = new Date(q.dueDate);
    qStart.setDate(qStart.getDate() - (q.duration || 0));
    qStart.setHours(0, 0, 0, 0);
    const qEnd = new Date(q.dueDate);
    qEnd.setHours(0, 0, 0, 0);
    
    // Check if ranges overlap: newStart <= qEnd AND newEnd >= qStart
    return newStartDate <= qEnd && newDueDate >= qStart;
  });
}

export function formatOverlapWarning(overlaps = []) {
  if (overlaps.length === 0) return null;
  const names = overlaps.map(q => q.name).join(', ');
  const daysOverlap = overlaps.map(q => {
    const qStart = new Date(q.dueDate);
    qStart.setDate(qStart.getDate() - (q.duration || 0));
    return `${qStart.toLocaleDateString('no-NO')} – ${new Date(q.dueDate).toLocaleDateString('no-NO')}`;
  });
  return {
    title: `Advarsel: Overlappende karantener (${overlaps.length} eksisterende)`,
    names,
    ranges: daysOverlap,
  };
}
