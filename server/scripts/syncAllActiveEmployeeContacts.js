import 'dotenv/config';
import { connectDatabase } from '../config/database.js';
import { listRows } from '../services/legacyStore.service.js';
import { WhatsAppContact, WHATSAPP_ALERT_TYPES } from '../models/whatsappContact.model.js';
import { normalizeWhatsAppPhone } from '../services/whatsappContacts.service.js';
import { employeeIdOf, isActive, field } from '../services/whatsappAlertRules.js';

export async function syncActiveEmployeeContacts() {
  await connectDatabase();
  const users = await listRows('User');
  const activeUsers = users.filter((u) => {
    const id = employeeIdOf(u);
    if (!id || /^(tmp_|test_|verify_|debug_|apr_)/i.test(id)) return false;
    return isActive(u);
  });

  console.log(`Found ${activeUsers.length} active employees to verify.`);
  const results = [];

  for (const user of activeUsers) {
    const id = employeeIdOf(user);
    const name = field(user, ['Employee Name', 'User Name', 'Name', 'name']);
    const rawPhone = field(user, ['Mobile Number', 'Mobile', 'Phone No', 'Phone', 'phone', 'mobile']);
    const phone = normalizeWhatsAppPhone(rawPhone);
    const dept = field(user, ['Department', 'department']);

    if (!phone) {
      console.warn(`[SKIP] Active employee ${name} (${id}) has no valid mobile number: ${rawPhone}`);
      continue;
    }

    // Check if a contact already exists with this phone or employeeId
    const existingByEmp = await WhatsAppContact.findOne({ employeeId: id });
    const existingByPhone = await WhatsAppContact.findOne({ phone });

    if (existingByEmp && existingByEmp.phone !== phone) {
      console.log(`[UPDATE PHONE] Updating phone for ${name} (${id}) from ${existingByEmp.phone} to ${phone}`);
      // If old phone belongs to someone else or duplicate exists, remove obsolete phone doc if orphaned
      if (existingByPhone && String(existingByPhone._id) !== String(existingByEmp._id)) {
        await WhatsAppContact.deleteOne({ _id: existingByPhone._id });
      }
      existingByEmp.phone = phone;
      existingByEmp.name = name;
      existingByEmp.department = dept;
      existingByEmp.enabled = true;
      existingByEmp.alertTypes = WHATSAPP_ALERT_TYPES;
      await existingByEmp.save();
      results.push({ id, name, phone, action: 'updated_phone' });
    } else if (existingByEmp) {
      // Ensure enabled and all alert types
      let changed = false;
      if (!existingByEmp.enabled) {
        existingByEmp.enabled = true;
        changed = true;
      }
      if (existingByEmp.alertTypes.length < WHATSAPP_ALERT_TYPES.length) {
        existingByEmp.alertTypes = WHATSAPP_ALERT_TYPES;
        changed = true;
      }
      if (changed) {
        await existingByEmp.save();
        console.log(`[ENABLED] Contact for ${name} (${id}) enabled with all alert types.`);
      }
      results.push({ id, name, phone, action: changed ? 'enabled_alerts' : 'already_active' });
    } else if (existingByPhone) {
      console.log(`[LINK] Linking existing contact ${phone} to employee ${name} (${id})`);
      existingByPhone.employeeId = id;
      existingByPhone.name = name;
      existingByPhone.department = dept;
      existingByPhone.enabled = true;
      existingByPhone.alertTypes = WHATSAPP_ALERT_TYPES;
      await existingByPhone.save();
      results.push({ id, name, phone, action: 'linked_employee' });
    } else {
      console.log(`[CREATE] Creating new contact for active employee ${name} (${id}) - ${phone}`);
      await WhatsAppContact.create({
        employeeId: id,
        clientId: '',
        name,
        phone,
        department: dept,
        enabled: true,
        alertTypes: WHATSAPP_ALERT_TYPES,
        notes: 'Auto-provisioned for active employee alerts',
        updatedBy: 'system'
      });
      results.push({ id, name, phone, action: 'created' });
    }
  }

  // Also remove any client contacts or ensure client contacts cannot receive alerts
  const clientContacts = await WhatsAppContact.find({ clientId: { $exists: true, $gt: '' } });
  for (const cc of clientContacts) {
    if (cc.enabled) {
      console.log(`[DISABLE CLIENT] Disabling WhatsApp alerts for client contact: ${cc.name} (${cc.clientId})`);
      cc.enabled = false;
      await cc.save();
    }
  }

  console.log('Sync finished. Results:', results);
  return results;
}

if (process.argv[1]?.endsWith('syncAllActiveEmployeeContacts.js')) {
  syncActiveEmployeeContacts()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
