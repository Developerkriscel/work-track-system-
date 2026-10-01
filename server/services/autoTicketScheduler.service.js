import { LegacyModels } from '../models/legacyModels.js';
import { insertRow } from './legacyStore.service.js';

function getWeekOfMonth(date) {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  return Math.ceil((date.getDate() + firstDay) / 7);
}

function isFrequencyMatch(frequency, date) {
  if (!frequency) return false;
  const freq = String(frequency).toLowerCase().trim();
  const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const dateNum = date.getDate();
  const weekNum = getWeekOfMonth(date);

  if (freq === 'daily') return true;
  if (freq === dayName) return true; // monday, tuesday, etc.
  if (freq === dateNum.toString()) return true; // 15, 26, 27, 28, 29, etc.
  
  if (freq === '2nd fri' && dayName === 'friday' && weekNum === 2) return true;
  if (freq === '4th fri' && dayName === 'friday' && weekNum === 4) return true;
  
  return false;
}

async function processAutoTickets() {
  try {
    console.log('Running Auto Ticket generation job...');
    const TicketModel = LegacyModels.Ticket;
    
    // Find all auto ticket templates
    const autoTickets = await TicketModel.find({
      $or: [
        { 'data.Auto Ticket': 'Yes' },
        { 'data.Is Auto Ticket': 'Yes' },
        { 'data.Auto Ticket': 'yes' },
        { 'data.Is Auto Ticket': 'yes' }
      ]
    });

    const today = new Date();
    const todayStr = today.toLocaleDateString('en-US'); // MM/DD/YYYY format matching CSV
    let generatedCount = 0;

    for (const doc of autoTickets) {
      const template = doc.data || {};
      const frequency = template.Frequency || template.Frequence;

      if (isFrequencyMatch(frequency, today)) {
        // Prevent duplicate generation on server restart
        const clientId = template['Client_Id'] || template['Client ID'];
        const empId = template['Employee ID'] || template['EmpID'];
        const desc = template['Task Description'] || template['Description'];
        
        const existingTicket = await TicketModel.findOne({
          'data.Plan Date': todayStr,
          $or: [{ 'data.Client_Id': clientId }, { 'data.Client ID': clientId }],
          $or: [{ 'data.Employee ID': empId }, { 'data.EmpID': empId }],
          $or: [{ 'data.Task Description': desc }, { 'data.Description': desc }],
          'data.Auto Ticket': { $nin: ['Yes', 'yes'] },
          'data.Is Auto Ticket': { $nin: ['Yes', 'yes'] }
        });

        if (existingTicket) {
           continue; // Already generated for today
        }

        // Generate new ticket payload
        const newTicketData = { ...template };
        
        // Remove the Auto Ticket flags so it becomes a normal ticket
        delete newTicketData['Auto Ticket'];
        delete newTicketData['Is Auto Ticket'];
        
        // Update Timestamp and Plan Date to today
        newTicketData['Timestamp'] = todayStr;
        newTicketData['Plan Date'] = todayStr;
        
        // Create new ID
        const newId = `TKT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        newTicketData['Ticket ID'] = newId;
        newTicketData['ID'] = newId;
        
        // Default status to Pending if not set
        if (!newTicketData['Status']) {
          newTicketData['Status'] = 'Pending';
        }

        await insertRow('Ticket', newTicketData);
        generatedCount++;
      }
    }
    
    console.log(`Auto Ticket job completed. Generated ${generatedCount} tickets for today.`);
  } catch (error) {
    console.error('Error processing auto tickets:', error);
  }
}

function scheduleNextRun() {
  const now = new Date();
  const nextRun = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0); // 12:00 AM tomorrow
  const delayMs = nextRun.getTime() - now.getTime();
  
  setTimeout(() => {
    processAutoTickets().finally(scheduleNextRun);
  }, delayMs);
}

export function startAutoTicketScheduler() {
  console.log('Auto Ticket Scheduler is starting...');
  scheduleNextRun();
  processAutoTickets(); // Run once immediately on start
}
