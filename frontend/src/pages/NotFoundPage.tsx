import { Link } from 'react-router-dom'
import { NotFoundArt } from '../components/art'

export default function NotFoundPage() {
  return (
    <section className="container" aria-labelledby="not-found-title">
      <NotFoundArt className="art art--state not-found-art" />
      <h1 id="not-found-title">Page not found</h1>
      <p>The page you are looking for does not exist or has moved.</p>
      <Link to="/">Back to home</Link>
    </section>
  )
}
