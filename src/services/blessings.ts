import { supabase } from '@/lib/supabase'
import { invokeError } from './_invoke'
import type { BlessingPicks, BlessingRowNumber } from '@/lib/blessings'

export type ChooseBlessingResult = { blessings: BlessingPicks }

export async function chooseBlessing(args: {
  characterId: string
  row: `row${BlessingRowNumber}`
  choice: 'a' | 'b'
}): Promise<ChooseBlessingResult> {
  const { data, error } = await supabase.functions.invoke('blessing-choose', { body: args })
  if (error) await invokeError(error, 'Could not choose blessing')
  return data as ChooseBlessingResult
}

export async function respecBlessings(args: { characterId: string }): Promise<ChooseBlessingResult> {
  const { data, error } = await supabase.functions.invoke('blessing-respec', { body: args })
  if (error) await invokeError(error, 'Could not respec')
  return data as ChooseBlessingResult
}
