import { Link } from 'react-router-dom'
import { telHref } from '../../lib/contact'
import { useContactInfo } from '../../lib/useContactInfo'
import { CalendarIcon, PhoneIcon } from '../icons/Icons'

export function StickyActionBar() {
  const { primaryPhone: phone } = useContactInfo()
  const dev = import.meta.env.DEV

  return (
    <nav className="action-bar" aria-label="Quick actions">
      {phone ? (
        <a href={telHref(phone)} className="action-bar__item">
          <PhoneIcon size={20} />
          Call
        </a>
      ) : dev ? (
        <span className="action-bar__item action-bar__item--todo">
          <PhoneIcon size={20} />
          TODO: phone
        </span>
      ) : null}
      <Link to="/book" className="action-bar__item action-bar__item--book">
        <CalendarIcon size={20} />
        Book
      </Link>
    </nav>
  )
}
