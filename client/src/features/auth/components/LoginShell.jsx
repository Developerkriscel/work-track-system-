export function LoginShell({
  children,
  eyebrow = 'WorkTrack System',
  title = 'Work Track System',
  copy = ''
}) {
  return (
    <main className="login-screen">
      <section className="login-card">
        <div className="login-card__brand">
          <img src="/worktrack-logo.png" alt="WorkTrack System" className="login-card__logo" />
          <div>
            <h1 className="login-card__title">{title}</h1>
          </div>
        </div>

        {copy && <p className="login-card__copy">{copy}</p>}

        {children}
      </section>
    </main>
  );
}
