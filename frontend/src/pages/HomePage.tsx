import { Link } from 'react-router-dom'
import { ClinicGallery } from '../components/home/ClinicGallery'
import { HeroCarousel } from '../components/home/HeroCarousel'
import { MeetRadiologist } from '../components/home/MeetRadiologist'
import { ModalityShowcase } from '../components/home/ModalityShowcase'
import { QuickAppointment } from '../components/home/QuickAppointment'
import { ArrowRightIcon, ChipIcon, ClockIcon, EyeIcon, HeartIcon, ReportIcon } from '../components/icons/Icons'
import { BranchCard } from '../components/public/BranchCard'
import { CtaBand } from '../components/public/Blocks'
import { FaqAccordion } from '../components/public/FaqAccordion'
import { AsyncState, SectionHeading } from '../components/public/Primitives'
import { ReviewsPanel } from '../components/public/ReviewsPanel'
import { usePublicResource } from '../hooks/usePublicResource'
import { usePageMeta } from '../lib/seo'
import type { ReactNode } from 'react'

const PILLARS: { label: string; text: string; icon: ReactNode }[] = [
  { label: 'Accurate Reports', text: 'Clear, carefully checked reporting', icon: <ReportIcon size={26} /> },
  { label: 'Experienced Radiologists', text: 'Led by a qualified radiologist', icon: <EyeIcon size={26} /> },
  { label: 'Modern Technology', text: 'Ultrasound and CT imaging', icon: <ChipIcon size={26} /> },
  { label: 'Patient Centric Care', text: 'An intimate, well-experienced approach', icon: <HeartIcon size={26} /> },
  { label: 'Timely Results', text: 'Prompt reporting without compromise', icon: <ClockIcon size={26} /> },
]

export default function HomePage() {
  usePageMeta('Meghnad Diagnostic Centre', 'Ultrasound, CT and image-guided biopsies at Meghnad Diagnostic Centre, Bhosari, Pune. Read about the services, centres and book an appointment.')
  const branches = usePublicResource('branches')
  const faqs = usePublicResource('faqs')

  return (
    <>
      <div className="hero-wrap">
        <HeroCarousel />
        <div className="container hero-wrap__quick">
          <QuickAppointment />
        </div>
      </div>

      <section className="trust" aria-label="Why patients trust MDC">
        <ul className="container trust__list">
          {PILLARS.map((pillar) => (
            <li key={pillar.label} className="trust__item">
              <span className="trust__icon">{pillar.icon}</span>
              <div>
                <p className="trust__label">{pillar.label}</p>
                <p className="trust__text">{pillar.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="section" aria-labelledby="services-title">
        <div className="container">
          <SectionHeading id="services-title" eyebrow="Our services" title="Complete diagnostic care under one roof" intro="Three kinds of imaging, reported by an experienced radiologist." />
          <ModalityShowcase />
        </div>
      </section>

      <section className="section section--tint" aria-labelledby="doctor-title">
        <div className="container">
          <SectionHeading id="doctor-title" eyebrow="Your radiologist" title="Meet the radiologist" />
          <MeetRadiologist />
        </div>
      </section>

      <section className="section" aria-labelledby="branches-title">
        <div className="container">
          <SectionHeading id="branches-title" eyebrow="Visit us" title="Our centres" />
          <AsyncState status={branches.status} error={branches.error} onRetry={branches.reload} label="Loading centres">
            <div className="stack">
              {(branches.data?.branches ?? []).map((branch) => (
                <BranchCard key={branch.id} branch={branch} />
              ))}
            </div>
          </AsyncState>
          <div className="gallery">
            <h3 className="gallery__title">Inside our centre</h3>
            <ClinicGallery />
          </div>
        </div>
      </section>

      <section className="section section--tint" aria-labelledby="reviews-title">
        <div className="container">
          <SectionHeading id="reviews-title" eyebrow="Patient voices" title="What patients say on Google" />
          <ReviewsPanel layout="carousel" />
        </div>
      </section>

      <section className="section" aria-labelledby="faq-title">
        <div className="container container--narrow">
          <SectionHeading id="faq-title" eyebrow="Questions" title="Frequently asked" />
          <AsyncState status={faqs.status} error={faqs.error} onRetry={faqs.reload} label="Loading questions">
            <FaqAccordion faqs={(faqs.data?.faqs ?? []).slice(0, 5)} idPrefix="home-faq" />
            <p className="section__more">
              <Link to="/faq" className="text-link">
                See all questions <ArrowRightIcon size={16} />
              </Link>
            </p>
          </AsyncState>
        </div>
      </section>

      <CtaBand />
    </>
  )
}
