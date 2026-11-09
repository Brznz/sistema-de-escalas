/**
 * Builds the cost matrix for the Linear Sum Assignment Problem (Hungarian Algorithm)
 * incorporating all 5 distribution rules and configurable weights.
 */
import { inferSlotGroup, inferSlotSector } from './historyMetrics.js';

/**
 * Small deterministic tie-breaker (0..3) to prevent the Hungarian algorithm from
 * shifting officers down by +1 adjacent slot index ("conveyor belt" effect)
 * when multiple unvisited slots share the exact same base cost.
 */
function deterministicTieBreaker(officerId, slotId, seed = 1) {
  const str = `${officerId || ''}:${slotId || ''}:${seed}`;
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 4;
}

export const DEFAULT_WEIGHTS = {
  // Regra 2: Prioridade para quem está há mais tempo sem escala
  pesoSemanasSemEscala: 60,

  // Regra 3: Distribuição equilibrada de escalas totais
  pesoEquilibrioEscalasTotais: 40,

  // Penalidade por escala na semana imediatamente anterior
  pesoEscalaSemanaAnterior: 30,

  // Regra 1: Evitar repetição no mesmo posto físico
  pesoRepeticaoPostoSemanaAnterior: 90,
  pesoRepeticaoPostoDuasSemanas: 45,
  pesoHistoricoMesmoPosto: 20,

  // Regra 4: Prioridade para comando dos pelotões
  bonusComandoNaoComandouSemanaAnterior: 130,
  penalidadeComandoConsecutivo: 160,
  pesoSemanasSemComando: 50,
  pesoEquilibrioComandosTotais: 45,
  pesoRepeticaoPelotaoSemanaAnterior: 95,
  pesoHistoricoMesmoPelotao: 25,

  // Acúmulo de pelotão + posto físico
  // Oficiais sem pelotão têm preferência para postos físicos.
  // Se faltarem oficiais para cobrir todos os postos, oficiais de pelotão assumem postos (exceto banheiros).
  pesoAcumuloPelotaoPosto: 80,

  // Base para slot de folga/descanso
  custoBaseFolga: 0
};

export const FORBIDDEN_COST = 10_000_000;
export const DUMMY_OFFICER_COST = 500_000;

/**
 * Checks if a slot is a bathroom
 */
export function isBathroomSlot(slot) {
  if (!slot) return false;
  const slotNameLower = (slot.name || slot.slotName || '').toLowerCase();
  const slotIdLower = (slot.id || slot.slotId || '').toLowerCase();
  return (
    slotNameLower.includes('banheiro') ||
    slotIdLower === 'posto_2' ||
    slotIdLower === 'posto_3'
  );
}

/**
 * Checks if a slot is allowed to accumulate two duties (e.g. Platoon + Post).
 * Regra do Usuário: "so deixa ficar com duas escalas quem tiver em escala de cozinha refeitorio e fila"
 */
export function canSlotAccumulate(slot) {
  if (!slot) return false;
  const name = (slot.name || slot.slotName || '').toLowerCase();
  const id = (slot.id || slot.slotId || '').toLowerCase();
  const baseId = (slot.baseId || '').toLowerCase();

  return (
    name.includes('cozinha') ||
    name.includes('refeitório') ||
    name.includes('refeitorio') ||
    name.includes('fila') ||
    id.includes('cozinha') ||
    id.includes('refeit') ||
    id.includes('fila') ||
    baseId.includes('cozinha') ||
    baseId.includes('refeit')
  );
}

/**
 * Returns the coverage sector label ('Cozinha', 'Refeitório', or 'Corredor')
 * for slots whose assigned officers should be suggested whenever someone is missing.
 */
export function getCoverageSectorLabel(slot) {
  if (!slot) return null;
  const name = (slot.name || slot.slotName || '').toLowerCase();
  const id = (slot.id || slot.slotId || '').toLowerCase();
  const baseId = (slot.baseId || '').toLowerCase();

  if (name.includes('cozinha') || id.includes('cozinha') || baseId.includes('cozinha')) {
    return 'Cozinha';
  }
  if (
    name.includes('refeitório') ||
    name.includes('refeitorio') ||
    name.includes('fila') ||
    name.includes('almoço') ||
    name.includes('almoco') ||
    id.includes('refeit') ||
    id.includes('fila') ||
    baseId.includes('refeit')
  ) {
    return 'Refeitório';
  }
  if (name.includes('corredor') || id.includes('corredor') || baseId.includes('corredor')) {
    return 'Corredor';
  }
  return null;
}

