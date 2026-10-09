import { formatPhone, telHref, whatsappHref } from '../../lib/contact'
import { useContactInfo } from '../../lib/useContactInfo'
import { PhoneIcon, WhatsAppIcon } from '../icons/Icons'
import { Todo } from '../public/Primitives'

export function TopBar() {
  const contact = useContactInfo()
  const entries = contact.centres.length > 0 ? contact.centres : contact.phone !== null || contact.whatsapp !== null ? [{ id: 'main', label: '', phone: contact.phone, whatsapp: contact.whatsapp }] : []

  if (!contact.hasCall && !import.meta.env.DEV) {
    return null
  }

  return (
    <div className="topbar">
      <div className="container topbar__inner">
        <ul className="topbar__list" aria-label="Appointment contacts">
          {entries.map((entry) => (
            <li key={entry.id} className="topbar__item">
              {entry.label !== '' ? <span className="topbar__label">{entry.label}</span> : <span className="topbar__label">Appointments</span>}
              {entry.phone ? (
                <a href={telHref(entry.phone)} className="topbar__link">
                  <PhoneIcon size={15} />
                  <span>{formatPhone(entry.phone)}</span>
                </a>
              ) : null}
              {entry.whatsapp ? (
                <a href={whatsappHref(entry.whatsapp)} target="_blank" rel="noopener noreferrer" className="topbar__link">
                  <WhatsAppIcon size={15} />
                  <span>WhatsApp</span>
                  <span className="visually-hidden"> {entry.whatsapp}</span>
                </a>
              ) : null}
            </li>
          ))}
          {entries.length === 0 ? (
            <li className="topbar__item">
              <Todo label="appointment phone" />
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  )
}
