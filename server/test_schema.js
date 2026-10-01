import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

async function test() {
    await mongoose.connect(process.env.MONGO_URI);
    
    try {
        const db = mongoose.connection.useDb('worktrack');
        const legacy = await db.collection('attendance_legacy').findOne({});
        console.log("Sample legacy doc:", JSON.stringify(legacy, null, 2));
    } catch(e) {
        console.error(e);
    }
    
    process.exit(0);
}
test();
