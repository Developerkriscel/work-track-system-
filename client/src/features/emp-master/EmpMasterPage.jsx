import { useEffect, useMemo, useState } from 'react';
import { AlertDialog } from '@/components/modals/AlertDialog';
import { RefreshCw } from '@/components/common/icons';
import { StatusPill } from '@/components/common/StatusPill';
import { useAuth } from '@/features/auth/AuthProvider';
import { fetchAllManagersList, fetchAllUsersForAdmin } from '@/features/admin/api';
import { AdminSummaryCards } from '@/features/admin/components/AdminSummaryCards';
import { openProtectedFile, toPreviewUrl } from '@/lib/fileLinks';
import { ConfirmDialog } from '@/features/tickets/components/ConfirmDialog';
import { deleteEmpMasterRecord, fetchEmpMasterData, fetchNextEmpCode, saveEmpMasterRecord } from '@/features/emp-master/api';

const categories = [
  ['Master', 'Master Data'],
  ['EMP', 'Employees'],
  ['Freelancer', 'Freelancers'],
  ['Intern', 'Interns'],
  ['Inactive', 'Inactive Users'],
  ['Documents', 'Documents']
];

const statuses = ['Active', 'Pending', 'Inactive', 'Resigned', 'Terminated'];
const roleOptions = ['User', 'Manager', 'Admin', 'HR', 'Super Admin'];

const emptyForm = () => ({
  Category: 'EMP',
  'EMP Code': '',
  'User ID': '',
  Role: 'User',
  'Manager ID': '',
  'Task Approver': '',
  Status: 'Active',
  Password: '',
  'Company Code': 'KRIS',
  'Company Name': 'Kriscel Tech Pvt. Ltd.',
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
  Name: '',
  'Phone No': '',
  'Official mail id if any': '',
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
  'AADHAAR CARD LINK': '',
  'PAN CARD LINK': '',
  'BANK PROOF LINK': '',
  'EDUCATION CERTIFICATE LINK': '',
  'Documents of Employee': ''
});

const safe = (value = '') => String(value ?? '').trim();

function first(row = {}, keys = [], fallback = '') {
  for (const key of keys) {
    const value = row?.[key];
    if (safe(value)) return value;
  }
  return fallback;
}

function normalizeRole(value) {
  return safe(value).toLowerCase();
}

function asYmd(value) {
  const raw = safe(value);
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const dmy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}

function statusTone(status) {
  const value = normalizeRole(status);
  if (value === 'active') return 'success';
  if (value === 'pending') return 'warning';
  return 'danger';
}

function canEditEmpMasterRow(actorRole, row) {
  const role = normalizeRole(actorRole);
  if (role === 'admin' || role === 'super admin') return true;
  const targetRole = normalizeRole(first(row, ['Role', 'Designation']));
  if (role === 'hr' && (targetRole === 'admin' || targetRole === 'super admin')) return false;
  return true;
}

function toManagerValue(value = '', options = []) {
  const raw = safe(value);
  if (!raw) return '';
  const exact = options.find((option) => option.id === raw);
  if (exact) return exact.id;
  const matched = options.find((option) => `${option.name} (${option.id})` === raw);
  return matched?.id || raw;
}

