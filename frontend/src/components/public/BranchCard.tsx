import { branchAddress, formatPhone, directionsUrl, mapsEmbedUrl, telHref, whatsappHref } from '../../lib/contact'
import type { PublicBranch } from '../../types/public'
import { ClockIcon, ExternalIcon, MailIcon, PhoneIcon, PinIcon, WhatsAppIcon } from '../icons/Icons'
import { Todo } from './Primitives'

export function BranchCard({ branch, headingLevel = 3 }: { branch: PublicBranch; headingLevel?: 2 | 3 }) {
  const embed = mapsEmbedUrl(branch)
  const directions = directionsUrl(branch)
  const Heading = headingLevel === 2 ? 'h2' : 'h3'
  return (
    <article className="branch-card">
      <div className="branch-card__body">
        <Heading className="branch-card__title">{branch.name}</Heading>
        <ul className="info-list">
          <li>
            <PinIcon size={20} />
            <div>
              {branch.address_is_placeholder ? (
                <Todo label="branch address" />
              ) : (
                <address>
                  {branchAddress(branch)}
                  {branch.landmark ? <span className="info-list__sub">{branch.landmark}</span> : null}
                </address>
              )}
            </div>
          </li>
          <li>
            <ClockIcon size={20} />
            <div>{branch.opening_hours ?? <Todo label="opening hours" />}</div>
          </li>
          <li>
            <PhoneIcon size={20} />
            <div>{branch.phone ? <a href={telHref(branch.phone)}>{formatPhone(branch.phone)}</a> : <Todo label="phone" />}</div>
          </li>
          {branch.whatsapp ? (
            <li>
              <WhatsAppIcon size={20} />
              <div>
                <a href={whatsappHref(branch.whatsapp)} target="_blank" rel="noopener noreferrer">
                  WhatsApp {branch.whatsapp}
                </a>
              </div>
            </li>
          ) : null}
          {branch.email ? (
            <li>
              <MailIcon size={20} />
              <div>
                <a href={`mailto:${branch.email}`}>{branch.email}</a>
              </div>
            </li>
          ) : null}
        </ul>
        {directions ? (
          <a className="btn btn--primary" href={directions} target="_blank" rel="noopener noreferrer">
            Get directions <ExternalIcon size={16} />
          </a>
        ) : null}
      </div>
      {embed ? (
        <div className="branch-card__map">
          <iframe
            title={`Map showing ${branch.name}`}
            src={embed}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>
      ) : (
        <div className="branch-card__map branch-card__map--empty">
          <PinIcon size={32} />
          <span>Map available once the address is confirmed</span>
        </div>
      )}
    </article>
  )
}
