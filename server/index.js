import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dbStorage } from './storage.js';
import { generateWeeklySchedule } from './algorithm/optimizer.js';
import { generateSystemStats } from './algorithm/stats.js';
import { DEFAULT_WEIGHTS } from './algorithm/costMatrix.js';
import { getDefaultPhysicalPosts, getDefaultPlatoons } from './defaultData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLIENT_DIST = path.resolve(__dirname, '../dist');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// --- Health Check & System Status ---
app.get('/api/health', (req, res) => {
  res.json({ ok: true, status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/api/status', (req, res) => {
  const officers = dbStorage.getOfficers();
  const physicalPosts = dbStorage.getPhysicalPosts();
  const platoons = dbStorage.getPlatoons();
  const schedules = dbStorage.getSchedules();

  res.json({
    ok: true,
    name: 'Sistema de Escalas',
    totalOfficers: officers.length,
    activeOfficers: officers.filter(o => o.status === 'ativo').length,
    totalPhysicalPosts: physicalPosts.length,
    totalPlatoons: platoons.length,
    confirmedWeeks: schedules.length,
    latestWeek: schedules.length > 0 ? Math.max(...schedules.map(s => s.weekNumber || 1)) : 0
  });
});

// --- Officers ---
app.get('/api/oficiais', (req, res) => {
  const officers = dbStorage.getOfficers();
  res.json(officers);
});

app.post('/api/oficiais', (req, res) => {
  const { name, patente, sexo, status, restrictions } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Nome do oficial é obrigatório' });
  }
  try {
    const created = dbStorage.addOfficer({
      name: name.trim(),
      patente: patente || 'CFOM',
      sexo: sexo === 'feminino' ? 'feminino' : 'masculino',
      status: status || 'ativo',
      restrictions: restrictions || []
    });
    res.status(201).json(created);
  } catch (err) {
    if (err.code === 'DUPLICATE_OFFICER') {
      return res.status(409).json({ error: err.message });
    }
    return res.status(400).json({ error: err.message || 'Erro ao cadastrar oficial' });
  }
});

app.get('/api/oficiais/:id', (req, res) => {
  const { id } = req.params;
  const officer = dbStorage.getOfficers().find(o => o.id === id);
  if (!officer) {
    return res.status(404).json({ error: 'Oficial não encontrado' });
  }
  res.json(officer);
});

app.put('/api/oficiais/:id', (req, res) => {
  const { id } = req.params;
  try {
    const updated = dbStorage.updateOfficer(id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Oficial não encontrado' });
    }
    res.json(updated);
  } catch (err) {
    if (err.code === 'DUPLICATE_OFFICER') {
      return res.status(409).json({ error: err.message });
    }
    return res.status(400).json({ error: err.message || 'Erro ao atualizar oficial' });
  }
});

app.post('/api/oficiais/bulk', (req, res) => {
  const { names, defaultPatente = 'CFOM', defaultSexo = 'masculino' } = req.body;
  if (!Array.isArray(names) || names.length === 0) {
    return res.status(400).json({ error: 'Envie uma lista de nomes' });
  }
  const added = dbStorage.bulkAddOfficers(names, defaultPatente, defaultSexo);
  res.json({ count: added.length, officers: added });
});

app.delete('/api/oficiais/:id', (req, res) => {
  const { id } = req.params;
  const deleted = dbStorage.deleteOfficer(id);
  if (!deleted) {
    return res.status(404).json({ error: 'Oficial não encontrado' });
  }
  res.json({ ok: true, message: 'Oficial excluído com sucesso', officer: deleted });
});

app.delete('/api/oficiais', (req, res) => {
  dbStorage.clearOfficers();
  res.json({ ok: true, message: 'Banco de dados de oficiais limpo com sucesso' });
});

// --- Posts & Platoons ---
app.get('/api/postos-pelotoes', (req, res) => {
  res.json({
    physicalPosts: dbStorage.getPhysicalPosts(),
    platoons: dbStorage.getPlatoons()
  });
});

app.put('/api/postos', (req, res) => {
  if (!Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Lista de postos inválida' });
  }
  const saved = dbStorage.savePhysicalPosts(req.body);
  res.json(saved);
});

app.put('/api/pelotoes', (req, res) => {
  if (!Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Lista de pelotões inválida' });
  }
  const saved = dbStorage.savePlatoons(req.body);
  res.json(saved);
});

app.post('/api/postos-pelotoes/reset', (req, res) => {
  const physicalPosts = getDefaultPhysicalPosts();
  const platoons = getDefaultPlatoons();
  dbStorage.savePhysicalPosts(physicalPosts);
  dbStorage.savePlatoons(platoons);
  res.json({ physicalPosts, platoons });
});

// --- Schedule Generation ---
app.post('/api/escalas/gerar', (req, res) => {
  const {
    weekNumber = 1,
    activeOfficerIds,
    enabledSlotIds,
    manualLocks = {},
    weights
  } = req.body;

  const allOfficers = dbStorage.getOfficers();
  const physicalPosts = dbStorage.getPhysicalPosts();
  const platoons = dbStorage.getPlatoons();
  const historySchedules = dbStorage.getSchedules();
  const config = dbStorage.getConfig();

  // Active slots filter
  const allAvailableSlots = [
    ...physicalPosts.filter(p => p.enabled !== false),
    ...platoons.filter(p => p.enabled !== false)
  ];

  let selectedSlots = allAvailableSlots;
  if (enabledSlotIds && Array.isArray(enabledSlotIds)) {
    selectedSlots = allAvailableSlots.filter(s => enabledSlotIds.includes(s.id));
  }

  const effectiveWeights = {
    ...DEFAULT_WEIGHTS,
    ...(config.weights || {}),
    ...(weights || {})
  };

  const proposal = generateWeeklySchedule({
    allOfficers,
    activeOfficerIds,
    slots: selectedSlots,
    historySchedules,
    currentWeekNumber: Number(weekNumber) || 1,
    weights: effectiveWeights,
    manualLocks
  });

  res.json(proposal);
});

// --- Schedule History & Confirmation ---
app.get('/api/escalas', (req, res) => {
  res.json(dbStorage.getSchedules());
});

app.get('/api/escalas/:weekNumber', (req, res) => {
  const weekNum = Number(req.params.weekNumber);
  const schedules = dbStorage.getSchedules();
  const found = schedules.find(s => s.weekNumber === weekNum);
  if (!found) {
    return res.status(404).json({ error: `Escala da semana ${weekNum} não encontrada` });
  }
  res.json(found);
});

app.post('/api/escalas/confirmar', (req, res) => {
  const scheduleData = req.body;
  if (!scheduleData.weekNumber) {
    return res.status(400).json({ error: 'Número da semana é obrigatório' });
  }

  const existing = dbStorage.getSchedules().find(s => s.weekNumber === scheduleData.weekNumber);
  if (existing && !req.body.forceOverwrite) {
    return res.status(409).json({
      error: 'Escala já confirmada anteriormente',
      message: `A semana ${scheduleData.weekNumber} já possui uma escala salva definitiva. Deseja sobrescrever?`,
      existingWeekNumber: scheduleData.weekNumber
    });
  }

  const saved = dbStorage.saveSchedule({
    ...scheduleData,
    weekNumber: Number(scheduleData.weekNumber),
    confirmedAt: new Date().toISOString()
  });

  res.json({ ok: true, schedule: saved });
});

app.delete('/api/escalas/:weekNumber', (req, res) => {
  const weekNum = Number(req.params.weekNumber);
  dbStorage.deleteSchedule(weekNum);
  res.json({ ok: true, deletedWeek: weekNum });
});

// --- Statistics & Fairness ---
app.get('/api/estatisticas', (req, res) => {
  const officers = dbStorage.getOfficers();
  const schedules = dbStorage.getSchedules();
  const stats = generateSystemStats(officers, schedules);
  res.json(stats);
});

// --- Config & Reset ---
app.get('/api/config', (req, res) => {
  res.json(dbStorage.getConfig());
});

app.put('/api/config', (req, res) => {
  const updated = dbStorage.updateConfig(req.body);
  res.json(updated);
});

app.post('/api/reset-all', (req, res) => {
  const reset = dbStorage.resetToDefault();
  res.json({ ok: true, data: reset });
});

// --- Backup & Restore ---
app.get('/api/export', (req, res) => {
  const data = dbStorage.read();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="backup_escalas_${Date.now()}.json"`);
  res.send(JSON.stringify(data, null, 2));
});

app.post('/api/import', (req, res) => {
  if (!req.body || !req.body.officers) {
    return res.status(400).json({ error: 'Estrutura de dados de backup inválida' });
  }
  dbStorage.createBackup('pre_import');
  dbStorage.save(req.body);
  res.json({ ok: true, message: 'Dados importados com sucesso' });
});

// Serve frontend build
app.use(express.static(CLIENT_DIST));
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    const indexHtml = path.join(CLIENT_DIST, 'index.html');
    if (fs.existsSync(indexHtml)) {
      return res.sendFile(indexHtml);
    }
  }
  next();
});

const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`[Servidor Sistema de Escalas] Rodando em http://${HOST}:${PORT}`);
});
