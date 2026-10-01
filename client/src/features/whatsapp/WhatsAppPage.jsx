import { useEffect, useMemo, useRef, useState } from 'react';
import { AppModal } from '@/components/modals';
import { BadgeCheck, CheckIcon, Clock3, FileText, MessageCircle, Users } from '@/components/common/icons';
import { fetchWhatsAppWorkspace, saveWhatsAppContact, sendWhatsAppTestMessage } from './api';
import './whatsapp.css';
import './whatsapp-mobile.css';
import WhatsAppIntegration from './WhatsAppIntegration';

const CATEGORIES = {
  ticket: 'Ticket updates',
  approval: 'Approvals',
  reminder: 'Reminders',
  attendance: 'Leave & attendance',
  expense: 'Expenses',
  fms: 'FMS tasks'
};

const emptyForm = () => ({
  id: '',
  employeeId: '',
  clientId: '',
  name: '',
  phone: '',
  department: '',
  enabled: true,
  alertTypes: Object.keys(CATEGORIES),
  notes: ''
});

const phoneKey = (value = '') => {
  const digits = value.replace(/\D/g, '');
  return digits.length === 10 ? `91${digits}` : digits;
};
const contains = (values, search) => values.join(' ').toLowerCase().includes(search.toLowerCase().trim());
const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?';
const statusTone = (status = '') => /fail|error|reject/i.test(status) ? 'danger' : /deliver|read/i.test(status) ? 'green' : /sent|accept/i.test(status) ? 'blue' : 'muted';
const logMatches = (log, person, contact) => log.employeeId ? log.employeeId === person.id : [person.phone, contact?.phone].filter(Boolean).some((phone) => phoneKey(phone) === phoneKey(log.phone));

function dateLabel(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value || '-' : date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });
}

function timeLabel(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
}

