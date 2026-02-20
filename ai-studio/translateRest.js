const fs = require('fs');
const path = require('path');

let f = path.join(__dirname, 'apps/web/app/(dashboard)/dashboard/gallery/page.tsx');
let c = fs.readFileSync(f, 'utf8');

c = c.replace(/import { useToast } from "@\/hooks\/use-toast";/, 'import { useToast } from "@/hooks/use-toast";\nimport { useI18n } from "@/lib/i18n";');
c = c.replace(/const { toast } = useToast\(\);/, 'const { toast } = useToast();\n    const { t } = useI18n();');

c = c.replace(/Gallery/g, "{t('galleryTitle')}");
c = c.replace(/Browse and manage your AI-generated images/g, "{t('manageImages')}");
c = c.replace(/No generations yet/g, "{t('noGensYet')}");
c = c.replace(/Start creating amazing images with AI/g, "{t('startCreatingImages')}");
c = c.replace(/Generate Your First Image/g, "{t('createFirstImg')}");

fs.writeFileSync(f, c);

console.log("Gallery updated");
