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

function getEmail(input: unknown) {
  return typeof input === 'object' &&
    input !== null &&
    'email' in input &&
    typeof input.email === 'string'
    ? input.email.trim().toLowerCase()
    : '';
}

function getTeamId(input: unknown) {
  return typeof input === 'object' &&
    input !== null &&
    'team_id' in input &&
    typeof input.team_id === 'string'
    ? input.team_id.trim()
    : '';
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(value);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function assignInvitedCoachToSchool({
  admin,
  schoolId,
  userId,
}: {
  admin: AdminClient;
  schoolId: string;
  userId: string;
}) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data, error } = await admin
      .from('profiles')
      .update({ school_id: schoolId })
      .eq('id', userId)
      .eq('role', 'coach')
      .is('school_id', null)
      .select('id')
      .maybeSingle();

    if (data && !error) {
      return { success: true, error: null };
    }

    if (error) {
      return { success: false, error };
    }

    await sleep(150);
  }

  return {
    success: false,
    error: new Error('Invited user profile was not created in time.'),
  };
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
      return json({ error: 'A valid signed-in director is required.' }, 401);
    }

    let input: unknown;

    try {
      input = await request.json();
    } catch {
      return json({ error: 'Request body must be valid JSON.' }, 400);
    }

    const email = getEmail(input);
    const teamId = getTeamId(input);

    if (!email || !isValidEmail(email)) {
      return json({ error: 'A valid email is required.' }, 400);
    }

    if (!teamId || !isValidUuid(teamId)) {
      return json({ error: 'A valid team_id is required.' }, 400);
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

    if (profile.role !== 'director' || !profile.school_id) {
      return json(
        { error: 'Only directors can create assistant coach accounts.' },
        403,
      );
    }

    const { data: school, error: schoolError } = await admin
      .from('schools')
      .select('status')
      .eq('id', profile.school_id)
      .maybeSingle();

    if (schoolError) {
      console.error('Unable to read caller school:', schoolError);
      return json({ error: 'Unable to verify the caller organization.' }, 500);
    }

    if (school?.status !== 'active') {
      return json({ error: 'This organization is currently suspended.' }, 403);
    }

    const { data: team, error: teamError } = await admin
      .from('teams')
      .select('id, school_id')
      .eq('id', teamId)
      .maybeSingle();

    if (teamError) {
      console.error('Unable to read assistant coach team:', teamError);
      return json({ error: 'Unable to verify the team.' }, 500);
    }

    if (!team) {
      return json({ error: 'The selected team does not exist.' }, 404);
    }

    if (team.school_id !== profile.school_id) {
      return json(
        { error: 'Directors can only invite assistants to teams in their school.' },
        403,
      );
    }

    const { data: inviteData, error: inviteError } =
      await admin.auth.admin.inviteUserByEmail(email);

    if (inviteError || !inviteData.user?.id) {
      if (inviteError) {
        console.error('Unable to invite assistant coach:', inviteError);
      }

      return json({ error: 'Unable to invite the assistant coach.' }, 500);
    }

    const userId = inviteData.user.id;
    const assignmentResult = await assignInvitedCoachToSchool({
      admin,
      schoolId: profile.school_id,
      userId,
    });

    if (!assignmentResult.success) {
      console.error(
        'Unable to assign invited coach profile:',
        assignmentResult.error,
      );
      return json(
        {
          error:
            'The invite was sent, but the coach profile could not be assigned to this organization. Contact support.',
        },
        500,
      );
    }

    const { error: membershipError } = await admin
      .from('team_memberships')
      .insert({
        user_id: userId,
        team_id: team.id,
        membership_role: 'assistant_coach',
      });

    if (membershipError) {
      console.error(
        'Unable to create assistant coach team membership:',
        membershipError,
      );
      return json(
        {
          error:
            'The invite was sent, but the assistant could not be added to the team. Contact support.',
        },
        500,
      );
    }

    return json({ userId });
  } catch (error) {
    console.error('Unexpected create-assistant-coach error:', error);
    return json({ error: 'Unable to create the assistant coach.' }, 500);
  }
});
