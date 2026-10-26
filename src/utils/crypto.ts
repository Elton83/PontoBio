/**
 * Cryptographic utilities for PontoBio
 * Implements SHA-256 digital signature/hash chain conforming to Portaria 671 / MTP
 */

export async function generateSha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataUint8 = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export interface RecordHashPayload {
  nsr: number;
  timestamp: string;
  employeeCpf: string;
  employeeMatricula: string;
  type: string;
  cnpj: string;
  previousHash: string;
}

export async function computeRecordHash(payload: RecordHashPayload): Promise<string> {
  const serialized = `${payload.nsr}|${payload.timestamp}|${payload.employeeCpf}|${payload.employeeMatricula}|${payload.type}|${payload.cnpj}|${payload.previousHash}`;
  return generateSha256(serialized);
}

export interface IntegrityVerificationResult {
  isValid: boolean;
  totalRecords: number;
  brokenAtNsr?: number;
  verifiedAt: string;
  rootHash: string;
  latestHash: string;
}

export async function verifyRecordChainIntegrity(
  records: Array<{
    nsr: number;
    timestamp: string;
    employeeCpf: string;
    employeeMatricula: string;
    type: string;
    hashSha256: string;
    previousHash: string;
  }>,
  cnpj: string
): Promise<IntegrityVerificationResult> {
  if (records.length === 0) {
    return {
      isValid: true,
      totalRecords: 0,
      verifiedAt: new Date().toISOString(),
      rootHash: 'GENESIS_NONE',
      latestHash: 'GENESIS_NONE',
    };
  }

  // Sort ascending by NSR
  const sorted = [...records].sort((a, b) => a.nsr - b.nsr);

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    
    // Check previous hash continuity
    if (i > 0) {
      const prev = sorted[i - 1];
      if (current.previousHash !== prev.hashSha256) {
        return {
          isValid: false,
          totalRecords: sorted.length,
          brokenAtNsr: current.nsr,
          verifiedAt: new Date().toISOString(),
          rootHash: sorted[0].hashSha256,
          latestHash: current.hashSha256,
        };
      }
    }

    // Recompute current record hash
    const expectedHash = await computeRecordHash({
      nsr: current.nsr,
      timestamp: current.timestamp,
      employeeCpf: current.employeeCpf,
      employeeMatricula: current.employeeMatricula,
      type: current.type,
      cnpj,
      previousHash: current.previousHash,
    });

    if (expectedHash !== current.hashSha256) {
      return {
        isValid: false,
        totalRecords: sorted.length,
        brokenAtNsr: current.nsr,
        verifiedAt: new Date().toISOString(),
        rootHash: sorted[0].hashSha256,
        latestHash: current.hashSha256,
      };
    }
  }

  return {
    isValid: true,
    totalRecords: sorted.length,
    verifiedAt: new Date().toISOString(),
    rootHash: sorted[0].previousHash,
    latestHash: sorted[sorted.length - 1].hashSha256,
  };
}
