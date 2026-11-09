import React, { useState, useRef, useEffect } from 'react';
import {
  Shield,
  Database,
  Upload,
  LogIn,
  Copy,
  Download,
  CheckCircle2,
  AlertTriangle,
  FileJson,
  RotateCcw,
  Cloud,
  RefreshCw
} from 'lucide-react';
import {
  getLocalDatabase,
  importBackupData,
  exportDatabaseJsonString,
  resetAllData,
  getCloudKey,
  setCloudKey,
  pullFromCloud,
  pushToCloud
} from '../api';
import { downloadFile } from '../utils/exportUtils';

export default function LoginScreen({ onLoginSuccess }) {
  const [currentDb, setCurrentDb] = useState(() => getLocalDatabase());
  const [cloudKeyInput, setCloudKeyInput] = useState(() => getCloudKey());
  const [cloudSyncing, setCloudSyncing] = useState(false);
  const [cloudStatusMsg, setCloudStatusMsg] = useState('Sincronizando banco na nuvem...');
  const [jsonInput, setJsonInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [loadedMsg, setLoadedMsg] = useState('');
  const fileInputRef = useRef(null);

  // Automatically pull latest database from Cloud on mount
  useEffect(() => {
    let mounted = true;
    async function autoPull() {
      setCloudSyncing(true);
      const res = await pullFromCloud(cloudKeyInput);
      if (!mounted) return;
      if (res?.ok && res.data) {
        setCurrentDb(res.data);
        setCloudStatusMsg(`Banco puxado automaticamente da nuvem ("${cloudKeyInput}")`);
      } else {
        setCloudStatusMsg(`Pronto (Chave na nuvem: "${cloudKeyInput}")`);
      }
      setCloudSyncing(false);
    }
    autoPull();
    return () => {
      mounted = false;
    };
  }, []);

  const handlePullFromCloudKey = async () => {
    setErrorMsg('');
    setCloudSyncing(true);
    const cleanKey = setCloudKey(cloudKeyInput);
    setCloudKeyInput(cleanKey);
    const res = await pullFromCloud(cleanKey);
    setCloudSyncing(false);
    if (res?.ok && res.data) {
      setCurrentDb(res.data);
      setCloudStatusMsg(`✓ Puxado da nuvem ("${cleanKey}") com sucesso!`);
    } else {
      setCloudStatusMsg(`Nenhum banco salvo ainda na chave "${cleanKey}". Usando banco local.`);
    }
  };

  const handlePushToCloudKey = async () => {
    setErrorMsg('');
    setCloudSyncing(true);
    const cleanKey = setCloudKey(cloudKeyInput);
    setCloudKeyInput(cleanKey);
    const res = await pushToCloud(currentDb, cleanKey);
    setCloudSyncing(false);
    if (res?.ok) {
      setCloudStatusMsg(`✓ Banco salvo na nuvem ("${cleanKey}") com sucesso!`);
    } else {
      setErrorMsg('Não foi possível salvar na nuvem neste momento.');
    }
  };

  const officersCount = (currentDb?.officers || []).length;
  const postsCount =
    (currentDb?.physicalPosts || []).filter(p => p.enabled !== false).length +
    (currentDb?.platoons || []).filter(p => p.enabled !== false).length;
  const schedulesCount = (currentDb?.schedules || []).length;

  // 1-click enter with currently stored database
  const handleEnterCurrent = () => {
    onLoginSuccess();
  };

  // Enter by pasting JSON
  const handleLoginWithJson = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoadedMsg('');

    if (!jsonInput.trim()) {
      setErrorMsg('Cole o conteúdo do JSON ou selecione um arquivo .json para carregar.');
      return;
    }

    try {
      const res = await importBackupData(jsonInput.trim());
      setCurrentDb(res.data);
      onLoginSuccess();
    } catch (err) {
      setErrorMsg(err.message || 'JSON inválido. Verifique se copiou o arquivo completo.');
    }
  };

  // Upload a .json file directly
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg('');
    setLoadedMsg('');

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result;
        const res = await importBackupData(content);
        setCurrentDb(res.data);
        setJsonInput(typeof content === 'string' ? content : JSON.stringify(res.data, null, 2));
        setLoadedMsg(`Arquivo "${file.name}" carregado com sucesso (${res.data.officers.length} oficiais, ${res.data.schedules.length} semana(s)).`);
      } catch (err) {
        setErrorMsg(err.message || 'Arquivo JSON inválido.');
      }
    };
    reader.readAsText(file);
  };

  // Copy current JSON to clipboard (with fallback for iOS Safari / Chrome)
  const handleCopyCurrentJson = async () => {
    const jsonStr = exportDatabaseJsonString();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(jsonStr);
      } else {
        throw new Error('Clipboard API indisponível');
      }
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2500);
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
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2500);
      } catch {
        setJsonInput(jsonStr);
      }
    }
  };

  // Download current JSON file
  const handleDownloadCurrentJson = () => {
    const jsonStr = exportDatabaseJsonString();
    downloadFile('banco_sistema_escalas.json', jsonStr, 'application/json');
  };

  // Start fresh empty database
  const handleResetClean = async () => {
    if (!confirm('Deseja iniciar um banco novo sem oficiais e sem histórico?')) return;
    const res = await resetAllData();
    setCurrentDb(res.data);
    setJsonInput('');
    setLoadedMsg('Banco limpo carregado. Pronto para iniciar do zero.');
  };

  return (
    <div className="min-h-[100dvh] safe-top safe-bottom-modal bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-x-hidden px-3.5 py-4 sm:p-6">
      {/* Subtle Background Watermark */}
      <div
        aria-hidden="true"
        className="pointer-events-none select-none fixed inset-0 z-0 flex items-center justify-center overflow-hidden"
      >
        <div className="text-center -rotate-12 opacity-[0.025] space-y-12">
          <div className="text-4xl sm:text-6xl font-black uppercase tracking-widest text-militar-300 whitespace-nowrap">
            Sistema de Escalas por Bueno
          </div>
          <div className="text-4xl sm:text-6xl font-black uppercase tracking-widest text-militar-300 whitespace-nowrap">
            Sistema de Escalas por Bueno
          </div>
        </div>
      </div>

      <div className="relative z-10 max-w-2xl w-full mx-auto my-auto space-y-6 py-4">
        {/* Top Institutional Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-militar-800 border border-militar-600 flex items-center justify-center mx-auto shadow-lg">
            <Shield className="w-6 h-6 text-gold-400" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Sistema de Escalas
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
            Acesso via Banco de Dados portátil (JSON). Carregue seu JSON atualizado ou continue com a sessão salva neste dispositivo.
          </p>
        </div>

        {/* Card 1: Current Saved Database + Automatic Cloud Sync (Dontpad style) */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Cloud className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                1. Banco de Dados Automático na Nuvem (Estilo Dontpad)
              </h2>
            </div>
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-0.5 rounded-full w-fit flex items-center gap-1.5">
              {cloudSyncing && <RefreshCw className="w-3 h-3 animate-spin" />}
              <span>{cloudStatusMsg}</span>
            </span>
          </div>

          {/* Dontpad-style Cloud Key Bar */}
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
            <label className="block text-[11px] font-semibold text-slate-400">
              Endereço / Chave da Sala na Nuvem (puxa e salva tudo sozinho em qualquer aparelho):
            </label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                value={cloudKeyInput}
                onChange={e => setCloudKeyInput(e.target.value)}
                placeholder="sistema-escalas-bueno"
                className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-gold-300 focus:outline-none focus:border-militar-500"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePullFromCloudKey}
                  disabled={cloudSyncing}
                  className="flex-1 sm:flex-initial min-h-[38px] px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${cloudSyncing ? 'animate-spin' : ''}`} />
                  <span>Puxar da Nuvem</span>
                </button>
                <button
                  type="button"
                  onClick={handlePushToCloudKey}
                  disabled={cloudSyncing}
                  className="flex-1 sm:flex-initial min-h-[38px] px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Cloud className="w-3.5 h-3.5 text-gold-400" />
                  <span>Salvar na Nuvem</span>
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5 text-center">
            <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-3">
              <div className="text-[11px] text-slate-400">Oficiais</div>
              <div className="text-lg sm:text-xl font-bold font-mono text-white mt-0.5">
                {officersCount}
              </div>
            </div>
            <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-3">
              <div className="text-[11px] text-slate-400">Postos</div>
              <div className="text-lg sm:text-xl font-bold font-mono text-amber-400 mt-0.5">
                {postsCount}
              </div>
            </div>
            <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-3">
              <div className="text-[11px] text-slate-400">Semanas Salvas</div>
              <div className="text-lg sm:text-xl font-bold font-mono text-emerald-400 mt-0.5">
                {schedulesCount}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
            <button
              onClick={handleEnterCurrent}
              className="flex-1 py-2.5 px-4 rounded-lg bg-gradient-to-r from-militar-600 to-militar-700 hover:from-militar-500 hover:to-militar-600 text-white font-bold text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <LogIn className="w-4 h-4 text-gold-400" />
              <span>Entrar com este Banco de Dados</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyCurrentJson}
                className="flex-1 sm:flex-initial px-3 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center justify-center gap-1.5 transition-colors"
                title="Copiar o JSON atual para salvar ou enviar"
              >
                {copySuccess ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-300">JSON Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-gold-400" />
                    <span>Copiar JSON</span>
                  </>
                )}
              </button>

              <button
                onClick={handleDownloadCurrentJson}
                className="flex-1 sm:flex-initial px-3 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center justify-center gap-1.5 transition-colors"
                title="Baixar arquivo .json do banco atual"
              >
                <Download className="w-3.5 h-3.5 text-sky-400" />
                <span>Baixar .JSON</span>
              </button>
            </div>
          </div>
        </div>

        {/* Card 2: Login by Pasting or Uploading JSON */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <FileJson className="w-4 h-4 text-gold-400" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                2. Carregar Banco de Dados Externo (JSON)
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-gold-400 text-xs font-semibold border border-gold-500/30 flex items-center gap-1.5 transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Importar Arquivo .JSON</span>
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-700 text-rose-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {loadedMsg && (
            <div className="p-3 rounded-lg bg-emerald-950/80 border border-emerald-700 text-emerald-200 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{loadedMsg}</span>
            </div>
          )}

          <form onSubmit={handleLoginWithJson} className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Cole aqui o código JSON do seu banco de dados:
              </label>
              <textarea
                rows={6}
                value={jsonInput}
                onChange={e => setJsonInput(e.target.value)}
                placeholder='{"version": 1, "officers": [...], "physicalPosts": [...], "schedules": [...]}'
                className="w-full p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-militar-500"
              />
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={handleResetClean}
                className="px-3 py-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-medium border border-slate-800 flex items-center justify-center gap-1.5 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Iniciar Banco Limpo do Zero</span>
              </button>

              <button
                type="submit"
                className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <LogIn className="w-4 h-4" />
                <span>Carregar JSON e Entrar</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Subtle Footer */}
      <footer className="relative z-10 text-center text-[11px] text-slate-600 py-2">
        Sistema de Escalas por Bueno
      </footer>
    </div>
  );
}
