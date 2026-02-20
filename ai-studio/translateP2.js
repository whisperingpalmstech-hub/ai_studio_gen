const fs = require('fs');
const path = require('path');

const pageFile = path.join(__dirname, 'apps/web/app/(dashboard)/dashboard/page.tsx');
let content = fs.readFileSync(pageFile, 'utf8');

content = content.replace(/export default async function DashboardPage\(\) \{/, 'import { useI18n } from "@/lib/i18n";\n\nexport default async function DashboardPage() {\n    const { t } = useI18n();');
// Wait, DashboardPage is async and server component! We need to make it a client component OR use a server/client hybrid approach.

