import { DEFAULT_WEIGHTS } from './algorithm/costMatrix.js';

export const PATENTES_MILITARES = [
  'CFOM',
  '2º Tenente Mirim',
  '1º Tenente Mirim',
  'Capitão Mirim',
  'Major Mirim',
  'Tenente-Coronel Mirim',
  'Coronel Mirim'
];

export function getDefaultPhysicalPosts() {
  return [
    { id: 'posto_1', name: '1º andar — Escada de incêndio', type: 'posto', slotsCount: 1, enabled: true },
    { id: 'posto_2', name: 'Banheiro feminino', type: 'posto', slotsCount: 1, enabled: true },
    { id: 'posto_3', name: 'Banheiro masculino', type: 'posto', slotsCount: 1, enabled: true },
    { id: 'posto_4', name: 'Corredor PGM2', type: 'posto', slotsCount: 1, enabled: true },
    { id: 'posto_5', name: '1º andar — Escada da secretaria', type: 'posto', slotsCount: 1, enabled: true },
    { id: 'posto_6', name: 'Último andar — Escada de incêndio', type: 'posto', slotsCount: 1, enabled: true },
    { id: 'posto_7', name: 'Armários', type: 'posto', slotsCount: 1, enabled: true },
    { id: 'posto_8', name: 'Bebedouro', type: 'posto', slotsCount: 1, enabled: true },
    { id: 'posto_9', name: 'Cozinha — 10 minutos (Posto 1)', baseId: 'cozinha_10m', type: 'posto', slotsCount: 1, enabled: true },
    { id: 'posto_10', name: 'Cozinha — 10 minutos (Posto 2)', baseId: 'cozinha_10m', type: 'posto', slotsCount: 1, enabled: true },
    { id: 'posto_11', name: 'Cozinha — Fiscalização (Posto 1)', baseId: 'cozinha_fisc', type: 'posto', slotsCount: 1, enabled: true },
    { id: 'posto_12', name: 'Cozinha — Fiscalização (Posto 2)', baseId: 'cozinha_fisc', type: 'posto', slotsCount: 1, enabled: true },
    { id: 'posto_13', name: 'Refeitório — Fila', type: 'posto', slotsCount: 1, enabled: true },
    { id: 'posto_14', name: 'Refeitório — Porta', type: 'posto', slotsCount: 1, enabled: true },
    { id: 'posto_15', name: 'Refeitório — Escada', type: 'posto', slotsCount: 1, enabled: true },
    { id: 'posto_16', name: 'Guarita', type: 'posto', slotsCount: 1, enabled: true },
    { id: 'posto_17', name: '1º andar — Escada principal', type: 'posto', slotsCount: 1, enabled: true }
  ];
}

export function getDefaultPlatoons() {
  return [
    { id: 'pel_2_pgm1', name: '2º PGM1', type: 'pelotao', isCommand: true, slotsCount: 1, enabled: true },
    { id: 'pel_2_tecd', name: '2º TEC D', type: 'pelotao', isCommand: true, slotsCount: 1, enabled: true },
    { id: 'pel_2_tece', name: '2º TEC E', type: 'pelotao', isCommand: true, slotsCount: 1, enabled: true },
    { id: 'pel_2_tecf', name: '2º TEC F', type: 'pelotao', isCommand: true, slotsCount: 1, enabled: true },
    { id: 'pel_1_tece', name: '1º TEC E', type: 'pelotao', isCommand: true, slotsCount: 1, enabled: true },
    { id: 'pel_1_tecf', name: '1º TEC F', type: 'pelotao', isCommand: true, slotsCount: 1, enabled: true },
    { id: 'pel_1_tecg', name: '1º TEC G', type: 'pelotao', isCommand: true, slotsCount: 1, enabled: true },
    { id: 'pel_1_tech', name: '1º TEC H', type: 'pelotao', isCommand: true, slotsCount: 1, enabled: true }
  ];
}

/**
 * Banco de oficiais inicia limpo para cadastro dos oficiais reais.
 */
export function getDefaultOfficers() {
  return [];
}

export function getDefaultDatabase() {
  return {
    version: 1,
    config: {
      schoolName: 'Sistema de Escalas',
      weights: { ...DEFAULT_WEIGHTS }
    },
    officers: [],
    physicalPosts: getDefaultPhysicalPosts(),
    platoons: getDefaultPlatoons(),
    schedules: []
  };
}
