import React from 'react';

interface TjprLogoProps {
  className?: string;
  size?: number;
}

export const TjprLogo: React.FC<TjprLogoProps> = ({ className = 'w-10 h-10', size = 40 }) => {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Logotipo Oficial TJPR - Tribunal de Justiça do Estado do Paraná"
    >
      {/* Background Rounded Shield / Circle */}
      <rect width="100" height="100" rx="18" fill="#002B49" />
      <rect x="3" y="3" width="94" height="94" rx="15" stroke="#C4A052" strokeWidth="2.5" />
      <rect x="6.5" y="6.5" width="87" height="87" rx="12" stroke="#C4A052" strokeWidth="0.8" strokeDasharray="3 2" opacity="0.6" />

      {/* Stylized Araucária Pine branch laurels (Symbol of Paraná) */}
      <g stroke="#C4A052" strokeWidth="1.2" strokeLinecap="round" opacity="0.75">
        {/* Left branch */}
        <path d="M 22 68 C 17 55, 18 36, 26 24" />
        <path d="M 21 60 L 14 58" />
        <path d="M 20 48 L 13 44" />
        <path d="M 22 36 L 16 31" />
        <path d="M 26 26 L 22 20" />
        
        {/* Right branch */}
        <path d="M 78 68 C 83 55, 82 36, 74 24" />
        <path d="M 79 60 L 86 58" />
        <path d="M 80 48 L 87 44" />
        <path d="M 78 36 L 84 31" />
        <path d="M 74 26 L 78 20" />
      </g>

      {/* Central Pillar & Sword of Justice */}
      <path d="M 48 18 L 52 18 L 50 14 Z" fill="#C4A052" />
      <line x1="50" y1="18" x2="50" y2="70" stroke="#C4A052" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="41" y1="26" x2="59" y2="26" stroke="#C4A052" strokeWidth="2" strokeLinecap="round" />

      {/* Scales Beam (Balança da Justiça) */}
      <path d="M 30 32 Q 50 29 70 32" stroke="#C4A052" strokeWidth="2" strokeLinecap="round" />
      <circle cx="50" cy="30.5" r="2.5" fill="#C4A052" />

      {/* Left Pan */}
      <line x1="30" y1="32" x2="24" y2="46" stroke="#C4A052" strokeWidth="1" />
      <line x1="30" y1="32" x2="36" y2="46" stroke="#C4A052" strokeWidth="1" />
      <path d="M 22 46 Q 30 52 38 46 Z" fill="#C4A052" opacity="0.9" />

      {/* Right Pan */}
      <line x1="70" y1="32" x2="64" y2="46" stroke="#C4A052" strokeWidth="1" />
      <line x1="70" y1="32" x2="76" y2="46" stroke="#C4A052" strokeWidth="1" />
      <path d="M 62 46 Q 70 52 78 46 Z" fill="#C4A052" opacity="0.9" />

      {/* Base Pedestal */}
      <path d="M 43 70 L 57 70 L 61 74 L 39 74 Z" fill="#C4A052" />

      {/* TJPR Typography */}
      <text
        x="50"
        y="86"
        textAnchor="middle"
        fill="#C4A052"
        fontFamily="'Inter', sans-serif"
        fontSize="12"
        fontWeight="800"
        letterSpacing="2.5"
      >
        TJPR
      </text>
    </svg>
  );
};
