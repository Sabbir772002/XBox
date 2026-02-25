#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const sourceDb = path.join(__dirname, '../../Uitlity/mad_database.db');
const destDbAssets = path.join(__dirname, '../android/app/src/main/assets/mad_database.db');
const destDbWww = path.join(__dirname, '../android/app/src/main/www/mad_database.db');

// Ensure directories exist
const assetsDir = path.dirname(destDbAssets);
const wwwDir = path.dirname(destDbWww);

if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

if (!fs.existsSync(wwwDir)) {
  fs.mkdirSync(wwwDir, { recursive: true });
}

// Copy database
try {
  if (fs.existsSync(sourceDb)) {
    fs.copyFileSync(sourceDb, destDbAssets);
    fs.copyFileSync(sourceDb, destDbWww);
    console.log('✓ Database copied successfully to:');
    console.log('  - android/app/src/main/assets/');
    console.log('  - android/app/src/main/www/');
  } else {
    console.error('✗ Source database not found at:', sourceDb);
    process.exit(1);
  }
} catch (error) {
  console.error('✗ Error copying database:', error.message);
  process.exit(1);
}
