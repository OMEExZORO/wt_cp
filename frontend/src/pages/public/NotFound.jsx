import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="container section center">
      <h1>Page not found</h1>
      <p>The page you are looking for does not exist.</p>
      <Link to="/" className="btn">
        Back to home
      </Link>
    </div>
  );
}