function toForm(row, category, managerOptions = []) {
  const next = { ...emptyForm(), ...row, Category: row?.Category || category };
  next['EMP Code'] = first(row, ['EMP Code', 'Employee ID', 'User ID']);
  next['User ID'] = first(row, ['User ID', 'Employee ID'], next['EMP Code']);
  next.Name = first(row, ['Name', 'Employee Name']);
  next.Designation = first(row, ['Designation'], first(row, ['Role']));
  next.Role = first(row, ['Role', 'Designation'], 'User');
  next['Manager ID'] = toManagerValue(first(row, ['Manager ID', 'Manager', 'Reporting to']), managerOptions);
  next['Task Approver'] = toManagerValue(first(row, ['Task Approver', 'Approver']), managerOptions);
  next['Date of Joining'] = asYmd(first(row, ['Date of Joining', 'Joining Date']));
  next.DOE = asYmd(row?.DOE);
  next['Date of Birth'] = asYmd(row?.['Date of Birth']);
  next['Anniversary Date'] = asYmd(row?.['Anniversary Date']);
  next['Phone No'] = first(row, ['Phone No', 'Mobile Number', 'Mobile']);
  next['Official mail id if any'] = first(row, ['Official mail id if any', 'Email']);
  next['Personal Email ID'] = first(row, ['Personal Email ID'], row?.['Personal Email ID'] || '');
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

function Field({
  label,
  name,
  form,
  onChange,
  type = 'text',
  options,
  full = false,
  required = false,
  disabled = false,
  placeholder = ''
}) {
  const common = {
    value: form[name] || '',
    onChange: (event) => onChange({ [name]: event.target.value }),
    required,
    disabled
  };

  return (
    <label className={`dashboard-control${full ? ' emp-editor__full' : ''}`}>
      <span>{label}{required ? ' *' : ''}</span>
      {options ? (
        <select {...common}>
          {options.map((option) => {
            const value = typeof option === 'string' ? option : option.value;
            const optionLabel = typeof option === 'string' ? option : option.label;
            return (
              <option key={value} value={value}>
                {optionLabel}
              </option>
            );
          })}
        </select>
      ) : type === 'textarea' ? (
        <textarea rows="3" placeholder={placeholder} {...common} />
      ) : (
        <input type={type} placeholder={placeholder} {...common} />
      )}
    </label>
  );
}

function DocumentLinks({ form }) {
  const [alertMsg, setAlertMsg] = useState(null);
  const links = extractDocumentItems(form);

  if (!links.length) return null;

  return (
    <div className="emp-document-links">
      {links.map((doc, index) => (
        <a
          key={`${doc.url}-${index}`}
          href={toPreviewUrl(doc.url)}
          target="_blank"
          rel="noreferrer"
          onClick={async (event) => {
            event.preventDefault();
            try {
              await openProtectedFile(doc.url);
            } catch (error) {
              setAlertMsg(error.message || 'Document could not be opened.');
            }
          }}
        >
          {doc.label} {links.length > 6 ? index + 1 : ''}
        </a>
      ))}
      <AlertDialog message={alertMsg} onClose={() => setAlertMsg(null)} />
    </div>
  );
}

function extractDocumentItems(row = {}) {
  const items = [];
  const pushItem = (label, url) => {
    const value = safe(url);
    if (!value) return;
    items.push({ label, url: value });
  };

  pushItem('Offer Letter', row['OFFER LETTER LINK']);
  pushItem('Appointment Letter', row['APPOINTMENT LETTER LINK']);
  pushItem('Aadhaar Card', row['AADHAAR CARD LINK']);
  pushItem('PAN Card', row['PAN CARD LINK']);
  pushItem('Bank Proof', row['BANK PROOF LINK']);
  pushItem('Education Cert.', row['EDUCATION CERTIFICATE LINK']);

  safe(row['Documents of Employee'])
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean)
    .forEach((url, index) => pushItem(`Document ${index + 1}`, url));

  return items;
}

function getRowIdentity(row = {}) {
  return safe(first(row, ['EMP Code', 'Employee ID', 'User ID']));
}

function scoreDocumentRow(row = {}) {
  return extractDocumentItems(row).length;
}

function dedupeRowsByIdentity(rows = []) {
  const map = new Map();

  rows.forEach((row) => {
    const identity = getRowIdentity(row);
    if (!identity) return;

    const key = identity.toLowerCase();
    const existing = map.get(key);
    if (!existing) {
      map.set(key, row);
      return;
    }

    const existingScore = scoreDocumentRow(existing);
    const nextScore = scoreDocumentRow(row);
    if (nextScore > existingScore) {
      map.set(key, row);
    }
  });

  return [...map.values()];
}

