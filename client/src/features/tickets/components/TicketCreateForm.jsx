import { useEffect, useMemo, useState } from 'react';
import { todayYmd } from '@/features/tickets/services/ticketPresentation';

function clientId(client = {}) {
  return client.Client_Id || client['Client ID'] || '';
}

function clientName(client = {}) {
  return client['Client Name'] || client.Name || client.Client || clientId(client);
}

function isKriscelTechClient(client = {}) {
  const normalizedName = String(clientName(client)).replace(/[^a-z0-9]/gi, '').toLowerCase();
  const normalizedId = String(clientId(client)).replace(/[^a-z0-9]/gi, '').toLowerCase();
  return normalizedName.includes('krisceltech') || normalizedId === 'cl000';
}

function prioritizeKriscelTechClients(clients = []) {
  return [...clients].sort((left, right) => {
    const leftPreferred = isKriscelTechClient(left);
    const rightPreferred = isKriscelTechClient(right);
    if (leftPreferred === rightPreferred) return 0;
    return leftPreferred ? -1 : 1;
  });
}

const newRow = (clients, categories, employeeId) => ({
  clientId: clientId(clients[0]),
  category: categories[0] || 'General',
  priority: 'Normal',
  tat: '60',
  planDate: todayYmd(),
  description: '',
  referenceLink: '',
  attachments: [],
  employeeId
});

function fileToPayload(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      base64: String(reader.result).split(',')[1],
      mimeType: file.type,
      fileName: file.name
    });
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

export function TicketCreateForm({ clients, categories, users, role, employeeId, submitting, onSubmit, onCancel }) {
  const clientOptions = useMemo(() => prioritizeKriscelTechClients(clients), [clients]);
  const defaultClientId = clientId(clientOptions[0]);
  const [rows, setRows] = useState([newRow(clientOptions, categories, employeeId)]);
  const canAssign = ['Super Admin', 'Admin', 'Manager', 'HR'].includes(role);

  useEffect(() => {
    if (!defaultClientId) return;
    setRows((current) => current.map((row) => (row.clientId ? row : { ...row, clientId: defaultClientId })));
  }, [defaultClientId]);

  const update = (index, patch) => setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  const remove = (index) => setRows((current) => current.length === 1 ? current : current.filter((_, rowIndex) => rowIndex !== index));

  async function submit(event) {
    event.preventDefault();
    const payload = await Promise.all(rows.map(async (row) => {
      const client = clientOptions.find((item) => clientId(item) === row.clientId);
      const attachments = (await Promise.all((row.attachments || []).map(fileToPayload))).filter(Boolean);
      return {
        'Creator ID': employeeId,
        'Employee ID': canAssign ? row.employeeId : employeeId,
        Client_Id: row.clientId,
        'Client ID': row.clientId,
        'Client Name': clientName(client),
        Name: clientName(client),
        'Task Category': row.category,
        Priority: row.priority,
        TAT: Number(row.tat),
        'Plan Date': row.planDate,
        'Task Description': row.description,
        Description: row.description,
        'Reference Link': row.referenceLink.trim(),
        Link: row.referenceLink.trim(),
        Attachment: attachments
      };
    }));
    await onSubmit(payload.length === 1 ? payload[0] : payload);
  }

  return (
    <form className="ticket-form-grid" onSubmit={submit}>
      {rows.map((row, index) => (
        <fieldset style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px', alignItems: 'start' }} key={index}>
          <legend>Ticket {index + 1}</legend>
          <label className="dashboard-control"><span>Client</span><select value={row.clientId} onChange={(event) => update(index, { clientId: event.target.value })}>{clientOptions.map((client) => { const id = clientId(client); return <option key={id} value={id}>{clientName(client)}</option>; })}</select></label>
          <label className="dashboard-control"><span>Category</span><select value={row.category} onChange={(event) => update(index, { category: event.target.value })}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
          <label className="dashboard-control"><span>Priority</span><select value={row.priority} onChange={(event) => update(index, { priority: event.target.value })}><option>Normal</option><option>Low</option><option>High</option><option>Urgent</option><option>Super Urgent</option></select></label>
          <label className="dashboard-control"><span>TAT (mins)</span><input type="number" min="1" value={row.tat} onChange={(event) => update(index, { tat: event.target.value })} required /></label>
          <label className="dashboard-control"><span>Plan Date</span><input type="date" value={row.planDate} onChange={(event) => update(index, { planDate: event.target.value })} required /></label>
          {canAssign ? <label className="dashboard-control"><span>Assign To</span><select value={row.employeeId} onChange={(event) => update(index, { employeeId: event.target.value })}>{users.map((user) => { const id = user['Employee ID'] || user.id; return <option key={id} value={id}>{user['Employee Name'] || user.name} ({id})</option>; })}</select></label> : null}
          <label className="dashboard-control ticket-form-grid__full"><span>Description</span><textarea rows="3" value={row.description} onChange={(event) => update(index, { description: event.target.value })} required /></label>
          <label className="dashboard-control ticket-form-grid__full">
            <span>Reference Link (optional)</span>
            <input
              type="url"
              value={row.referenceLink}
              onChange={(event) => update(index, { referenceLink: event.target.value })}
              placeholder="https://example.com/task-reference"
            />
          </label>
          <label className="dashboard-control ticket-form-grid__full">
            <span>Attachments (optional)</span>
            <input type="file" multiple onChange={(event) => update(index, { attachments: Array.from(event.target.files || []) })} />
            {row.attachments?.length ? (
              <small className="file-info">{row.attachments.length} file(s): {row.attachments.map((file) => file.name).join(', ')}</small>
            ) : null}
          </label>
          {rows.length > 1 ? <button type="button" className="attendance-cta attendance-cta--red" onClick={() => remove(index)}>Remove Ticket</button> : null}
        </fieldset>
      ))}
      <div className="ticket-form-actions ticket-form-grid__full"><button type="button" className="attendance-cta attendance-cta--gray" onClick={() => setRows((current) => [...current, newRow(clientOptions, categories, employeeId)])}>Add Another Ticket</button><button type="submit" className="attendance-cta attendance-cta--blue" disabled={submitting}>{submitting ? 'Submitting...' : 'Submit All Tickets'}</button><button type="button" className="attendance-cta attendance-cta--red" onClick={onCancel}>Cancel</button></div>
    </form>
  );
}
