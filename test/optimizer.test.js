import test from 'node:test';
import assert from 'node:assert/strict';
import { generateWeeklySchedule } from '../server/algorithm/optimizer.js';

// Helper mock generators
function makeOfficers(count, prefix = 'Oficial') {
  return Array.from({ length: count }, (_, i) => ({
    id: `off_${i + 1}`,
    name: `${prefix} ${String.fromCharCode(65 + (i % 26))}${i >= 26 ? Math.floor(i / 26) : ''}`,
    idNumber: `MAT-${1000 + i + 1}`,
    status: 'ativo',
    restrictions: []
  }));
}

function makeSlots() {
  return [
    // 3 physical posts
    { id: 'posto_guarita', name: 'Guarita', type: 'posto' },
    { id: 'posto_refeitorio', name: 'Refeitório — Porta', type: 'posto' },
    { id: 'posto_armarios', name: 'Armários', type: 'posto' },
    // 2 platoons
    { id: 'pelotao_asp_1', name: 'Pelotão Aspirantes 1', type: 'pelotao', isCommand: true },
    { id: 'pelotao_2ano_1', name: 'Pelotão 2º Ano 1', type: 'pelotao', isCommand: true }
  ];
}

test('1. As vagas são preenchidas corretamente quando há oficiais suficientes', () => {
  const officers = makeOfficers(10);
  const slots = makeSlots();

  const result = generateWeeklySchedule({
    allOfficers: officers,
    slots,
    historySchedules: [],
    currentWeekNumber: 1
  });

  assert.equal(result.summary.totalSlots, 5);
  assert.equal(result.summary.filledSlots, 5);
  assert.equal(result.summary.pendingSlotsCount, 0);
  assert.equal(result.assignments.length, 5);
  assert.equal(result.restingOfficers.length, 5);

  // Every assignment has a valid officer
  for (const a of result.assignments) {
    assert.equal(a.status, 'atribuido');
    assert.ok(a.officerId);
  }
});

test('2. As restrições obrigatórias são respeitadas (oficial impedido nunca é alocado na vaga)', () => {
  const officers = makeOfficers(5);
  // Oficial 1 está proibido na Guarita
  officers[0].restrictions = ['posto_guarita'];

  const slots = [
    { id: 'posto_guarita', name: 'Guarita', type: 'posto' },
    { id: 'posto_armarios', name: 'Armários', type: 'posto' }
  ];

  // Simula várias semanas
  for (let w = 1; w <= 3; w++) {
    const result = generateWeeklySchedule({
      allOfficers: officers,
      slots,
      historySchedules: [],
      currentWeekNumber: w
    });

    const guaritaAssignment = result.assignments.find(a => a.slotId === 'posto_guarita');
    assert.notEqual(guaritaAssignment.officerId, 'off_1', 'Oficial 1 não pode ser colocado na Guarita');
  }
});

test('3. Oficiais inativos nunca são selecionados', () => {
  const officers = makeOfficers(3);
  officers[0].status = 'inativo'; // off_1 inativo

  const slots = [
    { id: 'posto_guarita', name: 'Guarita', type: 'posto' },
    { id: 'posto_armarios', name: 'Armários', type: 'posto' }
  ];

  const result = generateWeeklySchedule({
    allOfficers: officers,
    slots,
    historySchedules: [],
    currentWeekNumber: 1
  });

  const assignedOfficerIds = result.assignments.map(a => a.officerId);
  assert.ok(!assignedOfficerIds.includes('off_1'), 'Oficial inativo não pode ser escalado');
});

test('4. Oficiais sem escala há mais tempo recebem prioridade', () => {
  const officers = makeOfficers(4);
  const slots = [{ id: 'posto_guarita', name: 'Guarita', type: 'posto' }];

  // Histórico:
  // Semana 1: off_1 trabalhou
  // Semana 2: off_2 trabalhou
  // Semana 3: off_3 trabalhou
  // off_4 nunca trabalhou (esperando há mais tempo)
  const history = [
    { weekNumber: 1, assignments: [{ slotId: 'posto_guarita', slotType: 'posto', officerId: 'off_1' }] },
    { weekNumber: 2, assignments: [{ slotId: 'posto_guarita', slotType: 'posto', officerId: 'off_2' }] },
    { weekNumber: 3, assignments: [{ slotId: 'posto_guarita', slotType: 'posto', officerId: 'off_3' }] }
  ];

  const result = generateWeeklySchedule({
    allOfficers: officers,
    slots,
    historySchedules: history,
    currentWeekNumber: 4
  });

  // off_4 deve ter prioridade máxima para a vaga
  assert.equal(result.assignments[0].officerId, 'off_4');
});

