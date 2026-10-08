import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { HeroArt } from '../components/brand/HeroArt'
import {
  ArrowRightIcon,
  CalendarIcon,
  ChipIcon,
  ClockIcon,
  EyeIcon,
  HeartIcon,
  NeedleIcon,
  ReportIcon,
  ScanRingIcon,
  ShieldIcon,
  WaveIcon,
} from '../components/icons/Icons'
import { BranchCard } from '../components/public/BranchCard'
import { CtaBand, DoctorIntro } from '../components/public/Blocks'
import { FaqAccordion } from '../components/public/FaqAccordion'
import { AsyncState, SectionHeading } from '../components/public/Primitives'
import { ReviewsPanel } from '../components/public/ReviewsPanel'
import { MODALITY_TONE } from '../components/public/ServiceCard'
import { usePublicResource } from '../hooks/usePublicResource'
import { usePageMeta } from '../lib/seo'
import type { Modality } from '../types/public'
import type { ReactNode } from 'react'

const PILLARS: { label: string; icon: ReactNode }[] = [
  { label: 'Accurate Reports', icon: <ReportIcon /> },
  { label: 'Experienced Radiologists', icon: <EyeIcon /> },
  { label: 'Modern Technology', icon: <ChipIcon /> },
  { label: 'Patient Centric Care', icon: <HeartIcon /> },
  { label: 'Timely Results', icon: <ClockIcon /> },
]

const MODALITY_ICON: Record<Modality, ReactNode> = {
  USG: <WaveIcon size={28} />,
  CT: <ScanRingIcon size={28} />,
  BIOPSY: <NeedleIcon size={28} />,
}

const WHY: { title: string; text: string }[] = [
  { title: 'Complete diagnostic care under one roof', text: 'Ultrasound, CT and image-guided biopsies at one centre, so you do not have to move between places for related tests.' },
  { title: 'Reports you can rely on', text: 'Accuracy and experienced radiologists are the first things we build care around.' },
  { title: 'Know what to expect', text: 'Every scan on this website lists plain-language preparation tips before you arrive.' },
  { title: 'Safety checked before the visit', text: 'Booking includes a short pre-scan safety checklist, and your consent is asked for before your details are stored.' },
]

export default function HomePage() {
  usePageMeta('Meghnad Diagnostic Centre', 'Ultrasound, CT and image-guided biopsies at Meghnad Diagnostic Centre, Bhosari, Pune. Read about the services, branches and book an appointment.')
  const categories = usePublicResource('categories')
  const scans = usePublicResource('scanTypes')
  const branches = usePublicResource('branches')
  const faqs = usePublicResource('faqs')

  const topLevel = useMemo(() => (categories.data?.categories ?? []).filter((category) => category.parent_slug === null), [categories.data])
  const counts = useMemo(() => {
    const result: Partial<Record<Modality, number>> = {}
    for (const scan of scans.data?.scan_types ?? []) {
      result[scan.modality] = (result[scan.modality] ?? 0) + 1
    }
    return result
  }, [scans.data])

  return (
    <>
      <section className="hero" aria-labelledby="home-title">
        <div className="container hero__inner">
          <div className="hero__copy">
            <p className="eyebrow eyebrow--light">Meghnad Diagnostic Centre · Bhosari, Pune</p>
            <h1 id="home-title" className="hero__title">
              Imaging for a <em>Healthier</em> Tomorrow
            </h1>
            <p className="hero__lead">Ultrasound, CT and image-guided biopsies, with careful reporting and an intimate, well-experienced approach to care.</p>
            <div className="hero__actions">
              <Link to="/book" className="btn btn--primary btn--lg">
                <CalendarIcon size={20} /> Book an appointment
              </Link>
              <Link to="/services" className="btn btn--ghost-light btn--lg">
                Explore services
              </Link>
            </div>
            <p className="hero__note">Not for emergencies. In an emergency, call 112.</p>
          </div>
          <div className="hero__art">
            <HeroArt />
          </div>
        </div>
      </section>

      <section className="pillars" aria-label="Why patients trust MDC">
        <ul className="container pillars__list">
          {PILLARS.map((pillar) => (
            <li key={pillar.label} className="pillars__item">
              <span className="pillars__icon">{pillar.icon}</span>
              {pillar.label}
            </li>
          ))}
        </ul>
      </section>

      <section className="section" aria-labelledby="services-title">
        <div className="container">
          <SectionHeading id="services-title" eyebrow="What we do" title="Three kinds of imaging, one trusted centre" intro="Complete Diagnostic Care Under One Roof." />
          <AsyncState status={categories.status} error={categories.error} onRetry={categories.reload} label="Loading services">
            <ul className="overview-grid">
              {topLevel.map((category) => (
                <li key={category.id} className={`overview-card overview-card--${MODALITY_TONE[category.modality]}`}>
                  <span className="overview-card__icon">{MODALITY_ICON[category.modality]}</span>
                  <h3 className="overview-card__title">{category.name}</h3>
                  {category.tagline ? <p className="overview-card__tagline">{category.tagline}</p> : null}
                  <p>{category.description}</p>
                  <Link to={`/services?type=${category.modality}`} className="text-link">
                    {counts[category.modality] ? `See all ${counts[category.modality]} scans` : 'See scans'} <ArrowRightIcon size={16} />
                  </Link>
                </li>
              ))}
            </ul>
          </AsyncState>
        </div>
      </section>

      <section className="section section--tint" aria-labelledby="why-title">
        <div className="container why">
          <SectionHeading id="why-title" eyebrow="Why choose MDC" title="Accurate. Reliable. Compassionate." intro="Your Health is Our Priority." />
          <ul className="why__list">
            {WHY.map((item) => (
              <li key={item.title} className="why__item">
                <span className="why__icon">
                  <ShieldIcon size={22} />
                </span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section" aria-labelledby="doctor-title">
        <div className="container">
          <SectionHeading id="doctor-title" eyebrow="Your radiologist" title="Meet the doctor" />
          <DoctorIntro />
        </div>
      </section>

      <section className="section section--tint" aria-labelledby="branches-title">
        <div className="container">
          <SectionHeading id="branches-title" eyebrow="Visit us" title="Our branches" />
          <AsyncState status={branches.status} error={branches.error} onRetry={branches.reload} label="Loading branches">
            <div className="stack">
              {(branches.data?.branches ?? []).map((branch) => (
                <BranchCard key={branch.id} branch={branch} />
              ))}
            </div>
          </AsyncState>
        </div>
      </section>

      <section className="section" aria-labelledby="reviews-title">
        <div className="container">
          <SectionHeading id="reviews-title" eyebrow="Patient voices" title="What patients say" />
          <ReviewsPanel layout="carousel" />
        </div>
      </section>

      <section className="section section--tint" aria-labelledby="faq-title">
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
