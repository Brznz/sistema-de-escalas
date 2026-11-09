import React from 'react';
import { 
  Users, 
  MapPin, 
  Calendar, 
  Award, 
  ArrowRight, 
  TrendingUp, 
  CheckCircle2, 
  AlertTriangle,
  Scale,
  Sparkles
} from 'lucide-react';

export default function DashboardTab({ 
  status = {}, 
  stats = {}, 
  schedules = [], 
  setActiveTab 
}) {
  const global = stats.global || {};
  const latestSchedule = schedules.length > 0 ? schedules[schedules.length - 1] : null;

  const totalPostos = (status.totalPhysicalPosts ?? 17) + (status.totalPlatoons ?? 9);

  return (
    <div className="space-y-4 sm:space-y-6">
      
      {/* Top Banner: Clean & Formal ("Sistema de Escalas") */}
      <div className="bg-gradient-to-r from-militar-900 via-slate-900 to-navy-900 rounded-xl p-5 sm:p-7 border border-militar-700/50 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 opacity-10 pointer-events-none flex items-center pr-6">
          <Award className="w-48 h-48 sm:w-56 sm:h-56 text-gold-400" />
        </div>
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Sistema de Escalas
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm mt-1">
              Gestão e distribuição semanal de efetivo entre os postos de serviço.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              onClick={() => setActiveTab('gerador')}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-militar-600 hover:bg-militar-500 text-white font-semibold text-xs sm:text-sm transition-all shadow-md active:scale-95"
            >
              <span>Gerar Escala Semanal</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveTab('historico')}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-200 font-medium text-xs sm:text-sm border border-slate-700 transition-colors"
            >
              <Calendar className="w-4 h-4 text-gold-400" />
              <span>Consultar Histórico</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards (2x2 on mobile, 4 cols on desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        {/* Efetivo de Oficiais */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Efetivo</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline space-x-1.5">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-white">{status.totalOfficers || 0}</span>
            <span className="text-[11px] text-emerald-400 font-medium font-mono">
              ({status.activeOfficers || 0} ativos)
            </span>
          </div>
          <div className="mt-1.5 text-[11px] text-slate-400 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
            <span className="truncate">Aptos para escala</span>
          </div>
        </div>

        {/* Postos Semanais */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Postos Semanais</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-gold-400 flex items-center justify-center">
              <MapPin className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline space-x-1.5">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-white">
              {totalPostos}
            </span>
            <span className="text-[11px] text-slate-400">postos</span>
          </div>
          <div className="mt-1.5 text-[11px] text-slate-400 truncate">
            Quadro semanal ativo
          </div>
        </div>

        {/* Semanas Salvas */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Semanas Salvas</span>
            <div className="w-8 h-8 rounded-lg bg-militar-500/15 text-militar-400 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline space-x-1.5">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-white">{status.confirmedWeeks || 0}</span>
            <span className="text-[11px] text-slate-400">semanas</span>
          </div>
          <div className="mt-1.5 text-[11px] text-slate-400 truncate">
            Registro histórico
          </div>
        </div>

        {/* Índice de Equidade */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Equidade</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline space-x-1.5">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-emerald-400">
              {global.equityScore !== undefined ? `${global.equityScore}%` : '100%'}
            </span>
            <span className="text-[11px] text-slate-400">Gini: {global.giniIndex ?? '0.00'}</span>
          </div>
          <div className="mt-1.5 text-[11px] text-emerald-400 flex items-center gap-1">
            <TrendingUp className="w-3 h-3 shrink-0" />
            <span className="truncate">Rotatividade controlada</span>
          </div>
        </div>

      </div>

      {/* Two Column Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column (2 cols): Latest Schedule summary */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-militar-400" />
              Última Escala Confirmada
            </h3>
            {latestSchedule && (
              <span className="text-xs bg-militar-900 text-militar-200 border border-militar-700 px-2.5 py-1 rounded-full font-mono">
                Semana {latestSchedule.weekNumber}
              </span>
            )}
          </div>

          {latestSchedule ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-lg bg-slate-950/60 border border-slate-800">
                <div>
                  <div className="text-xs text-slate-400">Título da Escala</div>
                  <div className="text-sm font-semibold text-white">{latestSchedule.title || `Semana ${latestSchedule.weekNumber}`}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Postos Preenchidos</div>
                  <div className="text-sm font-mono font-semibold text-emerald-400">
                    {latestSchedule.summary?.filledSlots || latestSchedule.assignments?.length || 0} / {latestSchedule.summary?.totalSlots || latestSchedule.assignments?.length || 0}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Data de Confirmação</div>
                  <div className="text-xs text-slate-300">
                    {latestSchedule.confirmedAt ? new Date(latestSchedule.confirmedAt).toLocaleDateString('pt-BR') : '-'}
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('historico')}
                  className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 font-medium transition-colors"
                >
                  Consultar Escala
                </button>
              </div>

              {/* Sample assignments preview */}
              <div>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Amostra de Postos Designados
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(latestSchedule.assignments || [])
                    .slice(0, 6)
                    .map((a, idx) => (
                      <div key={idx} className="p-2.5 rounded bg-slate-950/40 border border-slate-800/80 flex items-center justify-between text-xs">
                        <div className="min-w-0 pr-2">
                          <div className="font-medium text-slate-200 truncate">{a.slotName}</div>
                          <div className="text-[11px] text-gold-400 truncate">Oficial: {a.officerName || 'Pendente'}</div>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-militar-900/60 text-militar-300 border border-militar-700/50 shrink-0">
                          {a.officerPatente || 'CFOM'}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-10 px-4 border border-dashed border-slate-800 rounded-lg">
              <Calendar className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-400 mb-4">Nenhuma escala confirmada ainda no histórico.</p>
              <button
                onClick={() => setActiveTab('gerador')}
                className="px-4 py-2 rounded-lg bg-militar-600 hover:bg-militar-500 text-white text-xs font-medium transition-colors"
              >
                Gerar Escala da Semana 1
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Rules summary */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-base font-bold text-white flex items-center gap-2 mb-4">
            <Scale className="w-4 h-4 text-gold-400" />
            Regras de Otimização Ativas
          </h3>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              <div className="font-semibold text-slate-200 mb-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                1. Não repetição de postos
              </div>
              <p className="text-slate-400 text-[11px]">
                Penaliza repetição de mesmo posto físico ou pelotão em semanas consecutivas.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              <div className="font-semibold text-slate-200 mb-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                2. Prioridade por tempo ocioso
              </div>
              <p className="text-slate-400 text-[11px]">
                Oficiais há mais semanas sem participar têm prioridade máxima na distribuição.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              <div className="font-semibold text-slate-200 mb-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                3. Equilíbrio de carga total
              </div>
              <p className="text-slate-400 text-[11px]">
                Evita disparidade excessiva no total acumulado de escalas por oficial.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              <div className="font-semibold text-slate-200 mb-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                4. Rotação de comando de pelotão
              </div>
              <p className="text-slate-400 text-[11px]">
                Quem não comandou na semana anterior tem preferência; histórico de comando separado.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              <div className="font-semibold text-slate-200 mb-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                5. Restrições estritas e bloqueios
              </div>
              <p className="text-slate-400 text-[11px]">
                Inativos nunca entram; impedimentos individuais e cadeados são estritamente respeitados.
              </p>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
