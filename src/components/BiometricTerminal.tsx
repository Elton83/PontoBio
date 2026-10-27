import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Camera,
  CheckCircle2,
  Clock,
  Dices,
  Fingerprint,
  LayoutDashboard,
  MapPin,
  Navigation,
  RefreshCw,
  Scan,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Sun,
  Sunset,
  User,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Employee, PunchType, TimeRecord } from '../types/ponto';
import { pontoStorage } from '../services/pontoStorage';
import { ntpKeeper, NtpStatus } from '../utils/ntp';
import { getPunchTypeLabel } from '../utils/tolerance';
import {
  TJPR_LOCATIONS,
  TjprLocationPoint,
  buildGeoLocation,
  detectCurrentGeoLocation,
  evaluateDailyWorkdayStatus,
} from '../utils/geo';
import { TjprLogo } from './TjprLogo';

interface BiometricTerminalProps {
  onPunchSuccess: (record: TimeRecord) => void;
  onTriggerContingency: (employee: Employee, punchType: PunchType) => void;
  onDuplicateBlocked: (lastRecord: TimeRecord, secondsRemaining: number) => void;
  onOpenHrDashboard?: () => void;
}

export const BiometricTerminal: React.FC<BiometricTerminalProps> = ({
  onPunchSuccess,
  onTriggerContingency,
  onDuplicateBlocked,
  onOpenHrDashboard,
}) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [authMode, setAuthMode] = useState<'facial' | 'fingerprint'>('facial');
  const [selectedPunchType, setSelectedPunchType] = useState<PunchType>('1_ENTRADA');
  const [isPunchTypeManual, setIsPunchTypeManual] = useState(false);

  // Geographic Location & TJPR Point
  const [selectedLocationPoint, setSelectedLocationPoint] = useState<TjprLocationPoint>(TJPR_LOCATIONS[0]);
  const [isDetectingGps, setIsDetectingGps] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [isGeneratingRandomDay, setIsGeneratingRandomDay] = useState(false);

  // Time & NTP
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('');
  const [currentDateStr, setCurrentDateStr] = useState<string>('');
  const [ntpStatus, setNtpStatus] = useState<NtpStatus>(ntpKeeper.getStatus());

  // Scanner States
  const [scanState, setScanState] = useState<'idle' | 'scanning' | 'matched' | 'failed'>('idle');
  const [scanProgress, setScanProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string>('Posicione-se em frente ao leitor');
  const [audioFeedback, setAudioFeedback] = useState(true);

  // WebRTC Camera
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraPermissionError, setCameraPermissionError] = useState(false);

  useEffect(() => {
    refreshEmployeeList();
  }, []);

  const refreshEmployeeList = () => {
    const list = pontoStorage.getEmployees();
    setEmployees(list);
    if (list.length > 0 && !selectedEmpId) {
      setSelectedEmpId(list[0].id);
    }
  };

  const currentEmployee = employees.find(e => e.id === selectedEmpId) || employees[0];

  useEffect(() => {
    if (currentEmployee && !isPunchTypeManual) {
      const suggested = pontoStorage.suggestNextPunchType(currentEmployee.id);
      setSelectedPunchType(suggested);
    }
  }, [currentEmployee, isPunchTypeManual]);

  useEffect(() => {
    const updateClock = () => {
      setCurrentTimeStr(ntpKeeper.formatBrazilianTime());
      setCurrentDateStr(ntpKeeper.formatBrazilianDate());
      setNtpStatus(ntpKeeper.getStatus());
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let stream: MediaStream | null = null;
    if (authMode === 'facial') {
      navigator.mediaDevices
        ?.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' } })
        .then(s => {
          stream = s;
          if (videoRef.current) {
            videoRef.current.srcObject = s;
            setCameraActive(true);
            setCameraPermissionError(false);
          }
        })
        .catch(() => {
          setCameraActive(false);
          setCameraPermissionError(true);
        });
    } else {
      setCameraActive(false);
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, [authMode]);

  const playBeep = (type: 'success' | 'error') => {
    if (!audioFeedback || typeof window === 'undefined') return;
    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'success') {
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        osc.frequency.setValueAtTime(1760, audioCtx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.22);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.22);
      } else {
        osc.frequency.setValueAtTime(320, audioCtx.currentTime);
        osc.frequency.setValueAtTime(220, audioCtx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
      }
    } catch (e) {
      // AudioContext policy fallback
    }
  };

  const handleTriggerBiometricPunch = async (simulateMismatch = false) => {
    if (!currentEmployee) return;

    if (currentEmployee.isBiometricBlocked || currentEmployee.consecutiveFailures >= 3) {
      onTriggerContingency(currentEmployee, selectedPunchType);
      return;
    }

    if (!currentEmployee.biometricRegistered) {
      setStatusMessage('Biometria não cadastrada para esta matrícula');
      setScanState('failed');
      playBeep('error');
      pontoStorage.recordBiometricFailure(
        currentEmployee.id,
        'Credencial biométrica inexistente na base de dados'
      );
      refreshEmployeeList();
      return;
    }

    const duplicateCheck = pontoStorage.checkDuplicatePunch(currentEmployee.id, 60);
    if (duplicateCheck.isDuplicate && duplicateCheck.lastPunch) {
      playBeep('error');
      pontoStorage.addAuditLog({
        eventType: 'BLOQUEIO_DUPLICIDADE',
        employeeId: currentEmployee.id,
        employeeName: currentEmployee.name,
        matricula: currentEmployee.matricula,
        details: `Batida bloqueada: marcação realizada há menos de 60s (última às ${duplicateCheck.lastPunch.formattedTime}).`,
        severity: 'warning',
      });
      onDuplicateBlocked(duplicateCheck.lastPunch, duplicateCheck.secondsRemaining);
      return;
    }

    setScanState('scanning');
    setStatusMessage(
      authMode === 'facial'
        ? 'Processando malha facial & prova de vida...'
        : 'Lendo minúcias e conformação dactilar...'
    );
    setScanProgress(0);

    const startTime = Date.now();
    const duration = 1100;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(100, Math.floor((elapsed / duration) * 100));
      setScanProgress(progress);

      if (elapsed >= duration) {
        clearInterval(interval);

        if (simulateMismatch) {
          handleBiometricFailure('Inconsistência nos pontos de minúcia / face não identificada');
        } else {
          handleBiometricSuccess();
        }
      }
    }, 40);
  };

  const handleBiometricSuccess = async () => {
    if (!currentEmployee) return;

    setScanState('matched');
    setStatusMessage('Biometria Confirmada (Correspondência 99.4%)');
    playBeep('success');

    const method = authMode === 'facial' ? 'biometria_facial' : 'biometria_digital';
    const geo = buildGeoLocation(selectedLocationPoint);

    try {
      const record = await pontoStorage.addTimeRecord({
        employee: currentEmployee,
        type: selectedPunchType,
        method,
        geolocation: geo,
      });

      refreshEmployeeList();

      setTimeout(() => {
        setScanState('idle');
        setScanProgress(0);
        setStatusMessage('Posicione-se em frente ao leitor');
        onPunchSuccess(record);
      }, 700);
    } catch (err) {
      console.error(err);
      setScanState('failed');
      setStatusMessage('Erro ao persistir registro');
    }
  };

  const handleBiometricFailure = (reason: string) => {
    if (!currentEmployee) return;

    setScanState('failed');
    setStatusMessage('Biometria não reconhecida. Tente novamente.');
    playBeep('error');

    const result = pontoStorage.recordBiometricFailure(currentEmployee.id, reason);
    refreshEmployeeList();

    if (result.isBlocked) {
      setTimeout(() => {
        setScanState('idle');
        onTriggerContingency(currentEmployee, selectedPunchType);
      }, 1000);
    } else {
      setTimeout(() => {
        setScanState('idle');
        setScanProgress(0);
        setStatusMessage('Posicione-se em frente ao leitor');
      }, 2000);
    }
  };

  const handleDetectGps = async () => {
    setIsDetectingGps(true);
    setStatusMessage('Calibrando sinal GPS com percurso TJPR...');
    try {
      const geo = await detectCurrentGeoLocation(selectedLocationPoint);
      setGpsAccuracy(geo.accuracy);
      setStatusMessage(`GPS Verificado: ${geo.pointName} (precisão ${geo.accuracy}m)`);
      playBeep('success');
    } catch (e) {
      console.warn(e);
      setStatusMessage('Localização TJPR padrão mantida.');
    } finally {
      setIsDetectingGps(false);
    }
  };

  const handleJustifyDayRandom = async () => {
    if (!currentEmployee) return;
    try {
      setIsGeneratingRandomDay(true);
      setStatusMessage('Gerando marcações aleatórias (Manhã e Tarde)...');
      playBeep('success');

      const { morningRecord, afternoonRecord } = await pontoStorage.justifyDayWithRandomPunches(
        currentEmployee.id,
        {
          preferredMethod: authMode === 'facial' ? 'biometria_facial' : 'biometria_digital',
          locationPoint: selectedLocationPoint,
        }
      );

      refreshEmployeeList();
      setIsGeneratingRandomDay(false);
      setStatusMessage('Dia trabalhado justificado com sucesso!');
      onPunchSuccess(afternoonRecord);
    } catch (err) {
      console.error(err);
      setIsGeneratingRandomDay(false);
      setStatusMessage('Erro ao justificar dia');
    }
  };

  const todayRecords = currentEmployee
    ? pontoStorage.getRecordsForEmployeeToday(currentEmployee.id)
    : [];

  const dailyStatus = evaluateDailyWorkdayStatus(todayRecords);

  return (
    <div className="flex flex-col gap-5">
      {/* Top Status & Live Clock Bar (with Official TJPR Logo) */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-6 py-4 shadow-xs">
        <div className="flex items-center gap-3.5">
          {/* Official TJPR Logo (Placed at red box in Image 2) */}
          <TjprLogo className="w-12 h-12 shadow-xs shrink-0 rounded-xl" size={48} />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-[#002B49] tracking-tight leading-tight">
                Terminal de Registro Biométrico REP-P
              </h2>
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-50 text-[#002B49] border border-blue-200">
                Oficial TJPR
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
              <span>{ntpStatus.server.split('(')[0].trim()}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-emerald-600 font-bold">Jitter: ±{ntpStatus.jitterMs}ms</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">Offset: {ntpStatus.offsetMs}ms</span>
            </div>
          </div>
        </div>

        {/* Botão Painel do RH (posicionado na área central indicada pelo usuário) */}
        {onOpenHrDashboard && (
          <div className="flex items-center">
            <button
              type="button"
              onClick={onOpenHrDashboard}
              className="px-4 py-2.5 text-xs font-bold text-slate-950 bg-[#C4A052] hover:bg-[#b08d42] active:scale-95 rounded-lg shadow-xs transition-all whitespace-nowrap inline-flex items-center gap-2 cursor-pointer border border-[#C4A052]"
            >
              <LayoutDashboard className="h-4 w-4 text-slate-950" />
              <span>Painel do RH</span>
            </button>
          </div>
        )}

        {/* Live Synchronized NTP Clock */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="font-mono text-3xl font-bold tracking-tight text-[#002B49] tabular-nums leading-none">
              {currentTimeStr || '00:00:00'}
            </div>
            <div className="flex items-center justify-end gap-1.5 text-xs text-slate-500 font-medium mt-1">
              <Clock className="h-3.5 w-3.5 text-[#C4A052]" />
              <span>{currentDateStr}</span>
              <span className="text-slate-400 text-[11px]">(Horário de Brasília)</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setAudioFeedback(!audioFeedback)}
            title={audioFeedback ? 'Desativar sinal sonoro' : 'Ativar sinal sonoro'}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:text-[#002B49] hover:bg-slate-100 transition-colors cursor-pointer"
          >
            {audioFeedback ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-slate-400" />}
          </button>
        </div>
      </div>

      {/* Main Terminal Grid - Restored to spacious and elegant layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left Column: Biometric Scanner Hardware Frame (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
          {/* Header Bar with Mode Selector */}
          <div className="flex items-center justify-between bg-[#002B49] text-white px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <Scan className="w-4 h-4 text-[#C4A052]" />
              <span className="text-xs font-bold tracking-wide uppercase">
                Sensor de Autenticação Biométrica
              </span>
            </div>

            <div className="flex items-center gap-1 rounded-lg bg-[#05202B] p-0.5 border border-white/10">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('facial');
                  setScanState('idle');
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                  authMode === 'facial'
                    ? 'bg-[#C4A052] text-slate-950 shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Camera className="h-3.5 w-3.5" />
                <span>Facial</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('fingerprint');
                  setScanState('idle');
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                  authMode === 'fingerprint'
                    ? 'bg-[#C4A052] text-slate-950 shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Fingerprint className="h-3.5 w-3.5" />
                <span>Dactilar</span>
              </button>
            </div>
          </div>

          {/* Sensor Viewport - Spacious, elegant proportions */}
          <div className="relative flex-1 min-h-[380px] bg-[#05202B] flex items-center justify-center p-6 overflow-hidden select-none">
            <div className="absolute inset-0 bg-[radial-gradient(#082e3c_1px,transparent_1px)] [background-size:16px_16px] opacity-60" />

            {authMode === 'facial' ? (
              /* Facial Recognition Viewport */
              <div className="relative w-full max-w-sm aspect-[4/3] rounded-2xl overflow-hidden border-2 border-[#082E3C] bg-[#001D33] flex items-center justify-center shadow-xl">
                {cameraActive ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
                  />
                ) : (
                  /* Stylized Judicial Facial Simulator Canvas */
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-[#05202B] via-[#002B49] to-[#05202B]">
                    <div className="relative w-44 h-56 rounded-[45%] border-2 border-dashed border-[#C4A052]/50 flex items-center justify-center">
                      <div className="w-40 h-50 rounded-[48%] border border-[#38bdf8]/40 flex flex-col items-center justify-center p-4">
                        <div className="flex gap-10 mt-6 text-slate-400">
                          <div className="w-4 h-2 rounded-full border border-[#C4A052]" />
                          <div className="w-4 h-2 rounded-full border border-[#C4A052]" />
                        </div>
                        <div className="w-1.5 h-7 rounded bg-[#38bdf8]/30 my-4" />
                        <div className="w-12 h-1.5 rounded-full bg-[#C4A052]/60" />
                      </div>
                    </div>
                    {cameraPermissionError && (
                      <span className="text-xs text-slate-400 mt-2 font-medium">
                        Simulador facial ativo (câmera WebRTC disponível)
                      </span>
                    )}
                  </div>
                )}

                {/* HUD Biometric Wireframe Overlay */}
                <div className="absolute inset-0 pointer-events-none p-4 flex flex-col justify-between">
                  <div className="flex justify-between">
                    <div className="w-6 h-6 border-t-2 border-l-2 border-[#C4A052]" />
                    <div className="w-6 h-6 border-t-2 border-r-2 border-[#C4A052]" />
                  </div>

                  {/* Laser Scanning Beam */}
                  {scanState === 'scanning' && (
                    <div
                      className="absolute left-0 right-0 h-1.5 bg-[#C4A052] shadow-[0_0_15px_#C4A052] transition-all"
                      style={{ top: `${scanProgress}%` }}
                    />
                  )}

                  {/* Landmark Points */}
                  {scanState === 'scanning' && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-32 h-32 rounded-full border border-[#C4A052]/50 animate-ping opacity-30" />
                      <div className="absolute top-1/3 left-1/3 w-2 h-2 rounded-full bg-[#C4A052] shadow-[0_0_8px_#C4A052]" />
                      <div className="absolute top-1/3 right-1/3 w-2 h-2 rounded-full bg-[#C4A052] shadow-[0_0_8px_#C4A052]" />
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#38bdf8] shadow-[0_0_8px_#38bdf8]" />
                      <div className="absolute bottom-1/3 left-1/2 -translate-x-1/2 w-3 h-1.5 rounded-full bg-[#C4A052] shadow-[0_0_8px_#C4A052]" />
                    </div>
                  )}

                  <div className="flex justify-between">
                    <div className="w-6 h-6 border-b-2 border-l-2 border-[#C4A052]" />
                    <div className="w-6 h-6 border-b-2 border-r-2 border-[#C4A052]" />
                  </div>
                </div>

                {/* Overlay State Feedback */}
                {scanState === 'matched' && (
                  <div className="absolute inset-0 bg-[#002B49]/90 backdrop-blur-xs flex flex-col items-center justify-center gap-2 animate-in fade-in">
                    <CheckCircle2 className="h-12 w-12 text-[#25D366]" />
                    <span className="text-sm font-bold text-white">Reconhecimento Positivo</span>
                    <span className="text-xs text-[#C4A052] font-mono font-bold">&lt; 1.1s · Match 99.4%</span>
                  </div>
                )}

                {scanState === 'failed' && (
                  <div className="absolute inset-0 bg-[#EF5350]/90 backdrop-blur-xs flex flex-col items-center justify-center gap-2 animate-in fade-in">
                    <ShieldAlert className="h-12 w-12 text-white" />
                    <span className="text-sm font-bold text-white">Não Reconhecido</span>
                    <span className="text-xs text-white/90">Biometria Malsucedida</span>
                  </div>
                )}
              </div>
            ) : (
              /* Fingerprint Sensor Viewport */
              <div className="relative w-full max-w-xs flex flex-col items-center justify-center gap-3">
                <div
                  className={`relative w-44 h-56 rounded-2xl border-2 flex items-center justify-center transition-all cursor-pointer ${
                    scanState === 'scanning'
                      ? 'border-[#C4A052] bg-[#002B49] shadow-[0_0_24px_rgba(196,160,82,0.3)]'
                      : scanState === 'matched'
                      ? 'border-[#25D366] bg-[#002B49]'
                      : scanState === 'failed'
                      ? 'border-[#EF5350] bg-red-950/60'
                      : 'border-[#082E3C] bg-[#001D33] hover:border-[#C4A052]'
                  }`}
                  onClick={() => scanState === 'idle' && handleTriggerBiometricPunch(false)}
                >
                  <Fingerprint
                    className={`h-28 w-28 transition-colors ${
                      scanState === 'scanning'
                        ? 'text-[#C4A052] animate-pulse'
                        : scanState === 'matched'
                        ? 'text-[#25D366]'
                        : scanState === 'failed'
                        ? 'text-[#EF5350]'
                        : 'text-slate-400'
                    }`}
                  />

                  {scanState === 'scanning' && (
                    <div
                      className="absolute left-3 right-3 h-1.5 bg-[#C4A052] shadow-[0_0_12px_#C4A052]"
                      style={{ top: `${scanProgress}%` }}
                    />
                  )}

                  <div className="absolute bottom-2 text-[10px] font-mono text-[#8E9CA8] tracking-wider font-semibold">
                    OPTICAL 500 DPI
                  </div>
                </div>
                <span className="text-xs text-slate-300 font-medium">
                  Toque na digital para simular leitura
                </span>
              </div>
            )}
          </div>

          {/* Status Message & Action Bar */}
          <div className="border-t border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <div
                  className={`h-2.5 w-2.5 rounded-full ${
                    scanState === 'matched'
                      ? 'bg-emerald-500'
                      : scanState === 'failed'
                      ? 'bg-red-500'
                      : scanState === 'scanning'
                      ? 'bg-amber-500 animate-ping'
                      : 'bg-[#002B49]'
                  }`}
                />
                <span className="font-semibold text-slate-700 text-sm">{statusMessage}</span>
              </div>
              {scanState === 'scanning' && (
                <span className="font-mono text-[#002B49] font-bold tabular-nums text-xs">
                  {scanProgress}% ({((scanProgress / 100) * 1.1).toFixed(1)}s)
                </span>
              )}
            </div>

            {/* Geographic Location & TJPR Judicial Point Card */}
            <div className="rounded-xl border border-slate-200 bg-[#F4F6F8] p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-[#C4A052]" />
                  <span className="text-xs font-bold text-[#002B49] uppercase tracking-wide">
                    Ponto de Registro & Geolocalização TJPR
                  </span>
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  Perímetro Autorizado
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-2 space-y-1">
                  <label htmlFor="tjpr-location-select" className="sr-only">Unidade TJPR</label>
                  <select
                    id="tjpr-location-select"
                    value={selectedLocationPoint.id}
                    onChange={e => {
                      const pt = TJPR_LOCATIONS.find(l => l.id === e.target.value);
                      if (pt) setSelectedLocationPoint(pt);
                    }}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-semibold focus:outline-none focus:border-[#002B49]"
                  >
                    {TJPR_LOCATIONS.map(loc => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} ({loc.comarca})
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500 truncate">{selectedLocationPoint.address}</p>
                </div>

                <div className="flex sm:flex-col justify-between items-end sm:items-end gap-1">
                  <div className="text-right">
                    <span className="font-mono text-[10px] text-slate-500 block">
                      GPS: {selectedLocationPoint.latitude.toFixed(4)}, {selectedLocationPoint.longitude.toFixed(4)}
                    </span>
                    {gpsAccuracy && (
                      <span className="text-[10px] text-emerald-700 font-semibold">
                        Precisão: ±{gpsAccuracy}m
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleDetectGps}
                    disabled={isDetectingGps}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-md bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 shadow-2xs transition-all cursor-pointer"
                  >
                    <Navigation className={`h-3 w-3 text-[#002B49] ${isDetectingGps ? 'animate-spin' : ''}`} />
                    <span>{isDetectingGps ? 'Calibrando...' : 'Detectar GPS'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Action Buttons styled like Transportes Sigma */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => handleTriggerBiometricPunch(false)}
                disabled={scanState === 'scanning'}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-[#002B49] hover:bg-[#003860] px-5 py-3 text-sm font-bold text-white shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                <ShieldCheck className="h-4 w-4 text-[#C4A052]" />
                <span>Registrar com Biometria Válida</span>
              </button>

              <button
                type="button"
                onClick={() => handleTriggerBiometricPunch(true)}
                disabled={scanState === 'scanning'}
                title="Testar rejeição biométrica (Critério de Aceite 3)"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 px-4 py-3 text-sm font-bold text-red-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                <ShieldAlert className="h-4 w-4" />
                <span>Simular Falha de Leitura</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Employee Card, Sequence Predictor & Today's Summary (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          {/* Employee Selector & Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-bold text-[#002B49] uppercase tracking-wide">
                Identificação Funcional
              </span>
              <span className="text-xs text-slate-500 font-semibold">RN01 - Unicidade Cadastral</span>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="employee-select" className="block text-xs font-semibold text-slate-700">
                Colaborador Selecionado:
              </label>
              <select
                id="employee-select"
                value={selectedEmpId}
                onChange={e => {
                  setSelectedEmpId(e.target.value);
                  setIsPunchTypeManual(false);
                }}
                className="w-full bg-[#F4F6F8] border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 font-medium focus:outline-none focus:border-[#002B49]"
              >
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.matricula} · {emp.department})
                  </option>
                ))}
              </select>
            </div>

            {currentEmployee && (
              <div className="rounded-xl border border-slate-200 bg-[#F4F6F8] p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl font-bold text-white bg-[#002B49] border border-[#C4A052] shadow-xs text-sm"
                  >
                    {currentEmployee.name
                      .split(' ')
                      .map(n => n[0])
                      .slice(0, 2)
                      .join('')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-[#002B49] truncate">{currentEmployee.name}</h3>
                    <p className="text-xs text-slate-600 truncate">{currentEmployee.role}</p>
                    <p className="text-xs text-slate-500 truncate">{currentEmployee.department}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-500 text-[11px]">Matrícula Funcional:</span>
                    <p className="font-mono font-bold text-[#002B49]">{currentEmployee.matricula}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px]">CPF Vinculado:</span>
                    <p className="font-mono font-semibold text-slate-700">{currentEmployee.cpf}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">Biometria:</span>
                    {currentEmployee.biometricRegistered ? (
                      <span className="text-emerald-700 font-bold">Cadastrada & Ativa</span>
                    ) : (
                      <span className="text-amber-700 font-bold">Não Cadastrada</span>
                    )}
                  </div>
                  {currentEmployee.consecutiveFailures > 0 && (
                    <span className="text-red-600 font-mono font-bold">
                      Falhas: {currentEmployee.consecutiveFailures}/3
                    </span>
                  )}
                </div>

                {currentEmployee.isBiometricBlocked && (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-2.5 text-xs text-red-800 flex items-center justify-between">
                    <span className="font-semibold">Bloqueio de 3 falhas ativo</span>
                    <button
                      type="button"
                      onClick={() => onTriggerContingency(currentEmployee, selectedPunchType)}
                      className="text-xs font-bold underline text-red-900 hover:text-red-700"
                    >
                      Abrir Contingência
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Validação da Jornada Diária - 2 Marcações (Manhã e Tarde) para justificar o dia */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-[#C4A052]" />
                <h4 className="text-xs font-bold text-[#002B49] uppercase tracking-wide">
                  Validação da Jornada Diária TJPR
                </h4>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                  dailyStatus.isDayJustified
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : dailyStatus.hasMorningPunch || dailyStatus.hasAfternoonPunch
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                {dailyStatus.isDayJustified ? 'Dia Justificado (2/2)' : `${dailyStatus.totalPunchesToday}/2 Batidas`}
              </span>
            </div>

            {/* Shift verification boxes */}
            <div className="grid grid-cols-2 gap-2.5">
              <div
                className={`p-3 rounded-xl border text-xs transition-all ${
                  dailyStatus.hasMorningPunch
                    ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900'
                    : 'border-slate-200 bg-slate-50 text-slate-600'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1 font-bold text-[11px]">
                    <Sun className="h-3.5 w-3.5 text-amber-600" />
                    <span>Turno Manhã</span>
                  </div>
                  {dailyStatus.hasMorningPunch && (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  )}
                </div>
                {dailyStatus.hasMorningPunch ? (
                  <div>
                    <span className="font-mono font-bold text-xs">
                      {dailyStatus.morningRecord?.formattedTime}
                    </span>
                    <span className="block text-[10px] opacity-75 font-mono">
                      NSR #{dailyStatus.morningRecord?.nsr}
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPunchType('MANHA');
                      setIsPunchTypeManual(true);
                    }}
                    className="text-[10px] font-bold text-[#002B49] underline hover:text-blue-800 cursor-pointer"
                  >
                    Registrar Manhã
                  </button>
                )}
              </div>

              <div
                className={`p-3 rounded-xl border text-xs transition-all ${
                  dailyStatus.hasAfternoonPunch
                    ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900'
                    : 'border-slate-200 bg-slate-50 text-slate-600'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1 font-bold text-[11px]">
                    <Sunset className="h-3.5 w-3.5 text-orange-600" />
                    <span>Turno Tarde</span>
                  </div>
                  {dailyStatus.hasAfternoonPunch && (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  )}
                </div>
                {dailyStatus.hasAfternoonPunch ? (
                  <div>
                    <span className="font-mono font-bold text-xs">
                      {dailyStatus.afternoonRecord?.formattedTime}
                    </span>
                    <span className="block text-[10px] opacity-75 font-mono">
                      NSR #{dailyStatus.afternoonRecord?.nsr}
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPunchType('TARDE');
                      setIsPunchTypeManual(true);
                    }}
                    className="text-[10px] font-bold text-[#002B49] underline hover:text-blue-800 cursor-pointer"
                  >
                    Registrar Tarde
                  </button>
                )}
              </div>
            </div>

            {/* Random Punch Generator Button */}
            <div className="rounded-xl border border-[#C4A052]/40 bg-amber-50/40 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#002B49] flex items-center gap-1.5">
                  <Dices className="h-3.5 w-3.5 text-[#C4A052]" />
                  Justificar Dia (2 Batidas Aleatórias)
                </span>
                <span className="text-[10px] text-[#856404] font-semibold">Portaria 671</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-tight">
                Gera 2 marcações válidas em horários aleatórios (uma de manhã e outra à tarde) com coordenadas do ponto TJPR e SHA-256.
              </p>
              <button
                type="button"
                onClick={handleJustifyDayRandom}
                disabled={isGeneratingRandomDay}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#C4A052] hover:bg-[#b08d42] active:scale-98 px-3.5 py-2.5 text-xs font-bold text-slate-950 shadow-2xs transition-all cursor-pointer"
              >
                <Sparkles className="h-4 w-4" />
                <span>
                  {isGeneratingRandomDay ? 'Gerando Marcações...' : 'Gerar Batidas Aleatórias (Manhã e Tarde)'}
                </span>
              </button>
            </div>
          </div>

          {/* RN04 - Journey Sequencing & Next Step Suggestion */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div>
                <h4 className="text-xs font-bold text-[#002B49] uppercase tracking-wide">
                  Sequenciamento da Jornada
                </h4>
                <p className="text-[11px] text-slate-500">RN04 - Sugestão automática ou seleção de turno</p>
              </div>
              <span className="text-[10px] rounded bg-blue-50 text-[#002B49] border border-blue-200 px-2 py-0.5 font-bold">
                Automático
              </span>
            </div>

            {/* Direct shift quick buttons */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setSelectedPunchType('MANHA');
                  setIsPunchTypeManual(true);
                }}
                className={`p-2.5 rounded-lg text-left transition-all cursor-pointer flex items-center justify-between ${
                  selectedPunchType === 'MANHA'
                    ? 'border-2 border-[#002B49] bg-blue-50 text-[#002B49] font-bold shadow-2xs'
                    : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Sun className="h-3.5 w-3.5 text-amber-600" />
                  <span className="font-bold text-xs">Turno Manhã</span>
                </div>
                <span className="text-[10px] text-slate-500">08:00 - 12:00</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedPunchType('TARDE');
                  setIsPunchTypeManual(true);
                }}
                className={`p-2.5 rounded-lg text-left transition-all cursor-pointer flex items-center justify-between ${
                  selectedPunchType === 'TARDE'
                    ? 'border-2 border-[#002B49] bg-blue-50 text-[#002B49] font-bold shadow-2xs'
                    : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Sunset className="h-3.5 w-3.5 text-orange-600" />
                  <span className="font-bold text-xs">Turno Tarde</span>
                </div>
                <span className="text-[10px] text-slate-500">13:00 - 18:00</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setSelectedPunchType('1_ENTRADA');
                  setIsPunchTypeManual(true);
                }}
                className={`p-2.5 rounded-lg text-left transition-all cursor-pointer ${
                  selectedPunchType === '1_ENTRADA'
                    ? 'border-2 border-[#002B49] bg-blue-50/70 text-[#002B49] font-bold shadow-2xs'
                    : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="text-[10px] text-slate-500">1º Passo</div>
                <div className="text-xs font-bold">1ª Entrada</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedPunchType('1_SAIDA_INTERVALO');
                  setIsPunchTypeManual(true);
                }}
                className={`p-2.5 rounded-lg text-left transition-all cursor-pointer ${
                  selectedPunchType === '1_SAIDA_INTERVALO'
                    ? 'border-2 border-[#002B49] bg-blue-50/70 text-[#002B49] font-bold shadow-2xs'
                    : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="text-[10px] text-slate-500">2º Passo</div>
                <div className="text-xs font-bold">1ª Saída Intervalo</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedPunchType('2_ENTRADA_INTERVALO');
                  setIsPunchTypeManual(true);
                }}
                className={`p-2.5 rounded-lg text-left transition-all cursor-pointer ${
                  selectedPunchType === '2_ENTRADA_INTERVALO'
                    ? 'border-2 border-[#002B49] bg-blue-50/70 text-[#002B49] font-bold shadow-2xs'
                    : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="text-[10px] text-slate-500">3º Passo</div>
                <div className="text-xs font-bold">2ª Entrada Intervalo</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedPunchType('2_SAIDA_FINAL');
                  setIsPunchTypeManual(true);
                }}
                className={`p-2.5 rounded-lg text-left transition-all cursor-pointer ${
                  selectedPunchType === '2_SAIDA_FINAL'
                    ? 'border-2 border-[#002B49] bg-blue-50/70 text-[#002B49] font-bold shadow-2xs'
                    : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="text-[10px] text-slate-500">4º Passo</div>
                <div className="text-xs font-bold">2ª Saída Final</div>
              </button>
            </div>

            <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs flex items-center justify-between">
              <span className="text-slate-600">Marcação selecionada:</span>
              <span className="font-bold text-[#002B49]">
                {getPunchTypeLabel(selectedPunchType)}
              </span>
            </div>
          </div>

          {/* Today's Punches for this Employee */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="text-xs font-bold text-[#002B49] uppercase tracking-wide">
                Marcações de Hoje
              </h4>
              <span className="font-mono text-xs text-slate-500 font-semibold tabular-nums">
                {todayRecords.length} registro(s)
              </span>
            </div>

            {todayRecords.length === 0 ? (
              <p className="text-xs text-slate-500 py-2 text-center">
                Nenhuma marcação realizada hoje por este colaborador.
              </p>
            ) : (
              <div className="space-y-2">
                {todayRecords.map((rec, i) => (
                  <div
                    key={rec.id}
                    className="flex items-center justify-between rounded-lg bg-[#F4F6F8] border border-slate-200 px-3.5 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-slate-400 font-bold">#{i + 1}</span>
                      <span className="font-semibold text-slate-800">{rec.typeLabel}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-[#002B49] tabular-nums text-xs">
                        {rec.formattedTime}
                      </span>
                      <span className="block text-[10px] text-slate-500 font-mono">
                        NSR {rec.nsr}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
