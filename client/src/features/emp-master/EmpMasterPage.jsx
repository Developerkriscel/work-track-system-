import { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from '@/components/common/icons';
import { StatusPill } from '@/components/common/StatusPill';
import { fetchEmpMasterData, fetchNextEmpCode, saveEmpMasterRecord } from '@/features/emp-master/api';

const categories = [
  ['Master', 'Master Data'],
  ['EMP', 'Employees'],
  ['Freelancer', 'Freelancers'],
  ['Intern', 'Interns'],
  ['Inactive', 'Inactive Users']
];
const statuses = ['Active', 'Pending', 'Inactive', 'Resigned', 'Terminated'];
const emptyForm = () => ({
  Category: 'EMP',
  'EMP Code': '',
  'User ID': '',
  'Company Code': 'KRIS',
  'Company Name': 'Kriscel Tech Pvt. Ltd.',
  Status: 'Active',
  'Date of Joining': '',
  Department: '',
  Designation: '',
  'Job Type': '',
  'Reporting to': '',
  'Working Hours': '',
  'In Timing': '',
  'Week Off': '',
  'PROBATION PERIOD': '',
  DOE: '',
  'Official mail id if any': '',
  Password: '',
  Name: '',
  'Phone No': '',
  'Personal Email ID': '',
  Gender: 'Male',
  'Marital Status': 'Single',
  'Date of Birth': '',
  'Blood Group': '',
  'Father Name': '',
  'Mother Name': '',
  'Spouse Name': '',
  Kids: '',
  'Anniversary Date': '',
  'Current Address': '',
  'Permanent Address': '',
  'Emergency contact No.': '',
  'Emergency Person Name': '',
  'Bank Name': '',
  'Bank Account No': '',
  'Bank IFSC Code': '',
  'Salary (Take Home)': '',
  'Pan Card No': '',
  'Aadhar No': '',
  PF: '',
  ESIC: '',
  CTC: '',
  'OFFER LETTER LINK': '',
  'APPOINTMENT LETTER LINK': '',
  'Documents of Employee': ''
});

const first = (row, keys, fallback = '') => keys.map((key) => row?.[key]).find((value) => String(value ?? '').trim()) ?? fallback;
function asYmd(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const dmy = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}
const statusTone = (status) => String(status || '').toLowerCase() === 'active' ? 'success' : String(status || '').toLowerCase() === 'pending' ? 'warning' : 'danger';

function toForm(row, category) {
  const base = emptyForm();
  const next = { ...base, ...row, Category: row?.Category || category };
  next['EMP Code'] = first(row, ['EMP Code', 'Employee ID', 'User ID']);
  next['User ID'] = first(row, ['User ID', 'Employee ID'], next['EMP Code']);
  next.Name = first(row, ['Name', 'Employee Name']);
  next.Designation = first(row, ['Designation', 'Role']);
  next['Date of Joining'] = asYmd(first(row, ['Date of Joining', 'Joining Date']));
  next.DOE = asYmd(row?.DOE);
  next['Date of Birth'] = asYmd(row?.['Date of Birth']);
  next['Anniversary Date'] = asYmd(row?.['Anniversary Date']);
  next['Phone No'] = first(row, ['Phone No', 'Mobile Number', 'Mobile']);
  next['Official mail id if any'] = first(row, ['Official mail id if any', 'Email']);
  return next;
}

function fileToPayload(file, code) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      base64: String(reader.result).split(',')[1],
      mimeType: file.type,
      fileName: `EMP_${code}_${file.name}`
    });
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

function Field({ label, name, form, onChange, type = 'text', options, full = false, required = false, disabled = false }) {
  const common = { value: form[name] || '', onChange: (event) => onChange({ [name]: event.target.value }), required, disabled: disabled || form._readOnly };
  return (
    <label className={`dashboard-control${full ? ' emp-editor__full' : ''}`}>
      <span>{label}{required ? ' *' : ''}</span>
      {options ? <select {...common}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select> : type === 'textarea' ? <textarea rows="3" {...common} /> : <input type={type} {...common} />}
    </label>
  );
}

