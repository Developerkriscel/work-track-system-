import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  employeeId: { type: String, default: '', required() { return !this.clientId; } },
  clientId: { type: String, default: '' },
  contactId: { type: mongoose.Schema.Types.ObjectId, required() { return !this.clientId; } },
  alertType: { type: String, required: true },
  entityId: String,
  event: String,
  message: { type: String, required: true },
  state: { type: String, enum: ['pending', 'processing', 'sent', 'failed', 'skipped', 'unconfirmed'], default: 'pending' },
  error: String,
  startedAt: Date,
  finishedAt: Date
}, { timestamps: true, collection: 'whatsapp_alert_jobs' });
schema.index({ state: 1, createdAt: 1 });
export const WhatsAppAlertJob = mongoose.models.WhatsAppAlertJob || mongoose.model('WhatsAppAlertJob', schema);
