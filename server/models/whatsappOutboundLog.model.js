import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'WhatsAppContact' },
  employeeId: { type: String, default: '', trim: true },
  clientId: { type: String, default: '', trim: true },
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  alertType: { type: String, default: 'manual', trim: true },
  entityId: { type: String, default: '', trim: true },
  message: { type: String, required: true, trim: true },
  attachmentType: { type: String, default: '', trim: true },
  attachmentName: { type: String, default: '', trim: true },
  attachmentUrl: { type: String, default: '', trim: true },
  status: { type: String, required: true, enum: ['sent', 'failed', 'skipped'] },
  providerStatus: { type: String, default: '', trim: true },
  provider: { type: String, default: 'AKNexus', trim: true },
  providerMessage: { type: String, default: '', trim: true },
  providerResponse: { type: mongoose.Schema.Types.Mixed, default: null },
  error: { type: String, default: '', trim: true },
  createdBy: { type: String, default: '', trim: true },
  sentAt: { type: Date, default: Date.now }
}, {
  collection: 'whatsapp_outbound_logs',
  timestamps: true
});

schema.index({ employeeId: 1, sentAt: -1 });
schema.index({ phone: 1, sentAt: -1 });
schema.index({ status: 1, sentAt: -1 });

export const WhatsAppOutboundLog = mongoose.models.WhatsAppOutboundLog || mongoose.model('WhatsAppOutboundLog', schema);
