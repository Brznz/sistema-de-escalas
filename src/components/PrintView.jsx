import React from 'react';
import { Image as ImageIcon, X, FileText, Download } from 'lucide-react';
import { exportScheduleToTxt, exportScheduleToPng, downloadFile } from '../utils/exportUtils';

export default function PrintView({
  schedule,
  title = 'Quadro de Serviço',
  weekNumber = 1,
  onClose
}) {
  if (!schedule) return null;

  const assignments = schedule.assignments || [];
  const platoons = assignments.filter(a => a.isCommand || a.slotType === 'pelotao');
  const physicalPosts = assignments.filter(a => !a.isCommand && a.slotType === 'posto');
  const restingOfficers = schedule.restingOfficers || [];

  const handleExportPng = () => {
    exportScheduleToPng(schedule, title, weekNumber);
  };

  const handleExportTxt = () => {
    const content = exportScheduleToTxt(schedule, title);
    downloadFile(`escala_semana_${weekNumber}.txt`, content);
  };

  const handleExportJson = () => {
    const content = JSON.stringify(schedule, null, 2);
    downloadFile(`escala_semana_${weekNumber}.json`, content, 'application/json');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm overflow-y-auto p-2.5 sm:p-8 safe-top safe-bottom-modal flex justify-center">
      
      {/* Container */}
      <div className="w-full max-w-4xl bg-white text-black p-3.5 sm:p-10 rounded-xl shadow-2xl relative my-auto print-card overflow-hidden">
        
        {/* Background Watermark inside the Schedule Card */}
        <div
          aria-hidden="true"
          className="pointer-events-none select-none absolute inset-0 flex flex-col items-center justify-center opacity-[0.025] -rotate-12 space-y-20"
        >
          <span className="text-2xl sm:text-5xl font-black uppercase tracking-widest text-slate-600 whitespace-nowrap">
            Sistema de Escalas por Bueno
          </span>
          <span className="text-2xl sm:text-5xl font-black uppercase tracking-widest text-slate-600 whitespace-nowrap">
            Sistema de Escalas por Bueno
          </span>
        </div>

        {/* Screen Action Bar (optimized for iPhone 16/17 & desktop) */}
        <div className="no-print mb-4 sm:mb-6 pb-3 sm:pb-4 border-b border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-militar-600 shrink-0" />
              <span>Quadro da Semana {weekNumber}</span>
            </div>
            <button
              onClick={onClose}
              className="sm:hidden p-2 rounded-lg bg-slate-200 active:bg-slate-300 text-slate-800"
              aria-label="Fechar visualização"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportPng}
              className="w-full sm:w-auto justify-center min-h-[40px] px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
              title="Baixar imagem de alta resolução (.png) desta semana"
            >
              <ImageIcon className="w-4 h-4" />
              <span>Exportar essa semana para PNG</span>
            </button>
            <button
              onClick={handleExportTxt}
              className="flex-1 sm:flex-initial justify-center min-h-[38px] px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all flex items-center gap-1.5 border border-slate-300"
              title="Baixar em formato texto simples (.txt)"
            >
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              <span>Baixar TXT</span>
            </button>
            <button
              onClick={handleExportJson}
              className="flex-1 sm:flex-initial justify-center min-h-[38px] px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all flex items-center gap-1.5 border border-slate-300"
              title="Baixar em formato JSON (.json)"
            >
              <Download className="w-3.5 h-3.5 text-amber-600" />
              <span>Baixar JSON</span>
            </button>
            <button
              onClick={onClose}
              className="hidden sm:inline-flex p-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors"
              aria-label="Fechar visualização"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Unified Section 1: Todos os Postos da Escala */}
        <div className="relative z-10 mb-6">
          <div className="text-xs font-black uppercase tracking-wider bg-black text-white px-2.5 py-1.5 mb-2 flex items-center justify-between">
            <span>1. Relação de Postos e Oficiais Escalados</span>
            <span className="text-[10px] font-normal">{assignments.length} Postos</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse border border-black text-xs">
              <thead>
                <tr className="bg-neutral-100 border-b border-black text-[10px] font-black uppercase">
                  <th className="border-r border-black p-1.5 w-10 text-center">Nº</th>
                  <th className="border-r border-black p-1.5">Posto</th>
                  <th className="border-r border-black p-1.5">Oficial Escalado</th>
                  <th className="p-1.5 w-28 text-center">Patente</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((item, idx) => (
                  <tr key={idx} className="border-b border-black/30 hover:bg-neutral-50">
                    <td className="border-r border-black p-1.5 text-center font-bold">{idx + 1}</td>
                    <td className="border-r border-black p-1.5 font-bold">
                      {(item.slotName || '').replace(/\(Vaga\s+(\d+)\)/gi, '(Posto $1)')}
                      {item.isAccumulated && item.accumulatedWith && (
                        <span className="ml-2 text-[10px] text-neutral-600 font-normal">
                          (+ Acúmulo: {(item.accumulatedWith.slotName || '').replace(/\(Vaga\s+(\d+)\)/gi, '(Posto $1)')})
                        </span>
                      )}
                    </td>
                    <td className="border-r border-black p-1.5 font-semibold">{item.officerName || 'PENDENTE'}</td>
                    <td className="p-1.5 text-center font-bold text-[10px]">{item.officerPatente || (item.officerName ? 'CFOM' : '-')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section: Missing Officers & Suggested Substitutes (only shown if a post is unfilled) */}
        {(() => {
          const missing = assignments.filter(a => !a.officerName || a.status === 'pendente');
          if (missing.length === 0) return null;
          const coverageList = assignments.filter(a => {
            if (!a.officerName) return false;
            const n = (a.slotName || '').toLowerCase();
            return (
              n.includes('cozinha') ||
              n.includes('refeitório') ||
              n.includes('refeitorio') ||
              n.includes('fila') ||
              n.includes('almoço') ||
              n.includes('almoco') ||
              n.includes('corredor')
            );
          });
          return (
            <div className="relative z-10 mb-5 p-2.5 border border-amber-600/60 bg-amber-50/80 text-[10px] space-y-1">
              <div className="font-bold uppercase tracking-wider text-amber-900">
                Atenção — Posto(s) em aberto ({missing.length}): {missing.map(m => m.slotName).join(' • ')}
              </div>
              {coverageList.length > 0 && (
                <div className="text-neutral-800 leading-relaxed">
                  <strong>Sugestões de Cobertura (Cozinha, Refeitório e Corredor):</strong>{' '}
                  {coverageList.map(c => `${c.officerName} (${c.slotName})`).join(' • ')}
                </div>
              )}
            </div>
          );
        })()}

        {/* Section 2: Sem Escala */}
        {restingOfficers.length > 0 && (
          <div className="relative z-10 mb-6 text-[10px]">
            <div className="font-bold uppercase tracking-wider mb-1">
              2. Sem Escala ({restingOfficers.length}):
            </div>
            <div className="p-2 border border-black/40 bg-neutral-50 leading-relaxed">
              {restingOfficers.map(o => `${o.patente ? o.patente + ' ' : ''}${o.name}`).join(' • ')}
            </div>
          </div>
        )}

        {/* Document Footer ("Sistema de Escalas por Bueno" — menos destaque) */}
        <div className="relative z-10 pt-3 border-t border-neutral-200 flex items-center justify-between text-[10px] text-neutral-400">
          <span className="font-normal">
            Sistema de Escalas por Bueno
          </span>
          <span>
            Gerado em {new Date().toLocaleDateString('pt-BR')}
          </span>
        </div>

      </div>

    </div>
  );
}
