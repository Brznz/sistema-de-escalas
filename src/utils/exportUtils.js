/**
 * Utility functions for exporting schedules, officers, and historical reports
 * to PDF (Print), TXT, and JSON formats.
 */

export function downloadFile(filename, content, mimeType = 'text/plain;charset=utf-8') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    if (document.body.contains(a)) {
      document.body.removeChild(a);
    }
    URL.revokeObjectURL(url);
  }, 15000);
}

/**
 * Exports a single weekly schedule to clean TXT format (without signatures)
 */
export function exportScheduleToTxt(schedule, title = '') {
  const weekNum = schedule.weekNumber || 1;
  const scheduleTitle = title || schedule.title || `Semana ${weekNum}`;
  const assignments = schedule.assignments || [];
  const resting = schedule.restingOfficers || [];

  let txt = `========================================================================\n`;
  txt += `                          SISTEMA DE ESCALAS                            \n`;
  txt += `        QUADRO DE SERVIÇO SEMANAL — ${scheduleTitle.toUpperCase()}      \n`;
  txt += `========================================================================\n`;
  txt += `Data de Emissão: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}\n`;
  txt += `Total de Postos: ${assignments.length} | Preenchidos: ${assignments.filter(a => a.status === 'atribuido').length}\n\n`;

  txt += `1. RELAÇÃO DE POSTOS E OFICIAIS ESCALADOS:\n`;
  txt += `------------------------------------------------------------------------\n`;
  txt += `Nº  | POSTO                     | OFICIAL ESCALADO             | PATENTE\n`;
  txt += `------------------------------------------------------------------------\n`;
  assignments.forEach((post, idx) => {
    const num = (idx + 1).toString().padStart(2, '0');
    const slotName = post.slotName.padEnd(25).slice(0, 25);
    const officer = (post.officerName || 'PENDENTE').padEnd(28).slice(0, 28);
    const patente = (post.officerPatente || (post.officerName ? 'CFOM' : '-')).padEnd(10);
    const acc = post.isAccumulated && post.accumulatedWith ? ` [Acúmulo: ${post.accumulatedWith.slotName}]` : '';
    txt += `${num}  | ${slotName} | ${officer} | ${patente}${acc}\n`;
  });

  if (resting.length > 0) {
    txt += `\n2. SEM ESCALA (${resting.length}):\n`;
    txt += `------------------------------------------------------------------------\n`;
    txt += resting.map(o => `${o.patente ? o.patente + ' ' : ''}${o.name}`).join(' • ') + '\n';
  }

  txt += `\n========================================================================\n`;
  txt += `Sistema de Escalas por Bueno\n`;
  return txt;
}

/**
 * Exports officers directory to clean TXT format
 */
export function exportOfficersToTxt(officers = [], stats = {}) {
  const officerStatsMap = new Map();
  if (stats.officerStats && Array.isArray(stats.officerStats)) {
    for (const s of stats.officerStats) {
      officerStatsMap.set(s.id, s);
    }
  }

  let txt = `========================================================================\n`;
  txt += `                          SISTEMA DE ESCALAS                            \n`;
  txt += `                     RELAÇÃO COMPLETA DE OFICIAIS                       \n`;
  txt += `========================================================================\n`;
  txt += `Data de Emissão: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}\n`;
  txt += `Total de Oficiais: ${officers.length} (Ativos: ${officers.filter(o => o.status === 'ativo').length})\n\n`;

  txt += `Nº  | PATENTE              | NOME                          | SEXO | STATUS  | ESCALAS | COMANDOS\n`;
  txt += `-------------------------------------------------------------------------------------------------\n`;

  officers.forEach((o, idx) => {
    const num = (idx + 1).toString().padStart(2, '0');
    const patente = (o.patente || 'CFOM').padEnd(20).slice(0, 20);
    const name = (o.name || '').padEnd(29).slice(0, 29);
    const sexo = (o.sexo === 'feminino' ? 'Fem ' : 'Masc');
    const status = (o.status === 'ativo' ? 'Ativo  ' : 'Inativo');
    const st = officerStatsMap.get(o.id);
    const duties = (st?.totalDuties || 0).toString().padStart(7);
    const commands = (st?.totalCommands || 0).toString().padStart(8);

    txt += `${num}  | ${patente} | ${name} | ${sexo} | ${status} | ${duties} | ${commands}\n`;
    if (o.observacoes && o.observacoes.trim()) {
      txt += `    └─ Obs: ${o.observacoes.trim()}\n`;
    }
  });

  txt += `\n========================================================================\n`;
  txt += `Sistema de Escalas por Bueno\n`;
  return txt;
}

