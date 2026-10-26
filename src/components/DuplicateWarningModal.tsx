import React, { useEffect, useState } from 'react';
import { AlertCircle, Clock, ShieldAlert, X } from 'lucide-react';
import { TimeRecord } from '../types/ponto';

interface DuplicateWarningModalProps {
  lastRecord: TimeRecord;
  initialSecondsRemaining: number;
  onClose: () => void;
}

export const DuplicateWarningModal: React.FC<DuplicateWarningModalProps> = ({
  lastRecord,
  initialSecondsRemaining,
  onClose,
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState(initialSecondsRemaining);

  useEffect(() => {
    if (secondsRemaining <= 0) return;
    const timer = setInterval(() => {
      setSecondsRemaining(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [secondsRemaining]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-md rounded-xl border border-slate-300 bg-white shadow-2xl text-slate-800 overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="duplicate-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#05202B] bg-[#002B49] text-white px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#05202B] text-[#C4A052] border border-[#C4A052]/40 shadow-xs">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h2 id="duplicate-title" className="text-base font-bold text-white">
                Marcação Duplicada Bloqueada
              </h2>
              <p className="text-xs text-blue-200">
                Intervalo mínimo de segurança (&lt; 60 segundos)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar alerta"
            className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3.5 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 leading-relaxed font-medium">
              Para evitar registros acidentais em duplicidade, o sistema bloqueia novas batidas para a mesma matrícula dentro de uma janela de 60 segundos.
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-[#F4F6F8] p-4 space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Colaborador:</span>
              <span className="font-bold text-[#002B49]">{lastRecord.employeeName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Matrícula:</span>
              <span className="font-mono font-bold text-[#002B49]">{lastRecord.employeeMatricula}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Última Marcação Gravada:</span>
              <span className="font-bold text-slate-800">{lastRecord.typeLabel}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Horário Gravado:</span>
              <span className="font-bold text-[#002B49] font-mono tabular-nums text-sm">
                {lastRecord.formattedTime}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Comprovante NSR:</span>
              <span className="font-mono font-bold text-slate-700">#{String(lastRecord.nsr).padStart(9, '0')}</span>
            </div>
          </div>

          {/* Cooldown visual indicator */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
              <Clock className="h-4 w-4 text-[#002B49] animate-spin" />
              <span>Aguarde para nova marcação:</span>
            </div>
            <span className="font-mono text-base font-bold tabular-nums text-[#002B49]">
              {secondsRemaining}s
            </span>
          </div>

          <p className="text-[11px] text-slate-500 text-center font-medium">
            Sua jornada já está devidamente computada. Não é necessário repetir a batida.
          </p>

          <div className="pt-2">
            <button
              onClick={onClose}
              type="button"
              className="w-full rounded-lg bg-[#002B49] hover:bg-[#003860] py-2.5 text-xs font-bold text-white shadow-xs transition-colors cursor-pointer"
            >
              Entendido, Voltar ao Terminal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
