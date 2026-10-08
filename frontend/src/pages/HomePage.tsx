import { Link } from 'react-router-dom'

export default function HomePage() {
  return (
    <section className="container hero" aria-labelledby="home-title">
      <h1 id="home-title">Meghnad Diagnostic Centre</h1>
      <p>Imaging for a Healthier Tomorrow</p>
      <Link to="/register" className="btn btn--primary">
        Create an account
      </Link>
    </section>
  )
}
