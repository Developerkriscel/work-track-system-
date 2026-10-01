import { useMemo, useState, useEffect } from 'react';
import { todayYmd } from '@/features/tickets/services/ticketPresentation';

function clientId(client = {}) {
  return client.Client_Id || client['Client ID'] || '';
}

function clientName(client = {}) {
  return client['Client Name'] || client.Name || client.Client || clientId(client);
}

function userName(user = {}) {
  return user['Employee Name'] || user.Name || user.name || user['EMP Code'] || '';
}

function userId(user = {}) {
  return user['EMP Code'] || user['Employee ID'] || user.id || '';
}

export function AutoTicketDialog({ ticket, clients, categories, users, saving, onSubmit, onClose }) {
  const isEditing = Boolean(ticket);
  
  const initialFrequency = isEditing ? (ticket.Frequency || ticket.Frequence || 'Daily') : 'Daily';
  const isMonthly = /^\d+$/.test(initialFrequency) || ['1st Fri', '2nd Fri', '3rd Fri', '4th Fri'].includes(initialFrequency);
  const [frequencyType, setFrequencyType] = useState(isMonthly ? 'Monthly' : 'Weekly');

  const [formData, setFormData] = useState({
    clientId: isEditing ? (ticket.Client_Id || ticket['Client ID'] || '') : (clients.length ? clientId(clients[0]) : ''),
    category: isEditing ? ticket['Task Category'] : (categories[0] || 'General'),
    description: isEditing ? (ticket['Task Description'] || '') : '',
    priority: isEditing ? ticket.Priority : 'Normal',
    planDate: isEditing ? ticket['Plan Date'] : todayYmd(),
    employeeId: isEditing ? ticket['Employee ID'] : '',
    tat: isEditing ? (ticket.TAT || '60') : '60',
    frequency: initialFrequency,
    attachment: isEditing ? (ticket.Attachment || '') : ''
  });

  const handleUpdate = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFrequencyTypeChange = (e) => {
    const newType = e.target.value;
    setFrequencyType(newType);
    handleUpdate('frequency', newType === 'Weekly' ? 'Daily' : '1');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const client = clients.find(c => clientId(c) === formData.clientId) || {};
    const user = users.find(u => userId(u) === formData.employeeId) || {};
    
    const payload = {
      Client_Id: formData.clientId,
      'Client ID': formData.clientId,
      Name: clientName(client),
      'Client Name': clientName(client),
      'Task Category': formData.category,
      'Task Description': formData.description,
      Priority: formData.priority,
      'Plan Date': formData.planDate,
      'Employee ID': formData.employeeId,
      'Help Person Name': userName(user),
      TAT: Number(formData.tat),
      Frequency: formData.frequency,
      Attachment: formData.attachment,
      'Auto Ticket': 'Yes',
      'Is Auto Ticket': 'Yes'
    };

    if (isEditing) {
      payload['Ticket ID'] = ticket['Ticket ID'];
      payload.legacyId = ticket.legacyId;
    }

    onSubmit(payload);
  };

  return (
    <form className="ticket-form-grid" onSubmit={handleSubmit}>
      <fieldset style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '16px', alignItems: 'start' }}>
        <legend>{isEditing ? 'Edit Auto Ticket Template' : 'Design New Auto Ticket Template'}</legend>
        
        <label className="dashboard-control">
          <span>Client</span>
          <select value={formData.clientId} onChange={e => handleUpdate('clientId', e.target.value)} required>
            <option value="">Select Client</option>
            {clients.map(c => <option key={clientId(c)} value={clientId(c)}>{clientName(c)}</option>)}
          </select>
        </label>
        
        <label className="dashboard-control">
          <span>Task Category</span>
          <select value={formData.category} onChange={e => handleUpdate('category', e.target.value)}>
            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </label>

        <label className="dashboard-control">
          <span>Employee (Help Person)</span>
          <select value={formData.employeeId} onChange={e => handleUpdate('employeeId', e.target.value)} required>
            <option value="">Select Employee</option>
            {users.map(u => <option key={userId(u)} value={userId(u)}>{userName(u)}</option>)}
          </select>
        </label>
        
        <label className="dashboard-control">
          <span>Frequency Type</span>
          <select value={frequencyType} onChange={handleFrequencyTypeChange} required>
            <option value="Weekly">Weekly (Includes Daily)</option>
            <option value="Monthly">Monthly</option>
          </select>
        </label>

        <label className="dashboard-control">
          <span>{frequencyType === 'Weekly' ? 'Day of Week' : 'Date / Occurence'}</span>
          <select value={formData.frequency} onChange={e => handleUpdate('frequency', e.target.value)} required>
            {frequencyType === 'Weekly' ? (
              <>
                <option value="Daily">Daily</option>
                <option value="Monday">Monday</option>
                <option value="Tuesday">Tuesday</option>
                <option value="Wednesday">Wednesday</option>
                <option value="Thursday">Thursday</option>
                <option value="Friday">Friday</option>
                <option value="Saturday">Saturday</option>
              </>
            ) : (
              <>
                {Array.from({ length: 31 }, (_, i) => String(i + 1)).map(day => (
                  <option key={day} value={day}>{day}</option>
                ))}
                <option value="1st Fri">1st Fri</option>
                <option value="2nd Fri">2nd Fri</option>
                <option value="3rd Fri">3rd Fri</option>
                <option value="4th Fri">4th Fri</option>
              </>
            )}
          </select>
        </label>

        <label className="dashboard-control">
          <span>Priority</span>
          <select value={formData.priority} onChange={e => handleUpdate('priority', e.target.value)}>
            <option>Normal</option>
            <option>Low</option>
            <option>High</option>
            <option>Urgent</option>
            <option>Super Urgent</option>
          </select>
        </label>
        
        <label className="dashboard-control">
          <span>TAT (mins)</span>
          <input type="number" min="1" value={formData.tat} onChange={e => handleUpdate('tat', e.target.value)} required />
        </label>

        <label className="dashboard-control" style={{ gridColumn: '1 / -1' }}>
          <span>Attachment (Link or File Name)</span>
          <input type="text" placeholder="e.g. Google Drive link or file name..." value={formData.attachment} onChange={e => handleUpdate('attachment', e.target.value)} />
        </label>
        
        <label className="dashboard-control" style={{ gridColumn: '1 / -1' }}>
          <span>Task Description</span>
          <textarea value={formData.description} onChange={e => handleUpdate('description', e.target.value)} rows="4" placeholder="Enter detailed task description..." required />
        </label>

      </fieldset>
      
      <div className="ticket-form-actions" style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
        <button type="button" className="attendance-cta attendance-cta--red" style={{ padding: '6px 16px', minHeight: '36px', fontSize: '14px', width: 'auto', flex: '0 0 auto' }} onClick={onClose} disabled={saving}>Cancel</button>
        <button type="submit" className="attendance-cta attendance-cta--blue" style={{ padding: '6px 16px', minHeight: '36px', fontSize: '14px', width: 'auto', flex: '0 0 auto' }} disabled={saving}>{saving ? 'Saving...' : 'Save Design'}</button>
      </div>
    </form>
  );
}