function mergeRowsWithUsers(rows = [], users = []) {
  const userMap = new Map();
  users.forEach((user) => {
    const keys = [first(user, ['Employee ID']), first(user, ['User ID'])].filter(Boolean);
    keys.forEach((key) => userMap.set(safe(key).toLowerCase(), user));
  });

  return rows.map((row) => {
    const lookupKey = safe(first(row, ['User ID', 'EMP Code', 'Employee ID'])).toLowerCase();
    const linkedUser = userMap.get(lookupKey) || userMap.get(safe(first(row, ['Employee ID'])).toLowerCase());
    return {
      ...linkedUser,
      ...row,
      Role: first(row, ['Role', 'Designation'], first(linkedUser, ['Role'], '-')),
      Department: row.Department || first(linkedUser, ['Department'], '-'),
      Status: row.Status || first(linkedUser, ['Status'], 'Active'),
      'Manager ID': first(row, ['Manager ID', 'Manager'], first(linkedUser, ['Manager ID', 'Manager'], '')),
      'Task Approver': first(row, ['Task Approver', 'Approver'], first(linkedUser, ['Task Approver'], '')),
      'Phone No': first(row, ['Phone No', 'Mobile Number'], first(linkedUser, ['Mobile Number'], '')),
      Email: first(row, ['Official mail id if any', 'Email'], first(linkedUser, ['Email'], ''))
    };
  });
}

function buildSummary(users = []) {
  const active = users.filter((entry) => normalizeRole(entry.Status) === 'active').length;
  const managers = users.filter((entry) => /manager|admin|hr|super admin/i.test(safe(entry.Role))).length;
  const departments = new Set(users.map((entry) => safe(entry.Department)).filter(Boolean)).size;
  return {
    totalUsers: users.length,
    activeUsers: active,
    managers,
    departments
  };
}

