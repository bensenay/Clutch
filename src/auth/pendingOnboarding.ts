import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_ONBOARDING_KEY = 'clutch.pendingOnboarding';

export type PendingOnboardingIntent =
  {
    type: 'director';
    email: string;
    payload: { directorName?: string; organizationName: string };
  }
  | {
    type: 'assistant_join_team';
    email: string;
    payload: { teamJoinCode: string };
  };

function isPendingOnboardingIntent(
  value: unknown,
): value is PendingOnboardingIntent {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('type' in value) ||
    !('email' in value) ||
    typeof value.email !== 'string' ||
    !('payload' in value) ||
    typeof value.payload !== 'object' ||
    value.payload === null
  ) {
    return false;
  }

  if (value.type === 'director') {
    return (
      (!('directorName' in value.payload) ||
        typeof value.payload.directorName === 'string') &&
      'organizationName' in value.payload &&
      typeof value.payload.organizationName === 'string'
    );
  }

  if (value.type === 'assistant_join_team') {
    return (
      'teamJoinCode' in value.payload &&
      typeof value.payload.teamJoinCode === 'string'
    );
  }

  return false;
}

export async function save(intent: PendingOnboardingIntent) {
  await AsyncStorage.setItem(
    PENDING_ONBOARDING_KEY,
    JSON.stringify(intent),
  );
}

export async function load() {
  const storedValue = await AsyncStorage.getItem(PENDING_ONBOARDING_KEY);

  if (!storedValue) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(storedValue);
    return isPendingOnboardingIntent(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function clear() {
  await AsyncStorage.removeItem(PENDING_ONBOARDING_KEY);
}

export const pendingOnboarding = {
  save,
  load,
  clear,
};
