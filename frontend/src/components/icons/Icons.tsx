import type { ReactNode, SVGProps } from 'react'

export type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & { size?: number }

function make(paths: ReactNode) {
  return function Icon({ size = 24, ...rest }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
        {...rest}
      >
        {paths}
      </svg>
    )
  }
}

export const PhoneIcon = make(<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />)
export const WhatsAppIcon = make(
  <>
    <path d="M4 20l1.3-4.2A8 8 0 1 1 8.4 19z" />
    <path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1.2-1.5-2-1-1 .7a4 4 0 0 1-1.9-1.9l.7-1-1-2z" />
  </>,
)
export const CalendarIcon = make(
  <>
    <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </>,
)
export const PinIcon = make(
  <>
    <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.800 12 21 12 21z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </>,
)
export const ClockIcon = make(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.5 2" />
  </>,
)
export const MailIcon = make(
  <>
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="M4 7l8 6 8-6" />
  </>,
)
export const StarIcon = make(<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z" />)
export const ChevronDownIcon = make(<path d="M6 9l6 6 6-6" />)
export const ChevronLeftIcon = make(<path d="M15 6l-6 6 6 6" />)
export const ChevronRightIcon = make(<path d="M9 6l6 6-6 6" />)
export const ArrowRightIcon = make(<path d="M5 12h14M13 6l6 6-6 6" />)
export const MenuIcon = make(<path d="M4 7h16M4 12h16M4 17h16" />)
export const CloseIcon = make(<path d="M6 6l12 12M18 6L6 18" />)
export const CheckIcon = make(<path d="M5 12.5l4.5 4.5L19 7.500" />)
export const PauseIcon = make(<path d="M8 5v14M16 5v14" />)
export const PlayIcon = make(<path d="M8 5l11 7-11 7z" />)
export const SunIcon = make(
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.600 5.600l1.400 1.400M17 17l1.400 1.400M5.600 18.400L7 17M17 7l1.400-1.400" />
  </>,
)
export const MoonIcon = make(<path d="M20 14.500A8 8 0 0 1 9.500 4 8 8 0 1 0 20 14.500z" />)
export const ReportIcon = make(
  <>
    <path d="M7 3h7l4 4v14H7z" />
    <path d="M14 3v4h4M10 12h5M10 16h5" />
  </>,
)
export const EyeIcon = make(
  <>
    <path d="M2.500 12S6 5.500 12 5.500 21.500 12 21.500 12 18 18.500 12 18.500 2.500 12 2.500 12z" />
    <circle cx="12" cy="12" r="2.800" />
  </>,
)
export const ChipIcon = make(
  <>
    <rect x="6" y="6" width="12" height="12" rx="2" />
    <rect x="9.500" y="9.500" width="5" height="5" rx="1" />
    <path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" />
  </>,
)
export const HeartIcon = make(<path d="M12 20s-7.500-4.600-7.500-10A4.300 4.300 0 0 1 12 7.300 4.300 4.300 0 0 1 19.500 10c0 5.400-7.500 10-7.500 10z" />)
export const ShieldIcon = make(
  <>
    <path d="M12 3l7.500 3v5.500c0 4.500-3.200 8-7.500 9.500-4.300-1.500-7.500-5-7.500-9.500V6z" />
    <path d="M9 12l2.200 2.200L15.500 10" />
  </>,
)
export const WaveIcon = make(<path d="M3 12h3l2-6 4 12 3-9 2 3h4" />)
export const ScanRingIcon = make(
  <>
    <circle cx="12" cy="12" r="8.500" />
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3.500v2M12 18.500v2" />
  </>,
)
export const NeedleIcon = make(
  <>
    <path d="M4 20l9-9" />
    <path d="M13 11l3.500-3.500 3-3 .5.5-3 3L13.500 11.500z" />
    <path d="M16 8l2 2" />
  </>,
)
export const InfoIcon = make(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </>,
)
export const ExternalIcon = make(<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />)
export const UserIcon = make(
  <>
    <circle cx="12" cy="8" r="3.800" />
    <path d="M4.500 20a7.500 7.500 0 0 1 15 0" />
  </>,
)
