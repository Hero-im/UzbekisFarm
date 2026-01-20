"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";

export default function Nav() {
  const { session, isLoading } = useAuth();
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [roomIds, setRoomIds] = useState<string[]>([]);

  const loadUnread = useCallback(async () => {
    if (!session) {
      setUnreadTotal(0);
      setRoomIds([]);
      return;
    }

    const { data: roomData } = await supabase
      .from("chat_rooms")
      .select("id,buyer_id,seller_id,buyer_last_read_at,seller_last_read_at")
      .or(`buyer_id.eq.${session.user.id},seller_id.eq.${session.user.id}`);

    const rooms = roomData ?? [];
    const nextRoomIds = rooms.map((room) => room.id);
    setRoomIds(nextRoomIds);

    if (nextRoomIds.length === 0) {
      setUnreadTotal(0);
      return;
    }

    const { data: messageData } = await supabase
      .from("chat_messages")
      .select("room_id,sender_id,created_at")
      .in("room_id", nextRoomIds)
      .order("created_at", { ascending: false })
      .limit(500);

    const lastReadByRoom: Record<string, number> = {};
    rooms.forEach((room) => {
      const lastReadAt =
        room.buyer_id === session.user.id
          ? room.buyer_last_read_at
          : room.seller_last_read_at;
      lastReadByRoom[room.id] = lastReadAt ? Date.parse(lastReadAt) : 0;
    });

    let total = 0;
    (messageData ?? []).forEach((msg) => {
      const lastRead = lastReadByRoom[msg.room_id] ?? 0;
      if (
        msg.sender_id !== session.user.id &&
        Date.parse(msg.created_at) > lastRead
      ) {
        total += 1;
      }
    });

    setUnreadTotal(total);
  }, [session]);

  useEffect(() => {
    loadUnread();
  }, [loadUnread]);

  useEffect(() => {
    if (!session || roomIds.length === 0) return;

    const channels = roomIds.map((roomId) =>
      supabase
        .channel(`room:${roomId}:nav`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "chat_messages",
            filter: `room_id=eq.${roomId}`,
          },
          () => {
            loadUnread();
          }
        )
        .subscribe()
    );

    return () => {
      channels.forEach((channel) => {
        supabase.removeChannel(channel);
      });
    };
  }, [roomIds, session, loadUnread]);

  useEffect(() => {
    if (!session || roomIds.length === 0) return;

    const channel = supabase
      .channel("chat-rooms:nav")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chat_rooms",
        },
        (payload) => {
          const updated = payload.new as { id: string };
          if (roomIds.includes(updated.id)) {
            loadUnread();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomIds, session, loadUnread]);

  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-semibold">
          Farm Store
        </Link>

        {isLoading ? (
          <span className="text-sm text-zinc-500">로딩 중...</span>
        ) : session ? (
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/feed" className="hover:underline">
              피드
            </Link>
            <Link href="/posts/new" className="hover:underline">
              글쓰기
            </Link>
            <Link href="/chat" className="relative hover:underline">
              채팅
              {unreadTotal > 0 && (
                <span className="absolute -right-3 -top-2 h-2 w-2 rounded-full bg-red-500" />
              )}
            </Link>
            <Link href="/me" className="hover:underline">
              마이
            </Link>
          </nav>
        ) : (
          <Link
            href="/auth"
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white cursor-pointer"
          >
            로그인
          </Link>
        )}
      </div>
    </header>
  );
}
