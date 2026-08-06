import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

type AdminClient = ReturnType<typeof getAdminClient>;

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

async function getCallerId(request: Request, admin: AdminClient) {
  const authorization = request.headers.get('Authorization');
  const match = authorization?.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return null;
  }

  const { data, error } = await admin.auth.getUser(match[1]);
  return error ? null : data.user?.id ?? null;
}

function getTeamJoinCode(input: unknown) {
  return typeof input === 'object' &&
    input !== null &&
    'team_join_code' in input &&
    typeof input.team_join_code === 'string'
    ? input.team_join_code.trim()
    : '';
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

    const teamJoinCode = getTeamJoinCode(input);

    if (!teamJoinCode) {
      return json({ error: 'team_join_code is required.' }, 400);
    }

    if (!/^[a-z0-9]{6,8}$/i.test(teamJoinCode)) {
      return json({ error: 'Invalid team join code.' }, 404);
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

    if (profile.role !== 'coach') {
      return json(
        { error: 'Only coach accounts can join a team as an assistant.' },
        403,
      );
    }

    const { data: team, error: teamError } = await admin
      .from('teams')
      .select('id, name, school_id')
      .ilike('join_code', teamJoinCode)
      .maybeSingle();

    if (teamError) {
      console.error('Unable to look up team join code:', teamError);
      return json({ error: 'Unable to validate the team code.' }, 500);
    }

    if (!team) {
      return json({ error: 'Invalid team join code.' }, 404);
    }

    if (profile.school_id && profile.school_id !== team.school_id) {
      return json(
        {
          error:
            'This account already belongs to a different organization.',
        },
        409,
      );
    }

    const { data: school, error: schoolError } = await admin
      .from('schools')
      .select('status')
      .eq('id', team.school_id)
      .maybeSingle();

    if (schoolError) {
      console.error('Unable to read team school:', schoolError);
      return json({ error: 'Unable to verify the team organization.' }, 500);
    }

    if (school?.status !== 'active') {
      return json(
        { error: 'This organization is currently suspended.' },
        403,
      );
    }

    const { error: membershipError } = await admin
      .from('team_memberships')
      .insert({
        user_id: callerId,
        team_id: team.id,
        membership_role: 'assistant_coach',
      });

    if (membershipError) {
      if (membershipError.code === '23505') {
        return json(
          { error: 'This account is already a member of that team.' },
          409,
        );
      }

      console.error('Unable to create assistant membership:', membershipError);
      return json({ error: 'Unable to join the team.' }, 500);
    }

    if (!profile.school_id) {
      const { data: updatedProfile, error: updateError } = await admin
        .from('profiles')
        .update({ school_id: team.school_id })
        .eq('id', callerId)
        .eq('role', 'coach')
        .is('school_id', null)
        .select('id')
        .maybeSingle();

      if (updateError || !updatedProfile) {
        const { error: cleanupError } = await admin
          .from('team_memberships')
          .delete()
          .eq('user_id', callerId)
          .eq('team_id', team.id);

        if (cleanupError) {
          console.error('Assistant membership rollback failed:', cleanupError);
        }

        if (updateError) {
          console.error('Unable to update assistant profile:', updateError);
        }

        return json(
          {
            error: cleanupError
              ? 'Joining failed and automatic cleanup was incomplete. Contact support.'
              : 'Unable to assign the team organization to this account. No membership was retained.',
          },
          409,
        );
      }
    }

    return json({
      teamId: team.id,
      teamName: team.name,
    });
  } catch (error) {
    console.error('Unexpected join-team-as-assistant error:', error);
    return json({ error: 'Unable to join the team as an assistant.' }, 500);
  }
});
