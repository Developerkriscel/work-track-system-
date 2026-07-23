import { useRef, useState } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { changeEmployeePassword, updateEmployeeProfile, fetchEmployeeSession } from '@/features/auth/api';
import './settings.css';

function getInitials(name) {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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

  const name = user?.['Employee Name'] || user?.Name || 'Employee';
  const avatarUrl = user?.Avatar || user?.Photo || null;
  const employeeId = user?.['Employee ID'] || user?.employeeId;
  const role = user?.Role || 'User';
  const department = user?.Department || 'N/A';

  const initialEmail = user?.Email || user?.email || '';
  const initialPhone = user?.['Mobile Number'] || user?.['Phone No'] || '';

  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(initialPhone);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState({ type: '', text: '' });

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
      await refreshSession?.();
      
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
      <div className="settings-card">
        <div className="settings-header">
          <h2>Profile Settings</h2>
          <p>Manage your profile picture and view your details</p>
        </div>

        <div className="settings-avatar-section">
          <div className="settings-avatar-preview">
            {avatarUrl ? (
              <img src={avatarUrl} alt={name} />
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

        <form className="settings-form" onSubmit={handlePasswordChange}>
          <div className="settings-form-group">
            <label>Current Password</label>
            <input
              type="password"
              className="settings-input"
              value={pwForm.current}
              onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))}
            />
          </div>
          <div className="settings-form-group">
            <label>New Password</label>
            <input
              type="password"
              className="settings-input"
              value={pwForm.next}
              onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))}
            />
          </div>
          <div className="settings-form-group">
            <label>Confirm New Password</label>
            <input
              type="password"
              className="settings-input"
              value={pwForm.confirm}
              onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
            />
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