function dayLabel(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'No date' : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

function Pill({ children, tone = 'muted' }) {
  return <span className={`wa-pill wa-pill--${tone}`}>{children}</span>;
}

function Person({ name, subtitle }) {
  return (
    <div className="wa-person">
      <span className="wa-avatar">{initials(name)}</span>
      <span>
        <strong>{name || 'Unnamed contact'}</strong>
        <small>{subtitle || 'External contact'}</small>
      </span>
    </div>
  );
}

function Empty({ title, children, action }) {
  return (
    <div className="wa-empty">
      <FileText />
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}

function ChatHistory({ rows, selectedId, setSelectedId, search, setSearch, filter, setFilter, category, setCategory, date, setDate, data, historyLoading, openEditor, setDetail }) {
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const selected = rows.find((row) => row.id === selectedId) || rows[0] || null;
  const chatLogs = [...(selected?.history || [])].sort((a, b) => (Date.parse(a.timestamp) || 0) - (Date.parse(b.timestamp) || 0));
  const alertTypes = [...new Set(data.logs.map((log) => log.alertType).filter(Boolean))];
  let lastDay = '';

  return (
    <div className={`wa-chat-shell${mobileChatOpen ? ' wa-chat-shell--conversation' : ''}`}>
      <aside className="wa-chat-sidebar" aria-label="WhatsApp alert recipients">
        <div className="wa-chat-sidebar-head">
          <div>
            <h2>Alert chats</h2>
            <p>{rows.length} recipients</p>
          </div>
          <button className="wa-chat-icon-btn" type="button" onClick={() => openEditor()} title="Add contact">+</button>
        </div>

        <label className="wa-chat-search">
          <span>Search chats</span>
          <input type="search" placeholder="Search employee, number or ticket..." value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>

        <div className="wa-chat-chips" aria-label="Chat filters">
          {[
            ['', 'All'],
            ['no-contact', 'No contact'],
            ['no-alerts', 'No alerts'],
            ['failed', 'Failed']
          ].map(([value, label]) => (
            <button key={label} className={filter === value ? 'is-active' : ''} type="button" onClick={() => setFilter(value)}>
              {label}
            </button>
          ))}
        </div>

        <div className="wa-chat-list">
          {rows.length ? rows.map((row) => (
            <button key={row.id} className={`wa-chat-contact ${selected?.id === row.id ? 'is-active' : ''}`} type="button" onClick={() => { setSelectedId(row.id); setMobileChatOpen(true); }}>
              <span className="wa-chat-avatar">{initials(row.name)}</span>
              <span className="wa-chat-contact-main">
                <span><strong>{row.name}</strong><small>{row.last ? timeLabel(row.last.timestamp) : ''}</small></span>
                <em>{row.last?.message || row.contact?.phone || row.phone || 'Number not configured'}</em>
              </span>
              {row.history.length ? <b>{row.history.length}</b> : null}
            </button>
          )) : <Empty title="No chats found">Try another search or reset filters.</Empty>}
        </div>
      </aside>

      <section className="wa-chat-panel" aria-label="Selected WhatsApp alert conversation">
        {selected ? (
          <>
            <header className="wa-chat-topbar">
              <div className="wa-chat-identity">
                <button type="button" className="wa-chat-back" aria-label="Back to contacts" onClick={() => setMobileChatOpen(false)}>←</button>
                <span className="wa-chat-avatar wa-chat-avatar--large">{initials(selected.name)}</span>
                <div>
                  <h2>{selected.name}</h2>
                  <p>{selected.contact?.phone || selected.phone || 'WhatsApp number not configured'} - {selected.department || selected.id}</p>
                </div>
              </div>
              <div className="wa-chat-tools">
                <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Alert type">
                  <option value="">All alert types</option>
                  {alertTypes.map((type) => <option key={type}>{type}</option>)}
                </select>
                <input type="date" value={date} onChange={(event) => setDate(event.target.value)} aria-label="Date IST" />
                {(search || filter || category || date) ? (
                  <button className="wa-chat-clear" type="button" onClick={() => { setSearch(''); setFilter(''); setCategory(''); setDate(''); }}>
                    Clear
                  </button>
                ) : null}
              </div>
            </header>

            <div className="wa-chat-body">
              {historyLoading ? (
                <div className="wa-chat-empty">
                  <MessageCircle />
                  <h3>Loading alert history...</h3>
                  <p>Contacts are ready. Recent WhatsApp records are loading in the background.</p>
                </div>
              ) : chatLogs.length ? chatLogs.map((log) => {
                const currentDay = dayLabel(log.timestamp);
                const showDay = currentDay !== lastDay;
                lastDay = currentDay;
                const failed = statusTone(log.status) === 'danger';
                return (
                  <div key={log.id} className="wa-chat-message-wrap">
                    {showDay ? <div className="wa-chat-date">{currentDay}</div> : null}
                    <article className={`wa-chat-bubble ${failed ? 'wa-chat-bubble--failed' : ''}`}>
                      <header>
                        <strong>{log.alertType}</strong>
                        <Pill tone={statusTone(log.status)}>{log.status}</Pill>
                      </header>
                      <p>{log.message || 'Message content was not stored in this record.'}</p>
                      <footer>
                        <span>{log.entityId || log.phone || 'Recorded alert'}</span>
                        <span>{timeLabel(log.timestamp)}</span>
                        <CheckIcon />
                      </footer>
                      {log.attachmentUrl ? <a className="wa-attachment-link" href={log.attachmentUrl} target="_blank" rel="noreferrer">{log.attachmentName || 'Open attached PDF'}</a> : null}
                      {log.error ? <div className="wa-chat-error">{log.error}</div> : null}
                    </article>
                  </div>
                );
              }) : (
                <div className="wa-chat-empty">
                  <MessageCircle />
                  <h3>No alerts recorded</h3>
                  <p>Sent alerts and failed attempts for this recipient will appear here.</p>
                </div>
              )}
            </div>

            <footer className="wa-chat-composer">
              <button type="button" onClick={() => openEditor(selected.contact, selected)}>
                {selected.contact ? 'Edit contact' : 'Set up number'}
              </button>
              <button type="button" onClick={() => setDetail({ person: selected, logs: selected.history })}>Open details</button>
              <span>Read-only alert history</span>
            </footer>
          </>
        ) : (
          <Empty title="No employees available" action={<button type="button" className="wa-chat-back" onClick={() => setMobileChatOpen(false)}>Back to contacts</button>}>Add employees or contacts to start reviewing WhatsApp alert history.</Empty>
        )}
      </section>
    </div>
  );
}

export function WhatsAppPage() {
  const [tab, setTab] = useState('history');
  const [data, setData] = useState({ employees: [], clients: [], contacts: [], logs: [] });
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState('');
  const [editor, setEditor] = useState(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [togglingContactId, setTogglingContactId] = useState('');
  const [testingContactId, setTestingContactId] = useState('');
  const [detail, setDetail] = useState(null);
  const [page, setPage] = useState(1);
  const [selectedChatId, setSelectedChatId] = useState('');
  const requestVersion = useRef(0);
  const saveLock = useRef(false);
  const tabRefs = useRef([]);

  async function refresh() {
    const version = ++requestVersion.current;
    setLoading(true);
    setHistoryLoading(false);
    setLoadError('');
    try {
      const result = await fetchWhatsAppWorkspace({ includeLogs: false });
      if (!result.success) throw new Error(result.message || 'Unable to load workspace.');
      if (version === requestVersion.current) {
        setData({ ...result, clients: result.clients || [], logs: [] });
        setLoading(false);
        setHistoryLoading(true);
        fetchWhatsAppWorkspace({ includeLogs: true, historyLimit: 300 })
          .then((history) => {
            if (!history.success) throw new Error(history.message || 'Unable to load alert history.');
            if (version === requestVersion.current) setData((prev) => ({
              ...prev,
              logs: history.logs || [],
              logLimit: history.logLimit || prev.logLimit,
              providerName: history.providerName || prev.providerName,
              automaticAlertsEnabled: history.automaticAlertsEnabled ?? prev.automaticAlertsEnabled,
              sendingEnabled: history.sendingEnabled ?? prev.sendingEnabled
            }));
          })
          .catch((error) => {
            if (version === requestVersion.current) setNotice(`WhatsApp history is still loading slowly: ${error.message}`);
          })
          .finally(() => {
            if (version === requestVersion.current) setHistoryLoading(false);
          });
      }
    } catch (error) {
      if (version === requestVersion.current) setLoadError(error.message);
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    return () => { requestVersion.current++; };
  }, []);
  useEffect(() => { setPage(1); }, [search, filter, category, date, tab]);

  const contactByEmployee = useMemo(() => new Map(data.contacts.filter((contact) => contact.employeeId).map((contact) => [contact.employeeId, contact])), [data.contacts]);
  const filteredLogs = useMemo(() => data.logs.filter((log) => {
    const timestamp = new Date(log.timestamp);
    const localDay = Number.isNaN(timestamp.getTime()) ? '' : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(timestamp);
    return (!category || log.alertType === category) && (!date || localDay === date);
  }).sort((a, b) => (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0)), [data.logs, category, date]);

  const employees = useMemo(() => data.employees.map((person) => {
    const contact = contactByEmployee.get(person.id);
    const history = filteredLogs.filter((log) => logMatches(log, person, contact));
    return { ...person, contact, history, last: history[0] };
  }), [data.employees, contactByEmployee, filteredLogs]);

  const employeeRows = employees.filter((person) => contains([person.name, person.id, person.department, person.contact?.phone || person.phone, person.last?.message || '', person.last?.entityId || ''], search) && (!filter || (filter === 'no-contact' ? !person.contact : filter === 'no-alerts' ? !person.history.length : person.history.some((log) => statusTone(log.status) === 'danger'))));
  const contactRows = data.contacts.filter((contact) => contains([contact.name, contact.employeeId, contact.clientId, contact.phone, contact.department], search) && (!filter || (filter === 'enabled' ? contact.enabled : !contact.enabled)));
  const pageCount = Math.max(1, Math.ceil(contactRows.length / 15));
  const currentPage = Math.min(page, pageCount);
  const visibleContacts = contactRows.slice((currentPage - 1) * 15, currentPage * 15);

  useEffect(() => {
    if (tab !== 'history' || loading || loadError) return;
    if (!employeeRows.some((row) => row.id === selectedChatId)) setSelectedChatId(employeeRows[0]?.id || '');
  }, [employeeRows, selectedChatId, tab, loading, loadError]);

  function changeTab(next) {
    setTab(next);
    setSearch('');
    setFilter('');
    setCategory('');
    setDate('');
    setNotice('');
  }

  function openEditor(contact, employee) {
    setFormError('');
    setEditor(contact ? { ...contact } : {
      ...emptyForm(),
      ...(employee ? {
        employeeId: employee.id,
        name: employee.name,
        phone: employee.phone,
        department: employee.department,
        enabled: employee.status.toLowerCase() !== 'inactive'
      } : {})
    });
  }

  function selectEmployee(value) {
    const isClient = value.startsWith('client:');
    const id = value ? value.slice(value.indexOf(':') + 1) : '';
    const employee = (isClient ? data.clients : data.employees).find((person) => person.id === id);
    const existing = isClient ? data.contacts.find((contact) => contact.clientId === id) : contactByEmployee.get(id);
    if (existing && existing.id !== editor.id) {
      setFormError('This recipient already has a WhatsApp contact. Edit it from the contacts list.');
      return;
    }
    setFormError('');
    setEditor((prev) => ({
      ...prev,
      employeeId: isClient ? '' : id,
      clientId: isClient ? id : '',
      alertTypes: isClient ? ['ticket'] : prev.clientId ? Object.keys(CATEGORIES) : prev.alertTypes,
      name: employee?.name || '',
      phone: employee?.phone || '',
      department: employee?.department || '',
      enabled: employee?.status.toLowerCase() !== 'inactive'
    }));
  }

  async function submit(event) {
    event.preventDefault();
    if (saveLock.current) return;
    saveLock.current = true;
    setSaving(true);
    setFormError('');
    try {
      const result = await saveWhatsAppContact(editor);
      if (!result.success) throw new Error(result.message || 'Unable to save contact.');
      ++requestVersion.current;
      setLoading(false);
      setData((prev) => ({
        ...prev,
        contacts: [...prev.contacts.filter((contact) => contact.id !== result.contact.id), result.contact].sort((a, b) => a.name.localeCompare(b.name))
      }));
      setEditor(null);
      changeTab('contacts');
      setNotice('WhatsApp contact saved.');
    } catch (error) {
      setFormError(error.message);
    } finally {
      setSaving(false);
      saveLock.current = false;
    }
  }

  async function toggleContactAlerts(contact) {
    if (saving || togglingContactId) return;
    if (!contact.enabled && !contact.alertTypes.length) {
      setFormError('Select at least one alert category before enabling alerts.');
      setEditor({ ...contact, enabled: true });
      return;
    }
    setTogglingContactId(contact.id);
    setLoadError('');
    setNotice('');
    try {
      const result = await saveWhatsAppContact({ ...contact, enabled: !contact.enabled });
      if (!result.success) throw new Error(result.message || 'Unable to update alert preference.');
      setData((prev) => ({
        ...prev,
        contacts: prev.contacts.map((item) => (item.id === result.contact.id ? result.contact : item))
      }));
      setNotice(`${result.contact.name} alerts ${result.contact.enabled ? 'enabled' : 'disabled'}.`);
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setTogglingContactId('');
    }
  }

  async function sendTest(contact) {
    if (saving || togglingContactId || testingContactId) return;
    setTestingContactId(contact.id);
    setLoadError('');
    setNotice('');
    try {
      const result = await sendWhatsAppTestMessage(contact.id);
      if (!result.success) throw new Error(result.message || 'Unable to send WhatsApp test message.');
      setNotice(result.message || `Provider accepted the test message for ${contact.name}.`);
      await refresh();
    } catch (error) {
      await refresh();
      setLoadError(error.message);
    } finally {
      setTestingContactId('');
    }
  }

  return (
    <section className="wa-page">
      <header className="wa-heading">
        <div>
          <div className="wa-eyebrow">COMMUNICATIONS</div>
          <h1>WhatsApp Center <Pill tone="green">{data.providerName || 'AKNexus'}</Pill><Pill tone={data.sendingEnabled ? 'green' : 'muted'}>{data.sendingEnabled ? data.automaticAlertsEnabled ? 'Automatic alerts on' : 'Configured' : 'Setup'}</Pill></h1>
        </div>
        <div className="wa-heading-actions">
          <button className="wa-button" onClick={refresh} disabled={loading}>{loading ? 'Loading...' : 'Refresh'}</button>
          <button className="wa-button wa-button--primary" disabled={loading || !!loadError} onClick={() => openEditor()}>+ Add contact</button>
        </div>
      </header>

      {loadError && <div className="wa-feedback wa-feedback--error" role="alert">{loadError} <button className="wa-link" onClick={refresh}>Try again</button></div>}
      {notice && <div className="wa-feedback" role="status">{notice}<button className="wa-link" aria-label="Dismiss notification" onClick={() => setNotice('')}>Dismiss</button></div>}

      <div className="wa-stats">
        {[
          [Users, 'Employees', data.employees.length, 'In your accessible directory', 'blue'],
          [BadgeCheck, 'Saved contacts', data.contacts.length, `${data.contacts.filter((contact) => contact.enabled).length} with alerts enabled`, 'green'],
          [FileText, 'Recorded alerts', historyLoading ? '-' : data.logs.length, historyLoading ? 'Loading recent history' : 'Available historical records', 'purple'],
          [Clock3, 'Failed alerts', data.logs.filter((log) => statusTone(log.status) === 'danger').length, 'In the loaded history', 'orange']
        ].map(([Icon, label, count, caption, tone]) => (
          <article className="wa-stat" key={label}>
            <div className={`wa-stat-icon wa-stat-icon--${tone}`}><Icon /></div>
            <div>
              <span>{label}</span>
              <strong>{loading ? '-' : count}</strong>
              <small>{caption}</small>
            </div>
          </article>
        ))}
      </div>

      <div className="wa-workspace">
        <div className="wa-tabs" role="tablist" aria-label="WhatsApp workspace">
          {[
            ['history', 'Alert history', MessageCircle],
            ['contacts', 'WhatsApp contacts', Users],
            ['integration', 'WhatsApp Integration', BadgeCheck]
          ].map(([key, label, Icon], index) => (
            <button
              key={key}
              ref={(el) => { tabRefs.current[index] = el; }}
              id={`wa-tab-${key}`}
              role="tab"
              aria-selected={tab === key}
              aria-controls="wa-panel"
              tabIndex={tab === key ? 0 : -1}
              className={tab === key ? 'is-active' : ''}
              onClick={() => changeTab(key)}
              onKeyDown={(event) => {
                if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
                  event.preventDefault();
                  const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (index + (event.key === 'ArrowRight' ? 1 : 2)) % 3;
                  changeTab(['history', 'contacts', 'integration'][next]);
                  tabRefs.current[next]?.focus();
                }
              }}
            >
              <Icon />{label}{key !== 'integration' && <span>{key === 'contacts' ? data.contacts.length : data.logs.length}</span>}
            </button>
          ))}
        </div>

        <div role="tabpanel" id="wa-panel" aria-labelledby={`wa-tab-${tab}`}>
          {tab === 'integration' ? <WhatsAppIntegration onSaved={refresh} contacts={data.contacts} /> : tab === 'history' ? (
            loading ? <div className="wa-empty" role="status">Loading your WhatsApp workspace...</div> :
              loadError ? <Empty title="Workspace unavailable">Refresh to load contacts and message history.</Empty> :
                <ChatHistory rows={employeeRows} selectedId={selectedChatId} setSelectedId={setSelectedChatId} search={search} setSearch={setSearch} filter={filter} setFilter={setFilter} category={category} setCategory={setCategory} date={date} setDate={setDate} data={data} historyLoading={historyLoading} openEditor={openEditor} setDetail={setDetail} />
          ) : (
            <>
              <div className="wa-section-title">
                <div>
                  <h2>Your WhatsApp address book</h2>
                  <p>Save the number and alert preferences for each recipient.</p>
                </div>
              </div>
              <div className="wa-filters">
                <label className="wa-search">
                  <span>Search</span>
                  <input type="search" placeholder="Search name, number or employee ID..." value={search} onChange={(event) => setSearch(event.target.value)} />
                </label>
                <label>
                  <span>Contact status</span>
                  <select value={filter} onChange={(event) => setFilter(event.target.value)}>
                    <option value="">All contacts</option>
                    <option value="enabled">Alerts enabled</option>
                    <option value="paused">Alerts paused</option>
                  </select>
                </label>
                {(search || filter) && <button className="wa-link wa-reset" onClick={() => { setSearch(''); setFilter(''); }}>Reset filters</button>}
              </div>

              {!contactRows.length ? (
                <Empty title={search || filter ? 'No matching results' : 'Start with your first contact'} action={!search && !filter ? <button className="wa-button wa-button--primary" onClick={() => openEditor()}>+ Add your first contact</button> : null}>
                  {search || filter ? 'Try a different search or reset your filters.' : 'Choose an employee or add an external contact, then save their WhatsApp number.'}
                </Empty>
              ) : (
                <div className="wa-table-scroll">
                  <table className="wa-table">
                    <thead>
                      <tr>{['Contact', 'WhatsApp number', 'Alert categories', 'Preference', 'Actions'].map((head) => <th key={head}>{head}</th>)}</tr>
                    </thead>
                    <tbody>
                      {visibleContacts.map((row) => (
                        <tr key={row.id}>
                          <td><Person name={row.name} subtitle={[row.clientId ? `Client: ${row.clientId}` : row.employeeId || 'External contact', row.department].filter(Boolean).join(' - ')} /></td>
                          <td className="wa-number">{row.phone}</td>
                          <td><div className="wa-tags">{row.alertTypes.slice(0, 2).map((type) => <span key={type}>{CATEGORIES[type]}</span>)}{row.alertTypes.length > 2 && <span title={row.alertTypes.map((type) => CATEGORIES[type]).join(', ')}>+{row.alertTypes.length - 2} more</span>}{!row.alertTypes.length && 'None selected'}</div></td>
                          <td><Pill tone={row.enabled ? 'green' : 'muted'}>{row.enabled ? 'Alerts enabled' : 'Paused'}</Pill></td>
                          <td>
                            <div className="wa-row-actions">
                              <button
                                className={`wa-action-toggle ${row.enabled ? 'is-enabled' : 'is-paused'}`}
                                type="button"
                                disabled={saving || togglingContactId === row.id}
                                aria-label={`${row.enabled ? 'Disable' : 'Enable'} alerts for ${row.name}`}
                                onClick={() => toggleContactAlerts(row)}
                              >
                                {togglingContactId === row.id ? 'Updating...' : row.enabled ? 'Disable alerts' : 'Enable alerts'}
                              </button>
                              <button className="wa-edit-action" type="button" aria-label={`Edit ${row.name}`} onClick={() => openEditor(row)}>Edit contact</button>
                              <button
                                className="wa-test-action"
                                type="button"
                                disabled={!data.sendingEnabled || !row.enabled || saving || Boolean(togglingContactId) || Boolean(testingContactId)}
                                aria-label={`Send test WhatsApp to ${row.name}`}
                                onClick={() => sendTest(row)}
                              >
                                {testingContactId === row.id ? 'Sending...' : 'Send test'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <footer className="wa-table-footer">
                <span>{`${contactRows.length ? (currentPage - 1) * 15 + 1 : 0}-${Math.min(currentPage * 15, contactRows.length)} of ${contactRows.length} contacts`}</span>
                <div>
                  <button className="wa-button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Previous</button>
                  <span>{currentPage} / {pageCount}</span>
                  <button className="wa-button" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>Next</button>
                </div>
              </footer>
            </>
          )}
        </div>
      </div>

      {editor && (
        <AppModal title={editor.id ? 'Edit WhatsApp contact' : 'Add WhatsApp contact'} onClose={() => { if (!saveLock.current) setEditor(null); }} width="680px">
          <form className="wa-form" onSubmit={submit}>
            <p className="wa-form-intro">Choose who should receive alerts and the WhatsApp number to use.</p>
            {formError && <div className="wa-feedback wa-feedback--error" role="alert">{formError}</div>}
            <fieldset disabled={saving}>
              <label>
                <span>Link to employee or client</span>
                <select autoFocus value={editor.clientId ? `client:${editor.clientId}` : editor.employeeId ? `employee:${editor.employeeId}` : ''} onChange={(event) => selectEmployee(event.target.value)}>
                  <option value="">External contact (not linked)</option>
                  <optgroup label="Employees">
                  {data.employees.map((employee) => (
                    <option key={employee.id} value={`employee:${employee.id}`} disabled={contactByEmployee.has(employee.id) && contactByEmployee.get(employee.id).id !== editor.id}>
                      {employee.name} - {employee.id}{contactByEmployee.has(employee.id) && contactByEmployee.get(employee.id).id !== editor.id ? ' (contact saved)' : ''}
                    </option>
                  ))}
                  </optgroup>
                  <optgroup label="Clients">
                    {data.clients.map((client) => {
                      const saved = data.contacts.find((contact) => contact.clientId === client.id && contact.id !== editor.id);
                      return <option key={client.id} value={`client:${client.id}`} disabled={!!saved}>{client.name} - {client.id}{saved ? ' (contact saved)' : ''}</option>;
                    })}
                  </optgroup>
                </select>
              </label>
              <div className="wa-form-grid">
                <label><span>Contact name *</span><input required maxLength={120} value={editor.name} readOnly={!!(editor.employeeId || editor.clientId)} onChange={(event) => setEditor({ ...editor, name: event.target.value })} placeholder="Full name" /></label>
                <label><span>Department / company</span><input maxLength={120} value={editor.department} readOnly={!!(editor.employeeId || editor.clientId)} onChange={(event) => setEditor({ ...editor, department: event.target.value })} placeholder="e.g. Operations" /></label>
              </div>
              <label><span>WhatsApp number *</span><input type="tel" required maxLength={24} value={editor.phone} onChange={(event) => setEditor({ ...editor, phone: event.target.value })} placeholder="+91 98765 43210" /><small>Include country code. A 10-digit Indian number will be saved with +91.</small></label>
              <label className="wa-enable"><div><strong>Enable alert preference</strong><small>Save whether this contact should receive future automatic alerts.</small></div><input aria-label="Enable alerts for this contact" type="checkbox" checked={editor.enabled} onChange={(event) => setEditor({ ...editor, enabled: event.target.checked })} /></label>
              <div className="wa-category-label">Alert categories</div>
              <div className="wa-category-grid">{Object.entries(CATEGORIES).filter(([key]) => !editor.clientId || key === 'ticket').map(([key, label]) => <label key={key}><input type="checkbox" checked={editor.alertTypes.includes(key)} onChange={(event) => setEditor({ ...editor, alertTypes: event.target.checked ? [...editor.alertTypes, key] : editor.alertTypes.filter((type) => type !== key) })} /><span>{label}</span></label>)}</div>
              <label><span>Notes <small>(optional)</small></span><textarea rows={2} maxLength={500} value={editor.notes} onChange={(event) => setEditor({ ...editor, notes: event.target.value })} placeholder="Any contact instructions for your team" /></label>
            </fieldset>
            <div className="wa-form-footer">
              <button type="button" className="wa-button" disabled={saving} onClick={() => setEditor(null)}>Cancel</button>
              <button className="wa-button wa-button--primary" disabled={saving}>{saving ? 'Saving...' : 'Save contact'}</button>
            </div>
          </form>
        </AppModal>
      )}

      {detail && (
        <AppModal title={detail.person ? `${detail.person.name} - Alert history` : 'Message details'} onClose={() => setDetail(null)} width="720px">
          <div className="wa-detail">
            {detail.person && <div className="wa-detail-person"><Person name={detail.person.name} subtitle={detail.person.id} /><span className="wa-number">{detail.person.contact?.phone || 'WhatsApp number not configured'}</span></div>}
            {!detail.logs.length ? <Empty title="No alerts recorded">No messages match the selected date and alert type for this employee.</Empty> : detail.logs.map((log) => (
              <article className="wa-log-card" key={log.id}>
                <header><strong>{log.alertType}</strong><Pill tone={statusTone(log.status)}>{log.status}</Pill></header>
                <p className="wa-muted">{dateLabel(log.timestamp)} - {log.phone || 'Number unavailable'}{log.entityId ? ` - ${log.entityId}` : ''}</p>
                <div className="wa-message-body">{log.message || 'Message content was not stored in this record.'}</div>
                {log.attachmentUrl ? <a className="wa-attachment-link" href={log.attachmentUrl} target="_blank" rel="noreferrer">{log.attachmentName || 'Open attached PDF'}</a> : null}
                {log.error && <p className="wa-feedback wa-feedback--error">{log.error}</p>}
                <small>{log.source} - Status as recorded; delivery is not independently verified.</small>
              </article>
            ))}
          </div>
        </AppModal>
      )}
    </section>
  );
}
