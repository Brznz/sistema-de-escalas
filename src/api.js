// API helper functions for communication with backend

export async function fetchStatus() {
  const res = await fetch('/api/status');
  return res.json();
}

export async function fetchOfficers() {
  const res = await fetch('/api/oficiais');
  return res.json();
}

export async function createOfficer(officer) {
  const res = await fetch('/api/oficiais', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(officer)
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Erro ao criar oficial');
  return res.json();
}

export async function updateOfficer(id, updates) {
  const res = await fetch(`/api/oficiais/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Erro ao atualizar oficial');
  return res.json();
}

export async function bulkImportOfficers(names, defaultPatente = 'CFOM', defaultSexo = 'masculino') {
  const res = await fetch('/api/oficiais/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ names, defaultPatente, defaultSexo })
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Erro ao importar oficiais');
  return res.json();
}

export async function deleteOfficer(id) {
  const res = await fetch(`/api/oficiais/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error((await res.json()).error || 'Erro ao excluir oficial');
  return res.json();
}

export async function clearAllOfficers() {
  const res = await fetch('/api/oficiais', { method: 'DELETE' });
  return res.json();
}

export async function fetchSlots() {
  const res = await fetch('/api/postos-pelotoes');
  return res.json();
}

export async function updatePhysicalPosts(posts) {
  const res = await fetch('/api/postos', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(posts)
  });
  return res.json();
}

export async function updatePlatoons(platoons) {
  const res = await fetch('/api/pelotoes', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(platoons)
  });
  return res.json();
}

export async function resetSlotsDefault() {
  const res = await fetch('/api/postos-pelotoes/reset', { method: 'POST' });
  return res.json();
}

export async function generateSchedule(payload) {
  const res = await fetch('/api/escalas/gerar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Erro ao gerar escala');
  return res.json();
}

export async function fetchSchedules() {
  const res = await fetch('/api/escalas');
  return res.json();
}

export async function confirmSchedule(schedule, forceOverwrite = false) {
  const res = await fetch('/api/escalas/confirmar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...schedule, forceOverwrite })
  });
  const data = await res.json();
  if (!res.ok) {
    const error = new Error(data.message || data.error || 'Erro ao confirmar escala');
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

export async function deleteSchedule(weekNumber) {
  const res = await fetch(`/api/escalas/${weekNumber}`, { method: 'DELETE' });
  return res.json();
}

export async function fetchStats() {
  const res = await fetch('/api/estatisticas');
  return res.json();
}

export async function fetchConfig() {
  const res = await fetch('/api/config');
  return res.json();
}

export async function updateConfig(config) {
  const res = await fetch('/api/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  });
  return res.json();
}

export async function resetAllData() {
  const res = await fetch('/api/reset-all', { method: 'POST' });
  return res.json();
}

export async function importBackupData(backupJson) {
  const res = await fetch('/api/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(backupJson)
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Erro ao importar backup');
  return res.json();
}
