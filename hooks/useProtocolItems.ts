import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { ProtocolItem } from '@/types'

export function useProtocolItems(userId: string) {
  const [items, setItems] = useState<ProtocolItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchItems() }, [userId])

  async function fetchItems() {
    setLoading(true)
    const today = new Date().getDay()
    const { data } = await supabase
      .from('protocol_items')
      .select('*')
      .eq('user_id', userId)
      .eq('active', true)
      .contains('active_days', [today])
      .order('sort_order', { ascending: true })
    setItems((data as ProtocolItem[]) ?? [])
    setLoading(false)
  }

  async function createItem(label: string, category: ProtocolItem['category']) {
    const { error } = await supabase.from('protocol_items').insert({
      user_id: userId, label, category, sort_order: items.length,
    })
    if (!error) await fetchItems()
    return { error }
  }

  async function archiveItem(id: string) {
    const { error } = await supabase
      .from('protocol_items').update({ active: false }).eq('id', id)
    if (!error) await fetchItems()
    return { error }
  }

  return { items, loading, createItem, archiveItem, refetch: fetchItems }
}