/**
 * Exports general historical summary across all confirmed weeks to clean TXT format
 */
export function exportHistorySummaryToTxt(schedules = [], officers = [], stats = {}) {
  let txt = `========================================================================\n`;
  txt += `                          SISTEMA DE ESCALAS                            \n`;
  txt += `               RESUMO GERAL DO HISTÓRICO DE ESCALAS                    \n`;
  txt += `========================================================================\n`;
  txt += `Data de Emissão: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}\n`;
  txt += `Total de Semanas Registradas: ${schedules.length}\n`;
  txt += `Total de Oficiais Cadastrados: ${officers.length}\n`;

  if (stats.global) {
    txt += `Média de Escalas por Oficial: ${stats.global.avgDuties || 0}\n`;
    txt += `Índice de Equidade do Sistema: ${stats.global.equityScore || 100}%\n`;
  }
  txt += `\n`;

  txt += `1. RESUMO GERAL POR OFICIAL:\n`;
  txt += `------------------------------------------------------------------------------------\n`;
  txt += `Nº  | PATENTE              | NOME                          | ESCALAS | COMANDOS | SEM ESCALA\n`;
  txt += `------------------------------------------------------------------------------------\n`;

  const officerStatsList = stats.officerStats || [];
  officerStatsList.forEach((s, idx) => {
    const num = (idx + 1).toString().padStart(2, '0');
    const patente = (s.patente || 'CFOM').padEnd(20).slice(0, 20);
    const name = (s.name || '').padEnd(29).slice(0, 29);
    const duties = (s.totalDuties || 0).toString().padStart(7);
    const commands = (s.totalCommands || 0).toString().padStart(8);
    const idle = `${s.weeksWithoutDuty ?? s.weeksSinceLastDuty ?? 0} sem`.padStart(10);
    txt += `${num}  | ${patente} | ${name} | ${duties} | ${commands} | ${idle}\n`;
  });

  txt += `\n2. HISTÓRICO SEMANA A SEMANA:\n`;
  txt += `------------------------------------------------------------------------------------\n`;
  schedules.forEach(schedule => {
    const w = schedule.weekNumber;
    const title = schedule.title || `Semana ${w}`;
    const assignments = schedule.assignments || [];
    const filled = assignments.filter(a => a.status === 'atribuido').length;
    const accumulated = assignments.filter(a => a.isAccumulated).length;

    txt += `\n• SEMANA ${w} — ${title} (${filled} postos preenchidos, ${accumulated / 2} em acúmulo)\n`;
    txt += `  - Postos:\n`;
    assignments.forEach(post => {
      const off = post.officerName ? `${post.officerPatente || 'CFOM'} ${post.officerName}` : 'Pendente';
      const acc = post.isAccumulated && post.accumulatedWith ? ` [Acúmulo c/ ${post.accumulatedWith.slotName}]` : '';
      txt += `    * ${post.slotName}: ${off}${acc}\n`;
    });
  });

  txt += `\n========================================================================\n`;
  txt += `Sistema de Escalas por Bueno\n`;
  return txt;
}

/**
 * Helper to wrap text into multiple lines for Canvas rendering
 */
