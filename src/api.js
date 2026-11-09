import seedDatabase from '../data/database.json';
import { generateWeeklySchedule } from '../server/algorithm/optimizer.js';
import { generateSystemStats } from '../server/algorithm/stats.js';
import { normalizePersonName } from '../server/algorithm/historyMetrics.js';
import { DEFAULT_WEIGHTS } from '../server/algorithm/costMatrix.js';
import {
  getDefaultDatabase,
  getDefaultPhysicalPosts,
  getDefaultPlatoons
} from '../server/defaultData.js';

const STORAGE_KEY = 'sistema_escalas_db_v2';
const SESSION_AUTH_KEY = 'sistema_escalas_logged_in_v2';
const CLOUD_KEY_STORAGE = 'sistema_escalas_cloud_key_v1';
const DEFAULT_CLOUD_KEY = 'sistema-escalas-bueno';
const CLOUD_APP_KEY = 'gvwl6lrd';

function sanitizeCloudKey(key) {
  return String(key || DEFAULT_CLOUD_KEY)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_') || 'sistema_escalas_bueno';
}

export function getCloudKey() {
  try {
    return localStorage.getItem(CLOUD_KEY_STORAGE) || DEFAULT_CLOUD_KEY;
  } catch {
    return DEFAULT_CLOUD_KEY;
  }
}

export function setCloudKey(newKey) {
  const clean = String(newKey || DEFAULT_CLOUD_KEY).trim() || DEFAULT_CLOUD_KEY;
  try {
    localStorage.setItem(CLOUD_KEY_STORAGE, clean);
  } catch {}
  return clean;
}

