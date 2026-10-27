import React, { useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Dices,
  FileSpreadsheet,
  FileText,
  Filter,
  Fingerprint,
  MapPin,
  RefreshCw,
  Scan,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Sun,
  Sunset,
  User,
  UserPlus,
} from 'lucide-react';
import { COMPANY_INFO } from '../data/mockEmployees';
import { AuditLogEntry, Employee, TimeRecord } from '../types/ponto';
import { pontoStorage } from '../services/pontoStorage';
import { evaluateDailyWorkdayStatus } from '../utils/geo';
import { DigitalReceiptModal } from './DigitalReceiptModal';

interface HrDashboardProps {
  onOpenBiometricEnrollment: (employee: Employee) => void;
  onRefreshData: () => void;
  onBackToTerminal?: () => void;
}

export const HrDashboard: React.FC<HrDashboardProps> = ({
  onOpenBiometricEnrollment,
  onRefreshData,
  onBackToTerminal,
}) => {
  const [activeTab, setActiveTab] = useState<'records' | 'hours_summary' | 'audit_logs' | 'employees'>('records');
  const [searchQuery, setSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [toleranceFilter, setToleranceFilter] = useState<string>('all');
  const [selectedReceiptRecord, setSelectedReceiptRecord] = useState<TimeRecord | null>(null);

  const employees = pontoStorage.getEmployees();
  const records = pontoStorage.getRecords();
  const auditLogs = pontoStorage.getAuditLogs();

  const filteredRecords = records.filter(rec => {
    const matchesSearch =
      rec.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.employeeMatricula.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.employeeCpf.includes(searchQuery) ||
      String(rec.nsr).includes(searchQuery);

    const matchesMethod =
      methodFilter === 'all' ||
      (methodFilter === 'biometria' && (rec.method === 'biometria_facial' || rec.method === 'biometria_digital')) ||
      (methodFilter === 'contingencia' && rec.method === 'contingencia');

    const matchesTolerance =
      toleranceFilter === 'all' ||
      rec.toleranceCategory === toleranceFilter;

    return matchesSearch && matchesMethod && matchesTolerance;
  });

  const calculateEmployeeDailyHours = (emp: Employee) => {
    const empRecords = records
      .filter(r => r.employeeId === emp.id)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    let totalMilliseconds = 0;
    let entryTime: Date | null = null;

    empRecords.forEach(rec => {
      const recDate = new Date(rec.timestamp);
      if (rec.type === '1_ENTRADA' || rec.type === '2_ENTRADA_INTERVALO' || rec.type === 'HORA_EXTRA_ENTRADA') {
        entryTime = recDate;
      } else if (
        (rec.type === '1_SAIDA_INTERVALO' || rec.type === '2_SAIDA_FINAL' || rec.type === 'HORA_EXTRA_SAIDA') &&
        entryTime
      ) {
        totalMilliseconds += Math.max(0, recDate.getTime() - entryTime.getTime());
        entryTime = null;
      }
    });

    const totalHours = totalMilliseconds / (1000 * 60 * 60);
    const wholeHours = Math.floor(totalHours);
    const wholeMinutes = Math.floor((totalHours - wholeHours) * 60);
    const formattedWorked = `${String(wholeHours).padStart(2, '0')}:${String(wholeMinutes).padStart(2, '0')}h`;

    const expectedHours = emp.shift.dailyHours;
    const diffHours = totalHours - expectedHours;
    const diffMins = Math.round(diffHours * 60);

    return {
      punchesCount: empRecords.length,
      formattedWorked,
      totalHours,
      diffMins,
      balanceLabel:
        Math.abs(diffMins) <= 10
          ? 'Em conformidade'
          : diffMins > 0
          ? `+${Math.floor(diffMins / 60)}h ${diffMins % 60}m extra`
          : `-${Math.floor(Math.abs(diffMins) / 60)}h ${Math.abs(diffMins) % 60}m a compensar`,
    };
  };

  const handleExportCsv = () => {
    const headers = [
      'NSR',
      'Data',
      'Hora',
      'Matricula',
      'Nome',
      'CPF',
      'Tipo_Marcacao',
      'Metodo',
      'Status_Tolerancia',
      'Desvio_Minutos',
      'Justificativa',
      'Hash_SHA256',
    ];

    const rows = filteredRecords.map(r => [
      r.nsr,
      r.formattedDate,
      r.formattedTime,
      `"${r.employeeMatricula}"`,
      `"${r.employeeName}"`,
      `"${r.employeeCpf}"`,
      `"${r.typeLabel}"`,
      `"${r.method}"`,
      `"${r.toleranceCategory}"`,
      r.varianceMinutes,
      `"${r.justification || ''}"`,
      `"${r.hashSha256}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Relatorio_Ponto_Eletronico_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleJustifyEmployeeDay = async (empId: string) => {
    try {
      await pontoStorage.justifyDayWithRandomPunches(empId);
      onRefreshData();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-5">
      {/* Navigation Tabs and Actions on the same row */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('records')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'records'
                ? 'bg-[#002B49] text-white shadow-xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Espelho de Marcações ({records.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('hours_summary')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'hours_summary'
                ? 'bg-[#002B49] text-white shadow-xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Apuração & Banco de Horas
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('audit_logs')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'audit_logs'
                ? 'bg-[#002B49] text-white shadow-xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Trilha de Auditoria ({auditLogs.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('employees')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'employees'
                ? 'bg-[#002B49] text-white shadow-xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Colaboradores & Biometria ({employees.length})
          </button>
        </div>

        {/* Action Buttons on the same line */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4 text-slate-500" />
            <span>Exportar CSV</span>
          </button>

          {onBackToTerminal && (
            <button
              type="button"
              onClick={onBackToTerminal}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#C4A052] hover:bg-[#b08d42] px-4 py-2 text-xs font-bold text-slate-950 shadow-xs transition-colors cursor-pointer"
            >
              <Scan className="h-4 w-4" />
              <span>Voltar ao Terminal</span>
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: RECORDS TABLE */}
      {activeTab === 'records' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Filtrar por colaborador, matrícula, CPF ou NSR..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-[#F4F6F8] border border-slate-300 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 font-medium focus:outline-none focus:border-[#002B49]"
              />
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="method-filter-select" className="sr-only">Método de Marcação</label>
              <select
                id="method-filter-select"
                aria-label="Método de Marcação"
                value={methodFilter}
                onChange={e => setMethodFilter(e.target.value)}
                className="bg-[#F4F6F8] border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-700 font-medium focus:outline-none focus:border-[#002B49]"
              >
                <option value="all">Todos os Métodos</option>
                <option value="biometria">Apenas Biometria (Facial / Digital)</option>
                <option value="contingencia">Apenas Contingência</option>
              </select>

              <label htmlFor="tolerance-filter-select" className="sr-only">Status de Tolerância</label>
              <select
                id="tolerance-filter-select"
                aria-label="Status de Tolerância"
                value={toleranceFilter}
                onChange={e => setToleranceFilter(e.target.value)}
                className="bg-[#F4F6F8] border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-700 font-medium focus:outline-none focus:border-[#002B49]"
              >
                <option value="all">Todas as Tolerâncias</option>
                <option value="normal">Normal / Exato</option>
                <option value="tolerancia_aplicada">Tolerância CLT (±5 min)</option>
                <option value="atraso">Atraso (&gt;5 min)</option>
                <option value="hora_extra">Hora Extra (&gt;5 min)</option>
                <option value="saida_antecipada">Saída Antecipada</option>
              </select>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-700 font-bold uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="px-4 py-3 font-mono">NSR</th>
                  <th className="px-4 py-3">Data / Hora</th>
                  <th className="px-4 py-3">Colaborador</th>
                  <th className="px-4 py-3">Marcação</th>
                  <th className="px-4 py-3">Método</th>
                  <th className="px-4 py-3">Ponto & Geolocalização TJPR</th>
                  <th className="px-4 py-3">Conformidade CLT</th>
                  <th className="px-4 py-3 text-right">Comprovante</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                      Nenhum registro encontrado com os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map(rec => (
                    <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-[#002B49] tabular-nums">
                        #{String(rec.nsr).padStart(6, '0')}
                      </td>
                      <td className="px-4 py-3 font-mono tabular-nums">
                        <div className="font-bold text-slate-900">{rec.formattedTime}</div>
                        <span className="text-[11px] text-slate-500">{rec.formattedDate}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-[#002B49]">{rec.employeeName}</div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {rec.employeeMatricula} · CPF {rec.employeeCpf}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-slate-800">{rec.typeLabel}</span>
                      </td>
                      <td className="px-4 py-3">
                        {rec.method === 'biometria_facial' && (
                          <span className="inline-flex items-center gap-1 font-bold text-[#002B49]">
                            Biometria Facial
                          </span>
                        )}
                        {rec.method === 'biometria_digital' && (
                          <span className="inline-flex items-center gap-1 font-bold text-teal-700">
                            Sensor Dactilar
                          </span>
                        )}
                        {rec.method === 'contingencia' && (
                          <span className="inline-flex items-center gap-1 font-bold text-amber-800" title={rec.justification}>
                            Contingência*
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-[#C4A052] shrink-0 mt-0.5" />
                          <div>
                            <div className="font-bold text-[#002B49] text-[11px] leading-tight">
                              {rec.geolocation?.pointName || 'Palácio da Justiça - TJPR'}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {rec.geolocation?.comarca || 'Comarca de Curitiba'} ·{' '}
                              <span className="font-mono text-slate-400">
                                {rec.geolocation ? `${rec.geolocation.latitude.toFixed(4)}, ${rec.geolocation.longitude.toFixed(4)}` : '-25.4143, -49.2662'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {rec.toleranceCategory === 'normal' && (
                          <span className="text-slate-600">Horário exato</span>
                        )}
                        {rec.toleranceCategory === 'tolerancia_aplicada' && (
                          <span className="inline-block rounded bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-[11px] font-bold">
                            Tolerância CLT ({rec.varianceMinutes > 0 ? `+${rec.varianceMinutes}` : rec.varianceMinutes}m)
                          </span>
                        )}
                        {rec.toleranceCategory === 'atraso' && (
                          <span className="inline-block rounded bg-red-50 text-red-800 border border-red-200 px-2 py-0.5 text-[11px] font-bold">
                            Atraso (+{rec.varianceMinutes}m)
                          </span>
                        )}
                        {rec.toleranceCategory === 'hora_extra' && (
                          <span className="inline-block rounded bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 text-[11px] font-bold">
                            Hora Extra ({rec.varianceMinutes > 0 ? `+${rec.varianceMinutes}` : rec.varianceMinutes}m)
                          </span>
                        )}
                        {rec.toleranceCategory === 'saida_antecipada' && (
                          <span className="inline-block rounded bg-red-50 text-red-800 border border-red-200 px-2 py-0.5 text-[11px] font-bold">
                            Saída Antecipada ({rec.varianceMinutes}m)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedReceiptRecord(rec)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white hover:bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-700 shadow-2xs transition-colors cursor-pointer"
                        >
                          <FileText className="h-3.5 w-3.5 text-[#002B49]" />
                          <span>Ver</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: HOURS SUMMARY & ACCUMULATION */}
      {activeTab === 'hours_summary' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-[#002B49]">Consolidação de Jornada e Banco de Horas</h3>
              <p className="text-xs text-slate-500">
                Cálculo automatizado para fechamento de folha de pagamento conforme escala e regras do Art. 58 da CLT.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-[#002B49] bg-blue-50 px-2.5 py-1 rounded border border-blue-200">
              Regime 8 Horas
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-700 font-bold uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="px-4 py-3">Colaborador</th>
                  <th className="px-4 py-3">Escala Prevista</th>
                  <th className="px-4 py-3">Jornada Diária (Manhã + Tarde)</th>
                  <th className="px-4 py-3">Horas Computadas</th>
                  <th className="px-4 py-3">Saldo / Conformidade</th>
                  <th className="px-4 py-3 text-right">Justificar Dia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {employees.map(emp => {
                  const stats = calculateEmployeeDailyHours(emp);
                  const empRecords = records.filter(r => r.employeeId === emp.id);
                  const workday = evaluateDailyWorkdayStatus(empRecords);

                  return (
                    <tr key={emp.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3">
                        <div className="font-bold text-[#002B49]">{emp.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{emp.matricula} · {emp.department}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-mono">
                        {emp.shift.entry1} - {emp.shift.exit1} / {emp.shift.entry2} - {emp.shift.exit2} ({emp.shift.dailyHours}h)
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <span
                            className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded text-[11px] border ${
                              workday.isDayJustified
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : workday.hasMorningPunch || workday.hasAfternoonPunch
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {workday.isDayJustified ? (
                              <>
                                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                Dia Justificado (2/2)
                              </>
                            ) : (
                              `${workday.totalPunchesToday}/2 Batidas`
                            )}
                          </span>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {workday.morningRecord ? `☀️ ${workday.morningRecord.formattedTime}` : '☀️ Pendente'} ·{' '}
                            {workday.afternoonRecord ? `🌆 ${workday.afternoonRecord.formattedTime}` : '🌆 Pendente'}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-[#002B49] text-sm tabular-nums">
                        {stats.formattedWorked}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`font-bold ${
                            Math.abs(stats.diffMins) <= 10
                              ? 'text-emerald-700'
                              : stats.diffMins > 0
                              ? 'text-amber-800'
                              : 'text-red-700'
                          }`}
                        >
                          {stats.balanceLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleJustifyEmployeeDay(emp.id)}
                          title="Gerar 2 batidas aleatórias (manhã e tarde) para justificar o dia trabalhado"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-md bg-[#C4A052] hover:bg-[#b08d42] text-slate-950 shadow-2xs transition-all cursor-pointer"
                        >
                          <Dices className="h-3.5 w-3.5" />
                          <span>2 Batidas Aleatórias</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: AUDIT LOGS */}
      {activeTab === 'audit_logs' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-[#002B49]">Trilha de Auditoria Digital e Eventos de Segurança</h3>
              <p className="text-xs text-slate-500">
                Histórico imutável de eventos biométricos, tentativas inválidas, bloqueios e registros em contingência.
              </p>
            </div>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
              Auditoria Ativa
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-700 font-bold uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="px-4 py-3">Data / Hora</th>
                  <th className="px-4 py-3">Evento</th>
                  <th className="px-4 py-3">Colaborador</th>
                  <th className="px-4 py-3">Terminal / IP</th>
                  <th className="px-4 py-3">Descrição Detalhada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {auditLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-mono text-slate-600 tabular-nums">
                      {new Date(log.timestamp).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`font-bold ${
                          log.severity === 'success'
                            ? 'text-emerald-700'
                            : log.severity === 'warning'
                            ? 'text-amber-700'
                            : log.severity === 'alert'
                            ? 'text-red-700'
                            : 'text-[#002B49]'
                        }`}
                      >
                        {log.eventType}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {log.employeeName ? (
                        <div>
                          <span className="font-bold text-[#002B49]">{log.employeeName}</span>
                          <span className="block text-[11px] text-slate-500 font-mono">
                            {log.matricula}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500">Sistema Geral</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500 text-[11px]">
                      {log.terminalId} · {log.ipAddress}
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-mono text-[11px]">
                      {log.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: EMPLOYEE BIOMETRIC MANAGEMENT */}
      {activeTab === 'employees' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-[#002B49]">Cadastro e Unicidade Biométrica (RN01)</h3>
              <p className="text-xs text-slate-500">
                Cada colaborador ativo possui apenas uma credencial biométrica vinculada à sua matrícula e CPF.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {employees.map(emp => (
              <div
                key={emp.id}
                className="rounded-xl border border-slate-200 bg-[#F4F6F8] p-4 space-y-3 flex flex-col justify-between shadow-xs"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-10 w-10 rounded-lg flex items-center justify-center font-bold text-white text-sm bg-[#002B49] border-2 border-[#C4A052] shadow-sm"
                    >
                      {emp.name
                        .split(' ')
                        .map(n => n[0])
                        .slice(0, 2)
                        .join('')}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#002B49]">{emp.name}</h4>
                      <p className="text-xs text-slate-600">{emp.role}</p>
                    </div>
                  </div>

                  <div className="space-y-1 pt-1 text-xs text-slate-600">
                    <div className="flex justify-between">
                      <span>Matrícula:</span>
                      <span className="font-mono font-bold text-[#002B49]">{emp.matricula}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>CPF:</span>
                      <span className="font-mono font-semibold text-slate-700">{emp.cpf}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Face Registrada:</span>
                      <span className={emp.faceRegistered ? 'text-emerald-700 font-bold' : 'text-slate-500'}>
                        {emp.faceRegistered ? 'Sim' : 'Não'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Digital Registrada:</span>
                      <span className={emp.fingerprintRegistered ? 'text-teal-700 font-bold' : 'text-slate-500'}>
                        {emp.fingerprintRegistered ? 'Sim' : 'Não'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>PIN Contingência:</span>
                      <span className="font-mono text-slate-700">{emp.pin}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => onOpenBiometricEnrollment(emp)}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 py-2 text-xs font-bold text-slate-700 shadow-2xs transition-colors cursor-pointer"
                  >
                    <Fingerprint className="h-3.5 w-3.5 text-[#002B49]" />
                    <span>Configurar Biometria</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Digital Receipt Modal trigger */}
      {selectedReceiptRecord && (
        <DigitalReceiptModal
          record={selectedReceiptRecord}
          onClose={() => setSelectedReceiptRecord(null)}
        />
      )}
    </div>
  );
};
