import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDefaultDatabase } from './defaultData.js';
import { normalizePersonName } from './algorithm/historyMetrics.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(__dirname, '../data');

export class DatabaseStorage {
  constructor(customDataDir = DEFAULT_DATA_DIR) {
    this.dataDir = customDataDir;
    this.dbPath = path.join(this.dataDir, 'database.json');
    this.backupDir = path.join(this.dataDir, 'backups');
    this.ensureDirs();
    this.initDatabase();
  }

  ensureDirs() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  initDatabase() {
    if (!fs.existsSync(this.dbPath)) {
      const initialData = getDefaultDatabase();
      this.save(initialData);
    }
  }

  read() {
    try {
      if (!fs.existsSync(this.dbPath)) {
        return getDefaultDatabase();
      }
      const raw = fs.readFileSync(this.dbPath, 'utf-8');
      return JSON.parse(raw);
    } catch (err) {
      console.error('Error reading database file:', err);
      return getDefaultDatabase();
    }
  }

  save(data) {
    try {
      this.ensureDirs();
      const serialized = JSON.stringify(data, null, 2);
      const tempPath = `${this.dbPath}.tmp.${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      fs.writeFileSync(tempPath, serialized, 'utf-8');
      try {
        fs.renameSync(tempPath, this.dbPath);
      } catch {
        fs.writeFileSync(this.dbPath, serialized, 'utf-8');
        try { fs.unlinkSync(tempPath); } catch {}
      }
      return true;
    } catch (err) {
      console.error('Error writing database file:', err);
      throw err;
    }
  }

  createBackup(label = 'manual') {
    const data = this.read();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(this.backupDir, `backup_${label}_${timestamp}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(data, null, 2), 'utf-8');
    return backupFile;
  }

  // --- Officers ---
  getOfficers() {
    return this.read().officers || [];
  }

  saveOfficers(officers) {
    const db = this.read();
    db.officers = officers;
    this.save(db);
    return officers;
  }

  clearOfficers() {
    const db = this.read();
    this.createBackup('pre_clear_officers');
    db.officers = [];
    this.save(db);
    return [];
  }

