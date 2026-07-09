import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: corsHeaders,
  });
}

function getAdminClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing required Supabase environment variables.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function getCallerId(
  request: Request,
  admin: ReturnType<typeof getAdminClient>,
) {
  const authorization = request.headers.get('Authorization');
  const match = authorization?.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return null;
  }

  const { data, error } = await admin.auth.getUser(match[1]);
  return error ? null : data.user?.id ?? null;
}

function generateJoinCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));

  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405);
  }

  try {
    const admin = getAdminClient();
    const callerId = await getCallerId(request, admin);

    if (!callerId) {
      return json({ error: 'A valid signed-in user is required.' }, 401);
    }

    let input: unknown;

    try {
      input = await request.json();
    } catch {
      return json({ error: 'Request body must be valid JSON.' }, 400);
    }

    const organizationName =
      typeof input === 'object' &&
      input !== null &&
      'organizationName' in input &&
      typeof input.organizationName === 'string'
        ? input.organizationName.trim()
        : '';

    if (!organizationName) {
      return json({ error: 'organizationName is required.' }, 400);
    }

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('role, school_id')
      .eq('id', callerId)
      .maybeSingle();

    if (profileError) {
      console.error('Unable to read caller profile:', profileError);
      return json({ error: 'Unable to verify the caller profile.' }, 500);
    }

    if (!profile) {
      return json({ error: 'The caller profile does not exist.' }, 409);
    }

    if (profile.school_id) {
      return json(
        { error: 'This account already belongs to an organization.' },
        409,
      );
    }

    if (profile.role !== 'coach') {
      return json(
        { error: 'This account is not eligible to create an organization.' },
        403,
      );
    }

    let school: { id: string; join_code: string } | null = null;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const joinCode = generateJoinCode();
      const { data, error } = await admin
        .from('schools')
        .insert({
          name: organizationName,
          status: 'active',
          is_personal: false,
          join_code: joinCode,
        })
        .select('id, join_code')
        .single();

      if (!error) {
        school = data;
        break;
      }

      if (error.code !== '23505') {
        console.error('Unable to create organization:', error);
        return json({ error: 'Unable to create the organization.' }, 500);
      }
    }

    if (!school) {
      return json(
        { error: 'Unable to generate a unique organization join code.' },
        500,
      );
    }

    const { data: updatedProfile, error: updateError } = await admin
      .from('profiles')
      .update({
        role: 'director',
        school_id: school.id,
      })
      .eq('id', callerId)
      .eq('role', 'coach')
      .is('school_id', null)
      .select('id')
      .maybeSingle();

    if (updateError || !updatedProfile) {
      const { error: cleanupError } = await admin
        .from('schools')
        .delete()
        .eq('id', school.id);

      if (cleanupError) {
        console.error('Organization rollback failed:', cleanupError);
        return json(
          {
            error:
              'Organization setup failed and automatic cleanup was incomplete. Contact support.',
          },
          500,
        );
      }

      if (updateError) {
        console.error('Unable to update director profile:', updateError);
      }

      return json(
        {
          error:
            'Unable to assign the organization to this account. No organization was created.',
        },
        409,
      );
    }

    return json({
      schoolId: school.id,
      joinCode: school.join_code,
    });
  } catch (error) {
    console.error('Unexpected create-organization error:', error);
    return json({ error: 'Unable to create the organization.' }, 500);
  }
});
