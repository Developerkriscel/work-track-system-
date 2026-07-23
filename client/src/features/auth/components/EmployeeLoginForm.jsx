export function EmployeeLoginForm({
  employeeId,
  password,
  loading,
  submitting,
  onEmployeeIdChange,
  onPasswordChange,
  onSubmit
}) {
  return (
    <form className="login-form" onSubmit={onSubmit}>
      <label className="dashboard-control">
        <span>Employee ID</span>
        <input
          value={employeeId}
          onChange={(event) => onEmployeeIdChange(event.target.value)}
          placeholder="e.g. MS101"
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
        {loading || submitting ? 'Signing In...' : 'Sign In'}
      </button>
    </form>
  );
}
