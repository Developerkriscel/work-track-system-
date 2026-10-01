import { useEffect, useRef, useState } from 'react';
import { fetchWhatsAppIntegration, saveWhatsAppIntegration, sendWhatsAppTestMessage } from './api';
import './whatsapp-integration.css';

const PDF_LIMIT_BYTES = 8 * 1024 * 1024;

function fileToPdfPayload(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) return reject(new Error('Only PDF files can be attached.'));
    if (file.size > PDF_LIMIT_BYTES) return reject(new Error('PDF must be 8 MB or smaller.'));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected PDF.'));
    reader.onload = () => resolve({
      base64: String(reader.result || '').split(',').pop() || '',
      fileName: file.name,
      contentType: 'application/pdf'
    });
    reader.readAsDataURL(file);
  });
}

export default function WhatsAppIntegration({ onSaved, contacts = [] }) {
  const [saved, setSaved] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  const [testContact, setTestContact] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [testPdf, setTestPdf] = useState(null);
  const requestLock = useRef(false);
  const dirty = form && saved && (Boolean(form.accessToken) || ['provider', 'providerName', 'apiBaseUrl', 'instanceId', 'senderNumber'].some((key) => form[key] !== saved[key]));

  async function test() {
    if (requestLock.current || dirty || !testContact) return;
    requestLock.current = true;
    setBusy(true); setError(''); setNotice('');
    try {
      const pdfAttachment = await fileToPdfPayload(testPdf);
      const result = await sendWhatsAppTestMessage(testContact, { message: testMessage, pdfAttachment });
      if (!result.success) throw new Error(result.message);
      setNotice(result.message);
      setTestPdf(null);
    } catch (e) {
      setError(e.message);
    } finally {
      requestLock.current = false;
      setBusy(false);
      onSaved();
    }
  }

  async function load() {
    if (requestLock.current) return;
    requestLock.current = true;
    setError(''); setNotice(''); setBusy(true);
    try {
      const result = await fetchWhatsAppIntegration();
      setSaved(result.settings);
      setForm({ ...result.settings, accessToken: '' });
    } catch (e) {
      setError(e.message);
    } finally {
      requestLock.current = false;
      setBusy(false);
    }
  }

  useEffect(() => { load(); }, []);
  function change(key, value) { setForm((prev) => ({ ...prev, [key]: value })); setNotice(''); }

  async function submit(event) {
    event.preventDefault();
    if (requestLock.current) return;
    requestLock.current = true;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await saveWhatsAppIntegration(form);
      setSaved(result.settings); setForm({ ...result.settings, accessToken: '' }); setVisible(false);
      setNotice('Provider settings saved. New messages now use this configuration. Use Test active provider below to check delivery.');
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      requestLock.current = false;
      setBusy(false);
    }
  }

  return <section className="wa-integration">
    <header><h2>WhatsApp Integration</h2><p>Manage the provider used for test messages and automatic alerts.</p></header>
    {error && <div className="wa-feedback wa-feedback--error" role="alert">{error}<button type="button" className="wa-link" onClick={load} disabled={busy}>Reload</button></div>}
    {!form ? <p role="status">{busy ? 'Loading provider settings...' : 'Provider settings are available to Super Admin only.'}</p> : <>
      <div className="wa-integration-current"><strong>Current: {saved.providerName}</strong><span>{saved.configured ? 'Configured' : 'Setup required'} - {saved.source === 'environment' ? 'Server defaults' : 'Saved settings'}</span></div>
      {notice && <div className="wa-feedback" role="status">{notice}</div>}
      <form className="wa-form" onSubmit={submit}>
        <fieldset disabled={busy}>
          <label><span>Provider</span><select value={form.provider} onChange={(e) => change('provider', e.target.value)}><option value="aknexus">AKNexus</option><option value="compatible">AKNexus-compatible provider</option></select><small>Compatible providers must support POST /send with number, type, message, instance_id and access_token. Other API formats need an adapter.</small></label>
          {form.provider === 'compatible' && <label><span>Provider name</span><input required maxLength={80} value={form.providerName} onChange={(e) => change('providerName', e.target.value)} /></label>}
          <label><span>API Base URL</span><input type="url" required value={form.apiBaseUrl} onChange={(e) => change('apiBaseUrl', e.target.value)} /><small>Use the provider's base URL for the supported /send API. Keep the current URL unless switching provider endpoints.</small></label>
          <label><span>API Token</span><div className="wa-token-input"><input type={visible ? 'text' : 'password'} autoComplete="new-password" value={form.accessToken} placeholder={saved.hasToken ? 'Token saved - leave blank to keep it' : 'Enter API token'} onChange={(e) => change('accessToken', e.target.value)} /><button type="button" onClick={() => setVisible((value) => !value)} aria-label={visible ? 'Hide entered token' : 'Show entered token'}>{visible ? 'Hide' : 'Show'}</button></div><small>Saved tokens are never displayed. Enter a new token when changing provider or API URL.</small></label>
          <div className="wa-form-grid">
            <label><span>Instance ID</span><input required maxLength={128} value={form.instanceId} onChange={(e) => change('instanceId', e.target.value)} /></label>
            <label><span>Sender number (optional)</span><input type="tel" placeholder="+919876543210" value={form.senderNumber} onChange={(e) => change('senderNumber', e.target.value)} /><small>Reference only. Messages send from the WhatsApp account connected to the instance.</small></label>
          </div>
        </fieldset>
        <footer className="wa-form-footer"><button type="button" className="wa-button" disabled={busy} onClick={() => { setForm({ ...saved, accessToken: '' }); setError(''); setNotice(''); }}>Discard changes</button><button type="submit" className="wa-button wa-button--primary" disabled={busy}>{busy ? 'Saving...' : 'Save & activate'}</button></footer>
      </form>
      <div className="wa-integration-test wa-form">
        <h3>Test active provider</h3>
        <p>Send a real text message, or attach a PDF with the text as caption.</p>
        <label>
          <span>Test recipient</span>
          <select value={testContact} onChange={(e) => setTestContact(e.target.value)} disabled={busy}>
            <option value="">Select a contact</option>
            {contacts.filter((c) => c.enabled).map((c) => <option value={c.id} key={c.id}>{c.name} - {c.phone}</option>)}
          </select>
        </label>
        <label>
          <span>Message text</span>
          <textarea rows={3} maxLength={4000} value={testMessage} onChange={(e) => setTestMessage(e.target.value)} placeholder="Leave blank to send the default test text." disabled={busy} />
        </label>
        <label>
          <span>PDF attachment <small>(optional)</small></span>
          <input type="file" accept="application/pdf,.pdf" disabled={busy} onChange={(e) => setTestPdf(e.target.files?.[0] || null)} />
          <small>{testPdf ? `${testPdf.name} (${Math.ceil(testPdf.size / 1024)} KB)` : 'Attach one PDF up to 8 MB.'}</small>
        </label>
        <button type="button" className="wa-button" disabled={busy || dirty || !testContact || !saved.configured} onClick={test}>{testPdf ? 'Send text + PDF' : 'Send test message'}</button>
        {dirty && <small>Save or discard changes before testing the active provider.</small>}
      </div>
    </>}
  </section>;
}