test('5. Oficiais que NÃO comandaram na semana anterior recebem prioridade para comandar', () => {
  // Dois oficiais disponíveis para 1 vaga de pelotão e 1 posto físico
  const officers = makeOfficers(2);
  const slots = [
    { id: 'pelotao_asp_1', name: 'Pelotão Aspirantes 1', type: 'pelotao', isCommand: true },
    { id: 'posto_guarita', name: 'Guarita', type: 'posto' }
  ];

  // Na semana 1, off_1 comandou o pelotão e off_2 ficou na guarita
  const history = [
    {
      weekNumber: 1,
      assignments: [
        { slotId: 'pelotao_asp_1', slotType: 'pelotao', isCommand: true, officerId: 'off_1' },
        { slotId: 'posto_guarita', slotType: 'posto', isCommand: false, officerId: 'off_2' }
      ]
    }
  ];

  // Na semana 2: off_2 (que NÃO comandou na semana anterior) deve receber o pelotão!
  const result = generateWeeklySchedule({
    allOfficers: officers,
    slots,
    historySchedules: history,
    currentWeekNumber: 2
  });

  const pelotaoAssignment = result.assignments.find(a => a.slotId === 'pelotao_asp_1');
  const guaritaAssignment = result.assignments.find(a => a.slotId === 'posto_guarita');

  assert.equal(pelotaoAssignment.officerId, 'off_2', 'Oficial que não comandou na semana anterior deve assumir o pelotão');
  assert.equal(guaritaAssignment.officerId, 'off_1', 'Oficial que comandou na semana anterior vai para posto físico');
});

test('6. Histórico de comando é independente do histórico de participação', () => {
  // off_1 participou de vários postos físicos mas nunca comandou
  // off_2 participou do mesmo número total de escalas mas comandou recentemente
  const officers = makeOfficers(2);
  const slots = [{ id: 'pelotao_asp_1', name: 'Pelotão Aspirantes 1', type: 'pelotao', isCommand: true }];

  const history = [
    {
      weekNumber: 1,
      assignments: [
        { slotId: 'posto_guarita', slotType: 'posto', isCommand: false, officerId: 'off_1' },
        { slotId: 'pelotao_asp_1', slotType: 'pelotao', isCommand: true, officerId: 'off_2' }
      ]
    }
  ];

  const result = generateWeeklySchedule({
    allOfficers: officers,
    slots,
    historySchedules: history,
    currentWeekNumber: 2
  });

  // Embora ambos tenham totalDuties = 1, off_1 tem totalCommands = 0 e não comandou semana passada,
  // logo off_1 deve receber o comando!
  assert.equal(result.assignments[0].officerId, 'off_1');
});

test('7. Repetições de postos diminuem', () => {
  const officers = makeOfficers(2);
  const slots = [
    { id: 'posto_guarita', name: 'Guarita', type: 'posto' },
    { id: 'posto_armarios', name: 'Armários', type: 'posto' }
  ];

  // Semana 1: off_1 na guarita, off_2 nos armários
  const history = [
    {
      weekNumber: 1,
      assignments: [
        { slotId: 'posto_guarita', slotType: 'posto', officerId: 'off_1' },
        { slotId: 'posto_armarios', slotType: 'posto', officerId: 'off_2' }
      ]
    }
  ];

  // Semana 2: o algoritmo deve inverter para evitar repetição do mesmo posto consecutivo
  const result = generateWeeklySchedule({
    allOfficers: officers,
    slots,
    historySchedules: history,
    currentWeekNumber: 2
  });

  const guaritaAssignment = result.assignments.find(a => a.slotId === 'posto_guarita');
  const armariosAssignment = result.assignments.find(a => a.slotId === 'posto_armarios');

  assert.equal(guaritaAssignment.officerId, 'off_2', 'Oficial 2 deve ir para a Guarita na semana 2');
  assert.equal(armariosAssignment.officerId, 'off_1', 'Oficial 1 deve ir para os Armários na semana 2');
});

