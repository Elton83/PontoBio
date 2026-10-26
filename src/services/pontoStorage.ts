import { COMPANY_INFO, INITIAL_EMPLOYEES } from '../data/mockEmployees';
import { AuditLogEntry, Employee, PunchType, TimeRecord } from '../types/ponto';
import { computeRecordHash } from '../utils/crypto';
import { ntpKeeper } from '../utils/ntp';
import { evaluateTolerance, getPunchTypeLabel } from '../utils/tolerance';

const STORAGE_KEYS = {
  EMPLOYEES: 'pontobio_employees_v1',
  RECORDS: 'pontobio_records_v1',
  AUDIT_LOGS: 'pontobio_audit_logs_v1',
  NSR_COUNTER: 'pontobio_nsr_counter_v1',
  CONFIG: 'pontobio_config_v1',
};

// Seed records helper
async function createInitialRecords(): Promise<{ records: TimeRecord[]; lastNsr: number }> {
  const records: TimeRecord[] = [];
  let nsr = 10001;
  let previousHash = '0000000000000000000000000000000000000000000000000000000000000000';

  // Seed sample records for today and yesterday
  const baseEmp = INITIAL_EMPLOYEES[0]; // Ana Silva
  const todayStr = ntpKeeper.formatBrazilianDate();
  
  // 1ª Entrada
  const t1 = new Date();
  t1.setHours(8, 58, 0, 0); // 08:58 (within 5 min tolerance of 09:00)
  const iso1 = t1.toISOString();
  const hash1 = await computeRecordHash({
    nsr,
    timestamp: iso1,
    employeeCpf: baseEmp.cpf,
    employeeMatricula: baseEmp.matricula,
    type: '1_ENTRADA',
    cnpj: COMPANY_INFO.cnpj,
    previousHash,
  });

  records.push({
    id: `rec-${nsr}`,
    nsr,
    employeeId: baseEmp.id,
    employeeName: baseEmp.name,
    employeeCpf: baseEmp.cpf,
    employeeMatricula: baseEmp.matricula,
    employeeRole: baseEmp.role,
    employeeDepartment: baseEmp.department,
    timestamp: iso1,
    formattedDate: todayStr,
    formattedTime: '08:58:14',
    ntpServer: 'a.st1.ntp.br (Stratum 1)',
    type: '1_ENTRADA',
    typeLabel: getPunchTypeLabel('1_ENTRADA'),
    method: 'biometria_facial',
    status: 'Confirmado',
    toleranceCategory: 'tolerancia_aplicada',
    toleranceNotice: 'Variação de -2 min (Tolerância legal CLT Art. 58)',
    varianceMinutes: -2,
    hashSha256: hash1,
    previousHash,
  });

  previousHash = hash1;
  nsr++;

  // 1ª Saída Intervalo
  const t2 = new Date();
  t2.setHours(13, 1, 0, 0);
  const iso2 = t2.toISOString();
  const hash2 = await computeRecordHash({
    nsr,
    timestamp: iso2,
    employeeCpf: baseEmp.cpf,
    employeeMatricula: baseEmp.matricula,
    type: '1_SAIDA_INTERVALO',
    cnpj: COMPANY_INFO.cnpj,
    previousHash,
  });

  records.push({
    id: `rec-${nsr}`,
    nsr,
    employeeId: baseEmp.id,
    employeeName: baseEmp.name,
    employeeCpf: baseEmp.cpf,
    employeeMatricula: baseEmp.matricula,
    employeeRole: baseEmp.role,
    employeeDepartment: baseEmp.department,
    timestamp: iso2,
    formattedDate: todayStr,
    formattedTime: '13:01:22',
    ntpServer: 'a.st1.ntp.br (Stratum 1)',
    type: '1_SAIDA_INTERVALO',
    typeLabel: getPunchTypeLabel('1_SAIDA_INTERVALO'),
    method: 'biometria_digital',
    status: 'Confirmado',
    toleranceCategory: 'tolerancia_aplicada',
    toleranceNotice: 'Variação de +1 min (Tolerância legal CLT Art. 58)',
    varianceMinutes: 1,
    hashSha256: hash2,
    previousHash,
  });

  previousHash = hash2;
  nsr++;

  // Record for Carlos Mendes (Gerente)
  const empCarlos = INITIAL_EMPLOYEES[1];
  const t3 = new Date();
  t3.setHours(8, 0, 0, 0);
  const iso3 = t3.toISOString();
  const hash3 = await computeRecordHash({
    nsr,
    timestamp: iso3,
    employeeCpf: empCarlos.cpf,
    employeeMatricula: empCarlos.matricula,
    type: '1_ENTRADA',
    cnpj: COMPANY_INFO.cnpj,
    previousHash,
  });

  records.push({
    id: `rec-${nsr}`,
    nsr,
    employeeId: empCarlos.id,
    employeeName: empCarlos.name,
    employeeCpf: empCarlos.cpf,
    employeeMatricula: empCarlos.matricula,
    employeeRole: empCarlos.role,
    employeeDepartment: empCarlos.department,
    timestamp: iso3,
    formattedDate: todayStr,
    formattedTime: '08:00:05',
    ntpServer: 'a.st1.ntp.br (Stratum 1)',
    type: '1_ENTRADA',
    typeLabel: getPunchTypeLabel('1_ENTRADA'),
    method: 'biometria_facial',
    status: 'Confirmado',
    toleranceCategory: 'normal',
    toleranceNotice: 'Horário exato da escala',
    varianceMinutes: 0,
    hashSha256: hash3,
    previousHash,
  });

  return { records, lastNsr: nsr };
}

