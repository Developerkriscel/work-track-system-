import('dotenv/config').then(() => import('./config/database.js')).then(async (db) => {
  await db.connectDatabase();
  const { LegacyModels } = await import('./models/legacyModels.js');
  
  await LegacyModels.FmsTask.updateMany({}, { $set: { 'data.sourceHash': '' } });
  await LegacyModels.FmsTask.deleteOne({ legacyId: '__FMS_SHEET_SYNC_META__' });
  
  const { syncFmsFromGoogleSheet } = await import('./services/fms.service.js');
  const result = await syncFmsFromGoogleSheet();
  console.log('Sync Result:', result);
  
  const { deleteByPrefix, buildRedisKey } = await import('./services/redisCache.service.js');
  await deleteByPrefix(buildRedisKey('fms'));
  
  process.exit(0);
}).catch(console.error);
