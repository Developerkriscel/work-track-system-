import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDatabase } from '../config/database.js';
import { LegacyModels } from '../models/legacyModels.js';

async function run() {
  await connectDatabase();
  console.log('Clearing users...');
  await LegacyModels.User.deleteMany({});
  
  console.log('Creating super admin...');
  const hashedPassword = await bcrypt.hash('123456', 10);
  
  await LegacyModels.User.create({
    legacyId: 'AK001',
    data: {
      'Employee ID': 'AK001',
      'Employee Name': 'akash sablaniya',
      'Role': 'Super Admin',
      'Email': 'akash@example.com',
      'Status': 'Active',
      'Password': hashedPassword
    }
  });
  
  console.log('Superadmin created!');
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
