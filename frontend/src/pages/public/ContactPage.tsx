import { useAppSelector } from '../../app/hooks'
import { ClockIcon, MailIcon, PhoneIcon, WhatsAppIcon } from '../../components/icons/Icons'
import { BranchCard } from '../../components/public/BranchCard'
import { PageHero } from '../../components/public/Blocks'
import { GoogleListingNote } from '../../components/public/GoogleListingNote'
import { AsyncState, Todo } from '../../components/public/Primitives'
import { selectSetting } from '../../features/public/publicSlice'
import { usePublicResource } from '../../hooks/usePublicResource'
import { formatPhone, settingText, telHref, whatsappHref } from '../../lib/contact'
import { usePageMeta } from '../../lib/seo'

export default function ContactPage() {
  usePageMeta('Contact', 'Contact Meghnad Diagnostic Centre by phone, WhatsApp or email, and find branch addresses and directions in Bhosari, Pune.')
  usePublicResource('site')
  const branches = usePublicResource('branches')
  const phone = settingText(useAppSelector(selectSetting('contact.phone')))
  const whatsapp = settingText(useAppSelector(selectSetting('contact.whatsapp')))
  const email = settingText(useAppSelector(selectSetting('contact.email')))
  const hours = settingText(useAppSelector(selectSetting('contact.opening_hours')))

  return (
    <>
      <PageHero eyebrow="Contact" title="Get in touch" intro="Call, message or write to the centre. For emergencies, do not use this website: call 112 or go to the nearest hospital." />
      <section className="section section--flush" aria-label="Contact details">
        <div className="container">
          <ul className="contact-grid">
            <li className="contact-card">
              <PhoneIcon size={26} />
              <h2>Phone</h2>
              {phone ? <a href={telHref(phone)}>{formatPhone(phone)}</a> : <Todo label="phone" />}
            </li>
            <li className="contact-card">
              <WhatsAppIcon size={26} />
              <h2>WhatsApp</h2>
              {whatsapp ? (
                <a href={whatsappHref(whatsapp)} target="_blank" rel="noopener noreferrer">
                  Message on WhatsApp
                </a>
              ) : (
                <Todo label="WhatsApp" />
              )}
            </li>
            <li className="contact-card">
              <MailIcon size={26} />
              <h2>Email</h2>
              {email ? <a href={`mailto:${email}`}>{email}</a> : <Todo label="email" />}
            </li>
            <li className="contact-card">
              <ClockIcon size={26} />
              <h2>Opening hours</h2>
              {hours ? <p>{hours}</p> : <Todo label="opening hours" />}
            </li>
          </ul>
          <p className="callout callout--plain">Please do not send medical details by email or WhatsApp. To book, use the appointment page so your details stay in the secure portal.</p>
          <GoogleListingNote />
          <h2 className="contact-branches-title">Centres</h2>
          <AsyncState status={branches.status} error={branches.error} onRetry={branches.reload} label="Loading branches">
            <div className="stack">
              {(branches.data?.branches ?? []).map((branch) => (
                <BranchCard key={branch.id} branch={branch} />
              ))}
            </div>
          </AsyncState>
        </div>
      </section>
    </>
  )
}
