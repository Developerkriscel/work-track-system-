import mongoose from 'mongoose';

export const WHATSAPP_ALERT_TYPES = ['ticket', 'approval', 'reminder', 'attendance', 'expense', 'fms'];

const schema = new mongoose.Schema({
  employeeId: { type: String, default: '', trim: true },
  clientId: { type: String, default: '', trim: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  phone: { type: String, required: true, trim: true },
  department: { type: String, default: '', trim: true, maxlength: 120 },
  enabled: { type: Boolean, default: true },
  alertTypes: [{ type: String, enum: WHATSAPP_ALERT_TYPES }],
  notes: { type: String, default: '', trim: true, maxlength: 500 },
  updatedBy: { type: String, required: true, trim: true }
}, {
  collection: 'whatsapp_contacts',
  timestamps: true
});

schema.index({ phone: 1 }, { unique: true });
schema.index({ clientId: 1 }, { unique: true, partialFilterExpression: { clientId: { $exists: true, $gt: '' } } });
schema.index({ employeeId: 1 }, {
  unique: true,
  partialFilterExpression: { employeeId: { $exists: true, $gt: '' } }
});

export const WhatsAppContact = mongoose.models.WhatsAppContact || mongoose.model('WhatsAppContact', schema);
