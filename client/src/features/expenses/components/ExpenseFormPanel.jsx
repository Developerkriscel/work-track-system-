import { useRef } from 'react';

export function ExpenseFormPanel({ form, submitting, onChange, onClose, onSubmit }) {
  const fileRef = useRef(null);

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      onChange({ receipt: null, receiptPreview: '' });
      return;
    }

    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Failed to read receipt file.'));
      reader.readAsDataURL(file);
    });

    onChange({
      receipt: {
        base64,
        fileName: file.name,
        mimeType: file.type
      },
      receiptPreview: base64
    });
  };

  return (
    <article className="migration-panel migration-panel--full">
      <div className="migration-panel__row">
        <h2>Record an Expense</h2>
        <button type="button" className="attendance-cta attendance-cta--red" onClick={onClose}>
          Cancel
        </button>
      </div>

      <div className="forms-editor__grid">
        <label className="dashboard-control">
          <span>Date of Expense</span>
          <input type="date" value={form.date} onChange={(event) => onChange({ date: event.target.value })} />
        </label>

        <label className="dashboard-control">
          <span>Expense Type</span>
          <select value={form.type} onChange={(event) => onChange({ type: event.target.value })}>
            <option value="Travel">Travel</option>
            <option value="Food">Food</option>
            <option value="Hotel">Hotel</option>
            <option value="Miscellaneous">Miscellaneous</option>
          </select>
        </label>

        <label className="dashboard-control">
          <span>Amount</span>
          <input type="number" value={form.amount} onChange={(event) => onChange({ amount: event.target.value })} placeholder="0.00" />
        </label>

        <label className="dashboard-control forms-editor__full">
          <span>Description</span>
          <textarea value={form.description} onChange={(event) => onChange({ description: event.target.value })} rows="4" />
        </label>

        <div className="dashboard-control forms-editor__full">
          <span>Upload Receipt (Optional)</span>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} />
          {form.receiptPreview ? (
            <img className="expense-preview-image" src={form.receiptPreview} alt="Receipt preview" />
          ) : null}
        </div>
      </div>

      <div className="ticket-form-actions">
        <button type="button" className="attendance-cta attendance-cta--blue" disabled={submitting} onClick={onSubmit}>
          Submit Expense
        </button>
        <button type="button" className="attendance-cta attendance-cta--red" onClick={onClose}>
          Cancel
        </button>
      </div>
    </article>
  );
}
