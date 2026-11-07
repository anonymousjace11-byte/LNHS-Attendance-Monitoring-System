import { useEffect, useState } from 'react';
import { Bell, KeyRound, LockKeyhole, Mail, Moon, ShieldAlert, Sun, Upload, UserRound } from 'lucide-react';
import Alert from './Alert';
import Button from './Button';
import FormField from './FormField';
import Modal from './Modal';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useTheme } from '../context/ThemeContext';

const ACCOUNT_TABS = [
  { id: 'profile', label: 'Profile', icon: UserRound },
  { id: 'security', label: 'Security', icon: LockKeyhole },
  { id: 'preferences', label: 'Preferences', icon: Sun },
];

function getInitials(name) {
  return String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || 'U';
}

export default function AccountModal({ onClose }) {
  const { user, changePassword, updateAccountProfile } = useAuth();
  const { uploadAccountPhoto } = useData();
  const { theme, setTheme } = useTheme();
  const [tab, setTab] = useState('profile');
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(user?.photoURL || '');
  const [photoError, setPhotoError] = useState('');
  const [preferredTheme, setPreferredTheme] = useState(theme);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview(user?.photoURL || '');
      return undefined;
    }
    const previewUrl = URL.createObjectURL(photoFile);
    setPhotoPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [photoFile, user?.photoURL]);

  const save = async () => {
    setError('');
    setSuccess('');

    if (tab === 'profile' && !displayName.trim()) {
      setError('Enter a display name to continue.');
      return;
    }
    if (tab === 'security') {
      if (!currentPassword || !newPassword || !confirmPassword) {
        setError('Complete all password fields to continue.');
        return;
      }
      if (newPassword.length < 6) {
        setError('Your new password must be at least 6 characters.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setError('The new passwords do not match.');
        return;
      }
    }

    setSaving(true);
    try {
      if (tab === 'profile') {
        const photoURL = photoFile ? await uploadAccountPhoto(photoFile) : user?.photoURL;
        await updateAccountProfile(displayName.trim(), photoURL);
        setPhotoFile(null);
        setSuccess(photoURL ? 'Your profile has been updated.' : 'Your display name has been updated.');
      } else if (tab === 'security') {
        await changePassword(currentPassword, newPassword);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setSuccess('Your password has been updated.');
      } else {
        const synced = await setTheme(preferredTheme);
        setSuccess(synced
          ? 'School-wide appearance has been updated.'
          : 'Appearance changed on this device, but Firebase could not sync it to other users.');
      }
    } catch (saveError) {
      const message = saveError?.message || 'Unable to save these account changes.';
      setError(message);
      window.dispatchEvent(new CustomEvent('school-app:notification', {
        detail: {
          type: 'error',
          title: 'Account changes not saved',
          message: 'We could not save your account changes. Please try again.',
          details: message,
        },
      }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Manage account"
      onClose={onClose}
      maxWidth="720px"
      className="account-settings-modal"
      portal
      footer={(
        <div className="account-settings-modal__footer">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>Close</Button>
          <Button variant="primary" size="sm" loading={saving} onClick={save}>Save Changes</Button>
        </div>
      )}
    >
      <div className="account-settings-modal__body">
        <nav className="account-settings-tabs" role="tablist" aria-label="Account settings">
          {ACCOUNT_TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              aria-controls={`account-panel-${id}`}
              className={`account-settings-tab${tab === id ? ' is-active' : ''}`}
              onClick={() => { setTab(id); setError(''); setSuccess(''); }}
            >
              <Icon size={16} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <section className="account-settings-panel" id={`account-panel-${tab}`} role="tabpanel">
          {error && <Alert type="error">{error}</Alert>}
          {success && <Alert type="success">{success}</Alert>}

          {tab === 'profile' && (
            <div className="account-settings-section">
              <div className="account-settings-profile">
                <div className="account-settings-profile__avatar">
                  {photoPreview
                    ? <img src={photoPreview} alt="" />
                    : <span>{getInitials(displayName)}</span>}
                </div>
                <div>
                  <strong>{displayName || 'Your profile'}</strong>
                  <p>Profile details for your school account.</p>
                </div>
              </div>
              <div className="account-settings-photo-control">
                <div className="account-settings-photo-control__copy">
                  <strong>Profile photo</strong>
                  <small>JPG, PNG, or WebP · up to 7 MB</small>
                </div>
                <label className="account-settings-photo-picker">
                  <Upload size={14} aria-hidden="true" />
                  <span>{photoFile ? 'Choose another' : 'Choose photo'}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    aria-label="Choose profile photo"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
                        setPhotoError('Choose a JPG, PNG, or WebP image.');
                        setPhotoFile(null);
                        return;
                      }
                      if (file.size > 7 * 1024 * 1024) {
                        setPhotoError('Choose an image smaller than 7 MB.');
                        setPhotoFile(null);
                        return;
                      }
                      setPhotoError('');
                      setPhotoFile(file);
                    }}
                  />
                </label>
              </div>
              {photoError && <Alert type="error">{photoError}</Alert>}
              <FormField label="Display name" id="account-display-name" hint="This name appears in the school system.">
                <input id="account-display-name" className="field-input" autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
              </FormField>
              <FormField label="Email address" id="account-email" hint="Email changes are managed by school IT.">
                <div className="account-settings-readonly"><Mail size={15} aria-hidden="true" /><input id="account-email" className="field-input" value={user?.email || ''} readOnly /></div>
              </FormField>
              <div className="account-settings-note"><UserRound size={15} aria-hidden="true" /><span>Verified phone changes require school verification.</span></div>
            </div>
          )}

          {tab === 'security' && (
            <div className="account-settings-section">
              <div className="account-settings-section__heading">
                <KeyRound size={18} aria-hidden="true" />
                <div><h3>Change password</h3><p>Confirm your current password before choosing a new one.</p></div>
              </div>
              <FormField label="Current password" id="account-current-password">
                <input id="account-current-password" className="field-input" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
              </FormField>
              <FormField label="New password" id="account-new-password" hint="Use at least 6 characters.">
                <input id="account-new-password" className="field-input" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
              </FormField>
              <FormField label="Confirm new password" id="account-confirm-password">
                <input id="account-confirm-password" className="field-input" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
              </FormField>
              <div className="account-settings-note"><ShieldAlert size={15} aria-hidden="true" /><span>Two-factor authentication and active-session management are not configured for this school account.</span></div>
            </div>
          )}

          {tab === 'preferences' && (
            <div className="account-settings-section">
              <div className="account-settings-section__heading">
                {preferredTheme === 'dark' ? <Moon size={18} aria-hidden="true" /> : <Sun size={18} aria-hidden="true" />}
                <div><h3>Appearance</h3><p>Changes apply here immediately and sync school-wide when Firebase is available.</p></div>
              </div>
              <div className="theme-switch" role="group" aria-label="School-wide theme">
                <button type="button" className={`theme-switch__option${preferredTheme === 'light' ? ' is-active' : ''}`} onClick={() => { setPreferredTheme('light'); setTheme('light'); }} aria-pressed={preferredTheme === 'light'}>
                  <Sun size={15} aria-hidden="true" /><span>Light</span>
                </button>
                <button type="button" className={`theme-switch__option${preferredTheme === 'dark' ? ' is-active' : ''}`} onClick={() => { setPreferredTheme('dark'); setTheme('dark'); }} aria-pressed={preferredTheme === 'dark'}>
                  <Moon size={15} aria-hidden="true" /><span>Dark</span>
                </button>
              </div>
              <div className="account-settings-note"><Bell size={15} aria-hidden="true" /><span>Personal email, SMS, and in-app notification preferences are not configured yet.</span></div>
            </div>
          )}
        </section>
      </div>
    </Modal>
  );
}
