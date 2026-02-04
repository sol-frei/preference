
import { createClient } from '@supabase/supabase-js';

// Vercel Serverless Function handler
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { role } = req.body;
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'No authorization header' });
  }

  const token = authHeader.split(' ')[1];

  // 1. Initialize Supabase with Service Role Key (Server-side ONLY)
  const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );

  try {
    // 2. Verify if the requester is an authorized admin
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized session' });
    }

    // 3. Check admin role in profiles table
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || (profile.role !== 'admin' && profile.role !== 'i女er')) {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }

    // 4. Generate random credentials
    const loginId = `pfr_${Math.random().toString(36).substring(2, 10)}`;
    const email = `${loginId}@preference.internal`;
    const password = Math.random().toString(36).substring(2, 12) + '!';

    // 5. Create the user in Supabase Auth
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { login_id: loginId }
    });

    if (createError) throw createError;

    // 6. The profile will be created by the DB Trigger (handle_new_user)
    // We update it to ensure it matches the requested role and marks first login
    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ 
        username: loginId,
        role: role || 'user',
        is_first_login: true
      })
      .eq('id', newUser.user.id)
      .select()
      .single();

    if (updateError) throw updateError;

    // 7. Return the raw credentials to the admin (one-time display)
    return res.status(200).json({
      ...updatedProfile,
      login_id: email, // Admin can use email or ID to login
      password: password
    });

  } catch (error: any) {
    console.error('Admin API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
