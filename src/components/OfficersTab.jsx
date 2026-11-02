import React, { useState } from 'react';
import { 
  Users, 
  UserPlus, 
  Upload, 
  Search, 
  Edit2, 
  CheckCircle, 
  XCircle, 
  ShieldAlert, 
  Trash2, 
  Filter,
  Check,
  X,
  Award,
  Calendar,
  Sparkles,
  ChevronUp,
  FileText,
  Download,
  Printer,
  FileEdit,
  Clock,
  BookOpen
} from 'lucide-react';
import { createOfficer, updateOfficer, deleteOfficer, bulkImportOfficers, clearAllOfficers } from '../api';
import { exportOfficersToTxt, downloadFile } from '../utils/exportUtils';

export const PATENTES_LIST = [
  'CFOM',
  '2º Tenente Mirim',
  '1º Tenente Mirim',
  'Capitão Mirim',
  'Major Mirim',
  'Tenente-Coronel Mirim',
  'Coronel Mirim'
];

export default function OfficersTab({ 
  officers = [], 
  physicalPosts = [], 
  platoons = [], 
  schedules = [],
  stats = {},
  onOfficersUpdated 
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos'); // 'todos', 'ativo', 'inativo'
  const [sexoFilter, setSexoFilter] = useState('todos'); // 'todos', 'masculino', 'feminino'

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [editingOfficer, setEditingOfficer] = useState(null);
  const [officerToDelete, setOfficerToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Officer Detail & History & Notes Modal
  const [selectedOfficerDetail, setSelectedOfficerDetail] = useState(null);
  const [officerNotes, setOfficerNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSuccess, setNotesSuccess] = useState(false);

  // Print / PDF Officers Modal
  const [isPrintOfficersOpen, setIsPrintOfficersOpen] = useState(false);

  // Form states for Add/Edit
  const [formData, setFormData] = useState({
    patente: 'CFOM',
    sexo: 'masculino',
    name: '',
    status: 'ativo',
    restrictions: []
  });

  // Bulk input state
  const [bulkNamesText, setBulkNamesText] = useState('');
  const [defaultBulkPatente, setDefaultBulkPatente] = useState('CFOM');
  const [defaultBulkSexo, setDefaultBulkSexo] = useState('masculino');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [clearLoading, setClearLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [promotionMsg, setPromotionMsg] = useState('');

  const allAvailableSlots = [...physicalPosts, ...platoons];

  // Officer stats lookup
  const officerStatsMap = new Map((stats.officerStats || []).map(s => [s.id, s]));

  // Open modal to add
  const handleOpenAdd = () => {
    setFormData({
      patente: 'CFOM',
      sexo: 'masculino',
      name: '',
      status: 'ativo',
      restrictions: []
    });
    setEditingOfficer(null);
    setFormError('');
    setIsAddModalOpen(true);
  };

  // Open modal to edit
  const handleOpenEdit = (officer) => {
    setFormData({
      patente: officer.patente || 'CFOM',
      sexo: officer.sexo || 'masculino',
      name: officer.name,
      status: officer.status || 'ativo',
      restrictions: Array.isArray(officer.restrictions) ? officer.restrictions : []
    });
    setEditingOfficer(officer);
    setFormError('');
    setIsAddModalOpen(true);
  };

  // Submit Add or Edit
  const handleSubmitOfficer = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('O nome do oficial é obrigatório');
      return;
    }

    try {
      if (editingOfficer) {
        await updateOfficer(editingOfficer.id, formData);
      } else {
        await createOfficer(formData);
      }
      setIsAddModalOpen(false);
      if (onOfficersUpdated) onOfficersUpdated();
    } catch (err) {
      setFormError(err.message || 'Erro ao salvar oficial');
    }
  };

  // Toggle status active / inactive
  const handleToggleStatus = async (officer) => {
    try {
      const nextStatus = officer.status === 'ativo' ? 'inativo' : 'ativo';
      await updateOfficer(officer.id, { status: nextStatus });
      if (onOfficersUpdated) onOfficersUpdated();
    } catch (err) {
      console.error(err);
    }
  };

  // Promote officer to next rank in PATENTES_LIST
  const handlePromoteOfficer = async (officer) => {
    const currentPatente = officer.patente || 'CFOM';
    const currentIdx = PATENTES_LIST.indexOf(currentPatente);
    if (currentIdx !== -1 && currentIdx < PATENTES_LIST.length - 1) {
      const nextPatente = PATENTES_LIST[currentIdx + 1];
      try {
        await updateOfficer(officer.id, { patente: nextPatente });
        setPromotionMsg(`Oficial ${officer.name} promovido(a) para ${nextPatente}! 🎖️`);
        setTimeout(() => setPromotionMsg(''), 3500);
        if (onOfficersUpdated) onOfficersUpdated();
      } catch (err) {
        console.error('Erro ao promover oficial:', err);
      }
    }
  };

  // Delete single officer
  const handleConfirmDelete = async () => {
    if (!officerToDelete) return;
    try {
      setDeleteLoading(true);
      await deleteOfficer(officerToDelete.id);
      setPromotionMsg(`Oficial ${officerToDelete.name} excluído(a) com sucesso.`);
      setTimeout(() => setPromotionMsg(''), 3500);
      setOfficerToDelete(null);
      if (onOfficersUpdated) onOfficersUpdated();
    } catch (err) {
      setFormError(err.message || 'Erro ao excluir oficial');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Bulk import submit
  const handleBulkSubmit = async () => {
    const lines = bulkNamesText
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    if (lines.length === 0) {
      setFormError('Cole pelo menos um nome para importar');
      return;
    }

    try {
      setBulkLoading(true);
      await bulkImportOfficers(lines, defaultBulkPatente, defaultBulkSexo);
      setIsBulkModalOpen(false);
      setBulkNamesText('');
      if (onOfficersUpdated) onOfficersUpdated();
    } catch (err) {
      setFormError(err.message || 'Erro na importação em lote');
    } finally {
      setBulkLoading(false);
    }
  };

  // Clear all officers handler
  const handleClearAllOfficers = async () => {
    try {
      setClearLoading(true);
      await clearAllOfficers();
      setClearConfirmOpen(false);
      if (onOfficersUpdated) onOfficersUpdated();
    } catch (err) {
      setFormError(err.message || 'Erro ao limpar banco de oficiais');
    } finally {
      setClearLoading(false);
    }
  };

  // Filter officers
  const filteredOfficers = officers.filter(o => {
    if (statusFilter !== 'todos' && o.status !== statusFilter) return false;
    if (sexoFilter !== 'todos' && (o.sexo || 'masculino') !== sexoFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchName = o.name.toLowerCase().includes(term);
      const matchPatente = o.patente ? o.patente.toLowerCase().includes(term) : false;
      return matchName || matchPatente;
    }
    return true;
  });

  const getPatenteBadgeStyle = (patente) => {
    if (!patente) return 'bg-slate-800 text-slate-300 border-slate-700';
    if (patente.includes('Coronel') || patente.includes('Major')) {
      return 'bg-amber-950/80 border-amber-600/70 text-gold-300';
    }
    if (patente.includes('Capitão') || patente.includes('Tenente')) {
      return 'bg-blue-950/80 border-blue-600/70 text-blue-300';
    }
    return 'bg-purple-950/80 border-purple-600/70 text-purple-300';
  };

  // Export handlers
  const handleExportTxt = () => {
    const content = exportOfficersToTxt(officers, stats);
    downloadFile('oficiais_sistema_escalas.txt', content);
  };

  const handleExportJson = () => {
    const content = JSON.stringify(officers, null, 2);
    downloadFile('oficiais_sistema_escalas.json', content, 'application/json');
  };

  const handleExportPdf = () => {
    setIsPrintOfficersOpen(true);
  };

  // Open Officer Details & History & Notes Modal
  const handleOpenOfficerDetail = (officer) => {
    setSelectedOfficerDetail(officer);
    setOfficerNotes(officer.observacoes || '');
    setNotesSuccess(false);
  };

  const handleSaveNotes = async () => {
    if (!selectedOfficerDetail) return;
    try {
      setSavingNotes(true);
      await updateOfficer(selectedOfficerDetail.id, {
        ...selectedOfficerDetail,
        observacoes: officerNotes
      });
      setNotesSuccess(true);
      setSelectedOfficerDetail(prev => prev ? { ...prev, observacoes: officerNotes } : null);
      if (onOfficersUpdated) onOfficersUpdated();
      setTimeout(() => setNotesSuccess(false), 2500);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingNotes(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            Corpo de Oficiais
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Gerencie o cadastro, visualize o histórico de escalas e registre observações de cada oficial.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Export Options */}
          {officers.length > 0 && (
            <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <span className="text-[11px] text-slate-400 px-2 font-medium">Exportar:</span>
              <button
                onClick={handleExportPdf}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1 transition-colors"
                title="Visualizar para Imprimir ou Salvar em PDF"
              >
                <Printer className="w-3.5 h-3.5 text-emerald-400" />
                <span>PDF</span>
              </button>
              <button
                onClick={handleExportTxt}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1 transition-colors"
                title="Baixar lista de oficiais em arquivo TXT"
              >
                <FileText className="w-3.5 h-3.5 text-sky-400" />
                <span>TXT</span>
              </button>
              <button
                onClick={handleExportJson}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1 transition-colors"
                title="Baixar lista de oficiais em arquivo JSON"
              >
                <Download className="w-3.5 h-3.5 text-amber-400" />
                <span>JSON</span>
              </button>
            </div>
          )}

          {officers.length > 0 && (
            <button
              onClick={() => setClearConfirmOpen(true)}
              className="px-3 py-2 rounded-lg bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 text-xs font-semibold border border-rose-800/60 flex items-center gap-1.5 transition-colors"
              title="Limpar todos os oficiais cadastrados"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Limpar Oficiais</span>
            </button>
          )}

          <button
            onClick={() => { setFormError(''); setIsBulkModalOpen(true); }}
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center gap-2 transition-colors"
          >
            <Upload className="w-4 h-4 text-slate-400" />
            <span>Importar em Lote</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 rounded-lg bg-militar-600 hover:bg-militar-500 text-white text-xs font-semibold shadow-md flex items-center gap-2 transition-colors active:scale-95"
          >
            <UserPlus className="w-4 h-4" />
            <span>Novo Oficial</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Buscar oficial por nome ou patente..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs sm:text-sm text-white focus:outline-none focus:border-slate-700"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-400 font-medium">Situação:</span>
            <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800">
              <button
                onClick={() => setStatusFilter('todos')}
                className={`px-2.5 py-1 rounded-md transition-colors ${statusFilter === 'todos' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400 hover:text-white'}`}
              >
                Todos ({officers.length})
              </button>
              <button
                onClick={() => setStatusFilter('ativo')}
                className={`px-2.5 py-1 rounded-md transition-colors ${statusFilter === 'ativo' ? 'bg-emerald-900/60 text-emerald-200 font-medium' : 'text-slate-400 hover:text-white'}`}
              >
                Ativos ({officers.filter(o => o.status === 'ativo').length})
              </button>
              <button
                onClick={() => setStatusFilter('inativo')}
                className={`px-2.5 py-1 rounded-md transition-colors ${statusFilter === 'inativo' ? 'bg-slate-800 text-slate-300 font-medium' : 'text-slate-400 hover:text-white'}`}
              >
                Inativos ({officers.filter(o => o.status === 'inativo').length})
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            <span className="text-slate-400 font-medium">Gênero:</span>
            <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800">
              <button
                onClick={() => setSexoFilter('todos')}
                className={`px-2.5 py-1 rounded-md transition-colors ${sexoFilter === 'todos' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400 hover:text-white'}`}
              >
                Todos
              </button>
              <button
                onClick={() => setSexoFilter('masculino')}
                className={`px-2.5 py-1 rounded-md transition-colors ${sexoFilter === 'masculino' ? 'bg-sky-950 text-sky-200 border border-sky-800 font-medium' : 'text-slate-400 hover:text-white'}`}
              >
                Masculino ({officers.filter(o => (o.sexo || 'masculino') === 'masculino').length})
              </button>
              <button
                onClick={() => setSexoFilter('feminino')}
                className={`px-2.5 py-1 rounded-md transition-colors ${sexoFilter === 'feminino' ? 'bg-rose-950 text-rose-200 border border-rose-800 font-medium' : 'text-slate-400 hover:text-white'}`}
              >
                Feminino ({officers.filter(o => o.sexo === 'feminino').length})
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Promotion success banner */}
      {promotionMsg && (
        <div className="p-3 rounded-lg bg-emerald-950/80 border border-emerald-700/60 text-emerald-200 text-xs flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2 font-medium">
            <Award className="w-4 h-4 text-gold-400 flex-shrink-0" />
            <span>{promotionMsg}</span>
          </div>
          <button onClick={() => setPromotionMsg('')} className="text-emerald-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Officers Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-3 sm:px-4">Patente</th>
                <th className="py-3 px-3 sm:px-4">Nome do Oficial</th>
                <th className="py-3 px-3 sm:px-4 hidden sm:table-cell">Gênero</th>
                <th className="py-3 px-3 sm:px-4">Situação</th>
                <th className="py-3 px-3 sm:px-4 hidden md:table-cell">Restrições de Posto</th>
                <th className="py-3 px-3 sm:px-4 text-center">Escalas</th>
                <th className="py-3 px-3 sm:px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredOfficers.map(officer => {
                const offStat = officerStatsMap.get(officer.id) || {
                  totalDuties: 0,
                  totalCommands: 0,
                  weeksWithoutDuty: 0
                };
                const hasRestrictions = officer.restrictions && officer.restrictions.length > 0;
                const isFemale = officer.sexo === 'feminino';

                return (
                  <tr key={officer.id} className="hover:bg-slate-800/40 transition-colors">
                    
                    {/* Patente Badge */}
                    <td className="py-3 px-3 sm:px-4 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${getPatenteBadgeStyle(officer.patente)}`}>
                        {officer.patente || 'CFOM'}
                      </span>
                    </td>

                    {/* Full Name with click to open detail/history/notes modal */}
                    <td className="py-3 px-3 sm:px-4">
                      <button
                        onClick={() => handleOpenOfficerDetail(officer)}
                        className="text-left font-semibold text-white hover:text-gold-300 transition-colors flex items-center gap-2 group cursor-pointer"
                        title="Clique no nome para abrir o histórico completo de escalas e observações"
                      >
                        <span className="underline decoration-slate-700 group-hover:decoration-gold-400 underline-offset-2">
                          {officer.name}
                        </span>
                        {officer.observacoes && officer.observacoes.trim() && (
                          <span 
                            className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-gold-400 border border-amber-500/40 font-mono font-medium flex items-center gap-1"
                            title={`Observação: ${officer.observacoes}`}
                          >
                            <FileEdit className="w-2.5 h-2.5" />
                            Obs
                          </span>
                        )}
                      </button>
                    </td>

                    {/* Sexo Badge */}
                    <td className="py-3 px-3 sm:px-4 hidden sm:table-cell">
                      {isFemale ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-950/80 border border-rose-700/60 text-rose-300">
                          Feminino
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-950/80 border border-sky-700/60 text-sky-300">
                          Masculino
                        </span>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-3 sm:px-4">
                      <button
                        onClick={() => handleToggleStatus(officer)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                          officer.status === 'ativo'
                            ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300 hover:bg-emerald-900/60'
                            : 'bg-slate-950 border-slate-700 text-slate-400 hover:bg-slate-800'
                        }`}
                        title="Clique para alternar situação (preserva histórico)"
                      >
                        {officer.status === 'ativo' ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Ativo
                          </>
                        ) : (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                            Inativo
                          </>
                        )}
                      </button>
                    </td>

                    {/* Restrictions & Gender Rules */}
                    <td className="py-3 px-3 sm:px-4 hidden md:table-cell">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {isFemale ? (
                          <span className="px-1.5 py-0.5 rounded bg-rose-950/90 border border-rose-800 text-[10px] text-rose-200 font-medium" title="Impedimento: Banheiro Masculino">
                            Imped.: Banheiro Masc.
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-sky-950/90 border border-sky-800 text-[10px] text-sky-200 font-medium" title="Impedimento: Banheiro Feminino">
                            Imped.: Banheiro Fem.
                          </span>
                        )}

                        {/* Restrições Manuais Expressas */}
                        {hasRestrictions && officer.restrictions.map((r, i) => {
                          const slot = allAvailableSlots.find(s => s.id === r);
                          return (
                            <span
                              key={i}
                              className="px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-800/80 text-[10px] text-amber-300"
                            >
                              Imped.: {slot ? slot.name : r}
                            </span>
                          );
                        })}
                      </div>
                    </td>

                    {/* Duties count */}
                    <td className="py-3 px-3 sm:px-4 text-center font-mono font-medium text-slate-200">
                      {offStat.totalDuties}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3 sm:px-4 text-right whitespace-nowrap">
                      {(() => {
                        const currentPatenteIndex = PATENTES_LIST.indexOf(officer.patente || 'CFOM');
                        const canPromote = currentPatenteIndex !== -1 && currentPatenteIndex < PATENTES_LIST.length - 1;
                        const nextPatente = canPromote ? PATENTES_LIST[currentPatenteIndex + 1] : null;

                        return (
                          <div className="flex items-center justify-end space-x-1.5">
                            {/* Botão Subir de Patente */}
                            <button
                              onClick={() => handlePromoteOfficer(officer)}
                              disabled={!canPromote}
                              className={`p-1.5 rounded-lg border transition-all flex items-center justify-center ${
                                canPromote
                                  ? 'bg-emerald-950/70 border-emerald-700/60 hover:bg-emerald-800 text-emerald-300 hover:text-white shadow-sm hover:scale-105 active:scale-95'
                                  : 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed opacity-40'
                              }`}
                              title={canPromote ? `Subir de patente: promover para ${nextPatente}` : 'Patente máxima atingida (Coronel Mirim)'}
                            >
                              <ChevronUp className="w-3.5 h-3.5 stroke-[2.5]" />
                            </button>

                            {/* Editar oficial */}
                            <button
                              onClick={() => handleOpenEdit(officer)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                              title="Editar oficial"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Excluir oficial */}
                            <button
                              onClick={() => setOfficerToDelete(officer)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/80 text-slate-400 hover:text-rose-400 hover:border-rose-700/60 border border-transparent transition-colors"
                              title="Excluir oficial do cadastro"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })()}
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredOfficers.length === 0 && (
          <div className="py-14 text-center text-slate-400 text-xs space-y-2">
            <Users className="w-8 h-8 text-slate-600 mx-auto" />
            <div className="font-semibold text-slate-300">
              {officers.length === 0 
                ? 'Banco de oficiais limpo (nenhum oficial cadastrado).' 
                : 'Nenhum oficial encontrado com os filtros atuais.'}
            </div>
            <div className="text-slate-500 max-w-sm mx-auto text-[11px]">
              {officers.length === 0 
                ? 'Cadastre novos oficiais clicando em "+ Novo Oficial" ou importe vários nomes de uma vez clicando em "Importar em Lote".'
                : 'Tente alterar os termos da busca ou os filtros de situação.'}
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Officer Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-militar-400" />
                {editingOfficer ? 'Editar Oficial' : 'Cadastrar Novo Oficial'}
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-700 text-rose-200 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmitOfficer} className="space-y-4 text-xs">
              
              {/* Patente Selector */}
              <div>
                <label className="block text-slate-400 font-semibold mb-1 uppercase tracking-wider">
                  Patente / Posto
                </label>
                <select
                  value={formData.patente}
                  onChange={e => setFormData({ ...formData, patente: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-medium text-sm focus:border-militar-500 focus:outline-none"
                >
                  {PATENTES_LIST.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {/* Nome do Oficial */}
              <div>
                <label className="block text-slate-400 font-semibold mb-1 uppercase tracking-wider">
                  Nome Completo
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Lucas Morais"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:border-militar-500 focus:outline-none font-medium"
                />
              </div>

              {/* Sexo / Gênero Selector */}
              <div>
                <label className="block text-slate-400 font-semibold mb-1 uppercase tracking-wider">
                  Gênero
                </label>
                <select
                  value={formData.sexo || 'masculino'}
                  onChange={e => setFormData({ ...formData, sexo: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-medium text-sm focus:border-militar-500 focus:outline-none"
                >
                  <option value="masculino">Masculino (Impedido em Banheiro Feminino)</option>
                  <option value="feminino">Feminino (Impedida em Banheiro Masculino)</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Define automaticamente a compatibilidade para os postos de fiscalização de banheiros.
                </p>
              </div>

              {/* Situação */}
              <div>
                <label className="block text-slate-400 font-semibold mb-1 uppercase tracking-wider">
                  Situação
                </label>
                <select
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:border-militar-500 focus:outline-none"
                >
                  <option value="ativo">Ativo (Participa das escalas)</option>
                  <option value="inativo">Inativo (Dispensado / Histórico preservado)</option>
                </select>
              </div>

              {/* Restrictions Multi-select */}
              <div>
                <label className="block text-slate-400 font-semibold mb-1 uppercase tracking-wider">
                  Restrições Expressas de Posto (Impedimentos)
                </label>
                <p className="text-slate-500 text-[11px] mb-2">
                  Selecione os postos para os quais este oficial possui impedimento formal de escalação.
                </p>
                
                <div className="max-h-40 overflow-y-auto border border-slate-800 rounded-lg p-2 bg-slate-950 space-y-1">
                  {allAvailableSlots.map(slot => {
                    const isRestricted = formData.restrictions.includes(slot.id);
                    return (
                      <label
                        key={slot.id}
                        className={`flex items-center space-x-2 p-1.5 rounded cursor-pointer transition-colors ${
                          isRestricted 
                            ? 'bg-rose-950/60 text-rose-300 font-semibold' 
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isRestricted}
                          onChange={e => {
                            if (e.target.checked) {
                              setFormData({
                                ...formData,
                                restrictions: [...formData.restrictions, slot.id]
                              });
                            } else {
                              setFormData({
                                ...formData,
                                restrictions: formData.restrictions.filter(r => r !== slot.id)
                              });
                            }
                          }}
                          className="rounded border-slate-700 text-rose-600 focus:ring-0"
                        />
                        <span>{slot.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-militar-600 hover:bg-militar-500 text-white font-bold transition-all shadow-md"
                >
                  {editingOfficer ? 'Salvar Alterações' : 'Cadastrar Oficial'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Upload className="w-5 h-5 text-militar-400" />
                Importar Oficiais em Lote
              </h3>
              <button
                onClick={() => setIsBulkModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-700 text-rose-200 text-xs">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
              <div>
                <label className="block text-slate-400 font-semibold mb-1 uppercase tracking-wider text-xs">
                  Patente Padrão
                </label>
                <select
                  value={defaultBulkPatente}
                  onChange={e => setDefaultBulkPatente(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-medium text-xs focus:border-militar-500 focus:outline-none"
                >
                  {PATENTES_LIST.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1 uppercase tracking-wider text-xs">
                  Gênero Padrão
                </label>
                <select
                  value={defaultBulkSexo}
                  onChange={e => setDefaultBulkSexo(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-medium text-xs focus:border-militar-500 focus:outline-none"
                >
                  <option value="masculino">Masculino</option>
                  <option value="feminino">Feminino</option>
                </select>
              </div>
            </div>

            <p className="text-xs text-slate-300">
              Informe a relação de nomes abaixo (um por linha). Patentes no início da linha ou indicadores de gênero ao final (ex: <em>(F)</em> ou <em>(M)</em>) são identificados automaticamente.
            </p>

            <textarea
              rows={8}
              value={bulkNamesText}
              onChange={e => setBulkNamesText(e.target.value)}
              placeholder="Capitão Mirim Marcos Souza&#10;CFOM Juliana Prado&#10;Fernando Ramos"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-xs focus:border-militar-500 focus:outline-none"
            />

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsBulkModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleBulkSubmit}
                disabled={bulkLoading}
                className="px-4 py-2 rounded-lg bg-militar-600 hover:bg-militar-500 text-white text-xs font-bold transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                <span>{bulkLoading ? 'Importando...' : 'Importar Todos'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Single Officer Confirmation Modal */}
      {officerToDelete && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-rose-400">
              <Trash2 className="w-6 h-6" />
              <h3 className="text-base font-bold text-white">Excluir Oficial</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Deseja realmente excluir o oficial <strong className="text-white">{officerToDelete.patente || 'CFOM'} {officerToDelete.name}</strong>?
              O cadastro deste oficial será removido.
            </p>
            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setOfficerToDelete(null)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteLoading}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deleteLoading ? 'Excluindo...' : 'Sim, Excluir'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Officers Confirmation Modal */}
      {clearConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-rose-400">
              <Trash2 className="w-6 h-6" />
              <h3 className="text-lg font-bold text-white">Limpar Banco de Oficiais?</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Esta ação removerá todos os oficiais atualmente cadastrados do banco de dados, permitindo que você cadastre os oficiais reais do zero. Um backup de segurança será salvo automaticamente antes da exclusão.
            </p>
            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setClearConfirmOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleClearAllOfficers}
                disabled={clearLoading}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-md flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>{clearLoading ? 'Limpando...' : 'Sim, Limpar Todos'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Officer Detail & History & Notes Modal */}
      {selectedOfficerDetail && (() => {
        const offStat = officerStatsMap.get(selectedOfficerDetail.id) || {
          totalDuties: 0,
          totalCommands: 0,
          weeksSinceLastDuty: 0
        };

        // Extract duty history for this officer across all confirmed weeks
        const officerHistory = [];
        (schedules || []).forEach(schedule => {
          const assignments = (schedule.assignments || []).filter(a => a.officerId === selectedOfficerDetail.id);
          const isResting = (schedule.restingOfficers || []).some(r => r.id === selectedOfficerDetail.id);

          if (assignments.length > 0) {
            assignments.forEach(a => {
              officerHistory.push({
                weekNumber: schedule.weekNumber,
                weekTitle: schedule.title || `Semana ${schedule.weekNumber}`,
                confirmedAt: schedule.confirmedAt,
                type: 'servico',
                slotName: a.slotName,
                slotType: a.slotType,
                isCommand: a.isCommand,
                isAccumulated: a.isAccumulated,
                accumulatedWith: a.accumulatedWith
              });
            });
          } else if (isResting) {
            officerHistory.push({
              weekNumber: schedule.weekNumber,
              weekTitle: schedule.title || `Semana ${schedule.weekNumber}`,
              confirmedAt: schedule.confirmedAt,
              type: 'folga',
              slotName: 'Dispensa',
              slotType: 'descanso'
            });
          }
        });

        // Sort descending by weekNumber
        officerHistory.sort((a, b) => b.weekNumber - a.weekNumber);

        return (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="flex items-start justify-between pb-4 border-b border-slate-800">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getPatenteBadgeStyle(selectedOfficerDetail.patente)}`}>
                      {selectedOfficerDetail.patente || 'CFOM'}
                    </span>
                    <h3 className="text-lg font-bold text-white">
                      {selectedOfficerDetail.name}
                    </h3>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span>
                      {selectedOfficerDetail.sexo === 'feminino' ? 'Feminino' : 'Masculino'}
                    </span>
                    <span>•</span>
                    <span className={selectedOfficerDetail.status === 'ativo' ? 'text-emerald-400' : 'text-slate-500'}>
                      {selectedOfficerDetail.status === 'ativo' ? '● Em Atividade' : '○ Inativo / Dispensado'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedOfficerDetail(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Stats Summary Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-center">
                  <div className="text-[11px] text-slate-400 font-medium">Total de Escalas</div>
                  <div className="text-xl font-bold font-mono text-white mt-1">
                    {offStat.totalDuties}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-center">
                  <div className="text-[11px] text-slate-400 font-medium">Semanas s/ Escala</div>
                  <div className="text-xl font-bold font-mono text-sky-400 mt-1">
                    {offStat.weeksSinceLastDuty || 0}
                  </div>
                </div>
              </div>

              {/* Observações Section */}
              <div className="space-y-2 bg-slate-950/80 border border-slate-800 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <FileEdit className="w-4 h-4 text-amber-400" />
                    Observações e Notas do Oficial
                  </label>
                  {notesSuccess && (
                    <span className="text-[11px] font-medium text-emerald-400 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      Observações salvas.
                    </span>
                  )}
                </div>

                <textarea
                  rows={3}
                  value={officerNotes}
                  onChange={e => setOfficerNotes(e.target.value)}
                  placeholder="Registre observações, atestados, dispensas temporárias ou orientações formais sobre este oficial..."
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs placeholder-slate-500 focus:outline-none focus:border-militar-500 resize-none font-medium"
                />

                <div className="flex justify-end pt-1">
                  <button
                    onClick={handleSaveNotes}
                    disabled={savingNotes}
                    className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <FileEdit className="w-3.5 h-3.5" />
                    <span>{savingNotes ? 'Salvando...' : 'Salvar Observações'}</span>
                  </button>
                </div>
              </div>

              {/* Histórico Completo de Escalas */}
              <div className="space-y-2">
                <div className="flex items-center justify-between pb-1">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-blue-400" />
                    Histórico Completo de Escalas ({officerHistory.length})
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    Todas as semanas confirmadas
                  </span>
                </div>

                {officerHistory.length === 0 ? (
                  <div className="p-6 text-center rounded-lg bg-slate-950 border border-slate-800 text-slate-400 text-xs">
                    <Calendar className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    Nenhuma escala confirmada para este oficial até o momento.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {officerHistory.map((item, idx) => (
                      <div
                        key={idx}
                        className={`p-2.5 rounded-lg border flex items-center justify-between text-xs transition-colors ${
                          item.type === 'folga'
                            ? 'bg-slate-950/40 border-slate-800/60 text-slate-400'
                            : 'bg-slate-950/80 border-slate-800 text-slate-200'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">
                              Semana {item.weekNumber}
                            </span>
                            {item.confirmedAt && (
                              <span className="text-[10px] text-slate-500">
                                ({new Date(item.confirmedAt).toLocaleDateString('pt-BR')})
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className={item.type === 'folga' ? 'text-slate-400' : 'text-slate-300 font-medium'}>
                              {item.slotName}
                            </span>
                            {item.isAccumulated && item.accumulatedWith && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950 border border-amber-700/60 text-gold-300 font-medium">
                                Acúmulo: {item.accumulatedWith.slotName}
                              </span>
                            )}
                          </div>
                        </div>

                        <div>
                          {item.type === 'folga' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400">
                              Dispensa
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-950 border border-blue-800 text-blue-300">
                              Posto
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Close Button */}
              <div className="pt-2 border-t border-slate-800 flex justify-end">
                <button
                  onClick={() => setSelectedOfficerDetail(null)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
                >
                  Fechar Detalhes
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Printable Officers Modal (PDF / Print View) */}
      {isPrintOfficersOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 flex flex-col items-center justify-start p-4 sm:p-6 overflow-y-auto">
          {/* Top Bar Actions (No-print) */}
          <div className="no-print w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-xl p-4 mb-4 flex items-center justify-between shadow-xl">
            <div className="flex items-center gap-2 text-white font-bold text-sm">
              <Printer className="w-4 h-4 text-emerald-400" />
              <span>Relação de Oficiais para Impressão / Salvar em PDF</span>
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
                onClick={() => setIsPrintOfficersOpen(false)}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>

          {/* Printable Sheet */}
          <div className="w-full max-w-4xl bg-white text-slate-900 p-8 rounded-lg shadow-2xl print:p-0 print:shadow-none print:max-w-none">
            {/* Header */}
            <div className="text-center pb-4 border-b-2 border-slate-800 mb-6">
              <div className="text-xs uppercase tracking-widest font-semibold text-slate-600">
                SISTEMA DE ESCALAS
              </div>
              <h1 className="text-xl sm:text-2xl font-bold uppercase tracking-wide text-slate-950 mt-1">
                Relação Nominal de Oficiais
              </h1>
              <div className="text-xs text-slate-600 mt-1">
                Data de Emissão: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')} • Total: {officers.length} oficiais ({officers.filter(o => o.status === 'ativo').length} ativos)
              </div>
            </div>

            {/* Table */}
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-800 text-slate-900 uppercase text-[10px] tracking-wider font-bold">
                  <th className="py-2 px-2 w-10 text-center">Nº</th>
                  <th className="py-2 px-3">Patente</th>
                  <th className="py-2 px-3">Nome Completo</th>
                  <th className="py-2 px-2 text-center">Gênero</th>
                  <th className="py-2 px-2 text-center">Situação</th>
                  <th className="py-2 px-2 text-center">Escalas</th>
                  <th className="py-2 px-3">Observações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300">
                {officers.map((officer, idx) => {
                  const offStat = officerStatsMap.get(officer.id) || { totalDuties: 0 };
                  return (
                    <tr key={officer.id} className="text-slate-800">
                      <td className="py-2 px-2 text-center font-mono font-medium text-slate-500">
                        {(idx + 1).toString().padStart(2, '0')}
                      </td>
                      <td className="py-2 px-3 font-semibold text-slate-900">
                        {officer.patente || 'CFOM'}
                      </td>
                      <td className="py-2 px-3 font-bold text-slate-950">
                        {officer.name}
                      </td>
                      <td className="py-2 px-2 text-center">
                        {officer.sexo === 'feminino' ? 'Fem' : 'Masc'}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          officer.status === 'ativo' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {officer.status === 'ativo' ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-center font-mono font-bold">
                        {offStat.totalDuties}
                      </td>
                      <td className="py-2 px-3 text-[11px] text-slate-600 italic">
                        {officer.observacoes || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Footer */}
            <div className="mt-8 pt-4 border-t border-slate-300 text-center text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
              Sistema de Escalas por Bueno
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
