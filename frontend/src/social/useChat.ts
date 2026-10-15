'use client'

import type { Card, Outcome } from '@bwf/engine'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useUser } from '@/auth/session-context'
import { api } from '@/lib/api'

export const REACTIONS = ['🔥', '😂', '💀', '👏', '😱'] as const
export const TEXT_MAX = 500
/** The global chat's id; group chats use the group's. */
export const GLOBAL = 'global'

/** A finished hand published in a chat (backend/lib/schema.ts). */
export interface SharedHand {
  dealer: Card[]
  dealerTotal: number
  dealerBlackjack: boolean
  hands: { cards: Card[]; bet: number; total: number; outcome: Outcome }[]
  insurance: number
  net: number
}

export interface ChatMessage {
  id: string
  userId: string
  nombre: string
  avatarUrl: string | null
  texto: string | null
  mano: SharedHand | null
  createdAt: string
  reactions: { emoji: string; count: number; mine: boolean }[]
  /** The message it answers, as a quote. */
  reply: { id: string; userId: string; nombre: string; texto: string | null; mano: boolean } | null
}

/** A chat's last week of messages. */
export interface ChatWeek {
  messages: ChatMessage[]
  more: boolean
  /** May delete anyone's messages here. */
  moderator: boolean
}

/** New messages arrive as live events (useLiveUpdates); this is only the safety net. */
const FALLBACK_MS = 30_000

const chatKey = (userId: string, chatId: string) => ['chat', userId, chatId]

/** A chat's last week. Fetching it counts as reading it, so the unread badges go too. */
export function useChat(chatId: string) {
  const user = useUser()
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: chatKey(user.id, chatId),
    queryFn: async () => {
      const chat = await api<ChatWeek>(`/chat?${new URLSearchParams({ id: chatId })}`)
      void queryClient.invalidateQueries({ queryKey: ['chatUnread', user.id] })
      return chat
    },
    refetchInterval: FALLBACK_MS,
  })
}

/** Unread messages per chat: 'global' and each group's id. */
export function useUnread() {
  const user = useUser()
  return useQuery({
    queryKey: ['chatUnread', user.id],
    queryFn: () => api<Record<string, number>>('/chat/unread'),
    refetchInterval: FALLBACK_MS * 2,
  })
}

function useRefreshChat(chatId: string) {
  const user = useUser()
  const queryClient = useQueryClient()
  return () => void queryClient.invalidateQueries({ queryKey: ['chat', user.id, chatId] })
}

export function useSendMessage(chatId: string) {
  const refresh = useRefreshChat(chatId)
  return useMutation({
    mutationFn: ({ texto, replyTo }: { texto: string; replyTo?: string }) =>
      api<{ ok: true }>('/chat', { method: 'POST', body: { id: chatId, texto, replyTo } }),
    onSuccess: refresh,
  })
}

export function useReact(chatId: string) {
  const user = useUser()
  const queryClient = useQueryClient()
  const key = chatKey(user.id, chatId)
  return useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string | null }) =>
      api<{ ok: true }>('/chat/react', { method: 'POST', body: { messageId, emoji } }),
    // Shows at once; the refetch afterwards puts in what others did meanwhile.
    onMutate: ({ messageId, emoji }) => {
      queryClient.setQueryData<ChatWeek>(key, (chat) =>
        chat && { ...chat, messages: chat.messages.map((m) => (m.id === messageId ? { ...m, reactions: react(m, emoji) } : m)) },
      )
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: key }),
  })
}

/** The message's reactions after the player picks `emoji` (null: takes theirs back). */
function react(message: ChatMessage, emoji: string | null): ChatMessage['reactions'] {
  const counts = new Map(message.reactions.map((r) => [r.emoji, r.mine ? r.count - 1 : r.count]))
  if (emoji) counts.set(emoji, (counts.get(emoji) ?? 0) + 1)
  return REACTIONS.filter((e) => (counts.get(e) ?? 0) > 0).map((e) => ({ emoji: e, count: counts.get(e)!, mine: e === emoji }))
}

export function useDeleteMessage(chatId: string) {
  const refresh = useRefreshChat(chatId)
  return useMutation({
    mutationFn: (messageId: string) => api<{ ok: true }>('/chat/delete', { method: 'POST', body: { messageId } }),
    onSuccess: refresh,
  })
}

/** Publishes a finished hand in the chats the player picks ('global' and/or group ids). */
export function useShareHand() {
  const user = useUser()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ handId, chats }: { handId: string; chats: string[] }) =>
      api<{ chats: string[] }>('/chat/share', { method: 'POST', body: { handId, chats } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['chat', user.id] }),
  })
}
