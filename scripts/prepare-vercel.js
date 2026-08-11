import fs from 'fs';
import path from 'path';

const outputDir = path.join(process.cwd(), '.vercel', 'output');
const staticDir = path.join(outputDir, 'static');

fs.mkdirSync(staticDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'config.json'), JSON.stringify({ version: 3 }));

if (fs.existsSync(path.join(process.cwd(), 'dist'))) {
  fs.cpSync(path.join(process.cwd(), 'dist'), staticDir, { recursive: true });
  console.log('✅ Successfully created .vercel/output build artifact from dist!');
} else {
  console.error('❌ dist folder not found. Run npm run build first.');
}
