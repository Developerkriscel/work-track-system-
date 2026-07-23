export function ClientLoginForm({
  clientId,
  password,
  loading,
  submitting,
  onClientIdChange,
  onPasswordChange,
  onSubmit
}) {
  return (
    <form className="login-form" onSubmit={onSubmit}>
      <label className="dashboard-control">
        <span>Client ID</span>
        <input
          value={clientId}
          onChange={(event) => onClientIdChange(event.target.value)}
          placeholder="e.g. CL-1024"
          autoComplete="username"
        />
      </label>

      <label className="dashboard-control">
        <span>Password</span>
        <input
          type="password"
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
          placeholder="********"
          autoComplete="current-password"
        />
      </label>

      <button type="submit" className="attendance-cta attendance-cta--purple login-form__submit" disabled={loading || submitting}>
        {loading || submitting ? 'Signing In...' : 'Enter Client Portal'}
      </button>
    </form>
  );
}
