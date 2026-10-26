export type PunchType = 
  | '1_ENTRADA'        // 1ª Entrada (Início da jornada)
  | '1_SAIDA_INTERVALO' // 1ª Saída Intervalo (Início Almoço)
  | '2_ENTRADA_INTERVALO' // 2ª Entrada Intervalo (Retorno Almoço)
  | '2_SAIDA_FINAL'    // 2ª Saída Final (Fim da jornada)
  | 'HORA_EXTRA_ENTRADA'
  | 'HORA_EXTRA_SAIDA';

export type AuthMethod = 'biometria_facial' | 'biometria_digital' | 'contingencia';

export type ToleranceCategory = 
  | 'normal' 
  | 'tolerancia_aplicada' 
  | 'atraso' 
  | 'hora_extra' 
  | 'saida_antecipada';

export interface WorkShift {
  name: string;
  entry1: string;       // e.g. "08:00"
  exit1: string;        // e.g. "12:00"
  entry2: string;       // e.g. "13:00"
  exit2: string;        // e.g. "17:00"
  dailyHours: number;   // 8 hours
  toleranceMinutes: number; // 5 min
  maxDailyToleranceMinutes: number; // 10 min
}

export interface Employee {
  id: string;
  matricula: string;
  cpf: string;
  name: string;
  role: string;
  department: string;
  shift: WorkShift;
  avatarColor: string;
  biometricRegistered: boolean;
  faceRegistered: boolean;
  fingerprintRegistered: boolean;
  pin: string; // Used for contingency login
  consecutiveFailures: number;
  isBiometricBlocked: boolean;
}

export interface TimeRecord {
  id: string;
  nsr: number; // Número Sequencial de Registro (Imutável, crescente)
  employeeId: string;
  employeeName: string;
  employeeCpf: string;
  employeeMatricula: string;
  employeeRole: string;
  employeeDepartment: string;
  timestamp: string; // ISO String (obtida via NTP)
  formattedDate: string; // DD/MM/AAAA
  formattedTime: string; // HH:mm:ss
  ntpServer: string; // e.g. "a.st1.ntp.br (Stratum 1)"
  type: PunchType;
  typeLabel: string;
  method: AuthMethod;
  status: 'Confirmado';
  toleranceCategory: ToleranceCategory;
  toleranceNotice?: string;
  varianceMinutes: number; // Desvio em minutos em relação ao horário previsto
  hashSha256: string; // SHA-256 do registro
  previousHash: string; // Hash do registro anterior (Cadeia de integridade inviolável)
  justification?: string; // Obrigatória em contingência
  supervisorApproved?: boolean;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  eventType: 
    | 'SUCESSO_BIOMETRICO' 
    | 'FALHA_BIOMETRICA' 
    | 'BLOQUEIO_TENTATIVAS' 
    | 'REGISTRO_CONTINGENCIA' 
    | 'BLOQUEIO_DUPLICIDADE' 
    | 'CADASTRO_BIOMETRICO' 
    | 'AUDITORIA_INTEGRIDADE';
  employeeId?: string;
  employeeName?: string;
  matricula?: string;
  details: string;
  terminalId: string;
  ipAddress: string;
  severity: 'info' | 'warning' | 'alert' | 'success';
}

export interface CompanyInfo {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  cei: string;
  endereco: string;
  cidadeUf: string;
  terminalId: string;
  repModel: string;
  versaoSoftware: string;
}
