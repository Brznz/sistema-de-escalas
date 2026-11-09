import React, { useState } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Scale, 
  Award, 
  Users, 
  Search, 
  CheckCircle2, 
  HelpCircle 
} from 'lucide-react';

export default function StatisticsTab({ stats = {} }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ativo'); // 'ativo', 'todos'

  const global = stats.global || {};
  const officerStats = stats.officerStats || [];

  // Distribution buckets (Histogram)
  const dutyDistribution = {};
  for (const s of officerStats.filter(o => statusFilter === 'todos' || o.status === statusFilter)) {
    dutyDistribution[s.totalDuties] = (dutyDistribution[s.totalDuties] || 0) + 1;
  }
  const maxBucketCount = Math.max(1, ...Object.values(dutyDistribution));

  // Filter officers
  const filteredOfficers = officerStats.filter(o => {
    if (statusFilter !== 'todos' && o.status !== statusFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchName = o.name.toLowerCase().includes(term);
      const matchId = o.idNumber ? o.idNumber.toLowerCase().includes(term) : false;
      return matchName || matchId;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      
      {/* Top Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-400" />
            Estatísticas de Distribuição & Equidade
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Análise auditável da justiça distributiva e rotatividade de postos e comandos de pelotão.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-700/60 text-emerald-300 font-mono text-xs flex items-center gap-2">
            <Scale className="w-4 h-4 text-emerald-400" />
            <span>Score de Equidade: {global.equityScore ?? 100}%</span>
          </div>
        </div>
      </div>

      {/* Global Equity Metrics Grid (2x2 on iPhone 16/17, 4 cols on desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        {/* Média de Escalas */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Média por Oficial Ativo
          </span>
          <div className="text-2xl font-bold font-mono text-white">
            {global.avgDuties ?? '0.0'} <span className="text-xs text-slate-400 font-normal">escalas</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Total acumulado em {global.totalWeeks ?? 0} semanas
          </div>
        </div>

        {/* Desvio Padrão */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Desvio Padrão (σ)
          </span>
          <div className="text-2xl font-bold font-mono text-emerald-400">
            {global.stdDev ?? '0.00'}
          </div>
          <div className="text-[11px] text-emerald-400/80 mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Variação controlada pelo algoritmo
          </div>
        </div>

        {/* Coeficiente de Gini */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Coeficiente de Gini
          </span>
          <div className="text-2xl font-bold font-mono text-blue-400">
            {global.giniIndex ?? '0.000'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            0 = igualdade perfeita, 1 = desigual
          </div>
        </div>

        {/* Dispersão Máx - Mín */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Dispersão Máx / Mín
          </span>
          <div className="text-2xl font-bold font-mono text-gold-400">
            {global.minDuties ?? 0} a {global.maxDuties ?? 0}
            <span className="text-xs text-slate-400 font-normal ml-1">
              (dif: {global.dutySpread ?? 0})
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Diferença máxima de escalas
          </div>
        </div>

      </div>

      {/* Visual Histogram Chart */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-militar-400" />
            Distribuição da Quantidade de Escalas por Oficial
          </h3>
          <span className="text-xs text-slate-400">
            Quanto mais concentrado no centro, mais justa a escala
          </span>
        </div>

        <div className="flex items-end space-x-3 h-36 pt-4 border-b border-slate-800">
          {Object.entries(dutyDistribution)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([dutyCount, count]) => {
              const heightPct = Math.round((count / maxBucketCount) * 100);
              return (
                <div key={dutyCount} className="flex-1 flex flex-col items-center h-full justify-end group">
                  <div className="text-[10px] font-mono text-slate-300 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {count} oficiais
                  </div>
                  <div
                    style={{ height: `${Math.max(10, heightPct)}%` }}
                    className="w-full bg-gradient-to-t from-militar-700 to-militar-500 rounded-t-md hover:from-militar-600 hover:to-gold-400 transition-all cursor-pointer relative"
                  >
                    <span className="sr-only">{count} oficiais com {dutyCount} escalas</span>
                  </div>
                  <div className="text-[11px] font-mono font-bold text-slate-400 mt-2">
                    {dutyCount} esc.
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Comprehensive Officer Ranking Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg space-y-3 p-4">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar oficial na tabela de estatísticas..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-slate-700"
            />
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <span className="text-slate-400">Exibir:</span>
            <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800">
              <button
                onClick={() => setStatusFilter('ativo')}
                className={`px-3 py-1 rounded-md transition-colors ${statusFilter === 'ativo' ? 'bg-militar-700 text-white font-medium' : 'text-slate-400 hover:text-white'}`}
              >
                Ativos ({officerStats.filter(o => o.status === 'ativo').length})
              </button>
              <button
                onClick={() => setStatusFilter('todos')}
                className={`px-3 py-1 rounded-md transition-colors ${statusFilter === 'todos' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400 hover:text-white'}`}
              >
                Todos ({officerStats.length})
              </button>
            </div>
          </div>
        </div>

        {/* iPhone 16 / 17 Mobile Card View */}
        <div className="sm:hidden divide-y divide-slate-800/70">
          {filteredOfficers.map(officer => (
            <div key={officer.id} className="py-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-bold text-sm text-white truncate">{officer.name}</div>
                  <span className="inline-block mt-0.5 font-bold text-[10px] text-gold-300 px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-800/60">
                    {officer.patente || 'CFOM'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 text-right font-mono">
                  <div className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400">Escalas</div>
                    <div className="text-sm font-bold text-white">{officer.totalDuties}</div>
                  </div>
                  <div className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400">Sem Escala</div>
                    <div className={`text-sm font-bold ${officer.weeksWithoutDuty >= 3 ? 'text-amber-300' : 'text-emerald-400'}`}>
                      {officer.weeksWithoutDuty} sem
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-950/50 rounded-lg p-2 border border-slate-800/60">
                <div className="truncate">
                  <span className="text-slate-400">Última: </span>
                  <span className="font-mono text-slate-200">
                    {officer.lastWeekServed ? `Semana ${officer.lastWeekServed}` : 'Nunca'}
                  </span>
                </div>
                <div className="truncate">
                  <span className="text-slate-400">Posto Freq.: </span>
                  <span className="text-slate-200">{officer.mostWorkedPost || '-'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Detailed Desktop Table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Patente</th>
                <th className="py-2.5 px-3">Oficial</th>
                <th className="py-2.5 px-3 text-center">Total Escalas</th>
                <th className="py-2.5 px-3 text-center">Última Escala</th>
                <th className="py-2.5 px-3 text-center">Semanas Sem Escala</th>
                <th className="py-2.5 px-3">Posto Mais Frequente</th>
                <th className="py-2.5 px-3 text-center">Total Comandos</th>
                <th className="py-2.5 px-3 text-center">Último Comando</th>
                <th className="py-2.5 px-3 text-center">Semanas Sem Comando</th>
                <th className="py-2.5 px-3">Pelotão Mais Frequente</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredOfficers.map(officer => (
                <tr key={officer.id} className="hover:bg-slate-800/30 transition-colors font-sans">
                  
                  {/* Patente */}
                  <td className="py-2.5 px-3">
                    <span className="font-bold text-[10px] text-gold-300 px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-800/60">
                      {officer.patente || 'CFOM'}
                    </span>
                  </td>

                  {/* Name */}
                  <td className="py-2.5 px-3 font-semibold text-white">
                    {officer.name}
                  </td>

                  {/* Total Duties */}
                  <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-100">
                    {officer.totalDuties}
                  </td>

                  {/* Last Week Served */}
                  <td className="py-2.5 px-3 text-center font-mono text-slate-300">
                    {officer.lastWeekServed ? `Sem ${officer.lastWeekServed}` : 'Nunca'}
                  </td>

                  {/* Weeks Without Duty */}
                  <td className="py-2.5 px-3 text-center font-mono">
                    <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                      officer.weeksWithoutDuty >= 3
                        ? 'bg-amber-950 text-amber-300 border border-amber-800'
                        : 'text-slate-300'
                    }`}>
                      {officer.weeksWithoutDuty}
                    </span>
                  </td>

                  {/* Top Post */}
                  <td className="py-2.5 px-3 text-slate-300 truncate max-w-[140px]" title={officer.mostWorkedPost}>
                    {officer.mostWorkedPost}
                  </td>

                  {/* Total Commands */}
                  <td className="py-2.5 px-3 text-center font-mono font-bold text-gold-400">
                    {officer.totalCommands}
                  </td>

                  {/* Last Week Commanded */}
                  <td className="py-2.5 px-3 text-center font-mono text-gold-300">
                    {officer.lastWeekCommanded ? `Sem ${officer.lastWeekCommanded}` : 'Nunca'}
                  </td>

                  {/* Weeks Without Command */}
                  <td className="py-2.5 px-3 text-center font-mono text-slate-300">
                    {officer.weeksWithoutCommand}
                  </td>

                  {/* Top Pelotão */}
                  <td className="py-2.5 px-3 text-gold-400/90 truncate max-w-[140px]" title={officer.mostWorkedPelotao}>
                    {officer.mostWorkedPelotao}
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
}
