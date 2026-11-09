import React, { useState } from 'react';
import { 
  Shield, 
  Calendar, 
  Users, 
  MapPin, 
  History, 
  BarChart3, 
  Settings, 
  Award,
  Database,
  Copy,
  Check
} from 'lucide-react';
import { exportDatabaseJsonString } from '../api';

export default function Navbar({ activeTab, setActiveTab, stats = {}, onOpenDatabaseLogin }) {
  const [copiedJson, setCopiedJson] = useState(false);

  const handleQuickCopyJson = async () => {
    const jsonStr = exportDatabaseJsonString();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(jsonStr);
      } else {
        throw new Error('Clipboard API indisponível');
      }
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2500);
    } catch {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = jsonStr;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopiedJson(true);
        setTimeout(() => setCopiedJson(false), 2500);
      } catch (err) {
        console.error('Erro ao copiar JSON:', err);
      }
    }
  };
  const navItems = [
    { id: 'dashboard', label: 'Início', fullLabel: 'Painel Geral', icon: Shield },
    { id: 'gerador', label: 'Escala', fullLabel: 'Gerador de Escalas', icon: Calendar },
    { id: 'oficiais', label: 'Oficiais', fullLabel: 'Efetivo de Oficiais', icon: Users },
    { id: 'postos', label: 'Postos', fullLabel: 'Postos', icon: MapPin },
    { id: 'historico', label: 'Histórico', fullLabel: 'Histórico', icon: History },
    { id: 'estatisticas', label: 'Equidade', fullLabel: 'Estatísticas', icon: BarChart3 },
    { id: 'configuracoes', label: 'Ajustes', fullLabel: 'Configurações', icon: Settings },
  ];

  return (
    <>
      <header className="no-print safe-top bg-slate-900/95 backdrop-blur-xl border-b border-slate-800/90 sticky top-0 z-40 shadow-lg">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16 gap-2">
            
            {/* Clean Formal Title: Only "Sistema de Escalas" */}
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className="flex items-center space-x-2.5 sm:space-x-3 text-left group focus:outline-none min-w-0"
            >
              <div className="w-8 h-8 sm:w-10 sm:h-10 shrink-0 rounded-lg bg-gradient-to-br from-militar-600 to-militar-800 flex items-center justify-center shadow-md border border-militar-500/40 group-hover:border-gold-400/50 transition-colors">
                <Award className="w-4 h-4 sm:w-6 sm:h-6 text-gold-400" />
              </div>
              <h1 className="text-[15px] sm:text-lg font-bold text-white tracking-tight truncate">
                Sistema de Escalas
              </h1>
            </button>

            {/* Desktop Navigation Links */}
            <nav className="hidden lg:flex items-center space-x-1" aria-label="Navegação principal">
              {navItems.map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-militar-700 text-white shadow-sm border border-militar-500/50'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-gold-400' : 'text-slate-400'}`} />
                    <span>{item.fullLabel}</span>
                  </button>
                );
              })}
            </nav>

            {/* Quick Info Badge + JSON Database Controls (optimized for iPhone 16/17 393px width) */}
            <div className="flex items-center space-x-1.5 sm:space-x-2 text-xs text-slate-400 sm:border-l sm:border-slate-800 sm:pl-3 shrink-0">
              <div className="hidden sm:block text-right mr-1">
                <div className="text-[10px] text-slate-400 leading-tight">Efetivo</div>
                <div className="font-mono font-semibold text-emerald-400 text-xs leading-tight">
                  {stats.activeOfficers ?? 0}
                </div>
              </div>

              <button
                type="button"
                onClick={handleQuickCopyJson}
                title="Copiar Banco de Dados JSON atual"
                className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-slate-800/95 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700 flex items-center gap-1.5 text-[11px] font-semibold transition-all"
              >
                {copiedJson ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="text-emerald-300">Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-gold-400 shrink-0" />
                    <span className="hidden sm:inline">Copiar JSON</span>
                    <span className="sm:hidden">JSON</span>
                  </>
                )}
              </button>

              {onOpenDatabaseLogin && (
                <button
                  type="button"
                  onClick={onOpenDatabaseLogin}
                  title="Abrir Tela de Login / Banco de Dados JSON"
                  className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-militar-800/90 hover:bg-militar-700 active:scale-95 text-militar-100 border border-militar-600/60 flex items-center gap-1.5 text-[11px] font-semibold transition-all"
                >
                  <Database className="w-3.5 h-3.5 text-gold-400 shrink-0" />
                  <span className="hidden sm:inline">Banco / Login</span>
                  <span className="sm:hidden">Banco</span>
                </button>
              )}
            </div>

          </div>
        </div>
      </header>

      {/* iPhone 16 / 17 Bottom Navigation Bar (with iOS Home Indicator safe area) */}
      <nav
        aria-label="Navegação móvel"
        className="no-print lg:hidden fixed bottom-0 inset-x-0 z-50 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800/90 shadow-[0_-8px_24px_rgba(0,0,0,0.45)] px-1.5 pt-1.5 safe-bottom-nav"
      >
        <div className="grid grid-cols-7 gap-0.5 max-w-md mx-auto">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition-all min-h-[50px] active:scale-95 ${
                  isActive
                    ? 'bg-militar-800/95 text-white border border-militar-600/60 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 active:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-[18px] h-[18px] mb-0.5 ${isActive ? 'text-gold-400' : 'text-slate-400'}`} />
                <span className={`text-[10px] leading-tight tracking-tight truncate max-w-full ${isActive ? 'font-bold text-white' : 'font-medium'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