function EmpEditor({ mode, category, initialRow, managerOptions, onClose, onSaved }) {
  const [form, setForm] = useState(() => (initialRow ? toForm(initialRow, category, managerOptions) : { ...emptyForm(), Category: category }));
  const [files, setFiles] = useState({ offer: null, appointment: null, aadhaar: null, pan: null, bank: null, education: null, bunch: [] });
  const [loadingCode, setLoadingCode] = useState(!initialRow);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const readOnly = mode === 'view';

  useEffect(() => {
    setForm(initialRow ? toForm(initialRow, category, managerOptions) : { ...emptyForm(), Category: category });
  }, [initialRow, category, managerOptions]);

  useEffect(() => {
    let alive = true;
    if (initialRow) {
      setLoadingCode(false);
      return undefined;
    }

    fetchNextEmpCode(category)
      .then((payload) => {
        if (!alive) return;
        const code = payload.code || payload.nextCode || '';
        setForm((current) => ({ ...current, 'EMP Code': code, 'User ID': code }));
      })
      .catch((reason) => alive && setError(reason.message || 'Could not generate EMP Code.'))
      .finally(() => alive && setLoadingCode(false));

    return () => {
      alive = false;
    };
  }, [category, initialRow]);

  function update(patch) {
    setForm((current) => ({ ...current, ...patch }));
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const filePayloads = {
        offer: files.offer ? await fileToPayload(files.offer, form['EMP Code']) : null,
        appointment: files.appointment ? await fileToPayload(files.appointment, form['EMP Code']) : null,
        aadhaar: files.aadhaar ? await fileToPayload(files.aadhaar, form['EMP Code']) : null,
        pan: files.pan ? await fileToPayload(files.pan, form['EMP Code']) : null,
        bank: files.bank ? await fileToPayload(files.bank, form['EMP Code']) : null,
        education: files.education ? await fileToPayload(files.education, form['EMP Code']) : null,
        bunch: await Promise.all(files.bunch.map((file) => fileToPayload(file, form['EMP Code'])))
      };
      const result = await saveEmpMasterRecord(category, form, filePayloads);
      if (!result.success) {
        throw new Error(result.message || 'Employee record could not be saved.');
      }
      onSaved(result.message || 'Employee saved successfully.');
    } catch (reason) {
      setError(reason.message || 'Employee record could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  const managerSelectOptions = [
    { value: '', label: 'None' },
    ...managerOptions.map((manager) => ({
      value: manager.id,
      label: `${manager.name} (${manager.id})`
    }))
  ];

  const approverSelectOptions = [
    { value: '', label: 'Same as Manager' },
    ...managerOptions.map((manager) => ({
      value: manager.id,
      label: `${manager.name} (${manager.id})`
    }))
  ];

  return (
    <div className="app-modal-backdrop" role="presentation">
      <section className="app-modal emp-editor-modal" role="dialog" aria-modal="true" aria-label="Employee master editor">
        <div className="app-modal__header">
          <div>
            <p className="page-card__eyebrow">EMP Master</p>
            <h2>
              {readOnly
                ? 'People Details'
                : mode === 'edit'
                  ? `Edit ${category === 'EMP' ? 'Employee' : category}`
                  : `Add ${category === 'EMP' ? 'Employee' : category}`}
            </h2>
          </div>
          <button type="button" className="icon-action" onClick={onClose} aria-label="Close">×</button>
        </div>

        <form className="emp-editor" onSubmit={submit}>
          <section className="emp-editor__section emp-editor__section--official">
            <h3>Access & Workflow</h3>
            <div className="emp-editor__grid">
              <Field label="Category" name="Category" form={form} onChange={update} options={categories.map(([value, label]) => ({ value, label }))} disabled={readOnly || Boolean(initialRow)} />
              <Field label="EMP Code" name="EMP Code" form={form} onChange={update} required disabled={readOnly || !initialRow} />
              <Field label="User ID" name="User ID" form={form} onChange={update} required disabled={readOnly || !initialRow} />
              <Field label="Role" name="Role" form={form} onChange={update} options={roleOptions} disabled={readOnly} />
              <Field label="Reporting Manager" name="Manager ID" form={form} onChange={update} options={managerSelectOptions} disabled={readOnly} />
              <Field label="Task Approver" name="Task Approver" form={form} onChange={update} options={approverSelectOptions} disabled={readOnly} />
              <Field label="Status" name="Status" form={form} onChange={update} options={statuses} disabled={readOnly} />
              <Field label="Portal Password" name="Password" form={form} onChange={update} type="password" required={!initialRow} disabled={readOnly} />
            </div>
          </section>

          <section className="emp-editor__section emp-editor__section--official">
            <h3>Official Details</h3>
            <div className="emp-editor__grid">
              <Field label="Company Code" name="Company Code" form={form} onChange={update} disabled={readOnly} />
              <Field label="Company Name" name="Company Name" form={form} onChange={update} disabled={readOnly} />
              <Field label="Date of Joining" name="Date of Joining" form={form} onChange={update} type="date" disabled={readOnly} />
              <Field label="Department" name="Department" form={form} onChange={update} disabled={readOnly} />
              <Field label="Designation" name="Designation" form={form} onChange={update} disabled={readOnly} />
              <Field label="Job Type" name="Job Type" form={form} onChange={update} disabled={readOnly} />
              <Field label="Working Hours" name="Working Hours" form={form} onChange={update} disabled={readOnly} />
              <Field label="In Timing" name="In Timing" form={form} onChange={update} type="time" disabled={readOnly} />
              <Field label="Week Off" name="Week Off" form={form} onChange={update} disabled={readOnly} />
              <Field label="Probation Period" name="PROBATION PERIOD" form={form} onChange={update} disabled={readOnly} />
              <Field label="DOE (Exit Date)" name="DOE" form={form} onChange={update} type="date" disabled={readOnly} />
              <Field label="Official Email" name="Official mail id if any" form={form} onChange={update} type="email" disabled={readOnly} />
            </div>
          </section>

          <section className="emp-editor__section emp-editor__section--personal">
            <h3>Personal & Family</h3>
            <div className="emp-editor__grid">
              <Field label="Full Name" name="Name" form={form} onChange={update} required full disabled={readOnly} />
              <Field label="Mobile Number" name="Phone No" form={form} onChange={update} disabled={readOnly} />
              <Field label="Personal Email" name="Personal Email ID" form={form} onChange={update} type="email" disabled={readOnly} />
              <Field label="Gender" name="Gender" form={form} onChange={update} options={['Male', 'Female', 'Other']} disabled={readOnly} />
              <Field label="Marital Status" name="Marital Status" form={form} onChange={update} options={['Single', 'Married']} disabled={readOnly} />
              <Field label="Date of Birth" name="Date of Birth" form={form} onChange={update} type="date" disabled={readOnly} />
              <Field label="Blood Group" name="Blood Group" form={form} onChange={update} disabled={readOnly} />
              <Field label="Father Name" name="Father Name" form={form} onChange={update} disabled={readOnly} />
              <Field label="Mother Name" name="Mother Name" form={form} onChange={update} disabled={readOnly} />
              <Field label="Spouse Name" name="Spouse Name" form={form} onChange={update} disabled={readOnly} />
              <Field label="Kids" name="Kids" form={form} onChange={update} disabled={readOnly} />
              <Field label="Anniversary Date" name="Anniversary Date" form={form} onChange={update} type="date" disabled={readOnly} />
            </div>
          </section>

          <section className="emp-editor__section emp-editor__section--address">
            <h3>Address & Emergency</h3>
            <div className="emp-editor__grid">
              <Field label="Current Address" name="Current Address" form={form} onChange={update} type="textarea" full disabled={readOnly} />
              <Field label="Permanent Address" name="Permanent Address" form={form} onChange={update} type="textarea" full disabled={readOnly} />
              <Field label="Emergency Contact No." name="Emergency contact No." form={form} onChange={update} disabled={readOnly} />
              <Field label="Emergency Person Name" name="Emergency Person Name" form={form} onChange={update} disabled={readOnly} />
            </div>
          </section>

          <section className="emp-editor__section emp-editor__section--financial">
            <h3>Financial & Legal</h3>
            <div className="emp-editor__grid">
              <Field label="Bank Name" name="Bank Name" form={form} onChange={update} disabled={readOnly} />
              <Field label="Bank Account No" name="Bank Account No" form={form} onChange={update} disabled={readOnly} />
              <Field label="Bank IFSC Code" name="Bank IFSC Code" form={form} onChange={update} disabled={readOnly} />
              <Field label="Salary (Take Home)" name="Salary (Take Home)" form={form} onChange={update} disabled={readOnly} />
              <Field label="Pan Card No" name="Pan Card No" form={form} onChange={update} disabled={readOnly} />
              <Field label="Aadhar No" name="Aadhar No" form={form} onChange={update} disabled={readOnly} />
              <Field label="PF No" name="PF" form={form} onChange={update} disabled={readOnly} />
              <Field label="ESIC No" name="ESIC" form={form} onChange={update} disabled={readOnly} />
              <Field label="CTC" name="CTC" form={form} onChange={update} disabled={readOnly} />
            </div>
          </section>

          <section className="emp-editor__section">
            <h3>Documents Upload</h3>
            <div className="emp-editor__grid">
              <label className="dashboard-control emp-editor__half">
                <span>Offer Letter</span>
                <input type="file" disabled={readOnly} accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => setFiles((current) => ({ ...current, offer: event.target.files?.[0] || null }))} />
              </label>
              <label className="dashboard-control emp-editor__half">
                <span>Appointment Letter</span>
                <input type="file" disabled={readOnly} accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => setFiles((current) => ({ ...current, appointment: event.target.files?.[0] || null }))} />
              </label>
              <label className="dashboard-control emp-editor__half">
                <span>Aadhaar Card</span>
                <input type="file" disabled={readOnly} accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => setFiles((current) => ({ ...current, aadhaar: event.target.files?.[0] || null }))} />
              </label>
              <label className="dashboard-control emp-editor__half">
                <span>PAN Card</span>
                <input type="file" disabled={readOnly} accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => setFiles((current) => ({ ...current, pan: event.target.files?.[0] || null }))} />
              </label>
              <label className="dashboard-control emp-editor__half">
                <span>Bank Proof</span>
                <input type="file" disabled={readOnly} accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => setFiles((current) => ({ ...current, bank: event.target.files?.[0] || null }))} />
              </label>
              <label className="dashboard-control emp-editor__half">
                <span>Education Certificate</span>
                <input type="file" disabled={readOnly} accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => setFiles((current) => ({ ...current, education: event.target.files?.[0] || null }))} />
              </label>
              <label className="dashboard-control emp-editor__full">
                <span>Other Employee Documents</span>
                <input type="file" disabled={readOnly} multiple accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => setFiles((current) => ({ ...current, bunch: Array.from(event.target.files || []) }))} />
              </label>
              <DocumentLinks form={form} />
            </div>
          </section>

          {error ? <p className="emp-editor__error">{error}</p> : null}

          <div className="ticket-form-actions">
            <button type="button" className="attendance-cta attendance-cta--gray" onClick={onClose}>
              {readOnly ? 'Close' : 'Cancel'}
            </button>
            {!readOnly ? (
              <button type="submit" className="attendance-cta attendance-cta--blue" disabled={saving || loadingCode}>
                {saving ? 'Saving...' : 'Save Data'}
              </button>
            ) : null}
          </div>
        </form>
      </section>
    </div>
  );
}

