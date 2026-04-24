import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://sambuhclilfbounkdbif.supabase.co'
const SUPABASE_KEY = 'sb_publishable_o8EGOKcQRuQzArOSQlQHdw_EhbFSXAE'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)