function DocumentLinks({ form }) {
  const links = [
    ['Offer letter', form['OFFER LETTER LINK']],
    ['Appointment Letter', form['APPOINTMENT LETTER LINK']],
    ...String(form['Documents of Employee'] || '').split(',').filter(Boolean).map((url) => {
      const parts = url.split('/');
      const fileName = parts[parts.length - 1];
      return [`Document (${fileName})`, url];
    })
  ];
  if (!links.length) return null;
  return <div className="emp-document-links">{links.map(([label, url]) => <a key={`${label}-${url}`} href={url} target="_blank" rel="noreferrer">{label}</a>)}</div>;
}

function FileInfo({ file }) {
  if (!file) return null;
  const sizeKB = (file.size / 1024).toFixed(1);
  return <span className="file-info">{file.name} ({file.type || 'unknown'}, {sizeKB} KB)</span>;
}

function EmpEditor({ mode, category, initialRow, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({
    ...(initialRow ? toForm(initialRow, category) : ({ ...emptyForm(), Category: category })),
    _readOnly: mode === 'view'
  }));
  const [files, setFiles] = useState({ offer: null, appointment: null, bunch: [] });
  const [loadingCode, setLoadingCode] = useState(!initialRow);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const readOnly = mode === 'view';

  useEffect(() => {
    let alive = true;
    if (initialRow) return undefined;
    fetchNextEmpCode(category).then((payload) => {
      if (!alive) return;
      const code = payload.code || payload.nextCode || '';
      setForm((current) => ({ ...current, 'EMP Code': code, 'User ID': code }));
    }).catch((reason) => alive && setError(reason.message || 'Could not generate EMP Code.')).finally(() => alive && setLoadingCode(false));
    return () => { alive = false; };
  }, [category, initialRow]);

  function update(patch) { setForm((current) => ({ ...current, ...patch })); }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const filePayloads = {
        offer: files.offer ? await fileToPayload(files.offer, form['EMP Code']) : null,
        appointment: files.appointment ? await fileToPayload(files.appointment, form['EMP Code']) : null,
        bunch: await Promise.all(files.bunch.map((file) => fileToPayload(file, form['EMP Code'])))
      };
      const { _readOnly, ...cleanForm } = form;
      const payload = cleanForm;
      const result = await saveEmpMasterRecord(category, payload, filePayloads);
      onSaved(result.message || 'Employee saved successfully.');
    } catch (reason) {
      setError(reason.message || 'Employee record could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="app-modal-backdrop" role="presentation">
      <section className="app-modal emp-editor-modal" role="dialog" aria-modal="true" aria-label="Employee master editor">
        <div className="app-modal__header"><div><p className="page-card__eyebrow">EMP Master</p><h2>{readOnly ? 'Employee Details' : mode === 'edit' ? `Edit ${category === 'EMP' ? 'Employee' : category}` : `Add ${category === 'EMP' ? 'Employee' : category}`}</h2></div><button type="button" className="icon-action" onClick={onClose} aria-label="Close">×</button></div>
        <form className="emp-editor" onSubmit={submit}>
          <section className="emp-editor__section emp-editor__section--official"><h3>Official Details</h3><div className="emp-editor__grid">
            <Field label="EMP Code" name="EMP Code" form={form} onChange={update} required disabled={readOnly} />
            <Field label="User ID" name="User ID" form={form} onChange={update} required disabled={readOnly} />
            <Field label="Company Code" name="Company Code" form={form} onChange={update} />
            <Field label="Company Name" name="Company Name" form={form} onChange={update} />
            <Field label="Status" name="Status" form={form} onChange={update} options={statuses} />
            <Field label="Date of Joining" name="Date of Joining" form={form} onChange={update} type="date" />
            <Field label="Department" name="Department" form={form} onChange={update} />
            <Field label="Designation" name="Designation" form={form} onChange={update} />
            <Field label="Job Type" name="Job Type" form={form} onChange={update} />
            <Field label="Reporting To" name="Reporting to" form={form} onChange={update} />
            <Field label="Working Hours" name="Working Hours" form={form} onChange={update} />
            <Field label="In Timing" name="In Timing" form={form} onChange={update} type="time" />
            <Field label="Week Off" name="Week Off" form={form} onChange={update} />
            <Field label="Probation Period" name="PROBATION PERIOD" form={form} onChange={update} />
            <Field label="DOE (Exit Date)" name="DOE" form={form} onChange={update} type="date" />
            <Field label="Official Email" name="Official mail id if any" form={form} onChange={update} type="email" />
            <Field label="Portal Password" name="Password" form={form} onChange={update} type="password" required={!initialRow} />
          </div></section>
          <section className="emp-editor__section emp-editor__section--personal"><h3>Personal & Family</h3><div className="emp-editor__grid">
            <Field label="Full Name" name="Name" form={form} onChange={update} required full />
            <Field label="Phone No" name="Phone No" form={form} onChange={update} />
            <Field label="Personal Email" name="Personal Email ID" form={form} onChange={update} type="email" />
            <Field label="Gender" name="Gender" form={form} onChange={update} options={['Male', 'Female', 'Other']} />
            <Field label="Marital Status" name="Marital Status" form={form} onChange={update} options={['Single', 'Married']} />
            <Field label="Date of Birth" name="Date of Birth" form={form} onChange={update} type="date" />
            <Field label="Blood Group" name="Blood Group" form={form} onChange={update} />
            <Field label="Father Name" name="Father Name" form={form} onChange={update} />
            <Field label="Mother Name" name="Mother Name" form={form} onChange={update} />
            <Field label="Spouse Name" name="Spouse Name" form={form} onChange={update} />
            <Field label="Kids" name="Kids" form={form} onChange={update} />
            <Field label="Anniversary Date" name="Anniversary Date" form={form} onChange={update} type="date" />
          </div></section>
          <section className="emp-editor__section emp-editor__section--address"><h3>Address & Emergency</h3><div className="emp-editor__grid">
            <Field label="Current Address" name="Current Address" form={form} onChange={update} type="textarea" full />
            <Field label="Permanent Address" name="Permanent Address" form={form} onChange={update} type="textarea" full />
            <Field label="Emergency Contact No." name="Emergency contact No." form={form} onChange={update} />
            <Field label="Emergency Person Name" name="Emergency Person Name" form={form} onChange={update} />
          </div></section>
          <section className="emp-editor__section emp-editor__section--financial"><h3>Financial & Legal</h3><div className="emp-editor__grid">
            <Field label="Bank Name" name="Bank Name" form={form} onChange={update} /><Field label="Bank Account No" name="Bank Account No" form={form} onChange={update} /><Field label="Bank IFSC Code" name="Bank IFSC Code" form={form} onChange={update} /><Field label="Salary (Take Home)" name="Salary (Take Home)" form={form} onChange={update} /><Field label="Pan Card No" name="Pan Card No" form={form} onChange={update} /><Field label="Aadhar No" name="Aadhar No" form={form} onChange={update} /><Field label="PF No" name="PF" form={form} onChange={update} /><Field label="ESIC No" name="ESIC" form={form} onChange={update} /><Field label="CTC" name="CTC" form={form} onChange={update} />
          </div></section>
          <section className="emp-editor__section"><h3>Documents Upload</h3><div className="emp-editor__grid">
            <label className="dashboard-control"><span>Offer Letter</span><input type="file" disabled={readOnly} accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => setFiles((current) => ({ ...current, offer: event.target.files?.[0] || null }))} /></label>
            <label className="dashboard-control"><span>Appointment Letter</span><input type="file" disabled={readOnly} accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => setFiles((current) => ({ ...current, appointment: event.target.files?.[0] || null }))} /></label>
            <label className="dashboard-control emp-editor__full"><span>Employee Documents</span><input type="file" disabled={readOnly} multiple accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => setFiles((current) => ({ ...current, bunch: Array.from(event.target.files || []) }))} /></label>
            <DocumentLinks form={form} />
          </div></section>
          {error ? <p className="emp-editor__error">{error}</p> : null}
          <div className="ticket-form-actions"><button type="button" className="attendance-cta attendance-cta--gray" onClick={onClose}>{readOnly ? 'Close' : 'Cancel'}</button>{!readOnly ? <button type="submit" className="attendance-cta attendance-cta--blue" disabled={saving || loadingCode}>{saving ? 'Saving...' : 'Save Data'}</button> : null}</div>
        </form>
      </section>
    </div>
  );
}

