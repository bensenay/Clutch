import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_ONBOARDING_KEY = 'clutch.pendingOnboarding';

export type PendingOnboardingIntent =
  {
    type: 'director';
    payload: { organizationName: string };
  };

function isPendingOnboardingIntent(
  value: unknown,
): value is PendingOnboardingIntent {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('type' in value) ||
    !('payload' in value) ||
    typeof value.payload !== 'object' ||
    value.payload === null
  ) {
    return false;
  }

  if (value.type === 'director') {
    return (
      'organizationName' in value.payload &&
      typeof value.payload.organizationName === 'string'
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
