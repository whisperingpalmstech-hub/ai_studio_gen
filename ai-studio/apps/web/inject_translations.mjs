import fs from 'fs';

let content = fs.readFileSync('lib/i18n.tsx', 'utf-8');
const translated = fs.readFileSync('translated.txt', 'utf-8');

const langs = ['de', 'zh', 'ja', 'ar', 'ru', 'pt', 'it', 'ko'];

for (const lang of langs) {
    const startStr = `    ${lang}: {`;
    const endStr = `    } as any,`;
    
    const startIndex = translated.indexOf(startStr);
    
    // Find the NEXT endStr after startIndex
    let endIndex = translated.indexOf(endStr, startIndex);
    
    if (startIndex !== -1 && endIndex !== -1) {
        let block = translated.substring(startIndex, endIndex + endStr.length - 1); // remove the comma
        
        let targetRegex = new RegExp(`\\s*${lang}: \\{\\} as any,?`);
        content = content.replace(targetRegex, `\n${block},`);
        console.log(`Injected ${lang}`);
    } else {
        console.log(`Failed to find translation for ${lang}`);
    }
}

// remove trailing comma just in case
content = content.replace(/,\n};/g, '\n};');

fs.writeFileSync('lib/i18n.tsx', content);
