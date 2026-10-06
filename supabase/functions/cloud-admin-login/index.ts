import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const encoder = new TextEncoder();
const failuresByIp = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

async function constantTimeEqual(left: string, right: string): Promise<boolean> {
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(left)),
    crypto.subtle.digest('SHA-256', encoder.encode(right)),
  ]);
  const aa = new Uint8Array(a);
  const bb = new Uint8Array(b);
  let difference = 0;
  for (let i = 0; i < aa.length; i++) difference |= aa[i] ^ bb[i];
  return difference === 0;
}

function isRateLimited(ip: string, now = Date.now()): boolean {
  const current = failuresByIp.get(ip);
  if (!current || current.resetAt <= now) {
    failuresByIp.set(ip, { count: 0, resetAt: now + WINDOW_MS });
    return false;
  }
  return current.count >= MAX_FAILURES;
}

function recordFailure(ip: string, now = Date.now()) {
  const current = failuresByIp.get(ip);
  if (!current || current.resetAt <= now) failuresByIp.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  else current.count += 1;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed.' });

  const accessCode = Deno.env.get('ADMIN_ACCESS_CODE');
  const adminEmail = Deno.env.get('ADMIN_EMAIL')?.trim().toLowerCase();
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!accessCode || accessCode.length < 32 || !adminEmail || !supabaseUrl || !serviceRoleKey) {
    console.error('Cloud admin login secrets are not configured.');
    return json(503, { error: 'Cloud admin login is not configured.' });
  }

  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  if (isRateLimited(ip)) return json(429, { error: 'Too many attempts. Try again later.' });

  let submittedCode = '';
  try {
    const payload = await request.json();
    if (typeof payload?.code === 'string' && payload.code.length <= 512) submittedCode = payload.code;
  } catch {
    recordFailure(ip);
    return json(400, { error: 'Invalid request.' });
  }

  if (!submittedCode || !(await constantTimeEqual(submittedCode, accessCode))) {
    recordFailure(ip);
    return json(401, { error: 'Invalid access code.' });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Ensure the configured admin exists and has a server-owned role claim.
  let adminUser: { id: string; app_metadata?: Record<string, unknown> } | null = null;
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      console.error('Unable to look up configured admin account:', error.message);
      return json(503, { error: 'Cloud admin login is temporarily unavailable.' });
    }
    adminUser = data.users.find((user) => user.email?.toLowerCase() === adminEmail) || null;
    if (adminUser || data.users.length < 1000) break;
  }

  if (adminUser) {
    const { error } = await supabase.auth.admin.updateUserById(adminUser.id, {
      app_metadata: { ...(adminUser.app_metadata || {}), role: 'admin' },
    });
    if (error) {
      console.error('Unable to set configured admin role:', error.message);
      return json(503, { error: 'Cloud admin login is temporarily unavailable.' });
    }
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: adminEmail,
      email_confirm: true,
      app_metadata: { role: 'admin' },
      user_metadata: { display_name: 'Coach / Admin' },
    });
    if (error || !data.user) {
      console.error('Unable to create configured admin account:', error?.message || 'No user returned');
      return json(503, { error: 'Cloud admin login is temporarily unavailable.' });
    }
  }

  const { data, error } = await supabase.auth.admin.generateLink({ type: 'magiclink', email: adminEmail });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) {
    console.error('Unable to issue admin sign-in token:', error?.message || 'No token returned');
    return json(503, { error: 'Cloud admin login is temporarily unavailable.' });
  }

  failuresByIp.delete(ip);
  return json(200, { token_hash: tokenHash, type: 'magiclink' });
});
