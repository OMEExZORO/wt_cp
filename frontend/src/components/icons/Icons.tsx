import {
  Activity,
  ArrowRight,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cpu,
  Flag,
  ExternalLink,
  FileText,
  HeartHandshake,
  Info,
  Mail,
  Menu,
  MessageCircle,
  Moon,
  Navigation,
  Pause,
  Phone,
  Play,
  Quote,
  Scan,
  ShieldCheck,
  Star,
  Stethoscope,
  Sun,
  Syringe,
  Timer,
  User,
  X,
  MapPin,
} from 'lucide-react'
import type { LucideProps } from 'lucide-react'

export type IconProps = Omit<LucideProps, 'ref'> & { size?: number }

function wrap(Component: typeof Activity) {
  return function Icon({ size = 24, ...rest }: IconProps) {
    return <Component size={size} strokeWidth={1.75} aria-hidden="true" focusable="false" {...rest} />
  }
}

export const PhoneIcon = wrap(Phone)
export const WhatsAppIcon = wrap(MessageCircle)
export const CalendarIcon = wrap(Calendar)
export const PinIcon = wrap(MapPin)
export const ClockIcon = wrap(Clock)
export const MailIcon = wrap(Mail)
export const StarIcon = wrap(Star)
export const ChevronDownIcon = wrap(ChevronDown)
export const ChevronLeftIcon = wrap(ChevronLeft)
export const ChevronRightIcon = wrap(ChevronRight)
export const ArrowRightIcon = wrap(ArrowRight)
export const MenuIcon = wrap(Menu)
export const CloseIcon = wrap(X)
export const CheckIcon = wrap(Check)
export const PauseIcon = wrap(Pause)
export const PlayIcon = wrap(Play)
export const SunIcon = wrap(Sun)
export const MoonIcon = wrap(Moon)
export const ReportIcon = wrap(FileText)
export const EyeIcon = wrap(Stethoscope)
export const ChipIcon = wrap(Cpu)
export const HeartIcon = wrap(HeartHandshake)
export const ShieldIcon = wrap(ShieldCheck)
export const WaveIcon = wrap(Activity)
export const ScanRingIcon = wrap(Scan)
export const NeedleIcon = wrap(Syringe)
export const InfoIcon = wrap(Info)
export const ExternalIcon = wrap(ExternalLink)
export const UserIcon = wrap(User)
export const FlagIcon = wrap(Flag)
export const TimerIcon = wrap(Timer)
export const NavigationIcon = wrap(Navigation)
export const QuoteIcon = wrap(Quote)

export function GoogleGIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  )
}