export function EmpMasterPage() {
  const { user } = useAuth();
  const [category, setCategory] = useState('Master');
  const [rows, setRows] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [managerOptions, setManagerOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [editor, setEditor] = useState(null);
  const [deletingId, setDeletingId] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);
  const [alertMsg, setAlertMsg] = useState(null);
  const currentRole = useMemo(() => normalizeRole(user?.Role || user?.role), [user]);

  async function load(nextCategory = category) {
    setLoading(true);
    setError('');
    try {
      const requestedCategories =
        nextCategory === 'Documents'
          ? categories.map(([value]) => value).filter((value) => value !== 'Documents')
          : [nextCategory];
      const categoryPayloads = await Promise.all(requestedCategories.map((value) => fetchEmpMasterData(value)));
      const [usersPayload, managersPayload] = await Promise.all([
        fetchAllUsersForAdmin(user?.['Employee ID'] || user?.employeeId || ''),
        fetchAllManagersList()
      ]);

      const payloadRows = categoryPayloads.flatMap((payload) => (Array.isArray(payload?.data) ? payload.data : []));
      setRows(nextCategory === 'Documents' ? dedupeRowsByIdentity(payloadRows) : payloadRows);
      setAllUsers(Array.isArray(usersPayload?.data) ? usersPayload.data : []);
      setManagerOptions(Array.isArray(managersPayload) ? managersPayload : []);
    } catch (reason) {
      setRows([]);
      setAllUsers([]);
      setManagerOptions([]);
      setError(reason.message || 'People master data could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(category);
  }, [category]);

  const mergedRows = useMemo(() => mergeRowsWithUsers(rows, allUsers), [rows, allUsers]);
  const visibleRows = useMemo(
    () => mergedRows.filter((row) => JSON.stringify(row).toLowerCase().includes(search.trim().toLowerCase())),
    [mergedRows, search]
  );
  const activeCategoryLabel = categories.find(([value]) => value === category)?.[1] || 'Master Data';
  const summary = useMemo(() => buildSummary(mergedRows), [mergedRows]);
  const visibleDocumentRows = useMemo(
    () => visibleRows.filter((row) => extractDocumentItems(row).length > 0),
    [visibleRows]
  );
  const visibleCount = category === 'Documents' ? visibleDocumentRows.length : visibleRows.length;

  function changeCategory(nextCategory) {
    setCategory(nextCategory);
    setSearch('');
    setMessage('');
  }

  function add(targetCategory) {
    setEditor({ mode: 'add', category: targetCategory, row: null });
  }

  function openView(row) {
    setEditor({ mode: 'view', category: row?.Category || category, row });
  }

  function openEdit(row) {
    setConfirmAction({ type: 'edit', row });
  }

  function requestDelete(row) {
    setConfirmAction({ type: 'delete', row });
  }

  async function removeRow(row) {
    const id = first(row, ['EMP Code', 'Employee ID', 'User ID'], '');
    const name = first(row, ['Name', 'Employee Name'], id || 'this employee');
    setDeletingId(id);
    setMessage('');
    setError('');
    try {
      const result = await deleteEmpMasterRecord(id);
      if (!result?.success) throw new Error(result?.message || 'Employee record could not be deleted.');
      setMessage(result.message || `${name} (${id}) deleted successfully.`);
      load(category);
    } catch (reason) {
      setError(reason.message || 'Employee record could not be deleted.');
    } finally {
      setDeletingId('');
    }
  }

  async function confirmPendingAction() {
    if (!confirmAction) return;
    const { type, row } = confirmAction;
    if (type === 'edit') {
      setConfirmAction(null);
      setEditor({ mode: 'edit', category: row?.Category || category, row });
      return;
    }
    if (type === 'delete') {
      setConfirmAction(null);
      await removeRow(row);
    }
  }

  function saved(text) {
    setEditor(null);
    setMessage(text);
    load(category);
  }

  return (
    <section className="page-card emp-master-page">
      <header className="page-card__header emp-master-page__header">
        <div>
          <p className="page-card__eyebrow">People Operations</p>
          <h1 className="page-card__title">Employee Master Data</h1>
        </div>
        <div className="emp-master-page__actions">
          <button type="button" className="icon-button" title="Refresh" onClick={() => load(category)}>
            <RefreshCw className="icon-button__icon" />
          </button>
          <button type="button" className="attendance-cta attendance-cta--purple" onClick={() => add('EMP')}>
            Add Employee
          </button>
        </div>
      </header>

      {message ? (
        <div 
          style={{ position: 'fixed', inset: 0, zIndex: 999998 }} 
          onClick={() => setMessage('')}
        >
          <div className="dashboard-banner" onClick={(e) => e.stopPropagation()}>
            <StatusPill tone="success">Saved</StatusPill>
            <span>{message}</span>
            <button type="button" className="dashboard-banner__close" onClick={() => setMessage('')}>OK</button>
          </div>
        </div>
      ) : null}
      {error ? <div className="dashboard-banner dashboard-banner--error"><span>{error}</span><button type="button" className="dashboard-banner__close" onClick={clearError}>OK</button></div> : null}

      <AdminSummaryCards summary={summary} />

      <article className="migration-panel migration-panel--full">
        <div className="migration-panel__row">
          <h2>{activeCategoryLabel}</h2>
          <StatusPill tone="info">{`${visibleCount} records`}</StatusPill>
        </div>

        <div className="migration-panel__row">
          <div className="approval-tabs emp-master-view-tabs" role="tablist" aria-label="EMP master categories">
            {categories.map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`approval-tab-btn${category === value ? ' approval-tab-btn--active' : ''}${value === 'Inactive' ? ' emp-master-tabs__inactive' : ''}`}
                onClick={() => changeCategory(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <label className="dashboard-control emp-master-search">
          <span>Search</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search employee, ID, role, department, manager, status..."
          />
        </label>

        {category === 'Documents' ? (
          <div className="dashboard-table-wrap">
            <table className="dashboard-table emp-master-table emp-master-table--documents">
              <thead>
                <tr>
                  <th>Employee ID</th>
                  <th>Employee Name</th>
                  <th>Documents</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="3" className="dashboard-table__empty">Loading document links...</td>
                  </tr>
                ) : visibleDocumentRows.length ? (
                  visibleDocumentRows.map((row) => {
                    const id = first(row, ['EMP Code', 'Employee ID', 'User ID'], '-');
                    const name = first(row, ['Name', 'Employee Name'], '-');
                    const docs = extractDocumentItems(row);
                    return (
                      <tr key={`doc-${id}`}>
                        <td><span className="ticket-id-chip">{id}</span></td>
                        <td>
                          <div>{name}</div>
                          <small className="emp-source-badge">{row.Category || 'EMP Master'}</small>
                        </td>
                        <td>
                          <div className="emp-master-documents">
                            {docs.map((doc) => (
                              <button
                                key={`${id}-${doc.label}-${doc.url}`}
                                type="button"
                                className="emp-master-document-link"
                                onClick={async () => {
                                  try {
                                    await openProtectedFile(doc.url);
                                  } catch (fileError) {
                                    setAlertMsg(fileError.message || 'Document could not be opened.');
                                  }
                                }}
                              >
                                {doc.label}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="3" className="dashboard-table__empty">No uploaded documents found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="dashboard-table-wrap">
            <table className="dashboard-table emp-master-table">
              <thead>
                <tr>
                  <th>Employee ID</th>
                  <th>Employee Name</th>
                  <th>Role</th>
                  <th>Manager ID</th>
                  <th>Task Approver</th>
                  <th>Department</th>
                  <th>Status</th>
                  <th>Mobile Number</th>
                  <th>Joining Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="10" className="dashboard-table__empty">Loading people records...</td>
                  </tr>
                ) : visibleRows.length ? (
                  visibleRows.map((row) => {
                    const id = first(row, ['EMP Code', 'Employee ID', 'User ID'], '-');
                    const rowCategory = row.Category || category;
                    const editable = canEditEmpMasterRow(currentRole, row);
                    return (
                      <tr key={`${rowCategory}-${id}`}>
                        <td><span className="ticket-id-chip">{id}</span></td>
                        <td>
                          <div>{first(row, ['Name', 'Employee Name'], '-')}</div>
                          {category === 'Inactive' && row._sourceSheet ? (
                            <small className="emp-source-badge">{row._sourceSheet === 'EMP' ? 'Employee' : row._sourceSheet}</small>
                          ) : null}
                        </td>
                        <td>{first(row, ['Role', 'Designation'], '-')}</td>
                        <td>{first(row, ['Manager ID', 'Manager'], '-')}</td>
                        <td>{first(row, ['Task Approver', 'Approver'], '-')}</td>
                        <td>{row.Department || '-'}</td>
                        <td><StatusPill tone={statusTone(row.Status)}>{row.Status || 'Active'}</StatusPill></td>
                        <td>{first(row, ['Phone No', 'Mobile Number'], '-')}</td>
                        <td>{first(row, ['Date of Joining', 'Joining Date'], '-')}</td>
                        <td>
                          <div className="emp-master-actions">
                            <button type="button" className="attendance-cta attendance-cta--gray" onClick={() => openView(row)}>
                              View
                            </button>
                            {editable ? (
                              <>
                                <button type="button" className="attendance-cta attendance-cta--blue" onClick={() => openEdit(row)}>
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="attendance-cta attendance-cta--red"
                                  disabled={deletingId === id}
                                  onClick={() => requestDelete(row)}
                                >
                                  {deletingId === id ? 'Deleting...' : 'Delete'}
                                </button>
                              </>
                            ) : (
                              <span className="attendance-cta attendance-cta--gray cursor-not-allowed">View Only</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="10" className="dashboard-table__empty">No people records found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </article>

      {editor ? (
        <EmpEditor
          mode={editor.mode}
          category={editor.category}
          initialRow={editor.row}
          managerOptions={managerOptions}
          onClose={() => setEditor(null)}
          onSaved={saved}
        />
      ) : null}

      {confirmAction ? (
        <ConfirmDialog
          title={confirmAction.type === 'delete' ? 'Confirm delete' : 'Open edit form?'}
          message={
            confirmAction.type === 'delete'
              ? `Delete ${first(confirmAction.row, ['Name', 'Employee Name'], 'this employee')} (${first(confirmAction.row, ['EMP Code', 'Employee ID', 'User ID'], '')})? This action cannot be undone.`
              : `Open edit form for ${first(confirmAction.row, ['Name', 'Employee Name'], 'this employee')}?`
          }
          confirmLabel={confirmAction.type === 'delete' ? 'Delete' : 'Open Edit'}
          tone={confirmAction.type === 'delete' ? 'danger' : 'warning'}
          onCancel={() => setConfirmAction(null)}
          onConfirm={confirmPendingAction}
        />
      ) : null}

      <AlertDialog message={alertMsg} onClose={() => setAlertMsg(null)} />
    </section>
  );
}
