import { Link } from 'react-router-dom'
import { ArrowRightIcon } from '../icons/Icons'
import { CREDENTIALS, DoctorBio, DoctorPortrait } from '../public/Blocks'

export function MeetRadiologist() {
  return (
    <div className="radiologist">
      <div className="radiologist__text">
        <div className="radiologist__head">
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
        <DoctorBio />
        <Link to="/about" className="text-link">
          More about the radiologist <ArrowRightIcon size={16} />
        </Link>
      </div>
      <div className="radiologist__media">
        <div className="doctor-portrait doctor-portrait--wide">
          <DoctorPortrait />
        </div>
      </div>
    </div>
  )
}
