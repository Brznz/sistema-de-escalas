import React, { useState } from 'react';
import { 
  MapPin, 
  Award, 
  Plus, 
  Trash2, 
  Edit2, 
  RotateCcw, 
  Check, 
  X, 
  AlertTriangle 
} from 'lucide-react';
import { updatePhysicalPosts, updatePlatoons, resetSlotsDefault } from '../api';

export default function SlotsTab({ 
  physicalPosts = [], 
  platoons = [], 
  onSlotsUpdated 
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState('posto'); // 'posto' or 'pelotao'
  const [editingItem, setEditingItem] = useState(null);
  const [itemName, setItemName] = useState('');
  const [itemBaseId, setItemBaseId] = useState('');
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  const allSlots = [
    ...physicalPosts.map(p => ({ ...p, _category: 'posto' })),
    ...platoons.map(p => ({ ...p, _category: 'pelotao' }))
  ];

  // Open modal to add or edit
  const handleOpenModal = (type = 'posto', item = null) => {
    setModalType(type);
    setEditingItem(item);
    setItemName(item ? item.name : '');
    setItemBaseId(item ? item.baseId || '' : '');
    setIsModalOpen(true);
  };

  // Submit Add or Edit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!itemName.trim()) return;

    if (modalType === 'posto') {
      let updatedPosts = [...physicalPosts];
      if (editingItem) {
        updatedPosts = updatedPosts.map(p => 
          p.id === editingItem.id ? { ...p, name: itemName.trim(), baseId: itemBaseId.trim() || undefined } : p
        );
      } else {
        const newId = `posto_${Date.now()}`;
        updatedPosts.push({
          id: newId,
          name: itemName.trim(),
          type: 'posto',
          baseId: itemBaseId.trim() || undefined,
          enabled: true
        });
      }
      await updatePhysicalPosts(updatedPosts);
    } else {
      let updatedPlatoons = [...platoons];
      if (editingItem) {
        updatedPlatoons = updatedPlatoons.map(p => 
          p.id === editingItem.id ? { ...p, name: itemName.trim() } : p
        );
      } else {
        const newId = `pel_${Date.now()}`;
        updatedPlatoons.push({
          id: newId,
          name: itemName.trim(),
          type: 'pelotao',
          isCommand: true,
          enabled: true
        });
      }
      await updatePlatoons(updatedPlatoons);
    }

    setIsModalOpen(false);
    if (onSlotsUpdated) onSlotsUpdated();
  };

  // Toggle enabled
  const handleToggleEnabled = async (item, type) => {
    if (type === 'posto') {
      const updated = physicalPosts.map(p => 
        p.id === item.id ? { ...p, enabled: p.enabled === false ? true : false } : p
      );
      await updatePhysicalPosts(updated);
    } else {
      const updated = platoons.map(p => 
        p.id === item.id ? { ...p, enabled: p.enabled === false ? true : false } : p
      );
      await updatePlatoons(updated);
    }
    if (onSlotsUpdated) onSlotsUpdated();
  };

  // Delete
  const handleDelete = async (item, type) => {
    if (!confirm(`Deseja realmente remover "${item.name}"?`)) return;

    if (type === 'posto') {
      const updated = physicalPosts.filter(p => p.id !== item.id);
      await updatePhysicalPosts(updated);
    } else {
      const updated = platoons.filter(p => p.id !== item.id);
      await updatePlatoons(updated);
    }
    if (onSlotsUpdated) onSlotsUpdated();
  };

  // Reset to default
  const handleExecuteReset = async () => {
    await resetSlotsDefault();
    setResetConfirmOpen(false);
    if (onSlotsUpdated) onSlotsUpdated();
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <MapPin className="w-5 h-5 text-amber-400" />
            Cadastro de Postos ({allSlots.length})
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Configure a relação de postos ativos na escala semanal. Todos os nomes e quantidades são editáveis.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setResetConfirmOpen(true)}
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restaurar Padrão</span>
          </button>

          <button
            onClick={() => handleOpenModal('posto')}
            className="px-4 py-2 rounded-lg bg-militar-600 hover:bg-militar-500 text-white text-xs font-semibold shadow-md flex items-center gap-2 transition-colors active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar Posto</span>
          </button>
        </div>
      </div>

      {/* Unified Grid of Slots */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {allSlots.map((item, index) => {
          const isEnabled = item.enabled !== false;
          const itemType = item._category || (item.type === 'pelotao' ? 'pelotao' : 'posto');

          return (
            <div
              key={item.id}
              className={`p-4 rounded-xl border transition-all flex items-center justify-between ${
                isEnabled
                  ? 'bg-slate-900 border-slate-800'
                  : 'bg-slate-950/60 border-slate-800/60 opacity-50'
              }`}
            >
              <div className="flex items-center space-x-3 min-w-0">
                <span className="w-6 h-6 flex-shrink-0 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-[11px] font-mono font-bold text-slate-400">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white truncate">
                    {item.name}
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                    {item.baseId ? (
                      <span className="text-amber-400 font-mono">1 Oficial • Grupo: {item.baseId}</span>
                    ) : (
                      <span>1 Oficial Designado (Posto Único)</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center space-x-1 flex-shrink-0">
                <button
                  onClick={() => handleToggleEnabled(item, itemType)}
                  className={`px-2 py-1 rounded text-[10px] font-semibold border transition-colors ${
                    isEnabled
                      ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                  title={isEnabled ? 'Posto ativo. Clique para desativar.' : 'Posto inativo. Clique para ativar.'}
                >
                  {isEnabled ? 'Ativo' : 'Inativo'}
                </button>

                <button
                  onClick={() => handleOpenModal(itemType, item)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  title="Editar nome"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => handleDelete(item, itemType)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                  title="Excluir posto"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">
                {editingItem ? 'Editar Posto' : 'Adicionar Posto'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {!editingItem && (
                <div>
                  <label className="block text-slate-400 font-semibold mb-1 uppercase tracking-wider">
                    Modalidade na Escala
                  </label>
                  <select
                    value={modalType}
                    onChange={e => setModalType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:border-militar-500 focus:outline-none"
                  >
                    <option value="posto">Posto Geral de Serviço</option>
                    <option value="pelotao">Posto de Pelotão (Permite Acúmulo c/ Cozinha/Refeitório/Fila)</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-slate-400 font-semibold mb-1 uppercase tracking-wider">
                  Nome do Posto
                </label>
                <input
                  type="text"
                  required
                  value={itemName}
                  onChange={e => setItemName(e.target.value)}
                  placeholder="Ex: Refeitório — Escada ou Pelotão TEC G"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:border-militar-500 focus:outline-none"
                />
              </div>

              {modalType === 'posto' && (
                <div>
                  <label className="block text-slate-400 font-semibold mb-1 uppercase tracking-wider">
                    Identificador de Agrupamento (Opcional)
                  </label>
                  <input
                    type="text"
                    value={itemBaseId}
                    onChange={e => setItemBaseId(e.target.value)}
                    placeholder="Ex: cozinha_10m ou cozinha_fisc"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-xs focus:border-militar-500 focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Permite ao algoritmo identificar que posições distintas pertencem ao mesmo posto (ex: Cozinha 10min 1 e 2).
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-militar-600 hover:bg-militar-500 text-white font-bold transition-all shadow-md"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {resetConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-amber-400">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-bold text-white">Restaurar Postos Padrão?</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Esta ação redefinirá a lista para os 17 postos físicos e pelotões padrão descritos no regulamento do Sistema de Escalas.
            </p>
            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setResetConfirmOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleExecuteReset}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all"
              >
                Sim, Restaurar Padrão
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
