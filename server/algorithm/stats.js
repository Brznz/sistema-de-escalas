/**
 * Statistics and Equity Analysis for Military School Schedules.
 */

/**
 * Calculates Gini coefficient (0 = perfect equality, 1 = extreme inequality)
 */
export function calculateGini(values) {
  if (!values || values.length === 0) return 0;
  const n = values.length;
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  if (sum === 0) return 0;

  let cumulativeSum = 0;
  for (let i = 0; i < n; i++) {
    cumulativeSum += (2 * (i + 1) - n - 1) * sorted[i];
  }
  return Number((cumulativeSum / (n * sum)).toFixed(3));
}

/**
 * Generates comprehensive stats for each officer and global metrics
 */
export function generateSystemStats(allOfficers = [], historySchedules = []) {
  const currentWeek = historySchedules.length > 0 
    ? Math.max(...historySchedules.map(s => s.weekNumber || 1)) + 1
    : 1;

  const officerStats = allOfficers.map(officer => {
    let totalDuties = 0;
    let lastWeekServed = null;
    let totalCommands = 0;
    let lastWeekCommanded = null;

    const postFrequencies = {};
    const pelotaoFrequencies = {};

    for (const schedule of historySchedules) {
      const w = schedule.weekNumber;
      for (const a of schedule.assignments || []) {
        if (a.officerId === officer.id) {
          totalDuties++;
          if (lastWeekServed === null || w > lastWeekServed) {
            lastWeekServed = w;
          }

          if (a.slotType === 'posto') {
            const key = a.slotName || a.slotId;
            postFrequencies[key] = (postFrequencies[key] || 0) + 1;
          }

          if (a.isCommand || a.slotType === 'pelotao') {
            totalCommands++;
            if (lastWeekCommanded === null || w > lastWeekCommanded) {
              lastWeekCommanded = w;
            }
            const key = a.slotName || a.slotId;
            pelotaoFrequencies[key] = (pelotaoFrequencies[key] || 0) + 1;
          }
        }
      }
    }

    const weeksWithoutDuty = lastWeekServed !== null
      ? Math.max(0, currentWeek - 1 - lastWeekServed)
      : (historySchedules.length > 0 ? historySchedules.length : 0);

    const weeksWithoutCommand = lastWeekCommanded !== null
      ? Math.max(0, currentWeek - 1 - lastWeekCommanded)
      : (historySchedules.length > 0 ? historySchedules.length : 0);

    // Format top posts
    const topPosts = Object.entries(postFrequencies)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // Format top platoons
    const topPelotoes = Object.entries(pelotaoFrequencies)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return {
      id: officer.id,
      name: officer.name,
      patente: officer.patente || 'CFOM',
      status: officer.status,
      totalDuties,
      lastWeekServed,
      weeksWithoutDuty,
      weeksSinceLastDuty: weeksWithoutDuty,
      topPosts,
      mostWorkedPost: topPosts[0]?.name || 'Nenhum',
      totalCommands,
      lastWeekCommanded,
      weeksWithoutCommand,
      weeksSinceLastCommand: weeksWithoutCommand,
      topPelotoes,
      mostWorkedPelotao: topPelotoes[0]?.name || 'Nenhum'
    };
  });

  // Global equity metrics (calculated over active officers)
  const activeStats = officerStats.filter(s => s.status === 'ativo');
  const dutiesCounts = activeStats.map(s => s.totalDuties);
  const commandsCounts = activeStats.map(s => s.totalCommands);

  const totalDutiesSum = dutiesCounts.reduce((a, b) => a + b, 0);
  const allOfficersTotalDuties = officerStats.reduce((a, s) => a + s.totalDuties, 0);
  const avgDuties = activeStats.length > 0 ? Number((totalDutiesSum / activeStats.length).toFixed(1)) : 0;
  
  const minDuties = dutiesCounts.length > 0 ? Math.min(...dutiesCounts) : 0;
  const maxDuties = dutiesCounts.length > 0 ? Math.max(...dutiesCounts) : 0;

  // Standard deviation
  const variance = activeStats.length > 0
    ? dutiesCounts.reduce((acc, val) => acc + Math.pow(val - avgDuties, 2), 0) / activeStats.length
    : 0;
  const stdDev = Number(Math.sqrt(variance).toFixed(2));

  // Gini coefficient
  const giniIndex = calculateGini(dutiesCounts);
  const commandGiniIndex = calculateGini(commandsCounts);

  // Equity score percentage (100% = perfectly balanced)
  // Penalize high standard deviation relative to mean
  const equityScore = Math.max(0, Math.min(100, Math.round((1 - (giniIndex * 0.8)) * 100)));

  return {
    officerStats,
    global: {
      totalWeeks: historySchedules.length,
      currentWeek,
      totalActiveOfficers: activeStats.length,
      totalOfficers: allOfficers.length,
      totalDuties: allOfficersTotalDuties,
      avgDuties,
      minDuties,
      maxDuties,
      dutySpread: maxDuties - minDuties,
      stdDev,
      giniIndex,
      commandGiniIndex,
      equityScore
    }
  };
}
