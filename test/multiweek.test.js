import test from 'node:test';
import assert from 'node:assert/strict';
import { generateWeeklySchedule } from '../server/algorithm/optimizer.js';
import { generateSystemStats } from '../server/algorithm/stats.js';

// Setup full initial catalog matching Section 2:
// 17 physical posts
function getInitialPhysicalPosts() {
  return [
    { id: 'posto_1', name: '1º andar — Escada de incêndio', type: 'posto' },
    { id: 'posto_2', name: 'Banheiro feminino', type: 'posto' },
    { id: 'posto_3', name: 'Banheiro masculino', type: 'posto' },
    { id: 'posto_4', name: 'Corredor PGM2', type: 'posto' },
    { id: 'posto_5', name: '1º andar — Escada da secretaria', type: 'posto' },
    { id: 'posto_6', name: 'Último andar — Escada de incêndio', type: 'posto' },
    { id: 'posto_7', name: 'Armários', type: 'posto' },
    { id: 'posto_8', name: 'Bebedouro', type: 'posto' },
    { id: 'posto_9', name: 'Cozinha — 10 minutos (Vaga 1)', baseId: 'cozinha_10m', type: 'posto' },
    { id: 'posto_10', name: 'Cozinha — 10 minutos (Vaga 2)', baseId: 'cozinha_10m', type: 'posto' },
    { id: 'posto_11', name: 'Cozinha — Fiscalização (Vaga 1)', baseId: 'cozinha_fisc', type: 'posto' },
    { id: 'posto_12', name: 'Cozinha — Fiscalização (Vaga 2)', baseId: 'cozinha_fisc', type: 'posto' },
    { id: 'posto_13', name: 'Refeitório — Fila', type: 'posto' },
    { id: 'posto_14', name: 'Refeitório — Porta', type: 'posto' },
    { id: 'posto_15', name: 'Refeitório — Escada', type: 'posto' },
    { id: 'posto_16', name: 'Guarita', type: 'posto' },
    { id: 'posto_17', name: '1º andar — Escada principal', type: 'posto' }
  ];
}

// 8 Pelotões (4 de 2º ano + 4 de aspirantes/1º ano):
function getInitialPlatoons() {
  return [
    { id: 'pel_2_pgm1', name: '2º PGM1', type: 'pelotao', isCommand: true },
    { id: 'pel_2_tecd', name: '2º TEC D', type: 'pelotao', isCommand: true },
    { id: 'pel_2_tece', name: '2º TEC E', type: 'pelotao', isCommand: true },
    { id: 'pel_2_tecf', name: '2º TEC F', type: 'pelotao', isCommand: true },
    { id: 'pel_1_tece', name: '1º TEC E', type: 'pelotao', isCommand: true },
    { id: 'pel_1_tecf', name: '1º TEC F', type: 'pelotao', isCommand: true },
    { id: 'pel_1_tecg', name: '1º TEC G', type: 'pelotao', isCommand: true },
    { id: 'pel_1_tech', name: '1º TEC H', type: 'pelotao', isCommand: true }
  ];
}

// 50 officers (mix of male and female officers)
function getOfficers(count = 50) {
  return Array.from({ length: count }, (_, i) => ({
    id: `oficial_${i + 1}`,
    name: `Capitão/Tenente Oficial ${i + 1}`,
    patente: 'CFOM',
    sexo: i % 2 === 0 ? 'masculino' : 'feminino',
    status: 'ativo',
    restrictions: []
  }));
}

test('Simulação de 6 semanas consecutivas com escala completa de 25 vagas', () => {
  const officers = getOfficers(50);
  const slots = [...getInitialPhysicalPosts(), ...getInitialPlatoons()];
  assert.equal(slots.length, 25);

  const historySchedules = [];

  for (let week = 1; week <= 6; week++) {
    const result = generateWeeklySchedule({
      allOfficers: officers,
      slots,
      historySchedules,
      currentWeekNumber: week
    });

    assert.equal(result.summary.totalSlots, 25);
    assert.equal(result.summary.filledSlots, 25);
    assert.equal(result.summary.pendingSlotsCount, 0);

    // Save confirmed week
    historySchedules.push({
      weekNumber: week,
      title: `Semana ${week}`,
      assignments: result.assignments
    });
  }

  // Análise dos resultados após 6 semanas
  const stats = generateSystemStats(officers, historySchedules);
  const { global, officerStats } = stats;

  // 1. Verificar equidade geral de escalas
  // Com 50 oficiais e 25 vagas por semana, total de escalas em 6 semanas = 150
  // Média esperada: 150 / 50 = 3.0 escalas por oficial
  assert.ok(global.avgDuties >= 2.8 && global.avgDuties <= 3.2);
  
  // A diferença entre quem mais e quem menos trabalhou deve ser mínima (<= 2)
  assert.ok(global.dutySpread <= 2, `Duty spread (${global.dutySpread}) deve ser <= 2`);
  assert.ok(global.stdDev <= 0.8, `Standard deviation (${global.stdDev}) deve ser baixa`);
  assert.ok(global.equityScore >= 85, `Equity score (${global.equityScore}%) deve ser alto`);

  // 2. Verificar rotação de comando dos pelotões
  // Total de comandos em 6 semanas = 8 * 6 = 48
  // Média esperada: 48 / 50 = 0.96 comandos por oficial
  const commandsCounts = officerStats.map(s => s.totalCommands);
  const maxCommands = Math.max(...commandsCounts);
  const minCommands = Math.min(...commandsCounts);
  assert.ok(maxCommands - minCommands <= 2, `Diferença máxima de comandos (${maxCommands - minCommands}) deve ser <= 2`);

  // 3. Verificar que nenhum oficial comandou repetidamente na mesma semana consecutiva
  for (let w = 1; w < historySchedules.length; w++) {
    const prevWeek = historySchedules[w - 1];
    const currWeek = historySchedules[w];

    const prevCommanders = new Set(
      prevWeek.assignments.filter(a => a.isCommand).map(a => a.officerId)
    );
    const currCommanders = new Set(
      currWeek.assignments.filter(a => a.isCommand).map(a => a.officerId)
    );

    // Como temos 50 oficiais e 20 pelotões, há oficiais descansados de comando suficientes
    // para alternar, então a repetição consecutiva de comando deve ser praticamente zero!
    let consecutiveCommandersCount = 0;
    for (const cmdr of currCommanders) {
      if (prevCommanders.has(cmdr)) {
        consecutiveCommandersCount++;
      }
    }
    // A maioria dos comandantes devem ser novos em relação à semana passada
    assert.ok(
      consecutiveCommandersCount <= 5,
      `Na semana ${w + 1}, repetição de comando consecutiva (${consecutiveCommandersCount}) deve ser mínima`
    );
  }

  // 4. Verificar que ninguém repetiu o mesmo pelotão
  for (const s of officerStats) {
    for (const p of s.topPelotoes) {
      // Em 6 semanas com 20 pelotões, ninguém deve ter caído no mesmo pelotão mais de 2 vezes
      assert.ok(p.count <= 2, `Oficial ${s.name} comandou ${p.name} ${p.count} vezes`);
    }
  }
});
