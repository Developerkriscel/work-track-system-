import { useState } from 'react';

export function EmployeeLoginForm({
  employeeId,
  password,
  loading,
  submitting,
  onEmployeeIdChange,
  onPasswordChange,
  onSubmit
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form className="login-form" onSubmit={onSubmit}>
      <label className="dashboard-control">
        <span>Employee ID</span>
        <input
          value={employeeId}
          onChange={(event) => onEmployeeIdChange(event.target.value)}
          autoComplete="username"
        />
      </label>

      <label className="dashboard-control">
        <span>Password</span>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            autoComplete="current-password"
            style={{ width: '100%', paddingRight: '40px' }}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            title={showPassword ? "Hide password" : "Show password"}
            style={{
              position: 'absolute',
              right: '12px',
              background: 'none',
              border: 'none',
              padding: '0',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              color: '#8c9bb1'
            }}
          >
            {showPassword ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
            )}
          </button>
        </div>
      </label>

      <button type="submit" className="attendance-cta attendance-cta--purple login-form__submit" disabled={loading || submitting}>
        {loading || submitting ? 'Signing In...' : 'Sign In'}
      </button>
    </form>
  );
}