  addOfficer(officer) {
    const db = this.read();
    const cleanName = (officer.name || '').trim().replace(/\s+/g, ' ');
    const normName = normalizePersonName(cleanName);
    if (!normName) {
      const err = new Error('Nome do oficial é obrigatório');
      err.code = 'INVALID_NAME';
      throw err;
    }

    const duplicate = (db.officers || []).find(
      o => normalizePersonName(o.name) === normName
    );
    if (duplicate) {
      const err = new Error(`Já existe um oficial cadastrado com o nome "${duplicate.name}"`);
      err.code = 'DUPLICATE_OFFICER';
      throw err;
    }

    const id = officer.id || `oficial_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const newOfficer = {
      ...officer,
      id,
      name: cleanName,
      patente: officer.patente || 'CFOM',
      sexo: officer.sexo === 'feminino' ? 'feminino' : 'masculino',
      status: officer.status || 'ativo',
      restrictions: Array.isArray(officer.restrictions) ? officer.restrictions : [],
      createdAt: new Date().toISOString()
    };
    db.officers.push(newOfficer);
    this.save(db);
    return newOfficer;
  }

  updateOfficer(id, updates) {
    const db = this.read();
    const index = db.officers.findIndex(o => o.id === id);
    if (index === -1) return null;

    const cleanUpdates = { ...updates };
    if (typeof cleanUpdates.name === 'string') {
      cleanUpdates.name = cleanUpdates.name.trim().replace(/\s+/g, ' ');
      const normName = normalizePersonName(cleanUpdates.name);
      if (normName) {
        const duplicate = (db.officers || []).find(
          o => o.id !== id && normalizePersonName(o.name) === normName
        );
        if (duplicate) {
          const err = new Error(`Já existe outro oficial cadastrado com o nome "${duplicate.name}"`);
          err.code = 'DUPLICATE_OFFICER';
          throw err;
        }
      }
    }

    db.officers[index] = {
      ...db.officers[index],
      ...cleanUpdates,
      id // preserve ID
    };
    this.save(db);
    return db.officers[index];
  }

  deleteOfficer(id) {
    const db = this.read();
    const index = db.officers.findIndex(o => o.id === id);
    if (index === -1) return false;
    const [removed] = db.officers.splice(index, 1);
    this.save(db);
    return removed;
  }

  bulkAddOfficers(namesList, defaultPatente = 'CFOM', defaultSexo = 'masculino') {
    const db = this.read();
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

    for (let idx = 0; idx < namesList.length; idx++) {
      const rawLine = namesList[idx];
      if (typeof rawLine !== 'string') continue;

      // Strip leading numbering or bullet points (e.g. "1. ", "02 - ", "• ")
      let clean = rawLine
        .trim()
        .replace(/^(?:\d+[\.\)\-–—:]\s*|[•\*\-–—]\s+)/, '')
        .trim();
      if (!clean) continue;

      let detectedPatente = defaultPatente;
      let detectedSexo = defaultSexo === 'feminino' ? 'feminino' : 'masculino';

      // Detect gender tag at the end:
      // - Full word: "Ana Silva (Mulher)", "Ana Silva - Feminino", "Carlos Masculino"
      // - Single letter ONLY inside () / [] or after explicit separator (-, –, —, :, /):
      //   e.g. "Carlos (H)", "Beatriz - F", "Ana [F]" (does NOT strip middle initial in "Juliana M")
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
        continue; // Ignora nomes duplicados na mesma lista ou já cadastrados
      }
      existingNames.add(normName);

      const id = `oficial_${Date.now()}_${idx}_${Math.floor(Math.random() * 10000)}`;
      const newOff = {
        id,
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
    this.save(db);
    return added;
  }

  // --- Physical Posts ---
  getPhysicalPosts() {
    return this.read().physicalPosts || [];
  }

  savePhysicalPosts(posts) {
    const db = this.read();
    db.physicalPosts = posts;
    this.save(db);
    return posts;
  }

  // --- Platoons ---
  getPlatoons() {
    return this.read().platoons || [];
  }

  savePlatoons(platoons) {
    const db = this.read();
    db.platoons = platoons;
    this.save(db);
    return platoons;
  }

  // --- Schedules ---
  getSchedules() {
    const db = this.read();
    return (db.schedules || []).sort((a, b) => (a.weekNumber || 0) - (b.weekNumber || 0));
  }

  saveSchedule(schedule) {
    const db = this.read();
    db.schedules = db.schedules || [];
    
    // Check if weekNumber already exists
    const existingIndex = db.schedules.findIndex(s => s.weekNumber === schedule.weekNumber);
    if (existingIndex !== -1) {
      db.schedules[existingIndex] = {
        ...schedule,
        updatedAt: new Date().toISOString()
      };
    } else {
      db.schedules.push({
        ...schedule,
        id: schedule.id || `escala_sem_${schedule.weekNumber}_${Date.now()}`,
        confirmedAt: new Date().toISOString()
      });
    }

    this.createBackup(`week_${schedule.weekNumber}`);
    this.save(db);
    return schedule;
  }

  deleteSchedule(weekNumber) {
    const db = this.read();
    db.schedules = (db.schedules || []).filter(s => s.weekNumber !== weekNumber);
    this.save(db);
    return true;
  }

  // --- Config ---
  getConfig() {
    return this.read().config || {};
  }

  updateConfig(updates) {
    const db = this.read();
    db.config = {
      ...db.config,
      ...updates
    };
    this.save(db);
    return db.config;
  }

  // --- Full Reset to Default ---
  resetToDefault() {
    this.createBackup('pre_reset');
    const fresh = getDefaultDatabase();
    this.save(fresh);
    return fresh;
  }
}

export const dbStorage = new DatabaseStorage();
