
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'apps/api/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkModels() {
    const { data, error } = await supabase.from('models').select('name, type, file_path');
    if (error) console.error(error);
    else console.log(JSON.stringify(data, null, 2));
}

checkModels();
