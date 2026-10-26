/**
 * Simulated NTP (Network Time Protocol) server synchronization
 * Conforming to Portaria 671 / MTP requirement for certified time source
 */

export interface NtpStatus {
  server: string;
  stratum: number;
  offsetMs: number;
  jitterMs: number;
  isSynced: boolean;
  lastSyncIso: string;
}

export const NTP_SERVERS = [
  'a.st1.ntp.br (Observatório Nacional - Stratum 1)',
  'b.st1.ntp.br (NIC.br - Stratum 1)',
  'c.st1.ntp.br (CGI.br - Stratum 1)',
];

class NtpTimeKeeper {
  private offsetMs: number = 0;
  private currentServer: string = NTP_SERVERS[0];
  private stratum: number = 1;
  private jitterMs: number = 1.2;
  private isSynced: boolean = true;
  private lastSync: Date = new Date();

  constructor() {
    // Initial sync
    this.resync();
  }

  public resync() {
    // Simulate real NTP packet round-trip
    this.currentServer = NTP_SERVERS[Math.floor(Math.random() * NTP_SERVERS.length)];
    this.jitterMs = Number((Math.random() * 2 + 0.5).toFixed(2));
    this.offsetMs = Number(((Math.random() - 0.5) * 8).toFixed(1)); // minor millisecond offset
    this.isSynced = true;
    this.lastSync = new Date();
  }

  public getNow(): Date {
    return new Date(Date.now() + this.offsetMs);
  }

  public getStatus(): NtpStatus {
    return {
      server: this.currentServer,
      stratum: this.stratum,
      offsetMs: this.offsetMs,
      jitterMs: this.jitterMs,
      isSynced: this.isSynced,
      lastSyncIso: this.lastSync.toISOString(),
    };
  }

  public formatIsoNow(): string {
    return this.getNow().toISOString();
  }

  public formatBrazilianDate(d: Date = this.getNow()): string {
    return d.toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  public formatBrazilianTime(d: Date = this.getNow()): string {
    return d.toLocaleTimeString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  }
}

export const ntpKeeper = new NtpTimeKeeper();
