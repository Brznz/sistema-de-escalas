import { solveHungarian } from './hungarian.js';
import {
  calculateAllOfficerMetrics,
  normalizePersonName,
  inferSlotGroup
} from './historyMetrics.js';
import {
  buildCostMatrix,
  computeAssignmentCost,
  isBathroomSlot,
  canSlotAccumulate,
  getCoverageSectorLabel,
  isCoverageSectorSlot,
  isOfficerRestrictedFromSlot,
  FORBIDDEN_COST,
  DEFAULT_WEIGHTS
} from './costMatrix.js';

/**
 * Main weekly schedule generation orchestrator.
 * 
 * Implements two coordinated optimization phases:
 * Phase 1: Assigns Platoon Commanders (regra de rotação de comando).
 * Phase 2: Assigns Physical Service Posts (regra de rotação de postos e banheiros por gênero).
 * 
 * Business rule:
 * Officers with a platoon CAN also take a physical post duty ("quem ta com pelotao pode pegar escala tambem"),
 * with the strict exception that officers in platoons CANNOT take bathroom duty ("quem nao pode e banheiro").
 * Officers without a platoon are prioritized for physical posts. If there are more physical slots
 * than free officers, platoon officers step in to cover the remaining physical posts.
 */
export function generateWeeklySchedule({
  allOfficers = [],
  activeOfficerIds = null,
  slots = [],
  historySchedules = [],
  currentWeekNumber = 1,
  weights = DEFAULT_WEIGHTS,
  manualLocks = {} // Map or object: { slotId: officerId }
}) {
  const w = { ...DEFAULT_WEIGHTS, ...weights };

  // 1. Filter eligible officers: must be active and deduplicated by ID and normalized name
  const rawEligibleOfficers = allOfficers.filter(o => {
    if (!o || o.status !== 'ativo') return false;
    if (activeOfficerIds && Array.isArray(activeOfficerIds)) {
      return activeOfficerIds.includes(o.id);
    }
    return true;
  });

  const seenOfficerIds = new Set();
  const seenOfficerNames = new Set();
  const eligibleOfficers = [];
  for (const o of rawEligibleOfficers) {
    if (seenOfficerIds.has(o.id)) continue;
    const normName = normalizePersonName(o.name);
    if (normName && seenOfficerNames.has(normName)) continue;
    seenOfficerIds.add(o.id);
    if (normName) seenOfficerNames.add(normName);
    eligibleOfficers.push(o);
  }

  const officerMap = new Map(eligibleOfficers.map(o => [o.id, o]));

  // 2. Compute historical metrics for all eligible officers
  const metricsMap = calculateAllOfficerMetrics(eligibleOfficers, historySchedules, currentWeekNumber);

  // 3. Separate slots into Platoons and Physical Posts
  const platoonSlots = slots.filter(s => s.type === 'pelotao' || !!s.isCommand);
  const physicalSlots = slots.filter(s => !(s.type === 'pelotao' || !!s.isCommand));

  // 4. Process manual locks (validating eligibility and avoiding duplicate locks on incompatible slots)
  const lockEntries = Array.isArray(manualLocks)
    ? manualLocks.map(l => [l.slotId, l.officerId])
    : Object.entries(manualLocks || {});

  const lockedPlatoonSlotMap = new Map(); // slotId -> officerId
  const lockedPhysicalSlotMap = new Map(); // slotId -> officerId
  const lockedPhysicalOfficerMap = new Map(); // officerId -> slotId
  const lockedPlatoonOfficerSet = new Set();
  const lockedPhysicalOfficerSet = new Set();
  const lockedBathroomOfficerSet = new Set();

  for (const [slotId, officerId] of lockEntries) {
    if (!officerId) continue;
    const slot = slots.find(s => s.id === slotId);
    const officer = officerMap.get(officerId);
    if (!slot || !officer) continue;

    if (slot.type === 'pelotao' || !!slot.isCommand) {
      if (lockedPlatoonOfficerSet.has(officer.id)) continue;
      if (lockedBathroomOfficerSet.has(officer.id)) continue;
      lockedPlatoonSlotMap.set(slot.id, officer.id);
      lockedPlatoonOfficerSet.add(officer.id);
    } else {
      if (lockedPhysicalOfficerSet.has(officer.id)) continue;
      if (lockedPlatoonOfficerSet.has(officer.id) && !canSlotAccumulate(slot)) continue;
      lockedPhysicalSlotMap.set(slot.id, officer.id);
      lockedPhysicalOfficerMap.set(officer.id, slot.id);
      lockedPhysicalOfficerSet.add(officer.id);
      if (isBathroomSlot(slot)) {
        lockedBathroomOfficerSet.add(officer.id);
      }
    }
  }

  // -------------------------------------------------------------
  // PHASE 1: Platoon Commanders Assignment
  // -------------------------------------------------------------
  const platoonAssignmentMap = new Map(); // slotId -> { officerId, cost, isLocked }

  // Set locked platoons
  for (const [slotId, officerId] of lockedPlatoonSlotMap.entries()) {
    platoonAssignmentMap.set(slotId, {
      officerId,
      cost: 0,
      isLocked: true
    });
  }

  const freePlatoonSlots = platoonSlots.filter(s => !lockedPlatoonSlotMap.has(s.id));

  if (freePlatoonSlots.length > 0) {
    // Candidates for free platoons: eligible officers not already locked to a platoon
    // and not locked to a bathroom
    const freePlatoonCandidates = eligibleOfficers.filter(o => 
      !lockedPlatoonOfficerSet.has(o.id) && !lockedBathroomOfficerSet.has(o.id)
    );

    const reservedForNonAccumPostIds = new Set();
    const samplePlatoonSlot = freePlatoonSlots[0];

    // Guard 1: ensure we reserve enough eligible & unrestricted officers for gender-specific bathrooms
    // Male bathrooms:
    const freeMaleBathSlots = physicalSlots.filter(s => 
      isBathroomSlot(s) && 
      ((s.name || '').toLowerCase().includes('masculino') || (s.id || '').toLowerCase() === 'posto_3') && 
      !lockedPhysicalSlotMap.has(s.id)
    );

    if (freeMaleBathSlots.length > 0) {
      const sampleMaleBath = freeMaleBathSlots[0];
      const availMales = freePlatoonCandidates.filter(o => 
        !lockedPhysicalOfficerSet.has(o.id) &&
        !isOfficerRestrictedFromSlot(o, sampleMaleBath)
      );
      if (availMales.length > 0) {
        const maxPlatoonMales = Math.max(0, availMales.length - freeMaleBathSlots.length);
        const sortedMales = [...availMales].sort((a, b) => {
          const pCostA = computeAssignmentCost(a, samplePlatoonSlot, metricsMap.get(a.id), w, { currentWeekNumber });
          const pCostB = computeAssignmentCost(b, samplePlatoonSlot, metricsMap.get(b.id), w, { currentWeekNumber });
          const bCostA = computeAssignmentCost(a, sampleMaleBath, metricsMap.get(a.id), w, { currentWeekNumber });
          const bCostB = computeAssignmentCost(b, sampleMaleBath, metricsMap.get(b.id), w, { currentWeekNumber });
          return (pCostA - bCostA) - (pCostB - bCostB);
        });
        for (const m of sortedMales.slice(maxPlatoonMales)) {
          reservedForNonAccumPostIds.add(m.id);
        }
      }
    }

    // Female bathrooms:
    const freeFemaleBathSlots = physicalSlots.filter(s => 
      isBathroomSlot(s) && 
      ((s.name || '').toLowerCase().includes('feminino') || (s.id || '').toLowerCase() === 'posto_2') && 
      !lockedPhysicalSlotMap.has(s.id)
    );

    if (freeFemaleBathSlots.length > 0) {
      const sampleFemaleBath = freeFemaleBathSlots[0];
      const availFemales = freePlatoonCandidates.filter(o => 
        !lockedPhysicalOfficerSet.has(o.id) &&
        !isOfficerRestrictedFromSlot(o, sampleFemaleBath)
      );
      if (availFemales.length > 0) {
        const maxPlatoonFemales = Math.max(0, availFemales.length - freeFemaleBathSlots.length);
        const sortedFemales = [...availFemales].sort((a, b) => {
          const pCostA = computeAssignmentCost(a, samplePlatoonSlot, metricsMap.get(a.id), w, { currentWeekNumber });
          const pCostB = computeAssignmentCost(b, samplePlatoonSlot, metricsMap.get(b.id), w, { currentWeekNumber });
          const bCostA = computeAssignmentCost(a, sampleFemaleBath, metricsMap.get(a.id), w, { currentWeekNumber });
          const bCostB = computeAssignmentCost(b, sampleFemaleBath, metricsMap.get(b.id), w, { currentWeekNumber });
          return (pCostA - bCostA) - (pCostB - bCostB);
        });
        for (const f of sortedFemales.slice(maxPlatoonFemales)) {
          reservedForNonAccumPostIds.add(f.id);
        }
      }
    }

    // Guard 2: protect scarce unrestricted candidates for non-accumulating physical posts
    // when express restrictions limit who can take a post (e.g. only 1 officer can take Guarita)
    const freeNonBathNonAccumSlots = physicalSlots.filter(s =>
      !isBathroomSlot(s) &&
      !canSlotAccumulate(s) &&
      !lockedPhysicalSlotMap.has(s.id)
    );
    const openPhysicalCandidates = freePlatoonCandidates.filter(o => !lockedPhysicalOfficerSet.has(o.id));

    const scarcePosts = freeNonBathNonAccumSlots
      .map(slot => ({
        slot,
        elig: openPhysicalCandidates.filter(o => !isOfficerRestrictedFromSlot(o, slot))
      }))
      .filter(item => item.elig.length > 0 && item.elig.length < openPhysicalCandidates.length)
      .sort((a, b) => a.elig.length - b.elig.length);

    for (const { slot, elig } of scarcePosts) {
      // If someone already reserved can cover this slot, skip
      const alreadyReservedForSlot = elig.some(o => reservedForNonAccumPostIds.has(o.id));
      if (alreadyReservedForSlot) continue;

      // Only reserve if all elig could otherwise be swallowed by platoons AND we still have enough candidates for platoons
      const unreservedPlatoonPoolCount = freePlatoonCandidates.filter(
        o => !reservedForNonAccumPostIds.has(o.id)
      ).length;

      if (elig.length <= freePlatoonSlots.length && unreservedPlatoonPoolCount > freePlatoonSlots.length) {
        const sortedElig = [...elig].sort((a, b) => {
          const pCostA = computeAssignmentCost(a, samplePlatoonSlot, metricsMap.get(a.id), w, { currentWeekNumber });
          const pCostB = computeAssignmentCost(b, samplePlatoonSlot, metricsMap.get(b.id), w, { currentWeekNumber });
          const sCostA = computeAssignmentCost(a, slot, metricsMap.get(a.id), w, { currentWeekNumber });
          const sCostB = computeAssignmentCost(b, slot, metricsMap.get(b.id), w, { currentWeekNumber });
          return (pCostA - sCostA) - (pCostB - sCostB);
        });
        const bestToReserve = sortedElig[sortedElig.length - 1];
        if (bestToReserve) {
          reservedForNonAccumPostIds.add(bestToReserve.id);
        }
      }
    }

    const { matrix, dim, numOfficers, numSlots } = buildCostMatrix({
      officers: freePlatoonCandidates,
      slots: freePlatoonSlots,
      metricsMap,
      weights: w,
      getContext: (officer, slot) => {
        if (reservedForNonAccumPostIds.has(officer.id)) {
          return { officerHasBathroom: true, currentWeekNumber }; // blocks platoon
        }
        const hasLockedPost = lockedPhysicalOfficerSet.has(officer.id);
        const lockedSlotId = hasLockedPost ? lockedPhysicalOfficerMap.get(officer.id) : null;
        const lockedSlot = lockedSlotId ? slots.find(s => s.id === lockedSlotId) : null;
        const physicalPostCanAccumulate = lockedSlot ? canSlotAccumulate(lockedSlot) : false;

        return {
          officerHasPhysicalPost: hasLockedPost,
          physicalPostCanAccumulate,
          currentWeekNumber
        };
      }
    });

    const { assignment } = solveHungarian(matrix);
    const slotToOfficer = new Array(dim).fill(-1);
    for (let r = 0; r < dim; r++) {
      const c = assignment[r];
      if (c >= 0 && c < dim) {
        slotToOfficer[c] = r;
      }
    }

    for (let col = 0; col < numSlots; col++) {
      const slot = freePlatoonSlots[col];
      const row = slotToOfficer[col];

      if (row >= 0 && row < numOfficers) {
        const officer = freePlatoonCandidates[row];
        const cost = matrix[row][col];
        if (cost < FORBIDDEN_COST / 2) {
          platoonAssignmentMap.set(slot.id, {
            officerId: officer.id,
            cost,
            isLocked: false
          });
          continue;
        }
      }

      // Slot could not be assigned
      platoonAssignmentMap.set(slot.id, {
        officerId: null,
        cost: FORBIDDEN_COST,
        isLocked: false,
        warning: 'Sem oficiais elegíveis para comando'
      });
    }
  }

  // Set of officers who hold a platoon this week
  const officersWithPlatoon = new Set();
  for (const info of platoonAssignmentMap.values()) {
    if (info.officerId) {
      officersWithPlatoon.add(info.officerId);
    }
  }

  // -------------------------------------------------------------
  // PHASE 2: Physical Service Posts Assignment
  // -------------------------------------------------------------
  const physicalAssignmentMap = new Map(); // slotId -> { officerId, cost, isLocked }

  // Set locked physical posts
  for (const [slotId, officerId] of lockedPhysicalSlotMap.entries()) {
    physicalAssignmentMap.set(slotId, {
      officerId,
      cost: 0,
      isLocked: true
    });
  }

  const freePhysicalSlots = physicalSlots.filter(s => !lockedPhysicalSlotMap.has(s.id));

  if (freePhysicalSlots.length > 0) {
    // Candidates: eligible officers not already locked to a physical post.
    // Note: Officers with a platoon ARE eligible for physical posts, EXCEPT bathrooms and non-accumulating posts!
    const freePhysicalCandidates = eligibleOfficers.filter(o => !lockedPhysicalOfficerSet.has(o.id));

    const { matrix, dim, numOfficers, numSlots } = buildCostMatrix({
      officers: freePhysicalCandidates,
      slots: freePhysicalSlots,
      metricsMap,
      weights: w,
      getContext: (officer, slot) => ({
        officerHasPlatoon: officersWithPlatoon.has(officer.id),
        currentWeekNumber
      })
    });

    const { assignment } = solveHungarian(matrix);
    const slotToOfficer = new Array(dim).fill(-1);
    for (let r = 0; r < dim; r++) {
      const c = assignment[r];
      if (c >= 0 && c < dim) {
        slotToOfficer[c] = r;
      }
    }

    for (let col = 0; col < numSlots; col++) {
      const slot = freePhysicalSlots[col];
      const row = slotToOfficer[col];

      if (row >= 0 && row < numOfficers) {
        const officer = freePhysicalCandidates[row];
        const cost = matrix[row][col];
        if (cost < FORBIDDEN_COST / 2) {
          physicalAssignmentMap.set(slot.id, {
            officerId: officer.id,
            cost,
            isLocked: false
          });
          continue;
        }
      }

      // Slot could not be assigned
      physicalAssignmentMap.set(slot.id, {
        officerId: null,
        cost: FORBIDDEN_COST,
        isLocked: false,
        warning: 'Sem oficiais elegíveis disponíveis'
      });
    }
  }

  // -------------------------------------------------------------
  // ASSEMBLE COMBINED ASSIGNMENTS (preserving original slot order)
  // -------------------------------------------------------------
  const finalAssignments = [];

  for (const slot of slots) {
    const isPlatoon = slot.type === 'pelotao' || !!slot.isCommand;
    const assignmentInfo = isPlatoon
      ? platoonAssignmentMap.get(slot.id)
      : physicalAssignmentMap.get(slot.id);

    const officerId = assignmentInfo?.officerId || null;
    const officer = officerId ? officerMap.get(officerId) : null;
    const metrics = officer ? metricsMap.get(officer.id) : null;
    const isLocked = !!assignmentInfo?.isLocked;
    const isAssigned = !!officer;

    finalAssignments.push({
      slotId: slot.id,
      slotName: slot.name,
      slotType: slot.type,
      baseId: slot.baseId || inferSlotGroup(slot) || null,
      isCommand: isPlatoon,
      cargo: isPlatoon ? 'Comandante de Pelotão' : 'Oficial de Serviço',
      officerId: officer ? officer.id : null,
      officerName: officer ? officer.name : null,
      officerPatente: officer ? (officer.patente || 'CFOM') : null,
      officerSexo: officer ? (officer.sexo || 'masculino') : null,
      isLocked,
      status: isAssigned ? 'atribuido' : 'pendente',
      assignmentCost: assignmentInfo?.cost || 0,
      warning: isAssigned ? null : (assignmentInfo?.warning || 'Sem oficiais elegíveis disponíveis'),
      metricsSnapshot: metrics ? {
        totalDuties: metrics.totalDuties,
        weeksSinceLastDuty: metrics.weeksSinceLastDuty,
        totalCommands: metrics.totalCommands,
        weeksSinceLastCommand: metrics.weeksSinceLastCommand
      } : null
    });
  }

  // -------------------------------------------------------------
  // MARK ACCUMULATED ROLES & COMPUTE RESTING OFFICERS
  // -------------------------------------------------------------
  // Map officerId -> assignments count and other assignment
  const officerAssignmentMap = new Map();
  for (const a of finalAssignments) {
    if (!a.officerId) continue;
    if (!officerAssignmentMap.has(a.officerId)) {
      officerAssignmentMap.set(a.officerId, []);
    }
    officerAssignmentMap.get(a.officerId).push(a);
  }

  // Annotate assignments with accumulation details
  for (const a of finalAssignments) {
    if (!a.officerId) continue;
    const allForOfficer = officerAssignmentMap.get(a.officerId) || [];
    if (allForOfficer.length > 1) {
      const other = allForOfficer.find(otherA => otherA.slotId !== a.slotId);
      if (other) {
        a.isAccumulated = true;
        a.accumulatedWith = {
          slotId: other.slotId,
          slotName: other.slotName,
          slotType: other.slotType,
          isCommand: other.isCommand
        };
      }
    } else {
      a.isAccumulated = false;
      a.accumulatedWith = null;
    }
  }

  // Resting officers: eligible active officers with 0 assignments
  const assignedOfficerIds = new Set(
    finalAssignments.filter(a => a.officerId).map(a => a.officerId)
  );

  const restingOfficers = eligibleOfficers
    .filter(o => !assignedOfficerIds.has(o.id))
    .map(o => {
      const metrics = metricsMap.get(o.id);
      return {
        id: o.id,
        name: o.name,
        patente: o.patente || 'CFOM',
        sexo: o.sexo || 'masculino',
        totalDuties: metrics?.totalDuties || 0,
        weeksSinceLastDuty: metrics?.weeksSinceLastDuty || 0,
        totalCommands: metrics?.totalCommands || 0,
        weeksSinceLastCommand: metrics?.weeksSinceLastCommand || 0
      };
    });

  // Build Coverage Pool: Officers assigned to Cozinha, Refeitório, or Corredor
  // ("caso falte alguem nas escalas informar e sugerir sempre pesoas em escala de cozinha refeitorio corredor")
  const coveragePool = finalAssignments
    .filter(a => a.officerId && isCoverageSectorSlot(a))
    .map(a => ({
      officerId: a.officerId,
      officerName: a.officerName,
      officerPatente: a.officerPatente || 'CFOM',
      officerSexo: a.officerSexo || 'masculino',
      sourceSlotId: a.slotId,
      sourceSlotName: a.slotName,
      sector: getCoverageSectorLabel(a)
    }));

  // Enrich any pending (unfilled) slots with suggested substitutes from Cozinha, Refeitório, and Corredor
  for (const a of finalAssignments) {
    if (a.status === 'pendente') {
      const targetSlotObj = slots.find(s => s.id === a.slotId) || {
        id: a.slotId,
        name: a.slotName,
        type: a.slotType,
        baseId: a.baseId
      };
      const eligibleSubstitutes = coveragePool.filter(cand => {
        const officerObj = officerMap.get(cand.officerId);
        if (!officerObj) return false;
        return !isOfficerRestrictedFromSlot(officerObj, targetSlotObj, {});
      });

      a.suggestedSubstitutes = eligibleSubstitutes;
      if (eligibleSubstitutes.length > 0) {
        const sampleNames = eligibleSubstitutes
          .slice(0, 5)
          .map(s => `${s.officerName} (${s.sector})`)
          .join(', ');
        a.warning = `Falta oficial neste posto. Sugeridos (Cozinha/Refeitório/Corredor): ${sampleNames}`;
      }
    } else {
      a.suggestedSubstitutes = [];
    }
  }

  const pendingSlots = finalAssignments.filter(a => a.status === 'pendente');
  const filledSlots = finalAssignments.filter(a => a.status === 'atribuido');
  const accumulatedOfficers = Array.from(officerAssignmentMap.entries())
    .filter(([_, list]) => list.length > 1)
    .map(([id]) => id);

  return {
    weekNumber: currentWeekNumber,
    assignments: finalAssignments,
    restingOfficers,
    pendingSlots,
    coveragePool,
    summary: {
      totalSlots: slots.length,
      filledSlots: filledSlots.length,
      pendingSlotsCount: pendingSlots.length,
      accumulatedOfficersCount: accumulatedOfficers.length,
      totalEligibleOfficers: eligibleOfficers.length,
      restingOfficersCount: restingOfficers.length,
      isFullyFilled: pendingSlots.length === 0
    }
  };
}