function wrapCanvasText(ctx, text, maxWidth) {
  if (!text) return [];
  const words = text.split(' ');
  const lines = [];
  let currentLine = words[0] || '';

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = ctx.measureText(`${currentLine} ${word}`).width;
    if (width < maxWidth) {
      currentLine += ` ${word}`;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

/**
 * Exports a single weekly schedule to a high-resolution (2x Retina) PNG image
 * with "Sistema de Escalas por Bueno" in the background watermark and bottom footer.
 */
export function exportScheduleToPng(schedule, title = '', weekNumber = 1) {
  if (!schedule || typeof document === 'undefined') return;

  const weekNum = weekNumber || schedule.weekNumber || 1;
  const assignments = schedule.assignments || [];
  const restingOfficers = schedule.restingOfficers || [];

  const scale = 2; // 2x Retina quality
  const width = 1040;
  const padX = 48;
  const contentW = width - padX * 2;
  const rowH = 32;
  const tableHeaderH = 30;
  const sectionTitleH = 32;

  // Measure resting officers text wrapping using an offscreen context
  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.font = '500 12px Inter, Arial, sans-serif';
  const restingText = restingOfficers
    .map(o => `${o.patente ? o.patente + ' ' : ''}${o.name}`)
    .join('  •  ');
  const restingLines = restingOfficers.length > 0
    ? wrapCanvasText(tempCtx, restingText, contentW - 28)
    : [];
  const restingBlockH = restingLines.length > 0 ? 34 + restingLines.length * 18 + 18 : 0;

  // Calculate total dynamic height (without top header banner)
  const postsBlockH = sectionTitleH + tableHeaderH + assignments.length * rowH + 24;
  const footerH = 44;
  const height = 40 + postsBlockH + restingBlockH + footerH + 20;

  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  // 1. Base Document Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Outer frame border
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2;
  ctx.strokeRect(18, 18, width - 36, height - 36);

  // Inner subtle frame border
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.strokeRect(22, 22, width - 44, height - 44);

  // 2. Subtle Background Watermark ("Sistema de Escalas por Bueno" no fundo)
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.rotate(-Math.PI / 7);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(100, 116, 139, 0.032)';
  ctx.font = '800 50px Inter, Arial, sans-serif';
  ctx.fillText('SISTEMA DE ESCALAS POR BUENO', 0, -160);
  ctx.fillText('SISTEMA DE ESCALAS POR BUENO', 0, 0);
  ctx.fillText('SISTEMA DE ESCALAS POR BUENO', 0, 160);
  ctx.restore();

  let y = 40;

  // Helper to draw a table section
  const drawTableSection = (sectionTitle, rightBadge, columns, rows) => {
    // Section bar
    ctx.fillStyle = '#2c3727'; // militar-900
    ctx.fillRect(padX, y, contentW, sectionTitleH);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 12px Inter, Arial, sans-serif';
    ctx.fillText(sectionTitle, padX + 12, y + 20);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#fbbf24';
    ctx.font = '700 11px Inter, Arial, sans-serif';
    ctx.fillText(rightBadge, padX + contentW - 12, y + 20);

    y += sectionTitleH;

    // Table column headers
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(padX, y, contentW, tableHeaderH);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.strokeRect(padX, y, contentW, tableHeaderH);

    let colX = padX;
    columns.forEach((col, i) => {
      if (i > 0) {
        ctx.beginPath();
        ctx.moveTo(colX, y);
        ctx.lineTo(colX, y + tableHeaderH);
        ctx.stroke();
      }
      ctx.fillStyle = '#0f172a';
      ctx.font = '800 10px Inter, Arial, sans-serif';
      ctx.textAlign = col.align || 'left';
      const textX = col.align === 'center' ? colX + col.width / 2 : colX + 10;
      ctx.fillText(col.label, textX, y + 19);
      colX += col.width;
    });

    y += tableHeaderH;

    // Rows
    rows.forEach((row, rIdx) => {
      ctx.fillStyle = rIdx % 2 === 0 ? 'rgba(255, 255, 255, 0.88)' : 'rgba(248, 250, 252, 0.92)';
      ctx.fillRect(padX, y, contentW, rowH);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.strokeRect(padX, y, contentW, rowH);

      let cellX = padX;
      columns.forEach((col, cIdx) => {
        if (cIdx > 0) {
          ctx.beginPath();
          ctx.moveTo(cellX, y);
          ctx.lineTo(cellX, y + rowH);
          ctx.stroke();
        }
        const cell = row[cIdx];
        ctx.fillStyle = cell.color || '#0f172a';
        ctx.font = cell.font || '600 12px Inter, Arial, sans-serif';
        ctx.textAlign = col.align || 'left';
        const textX = col.align === 'center' ? cellX + col.width / 2 : cellX + 10;
        ctx.fillText(cell.text || '', textX, y + 20);

        if (cell.subtext) {
          const mainW = ctx.measureText(cell.text || '').width;
          ctx.fillStyle = '#b45309';
          ctx.font = '600 10px Inter, Arial, sans-serif';
          ctx.fillText(cell.subtext, textX + mainW + 8, y + 20);
        }

        cellX += col.width;
      });

      y += rowH;
    });

    y += 22;
  };

  // 3. Unified Section: Relação de Postos e Oficiais Escalados
  const postCols = [
    { label: 'Nº', width: 50, align: 'center' },
    { label: 'POSTO', width: 450, align: 'left' },
    { label: 'OFICIAL ESCALADO', width: 324, align: 'left' },
    { label: 'PATENTE', width: 120, align: 'center' }
  ];
  const formatSlotLabel = (name = '') => name.replace(/\(Vaga\s+(\d+)\)/gi, '(Posto $1)');
  const postRows = assignments.map((post, idx) => [
    { text: String(idx + 1).padStart(2, '0'), font: '700 11px Inter, Arial, sans-serif', color: '#334155' },
    {
      text: formatSlotLabel(post.slotName),
      subtext: post.isAccumulated && post.accumulatedWith ? `(+ Acúmulo: ${formatSlotLabel(post.accumulatedWith.slotName)})` : '',
      font: '700 12px Inter, Arial, sans-serif',
      color: '#0f172a'
    },
    {
      text: post.officerName || 'PENDENTE',
      font: '700 12px Inter, Arial, sans-serif',
      color: post.officerName ? '#0f172a' : '#dc2626'
    },
    {
      text: post.officerPatente || (post.officerName ? 'CFOM' : '-'),
      font: '700 11px Inter, Arial, sans-serif',
      color: '#405037'
    }
  ]);

  drawTableSection(
    '1. RELAÇÃO DE POSTOS E OFICIAIS ESCALADOS',
    `${assignments.length} Postos`,
    postCols,
    postRows
  );

  // 4. Section 2: Sem Escala
  if (restingLines.length > 0) {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#1e293b';
    ctx.font = '800 11px Inter, Arial, sans-serif';
    ctx.fillText(
      `2. SEM ESCALA (${restingOfficers.length}):`,
      padX,
      y + 14
    );

    const boxY = y + 22;
    const boxH = restingLines.length * 18 + 16;
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(padX, boxY, contentW, boxH);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.strokeRect(padX, boxY, contentW, boxH);

    ctx.fillStyle = '#334155';
    ctx.font = '600 11px Inter, Arial, sans-serif';
    restingLines.forEach((line, idx) => {
      ctx.fillText(line, padX + 12, boxY + 20 + idx * 18);
    });

    y = boxY + boxH + 18;
  }

  // 5. Bottom Footer ("Sistema de Escalas por Bueno" — discreto, menos destaque)
  const footerY = height - 48;
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padX, footerY);
  ctx.lineTo(padX + contentW, footerY);
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#94a3b8';
  ctx.font = '400 10px Inter, Arial, sans-serif';
  ctx.fillText('Sistema de Escalas por Bueno', padX, footerY + 20);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#94a3b8';
  ctx.font = '400 10px Inter, Arial, sans-serif';
  ctx.fillText(
    `Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`,
    padX + contentW,
    footerY + 20
  );

  // Trigger download as PNG (optimized for iOS Safari & Chrome via Blob)
  const fileName = `escala_semana_${weekNum}.png`;
  if (typeof canvas.toBlob === 'function') {
    canvas.toBlob(blob => {
      if (blob) {
        downloadFile(fileName, blob, 'image/png');
      } else {
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = fileName;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }, 'image/png');
  } else {
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = fileName;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
