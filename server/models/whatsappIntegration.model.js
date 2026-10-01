import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  _id: { type: String, default: 'active' },
  provider: { type: String, enum: ['aknexus', 'compatible'], required: true },
  providerName: String,
  apiBaseUrl: String,
  instanceId: String,
  senderNumber: String,
  encryptedToken: { type: String, required: true },
  revision: { type: Number, default: 1 },
  updatedBy: String
}, { timestamps: true, collection: 'whatsapp_integration' });
export const WhatsAppIntegration = mongoose.models.WhatsAppIntegration || mongoose.model('WhatsAppIntegration', schema);
