import React, { useState, useRef } from 'react';
import {
  Shield,
  Upload,
  LogIn,
  CheckCircle2,
  AlertTriangle,
  FileJson,
  RotateCcw
} from 'lucide-react';
import {
  importBackupData,
  resetAllData,
  setSessionAuthenticated
} from '../api';

export default function LoginScreen({ onLoginSuccess }) {
  const [jsonInput, setJsonInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loadedMsg, setLoadedMsg] = useState('');
  const fileInputRef = useRef(null);

  // Enter by pasting JSON
  const handleLoginWithJson = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoadedMsg('');

    if (!jsonInput.trim()) {
      setErrorMsg('Cole o conteúdo do JSON ou selecione um arquivo .json para entrar.');
      return;
    }

    try {
      await importBackupData(jsonInput.trim());
      setSessionAuthenticated(true);
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
        setJsonInput(typeof content === 'string' ? content : JSON.stringify(res.data, null, 2));
        setLoadedMsg(`Arquivo "${file.name}" carregado (${res.data.officers.length} oficiais, ${res.data.schedules.length} semana(s)). Clique em "Carregar JSON e Entrar".`);
      } catch (err) {
        setErrorMsg(err.message || 'Arquivo JSON inválido.');
      }
    };
    reader.readAsText(file);
  };

  // Start fresh empty database and enter
  const handleResetClean = async () => {
    if (!confirm('Deseja iniciar um banco novo sem oficiais e sem histórico?')) return;
    await resetAllData();
    setSessionAuthenticated(true);
    onLoginSuccess();
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

      <div className="relative z-10 max-w-xl w-full mx-auto my-auto space-y-6 py-4">
        {/* Top Institutional Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-militar-800 border border-militar-600 flex items-center justify-center mx-auto shadow-lg">
            <Shield className="w-6 h-6 text-gold-400" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Sistema de Escalas
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
            Acesso via Banco de Dados portátil (JSON). Importe seu arquivo .JSON ou cole o código abaixo para entrar.
          </p>
        </div>

        {/* Single Clean Card: Login by Pasting or Uploading JSON */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <FileJson className="w-4 h-4 text-gold-400" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Carregar Banco de Dados (JSON)
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
                className="w-full sm:w-auto justify-center px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-gold-400 text-xs font-semibold border border-gold-500/30 flex items-center gap-1.5 transition-colors"
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
                rows={7}
                value={jsonInput}
                onChange={e => setJsonInput(e.target.value)}
                placeholder='{"version": 1, "officers": [...], "physicalPosts": [...], "schedules": [...]}'
                className="w-full p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-militar-500"
              />
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleResetClean}
                className="px-3.5 py-2.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-medium border border-slate-800 flex items-center justify-center gap-1.5 transition-colors"
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
