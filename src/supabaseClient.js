import { createClient } from '@supabase/supabase-js'
const supabaseUrl = 'https://ceanwvsvbiktbwydvyyi.supabase.co'
const supabaseAnonKey = 'sb_publishable_sSEg6wn5B-pM9ZxX8P-cQw_XopMqzS-'
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
