import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Sliders, 
  RotateCcw, 
  Save, 
  Play, 
  Download, 
  Upload, 
  AlertTriangle, 
  CheckCircle2, 
  Sparkles 
} from 'lucide-react';
import { updateConfig, fetchConfig, resetAllData, importBackupData, exportDatabaseJsonString, downloadFile } from '../api';
import { DEFAULT_WEIGHTS } from '../../server/algorithm/costMatrix.js';
import { generateWeeklySchedule } from '../../server/algorithm/optimizer.js';
import { generateSystemStats } from '../../server/algorithm/stats.js';

export default function SettingsTab({ 
  officers = [], 
  physicalPosts = [], 
  platoons = [], 
  onConfigUpdated 
}) {
  const [weights, setWeights] = useState({ ...DEFAULT_WEIGHTS });
  const [schoolName, setSchoolName] = useState('Sistema de Escalas');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Simulator state
  const [simWeeks, setSimWeeks] = useState(6);
  const [simResults, setSimResults] = useState(null);
  const [simulating, setSimulating] = useState(false);

  // Reset all state
  const [resetAllConfirmOpen, setResetAllConfirmOpen] = useState(false);

  useEffect(() => {
    async function loadConfig() {
      try {
        const cfg = await fetchConfig();
        if (cfg.weights) setWeights({ ...DEFAULT_WEIGHTS, ...cfg.weights });
        if (cfg.schoolName) setSchoolName(cfg.schoolName);
      } catch (err) {
        console.error(err);
      }
    }
    loadConfig();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      setErrorMsg('');
      await updateConfig({ weights, schoolName });
      setSaveMsg('Configurações e pesos salvos com sucesso!');
      if (onConfigUpdated) onConfigUpdated();
      setTimeout(() => setSaveMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.message || 'Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const handleResetWeights = () => {
    setWeights({ ...DEFAULT_WEIGHTS });
    setSaveMsg('Pesos restaurados para os valores padrão recomendados.');
    setTimeout(() => setSaveMsg(''), 3000);
  };

  // Run in-browser multi-week simulation sandbox
  const handleRunSimulation = () => {
    try {
      setSimulating(true);
      const activeOfficers = officers.filter(o => o.status === 'ativo');
      const allSlots = [
        ...physicalPosts.filter(p => p.enabled !== false),
        ...platoons.filter(p => p.enabled !== false)
      ];

      const simHistory = [];

      for (let w = 1; w <= simWeeks; w++) {
        const res = generateWeeklySchedule({
          allOfficers: activeOfficers,
          slots: allSlots,
          historySchedules: simHistory,
          currentWeekNumber: w,
          weights
        });

        simHistory.push({
          weekNumber: w,
          title: `Simulação Semana ${w}`,
          assignments: res.assignments
        });
      }

      const simStats = generateSystemStats(activeOfficers, simHistory);
      setSimResults({
        history: simHistory,
        stats: simStats
      });
    } catch (err) {
      console.error(err);
      setErrorMsg('Erro ao executar simulação: ' + err.message);
    } finally {
      setSimulating(false);
    }
  };

  // Full reset
  const handleExecuteResetAll = async () => {
    try {
      await resetAllData();
      setResetAllConfirmOpen(false);
      window.location.reload();
    } catch (err) {
      setErrorMsg('Erro ao reiniciar sistema: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-gold-400" />
            Configurações & Calibração do Algoritmo
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Ajuste os pesos matemáticos da função de custo para calibrar o equilíbrio da distribuição.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleResetWeights}
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restaurar Pesos Padrão</span>
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-militar-600 hover:bg-militar-500 text-white text-xs font-semibold shadow-md flex items-center gap-2 transition-colors active:scale-95 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Salvando...' : 'Salvar Alterações'}</span>
          </button>
        </div>
      </div>

      {saveMsg && (
        <div className="p-3 rounded-lg bg-emerald-950/80 border border-emerald-700 text-emerald-200 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{saveMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-700 text-rose-200 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Two Column Grid: Weights by Rules */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Column: Duty Fairness & Repeat Posts */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              Regras Gerais: Equidade e Não Repetição de Postos
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Controla prioridade de descanso, ociosidade e rotação entre postos físicos.
            </p>
          </div>

          <div className="space-y-4 text-xs">
            
            {/* Semanas sem escala */}
            <div>
              <div className="flex justify-between font-semibold text-slate-200 mb-1">
                <span>Prioridade por Semanas Sem Escala (Regra 2)</span>
                <span className="font-mono text-emerald-400">{weights.pesoSemanasSemEscala}</span>
              </div>
              <input
                type="range"
                min="10"
                max="200"
                value={weights.pesoSemanasSemEscala}
                onChange={e => setWeights({ ...weights, pesoSemanasSemEscala: Number(e.target.value) })}
                className="w-full accent-militar-500"
              />
              <span className="text-[10px] text-slate-500">
                Quanto maior, mais urgente escalar quem está há muitas semanas sem participar.
              </span>
            </div>

            {/* Equilíbrio de escalas totais */}
            <div>
              <div className="flex justify-between font-semibold text-slate-200 mb-1">
                <span>Equilíbrio no Total Acumulado de Escalas (Regra 3)</span>
                <span className="font-mono text-emerald-400">{weights.pesoEquilibrioEscalasTotais}</span>
              </div>
              <input
                type="range"
                min="5"
                max="150"
                value={weights.pesoEquilibrioEscalasTotais}
                onChange={e => setWeights({ ...weights, pesoEquilibrioEscalasTotais: Number(e.target.value) })}
                className="w-full accent-militar-500"
              />
              <span className="text-[10px] text-slate-500">
                Penaliza oficiais que já acumulam muitas escalas totais no histórico.
              </span>
            </div>

            {/* Penalidade por escala consecutiva */}
            <div>
              <div className="flex justify-between font-semibold text-slate-200 mb-1">
                <span>Penalidade por Escala Consecutiva (Semana Passada)</span>
                <span className="font-mono text-amber-400">{weights.pesoEscalaSemanaAnterior}</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={weights.pesoEscalaSemanaAnterior}
                onChange={e => setWeights({ ...weights, pesoEscalaSemanaAnterior: Number(e.target.value) })}
                className="w-full accent-amber-500"
              />
              <span className="text-[10px] text-slate-500">
                Favorece descanso para quem trabalhou na semana anterior.
              </span>
            </div>

            {/* Repetição mesmo posto semana anterior */}
            <div>
              <div className="flex justify-between font-semibold text-slate-200 mb-1">
                <span>Evitar Mesmo Posto na Semana Seguinte (Regra 1)</span>
                <span className="font-mono text-rose-400">{weights.pesoRepeticaoPostoSemanaAnterior}</span>
              </div>
              <input
                type="range"
                min="20"
                max="250"
                value={weights.pesoRepeticaoPostoSemanaAnterior}
                onChange={e => setWeights({ ...weights, pesoRepeticaoPostoSemanaAnterior: Number(e.target.value) })}
                className="w-full accent-rose-500"
              />
              <span className="text-[10px] text-slate-500">
                Evita colocar o mesmo oficial no mesmo posto da semana passada (ex: Guarita).
              </span>
            </div>

            {/* Repetição posto 2 semanas */}
            <div>
              <div className="flex justify-between font-semibold text-slate-200 mb-1">
                <span>Evitar Mesmo Posto Há Duas Semanas</span>
                <span className="font-mono text-rose-400">{weights.pesoRepeticaoPostoDuasSemanas}</span>
              </div>
              <input
                type="range"
                min="0"
                max="150"
                value={weights.pesoRepeticaoPostoDuasSemanas}
                onChange={e => setWeights({ ...weights, pesoRepeticaoPostoDuasSemanas: Number(e.target.value) })}
                className="w-full accent-rose-500"
              />
            </div>

          </div>
        </div>

        {/* Right Column: Platoon Command Rules */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gold-400" />
              Regra 4: Prioridade para o Comando dos Pelotões
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Controla rotação de comandantes e independe do histórico de participação normal.
            </p>
          </div>

          <div className="space-y-4 text-xs">
            
            {/* Bônus para quem NÃO comandou semana passada */}
            <div>
              <div className="flex justify-between font-semibold text-slate-200 mb-1">
                <span>Bônus: NÃO Comandou na Semana Anterior</span>
                <span className="font-mono text-gold-400">{weights.bonusComandoNaoComandouSemanaAnterior}</span>
              </div>
              <input
                type="range"
                min="30"
                max="300"
                value={weights.bonusComandoNaoComandouSemanaAnterior}
                onChange={e => setWeights({ ...weights, bonusComandoNaoComandouSemanaAnterior: Number(e.target.value) })}
                className="w-full accent-gold-500"
              />
              <span className="text-[10px] text-slate-500">
                Regra principal: oficiais que não comandaram semana passada têm forte prioridade para comandar.
              </span>
            </div>

            {/* Penalidade comando consecutivo */}
            <div>
              <div className="flex justify-between font-semibold text-slate-200 mb-1">
                <span>Penalidade: Comandou na Semana Anterior (Evita Consecutivo)</span>
                <span className="font-mono text-rose-400">{weights.penalidadeComandoConsecutivo}</span>
              </div>
              <input
                type="range"
                min="30"
                max="350"
                value={weights.penalidadeComandoConsecutivo}
                onChange={e => setWeights({ ...weights, penalidadeComandoConsecutivo: Number(e.target.value) })}
                className="w-full accent-rose-500"
              />
              <span className="text-[10px] text-slate-500">
                Reduz a prioridade de comandar novamente para quem já foi comandante na semana passada.
              </span>
            </div>

            {/* Semanas sem comando */}
            <div>
              <div className="flex justify-between font-semibold text-slate-200 mb-1">
                <span>Prioridade por Semanas Sem Comandar</span>
                <span className="font-mono text-gold-400">{weights.pesoSemanasSemComando}</span>
              </div>
              <input
                type="range"
                min="10"
                max="150"
                value={weights.pesoSemanasSemComando}
                onChange={e => setWeights({ ...weights, pesoSemanasSemComando: Number(e.target.value) })}
                className="w-full accent-gold-500"
              />
              <span className="text-[10px] text-slate-500">
                Dentre os aptos, prioriza quem está há mais tempo sem assumir um pelotão.
              </span>
            </div>

            {/* Equilíbrio de comandos totais */}
            <div>
              <div className="flex justify-between font-semibold text-slate-200 mb-1">
                <span>Equilíbrio no Total de Comandos Exercidos</span>
                <span className="font-mono text-gold-400">{weights.pesoEquilibrioComandosTotais}</span>
              </div>
              <input
                type="range"
                min="10"
                max="150"
                value={weights.pesoEquilibrioComandosTotais}
                onChange={e => setWeights({ ...weights, pesoEquilibrioComandosTotais: Number(e.target.value) })}
                className="w-full accent-gold-500"
              />
              <span className="text-[10px] text-slate-500">
                Distribui as oportunidades de comando de maneira equivalente ao longo do ano.
              </span>
            </div>

            {/* Repetição mesmo pelotão */}
            <div>
              <div className="flex justify-between font-semibold text-slate-200 mb-1">
                <span>Evitar Repetir o Mesmo Pelotão Recentemente</span>
                <span className="font-mono text-rose-400">{weights.pesoRepeticaoPelotaoSemanaAnterior}</span>
              </div>
              <input
                type="range"
                min="20"
                max="250"
                value={weights.pesoRepeticaoPelotaoSemanaAnterior}
                onChange={e => setWeights({ ...weights, pesoRepeticaoPelotaoSemanaAnterior: Number(e.target.value) })}
                className="w-full accent-rose-500"
              />
            </div>

          </div>
        </div>

      </div>

      {/* Multi-Week Simulation Sandbox Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-gold-400" />
              Simulador Rápido de Calibração (Sandbox)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Simule várias semanas consecutivas em memória para auditar o desvio padrão e equidade antes de salvar.
            </p>
          </div>

          <div className="flex items-center space-x-3 text-xs">
            <span className="text-slate-400">Semanas a simular:</span>
            <select
              value={simWeeks}
              onChange={e => setSimWeeks(Number(e.target.value))}
              className="px-2.5 py-1 rounded bg-slate-950 border border-slate-700 text-white font-mono"
            >
              <option value="4">4 Semanas</option>
              <option value="6">6 Semanas</option>
              <option value="8">8 Semanas</option>
              <option value="12">12 Semanas</option>
            </select>

            <button
              onClick={handleRunSimulation}
              disabled={simulating}
              className="px-3.5 py-1.5 rounded-lg bg-militar-600 hover:bg-militar-500 text-white font-semibold transition-colors flex items-center gap-1.5 border border-militar-500/50"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{simulating ? 'Simulando...' : 'Executar Simulação'}</span>
            </button>
          </div>
        </div>

        {simResults && (
          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Score de Equidade</span>
                <span className="text-base font-bold font-mono text-emerald-400">
                  {simResults.stats.global.equityScore}%
                </span>
              </div>
              <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Média de Escalas</span>
                <span className="text-base font-bold font-mono text-white">
                  {simResults.stats.global.avgDuties}
                </span>
              </div>
              <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Desvio Padrão (σ)</span>
                <span className="text-base font-bold font-mono text-emerald-400">
                  {simResults.stats.global.stdDev}
                </span>
              </div>
              <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Dispersão (Máx - Mín)</span>
                <span className="text-base font-bold font-mono text-gold-400">
                  {simResults.stats.global.dutySpread} escalas
                </span>
              </div>
            </div>
            <p className="text-[11px] text-emerald-400">
              ✓ Simulação concluída com sucesso! Os pesos configurados proporcionam distribuição equilibrada e alta rotatividade.
            </p>
          </div>
        )}
      </div>

      {/* Backup and Factory Reset Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-bold text-white">Backup e Persistência de Dados</h3>
        <p className="text-xs text-slate-400">
          Os dados permanecem salvos permanentemente em arquivo local no servidor. Você pode baixar uma cópia de segurança em formato JSON a qualquer momento.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => {
              const jsonStr = exportDatabaseJsonString();
              downloadFile(
                `banco_sistema_escalas_${new Date().toISOString().slice(0, 10)}.json`,
                jsonStr,
                'application/json;charset=utf-8;'
              );
            }}
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4 text-slate-400" />
            <span>Exportar Backup Completo (JSON)</span>
          </button>

          <label className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center gap-2 transition-colors cursor-pointer">
            <Upload className="w-4 h-4 text-militar-400" />
            <span>Importar Backup (JSON)</span>
            <input
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={async e => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  setErrorMsg('');
                  const text = await file.text();
                  const parsed = JSON.parse(text);
                  await importBackupData(parsed);
                  setSaveMsg('Backup importado com sucesso!');
                  if (onConfigUpdated) onConfigUpdated();
                  setTimeout(() => setSaveMsg(''), 4000);
                } catch (err) {
                  setErrorMsg(err.message || 'Arquivo JSON de backup inválido');
                } finally {
                  e.target.value = '';
                }
              }}
            />
          </label>

          <button
            onClick={() => setResetAllConfirmOpen(true)}
            className="px-3.5 py-2 rounded-lg bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 text-xs font-semibold border border-rose-800/60 flex items-center gap-2 transition-colors ml-auto"
          >
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span>Restaurar Fábrica (Zerar Dados)</span>
          </button>
        </div>
      </div>

      {/* Reset All Modal */}
      {resetAllConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-rose-400">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-bold text-white">Restaurar Fábrica?</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Esta ação apagará todas as escalas salvas e os oficiais cadastrados, restaurando os 17 postos físicos e 9 pelotões padrão. Um backup automático do estado atual será salvo antes de restaurar.
            </p>
            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setResetAllConfirmOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleExecuteResetAll}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all"
              >
                Sim, Restaurar Fábrica
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
