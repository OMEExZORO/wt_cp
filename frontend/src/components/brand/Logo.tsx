interface LogoProps {
  src?: string | null
  tone?: 'dark' | 'light'
  compact?: boolean
}

export function LogoMark({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <rect width="64" height="64" rx="16" fill="var(--color-navy)" />
      <path d="M13 44V20h6l7 14 7-14h6v24h-5.500V30.500L27.500 44h-3L18.500 30.500V44z" fill="#ffffff" />
      <path d="M40 44c3-6 5-6 8-12" fill="none" stroke="var(--color-orange)" strokeWidth="3.500" strokeLinecap="round" />
      <circle cx="50" cy="19" r="4.500" fill="var(--color-orange)" />
    </svg>
  )
}

export function Logo({ src, tone = 'dark', compact = false }: LogoProps) {
  return (
    <span className={`logo logo--${tone}`}>
      {src ? <img src={src} alt="" className="logo__image" width={44} height={44} /> : <LogoMark />}
      <span className="logo__text">
        <span className="logo__name">
          <abbr title="Meghnad Diagnostic Centre">MDC</abbr>
          <span className="visually-hidden"> Meghnad Diagnostic Centre</span>
        </span>
        {compact ? null : <span className="logo__tag">Well Experienced Intimate Care</span>}
      </span>
    </span>
  )
}
