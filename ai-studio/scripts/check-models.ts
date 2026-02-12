import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

// Try to find the correct .env file
const envPath = 'apps/web/.env.local';
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const supabase = createClient(
    envConfig.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || envConfig.SUPABASE_SERVICE_ROLE_KEY // Might need to find where this is
);

async function checkModels() {
    const { data, error } = await supabase.from('models').select('*');
    if (error) console.error(error);
    else console.log(JSON.stringify(data, null, 2));
}

checkModels();
