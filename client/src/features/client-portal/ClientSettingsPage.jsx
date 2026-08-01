import { useEffect, useRef, useState } from 'react';
import { useClientAuth } from '@/features/auth/ClientAuthProvider';
import { changeClientPassword, updateClientProfile } from '@/features/auth/api';
import { toPreviewUrl } from '@/lib/fileLinks';
import '../settings/settings.css';

function getInitials(name) {
  if (!name) return 'C';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function UploadIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2-2H5a2 2 0 0 1-2-2v-4"/>
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

export function ClientSettingsPage() {
  const { client, refreshSession, signOut } = useClientAuth();
  const fileInputRef = useRef(null);
  
  const clientId = client?.Client_Id || client?.['Client ID'];
  const clientName = client?.['Client Name'] || client?.CustomerName || 'Client';
  const avatarUrl = client?.Avatar || client?.Photo || '';

  const initialEmail = client?.Email || client?.['Email ID'] || '';
  const initialPhone = client?.['Mobile Number'] || client?.['Phone No'] || '';

  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(initialPhone);
  
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState({ type: '', text: '' });

  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [avatarVersion, setAvatarVersion] = useState(0);

  const avatarSrc = avatarUrl
    ? `${toPreviewUrl(avatarUrl)}${toPreviewUrl(avatarUrl).includes('?') ? '&' : '?'}v=${avatarVersion}`
    : null;

  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [isChangingPw, setIsChangingPw] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    setEmail(initialEmail);
    setPhone(initialPhone);
    setProfileMessage({ type: '', text: '' });
    setUploadError('');
    setUploadSuccess('');
    setIsEditingProfile(false);
  }, [clientId, initialEmail, initialPhone]);

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

      await updateClientProfile(clientId, { avatarBase64: base64 });
      setUploadSuccess('Profile picture updated successfully!');
      
      await refreshSession?.();
      setAvatarVersion(version => version + 1);
      
    } catch (err) {
      setUploadError(err.message || 'Failed to upload profile picture.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileMessage({ type: '', text: '' });
    if (!email.includes('@')) {
      return setProfileMessage({ type: 'error', text: 'Please enter a valid email address.' });
    }
    
    setIsUpdatingProfile(true);
    try {
      const response = await updateClientProfile(clientId, { email, phone });
      if (response.success) {
        setProfileMessage({ type: 'success', text: 'Contact details updated successfully!' });
        await refreshSession();
        setIsEditingProfile(false);
      } else {
        setProfileMessage({ type: 'error', text: response.message || 'Failed to update contact details.' });
      }
    } catch (err) {
      setProfileMessage({ type: 'error', text: 'Network error while updating contact details.' });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');

    if (!pwForm.current) return setPwError('Enter your current password.');
    if (pwForm.next.length < 6) return setPwError('New password must be at least 6 characters.');
    if (pwForm.next !== pwForm.confirm) return setPwError('Passwords do not match.');

    setIsChangingPw(true);
    try {
      const response = await changeClientPassword(clientId, pwForm.current, pwForm.next);
      if (response.success) {
        setPwSuccess('Password changed successfully.');
        setPwForm({ current: '', next: '', confirm: '' });
      } else {
        setPwError(response.message || 'Failed to change password.');
      }
    } catch (err) {
      setPwError('Network error while changing password.');
    } finally {
      setIsChangingPw(false);
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-card">
        <div className="settings-header">
          <h2>Profile Settings</h2>
        </div>

        <div className="settings-avatar-section">
          <div className="settings-avatar-preview">
            {avatarSrc ? (
              <img src={avatarSrc} alt={clientName} />
            ) : (
              <span className="settings-avatar-initials">{getInitials(clientName)}</span>
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

        <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="settings-info-grid">
            <div className="settings-info-item">
              <span className="settings-info-label">Client Name</span>
              <span className="settings-info-value">{clientName}</span>
            </div>
            <div className="settings-info-item">
              <span className="settings-info-label">Client ID</span>
              <span className="settings-info-value">{clientId}</span>
            </div>
            
            <div className="settings-form-group" style={{ background: 'var(--wt-surface-muted)', padding: '16px 20px', borderRadius: 'var(--wt-radius-button)', border: '1px solid var(--wt-border)', justifyContent: 'center' }}>
              <label className="settings-info-label" style={{ marginBottom: 4 }}>Email</label>
              {isEditingProfile ? (
                <input
                  type="email"
                  className="settings-input"
                  style={{ padding: '8px 12px', fontSize: '14px', background: 'var(--wt-surface)', marginTop: '4px' }}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Enter email address"
                  autoFocus
                />
              ) : (
                <span className="settings-info-value">{email || 'N/A'}</span>
              )}
            </div>
            <div className="settings-form-group" style={{ background: 'var(--wt-surface-muted)', padding: '16px 20px', borderRadius: 'var(--wt-radius-button)', border: '1px solid var(--wt-border)', justifyContent: 'center' }}>
              <label className="settings-info-label" style={{ marginBottom: 4 }}>Phone No</label>
              {isEditingProfile ? (
                <input
                  type="text"
                  className="settings-input"
                  style={{ padding: '8px 12px', fontSize: '14px', background: 'var(--wt-surface)', marginTop: '4px' }}
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="Enter phone number"
                />
              ) : (
                <span className="settings-info-value">{phone || 'N/A'}</span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {isEditingProfile ? (
              <>
                <button 
                  type="submit" 
                  className="settings-submit" 
                  disabled={isUpdatingProfile || (email === initialEmail && phone === initialPhone)}
                  style={{ marginTop: 0 }}
                >
                  {isUpdatingProfile ? 'Saving...' : 'Save Changes'}
                </button>
                <button 
                  type="button" 
                  className="settings-logout-btn" 
                  style={{ marginTop: 0, padding: '10px 20px', color: 'var(--wt-text-muted)', border: '1px solid var(--wt-border)', background: 'var(--wt-surface)', boxShadow: 'none' }}
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
                style={{ marginTop: 0, background: 'var(--wt-surface)', color: 'var(--wt-primary)', border: '1px solid var(--wt-primary)', boxShadow: 'none' }}
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

      <div className="settings-card">
        <div className="settings-header">
          <h2>Security</h2>
          <p>Update your password</p>
        </div>
        
        <form className="settings-form" onSubmit={handlePasswordSubmit}>
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
