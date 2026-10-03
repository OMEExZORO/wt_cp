import { Link } from 'react-router-dom';
import { images, site } from '../../config/site.js';

const expertise = [
  'Digital radiography of chest, spine, joints and extremities',
  'Whole abdomen, pelvic and small-parts sonography',
  'Obstetric sonography, in full compliance with the PCPNDT Act',
  'Arterial and venous Colour Doppler studies',
  'Obstetric Doppler for foetal well-being assessment',
  'Prompt communication of critical findings to referring doctors',
];

export default function About() {
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <h1>About the Doctor</h1>
          <p>The radiologist behind every DiagnoCare report.</p>
        </div>
      </section>
      <section className="section container split">
        <img src={images.doctorPortrait} alt={site.doctor.name} className="portrait" />
        <div>
          <h2>{site.doctor.name}</h2>
          <p className="quals">{site.doctor.qualifications.join(' • ')}</p>
          <p className="muted">
            {site.doctor.title} • {site.doctor.registration}
          </p>
          <p>
            {site.doctor.name} is a radiologist holding an MBBS degree, a Diploma in Medical Radiology and
            Electrology (DMRE) and the Diplomate of National Board (DNB) in Radiology. At DiagnoCare, every
            X-ray, sonography and Doppler study is reviewed and reported personally, so patients and referring
            doctors receive consistent, reliable reports.
          </p>
          <p>
            The clinic was set up to bring quality diagnostic imaging closer to families in Bhosari and the
            surrounding industrial belt, with two branches, extended evening hours and digital reports.
          </p>
          <Link to="/dashboard/book" className="btn">
            Book a consultation scan
          </Link>
        </div>
      </section>
      <section className="section section-alt">
        <div className="container split split-reverse">
          <div>
            <h2>Areas of expertise</h2>
            <ul className="check-list">
              {expertise.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
          <img src={images.equipment} alt="Radiology equipment at DiagnoCare" className="rounded-img" loading="lazy" />
        </div>
      </section>
      <section className="section container">
        <h2>Our commitments</h2>
        <div className="grid-3">
          <div className="card card-plain">
            <h3>Accuracy first</h3>
            <p>Calibrated digital equipment and structured reporting for every study.</p>
          </div>
          <div className="card card-plain">
            <h3>Patient privacy</h3>
            <p>Reports are encrypted at rest and only you and your doctors can access them.</p>
          </div>
          <div className="card card-plain">
            <h3>Ethical practice</h3>
            <p>Sex determination is strictly not performed. We follow all PCPNDT and AERB guidelines.</p>
          </div>
        </div>
      </section>
    </>
  );
}