test('8. Atribuições manuais protegidas (locks) são preservadas', () => {
  const officers = makeOfficers(5);
  const slots = makeSlots();

  // Usuário fixa manualmente o Oficial 5 na Guarita
  const manualLocks = {
    posto_guarita: 'off_5'
  };

  const result = generateWeeklySchedule({
    allOfficers: officers,
    slots,
    historySchedules: [],
    currentWeekNumber: 1,
    manualLocks
  });

  const guarita = result.assignments.find(a => a.slotId === 'posto_guarita');
  assert.equal(guarita.officerId, 'off_5');
  assert.equal(guarita.isLocked, true);

  // Nenhum outro posto pode receber off_5
  const otherAssignmentsWithOff5 = result.assignments.filter(
    a => a.slotId !== 'posto_guarita' && a.officerId === 'off_5'
  );
  assert.equal(otherAssignmentsWithOff5.length, 0);
});

test('9. Funciona quando há oficiais insuficientes (vagas pendentes notificadas)', () => {
  const officers = makeOfficers(2); // Apenas 2 oficiais
  const slots = makeSlots();        // 5 vagas (2 pelotões, 1 refeitório que acumula, 2 postos guarita/armários que não acumulam)

  const result = generateWeeklySchedule({
    allOfficers: officers,
    slots,
    historySchedules: [],
    currentWeekNumber: 1
  });

  assert.equal(result.summary.totalSlots, 5);
  // Os 2 oficiais comandam 2 pelotões. Dos 3 postos, apenas o Refeitório permite acúmulo.
  // Guarita e Armários não podem acumular por regra, restando pendentes.
  assert.equal(result.summary.filledSlots, 3);
  assert.equal(result.summary.pendingSlotsCount, 2);
  assert.equal(result.summary.isFullyFilled, false);

  const pending = result.assignments.filter(a => a.status === 'pendente');
  assert.equal(pending.length, 2);
  for (const p of pending) {
    assert.equal(p.officerId, null);
    assert.ok(p.warning);
  }
});

test('10. Cada posto de pelotão recebe estritamente um único oficial (comandante)', () => {
  const officers = makeOfficers(15);
  const slots = [
    { id: 'pel_asp_1', name: 'Pelotão Aspirantes 1', type: 'pelotao', isCommand: true },
    { id: 'pel_asp_2', name: 'Pelotão Aspirantes 2', type: 'pelotao', isCommand: true },
    { id: 'pel_asp_3', name: 'Pelotão Aspirantes 3', type: 'pelotao', isCommand: true },
    { id: 'pel_2ano_1', name: 'Pelotão 2º Ano 1', type: 'pelotao', isCommand: true },
    { id: 'posto_guarita', name: 'Guarita', type: 'posto' }
  ];

  const result = generateWeeklySchedule({
    allOfficers: officers,
    slots,
    historySchedules: [],
    currentWeekNumber: 1
  });

  const platoonSlots = slots.filter(s => s.type === 'pelotao');
  const assignedOfficers = [];

  for (const pSlot of platoonSlots) {
    // Exatamente uma atribuição para este pelotão
    const matched = result.assignments.filter(a => a.slotId === pSlot.id);
    assert.equal(matched.length, 1, `Pelotão ${pSlot.id} deve ter exatamente 1 registro`);
    
    // Deve ter exatamente 1 oficial comandante
    const assignment = matched[0];
    assert.equal(assignment.status, 'atribuido');
    assert.ok(assignment.officerId, 'Deve haver um oficial atribuído');
    assert.equal(assignment.isCommand, true, 'Deve ser identificado como comando');
    assert.equal(assignment.cargo, 'Comandante de Pelotão');

    assignedOfficers.push(assignment.officerId);
  }

  // Todos os comandantes devem ser oficiais distintos (1 por pelotão, sem duplicação)
  const uniqueOfficers = new Set(assignedOfficers);
  assert.equal(uniqueOfficers.size, platoonSlots.length, 'Cada pelotão deve ter um oficial único e exclusivo');
});

