import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generateWeeklySchedule } from '../server/algorithm/optimizer.js';
import { calculateOfficerMetrics } from '../server/algorithm/historyMetrics.js';
import { generateSystemStats } from '../server/algorithm/stats.js';
import { exportHistorySummaryToTxt } from '../src/utils/exportUtils.js';
import { DatabaseStorage } from '../server/storage.js';

test('Bug 1: Regenerar uma semana já existente deve ignorar semanas >= currentWeekNumber no histórico', () => {
  const officers = [
    { id: 'off_1', name: 'Oficial 1', sexo: 'masculino', status: 'ativo', restrictions: [] },
    { id: 'off_2', name: 'Oficial 2', sexo: 'masculino', status: 'ativo', restrictions: [] }
  ];

  const history = [
    {
      weekNumber: 1,
      assignments: [{ slotId: 'posto_guarita', slotType: 'posto', officerId: 'off_1' }]
    },
    {
      weekNumber: 2,
      assignments: [{ slotId: 'posto_guarita', slotType: 'posto', officerId: 'off_2' }]
    },
    {
      weekNumber: 3,
      assignments: [{ slotId: 'posto_guarita', slotType: 'posto', officerId: 'off_2' }]
    }
  ];

  const m1 = calculateOfficerMetrics(officers[0], history, 2);
  const m2 = calculateOfficerMetrics(officers[1], history, 2);

  assert.equal(m1.totalDuties, 1, 'off_1 só teve 1 escala antes da Semana 2');
  assert.equal(m1.servedLastWeek, true, 'off_1 trabalhou na Semana 1 (anterior à 2)');
  assert.equal(m2.totalDuties, 0, 'off_2 teve 0 escalas antes da Semana 2');
  assert.equal(m2.servedLastWeek, false, 'off_2 não trabalhou na Semana 1');
});

test('Bug 2: Vagas com mesmo baseId (ex: Cozinha 10m Vaga 1 e Vaga 2) devem penalizar repetição cruzada', () => {
  const officers = [
    { id: 'off_1', name: 'Oficial 1', sexo: 'feminino', status: 'ativo', restrictions: [] },
    { id: 'off_2', name: 'Oficial 2', sexo: 'feminino', status: 'ativo', restrictions: [] }
  ];

  const slots = [
    { id: 'posto_10', name: 'Cozinha — 10 minutos (Vaga 2)', baseId: 'cozinha_10m', type: 'posto' },
    { id: 'posto_16', name: 'Guarita', type: 'posto' }
  ];

  // Na Semana 1, off_1 fez Cozinha 10m (Vaga 1) e off_2 fez Armários (posto_7)
  const history = [
    {
      weekNumber: 1,
      assignments: [
        { slotId: 'posto_9', slotName: 'Cozinha — 10 minutos (Vaga 1)', slotType: 'posto', officerId: 'off_1' },
        { slotId: 'posto_7', slotName: 'Armários', slotType: 'posto', officerId: 'off_2' }
      ]
    }
  ];

  // Na Semana 2, estão disponíveis posto_10 (Cozinha 10m Vaga 2) e posto_16 (Guarita).
  // Como off_1 já fez Cozinha 10m (Vaga 1) na Semana 1, off_1 deve ir para Guarita e off_2 para Cozinha 10m (Vaga 2)!
  const result = generateWeeklySchedule({
    allOfficers: officers,
    slots,
    historySchedules: history,
    currentWeekNumber: 2
  });

  const cozinhaVaga2 = result.assignments.find(a => a.slotId === 'posto_10');
  const guarita = result.assignments.find(a => a.slotId === 'posto_16');

  assert.equal(cozinhaVaga2.officerId, 'off_2', 'off_2 deve assumir Cozinha Vaga 2 pois off_1 já fez Cozinha Vaga 1 na semana anterior');
  assert.equal(guarita.officerId, 'off_1', 'off_1 deve ir para Guarita');
});