async function compressStringToBase64Url(str) {
  const bytes = new TextEncoder().encode(str);
  const cs = new CompressionStream('deflate-raw');
  const writer = cs.writable.getWriter();
  writer.write(bytes);
  writer.close();
  const compressedBuf = await new Response(cs.readable).arrayBuffer();
  const uint8 = new Uint8Array(compressedBuf);
  let binary = '';
  for (let i = 0; i < uint8.length; i++) {
    binary += String.fromCharCode(uint8[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function decompressBase64UrlToString(b64url) {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const binStr = atob(padded);
  const bytes = new Uint8Array(binStr.length);
  for (let i = 0; i < binStr.length; i++) {
    bytes[i] = binStr.charCodeAt(i);
  }
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  writer.write(bytes);
  writer.close();
  return await new Response(ds.readable).text();
}

/**
 * Saves the JSON database to the automatic Cloud Store (Dontpad-style room by key)
 */
export async function pushToCloud(dbToSave = null, customKey = null) {
  if (typeof fetch === 'undefined') return { ok: false };
  const db = dbToSave || getLocalDatabase();
  const room = sanitizeCloudKey(customKey || getCloudKey());

  try {
    const minJson = JSON.stringify(db);
    const b64url = await compressStringToBase64Url(minJson);
    const chunkSize = 200;
    const chunks = [];
    for (let i = 0; i < b64url.length; i += chunkSize) {
      chunks.push(b64url.slice(i, i + chunkSize));
    }

    // Upload chunks in batches of 4 to avoid connection throttling
    for (let i = 0; i < chunks.length; i += 4) {
      const batch = chunks.slice(i, i + 4);
      await Promise.all(
        batch.map((chunk, idx) =>
          fetch(
            `https://keyvalue.immanuel.co/api/KeyVal/UpdateValue/${CLOUD_APP_KEY}/${room}_c${i + idx}/${chunk}`,
            { method: 'POST' }
          )
        )
      );
    }

    const timestamp = Date.now();
    await fetch(
      `https://keyvalue.immanuel.co/api/KeyVal/UpdateValue/${CLOUD_APP_KEY}/${room}_meta/${chunks.length}_${timestamp}`,
      { method: 'POST' }
    );

    return { ok: true, room, chunks: chunks.length, timestamp };
  } catch (err) {
    console.warn('Aviso ao sincronizar na nuvem:', err);
    return { ok: false, error: err.message };
  }
}

/**
 * Pulls the JSON database automatically from the Cloud Store by key
 */
export async function pullFromCloud(customKey = null) {
  if (typeof fetch === 'undefined') return { ok: false };
  const rawKey = customKey || getCloudKey();
  const room = sanitizeCloudKey(rawKey);

  try {
    const metaResp = await fetch(
      `https://keyvalue.immanuel.co/api/KeyVal/GetValue/${CLOUD_APP_KEY}/${room}_meta`
    );
    if (metaResp.ok) {
      const metaVal = await metaResp.json();
      if (metaVal && typeof metaVal === 'string' && metaVal.includes('_')) {
        const [countStr, tsStr] = metaVal.split('_');
        const count = parseInt(countStr, 10);
        if (count > 0 && count < 200) {
          const fetchedChunks = [];
          for (let i = 0; i < count; i += 4) {
            const batchLen = Math.min(4, count - i);
            const batch = await Promise.all(
              Array.from({ length: batchLen }, (_, k) =>
                fetch(
                  `https://keyvalue.immanuel.co/api/KeyVal/GetValue/${CLOUD_APP_KEY}/${room}_c${i + k}`
                ).then(r => r.json())
              )
            );
            fetchedChunks.push(...batch);
          }
          const b64url = fetchedChunks.join('');
          const jsonStr = await decompressBase64UrlToString(b64url);
          const parsed = JSON.parse(jsonStr);
          if (parsed && Array.isArray(parsed.officers)) {
            const normalized = normalizeDbStructure(parsed);
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
            } catch {}
            syncToServerBackground(normalized);
            return {
              ok: true,
              data: normalized,
              updatedAt: Number(tsStr) || Date.now(),
              source: 'cloud'
            };
          }
        }
      }
    }
  } catch (err) {
    console.warn('Aviso ao buscar da nuvem primária:', err);
  }

  return { ok: false };
}

function cloneData(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function normalizeDbStructure(raw) {
  const fallback = seedDatabase || getDefaultDatabase();
  if (!raw || typeof raw !== 'object') {
    return cloneData(fallback);
  }
  return {
    version: raw.version || 1,
    config: {
      schoolName: raw.config?.schoolName || 'Sistema de Escalas',
      weights: { ...DEFAULT_WEIGHTS, ...(raw.config?.weights || {}) }
    },
    officers: Array.isArray(raw.officers) ? raw.officers : cloneData(fallback.officers || []),
    physicalPosts: Array.isArray(raw.physicalPosts) ? raw.physicalPosts : getDefaultPhysicalPosts(),
    platoons: Array.isArray(raw.platoons) ? raw.platoons : getDefaultPlatoons(),
    schedules: Array.isArray(raw.schedules) ? raw.schedules : []
  };
}

/**
 * Syncs with local Node backend ONLY when running on localhost;
 * never called on Vercel / GitHub Pages so it never produces 404 console errors.
 */
function syncToServerBackground(db) {
  if (typeof fetch === 'undefined' || typeof window === 'undefined') return;
  const host = window.location?.hostname || '';
  const isLocalhost = host === 'localhost' || host === '127.0.0.1';
  if (!isLocalhost) return;

  fetch('/api/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(db)
  }).catch(() => {});
}

export function getLocalDatabase() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return normalizeDbStructure(JSON.parse(raw));
    }
  } catch (err) {
    console.warn('Erro ao ler banco local, usando banco inicial:', err);
  }
  const initial = normalizeDbStructure(seedDatabase);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
  } catch {}
  return initial;
}

export function saveLocalDatabase(db) {
  const normalized = normalizeDbStructure(db);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch (err) {
    console.error('Erro ao salvar no localStorage:', err);
  }
  syncToServerBackground(normalized);
  pushToCloud(normalized).catch(() => {});
  return normalized;
}

export function exportDatabaseJsonString() {
  return JSON.stringify(getLocalDatabase(), null, 2);
}

