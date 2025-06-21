import dotenv from 'dotenv';
dotenv.config();

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`❌ Saknar env-variabel: ${name}`);
  return value;
}

export const config = {
  OPENAI_API_KEY: requireEnv('OPENAI_API_KEY'),

  ELEVEN_API_KEY: requireEnv('ELEVEN_API_KEY'),
  ELEVEN_VOICE_ID: requireEnv('ELEVEN_VOICE_ID'),

  DEEPGRAM_API_KEY: requireEnv('DEEPGRAM_API_KEY'),

  MONGO_URI: requireEnv('MONGO_URI'),

  SUPABASE_URL: requireEnv('SUPABASE_URL'),
  SUPABASE_ANON_KEY: requireEnv('SUPABASE_ANON_KEY'),
  SUPABASE_SERVICE_ROLE_KEY: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),

  STRIPE_TEST_KEY: requireEnv('STRIPE_TEST_KEY'),
  STRIPE_PRICE_TEASER_5MIN: requireEnv('STRIPE_PRICE_TEASER_5MIN'),

  TWILIO_ACCOUNT_SID: requireEnv('TWILIO_ACCOUNT_SID'),
  TWILIO_AUTH_TOKEN: requireEnv('TWILIO_AUTH_TOKEN'),
  TWILIO_PHONE_SID: requireEnv('TWILIO_PHONE_SID'),
  TWILIO_API_KEY: requireEnv('TWILIO_API_KEY'),

  TWILIO_USER_SID: process.env.TWILIO_USER_SID || null,
  TWILIO_ORG_SID: process.env.TWILIO_ORG_SID || null,
};
