import { PunchType, ToleranceCategory, WorkShift } from '../types/ponto';

export interface ToleranceEvaluation {
  category: ToleranceCategory;
  varianceMinutes: number;
  scheduledTime: string;
  actualTime: string;
  notice: string;
  isWithinLegalTolerance: boolean;
}

export function evaluateTolerance(
  type: PunchType,
  actualDate: Date,
  shift: WorkShift
): ToleranceEvaluation {
  // Determine expected schedule target based on punch type
  let expectedTimeStr = '08:00';
  let isExit = false;

  switch (type) {
    case 'MANHA':
      expectedTimeStr = shift.entry1 || '08:00';
      isExit = false;
      break;
    case 'TARDE':
      expectedTimeStr = shift.exit2 || '17:00';
      isExit = true;
      break;
    case '1_ENTRADA':
      expectedTimeStr = shift.entry1;
      isExit = false;
      break;
    case '1_SAIDA_INTERVALO':
      expectedTimeStr = shift.exit1;
      isExit = true;
      break;
    case '2_ENTRADA_INTERVALO':
      expectedTimeStr = shift.entry2;
      isExit = false;
      break;
    case '2_SAIDA_FINAL':
      expectedTimeStr = shift.exit2;
      isExit = true;
      break;
    case 'HORA_EXTRA_ENTRADA':
    case 'HORA_EXTRA_SAIDA':
      return {
        category: 'hora_extra',
        varianceMinutes: 0,
        scheduledTime: 'Extraordinário',
        actualTime: actualDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        notice: 'Jornada Extraordinária Autorizada',
        isWithinLegalTolerance: false,
      };
  }

  const [expH, expM] = expectedTimeStr.split(':').map(Number);
  const actualH = actualDate.getHours();
  const actualM = actualDate.getMinutes();

  const expTotalMin = expH * 60 + expM;
  const actualTotalMin = actualH * 60 + actualM;

  const diff = actualTotalMin - expTotalMin; // positive = arrived/left later, negative = arrived/left earlier
  const absDiff = Math.abs(diff);

  const actualTimeStr = `${String(actualH).padStart(2, '0')}:${String(actualM).padStart(2, '0')}`;

  // Within CLT Art. 58 § 1º tolerance (up to 5 min)
  if (absDiff === 0) {
    return {
      category: 'normal',
      varianceMinutes: 0,
      scheduledTime: expectedTimeStr,
      actualTime: actualTimeStr,
      notice: 'Horário exato da escala',
      isWithinLegalTolerance: true,
    };
  }

  if (absDiff <= 5) {
    return {
      category: 'tolerancia_aplicada',
      varianceMinutes: diff,
      scheduledTime: expectedTimeStr,
      actualTime: actualTimeStr,
      notice: `Variação de ${diff > 0 ? '+' : ''}${diff} min (Tolerância legal CLT Art. 58)`,
      isWithinLegalTolerance: true,
    };
  }

  // Outside 5 min tolerance
  if (!isExit) {
    // Arrival
    if (diff > 5) {
      return {
        category: 'atraso',
        varianceMinutes: diff,
        scheduledTime: expectedTimeStr,
        actualTime: actualTimeStr,
        notice: `Atraso de ${diff} minutos em relação à escala (${expectedTimeStr})`,
        isWithinLegalTolerance: false,
      };
    } else {
      return {
        category: 'hora_extra',
        varianceMinutes: diff,
        scheduledTime: expectedTimeStr,
        actualTime: actualTimeStr,
        notice: `Entrada antecipada em ${Math.abs(diff)} minutos (Hora Extra potencial)`,
        isWithinLegalTolerance: false,
      };
    }
  } else {
    // Exit
    if (diff < -5) {
      return {
        category: 'saida_antecipada',
        varianceMinutes: diff,
        scheduledTime: expectedTimeStr,
        actualTime: actualTimeStr,
        notice: `Saída antecipada em ${Math.abs(diff)} minutos em relação à escala (${expectedTimeStr})`,
        isWithinLegalTolerance: false,
      };
    } else {
      return {
        category: 'hora_extra',
        varianceMinutes: diff,
        scheduledTime: expectedTimeStr,
        actualTime: actualTimeStr,
        notice: `Saída prorrogada em +${diff} minutos (Hora Extra)`,
        isWithinLegalTolerance: false,
      };
    }
  }
}

export function getPunchTypeLabel(type: PunchType): string {
  switch (type) {
    case 'MANHA':
      return 'Turno Manhã (1ª Marcação)';
    case 'TARDE':
      return 'Turno Tarde (2ª Marcação)';
    case '1_ENTRADA':
      return '1ª Entrada (Início Jornada)';
    case '1_SAIDA_INTERVALO':
      return '1ª Saída (Início Almoço/Intervalo)';
    case '2_ENTRADA_INTERVALO':
      return '2ª Entrada (Retorno Almoço/Intervalo)';
    case '2_SAIDA_FINAL':
      return '2ª Saída (Fim da Jornada)';
    case 'HORA_EXTRA_ENTRADA':
      return 'Entrada Extraordinária';
    case 'HORA_EXTRA_SAIDA':
      return 'Saída Extraordinária';
  }
}
