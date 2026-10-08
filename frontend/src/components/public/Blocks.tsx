import { Link } from 'react-router-dom'
import { useAppSelector } from '../../app/hooks'
import { selectSetting } from '../../features/public/publicSlice'
import { settingText } from '../../lib/contact'
import { ArrowRightIcon, CalendarIcon } from '../icons/Icons'
import { SectionHeading, Todo } from './Primitives'

export function PageHero({ eyebrow, title, intro }: { eyebrow: string; title: string; intro?: string }) {
  return (
    <div className="page-hero">
      <div className="container">
        <SectionHeading as="h1" eyebrow={eyebrow} title={title} intro={intro} />
      </div>
    </div>
  )
}

export function CtaBand({ title = 'Ready to book your scan?', text = 'Choose a branch, a scan and a time that suits you. A short safety checklist keeps you prepared.' }: { title?: string; text?: string }) {
  return (
    <section className="cta-band" aria-labelledby="cta-title">
      <div className="container cta-band__inner">
        <div>
          <h2 id="cta-title" className="cta-band__title">
            {title}
          </h2>
          <p>{text}</p>
        </div>
        <Link to="/book" className="btn btn--primary btn--lg">
          <CalendarIcon size={20} /> Book an appointment
        </Link>
      </div>
    </section>
  )
}

export const CREDENTIALS = ['MBBS', 'DMRE', 'DNB (Radiology)']

export function DoctorPortrait() {
  const photo = settingText(useAppSelector(selectSetting('doctor.photo_url')))
  if (photo) {
    return <img className="doctor-portrait__img" src={photo} alt="Dr. Meghnad Padsalgikar" loading="lazy" width={360} height={420} />
  }
  return (
    <div className="doctor-portrait__placeholder" aria-hidden="true">
      <svg viewBox="0 0 200 220" width="100%" height="100%">
        <rect width="200" height="220" fill="var(--color-lavender-tint)" />
        <circle cx="100" cy="86" r="38" fill="var(--color-navy)" fillOpacity="0.12" />
        <path d="M30 220c0-44 31-72 70-72s70 28 70 72z" fill="var(--color-navy)" fillOpacity="0.12" />
        <text x="100" y="104" textAnchor="middle" fontFamily="var(--font-display)" fontSize="44" fontWeight="600" fill="var(--color-navy)">
          MP
        </text>
      </svg>
      <Todo label="doctor photo" />
    </div>
  )
}

export function DoctorBio() {
  const bio = settingText(useAppSelector(selectSetting('doctor.bio')))
  if (bio) {
    return <p>{bio}</p>
  }
  return (
    <>
      <p>Dr. Meghnad Padsalgikar is a radiologist at Meghnad Diagnostic Centre in Bhosari, Pune, and is also associated with Sabale Hospital, Bhosari.</p>
      <Todo label="doctor biography" />
    </>
  )
}

export function DoctorIntro({ withLink = true }: { withLink?: boolean }) {
  return (
    <div className="doctor-intro">
      <div className="doctor-portrait">
        <DoctorPortrait />
      </div>
      <div className="doctor-intro__text">
        <h3 className="doctor-intro__name">Dr. Meghnad Padsalgikar</h3>
        <p className="doctor-intro__role">Radiologist</p>
        <ul className="credential-list" aria-label="Qualifications">
          {CREDENTIALS.map((credential) => (
            <li key={credential}>{credential}</li>
          ))}
        </ul>
        <p className="doctor-intro__affil">Associated with Sabale Hospital, Bhosari</p>
        <DoctorBio />
        {withLink ? (
          <Link to="/about" className="text-link">
            More about the doctor <ArrowRightIcon size={16} />
          </Link>
        ) : null}
      </div>
    </div>
  )
}