test('Bug 3: Reserva de banheiro na Fase 1 não pode reservar oficial impedido por restrição expressa', () => {
  const officers = [
    { id: 'off_m1', name: 'Homem Apto Banheiro', sexo: 'masculino', status: 'ativo', restrictions: [] },
    { id: 'off_m2', name: 'Homem Impedido Banheiro', sexo: 'masculino', status: 'ativo', restrictions: ['posto_3'] }
  ];

  const slots = [
    { id: 'pel_1', name: '2º PGM1', type: 'pelotao', isCommand: true },
    { id: 'posto_3', name: 'Banheiro masculino', type: 'posto' }
  ];

  const history = [
    {
      weekNumber: 1,
      assignments: [
        { slotId: 'pel_1', slotType: 'pelotao', isCommand: true, officerId: 'off_m2' },
        { slotId: 'posto_3', slotType: 'posto', isCommand: false, officerId: 'off_m1' }
      ]
    }
  ];

  const result = generateWeeklySchedule({
    allOfficers: officers,
    slots,
    historySchedules: history,
    currentWeekNumber: 2
  });

  assert.equal(result.summary.pendingSlotsCount, 0, 'Nenhuma vaga pode ficar pendente quando há solução válida');
  const bath = result.assignments.find(a => a.slotId === 'posto_3');
  const pel = result.assignments.find(a => a.slotId === 'pel_1');
  assert.equal(bath.officerId, 'off_m1');
  assert.equal(pel.officerId, 'off_m2');
});

test('Bug 4: Memória de último pelotão e último posto mesmo após semana intercalada', () => {
  const officers = [
    { id: 'off_1', name: 'Oficial 1', sexo: 'feminino', status: 'ativo', restrictions: [] },
    { id: 'off_2', name: 'Oficial 2', sexo: 'feminino', status: 'ativo', restrictions: [] },
    { id: 'off_3', name: 'Oficial 3', sexo: 'feminino', status: 'ativo', restrictions: [] },
    { id: 'off_4', name: 'Oficial 4', sexo: 'feminino', status: 'ativo', restrictions: [] }
  ];

  const slots = [
    { id: 'pel_a', name: 'Pelotão A', type: 'pelotao', isCommand: true },
    { id: 'pel_b', name: 'Pelotão B', type: 'pelotao', isCommand: true },
    { id: 'posto_x', name: 'Guarita', type: 'posto' },
    { id: 'posto_y', name: 'Armários', type: 'posto' }
  ];

  const history = [
    {
      weekNumber: 1,
      assignments: [
        { slotId: 'pel_a', slotType: 'pelotao', isCommand: true, officerId: 'off_1' },
        { slotId: 'pel_b', slotType: 'pelotao', isCommand: true, officerId: 'off_2' },
        { slotId: 'posto_x', slotType: 'posto', isCommand: false, officerId: 'off_3' },
        { slotId: 'posto_y', slotType: 'posto', isCommand: false, officerId: 'off_4' }
      ]
    },
    {
      weekNumber: 2,
      assignments: [
        { slotId: 'pel_a', slotType: 'pelotao', isCommand: true, officerId: 'off_3' },
        { slotId: 'pel_b', slotType: 'pelotao', isCommand: true, officerId: 'off_4' },
        { slotId: 'posto_x', slotType: 'posto', isCommand: false, officerId: 'off_1' },
        { slotId: 'posto_y', slotType: 'posto', isCommand: false, officerId: 'off_2' }
      ]
    }
  ];

  const m1 = calculateOfficerMetrics(officers[0], history, 3);
  assert.equal(m1.lastAssignedPelotaoId, 'pel_a', 'Deve lembrar que o último pelotão comandado por off_1 foi pel_a');
});

test('Bug 5: Estatísticas e exportação TXT devem refletir corretamente semanas sem escala e total de designações', () => {
  const officers = [
    { id: 'off_1', name: 'Alpha', patente: 'CFOM', status: 'ativo' },
    { id: 'off_2', name: 'Bravo', patente: 'CFOM', status: 'ativo' }
  ];
  const schedules = [
    {
      weekNumber: 1,
      assignments: [{ slotId: 'posto_1', slotName: 'Guarita', slotType: 'posto', status: 'atribuido', officerId: 'off_1', officerName: 'Alpha' }]
    },
    {
      weekNumber: 2,
      assignments: [{ slotId: 'posto_1', slotName: 'Guarita', slotType: 'posto', status: 'atribuido', officerId: 'off_1', officerName: 'Alpha' }]
    }
  ];

  const stats = generateSystemStats(officers, schedules);
  assert.equal(stats.global.totalDuties, 2, 'global.totalDuties deve somar todas as escalas');

  const bravoStat = stats.officerStats.find(s => s.id === 'off_2');
  assert.equal(bravoStat.weeksWithoutDuty, 2);
  assert.equal(bravoStat.weeksSinceLastDuty, 2, 'weeksSinceLastDuty deve estar presente para compatibilidade com UI e exportação');

  const txt = exportHistorySummaryToTxt(schedules, officers, stats);
  assert.ok(txt.includes('2 sem'), 'O relatório TXT deve exibir "2 sem" para o oficial Bravo que ficou 2 semanas sem escala');
});

