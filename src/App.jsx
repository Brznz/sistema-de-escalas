import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import LoginScreen from './components/LoginScreen';
import DashboardTab from './components/DashboardTab';
import SchedulerTab from './components/SchedulerTab';
import OfficersTab from './components/OfficersTab';
import SlotsTab from './components/SlotsTab';
import HistoryTab from './components/HistoryTab';
import StatisticsTab from './components/StatisticsTab';
import SettingsTab from './components/SettingsTab';
import PrintView from './components/PrintView';
import { 
  fetchOfficers, 
  fetchSlots, 
  fetchSchedules, 
  fetchStats, 
  fetchStatus, 
  fetchConfig,
  isSessionAuthenticated,
  setSessionAuthenticated,
  pullFromCloud
} from './api';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => isSessionAuthenticated());
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Data State
  const [officers, setOfficers] = useState([]);
  const [physicalPosts, setPhysicalPosts] = useState([]);
  const [platoons, setPlatoons] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [stats, setStats] = useState({});
  const [systemStatus, setSystemStatus] = useState({});
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(true);

  // Print view state
  const [printData, setPrintData] = useState(null);

  // Load all system data
  const loadData = async () => {
    try {
      const [offs, slotsData, scheds, sts, st, cfg] = await Promise.all([
        fetchOfficers(),
        fetchSlots(),
        fetchSchedules(),
        fetchStats(),
        fetchStatus(),
        fetchConfig()
      ]);

      setOfficers(offs || []);
      setPhysicalPosts(slotsData?.physicalPosts || []);
      setPlatoons(slotsData?.platoons || []);
      setSchedules(scheds || []);
      setStats(sts || {});
      setSystemStatus(st || {});
      setConfig(cfg || {});
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Puxa automaticamente o banco de dados mais recente da nuvem (estilo Dontpad) ao abrir o site
    pullFromCloud()
      .then((res) => {
        if (res && res.ok) {
          loadData();
        }
      })
      .catch(() => {});
  }, []);

  const handleOpenPrint = (schedule, title, weekNumber) => {
    setPrintData({ schedule, title, weekNumber });
  };

  const handleClosePrint = () => {
    setPrintData(null);
  };

  const handleLoginSuccess = async () => {
    await loadData();
    setIsLoggedIn(true);
  };

  const handleOpenDatabaseLogin = () => {
    setSessionAuthenticated(false);
    setIsLoggedIn(false);
  };

  if (!isLoggedIn) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-[100dvh] bg-slate-950 text-slate-100 flex flex-col font-sans relative overflow-x-hidden">
      
      {/* Subtle Background Watermark ("Sistema de Escalas por Bueno") */}
      <div
        aria-hidden="true"
        className="no-print pointer-events-none select-none fixed inset-0 z-0 flex flex-col items-center justify-center overflow-hidden opacity-[0.03]"
      >
        <div className="-rotate-12 text-center space-y-24">
          <p className="text-5xl sm:text-7xl font-black uppercase tracking-[0.2em] text-militar-200 whitespace-nowrap">
            Sistema de Escalas por Bueno
          </p>
          <p className="text-5xl sm:text-7xl font-black uppercase tracking-[0.2em] text-gold-400 whitespace-nowrap">
            Sistema de Escalas por Bueno
          </p>
        </div>
      </div>

      {/* Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        schoolName={config.schoolName || 'Sistema de Escalas'}
        stats={systemStatus}
        onOpenDatabaseLogin={handleOpenDatabaseLogin}
      />

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-militar-500 mr-3"></div>
            Carregando sistema de escalas...
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <DashboardTab
                status={systemStatus}
                stats={stats}
                schedules={schedules}
                setActiveTab={setActiveTab}
              />
            )}

            {activeTab === 'gerador' && (
              <SchedulerTab
                officers={officers}
                physicalPosts={physicalPosts}
                platoons={platoons}
                schedules={schedules}
                onScheduleSaved={loadData}
                onOpenPrint={handleOpenPrint}
              />
            )}

            {activeTab === 'oficiais' && (
              <OfficersTab
                officers={officers}
                physicalPosts={physicalPosts}
                platoons={platoons}
                schedules={schedules}
                stats={stats}
                onOfficersUpdated={loadData}
              />
            )}

            {activeTab === 'postos' && (
              <SlotsTab
                physicalPosts={physicalPosts}
                platoons={platoons}
                onSlotsUpdated={loadData}
              />
            )}

            {activeTab === 'historico' && (
              <HistoryTab
                schedules={schedules}
                officers={officers}
                stats={stats}
                onScheduleDeleted={loadData}
                onOpenPrint={handleOpenPrint}
              />
            )}

            {activeTab === 'estatisticas' && (
              <StatisticsTab
                stats={stats}
              />
            )}

            {activeTab === 'configuracoes' && (
              <SettingsTab
                officers={officers}
                physicalPosts={physicalPosts}
                platoons={platoons}
                onConfigUpdated={loadData}
              />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 no-print bg-slate-950/60 border-t border-slate-900 py-3 pb-[calc(5.25rem+env(safe-area-inset-bottom,0px))] lg:pb-3 text-center text-[11px] text-slate-600">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-1">
          <span className="font-normal text-slate-600">
            Sistema de Escalas por Bueno
          </span>
          <span className="font-mono text-[10px] text-slate-600">
            Otimização Combinatória
          </span>
        </div>
      </footer>

      {/* Print Overlay Modal */}
      {printData && (
        <PrintView
          schedule={printData.schedule}
          title={printData.title}
          weekNumber={printData.weekNumber}
          schoolName={config.schoolName || 'Sistema de Escalas'}
          onClose={handleClosePrint}
        />
      )}

    </div>
  );
}
