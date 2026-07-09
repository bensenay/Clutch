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

    const joinCode =
      typeof input === 'object' &&
      input !== null &&
      'joinCode' in input &&
      typeof input.joinCode === 'string'
        ? input.joinCode.trim()
        : '';
    const teamName =
      typeof input === 'object' &&
      input !== null &&
      'teamName' in input &&
      typeof input.teamName === 'string'
        ? input.teamName.trim()
        : '';

    if (!joinCode || !teamName) {
      return json({ error: 'joinCode and teamName are required.' }, 400);
    }

    if (!/^[a-z0-9]{6,8}$/i.test(joinCode)) {
      return json({ error: 'Invalid organization join code.' }, 404);
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
        { error: 'Only coach accounts can join an organization.' },
        403,
      );
    }

    const { data: school, error: schoolError } = await admin
      .from('schools')
      .select('id, status')
      .ilike('join_code', joinCode)
      .eq('is_personal', false)
      .maybeSingle();

    if (schoolError) {
      console.error('Unable to look up organization join code:', schoolError);
      return json({ error: 'Unable to validate the organization code.' }, 500);
    }

    if (!school) {
      return json({ error: 'Invalid organization join code.' }, 404);
    }

    if (school.status !== 'active') {
      return json(
        { error: 'This organization is currently suspended.' },
        403,
      );
    }

    const { data: existingTeam, error: teamLookupError } = await admin
      .from('teams')
      .select('id')
      .eq('school_id', school.id)
      .eq('name', teamName)
      .limit(1)
      .maybeSingle();

    if (teamLookupError) {
      console.error('Unable to look up organization team:', teamLookupError);
      return json({ error: 'Unable to find or create the team.' }, 500);
    }

    let teamId = existingTeam?.id ?? null;
    let teamCreated = false;

    if (!teamId) {
      const { data: newTeam, error: teamCreateError } = await admin
        .from('teams')
        .insert({
          school_id: school.id,
          name: teamName,
        })
        .select('id')
        .single();

      if (teamCreateError) {
        console.error('Unable to create organization team:', teamCreateError);
        return json({ error: 'Unable to find or create the team.' }, 500);
      }

      teamId = newTeam.id;
      teamCreated = true;
    }

    const { error: membershipError } = await admin
      .from('team_memberships')
      .insert({
        user_id: callerId,
        team_id: teamId,
      });

    if (membershipError) {
      let cleanupFailed = false;

      if (teamCreated) {
        const { error } = await admin.from('teams').delete().eq('id', teamId);
        cleanupFailed = Boolean(error);

        if (error) {
          console.error('New team rollback failed:', error);
        }
      }

      console.error('Unable to create team membership:', membershipError);
      return json(
        {
          error: cleanupFailed
            ? 'Joining failed and automatic cleanup was incomplete. Contact support.'
            : 'Unable to add this account to the team.',
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
        .eq('team_id', teamId);

      if (membershipCleanupError) {
        cleanupFailed = true;
        console.error('Membership rollback failed:', membershipCleanupError);
      }

      if (teamCreated && !membershipCleanupError) {
        const { error: teamCleanupError } = await admin
          .from('teams')
          .delete()
          .eq('id', teamId);

        if (teamCleanupError) {
          cleanupFailed = true;
          console.error('New team rollback failed:', teamCleanupError);
        }
      }

      if (updateError) {
        console.error('Unable to update coach profile:', updateError);
      }

      return json(
        {
          error: cleanupFailed
            ? 'Joining failed and automatic cleanup was incomplete. Contact support.'
            : 'Unable to assign this organization to the account. No membership was retained.',
        },
        409,
      );
    }

    return json({
      schoolId: school.id,
      teamId,
      teamCreated,
    });
  } catch (error) {
    console.error('Unexpected join-organization error:', error);
    return json({ error: 'Unable to join the organization.' }, 500);
  }
});