test('Bug 6: Fase 1 não pode alocar em pelotão o único oficial apto para um posto físico sem acúmulo (ex: Guarita)', () => {
  // off_1 é o ÚNICO oficial sem restrição para Guarita (posto_16).
  // off_2 tem restrição para Guarita, mas pode comandar o Pelotão.
  const officers = [
    { id: 'off_1', name: 'Oficial Único Guarita', sexo: 'feminino', status: 'ativo', restrictions: [] },
    { id: 'off_2', name: 'Oficial Restrito Guarita', sexo: 'feminino', status: 'ativo', restrictions: ['posto_16'] }
  ];

  const slots = [
    { id: 'pel_1', name: '2º PGM1', type: 'pelotao', isCommand: true },
    { id: 'posto_16', name: 'Guarita', type: 'posto' }
  ];

  // Na Semana 1, off_2 comandou pel_1 e off_1 ficou na Guarita.
  // Na Semana 2, off_1 teria preferência para o pel_1, mas se off_1 for para o pel_1,
  // a Guarita ficará PENDENTE porque off_2 é impedido na Guarita e Guarita não acumula!
  const history = [
    {
      weekNumber: 1,
      assignments: [
        { slotId: 'pel_1', slotType: 'pelotao', isCommand: true, officerId: 'off_2' },
        { slotId: 'posto_16', slotType: 'posto', isCommand: false, officerId: 'off_1' }
      ]
    }
  ];

  const result = generateWeeklySchedule({
    allOfficers: officers,
    slots,
    historySchedules: history,
    currentWeekNumber: 2
  });

  assert.equal(result.summary.pendingSlotsCount, 0, 'Guarita não pode ficar pendente quando existe atribuição válida completa');
  const guarita = result.assignments.find(a => a.slotId === 'posto_16');
  const pel = result.assignments.find(a => a.slotId === 'pel_1');
  assert.equal(guarita.officerId, 'off_1');
  assert.equal(pel.officerId, 'off_2');
});

test('Bug 7: Oficiais duplicados na lista de entrada nunca devem ser escalados duas vezes na mesma semana como pessoas distintas', () => {
  // Mesmo nome "Barbosa" cadastrado com dois IDs diferentes por engano
  const officers = [
    { id: 'off_b1', name: 'Barbosa', sexo: 'feminino', status: 'ativo', restrictions: [] },
    { id: 'off_b2', name: 'Barbosa', sexo: 'feminino', status: 'ativo', restrictions: [] },
    { id: 'off_s1', name: 'Santos', sexo: 'feminino', status: 'ativo', restrictions: [] }
  ];

  const slots = [
    { id: 'posto_1', name: '1º andar — Escada de incêndio', type: 'posto' },
    { id: 'posto_17', name: '1º andar — Escada principal', type: 'posto' }
  ];

  const result = generateWeeklySchedule({
    allOfficers: officers,
    slots,
    historySchedules: [],
    currentWeekNumber: 1
  });

  const assignedNames = result.assignments.filter(a => a.officerName).map(a => a.officerName);
  const barbosaCount = assignedNames.filter(n => n === 'Barbosa').length;
  assert.equal(barbosaCount, 1, 'A mesma pessoa ("Barbosa") não pode ser escalada em dois postos que não acumulam');
});

test('Bug 8: DatabaseStorage previne cadastro duplicado de nomes e preserva iniciais no bulkAddOfficers', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'escala-test-'));
  try {
    const store = new DatabaseStorage(tempDir);

    // Importação em lote com numeração, inicial "Juliana M" (como mulher) e duplicata na mesma lista
    const added = store.bulkAddOfficers(
      [
        '1. Juliana M',
        '2. Ana Silva (Mulher)',
        '3. Carlos - H',
        '4. Juliana M', // duplicado!
        '5. ana silva'  // duplicado (case-insensitive)!
      ],
      'CFOM',
      'feminino'
    );

    assert.equal(added.length, 3, 'Deve importar apenas os 3 nomes únicos, ignorando duplicatas');
    assert.equal(added[0].name, 'Juliana M', 'Não deve cortar a inicial "M" do nome "Juliana M"');
    assert.equal(added[0].sexo, 'feminino', 'Juliana M deve manter o sexo padrão feminino');
    assert.equal(added[1].name, 'Ana Silva');
    assert.equal(added[1].sexo, 'feminino');
    assert.equal(added[2].name, 'Carlos');
    assert.equal(added[2].sexo, 'masculino');

    // Tentativa de cadastrar novamente um nome existente via addOfficer deve lançar DUPLICATE_OFFICER
    assert.throws(
      () => store.addOfficer({ name: 'Juliana M', sexo: 'feminino' }),
      err => err.code === 'DUPLICATE_OFFICER'
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