export function isSessionAuthenticated() {
  try {
    return sessionStorage.getItem(SESSION_AUTH_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setSessionAuthenticated(val) {
  try {
    if (val) {
      sessionStorage.setItem(SESSION_AUTH_KEY, 'true');
    } else {
      sessionStorage.removeItem(SESSION_AUTH_KEY);
    }
  } catch {}
}

// --- API functions (100% Client-Side + Background Sync) ---

export async function fetchStatus() {
  const db = getLocalDatabase();
  const officers = db.officers || [];
  const physicalPosts = db.physicalPosts || [];
  const platoons = db.platoons || [];
  const schedules = db.schedules || [];

  return {
    ok: true,
    name: 'Sistema de Escalas',
    totalOfficers: officers.length,
    activeOfficers: officers.filter(o => o.status === 'ativo').length,
    totalPhysicalPosts: physicalPosts.length,
    totalPlatoons: platoons.length,
    confirmedWeeks: schedules.length,
    latestWeek: schedules.length > 0 ? Math.max(...schedules.map(s => s.weekNumber || 1)) : 0
  };
}

export async function fetchOfficers() {
  return getLocalDatabase().officers || [];
}

export async function createOfficer(officer) {
  const db = getLocalDatabase();
  const cleanName = (officer.name || '').trim().replace(/\s+/g, ' ');
  const normName = normalizePersonName(cleanName);
  if (!normName) {
    throw new Error('Nome do oficial é obrigatório');
  }

  const duplicate = (db.officers || []).find(
    o => normalizePersonName(o.name) === normName
  );
  if (duplicate) {
    throw new Error(`Já existe um oficial cadastrado com o nome "${duplicate.name}"`);
  }

  const newOfficer = {
    ...officer,
    id: officer.id || `oficial_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
    name: cleanName,
    patente: officer.patente || 'CFOM',
    sexo: officer.sexo === 'feminino' ? 'feminino' : 'masculino',
    status: officer.status || 'ativo',
    restrictions: Array.isArray(officer.restrictions) ? officer.restrictions : [],
    createdAt: new Date().toISOString()
  };

  db.officers.push(newOfficer);
  saveLocalDatabase(db);
  return newOfficer;
}

export async function updateOfficer(id, updates) {
  const db = getLocalDatabase();
  const index = (db.officers || []).findIndex(o => o.id === id);
  if (index === -1) {
    throw new Error('Oficial não encontrado');
  }

  const cleanUpdates = { ...updates };
  if (typeof cleanUpdates.name === 'string') {
    cleanUpdates.name = cleanUpdates.name.trim().replace(/\s+/g, ' ');
    const normName = normalizePersonName(cleanUpdates.name);
    if (normName) {
      const duplicate = (db.officers || []).find(
        o => o.id !== id && normalizePersonName(o.name) === normName
      );
      if (duplicate) {
        throw new Error(`Já existe outro oficial cadastrado com o nome "${duplicate.name}"`);
      }
    }
  }

  db.officers[index] = {
    ...db.officers[index],
    ...cleanUpdates,
    id
  };
  saveLocalDatabase(db);
  return db.officers[index];
}

export async function bulkImportOfficers(names, defaultPatente = 'CFOM', defaultSexo = 'masculino') {
  if (!Array.isArray(names) || names.length === 0) {
    throw new Error('Envie uma lista de nomes');
  }

  const db = getLocalDatabase();
  const added = [];
  const existingNames = new Set(
    (db.officers || []).map(o => normalizePersonName(o.name)).filter(Boolean)
  );

  const patentesKeywords = [
    'tenente coronel mirim',
    'tenente-coronel mirim',
    'coronel mirim',
    'major mirim',
    'capitao mirim',
    'capitão mirim',
    '1 tenente mirim',
    '1º tenente mirim',
    '1o tenente mirim',
    '2 tenente mirim',
    '2º tenente mirim',
    '2o tenente mirim',
    'cfom'
  ];

  for (let idx = 0; idx < names.length; idx++) {
    const rawLine = names[idx];
    if (typeof rawLine !== 'string') continue;

    let clean = rawLine
      .trim()
      .replace(/^(?:\d+[\.\)\-–—:]\s*|[•\*\-–—]\s+)/, '')
      .trim();
    if (!clean) continue;

    let detectedPatente = defaultPatente;
    let detectedSexo = defaultSexo === 'feminino' ? 'feminino' : 'masculino';

    const fullWordGenderMatch = clean.match(/[\(\[\-–—:\/\s]+(mulher|feminino|homem|masculino)[\)\]\s]*$/i);
    const shortTagGenderMatch = !fullWordGenderMatch
      ? clean.match(/(?:\s*[\(\[]\s*(f|m|h)\s*[\)\]]|\s*[\-–—:\/]\s*(f|m|h))\s*$/i)
      : null;

    const genderMatch = fullWordGenderMatch || shortTagGenderMatch;
    if (genderMatch) {
      const gTag = (genderMatch[1] || genderMatch[2] || '').toLowerCase();
      if (gTag === 'mulher' || gTag === 'feminino' || gTag === 'f') {
        detectedSexo = 'feminino';
      } else if (gTag === 'homem' || gTag === 'masculino' || gTag === 'm' || gTag === 'h') {
        detectedSexo = 'masculino';
      }
      clean = clean.slice(0, genderMatch.index).trim();
    }

    const lower = clean.toLowerCase();
    for (const pk of patentesKeywords) {
      if (lower.startsWith(pk) && (clean.length === pk.length || /[\s\-–—:]/.test(clean[pk.length]))) {
        if (pk === 'cfom') detectedPatente = 'CFOM';
        else if (pk.includes('2')) detectedPatente = '2º Tenente Mirim';
        else if (pk.includes('1')) detectedPatente = '1º Tenente Mirim';
        else if (pk.includes('capit')) detectedPatente = 'Capitão Mirim';
        else if (pk.includes('major')) detectedPatente = 'Major Mirim';
        else if (pk.includes('tenente coronel') || pk.includes('tenente-coronel')) detectedPatente = 'Tenente-Coronel Mirim';
        else if (pk.includes('coronel')) detectedPatente = 'Coronel Mirim';

        clean = clean.slice(pk.length).replace(/^[\s\-–—:]+/, '').trim();
        break;
      }
    }

    clean = clean.replace(/\s+/g, ' ').trim();
    if (!clean) continue;

    const normName = normalizePersonName(clean);
    if (!normName || existingNames.has(normName)) {
      continue;
    }
    existingNames.add(normName);

    const newOff = {
      id: `oficial_${Date.now()}_${idx}_${Math.floor(Math.random() * 10000)}`,
      patente: detectedPatente,
      sexo: detectedSexo,
      name: clean,
      status: 'ativo',
      restrictions: [],
      createdAt: new Date().toISOString()
    };
    db.officers.push(newOff);
    added.push(newOff);
  }

  saveLocalDatabase(db);
  return { addedCount: added.length, officers: added };
}

export async function deleteOfficer(id) {
  const db = getLocalDatabase();
  const index = (db.officers || []).findIndex(o => o.id === id);
  if (index === -1) {
    throw new Error('Oficial não encontrado');
  }
  const [removed] = db.officers.splice(index, 1);
  saveLocalDatabase(db);
  return { ok: true, removed };
}

export async function clearAllOfficers() {
  const db = getLocalDatabase();
  db.officers = [];
  saveLocalDatabase(db);
  return { ok: true, message: 'Todos os oficiais foram removidos.' };
}

export async function fetchSlots() {
  const db = getLocalDatabase();
  return {
    physicalPosts: db.physicalPosts || [],
    platoons: db.platoons || []
  };
}

export async function updatePhysicalPosts(posts) {
  const db = getLocalDatabase();
  db.physicalPosts = posts;
  saveLocalDatabase(db);
  return posts;
}

export async function updatePlatoons(platoons) {
  const db = getLocalDatabase();
  db.platoons = platoons;
  saveLocalDatabase(db);
  return platoons;
}

export async function resetSlotsDefault() {
  const db = getLocalDatabase();
  db.physicalPosts = getDefaultPhysicalPosts();
  db.platoons = getDefaultPlatoons();
  saveLocalDatabase(db);
  return {
    physicalPosts: db.physicalPosts,
    platoons: db.platoons
  };
}

export async function generateSchedule(payload) {
  const db = getLocalDatabase();
  const {
    weekNumber = 1,
    activeOfficerIds = null,
    enabledSlotIds = null,
    manualLocks = {},
    weights = null
  } = payload || {};

  const allOfficers = db.officers || [];
  const physicalPosts = db.physicalPosts || [];
  const platoons = db.platoons || [];
  const historySchedules = db.schedules || [];
  const config = db.config || {};

  const allAvailableSlots = [
    ...physicalPosts.filter(p => p.enabled !== false),
    ...platoons.filter(p => p.enabled !== false)
  ];

  let selectedSlots = allAvailableSlots;
  if (Array.isArray(enabledSlotIds)) {
    selectedSlots = allAvailableSlots.filter(s => enabledSlotIds.includes(s.id));
  }

  const effectiveWeights = {
    ...DEFAULT_WEIGHTS,
    ...(config.weights || {}),
    ...(weights || {})
  };

  return generateWeeklySchedule({
    allOfficers,
    activeOfficerIds,
    slots: selectedSlots,
    historySchedules,
    currentWeekNumber: Number(weekNumber) || 1,
    weights: effectiveWeights,
    manualLocks
  });
}

export async function fetchSchedules() {
  const db = getLocalDatabase();
  return [...(db.schedules || [])].sort((a, b) => (a.weekNumber || 0) - (b.weekNumber || 0));
}

export async function confirmSchedule(schedule, forceOverwrite = false) {
  if (!schedule || !schedule.weekNumber || !Array.isArray(schedule.assignments)) {
    throw new Error('Dados da escala inválidos');
  }

  const db = getLocalDatabase();
  db.schedules = db.schedules || [];
  const existingIndex = db.schedules.findIndex(s => s.weekNumber === Number(schedule.weekNumber));

  if (existingIndex !== -1 && !forceOverwrite) {
    const error = new Error(`A escala da Semana ${schedule.weekNumber} já existe. Deseja sobrescrever?`);
    error.status = 409;
    error.data = { error: 'WEEK_EXISTS', message: error.message };
    throw error;
  }

  const savedItem = {
    ...schedule,
    weekNumber: Number(schedule.weekNumber),
    id: schedule.id || `escala_sem_${schedule.weekNumber}_${Date.now()}`,
    confirmedAt: schedule.confirmedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (existingIndex !== -1) {
    db.schedules[existingIndex] = savedItem;
  } else {
    db.schedules.push(savedItem);
  }

  saveLocalDatabase(db);
  return savedItem;
}

export async function deleteSchedule(weekNumber) {
  const db = getLocalDatabase();
  const weekNum = Number(weekNumber);
  db.schedules = (db.schedules || []).filter(s => s.weekNumber !== weekNum);
  saveLocalDatabase(db);
  return { ok: true, deletedWeek: weekNum };
}

export async function fetchStats() {
  const db = getLocalDatabase();
  return generateSystemStats(db.officers || [], db.schedules || []);
}

export async function fetchConfig() {
  return getLocalDatabase().config || {};
}

export async function updateConfig(configUpdates) {
  const db = getLocalDatabase();
  db.config = {
    ...(db.config || {}),
    ...configUpdates
  };
  saveLocalDatabase(db);
  return db.config;
}

export async function resetAllData() {
  const fresh = getDefaultDatabase();
  saveLocalDatabase(fresh);
  return { ok: true, data: fresh };
}

export async function importBackupData(backupJson) {
  let parsed = backupJson;
  if (typeof backupJson === 'string') {
    try {
      parsed = JSON.parse(backupJson);
    } catch {
      throw new Error('O texto informado não é um JSON válido.');
    }
  }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.officers)) {
    throw new Error('Estrutura de banco JSON inválida: o campo "officers" é obrigatório.');
  }
  const saved = saveLocalDatabase(parsed);
  return { ok: true, message: 'Banco de dados carregado com sucesso', data: saved };
}

export function downloadFile(filename, content, mimeType = 'text/plain;charset=utf-8;') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.style.display = 'none';
  link.href = url;
  link.setAttribute('download', filename);
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    if (document.body.contains(link)) {
      document.body.removeChild(link);
    }
    URL.revokeObjectURL(url);
  }, 15000);
}

