import { branchAddress, branchPhones, directionsUrl, formatPhone, telHref } from '../../lib/contact'
import type { PublicBranch } from '../../types/public'
import { ClockIcon, ExternalIcon, PhoneIcon, PinIcon } from '../icons/Icons'
import { LabBadge, Todo } from './Primitives'

export function BranchCard({ branch, headingLevel = 3 }: { branch: PublicBranch; headingLevel?: 2 | 3 }) {
  const directions = directionsUrl(branch)
  const phones = branchPhones(branch)
  const Heading = headingLevel === 2 ? 'h2' : 'h3'
  return (
    <article className="branch-card" id={branch.slug}>
      <div className="branch-card__body">
        <Heading className="branch-card__title">{branch.name}</Heading>
        <LabBadge />
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
            <div>
              {branch.opening_hours ? (
                branch.opening_hours.split('\n').map((line) => <span key={line} className="info-list__line">{line}</span>)
              ) : (
                <Todo label="opening hours" />
              )}
            </div>
          </li>
          <li>
            <PhoneIcon size={20} />
            <div>
              {phones.length > 0 ? (
                phones.map((phone) => (
                  <a key={phone} href={telHref(phone)} className="info-list__line">
                    {formatPhone(phone)}
                  </a>
                ))
              ) : (
                <Todo label="phone" />
              )}
            </div>
          </li>
        </ul>
        {directions ? (
          <a className="btn btn--primary" href={directions} target="_blank" rel="noopener noreferrer">
            View on Google Maps <ExternalIcon size={16} />
          </a>
        ) : null}
      </div>
    </article>
  )
}