export function isCoverageSectorSlot(slot) {
  return Boolean(getCoverageSectorLabel(slot));
}

/**
 * Checks if an officer is restricted from a slot
 * (including express restrictions, gender bathroom restrictions, and platoon accumulation rules)
 */
export function isOfficerRestrictedFromSlot(officer, slot, context = {}) {
  const isBathroom = isBathroomSlot(slot);
  const isPlatoon = slot.type === 'pelotao' || !!slot.isCommand;
  const isPost = slot.type === 'posto';

  // Regra do Usuário: "so deixa ficar com duas escalas quem tiver em escala de cozinha refeitorio e fila"
  // 1. Se o oficial já tem pelotão e este slot é um posto físico:
  //    SÓ PODE ACUMULAR se o posto for cozinha, refeitório ou fila!
  if (context.officerHasPlatoon && isPost) {
    if (!canSlotAccumulate(slot)) {
      return true; // Bloqueia Guarita, Escadas, Armários, Bebedouro, Corredor, Banheiros, etc.
    }
  }

  // 2. Se este slot é um pelotão e o oficial já tem um posto físico (ex: manual lock):
  //    SÓ PODE se o posto físico dele for cozinha, refeitório ou fila!
  if (isPlatoon && context.officerHasPhysicalPost) {
    if (!context.physicalPostCanAccumulate) {
      return true;
    }
  }

  // Regra do Banheiro: oficial com pelotão NUNCA pode ser escalado em banheiro!
  if (isBathroom && context.officerHasPlatoon) {
    return true;
  }

  // Oficial escalado em banheiro NÃO pode comandar pelotão
  if (isPlatoon && context.officerHasBathroom) {
    return true;
  }

  // Regra de Sexo/Gênero para Banheiros:
  // Homem não pega escala de banheiro feminino; Mulher não pega de banheiro masculino.
  if (isBathroom) {
    const rawSexo = (officer.sexo || officer.genero || 'masculino').toString().toLowerCase().trim();
    const isFemale = rawSexo === 'f' || rawSexo === 'feminino' || rawSexo === 'mulher';
    const isMale = rawSexo === 'm' || rawSexo === 'masculino' || rawSexo === 'homem';

    const slotNameLower = (slot.name || slot.slotName || '').toLowerCase();
    const slotIdLower = (slot.id || slot.slotId || '').toLowerCase();

    const isBanheiroFeminino = slotNameLower.includes('banheiro feminino') || slotIdLower === 'posto_2';
    const isBanheiroMasculino = slotNameLower.includes('banheiro masculino') || slotIdLower === 'posto_3';

    if (isMale && isBanheiroFeminino) {
      return true;
    }
    if (isFemale && isBanheiroMasculino) {
      return true;
    }
  }

  if (!officer.restrictions || !Array.isArray(officer.restrictions)) {
    return false;
  }
  // Check against slot.id, slot.name, or slot.baseId
  return officer.restrictions.some(r => 
    r === slot.id || 
    r === slot.name || 
    (slot.baseId && r === slot.baseId)
  );
}

/**
 * Calculates the cost for a real officer assigned to a real slot
 */
