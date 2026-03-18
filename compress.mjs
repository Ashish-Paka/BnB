import sharp from 'sharp';
import fs from 'fs/promises';

async function optimize() {
  await fs.mkdir('src/assets', { recursive: true });
  
  await sharp('public/bg1.jpg', { failOn: 'none' })
    .resize(1920, null, { withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile('src/assets/bg1.webp');
    
  await sharp('public/bg2.jpg', { failOn: 'none' })
    .resize(1920, null, { withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile('src/assets/bg2.webp');
    
  await sharp('public/LOGO.png')
    .resize(800)
    .webp({ quality: 90 })
    .toFile('src/assets/logo.webp');
    
  console.log('Images optimized successfully!');
}

optimize().catch((err) => {
  console.error(err);
  process.exit(1);
});
