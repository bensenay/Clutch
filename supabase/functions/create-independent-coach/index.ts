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

    const teamName =
      typeof input === 'object' &&
      input !== null &&
      'teamName' in input &&
      typeof input.teamName === 'string'
        ? input.teamName.trim()
        : '';

    if (!teamName) {
      return json({ error: 'teamName is required.' }, 400);
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
        { error: 'Only coach accounts can create an independent team.' },
        403,
      );
    }

    // schools.name is NOT NULL in the current schema, so a private placeholder
    // is used instead of exposing the personal school concept to the coach.
    const { data: school, error: schoolError } = await admin
      .from('schools')
      .insert({
        name: 'Personal coaching workspace',
        status: 'active',
        is_personal: true,
        join_code: null,
      })
      .select('id')
      .single();

    if (schoolError) {
      console.error('Unable to create personal school:', schoolError);
      return json({ error: 'Unable to create the independent team.' }, 500);
    }

    const { data: team, error: teamError } = await admin
      .from('teams')
      .insert({
        school_id: school.id,
        name: teamName,
      })
      .select('id')
      .single();

    if (teamError) {
      const { error: cleanupError } = await admin
        .from('schools')
        .delete()
        .eq('id', school.id);

      if (cleanupError) {
        console.error('Personal school rollback failed:', cleanupError);
      }

      console.error('Unable to create independent team:', teamError);
      return json(
        {
          error: cleanupError
            ? 'Independent team setup failed and automatic cleanup was incomplete. Contact support.'
            : 'Unable to create the independent team.',
        },
        500,
      );
    }

    const { error: membershipError } = await admin
      .from('team_memberships')
      .insert({
        user_id: callerId,
        team_id: team.id,
      });

    if (membershipError) {
      let cleanupFailed = false;
      const { error: teamCleanupError } = await admin
        .from('teams')
        .delete()
        .eq('id', team.id);

      if (teamCleanupError) {
        cleanupFailed = true;
        console.error('Independent team rollback failed:', teamCleanupError);
      } else {
        const { error: schoolCleanupError } = await admin
          .from('schools')
          .delete()
          .eq('id', school.id);

        if (schoolCleanupError) {
          cleanupFailed = true;
          console.error('Personal school rollback failed:', schoolCleanupError);
        }
      }

      console.error('Unable to create independent membership:', membershipError);
      return json(
        {
          error: cleanupFailed
            ? 'Independent team setup failed and automatic cleanup was incomplete. Contact support.'
            : 'Unable to create the independent team membership.',
        },
        500,
      );
    }

    const { data: updatedProfile, error: updateError } = await admin
      .from('profiles')
      .update({ school_id: school.id })
      .eq('id', callerId)
      .eq('role', 'coach')
      .is('school_id', null)
      .select('id')
      .maybeSingle();

    if (updateError || !updatedProfile) {
      let cleanupFailed = false;
      const { error: membershipCleanupError } = await admin
        .from('team_memberships')
        .delete()
        .eq('user_id', callerId)
        .eq('team_id', team.id);

      if (membershipCleanupError) {
        cleanupFailed = true;
        console.error('Independent membership rollback failed:', membershipCleanupError);
      } else {
        const { error: teamCleanupError } = await admin
          .from('teams')
          .delete()
          .eq('id', team.id);

        if (teamCleanupError) {
          cleanupFailed = true;
          console.error('Independent team rollback failed:', teamCleanupError);
        } else {
          const { error: schoolCleanupError } = await admin
            .from('schools')
            .delete()
            .eq('id', school.id);

          if (schoolCleanupError) {
            cleanupFailed = true;
            console.error(
              'Personal school rollback failed:',
              schoolCleanupError,
            );
          }
        }
      }

      if (updateError) {
        console.error('Unable to update independent coach profile:', updateError);
      }

      return json(
        {
          error: cleanupFailed
            ? 'Independent team setup failed and automatic cleanup was incomplete. Contact support.'
            : 'Unable to assign the independent team to the account. No onboarding rows were retained.',
        },
        409,
      );
    }

    return json({
      schoolId: school.id,
      teamId: team.id,
    });
  } catch (error) {
    console.error('Unexpected create-independent-coach error:', error);
    return json({ error: 'Unable to create the independent team.' }, 500);
  }
});
