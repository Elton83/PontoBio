import React, { useState } from 'react';
import { Check, Copy, Download, MapPin, Navigation, Printer, ShieldCheck, X } from 'lucide-react';
import { COMPANY_INFO } from '../data/mockEmployees';
import { TimeRecord } from '../types/ponto';

interface DigitalReceiptModalProps {
  record: TimeRecord;
  onClose: () => void;
}

export const DigitalReceiptModal: React.FC<DigitalReceiptModalProps> = ({ record, onClose }) => {
  const [copied, setCopied] = useState(false);

  const copyHash = () => {
    navigator.clipboard.writeText(record.hashSha256);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadTxt = () => {
    const textContent = `
============================================================
      COMPROVANTE DE REGISTRO DE PONTO DO TRABALHADOR
   Conforme Portaria MTP nº 671/2021 - REP-P e CLT Art. 74
============================================================

DADOS DO EMPREGADOR:
Razão Social: ${COMPANY_INFO.razaoSocial}
CNPJ:         ${COMPANY_INFO.cnpj}
Local:        ${COMPANY_INFO.endereco} - ${COMPANY_INFO.cidadeUf}
Terminal:     ${COMPANY_INFO.terminalId} (${COMPANY_INFO.repModel})

DADOS DO COLABORADOR:
Nome:         ${record.employeeName}
CPF:          ${record.employeeCpf}
Matrícula:    ${record.employeeMatricula}
Cargo:        ${record.employeeRole}
Departamento: ${record.employeeDepartment}

DADOS DA MARCAÇÃO:
NSR:          ${String(record.nsr).padStart(9, '0')}
Data/Hora:    ${record.formattedDate} às ${record.formattedTime} (Horário Oficial de Brasília)
Tipo:         ${record.typeLabel}
Método:       ${record.method === 'biometria_facial' ? 'Biometria Facial (Câmera)' : record.method === 'biometria_digital' ? 'Biometria Digital (Sensor Dactilar)' : 'Contingência Assistida'}
Status:       ${record.status}
Servidor NTP: ${record.ntpServer}
${record.geolocation ? `
LOCALIZAÇÃO & PONTO GEORREFERENCIADO:
Unidade TJPR: ${record.geolocation.pointName}
Comarca:      ${record.geolocation.comarca}
Endereço:     ${record.geolocation.address}
Coordenadas:  Lat ${record.geolocation.latitude}, Long ${record.geolocation.longitude} (Precisão: ±${record.geolocation.accuracy}m)
Validação:    Perímetro Autorizado TJPR (Autenticado)
` : ''}
${record.justification ? `Justificativa: ${record.justification}\n` : ''}
AUTENTICAÇÃO CRIPTOGRÁFICA (SHA-256):
${record.hashSha256}

Hash Anterior:
${record.previousHash}

============================================================
Este documento possui validade jurídica para fins de comprovação
trabalhista perante a Fiscalização do Trabalho.
============================================================
    `.trim();

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Comprovante_Ponto_NSR_${record.nsr}_${record.employeeMatricula}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="relative w-full max-w-lg overflow-hidden rounded-xl border border-slate-300 bg-white shadow-2xl text-slate-800 max-h-[92vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-title"
      >
        {/* Modal Header (Transportes Sigma Navy) */}
        <div className="flex items-center justify-between border-b border-[#05202B] px-6 py-4 bg-[#002B49] text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#05202B] text-[#C4A052] border border-[#C4A052]/40 shadow-xs">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 id="receipt-title" className="text-base font-bold text-white tracking-tight">
                Comprovante Digital de Ponto
              </h2>
              <div className="flex items-center gap-2 text-xs text-blue-200">
                <span>Portaria MTP 671/2021</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums text-[#C4A052] font-bold">NSR #{String(record.nsr).padStart(9, '0')}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar comprovante"
            className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Fiscal Ticket Container (Scrollable) */}
        <div className="overflow-y-auto px-6 py-5 space-y-4 print:p-0 print:bg-white print:text-black bg-[#F4F6F8]">
          <div className="rounded-xl border border-slate-300 bg-white p-5 font-mono text-xs space-y-4 shadow-sm relative overflow-hidden">
            {/* Header info */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <p className="font-bold text-[#002B49] text-sm">{COMPANY_INFO.razaoSocial}</p>
                <p className="text-slate-600">CNPJ: {COMPANY_INFO.cnpj}</p>
                <p className="text-slate-500 text-[11px] truncate max-w-xs">{COMPANY_INFO.endereco}</p>
              </div>
              <div className="text-right shrink-0">
                <span className="inline-block rounded bg-blue-50 text-[#002B49] border border-blue-200 px-2 py-0.5 text-[10px] font-bold">
                  REP-P OFICIAL
                </span>
                <p className="text-[10px] text-slate-500 mt-1">{COMPANY_INFO.terminalId}</p>
              </div>
            </div>

            {/* Employee Information */}
            <div className="space-y-1.5 border-b border-slate-200 pb-3 text-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-500">COLABORADOR:</span>
                <span className="font-bold text-[#002B49]">{record.employeeName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">CPF:</span>
                <span className="tabular-nums font-semibold">{record.employeeCpf}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">MATRÍCULA:</span>
                <span className="tabular-nums font-bold text-[#002B49]">{record.employeeMatricula}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">CARGO:</span>
                <span className="truncate max-w-[220px] text-right font-medium">{record.employeeRole}</span>
              </div>
            </div>

            {/* Punch Details */}
            <div className="rounded-lg bg-[#F4F6F8] border border-slate-200 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">MARCAÇÃO:</span>
                <span className="font-bold text-[#002B49] text-sm tracking-wide">
                  {record.typeLabel}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">DATA / HORA OFICIAL:</span>
                <span className="font-bold text-slate-900 text-base tabular-nums">
                  {record.formattedDate} às {record.formattedTime}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500">MÉTODO:</span>
                <span className="text-slate-700 font-semibold capitalize">
                  {record.method === 'biometria_facial' ? 'Reconhecimento Facial' : record.method === 'biometria_digital' ? 'Sensor Dactilar Óptico' : 'Contingência (Assistida)'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500">SERVIDOR NTP:</span>
                <span className="text-slate-600 truncate max-w-[180px] font-medium">{record.ntpServer}</span>
              </div>
              {record.toleranceNotice && (
                <div className="pt-1 border-t border-slate-200 text-[11px] text-slate-600">
                  <span className="text-slate-500 font-semibold">Tolerância:</span> {record.toleranceNotice}
                </div>
              )}
              {record.justification && (
                <div className="pt-1 border-t border-amber-200 text-[11px] text-amber-900">
                  <span className="text-amber-700 font-bold">Justificativa:</span> {record.justification}
                </div>
              )}
            </div>

            {/* Geolocation & Point of Recording */}
            {record.geolocation && (
              <div className="rounded-lg bg-emerald-50/60 border border-emerald-200/80 p-3 space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-emerald-900 font-bold">
                    <MapPin className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                    <span>PONTO GEORREFERENCIADO:</span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                    Perímetro TJPR Válido
                  </span>
                </div>
                <div className="text-slate-800 font-semibold">
                  {record.geolocation.pointName}
                </div>
                <div className="text-slate-600 text-[10px]">
                  {record.geolocation.comarca} · {record.geolocation.address}
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-emerald-200 text-slate-500 font-mono text-[10px]">
                  <span>Coordenadas GPS:</span>
                  <span className="font-bold text-slate-700">
                    {record.geolocation.latitude.toFixed(5)}, {record.geolocation.longitude.toFixed(5)} (±{record.geolocation.accuracy}m)
                  </span>
                </div>
              </div>
            )}

            {/* Cryptographic SHA-256 Signature */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 text-[11px] font-bold">ASSINATURA DIGITAL (SHA-256):</span>
                <button
                  type="button"
                  onClick={copyHash}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[#002B49] hover:underline transition-colors cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-600" />
                      <span className="text-emerald-700">Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>
              <div className="rounded-lg bg-slate-100 p-2 font-mono text-[10px] break-all text-slate-700 border border-slate-300 leading-relaxed select-all">
                {record.hashSha256}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-slate-500 pt-1">
                <span>Hash Anterior:</span>
                <span className="truncate">{record.previousHash.substring(0, 20)}...</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 text-[10px] text-center text-slate-500">
              Documento emitido nos termos do Art. 74 da CLT e Portaria MTP nº 671/2021.
              Registro inalterável com garantia de autenticidade e integridade temporal.
            </div>
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-3.5">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 transition-colors cursor-pointer shadow-2xs"
            >
              <Printer className="h-4 w-4 text-slate-500" />
              <span>Imprimir</span>
            </button>
            <button
              onClick={handleDownloadTxt}
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 transition-colors cursor-pointer shadow-2xs"
            >
              <Download className="h-4 w-4 text-slate-500" />
              <span>Baixar Comprovante (.txt)</span>
            </button>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="rounded-lg bg-[#002B49] hover:bg-[#003860] px-4 py-2 text-xs font-bold text-white transition-colors shadow-xs cursor-pointer"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
};
