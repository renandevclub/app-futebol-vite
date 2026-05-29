const fs = require('fs');
const path = require('path');

function processDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory() && file !== 'node_modules' && file !== 'dist') {
            processDir(fullPath);
        } else if (stat.isFile() && fullPath.endsWith('.html')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            // Remove local css links but keep http/https ones
            const regex = /\s*<link[^>]*rel=["']stylesheet["'][^>]*href=["'](?!http|https|\/\/)[^"']*["'][^>]*>/gi;
            const newContent = content.replace(regex, '');
            if (content !== newContent) {
                fs.writeFileSync(fullPath, newContent, 'utf8');
                console.log(`Updated: ${fullPath}`);
            }
        }
    }
}

processDir(process.cwd());
console.log('Done.');
