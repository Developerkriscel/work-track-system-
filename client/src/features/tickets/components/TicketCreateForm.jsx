import { useState } from 'react';
import { todayYmd } from '@/features/tickets/services/ticketPresentation';

const newRow = (clients, categories, employeeId) => ({
  clientId: clients[0]?.Client_Id || clients[0]?.['Client ID'] || '',
  category: categories[0] || 'General',
  priority: 'Normal',
  tat: '60',
  planDate: todayYmd(),
  description: '',
  employeeId
});

export function TicketCreateForm({ clients, categories, users, role, employeeId, submitting, onSubmit, onCancel }) {
  const [rows, setRows] = useState([newRow(clients, categories, employeeId)]);
  const canAssign = ['Super Admin', 'Admin', 'Manager', 'HR'].includes(role);
  const update = (index, patch) => setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  const remove = (index) => setRows((current) => current.length === 1 ? current : current.filter((_, rowIndex) => rowIndex !== index));

  async function submit(event) {
    event.preventDefault();
    const payload = rows.map((row) => {
      const client = clients.find((item) => (item.Client_Id || item['Client ID']) === row.clientId);
      return {
        'Creator ID': employeeId,
        'Employee ID': canAssign ? row.employeeId : employeeId,
        Client_Id: row.clientId,
        'Client ID': row.clientId,
        'Client Name': client?.['Client Name'] || '',
        Name: client?.['Client Name'] || '',
        'Task Category': row.category,
        Priority: row.priority,
        TAT: Number(row.tat),
        'Plan Date': row.planDate,
        'Task Description': row.description,
        Description: row.description
      };
    });
    await onSubmit(payload.length === 1 ? payload[0] : payload);
  }

  return (
    <form className="ticket-form-grid" onSubmit={submit}>
      {rows.map((row, index) => (
        <fieldset className="ticket-form-grid ticket-form-grid__full" key={index}>
          <legend>Ticket {index + 1}</legend>
          <label className="dashboard-control"><span>Client</span><select value={row.clientId} onChange={(event) => update(index, { clientId: event.target.value })}>{clients.map((client) => { const id = client.Client_Id || client['Client ID']; return <option key={id} value={id}>{client['Client Name'] || id}</option>; })}</select></label>
          <label className="dashboard-control"><span>Category</span><select value={row.category} onChange={(event) => update(index, { category: event.target.value })}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
          <label className="dashboard-control"><span>Priority</span><select value={row.priority} onChange={(event) => update(index, { priority: event.target.value })}><option>Normal</option><option>Low</option><option>High</option><option>Urgent</option><option>Super Urgent</option></select></label>
          <label className="dashboard-control"><span>TAT (mins)</span><input type="number" min="1" value={row.tat} onChange={(event) => update(index, { tat: event.target.value })} required /></label>
          <label className="dashboard-control"><span>Plan Date</span><input type="date" value={row.planDate} onChange={(event) => update(index, { planDate: event.target.value })} required /></label>
          {canAssign ? <label className="dashboard-control"><span>Assign To</span><select value={row.employeeId} onChange={(event) => update(index, { employeeId: event.target.value })}>{users.map((user) => { const id = user['Employee ID'] || user.id; return <option key={id} value={id}>{user['Employee Name'] || user.name} ({id})</option>; })}</select></label> : null}
          <label className="dashboard-control ticket-form-grid__full"><span>Description</span><textarea rows="3" value={row.description} onChange={(event) => update(index, { description: event.target.value })} required /></label>
          {rows.length > 1 ? <button type="button" className="attendance-cta attendance-cta--red" onClick={() => remove(index)}>Remove Ticket</button> : null}
        </fieldset>
      ))}
      <div className="ticket-form-actions ticket-form-grid__full"><button type="button" className="attendance-cta attendance-cta--gray" onClick={() => setRows((current) => [...current, newRow(clients, categories, employeeId)])}>Add Another Ticket</button><button type="submit" className="attendance-cta attendance-cta--blue" disabled={submitting}>{submitting ? 'Submitting...' : 'Submit All Tickets'}</button><button type="button" className="attendance-cta attendance-cta--red" onClick={onCancel}>Cancel</button></div>
    </form>
  );
}
