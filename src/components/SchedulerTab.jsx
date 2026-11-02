import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Sparkles, 
  Lock, 
  Unlock, 
  Save, 
  RefreshCw, 
  Printer, 
  AlertTriangle, 
  CheckCircle2, 
  Users, 
  MapPin, 
  Award, 
  ChevronDown, 
  ChevronUp, 
  Filter,
  Info,
  ShieldCheck,
  Search,
  UserCheck,
  Image as ImageIcon,
  Eye
} from 'lucide-react';
import { generateSchedule, confirmSchedule } from '../api';
import { exportScheduleToPng } from '../utils/exportUtils';

export default function SchedulerTab({
  officers = [],
  physicalPosts = [],
  platoons = [],
  schedules = [],
  onScheduleSaved,
  onOpenPrint
}) {
  // Determine next suggested week number
  const latestSavedWeek = schedules.length > 0 
    ? Math.max(...schedules.map(s => s.weekNumber || 1)) 
    : 0;

  const [weekNumber, setWeekNumber] = useState(latestSavedWeek + 1);
  const [scheduleTitle, setScheduleTitle] = useState(`Escala Semanal — Semana ${latestSavedWeek + 1}`);
  
  // Available officers selection (default: all active officers)
  const activeOfficers = officers.filter(o => o.status === 'ativo');
  const [selectedOfficerIds, setSelectedOfficerIds] = useState(
    activeOfficers.map(o => o.id)
  );

  // Enabled slots for this week
  const allSlots = [
    ...physicalPosts.filter(p => p.enabled !== false),
    ...platoons.filter(p => p.enabled !== false)
  ];
  const [enabledSlotIds, setEnabledSlotIds] = useState(allSlots.map(s => s.id));

  // Settings drawers
  const [showOfficerFilter, setShowOfficerFilter] = useState(false);
  const [showSlotFilter, setShowSlotFilter] = useState(false);

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [proposal, setProposal] = useState(null);
  const [manualLocks, setManualLocks] = useState({}); // { [slotId]: officerId }
  const [filterType, setFilterType] = useState('todos'); // 'todos', 'pelotao', 'posto', 'folga'
  const [searchTerm, setSearchTerm] = useState('');

  // Confirmation modal state
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [overwriteWarning, setOverwriteWarning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Keep title updated when week number changes
  useEffect(() => {
    setScheduleTitle(`Escala Semanal — Semana ${weekNumber}`);
  }, [weekNumber]);

  // Keep selected officers and enabled slots synced when props change
  useEffect(() => {
    setSelectedOfficerIds(activeOfficers.map(o => o.id));
  }, [officers]);

  useEffect(() => {
    setEnabledSlotIds(allSlots.map(s => s.id));
  }, [physicalPosts, platoons]);

  // Handle Generate
  const handleGenerate = async (keepLocks = false) => {
    try {
      setGenerating(true);
      setErrorMsg('');
      setSaveSuccessMsg('');

      const locksToSend = keepLocks ? manualLocks : {};

      const result = await generateSchedule({
        weekNumber: Number(weekNumber),
        activeOfficerIds: selectedOfficerIds,
        enabledSlotIds,
        manualLocks: locksToSend
      });

      setProposal(result);
      if (!keepLocks) {
        // extract locks from proposal if any
        const newLocks = {};
        for (const a of result.assignments) {
          if (a.isLocked && a.officerId) {
            newLocks[a.slotId] = a.officerId;
          }
        }
        setManualLocks(newLocks);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Erro ao gerar proposta de escala');
    } finally {
      setGenerating(false);
    }
  };

  // Toggle lock for a slot
  const handleToggleLock = (slotId, currentOfficerId) => {
    if (!proposal) return;
    const isCurrentlyLocked = !!manualLocks[slotId];

    if (isCurrentlyLocked) {
      // Unlock
      const updated = { ...manualLocks };
      delete updated[slotId];
      setManualLocks(updated);

      // update proposal assignment flag
      setProposal(prev => ({
        ...prev,
        assignments: prev.assignments.map(a => 
          a.slotId === slotId ? { ...a, isLocked: false } : a
        )
      }));
    } else {
      // Lock with current officer
      if (!currentOfficerId) return;
      const updated = { ...manualLocks, [slotId]: currentOfficerId };
      setManualLocks(updated);

      setProposal(prev => ({
        ...prev,
        assignments: prev.assignments.map(a => 
          a.slotId === slotId ? { ...a, isLocked: true } : a
        )
      }));
    }
  };

  // Helper to check if a slot is a bathroom
  const isBathroomSlot = (slot) => {
    if (!slot) return false;
    const name = (slot.slotName || slot.name || '').toLowerCase();
    const id = (slot.slotId || slot.id || '').toLowerCase();
    return name.includes('banheiro') || id === 'posto_2' || id === 'posto_3';
  };

  // Helper to check if a slot can accumulate two duties
  // Regra do Usuário: "so deixa ficar com duas escalas quem tiver em escala de cozinha refeitorio e fila"
  const canSlotAccumulate = (slot) => {
    if (!slot) return false;
    const name = (slot.slotName || slot.name || '').toLowerCase();
    const id = (slot.slotId || slot.id || '').toLowerCase();
    const baseId = (slot.baseId || '').toLowerCase();

    return (
      name.includes('cozinha') ||
      name.includes('refeitório') ||
      name.includes('refeitorio') ||
      name.includes('fila') ||
      id.includes('cozinha') ||
      id.includes('refeit') ||
      id.includes('fila') ||
      baseId.includes('cozinha') ||
      baseId.includes('refeit')
    );
  };

  // Manual reassign an officer to a slot
  const handleManualReassign = (slotId, newOfficerId) => {
    if (!proposal) return;

    const newOfficer = officers.find(o => o.id === newOfficerId);
    const targetSlot = proposal.assignments.find(a => a.slotId === slotId);
    const isTargetPlatoon = targetSlot && (targetSlot.slotType === 'pelotao' || targetSlot.isCommand);
    const targetCanAccumulate = canSlotAccumulate(targetSlot);

    const clearedLockSlots = new Set();

    // If new officer was assigned to another slot in proposal, handle transfer or accumulation
    const updatedAssignments = proposal.assignments.map(a => {
      if (a.slotId === slotId) {
        if (!newOfficer) {
          clearedLockSlots.add(a.slotId);
        }
        return {
          ...a,
          officerId: newOfficer ? newOfficer.id : null,
          officerName: newOfficer ? newOfficer.name : null,
          officerPatente: newOfficer ? (newOfficer.patente || 'CFOM') : null,
          officerSexo: newOfficer ? (newOfficer.sexo || 'masculino') : null,
          isLocked: newOfficer ? a.isLocked : false,
          status: newOfficer ? 'atribuido' : 'pendente',
          warning: newOfficer ? null : 'Sem oficial atribuído manualmente'
        };
      }
      
      if (newOfficerId && a.officerId === newOfficerId) {
        const isCurrentPlatoon = a.slotType === 'pelotao' || a.isCommand;
        const currentCanAccumulate = canSlotAccumulate(a);

        let shouldUnassign = false;

        if (isTargetPlatoon) {
          // If moving into a platoon:
          // Unassign if already in another platoon, OR if current post cannot accumulate (not cozinha, refeitorio, fila)
          if (isCurrentPlatoon || !currentCanAccumulate) {
            shouldUnassign = true;
          }
        } else {
          // If moving into a physical post:
          if (!targetCanAccumulate) {
            // Target post CANNOT accumulate (e.g. Guarita, Banheiro, Escadas, Armários, Bebedouro):
            // Cannot hold any other duty, unassign previous!
            shouldUnassign = true;
          } else {
            // Target post CAN accumulate (Cozinha, Refeitório, Fila):
            // Keep previous duty if it's a platoon, but unassign if it's another physical post
            if (!isCurrentPlatoon) {
              shouldUnassign = true;
            }
          }
        }

        if (shouldUnassign) {
          clearedLockSlots.add(a.slotId);
          return {
            ...a,
            officerId: null,
            officerName: null,
            officerPatente: null,
            officerSexo: null,
            isLocked: false,
            status: 'pendente',
            warning: 'Oficial transferido para outra vaga'
          };
        }
      }
      return a;
    });

    // Recompute accumulation annotations
    const officerMapCount = new Map();
    for (const a of updatedAssignments) {
      if (a.officerId) {
        if (!officerMapCount.has(a.officerId)) officerMapCount.set(a.officerId, []);
        officerMapCount.get(a.officerId).push(a);
      }
    }
    for (const a of updatedAssignments) {
      if (!a.officerId) {
        a.isAccumulated = false;
        a.accumulatedWith = null;
        continue;
      }
      const list = officerMapCount.get(a.officerId) || [];
      if (list.length > 1) {
        const other = list.find(o => o.slotId !== a.slotId);
        a.isAccumulated = true;
        a.accumulatedWith = other ? {
          slotId: other.slotId,
          slotName: other.slotName,
          slotType: other.slotType,
          isCommand: other.isCommand
        } : null;
      } else {
        a.isAccumulated = false;
        a.accumulatedWith = null;
      }
    }

    // Recompute resting officers preserving historical duty counts
    const prevRestingMap = new Map((proposal.restingOfficers || []).map(r => [r.id, r]));
    const prevSnapshotMap = new Map(
      (proposal.assignments || [])
        .filter(a => a.officerId && a.metricsSnapshot)
        .map(a => [a.officerId, a.metricsSnapshot])
    );

    const assignedIds = new Set(updatedAssignments.filter(a => a.officerId).map(a => a.officerId));
    const updatedResting = activeOfficers
      .filter(o => selectedOfficerIds.includes(o.id) && !assignedIds.has(o.id))
      .map(o => {
        const prevRest = prevRestingMap.get(o.id);
        const snap = prevSnapshotMap.get(o.id);
        return {
          id: o.id,
          name: o.name,
          patente: o.patente || 'CFOM',
          sexo: o.sexo || 'masculino',
          totalDuties: prevRest?.totalDuties ?? snap?.totalDuties ?? 0,
          weeksSinceLastDuty: prevRest?.weeksSinceLastDuty ?? snap?.weeksSinceLastDuty ?? 0,
          totalCommands: prevRest?.totalCommands ?? snap?.totalCommands ?? 0,
          weeksSinceLastCommand: prevRest?.weeksSinceLastCommand ?? snap?.weeksSinceLastCommand ?? 0
        };
      });

    // Update lock map for target slot and any unassigned slots
    setManualLocks(prev => {
      const next = { ...prev };
      for (const cid of clearedLockSlots) {
        delete next[cid];
      }
      if (next[slotId] && newOfficerId) {
        next[slotId] = newOfficerId;
      }
      return next;
    });

    setProposal(prev => ({
      ...prev,
      assignments: updatedAssignments,
      restingOfficers: updatedResting,
      summary: {
        ...prev.summary,
        filledSlots: updatedAssignments.filter(a => a.status === 'atribuido').length,
        pendingSlotsCount: updatedAssignments.filter(a => a.status === 'pendente').length,
        accumulatedOfficersCount: Array.from(officerMapCount.values()).filter(l => l.length > 1).length
      }
    }));
  };

  // Open Save Confirmation
  const handleOpenConfirmModal = () => {
    if (!proposal) return;
    const exists = schedules.some(s => s.weekNumber === Number(weekNumber));
    setOverwriteWarning(exists);
    setConfirmModalOpen(true);
  };

  // Execute Save
  const handleExecuteSave = async (force = false) => {
    try {
      setSaving(true);
      setErrorMsg('');

      const scheduleData = {
        weekNumber: Number(weekNumber),
        title: scheduleTitle,
        assignments: proposal.assignments,
        restingOfficers: proposal.restingOfficers,
        summary: proposal.summary
      };

      await confirmSchedule(scheduleData, force);
      setConfirmModalOpen(false);
      setSaveSuccessMsg(`Escala da Semana ${weekNumber} confirmada e gravada com sucesso!`);
      if (onScheduleSaved) onScheduleSaved();
    } catch (err) {
      if (err.status === 409) {
        setOverwriteWarning(true);
      } else {
        setErrorMsg(err.message || 'Erro ao salvar escala definitiva');
      }
    } finally {
      setSaving(false);
    }
  };

  // Filter assignments based on search & category
  const filteredAssignments = (proposal?.assignments || []).filter(a => {
    if (filterType === 'pelotao' && a.slotType !== 'pelotao') return false;
    if (filterType === 'posto' && a.slotType !== 'posto') return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchSlot = a.slotName.toLowerCase().includes(term);
      const matchOfficer = a.officerName ? a.officerName.toLowerCase().includes(term) : false;
      const matchPatente = a.officerPatente ? a.officerPatente.toLowerCase().includes(term) : false;
      return matchSlot || matchOfficer || matchPatente;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      
      {/* Top Header Controls Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Week & Title selector */}
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Semana
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min="1"
                  max="52"
                  value={weekNumber}
                  onChange={e => setWeekNumber(Number(e.target.value))}
                  className="w-20 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono font-bold text-center focus:border-militar-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex-1 min-w-[240px]">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Identificação da Escala
              </label>
              <input
                type="text"
                value={scheduleTitle}
                onChange={e => setScheduleTitle(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:border-militar-500 focus:outline-none font-medium"
                placeholder="Ex: Escala Semanal — Semana 1"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Officers availability drawer toggle */}
            <button
              onClick={() => setShowOfficerFilter(!showOfficerFilter)}
              className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                showOfficerFilter 
                  ? 'bg-slate-800 text-white border-slate-600' 
                  : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-blue-400" />
              <span>Oficiais ({selectedOfficerIds.length}/{activeOfficers.length})</span>
              {showOfficerFilter ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {/* Slots drawer toggle */}
            <button
              onClick={() => setShowSlotFilter(!showSlotFilter)}
              className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                showSlotFilter 
                  ? 'bg-slate-800 text-white border-slate-600' 
                  : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
              }`}
            >
              <MapPin className="w-3.5 h-3.5 text-amber-400" />
              <span>Postos ({enabledSlotIds.length}/{allSlots.length})</span>
              {showSlotFilter ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {/* Generate Button */}
            <button
              onClick={() => handleGenerate(false)}
              disabled={generating}
              className="w-full sm:w-auto justify-center px-4 py-2 rounded-lg bg-gradient-to-r from-militar-600 to-militar-700 hover:from-militar-500 hover:to-militar-600 text-white text-xs sm:text-sm font-semibold transition-all shadow-md active:scale-95 flex items-center gap-2 disabled:opacity-50"
            >
              <Sparkles className={`w-4 h-4 text-gold-400 ${generating ? 'animate-spin' : ''}`} />
              <span>{generating ? 'Calculando Otimização...' : 'Gerar Escala Otimizada'}</span>
            </button>

            {/* Regenerate keeping locks button */}
            {proposal && Object.keys(manualLocks).length > 0 && (
              <button
                onClick={() => handleGenerate(true)}
                disabled={generating}
                className="w-full sm:w-auto justify-center px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-gold-400 text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-colors"
                title="Gera novamente mantendo os oficiais fixados nos postos marcados com cadeado"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
                <span>Regerar mantendo fixados ({Object.keys(manualLocks).length})</span>
              </button>
            )}

            {/* Export to PNG & Preview Buttons */}
            {proposal && (
              <>
                <button
                  onClick={() => exportScheduleToPng(proposal, scheduleTitle, weekNumber)}
                  className="w-full sm:w-auto justify-center px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-gold-400 text-xs font-semibold border border-gold-500/40 flex items-center gap-1.5 transition-colors shadow-sm"
                  title="Baixar imagem PNG de alta resolução desta escala"
                >
                  <ImageIcon className="w-4 h-4 text-gold-400" />
                  <span>Exportar essa semana para PNG</span>
                </button>
                <button
                  onClick={() => onOpenPrint && onOpenPrint(proposal, scheduleTitle, weekNumber)}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-colors"
                  title="Visualizar quadro completo de exportação"
                >
                  <Eye className="w-3.5 h-3.5 text-slate-400" />
                  <span>Ver Quadro</span>
                </button>
              </>
            )}

            {/* Save Button */}
            {proposal && (
              <button
                onClick={handleOpenConfirmModal}
                className="w-full sm:w-auto justify-center px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold transition-all shadow-md active:scale-95 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>Confirmar e Salvar</span>
              </button>
            )}

          </div>

        </div>

        {/* Success message banner */}
        {saveSuccessMsg && (
          <div className="mt-4 p-3 rounded-lg bg-emerald-950/80 border border-emerald-700/60 text-emerald-200 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* Error message banner */}
        {errorMsg && (
          <div className="mt-4 p-3 rounded-lg bg-rose-950/80 border border-rose-700/60 text-rose-200 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Officer Availability Checklist Drawer */}
        {showOfficerFilter && (
          <div className="mt-4 p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-300 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-blue-400" />
                Oficiais Disponíveis para a Semana {weekNumber}
              </div>
              <div className="flex items-center space-x-2 text-xs">
                <button
                  onClick={() => setSelectedOfficerIds(activeOfficers.map(o => o.id))}
                  className="text-blue-400 hover:underline"
                >
                  Marcar Todos
                </button>
                <span className="text-slate-600">|</span>
                <button
                  onClick={() => setSelectedOfficerIds([])}
                  className="text-slate-400 hover:underline"
                >
                  Desmarcar Todos
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-48 overflow-y-auto pr-2">
              {activeOfficers.map(officer => {
                const isChecked = selectedOfficerIds.includes(officer.id);
                return (
                  <label
                    key={officer.id}
                    className={`flex items-center space-x-2 p-2 rounded text-xs cursor-pointer border transition-colors ${
                      isChecked 
                        ? 'bg-slate-900 border-slate-700 text-slate-200' 
                        : 'bg-slate-950/40 border-slate-800/60 text-slate-500 opacity-60'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={e => {
                        if (e.target.checked) {
                          setSelectedOfficerIds([...selectedOfficerIds, officer.id]);
                        } else {
                          setSelectedOfficerIds(selectedOfficerIds.filter(id => id !== officer.id));
                        }
                      }}
                      className="rounded border-slate-700 text-militar-600 focus:ring-0"
                    />
                    <span className="truncate" title={officer.name}>{officer.name}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Slot Selector Drawer */}
        {showSlotFilter && (
          <div className="mt-4 p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-300 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber-400" />
                Postos Ativos na Semana {weekNumber}
              </div>
              <div className="flex items-center space-x-2 text-xs">
                <button
                  onClick={() => setEnabledSlotIds(allSlots.map(s => s.id))}
                  className="text-amber-400 hover:underline"
                >
                  Habilitar Todos os Postos
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-48 overflow-y-auto pr-2">
              {allSlots.map(slot => {
                const isChecked = enabledSlotIds.includes(slot.id);
                return (
                  <label
                    key={slot.id}
                    className={`flex items-center space-x-2 p-2 rounded text-xs cursor-pointer border transition-colors ${
                      isChecked 
                        ? 'bg-slate-900 border-slate-700 text-slate-200' 
                        : 'bg-slate-950/40 border-slate-800/60 text-slate-500 opacity-60'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={e => {
                        if (e.target.checked) {
                          setEnabledSlotIds([...enabledSlotIds, slot.id]);
                        } else {
                          setEnabledSlotIds(enabledSlotIds.filter(id => id !== slot.id));
                        }
                      }}
                      className="rounded border-slate-700 text-amber-600 focus:ring-0"
                    />
                    <span className="truncate" title={slot.name}>
                      {slot.name}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

      </div>

      {/* Proposal Summary Bar & Warning */}
      {proposal && (
        <div className="space-y-4">
          
          {/* Unfilled Slots Alert */}
          {proposal.summary?.pendingSlotsCount > 0 && (
            <div className="bg-rose-950/70 border border-rose-700/80 rounded-xl p-4 flex items-start space-x-3 text-rose-200 text-sm">
              <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-rose-100">
                  Atenção: {proposal.summary.pendingSlotsCount} posto(s) não foram preenchidos por falta de oficiais disponíveis ou restrições de escala.
                </div>
                <div className="text-xs text-rose-300 mt-1">
                  O algoritmo preservou as restrições obrigatórias sem forçar atribuições proibidas. Os postos pendentes estão destacados abaixo.
                </div>
              </div>
            </div>
          )}

          {/* Statistics summary badges */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Total de Postos:</span>
                <span className="font-mono font-bold text-white">{proposal.summary.totalSlots}</span>
              </div>
              <span className="text-slate-700 hidden sm:inline">|</span>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Preenchidos:</span>
                <span className="font-mono font-bold text-emerald-400">{proposal.summary.filledSlots}</span>
              </div>
              <span className="text-slate-700 hidden sm:inline">|</span>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Pendentes:</span>
                <span className="font-mono font-bold text-rose-400">{proposal.summary.pendingSlotsCount}</span>
              </div>
              <span className="text-slate-700 hidden sm:inline">|</span>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Sem Escala:</span>
                <span className="font-mono font-bold text-blue-400">{proposal.restingOfficers?.length || 0}</span>
              </div>
              <span className="text-slate-700 hidden sm:inline">|</span>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Fixados:</span>
                <span className="font-mono font-bold text-gold-400">{Object.keys(manualLocks).length}</span>
              </div>
              <span className="text-slate-700 hidden sm:inline">|</span>
              <div className="flex items-center gap-1.5" title="Oficiais que acumulam mais de um posto permitido na semana">
                <span className="text-slate-400">Em Acúmulo:</span>
                <span className="font-mono font-bold text-amber-400">{proposal.summary?.accumulatedOfficersCount || 0}</span>
              </div>
            </div>

            {/* Search */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar posto ou oficial..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-slate-700 w-full"
                />
              </div>
            </div>
          </div>

          {/* Assignments Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredAssignments.map(assignment => {
              const isLocked = !!manualLocks[assignment.slotId];
              const isPending = assignment.status === 'pendente';
              const isPlatoon = assignment.slotType === 'pelotao' || assignment.isCommand;

              return (
                <div
                  key={assignment.slotId}
                  className={`rounded-xl border p-4 transition-all relative ${
                    isPending
                      ? 'bg-rose-950/20 border-rose-800/80'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  
                  {/* Slot Title & Badges */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-white">
                          {assignment.slotName}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <span className="text-slate-400 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-gold-400" />
                          Posto de Serviço
                        </span>
                      </div>
                    </div>

                    {/* Lock Button */}
                    <button
                      onClick={() => handleToggleLock(assignment.slotId, assignment.officerId)}
                      disabled={isPending}
                      className={`p-1.5 rounded-lg border transition-colors ${
                        isLocked
                          ? 'bg-amber-500/20 text-gold-400 border-amber-500/50'
                          : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
                      }`}
                      title={isLocked ? 'Posto fixado. Clique para liberar.' : 'Fixar oficial neste posto para manter em nova geração.'}
                    >
                      {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* Officer Assignment Dropdown / Selector */}
                  <div className="mt-3">
                    <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                      Oficial Designado
                    </label>

                    <select
                      value={assignment.officerId || ''}
                      onChange={e => handleManualReassign(assignment.slotId, e.target.value)}
                      className={`w-full px-2.5 py-2 rounded-lg text-xs font-medium border focus:outline-none transition-colors ${
                        isPending
                          ? 'bg-rose-950 border-rose-700 text-rose-200'
                          : 'bg-slate-950 border-slate-700 text-slate-100'
                      }`}
                    >
                      <option value="">-- Posto Não Preenchido --</option>
                      {activeOfficers.map(officer => {
                        const isMale = (officer.sexo || 'masculino') === 'masculino';
                        const isFemale = officer.sexo === 'feminino';
                        const isThisBathroom = isBathroomSlot(assignment);
                        const slotLower = (assignment.slotName || '').toLowerCase();
                        const isBanheiroFem = slotLower.includes('banheiro feminino');
                        const isBanheiroMasc = slotLower.includes('banheiro masculino');
                        const genderBlocked = isThisBathroom && ((isMale && isBanheiroFem) || (isFemale && isBanheiroMasc));

                        // Check existing duties of this officer in current proposal (other slots)
                        const officerAssignments = proposal.assignments.filter(
                          a => a.officerId === officer.id && a.slotId !== assignment.slotId
                        );
                        const hasPlatoonAssigned = officerAssignments.some(a => a.slotType === 'pelotao' || a.isCommand);
                        const hasBathroomAssigned = officerAssignments.some(a => isBathroomSlot(a));
                        const hasOtherPostAssigned = officerAssignments.some(a => a.slotType === 'posto' && !a.isCommand);

                        let isDisabled = false;
                        let extraTag = '';

                        const thisCanAccumulate = canSlotAccumulate(assignment);
                        const otherPhysicalPost = officerAssignments.find(a => a.slotType === 'posto' && !a.isCommand);
                        const otherPostCanAccumulate = otherPhysicalPost ? canSlotAccumulate(otherPhysicalPost) : false;
                        const hasExpressRestriction = Array.isArray(officer.restrictions) && officer.restrictions.some(
                          r => r === assignment.slotId || r === assignment.slotName || (assignment.baseId && r === assignment.baseId)
                        );

                        if (hasExpressRestriction) {
                          isDisabled = true;
                          extraTag = ' — [IMPEDIDO: RESTRIÇÃO EXPRESSA]';
                        } else if (genderBlocked) {
                          isDisabled = true;
                          extraTag = ' — [IMPEDIDO: GÊNERO]';
                        } else if (!isPlatoon && !thisCanAccumulate && hasPlatoonAssigned) {
                          isDisabled = true;
                          extraTag = ' — [IMPEDIDO: SÓ COZINHA/REFEITÓRIO/FILA ACUMULA]';
                        } else if (isThisBathroom && hasPlatoonAssigned) {
                          isDisabled = true;
                          extraTag = ' — [IMPEDIDO: ACÚMULO NÃO PERMITIDO]';
                        } else if (isPlatoon && hasBathroomAssigned) {
                          isDisabled = true;
                          extraTag = ' — [IMPEDIDO: ESCALADO NO BANHEIRO]';
                        } else if (isPlatoon && otherPhysicalPost && !otherPostCanAccumulate) {
                          extraTag = ` — [Transfere de: ${otherPhysicalPost.slotName}]`;
                        } else if (isPlatoon && otherPhysicalPost && otherPostCanAccumulate) {
                          extraTag = ` — [ACÚMULO c/ ${otherPhysicalPost.slotName}]`;
                        } else if (!isPlatoon && thisCanAccumulate && hasPlatoonAssigned) {
                          const pelName = officerAssignments.find(a => a.slotType === 'pelotao' || a.isCommand)?.slotName;
                          extraTag = ` — [ACÚMULO c/ ${pelName}]`;
                        } else if (isPlatoon && hasPlatoonAssigned) {
                          const pelName = officerAssignments.find(a => a.slotType === 'pelotao' || a.isCommand)?.slotName;
                          extraTag = ` — [Transfere de: ${pelName}]`;
                        } else if (!isPlatoon && hasOtherPostAssigned) {
                          const postName = otherPhysicalPost?.slotName;
                          extraTag = ` — [Transfere de: ${postName}]`;
                        }

                        return (
                          <option 
                            key={officer.id} 
                            value={officer.id}
                            disabled={isDisabled}
                          >
                            {officer.patente ? `${officer.patente} ` : ''}
                            {officer.name} 
                            {isFemale ? ' (Fem.)' : ' (Masc.)'}
                            {extraTag}
                          </option>
                        );
                      })}
                    </select>

                    {/* Accumulation Badge on Assignment Card */}
                    {assignment.isAccumulated && assignment.accumulatedWith && (
                      <div className="mt-2.5 px-2.5 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-[11px] text-gold-300 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-semibold">
                          <Award className="w-3.5 h-3.5 text-gold-400 flex-shrink-0" />
                          <span>Acúmulo Semanal:</span>
                        </div>
                        <span className="text-[10px] text-slate-300 font-medium">
                          Também em: <strong className="text-white">{assignment.accumulatedWith.slotName}</strong>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Officer Metrics Snapshot (Transparency on why chosen) */}
                  {assignment.officerId && assignment.metricsSnapshot && (
                    <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span title="Total de escalas prévias">Escalas: {assignment.metricsSnapshot.totalDuties}</span>
                      <span title="Semanas sem escala">Sem escala: {assignment.metricsSnapshot.weeksSinceLastDuty} sem</span>
                    </div>
                  )}

                  {/* Warning on pending */}
                  {isPending && (
                    <div className="mt-2 text-[11px] text-rose-400 font-medium">
                      {assignment.warning || 'Sem candidatos elegíveis disponíveis'}
                    </div>
                  )}

                </div>
              );
            })}
          </div>

          {/* Resting Officers Section */}
          {proposal.restingOfficers && proposal.restingOfficers.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-3">
                <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-400" />
                  Sem Escala ({proposal.restingOfficers.length})
                </h3>
                <span className="text-xs text-slate-400">
                  Oficiais ativos não escalados nesta rotação
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
                {proposal.restingOfficers.map(officer => (
                  <div
                    key={officer.id}
                    className="p-2 rounded-lg bg-slate-950/60 border border-slate-800 flex flex-col justify-between"
                  >
                    <div className="font-medium text-slate-300 truncate" title={officer.name}>
                      {officer.name}
                    </div>
                    <div className="text-[10px] font-mono text-slate-500 mt-1 flex justify-between">
                      <span className="text-gold-400 font-semibold">{officer.patente || 'CFOM'}</span>
                      <span>{officer.totalDuties} esc.</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-gold-400">
              <ShieldCheck className="w-6 h-6" />
              <h3 className="text-lg font-bold text-white">Confirmar Escala Definitiva</h3>
            </div>

            {overwriteWarning ? (
              <div className="p-3 rounded-lg bg-amber-950/70 border border-amber-700 text-amber-200 text-xs">
                <div className="font-bold flex items-center gap-1.5 mb-1">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  Escala já existe no histórico!
                </div>
                A Semana {weekNumber} já possui uma escala salva anteriormente. Deseja sobrescrever os dados definitivos desta semana?
              </div>
            ) : (
              <p className="text-sm text-slate-300 leading-relaxed">
                Você está prestes a salvar a <strong className="text-white">Semana {weekNumber}</strong> com{' '}
                <strong className="text-emerald-400">{proposal?.summary?.filledSlots || 0} atribuições</strong>. 
                Os dados serão gravados no histórico permanente e utilizados para cálculo das próximas semanas.
              </p>
            )}

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setConfirmModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleExecuteSave(overwriteWarning)}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Gravando...' : overwriteWarning ? 'Sobrescrever e Gravar' : 'Confirmar e Gravar'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