test('11. Homem nunca é escalado no banheiro feminino e Mulher nunca no banheiro masculino', () => {
  const officers = [
    { id: 'off_m1', name: 'Oficial João (Homem)', sexo: 'masculino', patente: 'CFOM', status: 'ativo', restrictions: [] },
    { id: 'off_m2', name: 'Oficial Pedro (Homem)', sexo: 'masculino', patente: 'CFOM', status: 'ativo', restrictions: [] },
    { id: 'off_f1', name: 'Oficial Maria (Mulher)', sexo: 'feminino', patente: 'CFOM', status: 'ativo', restrictions: [] },
    { id: 'off_f2', name: 'Oficial Ana (Mulher)', sexo: 'feminino', patente: 'CFOM', status: 'ativo', restrictions: [] }
  ];

  const slots = [
    { id: 'posto_2', name: 'Banheiro feminino', type: 'posto' },
    { id: 'posto_3', name: 'Banheiro masculino', type: 'posto' },
    { id: 'posto_guarita', name: 'Guarita', type: 'posto' },
    { id: 'posto_armarios', name: 'Armários', type: 'posto' }
  ];

  const result = generateWeeklySchedule({
    allOfficers: officers,
    slots,
    historySchedules: [],
    currentWeekNumber: 1
  });

  const femaleBathAssignment = result.assignments.find(a => a.slotId === 'posto_2');
  const maleBathAssignment = result.assignments.find(a => a.slotId === 'posto_3');

  // Banheiro feminino deve ser ocupado por mulher
  assert.equal(femaleBathAssignment.status, 'atribuido');
  const femaleBathOfficer = officers.find(o => o.id === femaleBathAssignment.officerId);
  assert.equal(femaleBathOfficer.sexo, 'feminino', 'Banheiro feminino deve ser estritamente mulher');

  // Banheiro masculino deve ser ocupado por homem
  assert.equal(maleBathAssignment.status, 'atribuido');
  const maleBathOfficer = officers.find(o => o.id === maleBathAssignment.officerId);
  assert.equal(maleBathOfficer.sexo, 'masculino', 'Banheiro masculino deve ser estritamente homem');

  // Teste de caso extremo: se só houver homens, banheiro feminino NÃO pode ser preenchido (deve ficar pendente)
  const onlyMen = [
    { id: 'off_m1', name: 'Oficial Carlos', sexo: 'masculino', patente: 'CFOM', status: 'ativo', restrictions: [] },
    { id: 'off_m2', name: 'Oficial Lucas', sexo: 'masculino', patente: 'CFOM', status: 'ativo', restrictions: [] }
  ];
  const testSlots = [
    { id: 'posto_2', name: 'Banheiro feminino', type: 'posto' },
    { id: 'posto_guarita', name: 'Guarita', type: 'posto' }
  ];

  const resultOnlyMen = generateWeeklySchedule({
    allOfficers: onlyMen,
    slots: testSlots,
    historySchedules: [],
    currentWeekNumber: 1
  });

  const femBathPending = resultOnlyMen.assignments.find(a => a.slotId === 'posto_2');
  assert.equal(femBathPending.status, 'pendente', 'Banheiro feminino deve ficar pendente se só houver homens disponíveis');
});

