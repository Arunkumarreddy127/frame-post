import { Link } from "react-router-dom";

type HomepageProps = {
  user: { username: string };
};

export function Homepage({ user }: HomepageProps) {
  return (
    <section className="home-page">
      <div className="home-page-intro">
        <p className="eyebrow">Framepost home</p>
        <h1>Hello, {user.username}</h1>
        <p className="status">Your workspace is ready.</p>
      </div>
      <div className="home-page-actions">
        <Link to="/pages" className="primary-button">
          View pages
        </Link>
        <Link to="/create" className="secondary-button">
          Create something
        </Link>
        <Link to="/library" className="secondary-button">
          Open library
        </Link>
      </div>
    </section>
  );
}
