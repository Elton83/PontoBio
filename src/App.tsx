/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Fingerprint,
  Info,
  LayoutDashboard,
  RotateCcw,
  Scale,
  Scan,
  ShieldCheck,
} from 'lucide-react';
import { BiometricRegistrationModal } from './components/BiometricRegistrationModal';
import { BiometricTerminal } from './components/BiometricTerminal';
import { ContingencyModal } from './components/ContingencyModal';
import { DigitalReceiptModal } from './components/DigitalReceiptModal';
import { DuplicateWarningModal } from './components/DuplicateWarningModal';
import { HrDashboard } from './components/HrDashboard';
import { TjprLogo } from './components/TjprLogo';
import { COMPANY_INFO } from './data/mockEmployees';
import { pontoStorage } from './services/pontoStorage';
import { Employee, PunchType, TimeRecord } from './types/ponto';

export default function App() {
  const [currentView, setCurrentView] = useState<'terminal' | 'hr'>('terminal');
  const [dataVersion, setDataVersion] = useState(0);

  // Modals state
  const [receiptRecord, setReceiptRecord] = useState<TimeRecord | null>(null);
  const [contingencyTarget, setContingencyTarget] = useState<{
    employee: Employee;
    punchType: PunchType;
  } | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<{
    lastRecord: TimeRecord;
    secondsRemaining: number;
  } | null>(null);
  const [enrollmentEmployee, setEnrollmentEmployee] = useState<Employee | null>(null);

  // Global toast notification
  const [toastMessage, setToastMessage] = useState<{
    type: 'success' | 'warning' | 'info';
    title: string;
    description: string;
  } | null>(null);

  const showToast = (type: 'success' | 'warning' | 'info', title: string, description: string) => {
    setToastMessage({ type, title, description });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  const handleRefresh = () => {
    setDataVersion(prev => prev + 1);
  };

  const handlePunchSuccess = (record: TimeRecord) => {
    handleRefresh();
    setReceiptRecord(record);
    showToast(
      'success',
      'Ponto Registrado com Sucesso!',
      `${record.employeeName} · ${record.typeLabel} às ${record.formattedTime} (NSR #${record.nsr})`
    );
  };

  const handleTriggerContingency = (employee: Employee, punchType: PunchType) => {
    setContingencyTarget({ employee, punchType });
  };

  const handleDuplicateBlocked = (lastRecord: TimeRecord, secondsRemaining: number) => {
    setDuplicateWarning({ lastRecord, secondsRemaining });
    showToast(
      'warning',
      'Marcação Recente Detectada',
      `Bloqueio preventivo: intervalo inferior a 60 segundos desde a última batida às ${lastRecord.formattedTime}.`
    );
  };

  const handleResetData = () => {
    if (window.confirm('Deseja reiniciar a base de dados de ponto e biometria para os valores padrão de fábrica?')) {
      pontoStorage.resetDatabaseToDefault();
      handleRefresh();
      showToast('info', 'Base Restaurada', 'Os dados de exemplo foram restaurados com sucesso.');
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F6F8] text-slate-800 font-sans flex flex-col selection:bg-[#002B49] selection:text-white">
      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-5">

        {/* Active View: Biometric Terminal or HR Dashboard */}
        {currentView === 'terminal' ? (
          <BiometricTerminal
            key={`term-${dataVersion}`}
            onPunchSuccess={handlePunchSuccess}
            onTriggerContingency={handleTriggerContingency}
            onDuplicateBlocked={handleDuplicateBlocked}
            onOpenHrDashboard={() => setCurrentView('hr')}
          />
        ) : (
          <HrDashboard
            key={`hr-${dataVersion}`}
            onOpenBiometricEnrollment={emp => setEnrollmentEmployee(emp)}
            onRefreshData={handleRefresh}
            onBackToTerminal={() => setCurrentView('terminal')}
          />
        )}
      </main>

      {/* Transportes Sigma Style Official Institutional Footer */}
      <footer className="bg-[#002B49] text-white border-t border-slate-700 py-6 px-4 text-xs mt-auto shadow-inner">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Scale className="w-5 h-5 text-[#C4A052]" />
            <div>
              <p className="font-bold text-slate-100">
                Tribunal de Justiça do Estado do Paraná - TJPR
              </p>
              <p className="text-[11px] text-blue-200">
                Divisão de Gestão de Pessoal e Ponto Eletrônico (SIGPAT PontoBio)
              </p>
            </div>
          </div>
          <div className="text-center sm:text-right text-[11px] text-slate-400">
            <p>Em conformidade com as diretrizes do Design System Oficial do TJPR e Portaria MTP 671/2021</p>
            <p className="font-mono text-[10px] text-blue-300">
              Versão 3.4.1-TJPR • Sincronismo Oficial NTP.br Stratum 1 • Hash Ledger SHA-256
            </p>
          </div>
        </div>
      </footer>

      {/* MODAL 1: Digital Receipt (RN06) */}
      {receiptRecord && (
        <DigitalReceiptModal
          record={receiptRecord}
          onClose={() => setReceiptRecord(null)}
        />
      )}

      {/* MODAL 2: Contingency Mode (RN05) */}
      {contingencyTarget && (
        <ContingencyModal
          employee={contingencyTarget.employee}
          punchType={contingencyTarget.punchType}
          onSuccess={() => {
            setContingencyTarget(null);
            handleRefresh();
            const latestRecords = pontoStorage.getRecords();
            if (latestRecords.length > 0) {
              setReceiptRecord(latestRecords[latestRecords.length - 1]);
            }
            showToast(
              'success',
              'Contingência Validada',
              'Marcação assistida registrada com sucesso e lançada na trilha de auditoria.'
            );
          }}
          onCancel={() => setContingencyTarget(null)}
        />
      )}

      {/* MODAL 3: Duplicate Warning (< 60s) */}
      {duplicateWarning && (
        <DuplicateWarningModal
          lastRecord={duplicateWarning.lastRecord}
          initialSecondsRemaining={duplicateWarning.secondsRemaining}
          onClose={() => setDuplicateWarning(null)}
        />
      )}

      {/* MODAL 4: Biometric Enrollment (RN01) */}
      {enrollmentEmployee && (
        <BiometricRegistrationModal
          employee={enrollmentEmployee}
          onClose={() => setEnrollmentEmployee(null)}
          onSaved={() => {
            handleRefresh();
            showToast('success', 'Biometria Atualizada', 'Credencial biométrica única salva com sucesso.');
          }}
        />
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-xl text-slate-800 animate-in slide-in-from-bottom-5">
          <div className="flex items-start gap-3">
            {toastMessage.type === 'success' && (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            )}
            {toastMessage.type === 'warning' && (
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            )}
            {toastMessage.type === 'info' && (
              <Info className="h-5 w-5 text-[#002B49] shrink-0 mt-0.5" />
            )}
            <div className="space-y-1 text-xs">
              <h5 className="font-bold text-[#002B49]">{toastMessage.title}</h5>
              <p className="text-slate-600 leading-relaxed">{toastMessage.description}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
