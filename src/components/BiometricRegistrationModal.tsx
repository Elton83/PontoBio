import React, { useState } from 'react';
import { Camera, Check, Fingerprint, ShieldCheck, UserCheck, X } from 'lucide-react';
import { Employee } from '../types/ponto';
import { pontoStorage } from '../services/pontoStorage';

interface BiometricRegistrationModalProps {
  employee: Employee;
  onClose: () => void;
  onSaved: () => void;
}

export const BiometricRegistrationModal: React.FC<BiometricRegistrationModalProps> = ({
  employee,
  onClose,
  onSaved,
}) => {
  const [faceRegistered, setFaceRegistered] = useState(employee.faceRegistered);
  const [fingerprintRegistered, setFingerprintRegistered] = useState(employee.fingerprintRegistered);
  const [isCapturingFace, setIsCapturingFace] = useState(false);
  const [isCapturingFinger, setIsCapturingFinger] = useState(false);
  const [successNotice, setSuccessNotice] = useState(false);

  const handleSimulateFaceCapture = () => {
    setIsCapturingFace(true);
    setTimeout(() => {
      setFaceRegistered(true);
      setIsCapturingFace(false);
    }, 1200);
  };

  const handleSimulateFingerCapture = () => {
    setIsCapturingFinger(true);
    setTimeout(() => {
      setFingerprintRegistered(true);
      setIsCapturingFinger(false);
    }, 1200);
  };

  const handleSave = () => {
    pontoStorage.registerBiometricCredential(employee.id, {
      face: faceRegistered,
      fingerprint: fingerprintRegistered,
    });
    setSuccessNotice(true);
    setTimeout(() => {
      onSaved();
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-lg rounded-xl border border-slate-300 bg-white shadow-2xl text-slate-800 overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bioreg-title"
      >
        <div className="flex items-center justify-between border-b border-[#05202B] bg-[#002B49] text-white px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#05202B] text-[#C4A052] border border-[#C4A052]/40 shadow-xs">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 id="bioreg-title" className="text-base font-bold text-white">
                Cadastro Biométrico Individual
              </h2>
              <p className="text-xs text-blue-200">
                RN01 - Unicidade Cadastral Vinculada à Matrícula e CPF
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Employee Badge */}
          <div className="rounded-xl border border-slate-200 bg-[#F4F6F8] p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-semibold">Colaborador Ativo</p>
              <h3 className="text-sm font-bold text-[#002B49]">{employee.name}</h3>
              <p className="text-xs text-slate-600">{employee.role} · {employee.department}</p>
            </div>
            <div className="text-right text-xs font-mono">
              <span className="text-[#002B49] font-bold block">{employee.matricula}</span>
              <span className="text-slate-500">{employee.cpf}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Facial Enrollment Box */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col justify-between space-y-3 shadow-2xs">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-[#002B49]">
                    <Camera className="h-4 w-4 text-[#C4A052]" />
                    Biometria Facial
                  </span>
                  {faceRegistered ? (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">Ativa</span>
                  ) : (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">Pendente</span>
                  )}
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Mapeamento de malha 3D e prova de vida facial com anti-spoofing.
                </p>
              </div>

              <button
                type="button"
                onClick={handleSimulateFaceCapture}
                disabled={isCapturingFace}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 py-2 text-xs font-bold text-slate-700 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
              >
                {isCapturingFace ? (
                  <span>Escaneando...</span>
                ) : faceRegistered ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Recapturar Face</span>
                  </>
                ) : (
                  <span>Capturar Face</span>
                )}
              </button>
            </div>

            {/* Fingerprint Enrollment Box */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col justify-between space-y-3 shadow-2xs">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-[#002B49]">
                    <Fingerprint className="h-4 w-4 text-[#C4A052]" />
                    Sensor Dactilar
                  </span>
                  {fingerprintRegistered ? (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">Ativa</span>
                  ) : (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">Pendente</span>
                  )}
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Vetor dactilar óptico de minúcias e conformação de cristas dérmicas.
                </p>
              </div>

              <button
                type="button"
                onClick={handleSimulateFingerCapture}
                disabled={isCapturingFinger}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 py-2 text-xs font-bold text-slate-700 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
              >
                {isCapturingFinger ? (
                  <span>Digitalizando...</span>
                ) : fingerprintRegistered ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Recapturar Digital</span>
                  </>
                ) : (
                  <span>Capturar Digital</span>
                )}
              </button>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 text-xs text-slate-600 space-y-1">
            <span className="font-bold text-[#002B49]">Garantia de Unicidade:</span>
            <p>
              Os padrões biométricos geram uma chave matemática unidirecional exclusiva vinculada à matrícula {employee.matricula} e CPF {employee.cpf}. Não é permitido duplicar ou transferir templates entre colaboradores.
            </p>
          </div>

          {successNotice && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-xs text-emerald-800 font-bold flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-600" />
              <span>Biometria salva e validada com sucesso!</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#002B49] hover:bg-[#003860] px-4 py-2 text-xs font-bold text-white transition-colors shadow-xs cursor-pointer"
            >
              <UserCheck className="h-4 w-4 text-[#C4A052]" />
              <span>Salvar Credencial Única</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
