import React from 'react';
import { 
  Shield, 
  Calendar, 
  Users, 
  MapPin, 
  History, 
  BarChart3, 
  Settings, 
  Award 
} from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, stats = {} }) {
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
      <header className="no-print bg-slate-900/95 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            
            {/* Clean Formal Title: Only "Sistema de Escalas" */}
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className="flex items-center space-x-3 text-left group focus:outline-none"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-militar-600 to-militar-800 flex items-center justify-center shadow-md border border-militar-500/40 group-hover:border-gold-400/50 transition-colors">
                <Award className="w-5 h-5 sm:w-6 sm:h-6 text-gold-400" />
              </div>
              <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
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

            {/* Quick Info Badge (visible on both mobile and desktop) */}
            <div className="flex items-center space-x-2.5 text-xs text-slate-400 sm:border-l sm:border-slate-800 sm:pl-4">
              <div className="text-right">
                <div className="text-[10px] sm:text-[11px] text-slate-400 leading-tight">Efetivo Ativo</div>
                <div className="font-mono font-semibold text-emerald-400 text-xs sm:text-sm leading-tight">
                  {stats.activeOfficers ?? 0}
                </div>
              </div>
              <div className="w-2 h-2 rounded-full bg-emerald-500" title="Sistema Operacional" />
            </div>

          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar (Thumb-friendly UX for smartphones) */}
      <nav
        aria-label="Navegação móvel"
        className="no-print lg:hidden fixed bottom-0 inset-x-0 z-50 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 shadow-2xl px-1 py-1"
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
                className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-lg transition-all min-h-[50px] ${
                  isActive
                    ? 'bg-militar-800/90 text-white border border-militar-600/60 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 active:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 mb-0.5 ${isActive ? 'text-gold-400' : 'text-slate-400'}`} />
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
