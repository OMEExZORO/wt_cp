import { Link } from 'react-router-dom'
import { siteImage } from '../../lib/images'
import { ArrowRightIcon } from '../icons/Icons'
import { CREDENTIALS, DoctorBio, DoctorPortrait } from '../public/Blocks'

export function MeetRadiologist() {
  const image = siteImage('card-reporting')
  return (
    <div className="radiologist">
      <div className="radiologist__text">
        <div className="radiologist__head">
          <div className="radiologist__portrait">
            <DoctorPortrait />
          </div>
          <div>
            <h3 className="radiologist__name">Dr. Meghnad Padsalgikar</h3>
            <p className="radiologist__role">Radiologist</p>
          </div>
        </div>
        <ul className="credential-list" aria-label="Qualifications">
          {CREDENTIALS.map((credential) => (
            <li key={credential}>{credential}</li>
          ))}
        </ul>
        <p className="doctor-intro__affil">Associated with Sabale Hospital, Bhosari</p>
        <DoctorBio />
        <Link to="/about" className="text-link">
          More about the radiologist <ArrowRightIcon size={16} />
        </Link>
      </div>
      <div className="radiologist__media">
        <img src={image.src} alt={image.alt} width={image.width} height={image.height} loading="lazy" decoding="async" />
      </div>
    </div>
  )
}
