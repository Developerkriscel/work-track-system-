export function LoginShell({
  children,
  eyebrow = 'WorkTrack System',
  title = 'Work Track System',
  copy = 'Login with your employee ID and password.'
}) {
  return (
    <main className="login-screen">
      <section className="login-card">
        <div className="login-card__brand">
          <img src="/worktrack-logo.png" alt="WorkTrack System" className="login-card__logo" />
          <div>
            <p className="login-card__eyebrow">{eyebrow}</p>
            <h1 className="login-card__title">{title}</h1>
          </div>
        </div>

        <p className="login-card__copy">{copy}</p>

        {children}
      </section>
    </main>
  );
}
