import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { changeEmployeePassword, updateEmployeeProfile } from '@/features/auth/api';
import { deleteHoliday, fetchHolidays, saveHoliday } from '@/features/settings/api';
import { toPreviewUrl } from '@/lib/fileLinks';
import './settings.css';

function getInitials(name) {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function normalizeRole(role) {
  return String(role || '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}

function hasRole(role, roles) {
  const normalized = normalizeRole(role);
  const compact = normalized.replace(/\s+/g, '');
  return roles.some((allowed) => {
    const allowedNormalized = normalizeRole(allowed);
    return allowedNormalized === normalized || allowedNormalized.replace(/\s+/g, '') === compact;
  });
}

function UploadIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
      <circle cx="12" cy="12" r="3"></circle>
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
      <line x1="1" y1="1" x2="23" y2="23"></line>
    </svg>
  );
}

export function SettingsPage() {
  const { user, signOut, refreshSession } = useAuth();
  const fileInputRef = useRef(null);
  
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');

  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [isChangingPw, setIsChangingPw] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const name = user?.['Employee Name'] || user?.Name || 'Employee';
  const avatarUrl = user?.Avatar || user?.Photo || null;
  const employeeId = user?.['Employee ID'] || user?.employeeId;
  const role = user?.Role || 'User';
  const canManageHolidays = hasRole(role, ['Admin', 'Company Admin', 'Super Admin']);
  const department = user?.Department || 'N/A';

  const initialEmail = user?.Email || user?.email || '';
  const initialPhone = user?.['Mobile Number'] || user?.['Phone No'] || '';

  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(initialPhone);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState({ type: '', text: '' });
  const [avatarVersion, setAvatarVersion] = useState(0);
  const [holidayState, setHolidayState] = useState({ loading: false, error: '', success: '', rows: [] });
  const [holidayForm, setHolidayForm] = useState({ HolidayID: '', Date: '', Name: '', Description: '' });
  const [savingHoliday, setSavingHoliday] = useState(false);

  const avatarSrc = avatarUrl
    ? `${toPreviewUrl(avatarUrl)}${toPreviewUrl(avatarUrl).includes('?') ? '&' : '?'}v=${avatarVersion}`
    : null;

  useEffect(() => {
    setEmail(initialEmail);
    setPhone(initialPhone);
    setProfileMessage({ type: '', text: '' });
    setUploadError('');
    setUploadSuccess('');
    setIsEditingProfile(false);
  }, [employeeId, initialEmail, initialPhone]);

  const loadHolidays = async () => {
    if (!canManageHolidays) return;
    setHolidayState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const payload = await fetchHolidays();
      setHolidayState({ loading: false, error: '', success: '', rows: payload.data || [] });
    } catch (error) {
      setHolidayState((current) => ({ ...current, loading: false, error: error.message || 'Failed to load holidays.' }));
    }
  };

  useEffect(() => {
    loadHolidays();
  }, [canManageHolidays]);


  const handleHolidaySubmit = async (event) => {
    event.preventDefault();
    if (!holidayForm.Date || !holidayForm.Name.trim()) {
      setHolidayState((current) => ({ ...current, error: 'Holiday date and name are required.', success: '' }));
      return;
    }
    setSavingHoliday(true);
    setHolidayState((current) => ({ ...current, error: '', success: '' }));
    try {
      await saveHoliday(holidayForm);
      setHolidayForm({ HolidayID: '', Date: '', Name: '', Description: '' });
      const payload = await fetchHolidays();
      setHolidayState({ loading: false, error: '', success: 'Holiday saved successfully.', rows: payload.data || [] });
    } catch (error) {
      setHolidayState((current) => ({ ...current, error: error.message || 'Failed to save holiday.', success: '' }));
    } finally {
      setSavingHoliday(false);
    }
  };

  const handleHolidayEdit = (holiday) => {
    setHolidayForm({
      HolidayID: holiday.HolidayID || holiday['Holiday ID'] || holiday.ID || '',
      Date: holiday.Date || holiday['Holiday Date'] || '',
      Name: holiday.Name || holiday['Holiday Name'] || '',
      Description: holiday.Description || ''
    });
    setHolidayState((current) => ({ ...current, error: '', success: '' }));
  };

  const handleHolidayDelete = async (holiday) => {
    const id = holiday.HolidayID || holiday['Holiday ID'] || holiday.ID;
    if (!id) return;
    setHolidayState((current) => ({ ...current, error: '', success: '' }));
    try {
      await deleteHoliday(id);
      const payload = await fetchHolidays();
      setHolidayState({ loading: false, error: '', success: 'Holiday deleted successfully.', rows: payload.data || [] });
      if (holidayForm.HolidayID === id) setHolidayForm({ HolidayID: '', Date: '', Name: '', Description: '' });
    } catch (error) {
      setHolidayState((current) => ({ ...current, error: error.message || 'Failed to delete holiday.', success: '' }));
    }
  };

  // Avatar Upload Logic
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Please select a valid image file.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setUploadError('Image size should be less than 2MB.');
      return;
    }

    setIsUploading(true);
    setUploadError('');
    setUploadSuccess('');

    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      await updateEmployeeProfile(employeeId, { avatarBase64: base64 });
      setUploadSuccess('Profile picture updated successfully!');
      
      // Refresh user session to get the new avatar
      await refreshSession?.(employeeId);
      setAvatarVersion(version => version + 1);
      
    } catch (err) {
      setUploadError(err.message || 'Failed to upload profile picture.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setIsUpdatingProfile(true);
    setProfileMessage({ type: '', text: '' });

    try {
      await updateEmployeeProfile(employeeId, { email, phone });
      setProfileMessage({ type: 'success', text: 'Contact details updated successfully!' });
      setIsEditingProfile(false);
      await refreshSession?.();
    } catch (error) {
      setProfileMessage({ type: 'error', text: error.message || 'Failed to update contact details.' });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');

    if (!pwForm.current) return setPwError('Enter your current password.');
    if (pwForm.next.length < 6) return setPwError('New password must be at least 6 characters.');
    if (pwForm.next !== pwForm.confirm) return setPwError('Passwords do not match.');

    setIsChangingPw(true);
    try {
      await changeEmployeePassword(employeeId, pwForm.current, pwForm.next);
      setPwSuccess('Password changed successfully.');
      setPwForm({ current: '', next: '', confirm: '' });
    } catch (error) {
      setPwError(error.message || 'Unable to change password.');
    } finally {
      setIsChangingPw(false);
    }
  };

  return (
    <div className="settings-page">

      <div className="settings-card" id="settings-profile">
        <div className="settings-header">
          <h2>Profile Settings</h2>
        </div>

        <div className="settings-avatar-section">
          <div className="settings-avatar-preview">
            {avatarSrc ? (
              <img src={avatarSrc} alt={name} />
            ) : (
              <span className="settings-avatar-initials">{getInitials(name)}</span>
            )}
          </div>
          <div className="settings-avatar-actions">
            <input 
              type="file" 
              ref={fileInputRef} 
              className="settings-file-input" 
              accept="image/*"
              onChange={handleFileChange}
            />
            <button 
              className="settings-upload-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              type="button"
            >
              <UploadIcon />
              {isUploading ? 'Uploading...' : 'Change Picture'}
            </button>
            {uploadError && <div className="settings-message settings-message--error">{uploadError}</div>}
            {uploadSuccess && <div className="settings-message settings-message--success">{uploadSuccess}</div>}
          </div>
        </div>

        <form onSubmit={handleProfileUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="settings-info-grid">
            <div className="settings-info-item">
              <span className="settings-info-label">Full Name</span>
              <span className="settings-info-value">{name}</span>
            </div>
            <div className="settings-info-item">
              <span className="settings-info-label">Employee ID</span>
              <span className="settings-info-value">{employeeId}</span>
            </div>
            <div className="settings-info-item">
              <span className="settings-info-label">Role</span>
              <span className="settings-info-value">{role}</span>
            </div>
            <div className="settings-info-item">
              <span className="settings-info-label">Department</span>
              <span className="settings-info-value">{department}</span>
            </div>
            
            <div className="settings-form-group settings-info-item">
              <label className="settings-info-label" style={{ marginBottom: 4 }}>Email</label>
              {isEditingProfile ? (
                <input
                  type="email"
                  className="settings-input"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Enter email address"
                  autoFocus
                />
              ) : (
                <span className="settings-info-value">{email || 'N/A'}</span>
              )}
            </div>
            <div className="settings-form-group settings-info-item">
              <label className="settings-info-label" style={{ marginBottom: 4 }}>Phone No</label>
              {isEditingProfile ? (
                <input
                  type="text"
                  className="settings-input"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="Enter phone number"
                />
              ) : (
                <span className="settings-info-value">{phone || 'N/A'}</span>
              )}
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '16px' }}>
            {isEditingProfile ? (
              <>
                <button 
                  type="submit" 
                  className="settings-submit" 
                  disabled={isUpdatingProfile || (email === initialEmail && phone === initialPhone)}
                  style={{ margin: 0 }}
                >
                  {isUpdatingProfile ? 'Saving...' : 'Save Changes'}
                </button>
                <button 
                  type="button" 
                  className="settings-logout-btn" 
                  style={{ margin: 0, padding: '14px 28px', color: 'var(--wt-text-muted)', border: '1px solid var(--wt-border)', background: 'var(--wt-surface)', boxShadow: 'none' }}
                  onClick={() => {
                    setIsEditingProfile(false);
                    setEmail(initialEmail);
                    setPhone(initialPhone);
                    setProfileMessage({ type: '', text: '' });
                  }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button 
                type="button" 
                className="settings-submit" 
                style={{ margin: 0, background: 'rgba(255, 255, 255, 0.8)', color: '#4f46e5', border: '1px solid rgba(99, 102, 241, 0.4)', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.1)' }}
                onClick={(e) => { e.preventDefault(); setIsEditingProfile(true); }}
              >
                Edit Contact Details
              </button>
            )}
            
            {profileMessage.text && (
              <div className={`settings-message settings-message--${profileMessage.type}`} style={{ margin: 0, padding: '8px 12px' }}>
                {profileMessage.text}
              </div>
            )}
          </div>
        </form>
      </div>

      <div className="settings-card" id="settings-security">
        <div className="settings-header">
          <h2>Security</h2>
          <p>Update your password</p>
        </div>

        <form className="settings-form" onSubmit={handlePasswordChange}>
          <div className="settings-form-group">
            <label>Current Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? "text" : "password"}
                className="settings-input"
                value={pwForm.current}
                onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))}
                style={{ width: '100%', paddingRight: '40px' }}
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--wt-text-muted)', display: 'flex', alignItems: 'center', padding: 0 }}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>
          <div className="settings-form-group">
            <label>New Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? "text" : "password"}
                className="settings-input"
                value={pwForm.next}
                onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))}
                style={{ width: '100%', paddingRight: '40px' }}
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--wt-text-muted)', display: 'flex', alignItems: 'center', padding: 0 }}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>
          <div className="settings-form-group">
            <label>Confirm New Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? "text" : "password"}
                className="settings-input"
                value={pwForm.confirm}
                onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
                style={{ width: '100%', paddingRight: '40px' }}
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--wt-text-muted)', display: 'flex', alignItems: 'center', padding: 0 }}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>
          
          <button type="submit" className="settings-submit" disabled={isChangingPw}>
            {isChangingPw ? 'Updating...' : 'Change Password'}
          </button>
          
          {pwError && <div className="settings-message settings-message--error">{pwError}</div>}
          {pwSuccess && <div className="settings-message settings-message--success">{pwSuccess}</div>}
        </form>
      </div>

      {canManageHolidays && (
        <div className="settings-card" id="settings-holidays">
          <div className="settings-header">
            <h2>Holiday Settings</h2>
            <p>Add company holidays. On holiday dates, WhatsApp alerts are skipped and attendance shows Holiday.</p>
          </div>

          <form className="settings-form settings-holiday-form" onSubmit={handleHolidaySubmit}>
            <input type="hidden" value={holidayForm.HolidayID} readOnly />
            <div className="settings-form-group">
              <label>Holiday Date</label>
              <input type="date" className="settings-input" value={holidayForm.Date} onChange={(event) => setHolidayForm((current) => ({ ...current, Date: event.target.value }))} />
            </div>
            <div className="settings-form-group">
              <label>Holiday Name</label>
              <input type="text" className="settings-input" value={holidayForm.Name} onChange={(event) => setHolidayForm((current) => ({ ...current, Name: event.target.value }))} placeholder="e.g. Diwali, Independence Day" />
            </div>
            <div className="settings-form-group">
              <label>Description</label>
              <input type="text" className="settings-input" value={holidayForm.Description} onChange={(event) => setHolidayForm((current) => ({ ...current, Description: event.target.value }))} placeholder="Optional note" />
            </div>
            <div className="settings-holiday-actions">
              <button type="submit" className="settings-submit" disabled={savingHoliday}>{savingHoliday ? 'Saving...' : holidayForm.HolidayID ? 'Update Holiday' : 'Add Holiday'}</button>
              {holidayForm.HolidayID && <button type="button" className="settings-logout-btn settings-secondary-btn" onClick={() => setHolidayForm({ HolidayID: '', Date: '', Name: '', Description: '' })}>Cancel Edit</button>}
            </div>
            {holidayState.error && <div className="settings-message settings-message--error">{holidayState.error}</div>}
            {holidayState.success && <div className="settings-message settings-message--success">{holidayState.success}</div>}
          </form>

          <div className="settings-holiday-list">
            {holidayState.loading ? (
              <div className="settings-holiday-empty">Loading holidays...</div>
            ) : holidayState.rows.length ? (
              holidayState.rows.map((holiday) => {
                const id = holiday.HolidayID || holiday['Holiday ID'] || holiday.ID;
                return (
                  <div className="settings-holiday-row" key={id || holiday.Date}>
                    <div>
                      <strong>{holiday.Name || holiday['Holiday Name'] || 'Holiday'}</strong>
                      <span>{holiday.Date || holiday['Holiday Date']} {holiday.Description ? ' - ' + holiday.Description : ''}</span>
                    </div>
                    <div className="settings-holiday-row-actions">
                      <button type="button" onClick={() => handleHolidayEdit(holiday)}>Edit</button>
                      <button type="button" onClick={() => handleHolidayDelete(holiday)}>Delete</button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="settings-holiday-empty">No holidays added yet.</div>
            )}
          </div>
        </div>
      )}

      <div className="settings-card settings-danger-card">
        <div className="settings-header">
          <h2>Danger Zone</h2>
          <p>Sign out of your account on this device</p>
        </div>
        <button className="settings-logout-btn" onClick={signOut} type="button">
          <LogoutIcon />
          Sign Out
        </button>
      </div>
    </div>
  );
}
