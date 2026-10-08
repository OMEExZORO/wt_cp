export function HeroArt() {
  return (
    <svg className="hero-art" viewBox="0 0 560 480" role="img" aria-label="Illustration of an ultrasound scan fan and a CT scanner ring">
      <defs>
        <linearGradient id="heroPanel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#24387a" />
          <stop offset="1" stopColor="#121c42" />
        </linearGradient>
        <radialGradient id="heroGlow" cx="0.3" cy="0.25" r="0.8">
          <stop offset="0" stopColor="#4fb8b0" stopOpacity="0.45" />
          <stop offset="1" stopColor="#4fb8b0" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ece8f6" />
          <stop offset="1" stopColor="#a99bd8" />
        </linearGradient>
        <clipPath id="sectorClip">
          <path d="M120 80 L300 80 L420 270 L0 270 Z" transform="translate(0 0)" />
        </clipPath>
      </defs>
      <rect x="20" y="20" width="520" height="440" rx="36" fill="url(#heroPanel)" />
      <rect x="20" y="20" width="520" height="440" rx="36" fill="url(#heroGlow)" />

      <g transform="translate(60 70)">
        <path d="M130 0 A190 190 0 0 1 130 0" fill="none" />
        <path d="M30 40 A150 150 0 0 1 230 40 L130 250 Z" fill="#4fb8b0" fillOpacity="0.14" />
        <g fill="none" stroke="#9fe0d9" strokeLinecap="round">
          <path d="M42 80 A130 130 0 0 1 218 80" strokeOpacity="0.9" strokeWidth="2" />
          <path d="M58 120 A105 105 0 0 1 202 120" strokeOpacity="0.7" strokeWidth="2" />
          <path d="M74 160 A80 80 0 0 1 186 160" strokeOpacity="0.55" strokeWidth="2" />
          <path d="M90 200 A55 55 0 0 1 170 200" strokeOpacity="0.4" strokeWidth="2" />
        </g>
        <g stroke="#9fe0d9" strokeOpacity="0.28" strokeWidth="1.500">
          <path d="M130 250 L30 40M130 250 L80 28M130 250 L130 22M130 250 L180 28M130 250 L230 40" />
        </g>
        <circle cx="130" cy="250" r="9" fill="#f28c28" />
        <rect x="108" y="256" width="44" height="26" rx="8" fill="#ffffff" fillOpacity="0.9" />
      </g>

      <g transform="translate(300 150)">
        <circle cx="110" cy="120" r="104" fill="url(#ringGrad)" />
        <circle cx="110" cy="120" r="64" fill="#121c42" />
        <circle cx="110" cy="120" r="64" fill="none" stroke="#f28c28" strokeWidth="6" strokeDasharray="14 10" strokeLinecap="round" />
        <circle cx="110" cy="120" r="40" fill="#24387a" />
        <path d="M80 126h18l8-22 14 40 8-18h22" fill="none" stroke="#9fe0d9" strokeWidth="3.500" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="-10" y="198" width="260" height="22" rx="11" fill="#ffffff" fillOpacity="0.85" />
        <rect x="30" y="220" width="180" height="10" rx="5" fill="#ffffff" fillOpacity="0.35" />
      </g>

      <g transform="translate(60 360)">
        <rect width="180" height="64" rx="18" fill="#ffffff" />
        <circle cx="34" cy="32" r="14" fill="#e3f4f2" />
        <path d="M27 33l5 5 9-11" fill="none" stroke="#0f6b66" strokeWidth="3.500" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="58" y="20" width="96" height="9" rx="4.500" fill="#1b2a5c" />
        <rect x="58" y="36" width="64" height="8" rx="4" fill="#cfd4e2" />
      </g>

      <circle cx="486" cy="86" r="14" fill="#f28c28" />
      <circle cx="452" cy="60" r="6" fill="#ece8f6" fillOpacity="0.8" />
    </svg>
  )
}
