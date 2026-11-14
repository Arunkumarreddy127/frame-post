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
    </section>
  );
}
