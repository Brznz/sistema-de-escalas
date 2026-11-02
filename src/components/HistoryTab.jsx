import React, { useState } from 'react';
import { 
  History, 
  Calendar, 
  Printer, 
  Trash2, 
  Award, 
  MapPin, 
  Users, 
  Search, 
  AlertTriangle,
  FileText,
  Download,
  BookOpen,
  CheckCircle2,
  Image as ImageIcon,
  Eye
} from 'lucide-react';
import { deleteSchedule } from '../api';
import { exportHistorySummaryToTxt, exportScheduleToPng, downloadFile } from '../utils/exportUtils';

export default function HistoryTab({ 
  schedules = [], 
  officers = [],
  stats = {},
  onScheduleDeleted, 
  onOpenPrint 
}) {
  const [selectedWeek, setSelectedWeek] = useState(
    schedules.length > 0 ? schedules[schedules.length - 1].weekNumber : null
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirmWeek, setDeleteConfirmWeek] = useState(null);
  const [isPrintSummaryOpen, setIsPrintSummaryOpen] = useState(false);

  const currentSchedule = schedules.find(s => s.weekNumber === selectedWeek);

  const handleDelete = async (weekNumber) => {
    try {
      await deleteSchedule(weekNumber);
      setDeleteConfirmWeek(null);
      if (onScheduleDeleted) onScheduleDeleted();
    } catch (err) {
      console.error(err);
    }
  };

  const handleExportSummaryTxt = () => {
    const content = exportHistorySummaryToTxt(schedules, officers, stats);
    downloadFile('resumo_geral_historico_escalas.txt', content);
  };

  const handleExportSummaryJson = () => {
    const data = {
      geradoEm: new Date().toISOString(),
      totalSemanas: schedules.length,
      globalStats: stats.global || {},
      officerStats: stats.officerStats || [],
      schedules: schedules
    };
    downloadFile('resumo_geral_historico_escalas.json', JSON.stringify(data, null, 2), 'application/json');
  };

  const filteredAssignments = (currentSchedule?.assignments || []).filter(a => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const matchSlot = a.slotName.toLowerCase().includes(term);
    const matchOfficer = a.officerName ? a.officerName.toLowerCase().includes(term) : false;
    return matchSlot || matchOfficer;
  });

  return (
    <div className="space-y-6">
      
      {/* Top Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <History className="w-5 h-5 text-gold-400" />
            Histórico de Escalas Semanais
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Consulte escalas confirmadas, audite a rotatividade e exporte relatórios consolidados.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* General Summary Export Buttons */}
          {schedules.length > 0 && (
            <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <span className="text-[11px] text-slate-400 px-2 font-medium">Resumo Geral:</span>
              <button
                onClick={() => setIsPrintSummaryOpen(true)}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1 transition-colors"
                title="Visualizar Resumo Geral"
              >
                <Eye className="w-3.5 h-3.5 text-emerald-400" />
                <span>Relatório</span>
              </button>
              <button
                onClick={handleExportSummaryTxt}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1 transition-colors"
                title="Baixar Resumo Geral em arquivo TXT"
              >
                <FileText className="w-3.5 h-3.5 text-sky-400" />
                <span>TXT</span>
              </button>
              <button
                onClick={handleExportSummaryJson}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1 transition-colors"
                title="Baixar Resumo Geral em arquivo JSON"
              >
                <Download className="w-3.5 h-3.5 text-amber-400" />
                <span>JSON</span>
              </button>
            </div>
          )}

          {currentSchedule && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => exportScheduleToPng(currentSchedule, currentSchedule.title, currentSchedule.weekNumber)}
                className="px-3.5 py-2 rounded-lg bg-militar-700 hover:bg-militar-600 text-white text-xs font-semibold border border-militar-500/60 flex items-center gap-2 transition-colors shadow-sm"
                title="Baixar imagem PNG de alta resolução desta semana"
              >
                <ImageIcon className="w-4 h-4 text-gold-400" />
                <span>Exportar essa semana para PNG</span>
              </button>

              <button
                onClick={() => onOpenPrint && onOpenPrint(currentSchedule, currentSchedule.title, currentSchedule.weekNumber)}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition-colors"
                title="Visualizar quadro completo desta semana"
              >
                <Eye className="w-4 h-4 text-slate-400" />
                <span className="hidden sm:inline">Ver Quadro</span>
              </button>

              <button
                onClick={() => setDeleteConfirmWeek(currentSchedule.weekNumber)}
                className="p-2 rounded-lg bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 transition-colors"
                title="Excluir esta escala do histórico"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {schedules.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
          <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-300 mb-1">Nenhuma escala confirmada ainda</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Gere uma proposta no Gerador de Escalas e confirme-a para que ela seja registrada no histórico.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
          
          {/* Left Column: Weeks Selector List (Horizontal scroll on mobile, vertical list on desktop) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 sm:p-4 space-y-2 h-fit">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 sm:mb-2">
              Semanas Salvas ({schedules.length})
            </div>

            <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto lg:max-h-[70vh] pb-1 lg:pb-0 lg:pr-1">
              {schedules.map(schedule => {
                const isSelected = schedule.weekNumber === selectedWeek;
                const filledCount = schedule.summary?.filledSlots || schedule.assignments?.length || 0;

                return (
                  <button
                    key={schedule.weekNumber}
                    onClick={() => setSelectedWeek(schedule.weekNumber)}
                    className={`min-w-[160px] lg:min-w-0 lg:w-full text-left p-3 rounded-lg border transition-all shrink-0 ${
                      isSelected
                        ? 'bg-militar-800/80 border-militar-500 text-white shadow-md'
                        : 'bg-slate-950/60 border-slate-800/80 text-slate-300 hover:bg-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-sm">Semana {schedule.weekNumber}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-emerald-400 border border-slate-800">
                        {filledCount} postos
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 truncate">
                      {schedule.title || `Semana ${schedule.weekNumber}`}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">
                      {schedule.confirmedAt ? new Date(schedule.confirmedAt).toLocaleDateString('pt-BR') : '-'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column (3 cols): Selected Week Detail Inspector */}
          {currentSchedule && (
            <div className="lg:col-span-3 space-y-4">
              
              {/* Header Details */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white">
                    {currentSchedule.title || `Semana ${currentSchedule.weekNumber}`}
                  </h3>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Confirmada em {currentSchedule.confirmedAt ? new Date(currentSchedule.confirmedAt).toLocaleString('pt-BR') : '-'}
                  </div>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Filtrar por posto ou oficial..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-slate-700"
                  />
                </div>
              </div>

              {/* Unified Postos Grid */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-gold-400" />
                    Relação de Postos da Escala
                  </h4>
                  <span className="text-[11px] font-mono text-slate-400">
                    {filteredAssignments.length} postos
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {filteredAssignments.map((a, i) => (
                    <div key={i} className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-200 truncate">
                          {i + 1}. {a.slotName}
                        </div>
                        <div className="text-gold-400 text-[11px] font-medium mt-0.5 truncate">
                          {a.officerName || 'Não preenchido'}
                          {a.isAccumulated && a.accumulatedWith && (
                            <span className="text-[10px] text-amber-300/90 ml-1.5">
                              (+ {a.accumulatedWith.slotName})
                            </span>
                          )}
                        </div>
                      </div>
                      {a.officerPatente && (
                        <span className="font-semibold text-[10px] text-militar-200 px-2 py-0.5 rounded bg-militar-900/70 border border-militar-700/60 shrink-0">
                          {a.officerPatente}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Resting Officers */}
              {currentSchedule.restingOfficers && currentSchedule.restingOfficers.length > 0 && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-blue-400" />
                    Sem Escala ({currentSchedule.restingOfficers.length})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {currentSchedule.restingOfficers.map((o, idx) => (
                      <span key={idx} className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-300">
                        {o.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmWeek && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-rose-400">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-bold text-white">Excluir Escala da Semana {deleteConfirmWeek}?</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Esta ação removerá permanentemente a escala da Semana {deleteConfirmWeek} do histórico. O recálculo das próximas semanas refletirá esta exclusão.
            </p>
            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setDeleteConfirmWeek(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmWeek)}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all"
              >
                Excluir Definitivamente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable General Summary Modal (PDF / Print View) */}
      {isPrintSummaryOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 flex flex-col items-center justify-start p-4 sm:p-6 overflow-y-auto">
          {/* Top Bar Actions (No-print) */}
          <div className="no-print w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-xl p-4 mb-4 flex items-center justify-between shadow-xl">
            <div className="flex items-center gap-2 text-white font-bold text-sm">
              <Printer className="w-4 h-4 text-emerald-400" />
              <span>Resumo Geral do Histórico para Impressão / Salvar em PDF</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg transition-all"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir / Salvar PDF</span>
              </button>
              <button
                onClick={() => setIsPrintSummaryOpen(false)}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>

          {/* Printable Sheet */}
          <div className="w-full max-w-4xl bg-white text-slate-900 p-8 rounded-lg shadow-2xl print:p-0 print:shadow-none print:max-w-none space-y-6">
            {/* Header */}
            <div className="text-center pb-4 border-b-2 border-slate-800">
              <div className="text-xs uppercase tracking-widest font-semibold text-militar-700">
                SISTEMA DE ESCALAS
              </div>
              <h1 className="text-xl sm:text-2xl font-bold uppercase tracking-wide text-slate-950 mt-1">
                Relatório Geral do Histórico de Escalas
              </h1>
              <div className="text-xs text-slate-600 mt-1">
                Data de Emissão: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')} • {schedules.length} semana(s) registrada(s) • {officers.length} oficiais
              </div>
            </div>

            {/* Global Stats Overview */}
            {stats.global && (
              <div className="grid grid-cols-3 gap-3 border border-slate-300 rounded-lg p-3 bg-slate-50 text-center text-xs">
                <div>
                  <div className="text-slate-500 font-medium">Média de Escalas</div>
                  <div className="text-base font-bold text-slate-900 font-mono mt-0.5">{stats.global.avgDuties || 0}</div>
                </div>
                <div>
                  <div className="text-slate-500 font-medium">Equidade do Sistema</div>
                  <div className="text-base font-bold text-emerald-700 font-mono mt-0.5">{stats.global.equityScore || 100}%</div>
                </div>
                <div>
                  <div className="text-slate-500 font-medium">Total de Designações</div>
                  <div className="text-base font-bold text-slate-900 font-mono mt-0.5">{stats.global.totalDuties || 0}</div>
                </div>
              </div>
            )}

            {/* Section 1: Officers Roster with Duties Count */}
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-900 pb-1 border-b border-slate-400 mb-2">
                1. Consolidação por Oficial
              </h2>
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-300 text-slate-700 uppercase text-[10px] tracking-wider font-bold">
                    <th className="py-1.5 px-2 w-10 text-center">Nº</th>
                    <th className="py-1.5 px-3">Patente</th>
                    <th className="py-1.5 px-3">Nome Completo</th>
                    <th className="py-1.5 px-2 text-center">Escalas</th>
                    <th className="py-1.5 px-2 text-center">Comandos</th>
                    <th className="py-1.5 px-2 text-center">Sem Escala</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {(stats.officerStats || []).map((s, idx) => (
                    <tr key={s.id || idx} className="text-slate-800">
                      <td className="py-1.5 px-2 text-center font-mono text-slate-500">
                        {(idx + 1).toString().padStart(2, '0')}
                      </td>
                      <td className="py-1.5 px-3 font-semibold">{s.patente || 'CFOM'}</td>
                      <td className="py-1.5 px-3 font-bold text-slate-900">{s.name}</td>
                      <td className="py-1.5 px-2 text-center font-mono font-bold">{s.totalDuties || 0}</td>
                      <td className="py-1.5 px-2 text-center font-mono font-bold text-amber-700">{s.totalCommands || 0}</td>
                      <td className="py-1.5 px-2 text-center font-mono text-slate-600">{s.weeksSinceLastDuty || 0} sem</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Section 2: Week-by-Week Detail */}
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-900 pb-1 border-b border-slate-400 mb-3">
                2. Histórico Semana a Semana
              </h2>
              
              <div className="space-y-4">
                {schedules.map(schedule => {
                  const assignments = schedule.assignments || [];
                  const resting = schedule.restingOfficers || [];

                  return (
                    <div key={schedule.weekNumber} className="border border-slate-300 rounded-lg p-3 bg-slate-50/50 space-y-2">
                      <div className="flex items-center justify-between pb-1 border-b border-slate-300">
                        <span className="font-bold text-xs text-slate-950 uppercase">
                          Semana {schedule.weekNumber} — {schedule.title || `Semana ${schedule.weekNumber}`}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {schedule.confirmedAt ? new Date(schedule.confirmedAt).toLocaleDateString('pt-BR') : '-'}
                        </span>
                      </div>

                      <div>
                        <div className="font-bold text-[11px] text-slate-800 uppercase mb-1">
                          Postos Escalados ({assignments.length} postos)
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-xs">
                          {assignments.map((post, i) => (
                            <div key={i} className="flex justify-between border-b border-slate-200/80 py-0.5 text-[11px]">
                              <span className="font-medium text-slate-700 truncate pr-2">
                                {post.slotName}
                                {post.isAccumulated && post.accumulatedWith && (
                                  <span className="text-[10px] text-amber-700 ml-1">
                                    (+{post.accumulatedWith.slotName})
                                  </span>
                                )}
                              </span>
                              <span className="font-bold text-slate-900 whitespace-nowrap">
                                {post.officerName ? `${post.officerPatente || 'CFOM'} ${post.officerName}` : 'Pendente'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Resting */}
                      {resting.length > 0 && (
                        <div className="pt-1 text-[10px] text-slate-600 border-t border-slate-200">
                          <strong className="text-slate-800">Dispensa:</strong> {resting.map(r => r.name).join(', ')}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="mt-8 pt-4 border-t border-slate-300 text-center text-[10px] font-semibold text-militar-800">
              Sistema de Escalas por Bueno
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
