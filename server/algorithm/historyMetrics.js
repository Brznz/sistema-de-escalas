/**
 * Computes individual and global metrics from past confirmed schedules.
 */

export function normalizePersonName(name) {
  if (!name) return '';
  return name
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Infers logical post group (baseId) even if historical schedule didn't persist baseId
 */
export function inferSlotGroup(slotOrAssignment) {
  if (!slotOrAssignment) return null;
  if (slotOrAssignment.baseId) return slotOrAssignment.baseId;

  const id = (slotOrAssignment.slotId || slotOrAssignment.id || '').toLowerCase();
  if (id === 'posto_9' || id === 'posto_10') return 'cozinha_10m';
  if (id === 'posto_11' || id === 'posto_12') return 'cozinha_fisc';

  const name = (slotOrAssignment.slotName || slotOrAssignment.name || '').trim().toLowerCase();
  const stripped = name.replace(/\s*[\(\[]?vaga\s*\d+[\)\]]?\s*$/i, '').trim();
  if (stripped && stripped !== name) {
    return stripped;
  }
  return null;
}

/**
 * Infers broader sector (cozinha, refeitorio, escada, banheiro) to avoid consecutive sector fatigue
 */
export function inferSlotSector(slotOrAssignment) {
  if (!slotOrAssignment) return null;
  const id = (slotOrAssignment.slotId || slotOrAssignment.id || '').toLowerCase();
  const name = (slotOrAssignment.slotName || slotOrAssignment.name || '').toLowerCase();

  if (name.includes('banheiro') || id === 'posto_2' || id === 'posto_3') return 'banheiro';
  if (name.includes('cozinha') || id.includes('cozinha')) return 'cozinha';
  if (name.includes('refeitório') || name.includes('refeitorio') || name.includes('fila')) return 'refeitorio';
  if (name.includes('escada')) return 'escada';
  return null;
}

export function calculateOfficerMetrics(officer, historySchedules = [], currentWeekNumber = 1) {
  const officerId = officer.id;
  const officerNormName = normalizePersonName(officer.name);

  let totalDuties = 0;
  let lastWeekServed = null;
  let totalCommands = 0;
  let lastWeekCommanded = null;
  let totalAccumulations = 0;
  let accumulatedLastWeek = false;

  const postCounts = {};
  const sectorCounts = {};
  const pelotaoCounts = {};

  let lastWeekPostId = null;
  let lastWeekPostGroup = null;
  let lastWeekPostSector = null;
  let twoWeeksAgoPostId = null;
  let twoWeeksAgoPostGroup = null;

  let lastAssignedPostId = null;
  let lastAssignedPostGroup = null;
  let lastAssignedPostSector = null;
  let secondLastAssignedPostId = null;
  let secondLastAssignedPostGroup = null;

  let lastWeekPelotaoId = null;
  let lastAssignedPelotaoId = null;
  let secondLastAssignedPelotaoId = null;

  const prevWeek = currentWeekNumber - 1;
  const twoWeeksAgo = currentWeekNumber - 2;

  // Strictly filter only past schedules (< currentWeekNumber) and sort ascending
  const pastSchedules = (historySchedules || [])
    .filter(s => (s.weekNumber || 0) < currentWeekNumber)
    .sort((a, b) => (a.weekNumber || 0) - (b.weekNumber || 0));

  for (const schedule of pastSchedules) {
    const w = schedule.weekNumber;
    let dutiesThisWeek = 0;

    for (const assignment of schedule.assignments || []) {
      const isSameOfficer =
        assignment.officerId === officerId ||
        (officerNormName && assignment.officerName && normalizePersonName(assignment.officerName) === officerNormName);

      if (isSameOfficer) {
        totalDuties++;
        dutiesThisWeek++;
        if (lastWeekServed === null || w > lastWeekServed) {
          lastWeekServed = w;
        }

        const slotId = assignment.slotId;
        const slotType = assignment.slotType;
        const groupKey = inferSlotGroup(assignment);
        const sectorKey = inferSlotSector(assignment);

        if (slotType === 'posto') {
          postCounts[slotId] = (postCounts[slotId] || 0) + 1;
          if (groupKey && groupKey !== slotId) {
            postCounts[groupKey] = (postCounts[groupKey] || 0) + 1;
          }
          if (sectorKey) {
            sectorCounts[sectorKey] = (sectorCounts[sectorKey] || 0) + 1;
          }

          secondLastAssignedPostId = lastAssignedPostId;
          secondLastAssignedPostGroup = lastAssignedPostGroup;
          lastAssignedPostId = slotId;
          lastAssignedPostGroup = groupKey;
          lastAssignedPostSector = sectorKey;

          if (w === prevWeek) {
            lastWeekPostId = slotId;
            lastWeekPostGroup = groupKey;
            lastWeekPostSector = sectorKey;
          }
          if (w === twoWeeksAgo) {
            twoWeeksAgoPostId = slotId;
            twoWeeksAgoPostGroup = groupKey;
          }
        }

        if (assignment.isCommand || slotType === 'pelotao') {
          totalCommands++;
          if (lastWeekCommanded === null || w > lastWeekCommanded) {
            lastWeekCommanded = w;
          }
          pelotaoCounts[slotId] = (pelotaoCounts[slotId] || 0) + 1;

          secondLastAssignedPelotaoId = lastAssignedPelotaoId;
          lastAssignedPelotaoId = slotId;

          if (w === prevWeek) {
            lastWeekPelotaoId = slotId;
          }
        }
      }
    }

    if (dutiesThisWeek > 1) {
      totalAccumulations++;
      if (w === prevWeek) {
        accumulatedLastWeek = true;
      }
    }
  }

  // Weeks since last duty: if never served, give currentWeekNumber (waiting since inception)
  const weeksSinceLastDuty = lastWeekServed !== null
    ? Math.max(1, currentWeekNumber - lastWeekServed)
    : currentWeekNumber;

  const servedLastWeek = lastWeekServed === prevWeek;

  // Weeks since last command: if never commanded, give currentWeekNumber
  const weeksSinceLastCommand = lastWeekCommanded !== null
    ? Math.max(1, currentWeekNumber - lastWeekCommanded)
    : currentWeekNumber;

  const commandedLastWeek = lastWeekCommanded === prevWeek;

  return {
    officerId,
    totalDuties,
    lastWeekServed,
    weeksSinceLastDuty,
    servedLastWeek,
    totalCommands,
    lastWeekCommanded,
    weeksSinceLastCommand,
    commandedLastWeek,
    totalAccumulations,
    accumulatedLastWeek,
    postCounts,
    sectorCounts,
    pelotaoCounts,
    lastWeekPostId,
    lastWeekPostGroup,
    lastWeekPostSector,
    twoWeeksAgoPostId,
    twoWeeksAgoPostGroup,
    lastAssignedPostId,
    lastAssignedPostGroup,
    lastAssignedPostSector,
    secondLastAssignedPostId,
    secondLastAssignedPostGroup,
    lastWeekPelotaoId,
    lastAssignedPelotaoId,
    secondLastAssignedPelotaoId
  };
}

/**
 * Computes metrics for all officers
 */
export function calculateAllOfficerMetrics(officers, historySchedules, currentWeekNumber) {
  const map = new Map();
  for (const off of officers) {
    map.set(off.id, calculateOfficerMetrics(off, historySchedules, currentWeekNumber));
  }
  return map;
}