class PontoStorageService {
  private employees: Employee[] = [];
  private records: TimeRecord[] = [];
  private auditLogs: AuditLogEntry[] = [];
  private lastNsr: number = 10000;
  private isInitialized: boolean = false;

  constructor() {
    this.init();
  }

  private async init() {
    if (typeof window === 'undefined') return;

    try {
      const storedEmployees = localStorage.getItem(STORAGE_KEYS.EMPLOYEES);
      if (storedEmployees) {
        this.employees = JSON.parse(storedEmployees);
      } else {
        this.employees = [...INITIAL_EMPLOYEES];
        this.saveEmployees();
      }

      const storedNsr = localStorage.getItem(STORAGE_KEYS.NSR_COUNTER);
      if (storedNsr) {
        this.lastNsr = parseInt(storedNsr, 10);
      }

      const storedRecords = localStorage.getItem(STORAGE_KEYS.RECORDS);
      if (storedRecords) {
        this.records = JSON.parse(storedRecords);
      } else {
        const seed = await createInitialRecords();
        this.records = seed.records;
        this.lastNsr = seed.lastNsr;
        this.saveRecords();
        this.saveNsr();
      }

      const storedLogs = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
      if (storedLogs) {
        this.auditLogs = JSON.parse(storedLogs);
      } else {
        this.auditLogs = [
          {
            id: 'log-001',
            timestamp: new Date().toISOString(),
            eventType: 'AUDITORIA_INTEGRIDADE',
            details: 'Sistema REP-P inicializado com sucesso. Sincronização NTP estabelecida.',
            terminalId: COMPANY_INFO.terminalId,
            ipAddress: '192.168.1.104',
            severity: 'info',
          },
        ];
        this.saveAuditLogs();
      }

      this.isInitialized = true;
    } catch (e) {
      console.error('Failed to initialize PontoStorageService:', e);
    }
  }

