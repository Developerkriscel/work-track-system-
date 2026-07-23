import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { changeEmployeePassword } from '@/features/auth/api';

/* ── tiny icons ── */
function ChevronDown({ open }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      style={{
        width: 16,
        height: 16,
        transition: 'transform 200ms ease',
        transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
      }}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="upm-menu__icon">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="upm-menu__icon">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 1 1 8 0v4" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="upm-menu__icon upm-menu__icon--danger">
      <path d="M14 7.5V5.8A1.8 1.8 0 0 0 12.2 4H6.8A1.8 1.8 0 0 0 5 5.8v12.4A1.8 1.8 0 0 0 6.8 20h5.4a1.8 1.8 0 0 0 1.8-1.8v-1.7" />
      <path d="M10.5 12h8" />
      <path d="m15.4 8 3.9 4-3.9 4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="upm-action-btn__icon" aria-hidden="true">
      <path d="M20.7 15.2A8.5 8.5 0 0 1 8.8 3.3 8.5 8.5 0 1 0 20.7 15.2Z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="upm-menu__icon">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function getInitials(name) {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function Avatar({ name, size = 40, src = null }) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className="upm-avatar"
        style={{ width: size, height: size, objectFit: 'cover' }}
        aria-hidden="true"
      />
    );
  }
  return (
    <div
      className="upm-avatar"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden="true"
    >
      {getInitials(name)}
    </div>
  );
}

export function UserProfileMenu({
  notificationCount = 0,
  onBell,
  onRefresh,
  onToggleTheme,
  user: overrideUser,
  onLogout,
  allowPasswordChange = true,
  notificationsOpen = false,
  onCloseNotifications,
  notificationPanel = null
}) {
  const auth = useAuth();
  const user = overrideUser || auth.user;
  const signOut = onLogout || auth.signOut;
  const [open, setOpen] = useState(false);
  const [showChangePw, setShowChangePw] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const menuRef = useRef(null);

  const name = user?.['Employee Name'] || user?.Name || 'Employee';
  const role = user?.Role || 'User';
  const email = user?.Email || user?.email || '';
  const avatar = user?.Avatar || user?.Photo || null;

  /* close on outside click */
  useEffect(() => {
    function handler(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
        setShowChangePw(false);
        onCloseNotifications?.();
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onCloseNotifications]);

  function handleChangePw(e) {
    e.preventDefault();
    setPwError('');
    if (!pwForm.current) return setPwError('Enter your current password.');
    if (pwForm.next.length < 6) return setPwError('New password must be at least 6 characters.');
    if (pwForm.next !== pwForm.confirm) return setPwError('Passwords do not match.');
    changeEmployeePassword(user?.['Employee ID'] || user?.EmployeeID || user?.employeeId, pwForm.current, pwForm.next)
      .then(() => {
        setPwSuccess(true);
        setTimeout(() => {
          setPwSuccess(false);
          setShowChangePw(false);
          setOpen(false);
          setPwForm({ current: '', next: '', confirm: '' });
        }, 1600);
      })
      .catch((error) => {
        setPwError(error.message || 'Unable to change password.');
      });
  }

  return (
    <div className="upm" ref={menuRef}>
      {/* ── topbar action icons ── */}
      <div className="upm-actions">
        {onRefresh && (
          <button className="upm-action-btn" onClick={onRefresh} title="Refresh" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="upm-action-btn__icon">
              <path d="M20 5v5h-5" />
              <path d="M4 19v-5h5" />
              <path d="M18.1 9A7.1 7.1 0 0 0 6.6 6.4L4 9" />
              <path d="M5.9 15A7.1 7.1 0 0 0 17.4 17.6L20 15" />
            </svg>
          </button>
        )}

        {/* Bell with badge */}
        <button
          className={`upm-action-btn upm-action-btn--bell${notificationsOpen ? ' upm-action-btn--active' : ''}`}
          onClick={onBell}
          title="Notifications"
          type="button"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="upm-action-btn__icon">
            <path d="M7.5 9.5a4.5 4.5 0 1 1 9 0c0 5 2 6.3 2 6.3H5.5s2-1.3 2-6.3" />
            <path d="M10 18.2a2.2 2.2 0 0 0 4 0" />
          </svg>
          {notificationCount > 0 && (
            <span className="upm-badge">{notificationCount > 9 ? '9+' : notificationCount}</span>
          )}
        </button>
        {notificationsOpen ? notificationPanel : null}
      </div>

      {/* ── user pill trigger ── */}
      <button
        id="user-profile-trigger"
        className={`upm-pill${open ? ' upm-pill--open' : ''}`}
        onClick={() => { setOpen((value) => !value); setShowChangePw(false); }}
        aria-haspopup="true"
        aria-expanded={open}
        title="Profile and account"
        type="button"
      >
        <Avatar name={name} size={40} src={avatar} />
        <span className="upm-pill__info">
          <span className="upm-pill__name">{name}</span>
          <span className="upm-pill__role">{role}</span>
        </span>
        <ChevronDown open={open} />
      </button>

      {/* ── dropdown ── */}
      {open && (
        <div className="upm-dropdown" role="menu">
          {/* user card at top */}
          <div className="upm-dropdown__header">
            <Avatar name={name} size={48} src={avatar} />
            <div>
              <p className="upm-dropdown__name">{name}</p>
              {email && <p className="upm-dropdown__email">{email}</p>}
              <span className="upm-dropdown__role-badge">{role.toUpperCase()}</span>
            </div>
          </div>

          <div className="upm-dropdown__divider" />

          {/* Change Password panel OR menu items */}
          {showChangePw ? (
            <form className="upm-pw-form" onSubmit={handleChangePw}>
              <p className="upm-pw-form__title">Change Password</p>
              {pwSuccess ? (
                <p className="upm-pw-form__success">✓ Password changed!</p>
              ) : (
                <>
                  <input
                    type="password"
                    placeholder="Current password"
                    className="upm-pw-form__input"
                    value={pwForm.current}
                    onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))}
                    autoFocus
                  />
                  <input
                    type="password"
                    placeholder="New password"
                    className="upm-pw-form__input"
                    value={pwForm.next}
                    onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))}
                  />
                  <input
                    type="password"
                    placeholder="Confirm new password"
                    className="upm-pw-form__input"
                    value={pwForm.confirm}
                    onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
                  />
                  {pwError && <p className="upm-pw-form__error">{pwError}</p>}
                  <div className="upm-pw-form__actions">
                    <button type="button" className="upm-pw-form__cancel" onClick={() => setShowChangePw(false)}>
                      Cancel
                    </button>
                    <button type="submit" className="upm-pw-form__submit">Update</button>
                  </div>
                </>
              )}
            </form>
          ) : (
            <>

              <button
                className="upm-menu__item upm-menu__item--danger"
                role="menuitem"
                onClick={signOut}
              >
                <SignOutIcon />
                Sign Out
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
