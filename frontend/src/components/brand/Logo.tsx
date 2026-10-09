const ALT = 'Meghnad Diagnostic Centre (MDC)'

export function Logo({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  return (
    <span className={`logo logo--${tone}`}>
      <picture>
        <source media="(max-width: 699px)" srcSet="/images/client/logo-mdc.png" width={89} height={40} />
        <img src="/images/client/logo-lockup.png" alt={ALT} className="logo__image" width={239} height={50} />
      </picture>
    </span>
  )
}