export function computeAssignmentCost(officer, slot, metrics, weights, context = {}) {
  // Regra 5: Restrição expressa
  if (isOfficerRestrictedFromSlot(officer, slot, context)) {
    return FORBIDDEN_COST;
  }

  const w = { ...DEFAULT_WEIGHTS, ...weights };

  // Penalidade de acúmulo de funções (se o oficial já tem uma atribuição na outra fase)
  let accumulationCost = 0;
  if (context.officerHasPlatoon && slot.type === 'posto') {
    accumulationCost =
      w.pesoAcumuloPelotaoPosto +
      (metrics?.totalAccumulations || 0) * 55 +
      (metrics?.accumulatedLastWeek ? 80 : 0);
  } else if (context.officerHasPhysicalPost && (slot.type === 'pelotao' || slot.isCommand)) {
    accumulationCost =
      w.pesoAcumuloPelotaoPosto +
      (metrics?.totalAccumulations || 0) * 55 +
      (metrics?.accumulatedLastWeek ? 80 : 0);
  }

  // Urgência geral de trabalhar (quanto maior a urgência, mais negativo/menor o custo)
  // Regra 2: semanas sem escala (maior número = mais urgente trabalhar)
  const idleBonus = (metrics?.weeksSinceLastDuty || 0) * w.pesoSemanasSemEscala;
  
  // Regra 3: equilíbrio total (quem tem muitas escalas tem maior custo)
  const totalDutyPenalty = (metrics?.totalDuties || 0) * w.pesoEquilibrioEscalasTotais;
  
  // Penalidade de consecutivo geral
  const consecutiveDutyPenalty = metrics?.servedLastWeek ? w.pesoEscalaSemanaAnterior : 0;

  // Custo base geral (menor = melhor para trabalhar)
  let cost = -idleBonus + totalDutyPenalty + consecutiveDutyPenalty + accumulationCost;

  if (slot.type === 'posto') {
    // Regra 1: Penalidades de repetição em Posto Físico
    // Verifica repetição por slot.id, slot.baseId ou grupo inferido (ex: cozinha_10m, guarita, escada_1)
    const slotGroup = inferSlotGroup(slot);
    const slotSector = inferSlotSector(slot);

    const isSamePostLastWeek = Boolean(
      metrics?.lastWeekPostId === slot.id ||
      (slotGroup && (metrics?.lastWeekPostGroup === slotGroup || metrics?.lastWeekPostId === slotGroup))
    );
    const isSamePost2WeeksAgo = Boolean(
      metrics?.twoWeeksAgoPostId === slot.id ||
      (slotGroup && (metrics?.twoWeeksAgoPostGroup === slotGroup || metrics?.twoWeeksAgoPostId === slotGroup))
    );
    const isSameLastAssignedPost = Boolean(
      !isSamePostLastWeek &&
      (metrics?.lastAssignedPostId === slot.id ||
        (slotGroup && (metrics?.lastAssignedPostGroup === slotGroup || metrics?.lastAssignedPostId === slotGroup)))
    );
    const isSameSecondLastAssignedPost = Boolean(
      !isSamePostLastWeek &&
      !isSamePost2WeeksAgo &&
      !isSameLastAssignedPost &&
      (metrics?.secondLastAssignedPostId === slot.id ||
        (slotGroup && (metrics?.secondLastAssignedPostGroup === slotGroup || metrics?.secondLastAssignedPostId === slotGroup)))
    );

    const countById = metrics?.postCounts?.[slot.id] || 0;
    const countByGroup = slotGroup ? (metrics?.postCounts?.[slotGroup] || 0) : 0;
    const timesInThisPost = Math.max(countById, countByGroup);

    if (isSamePostLastWeek) {
      cost += w.pesoRepeticaoPostoSemanaAnterior;
    } else if (isSameLastAssignedPost) {
      // Lembra do último posto físico mesmo após semanas intercaladas em comando de pelotão
      cost += Math.round(w.pesoRepeticaoPostoSemanaAnterior * 0.8);
    }

    if (isSamePost2WeeksAgo) {
      cost += w.pesoRepeticaoPostoDuasSemanas;
    } else if (isSameSecondLastAssignedPost) {
      cost += Math.round(w.pesoRepeticaoPostoDuasSemanas * 0.6);
    }

    cost += timesInThisPost * w.pesoHistoricoMesmoPosto;

    // Penalidade moderada de repetição de setor (ex: Cozinha -> Cozinha, Refeitório -> Refeitório)
    // para evitar o efeito "esteira" em que a mesma pessoa fica presa no mesmo setor toda semana
    if (slotSector) {
      if (!isSamePostLastWeek && (metrics?.lastWeekPostSector === slotSector || metrics?.lastAssignedPostSector === slotSector)) {
        cost += 28;
      }
      cost += (metrics?.sectorCounts?.[slotSector] || 0) * 6;
    }

  } else if (slot.type === 'pelotao' || slot.isCommand) {
    // Regra 4: Prioridade para o comando dos pelotões
    if (metrics?.commandedLastWeek) {
      // Exerceu comando na semana anterior: penalidade alta para permitir que outros comandem
      cost += w.penalidadeComandoConsecutivo;
    } else {
      // NÃO exerceu comando na semana anterior: PRIORIDADE FORTE para assumir comando
      cost -= w.bonusComandoNaoComandouSemanaAnterior;
    }

    // Prioridade por semanas sem exercer comando (quem está há mais tempo sem comandar tem maior prioridade)
    cost -= (metrics?.weeksSinceLastCommand || 0) * w.pesoSemanasSemComando;

    // Equilíbrio na quantidade total de comandos exercidos
    cost += (metrics?.totalCommands || 0) * w.pesoEquilibrioComandosTotais;

    // Evitar que comande repetidamente o mesmo pelotão (inclusive após semanas intercaladas em posto físico)
    const isSamePelotaoLastWeek = metrics?.lastWeekPelotaoId === slot.id;
    const isSameLastAssignedPelotao = !isSamePelotaoLastWeek && metrics?.lastAssignedPelotaoId === slot.id;
    const isSameSecondLastAssignedPelotao =
      !isSamePelotaoLastWeek &&
      !isSameLastAssignedPelotao &&
      metrics?.secondLastAssignedPelotaoId === slot.id;

    if (isSamePelotaoLastWeek || isSameLastAssignedPelotao) {
      cost += w.pesoRepeticaoPelotaoSemanaAnterior;
    } else if (isSameSecondLastAssignedPelotao) {
      cost += Math.round(w.pesoRepeticaoPelotaoSemanaAnterior * 0.5);
    }

    const timesInThisPelotao = metrics?.pelotaoCounts?.[slot.id] || 0;
    cost += timesInThisPelotao * w.pesoHistoricoMesmoPelotao;
  }

  if ((context.currentWeekNumber || 1) > 1) {
    cost += deterministicTieBreaker(officer.id, slot.id, context.currentWeekNumber);
  }

  return cost;
}

