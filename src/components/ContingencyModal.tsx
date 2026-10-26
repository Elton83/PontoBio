import React, { useState } from 'react';
import { AlertTriangle, KeyRound, Lock, ShieldAlert, X } from 'lucide-react';
import { Employee, PunchType } from '../types/ponto';
import { pontoStorage } from '../services/pontoStorage';

interface ContingencyModalProps {
  employee: Employee;
  punchType: PunchType;
  onSuccess: () => void;
  onCancel: () => void;
}

const COMMON_JUSTIFICATIONS = [
  'Inconsistência na leitura biométrica após 3 tentativas consecutivas',
  'Dedo com curativo/lesão física no leitor dactilar',
  'Obstrução ou reflexo de luz na câmera de reconhecimento facial',
  'Instabilidade temporária de sensor óptico do terminal',
  'Autorização expressa de gestor imediato por ocorrência atípica',
];

export const ContingencyModal: React.FC<ContingencyModalProps> = ({
  employee,
  punchType,
  onSuccess,
  onCancel,
}) => {
  const [pin, setPin] = useState('');
  const [selectedPreset, setSelectedPreset] = useState(COMMON_JUSTIFICATIONS[0]);
  const [customJustification, setCustomJustification] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!pin.trim()) {
      setErrorMsg('Informe o PIN funcional ou senha de contingência.');
      return;
    }

    if (pin !== employee.pin && pin !== '9999') {
      setErrorMsg('PIN incorreto. Verifique a credencial ou solicite ao supervisor.');
      return;
    }

    const finalJustification = customJustification.trim() || selectedPreset;
    if (!finalJustification || finalJustification.length < 10) {
      setErrorMsg('A justificativa é obrigatória e deve conter pelo menos 10 caracteres.');
      return;
    }

    setIsSubmitting(true);

    try {
      await pontoStorage.addTimeRecord({
        employee,
        type: punchType,
        method: 'contingencia',
        justification: finalJustification,
        supervisorApproved: pin === '9999',
      });

      onSuccess();
    } catch (err) {
      setErrorMsg('Erro ao gravar registro em contingência. Tente novamente.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-lg rounded-xl border border-slate-300 bg-white shadow-2xl text-slate-800 overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="contingency-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#05202B] bg-[#002B49] text-white px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#05202B] text-[#C4A052] border border-[#C4A052]/40 shadow-xs">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h2 id="contingency-title" className="text-base font-bold text-white">
                Registro em Modo de Contingência
              </h2>
              <p className="text-xs text-blue-200">
                RN05 - Autenticação Assistida por Falha Biométrica
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            aria-label="Cancelar contingência"
            className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 leading-relaxed">
              <span className="font-bold">Atenção Trabalhista:</span> O registro em contingência é auditado pelo RH. É exigido o PIN funcional de identificação e a declaração obrigatória do motivo técnico.
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-[#F4F6F8] p-3.5 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Colaborador:</span>
              <span className="font-bold text-[#002B49]">{employee.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Matrícula / CPF:</span>
              <span className="font-mono text-slate-800">{employee.matricula} · {employee.cpf}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Marcação Pretendida:</span>
              <span className="font-bold text-[#002B49]">
                {punchType.replace(/_/g, ' ')}
              </span>
            </div>
          </div>

          {/* PIN Input */}
          <div className="space-y-1.5">
            <label htmlFor="contingency-pin" className="block text-xs font-bold text-slate-700">
              PIN Funcional do Colaborador (ou Supervisor) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <KeyRound className="h-4 w-4" />
              </div>
              <input
                id="contingency-pin"
                type="password"
                maxLength={8}
                value={pin}
                onChange={e => setPin(e.target.value)}
                placeholder="Ex: 1049 (ou 9999 para supervisor)"
                className="w-full pl-9 pr-4 py-2 bg-[#F4F6F8] border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#002B49] font-mono"
              />
            </div>
            <p className="text-[11px] text-slate-500">
              Dica de teste: o PIN do colaborador é <span className="font-mono font-bold text-slate-700">{employee.pin}</span> (ou use <span className="font-mono font-bold text-slate-700">9999</span> para gestor).
            </p>
          </div>

          {/* Justification select */}
          <div className="space-y-1.5">
            <label htmlFor="justification-preset" className="block text-xs font-bold text-slate-700">
              Motivo Regulamentar da Contingência <span className="text-red-500">*</span>
            </label>
            <select
              id="justification-preset"
              value={selectedPreset}
              onChange={e => setSelectedPreset(e.target.value)}
              className="w-full bg-[#F4F6F8] border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 font-medium focus:outline-none focus:border-[#002B49]"
            >
              {COMMON_JUSTIFICATIONS.map((just, idx) => (
                <option key={idx} value={just}>
                  {just}
                </option>
              ))}
              <option value="OUTRO">Outro motivo detalhado...</option>
            </select>
          </div>

          {selectedPreset === 'OUTRO' && (
            <div className="space-y-1.5 animate-in fade-in">
              <label htmlFor="custom-justification" className="block text-xs font-bold text-slate-700">
                Descreva detalhadamente a justificativa <span className="text-red-500">*</span>
              </label>
              <textarea
                id="custom-justification"
                rows={3}
                value={customJustification}
                onChange={e => setCustomJustification(e.target.value)}
                placeholder="Informe o motivo específico para validação trabalhista..."
                className="w-full bg-[#F4F6F8] border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#002B49]"
              />
            </div>
          )}

          {errorMsg && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-2.5 text-xs text-red-800 font-semibold flex items-center gap-2">
              <Lock className="h-4 w-4 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-[#002B49] hover:bg-[#003860] px-4 py-2 text-xs font-bold text-white transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'Validando...' : 'Confirmar Ponto em Contingência'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
