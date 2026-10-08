import { CtaBand, CREDENTIALS, DoctorBio, DoctorPortrait } from '../../components/public/Blocks'
import { SectionHeading } from '../../components/public/Primitives'
import { usePublicResource } from '../../hooks/usePublicResource'
import { usePageMeta } from '../../lib/seo'

const APPROACH = [
  { title: 'Accurate Reports', text: 'A scan is only useful if the report can be trusted, so careful reading comes first.' },
  { title: 'Experienced Radiologists', text: 'Images are interpreted by a radiologist with specialist radiology training.' },
  { title: 'Modern Technology', text: 'Ultrasound and CT, including image-guided procedures, at one centre.' },
  { title: 'Patient Centric Care', text: 'Clear preparation guidance and an unhurried, respectful approach.' },
  { title: 'Timely Results', text: 'We aim to keep you informed and to share results without unnecessary delay.' },
]

export default function AboutPage() {
  usePageMeta('About the Doctor', 'Dr. Meghnad Padsalgikar, radiologist (MBBS, DMRE, DNB Radiology), associated with Sabale Hospital, Bhosari and Meghnad Diagnostic Centre.')
  usePublicResource('site')

  return (
    <>
      <div className="page-hero">
        <div className="container about-hero">
          <div className="doctor-portrait doctor-portrait--large">
            <DoctorPortrait />
          </div>
          <div>
            <p className="eyebrow">About the doctor</p>
            <h1 className="section-heading__title">Dr. Meghnad Padsalgikar</h1>
            <p className="doctor-intro__role">Radiologist</p>
            <ul className="credential-list" aria-label="Qualifications">
              {CREDENTIALS.map((credential) => (
                <li key={credential}>{credential}</li>
              ))}
            </ul>
            <p className="doctor-intro__affil">Also associated with Sabale Hospital, Bhosari</p>
            <DoctorBio />
          </div>
        </div>
      </div>

      <section className="section" aria-labelledby="radiologist-title">
        <div className="container container--narrow">
          <SectionHeading id="radiologist-title" eyebrow="In plain words" title="What does a radiologist do?" />
          <p className="prose-lead">
            A radiologist is a doctor who is trained to read medical images such as ultrasound and CT scans. They look for what the pictures show, write the report that your treating doctor uses, and
            can guide procedures such as biopsies using imaging.
          </p>
          <p className="prose-lead">
            Radiology reports support your own doctor&apos;s decisions. They do not replace a consultation, and this website does not give medical advice.
          </p>
        </div>
      </section>

      <section className="section section--tint" aria-labelledby="approach-title">
        <div className="container">
          <SectionHeading id="approach-title" eyebrow="How we work" title="Five things we hold ourselves to" />
          <ul className="approach-grid">
            {APPROACH.map((item, index) => (
              <li key={item.title} className="approach-card">
                <span className="approach-card__num" aria-hidden="true">
                  {index + 1}
                </span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <CtaBand />
    </>
  )
}