test('12. Cenário Real: 24 oficiais preenchem todas as 26 vagas (17 postos + 9 pelotões) sem oficiais em banheiro comandando pelotão', () => {
  // 3 homens e 21 mulheres, exatamente a composição real dos 24 CFOMs cadastrados
  const officers = [
    { id: 'off_bueno', name: 'Bueno', sexo: 'masculino', patente: 'CFOM', status: 'ativo', restrictions: [] },
    { id: 'off_rocha', name: 'Rocha', sexo: 'masculino', patente: 'CFOM', status: 'ativo', restrictions: [] },
    { id: 'off_pimentel', name: 'Pimentel', sexo: 'masculino', patente: 'CFOM', status: 'ativo', restrictions: [] },
    ...Array.from({ length: 21 }, (_, i) => ({
      id: `off_f_${i + 1}`,
      name: `Oficial F ${i + 1}`,
      sexo: 'feminino',
      patente: 'CFOM',
      status: 'ativo',
      restrictions: []
    }))
  ];

  // 17 postos físicos
  const physicalPosts = [
    { id: 'posto_1', name: '1º andar — Escada de incêndio', type: 'posto' },
    { id: 'posto_2', name: 'Banheiro feminino', type: 'posto' },
    { id: 'posto_3', name: 'Banheiro masculino', type: 'posto' },
    { id: 'posto_4', name: 'Corredor PGM2', type: 'posto' },
    { id: 'posto_5', name: '1º andar — Escada da secretaria', type: 'posto' },
    { id: 'posto_6', name: 'Último andar — Escada de incêndio', type: 'posto' },
    { id: 'posto_7', name: 'Armários', type: 'posto' },
    { id: 'posto_8', name: 'Bebedouro', type: 'posto' },
    { id: 'posto_9', name: 'Cozinha — 10 minutos (Vaga 1)', type: 'posto' },
    { id: 'posto_10', name: 'Cozinha — 10 minutos (Vaga 2)', type: 'posto' },
    { id: 'posto_11', name: 'Cozinha — Fiscalização (Vaga 1)', type: 'posto' },
    { id: 'posto_12', name: 'Cozinha — Fiscalização (Vaga 2)', type: 'posto' },
    { id: 'posto_13', name: 'Refeitório — Fila', type: 'posto' },
    { id: 'posto_14', name: 'Refeitório — Porta', type: 'posto' },
    { id: 'posto_15', name: 'Refeitório — Escada', type: 'posto' },
    { id: 'posto_16', name: 'Guarita', type: 'posto' },
    { id: 'posto_17', name: '1º andar — Escada principal', type: 'posto' }
  ];

  // 9 pelotões
  const platoons = [
    { id: 'pel_1', name: '2º PGM1', type: 'pelotao', isCommand: true },
    { id: 'pel_2', name: '2º TEC D', type: 'pelotao', isCommand: true },
    { id: 'pel_3', name: '2º TEC E', type: 'pelotao', isCommand: true },
    { id: 'pel_4', name: '2º TEC F', type: 'pelotao', isCommand: true },
    { id: 'pel_5', name: '1º TEC E', type: 'pelotao', isCommand: true },
    { id: 'pel_6', name: '1º TEC F', type: 'pelotao', isCommand: true },
    { id: 'pel_7', name: '1º TEC G', type: 'pelotao', isCommand: true },
    { id: 'pel_8', name: '1º TEC H', type: 'pelotao', isCommand: true },
    { id: 'pel_9', name: 'Comando Geral', type: 'pelotao', isCommand: true }
  ];

  const slots = [...physicalPosts, ...platoons];

  const result = generateWeeklySchedule({
    allOfficers: officers,
    slots,
    historySchedules: [],
    currentWeekNumber: 1
  });

  // Todas as 26 vagas devem ser preenchidas! (0 pendentes)
  assert.equal(result.summary.totalSlots, 26);
  assert.equal(result.summary.filledSlots, 26);
  assert.equal(result.summary.pendingSlotsCount, 0);
  assert.equal(result.summary.isFullyFilled, true);

  // Exatamente 2 oficiais acumulam pelotão + posto físico (24 oficiais para 26 vagas)
  assert.equal(result.summary.accumulatedOfficersCount, 2);

  // Verificação crucial: quem está no banheiro NÃO pode ter pelotão!
  const femaleBath = result.assignments.find(a => a.slotId === 'posto_2');
  const maleBath = result.assignments.find(a => a.slotId === 'posto_3');

  assert.equal(femaleBath.status, 'atribuido');
  assert.equal(maleBath.status, 'atribuido');

  const femaleBathOfficerPlatoon = result.assignments.find(
    a => a.officerId === femaleBath.officerId && a.isCommand
  );
  assert.equal(femaleBathOfficerPlatoon, undefined, 'Oficial no banheiro feminino não pode comandar pelotão');

  const maleBathOfficerPlatoon = result.assignments.find(
    a => a.officerId === maleBath.officerId && a.isCommand
  );
  assert.equal(maleBathOfficerPlatoon, undefined, 'Oficial no banheiro masculino não pode comandar pelotão');

  // Gênero no banheiro respeitado
  const femaleBathOfficer = officers.find(o => o.id === femaleBath.officerId);
  const maleBathOfficer = officers.find(o => o.id === maleBath.officerId);
  assert.equal(femaleBathOfficer.sexo, 'feminino');
  assert.equal(maleBathOfficer.sexo, 'masculino');

  // Regra do Usuário: "so deixa ficar com duas escalas quem tiver em escala de cozinha refeitorio e fila"
  const accumulatedAssignments = result.assignments.filter(a => a.isAccumulated);
  assert.equal(accumulatedAssignments.length, 4, '2 oficiais com 2 escalas cada = 4 atribuições marcadas com acúmulo');
  
  const accumulatedPhysicalPosts = accumulatedAssignments.filter(a => !a.isCommand);
  for (const post of accumulatedPhysicalPosts) {
    const postNameLower = post.slotName.toLowerCase();
    const isAllowed = 
      postNameLower.includes('cozinha') || 
      postNameLower.includes('refeitório') || 
      postNameLower.includes('refeitorio') || 
      postNameLower.includes('fila');
    assert.ok(
      isAllowed,
      `Vaga acumulada (${post.slotName}) deve ser estritamente cozinha, refeitório ou fila!`
    );
  }
});
