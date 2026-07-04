import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { PlannerState } from '../shared/types';
import { normalizePlannerState } from '../shared/settings';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? 'https://khmaqdzubmxrcmjwxqnz.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'sb_publishable_a6qi4uGJW51jlgX30eKXug_VrWn8yM7';

export type SyncStatus = 'idle' | 'syncing' | 'signed-out' | 'error';

export interface RemotePlannerState {
  state: PlannerState;
  updatedAt: string;
}

let client: SupabaseClient | undefined;

export function getSupabaseClient(): SupabaseClient {
  if (!client) {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    });
  }
  return client;
}

export async function getCurrentUser(): Promise<User | undefined> {
  const { data, error } = await getSupabaseClient().auth.getUser();
  if (error) return undefined;
  return data.user ?? undefined;
}

export async function signInWithEmailPassword(email: string, password: string): Promise<User> {
  const { data, error } = await getSupabaseClient().auth.signInWithPassword({ email, password });
  if (error || !data.user) throw new Error(error?.message ?? 'Could not sign in.');
  return data.user;
}

export async function signUpWithEmailPassword(email: string, password: string): Promise<User | undefined> {
  const { data, error } = await getSupabaseClient().auth.signUp({ email, password });
  if (error) throw new Error(error.message);
  return data.user ?? undefined;
}

export async function signOut(): Promise<void> {
  const { error } = await getSupabaseClient().auth.signOut();
  if (error) throw new Error(error.message);
}

export async function loadRemotePlannerState(userId: string): Promise<RemotePlannerState | undefined> {
  const { data, error } = await getSupabaseClient()
    .from('planner_states')
    .select('state, updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return undefined;
  return {
    state: normalizePlannerState(data.state as PlannerState),
    updatedAt: String(data.updated_at)
  };
}

export async function saveRemotePlannerState(userId: string, state: PlannerState): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('planner_states')
    .upsert({
      user_id: userId,
      state,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });
  if (error) throw new Error(error.message);
}
