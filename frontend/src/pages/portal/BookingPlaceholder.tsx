import { Link } from 'react-router-dom'

export default function BookingPlaceholder() {
  return (
    <section aria-labelledby="booking-title">
      <h1 id="booking-title">Book an appointment</h1>
      <p>Online booking is being finished and will open here soon. In the meantime, please contact the centre to arrange your scan.</p>
      <Link to="/contact">Contact the centre</Link>
    </section>
  )
}