export function EmpMasterPage() {
  const [category, setCategory] = useState('Master');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [editor, setEditor] = useState(null);

  async function load(nextCategory = category) {
    setLoading(true); setError('');
    try {
      const payload = await fetchEmpMasterData(nextCategory);
      setRows(Array.isArray(payload.data) ? payload.data : []);
    } catch (reason) {
      setRows([]); setError(reason.message || 'EMP Master data could not be loaded.');
    } finally { setLoading(false); }
  }

  useEffect(() => { load(category); }, [category]);
  const visibleRows = useMemo(() => rows.filter((row) => JSON.stringify(row).toLowerCase().includes(search.trim().toLowerCase())), [rows, search]);
  const isMaster = category === 'Master';

  function changeCategory(nextCategory) { setCategory(nextCategory); setSearch(''); setMessage(''); }
  function add(targetCategory) { setEditor({ mode: 'add', category: targetCategory, row: null }); }
  function saved(text) { setEditor(null); setMessage(text); load(category); }

  return <section className="page-card emp-master-page">
    <header className="page-card__header emp-master-page__header"><div><p className="page-card__eyebrow">People Operations</p><h1 className="page-card__title">Employee Master Data</h1></div><div className="emp-master-page__actions"><button type="button" className="icon-button" title="Refresh" onClick={() => load(category)}><RefreshCw className="icon-button__icon" /></button><button type="button" className="attendance-cta attendance-cta--purple" onClick={() => add('EMP')}>Add Employee</button><button type="button" className="attendance-cta attendance-cta--green" onClick={() => add('Intern')}>Add Intern</button><button type="button" className="attendance-cta attendance-cta--orange" onClick={() => add('Freelancer')}>Add Freelancer</button></div></header>
    {message ? <div className="dashboard-banner"><StatusPill tone="success">Saved</StatusPill><span>{message}</span></div> : null}
    {error ? <div className="dashboard-banner dashboard-banner--error">{error}</div> : null}
    <div className="emp-master-tabs" role="tablist">{categories.map(([value, label]) => <button type="button" key={value} className={`approval-tab-btn${category === value ? ' approval-tab-btn--active' : ''}${value === 'Inactive' ? ' emp-master-tabs__inactive' : ''}`} onClick={() => changeCategory(value)}>{label}</button>)}</div>
    <article className="migration-panel migration-panel--full"><div className="migration-panel__row"><h2>{categories.find(([value]) => value === category)?.[1]}</h2><StatusPill tone="info">{visibleRows.length} records</StatusPill></div><label className="dashboard-control emp-master-search"><span>Search</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search employee, ID, department, status..." /></label><div className="dashboard-table-wrap"><table className="dashboard-table emp-master-table"><thead><tr><th>Employee ID</th><th>Employee Name</th><th>Role</th><th>Department</th><th>Status</th><th>Mobile Number</th><th>Joining Date</th><th>Action</th></tr></thead><tbody>{loading ? <tr><td colSpan="8" className="dashboard-table__empty">Loading employee records...</td></tr> : visibleRows.length ? visibleRows.map((row) => { const id = first(row, ['EMP Code', 'Employee ID', 'User ID'], '-'); return <tr key={`${row.Category}-${id}`}><td><span className="ticket-id-chip">{id}</span></td><td><div>{first(row, ['Name', 'Employee Name'], '-')}</div>{category === 'Inactive' && row._sourceSheet ? <small className="emp-source-badge">{row._sourceSheet === 'EMP' ? 'Employee' : row._sourceSheet}</small> : null}</td><td>{first(row, ['Designation', 'Role'], '-')}</td><td>{row.Department || '-'}</td><td><StatusPill tone={statusTone(row.Status)}>{row.Status || 'Active'}</StatusPill></td><td>{first(row, ['Phone No', 'Mobile Number'], '-')}</td><td>{first(row, ['Date of Joining', 'Joining Date'], '-')}</td><td><button type="button" className="attendance-cta attendance-cta--blue" onClick={() => setEditor({ mode: 'edit', category: row.Category || category, row })}>Edit</button></td></tr>; }) : <tr><td colSpan="8" className="dashboard-table__empty">No employee records found.</td></tr>}</tbody></table></div></article>
    {editor ? <EmpEditor mode={editor.mode} category={editor.category} initialRow={editor.row} onClose={() => setEditor(null)} onSaved={saved} /> : null}
  </section>;
}
