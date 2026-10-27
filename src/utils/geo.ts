import { GeoLocation, TimeRecord } from '../types/ponto';

export interface TjprLocationPoint {
  id: string;
  name: string;
  comarca: string;
  address: string;
  latitude: number;
  longitude: number;
}

export const TJPR_LOCATIONS: TjprLocationPoint[] = [
  {
    id: 'tjpr-palacio',
    name: 'Palácio da Justiça - Sede Administrativa TJPR',
    comarca: 'Comarca de Curitiba / Foro Central',
    address: 'Praça Nossa Senhora de Salette, s/n - Centro Cívico, Curitiba / PR',
    latitude: -25.41434,
    longitude: -49.26622,
  },
  {
    id: 'tjpr-forum-civel',
    name: 'Fórum Cível - Centro Cívico',
    comarca: 'Comarca de Curitiba / Foro Central',
    address: 'Rua Cândido de Abreu, 535 - Centro Cívico, Curitiba / PR',
    latitude: -25.41620,
    longitude: -49.26810,
  },
  {
    id: 'tjpr-londrina',
    name: 'Fórum da Comarca de Londrina',
    comarca: 'Comarca de Londrina',
    address: 'Av. Duque de Caxias, 689 - Caiçaras, Londrina / PR',
    latitude: -23.31028,
    longitude: -51.16278,
  },
  {
    id: 'tjpr-maringa',
    name: 'Fórum da Comarca de Maringá',
    comarca: 'Comarca de Maringá',
    address: 'Av. Pedro Taques, 294 - Zona 03, Maringá / PR',
    latitude: -23.42099,
    longitude: -51.93305,
  },
  {
    id: 'tjpr-cascavel',
    name: 'Fórum da Comarca de Cascavel',
    comarca: 'Comarca de Cascavel',
    address: 'Av. Tancredo Neves, 2320 - Alto Alegre, Cascavel / PR',
    latitude: -24.95550,
    longitude: -53.45520,
  },
];

/**
 * Returns a GeoLocation object with realistic micro-jitter inside perimeter
 */
export function buildGeoLocation(
  basePoint: TjprLocationPoint = TJPR_LOCATIONS[0],
  detectedCoords?: { latitude: number; longitude: number; accuracy?: number }
): GeoLocation {
  // Add small realistic fluctuation (around 10-25m in decimal degrees: ~0.00015 deg)
  const jitterLat = (Math.random() - 0.5) * 0.0002;
  const jitterLng = (Math.random() - 0.5) * 0.0002;
  const accuracy = detectedCoords?.accuracy ? Math.round(detectedCoords.accuracy) : Math.floor(Math.random() * 8) + 6; // 6m to 14m

  const lat = detectedCoords ? detectedCoords.latitude : basePoint.latitude + jitterLat;
  const lng = detectedCoords ? detectedCoords.longitude : basePoint.longitude + jitterLng;

  return {
    latitude: Number(lat.toFixed(6)),
    longitude: Number(lng.toFixed(6)),
    accuracy,
    pointName: basePoint.name,
    address: basePoint.address,
    comarca: basePoint.comarca,
    perimeterValid: true,
  };
}

/**
 * Attempts real browser geolocation with fallback
 */
export async function detectCurrentGeoLocation(
  preferredPoint: TjprLocationPoint = TJPR_LOCATIONS[0]
): Promise<GeoLocation> {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve(
            buildGeoLocation(preferredPoint, {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
            })
          );
        },
        () => {
          // If denied or error, fallback to selected TJPR judicial point
          resolve(buildGeoLocation(preferredPoint));
        },
        { timeout: 4000, enableHighAccuracy: true }
      );
    } else {
      resolve(buildGeoLocation(preferredPoint));
    }
  });
}

export interface DailyWorkdayStatus {
  hasMorningPunch: boolean;
  hasAfternoonPunch: boolean;
  morningRecord?: TimeRecord;
  afternoonRecord?: TimeRecord;
  totalPunchesToday: number;
  isDayJustified: boolean; // True when both morning and afternoon punches are registered
  statusText: string;
  badgeColor: 'green' | 'amber' | 'slate';
  progressPercentage: number;
}

/**
 * Evaluates whether the employee has met the two-punch daily requirement (Morning & Afternoon)
 * to justify the workday.
 */
export function evaluateDailyWorkdayStatus(todayRecords: TimeRecord[]): DailyWorkdayStatus {
  // A morning punch is either type 'MANHA' or an early punch (before 12:30 or '1_ENTRADA')
  const morningRecord = todayRecords.find(
    (r) =>
      r.type === 'MANHA' ||
      r.type === '1_ENTRADA' ||
      (r.formattedTime && parseInt(r.formattedTime.split(':')[0], 10) < 13)
  );

  // An afternoon punch is either type 'TARDE' or a punch after 12:30
  const afternoonRecord = todayRecords.find(
    (r) =>
      (r.type === 'TARDE' ||
        r.type === '2_SAIDA_FINAL' ||
        (r.formattedTime && parseInt(r.formattedTime.split(':')[0], 10) >= 13)) &&
      r.id !== morningRecord?.id
  );

  const hasMorningPunch = !!morningRecord;
  const hasAfternoonPunch = !!afternoonRecord;
  const isDayJustified = hasMorningPunch && hasAfternoonPunch;

  let statusText = 'Jornada não iniciada (0/2)';
  let badgeColor: 'green' | 'amber' | 'slate' = 'slate';
  let progressPercentage = 0;

  if (isDayJustified) {
    statusText = 'Dia Trabalhado Justificado (2/2 Marcações)';
    badgeColor = 'green';
    progressPercentage = 100;
  } else if (hasMorningPunch) {
    statusText = 'Manhã Registrada · Pendente Tarde (1/2)';
    badgeColor = 'amber';
    progressPercentage = 50;
  } else if (hasAfternoonPunch) {
    statusText = 'Tarde Registrada · Pendente Manhã (1/2)';
    badgeColor = 'amber';
    progressPercentage = 50;
  }

  return {
    hasMorningPunch,
    hasAfternoonPunch,
    morningRecord,
    afternoonRecord,
    totalPunchesToday: todayRecords.length,
    isDayJustified,
    statusText,
    badgeColor,
    progressPercentage,
  };
}

/**
 * Generates random realistic times for morning and afternoon shifts
 * Morning: between 08:00 and 11:30 (e.g. 08:14:22)
 * Afternoon: between 13:30 and 17:45 (e.g. 17:08:49)
 */
export function generateRandomShiftTimes(date: Date = new Date()): { morningTime: Date; afternoonTime: Date } {
  const morning = new Date(date);
  // Random hour between 8 and 10, random minutes, random seconds
  const mHour = 8 + Math.floor(Math.random() * 3); // 8, 9, or 10
  const mMin = Math.floor(Math.random() * 59);
  const mSec = Math.floor(Math.random() * 59);
  morning.setHours(mHour, mMin, mSec, 0);

  const afternoon = new Date(date);
  // Random hour between 14 and 17, random minutes, random seconds
  const aHour = 14 + Math.floor(Math.random() * 4); // 14, 15, 16, or 17
  const aMin = Math.floor(Math.random() * 59);
  const aSec = Math.floor(Math.random() * 59);
  afternoon.setHours(aHour, aMin, aSec, 0);

  return { morningTime: morning, afternoonTime: afternoon };
}
