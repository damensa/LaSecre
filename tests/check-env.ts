import dotenv from 'dotenv';
dotenv.config();

const REQUIRED_VARS = [
  'WHATSAPP_TOKEN',
  'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_VERIFY_TOKEN',
  'GEMINI_API_KEY',
  'STRIPE_API_KEY',
  'GOOGLE_SHEETS_CLIENT_EMAIL',
  'GOOGLE_SHEETS_PRIVATE_KEY',
  'GOOGLE_SHEETS_TEMPLATE_ID',
  'DATABASE_URL'
];

console.log('--- CHECKING ENVIRONMENT VARIABLES ---');

let missing = false;
REQUIRED_VARS.forEach(v => {
  if (!process.env[v]) {
    console.error(`❌ Missing: ${v}`);
    missing = true;
  } else {
    // Show prefix for security
    const val = process.env[v] || '';
    const display = val.length > 10 ? val.substring(0, 10) + '...' : '***';
    console.log(`✅ ${v}: ${display}`);
  }
});

if (missing) {
  console.log('\nResult: FAILED');
  process.exit(1);
} else {
  console.log('\nResult: ALL OK');
  process.exit(0);
}