/**
 * Builds the square cost matrix with dummy rows/columns as needed
 */
export function buildCostMatrix({
  officers, // Array of available real officers
  slots,    // Array of available real slots
  metricsMap,
  weights,
  getContext = (officer, slot) => ({})
}) {
  const numOfficers = officers.length;
  const numSlots = slots.length;
  const dim = Math.max(numOfficers, numSlots);

  const matrix = Array.from({ length: dim }, () => new Array(dim).fill(0));

  for (let i = 0; i < dim; i++) {
    const isRealOfficer = i < numOfficers;
    const officer = isRealOfficer ? officers[i] : null;
    const metrics = isRealOfficer ? metricsMap.get(officer.id) : null;

    for (let j = 0; j < dim; j++) {
      const isRealSlot = j < numSlots;
      const slot = isRealSlot ? slots[j] : null;

      if (isRealOfficer && isRealSlot) {
        // Real Officer -> Real Slot
        const ctx = getContext(officer, slot);
        matrix[i][j] = computeAssignmentCost(officer, slot, metrics, weights, ctx);
      } else if (!isRealOfficer && isRealSlot) {
        // Dummy Officer -> Real Slot (Slot remains unfilled/pending)
        matrix[i][j] = DUMMY_OFFICER_COST;
      } else if (isRealOfficer && !isRealSlot) {
        // Real Officer -> Dummy Slot (Officer gets rest / folga)
        // Custo 0 base. Como os custos de trabalho dos oficiais prioritários são negativos (-idleBonus),
        // quem precisa trabalhar terá custo negativo (mais barato que 0 para slots reais).
        // Quem já trabalhou muito terá custo positivo para slots reais, então o solver prefere casá-lo com a folga (custo 0).
        matrix[i][j] = (weights?.custoBaseFolga || DEFAULT_WEIGHTS.custoBaseFolga);
      } else {
        // Dummy Officer -> Dummy Slot
        matrix[i][j] = 0;
      }
    }
  }

  return { matrix, dim, numOfficers, numSlots };
}