  private saveEmployees() {
    localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(this.employees));
  }

  private saveRecords() {
    localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(this.records));
  }

  private saveNsr() {
    localStorage.setItem(STORAGE_KEYS.NSR_COUNTER, String(this.lastNsr));
  }

  private saveAuditLogs() {
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(this.auditLogs));
  }

  public getEmployees(): Employee[] {
    return [...this.employees];
  }

  public getEmployeeById(id: string): Employee | undefined {
    return this.employees.find(e => e.id === id);
  }

  public getEmployeeByMatriculaOrCpf(query: string): Employee | undefined {
    const clean = query.trim().replace(/[.-]/g, '');
    return this.employees.find(e => {
      const empCpfClean = e.cpf.replace(/[.-]/g, '');
      return e.matricula.toLowerCase() === query.trim().toLowerCase() ||
        empCpfClean === clean ||
        e.id === query;
    });
  }

  public getRecords(): TimeRecord[] {
    return [...this.records];
  }

  public getRecordsForEmployeeToday(employeeId: string): TimeRecord[] {
    const todayStr = ntpKeeper.formatBrazilianDate();
    return this.records.filter(r => r.employeeId === employeeId && r.formattedDate === todayStr);
  }

  public getAuditLogs(): AuditLogEntry[] {
    return [...this.auditLogs];
  }

  public getCompanyInfo(): typeof COMPANY_INFO {
    return COMPANY_INFO;
  }

  /**
   * RN04 - Automatic Journey Sequencing
   * Suggests the next natural punch based on punches already made today
   */
  public suggestNextPunchType(employeeId: string): PunchType {
    const todayRecords = this.getRecordsForEmployeeToday(employeeId);
    const count = todayRecords.length;

    if (count === 0) return '1_ENTRADA';
    if (count === 1) return '1_SAIDA_INTERVALO';
    if (count === 2) return '2_ENTRADA_INTERVALO';
    if (count === 3) return '2_SAIDA_FINAL';
    // If already 4 punches, extra punches default to Extraordinária
    if (count % 2 === 0) return 'HORA_EXTRA_ENTRADA';
    return 'HORA_EXTRA_SAIDA';
  }

  /**
   * Check for accidental duplicate punch within cooldownWindowSeconds (default: 60s)
   */
  public checkDuplicatePunch(
    employeeId: string,
    cooldownSeconds: number = 60
  ): { isDuplicate: boolean; lastPunch?: TimeRecord; secondsRemaining: number } {
    const todayRecords = this.getRecordsForEmployeeToday(employeeId);
    if (todayRecords.length === 0) {
      return { isDuplicate: false, secondsRemaining: 0 };
    }

    const last = todayRecords[todayRecords.length - 1];
    const lastTime = new Date(last.timestamp).getTime();
    const nowTime = ntpKeeper.getNow().getTime();
    const diffSeconds = Math.floor((nowTime - lastTime) / 1000);

    if (diffSeconds < cooldownSeconds && diffSeconds >= 0) {
      return {
        isDuplicate: true,
        lastPunch: last,
        secondsRemaining: cooldownSeconds - diffSeconds,
      };
    }

    return { isDuplicate: false, secondsRemaining: 0 };
  }

  /**
   * Register failed biometric attempt (RN05)
   */
  public recordBiometricFailure(employeeId: string, details: string): { consecutiveFailures: number; isBlocked: boolean } {
    const emp = this.employees.find(e => e.id === employeeId);
    if (!emp) return { consecutiveFailures: 0, isBlocked: false };

    emp.consecutiveFailures += 1;
    let isBlocked = false;

    if (emp.consecutiveFailures >= 3) {
      emp.isBiometricBlocked = true;
      isBlocked = true;
      
      this.addAuditLog({
        eventType: 'BLOQUEIO_TENTATIVAS',
        employeeId: emp.id,
        employeeName: emp.name,
        matricula: emp.matricula,
        details: `Bloqueio de biometria acionado após 3 falhas consecutivas de leitura. Modo contingência exigido.`,
        severity: 'alert',
      });
    } else {
      this.addAuditLog({
        eventType: 'FALHA_BIOMETRICA',
        employeeId: emp.id,
        employeeName: emp.name,
        matricula: emp.matricula,
        details: `Tentativa ${emp.consecutiveFailures}/3 inválida. Motivo: ${details}`,
        severity: 'warning',
      });
    }

    this.saveEmployees();
    return { consecutiveFailures: emp.consecutiveFailures, isBlocked };
  }

  /**
   * Reset failed attempts after successful biometric or authenticated contingency
   */
  public resetEmployeeBiometricStatus(employeeId: string) {
    const emp = this.employees.find(e => e.id === employeeId);
    if (emp) {
      emp.consecutiveFailures = 0;
      emp.isBiometricBlocked = false;
      this.saveEmployees();
    }
  }

  /**
   * Add a new immutable TimeRecord (RN02, RN03, RN06)
   */
  public async addTimeRecord(params: {
    employee: Employee;
    type: PunchType;
    method: 'biometria_facial' | 'biometria_digital' | 'contingencia';
    justification?: string;
    supervisorApproved?: boolean;
    customTimestamp?: Date; // For testing simulation
  }): Promise<TimeRecord> {
    const { employee, type, method, justification, supervisorApproved, customTimestamp } = params;

    const ntpNow = customTimestamp || ntpKeeper.getNow();
    const isoTimestamp = ntpNow.toISOString();
    const formattedDate = ntpKeeper.formatBrazilianDate(ntpNow);
    const formattedTime = ntpNow.toLocaleTimeString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const nextNsr = this.lastNsr + 1;

    // Previous record hash for chain inviolability
    const lastRecord = this.records.length > 0 ? this.records[this.records.length - 1] : null;
    const previousHash = lastRecord
      ? lastRecord.hashSha256
      : '0000000000000000000000000000000000000000000000000000000000000000';

    // Compute cryptographic SHA-256 hash
    const hashSha256 = await computeRecordHash({
      nsr: nextNsr,
      timestamp: isoTimestamp,
      employeeCpf: employee.cpf,
      employeeMatricula: employee.matricula,
      type,
      cnpj: COMPANY_INFO.cnpj,
      previousHash,
    });

    // Evaluate CLT Art. 58 tolerance
    const tolerance = evaluateTolerance(type, ntpNow, employee.shift);

    const record: TimeRecord = {
      id: `rec-${nextNsr}`,
      nsr: nextNsr,
      employeeId: employee.id,
      employeeName: employee.name,
      employeeCpf: employee.cpf,
      employeeMatricula: employee.matricula,
      employeeRole: employee.role,
      employeeDepartment: employee.department,
      timestamp: isoTimestamp,
      formattedDate,
      formattedTime,
      ntpServer: ntpKeeper.getStatus().server,
      type,
      typeLabel: getPunchTypeLabel(type),
      method,
      status: 'Confirmado',
      toleranceCategory: tolerance.category,
      toleranceNotice: tolerance.notice,
      varianceMinutes: tolerance.varianceMinutes,
      hashSha256,
      previousHash,
      justification,
      supervisorApproved,
    };

    // Immutability: push to permanent array, never mutate previous records
    this.records.push(record);
    this.lastNsr = nextNsr;

    // Reset biometric failure counter
    this.resetEmployeeBiometricStatus(employee.id);

    // Persist
    this.saveRecords();
    this.saveNsr();

    // Audit log
    const logEvent = method === 'contingencia' ? 'REGISTRO_CONTINGENCIA' : 'SUCESSO_BIOMETRICO';
    this.addAuditLog({
      eventType: logEvent,
      employeeId: employee.id,
      employeeName: employee.name,
      matricula: employee.matricula,
      details: `NSR ${nextNsr} gravado com sucesso (${record.typeLabel}). Método: ${method}. Hash: ${hashSha256.substring(0, 16)}...${justification ? ` Justificativa: ${justification}` : ''}`,
      severity: method === 'contingencia' ? 'warning' : 'success',
    });

    return record;
  }

  /**
   * RN01 - Unicidade Cadastral Biometric Registration
   */
  public registerBiometricCredential(
    employeeId: string,
    types: { face?: boolean; fingerprint?: boolean }
  ): boolean {
    const emp = this.employees.find(e => e.id === employeeId);
    if (!emp) return false;

    if (types.face !== undefined) emp.faceRegistered = types.face;
    if (types.fingerprint !== undefined) emp.fingerprintRegistered = types.fingerprint;
    emp.biometricRegistered = emp.faceRegistered || emp.fingerprintRegistered;
    emp.consecutiveFailures = 0;
    emp.isBiometricBlocked = false;

    this.saveEmployees();

    this.addAuditLog({
      eventType: 'CADASTRO_BIOMETRICO',
      employeeId: emp.id,
      employeeName: emp.name,
      matricula: emp.matricula,
      details: `Credencial biométrica atualizada para ${emp.name} (CPF ${emp.cpf}). Unicidade cadastral confirmada.`,
      severity: 'info',
    });

    return true;
  }

  public addAuditLog(entry: Omit<AuditLogEntry, 'id' | 'timestamp' | 'terminalId' | 'ipAddress'> & Partial<AuditLogEntry>) {
    const fullEntry: AuditLogEntry = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      terminalId: COMPANY_INFO.terminalId,
      ipAddress: '192.168.1.104',
      ...entry,
    };
    this.auditLogs.unshift(fullEntry);
    this.saveAuditLogs();
  }

  public resetDatabaseToDefault() {
    localStorage.removeItem(STORAGE_KEYS.EMPLOYEES);
    localStorage.removeItem(STORAGE_KEYS.RECORDS);
    localStorage.removeItem(STORAGE_KEYS.AUDIT_LOGS);
    localStorage.removeItem(STORAGE_KEYS.NSR_COUNTER);
    this.employees = [...INITIAL_EMPLOYEES];
    this.records = [];
    this.auditLogs = [];
    this.lastNsr = 10000;
    this.init();
  }
}

export const pontoStorage = new PontoStorageService();
