import { FunctionsHttpError } from '@supabase/supabase-js';

export async function getFunctionErrorMessage(error: unknown) {
  if (error instanceof FunctionsHttpError) {
    try {
      const body: unknown = await error.context.json();

      if (
        typeof body === 'object' &&
        body !== null &&
        'error' in body &&
        typeof body.error === 'string'
      ) {
        return body.error;
      }
    } catch {
      return null;
    }
  }

  return error instanceof Error ? error.message : null;
}
