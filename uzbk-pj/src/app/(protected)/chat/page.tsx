"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import Loading from "@/components/Loading";

type Room = {
  id: string;
  post_id: string | null;
  buyer_id: string | null;
  seller_id: string | null;
  created_at: string;
  buyer_last_read_at: string | null;
  seller_last_read_at: string | null;
};

type LastMessage = {
  content: string;
  created_at: string;
};

type ProfileRow = {
  id: string;
  nickname: string | null;
};

export default function ChatListPage() {
  const { session } = useAuth();
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [lastMessages, setLastMessages] = useState<
    Record<string, LastMessage | null>
  >({});
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!session) {
        setLoading(false);
        return;
      }

      const { data: roomData } = await supabase
        .from("chat_rooms")
        .select(
          "id,post_id,buyer_id,seller_id,created_at,buyer_last_read_at,seller_last_read_at"
        )
        .or(`buyer_id.eq.${session.user.id},seller_id.eq.${session.user.id}`)
        .order("created_at", { ascending: false });

      if (cancelled) return;
      const nextRooms = roomData ?? [];
      setRooms(nextRooms);

      const roomIds = nextRooms.map((room) => room.id);
      const otherUserIds = nextRooms
        .map((room) =>
          room.buyer_id === session.user.id ? room.seller_id : room.buyer_id
        )
        .filter((id): id is string => Boolean(id));

      if (roomIds.length > 0) {
        const { data: messageData } = await supabase
          .from("chat_messages")
          .select("room_id,content,created_at,sender_id")
          .in("room_id", roomIds)
          .order("created_at", { ascending: false })
          .limit(500);

        if (!cancelled) {
          const nextLast: Record<string, LastMessage | null> = {};
          const nextUnread: Record<string, number> = {};
          const lastReadByRoom: Record<string, number> = {};

          nextRooms.forEach((room) => {
            const lastReadAt =
              room.buyer_id === session.user.id
                ? room.buyer_last_read_at
                : room.seller_last_read_at;
            lastReadByRoom[room.id] = lastReadAt
              ? Date.parse(lastReadAt)
              : 0;
            nextUnread[room.id] = 0;
          });

          (messageData ?? []).forEach((msg) => {
            if (!nextLast[msg.room_id]) {
              nextLast[msg.room_id] = {
                content: msg.content,
                created_at: msg.created_at,
              };
            }
            const lastRead = lastReadByRoom[msg.room_id] ?? 0;
            if (
              msg.sender_id !== session.user.id &&
              Date.parse(msg.created_at) > lastRead
            ) {
              nextUnread[msg.room_id] = (nextUnread[msg.room_id] ?? 0) + 1;
            }
          });
          setLastMessages(nextLast);
          setUnreadCounts(nextUnread);
        }
      }

      if (otherUserIds.length > 0) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id,nickname")
          .in("id", otherUserIds);

        if (!cancelled) {
          const nextProfiles: Record<string, ProfileRow> = {};
          (profileData ?? []).forEach((profile) => {
            nextProfiles[profile.id] = profile;
          });
          setProfiles(nextProfiles);
        }
      }

      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const lastReadAtByRoom = useMemo(() => {
    const next: Record<string, number> = {};
    if (!session) return next;
    rooms.forEach((room) => {
      const lastReadAt =
        room.buyer_id === session.user.id
          ? room.buyer_last_read_at
          : room.seller_last_read_at;
      next[room.id] = lastReadAt ? Date.parse(lastReadAt) : 0;
    });
    return next;
  }, [rooms, session]);

  useEffect(() => {
    if (!session || rooms.length === 0) return;

    const channel = supabase
      .channel("chat-rooms:list")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chat_rooms",
        },
        (payload) => {
          const updated = payload.new as Room;
          setRooms((prev) => {
            const index = prev.findIndex((room) => room.id === updated.id);
            if (index === -1) return prev;

            const prevRoom = prev[index];
            const nextRooms = [...prev];
            nextRooms[index] = { ...prevRoom, ...updated };

            const isBuyer = prevRoom.buyer_id === session.user.id;
            const prevRead = isBuyer
              ? prevRoom.buyer_last_read_at
              : prevRoom.seller_last_read_at;
            const nextRead = isBuyer
              ? updated.buyer_last_read_at
              : updated.seller_last_read_at;

            if (nextRead && (!prevRead || Date.parse(nextRead) > Date.parse(prevRead))) {
              setUnreadCounts((prevUnread) => ({
                ...prevUnread,
                [updated.id]: 0,
              }));
            }

            return nextRooms;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [rooms, session]);

  useEffect(() => {
    if (!session || rooms.length === 0) return;

    const channels = rooms.map((room) =>
      supabase
        .channel(`room:${room.id}:list`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "chat_messages",
            filter: `room_id=eq.${room.id}`,
          },
          (payload) => {
            const nextMessage = payload.new as {
              room_id: string;
              content: string;
              created_at: string;
              sender_id: string;
            };

            setLastMessages((prev) => ({
              ...prev,
              [room.id]: {
                content: nextMessage.content,
                created_at: nextMessage.created_at,
              },
            }));

            const lastRead = lastReadAtByRoom[room.id] ?? 0;
            if (
              nextMessage.sender_id !== session.user.id &&
              Date.parse(nextMessage.created_at) > lastRead
            ) {
              setUnreadCounts((prev) => ({
                ...prev,
                [room.id]: (prev[room.id] ?? 0) + 1,
              }));
            }
          }
        )
        .subscribe()
    );

    return () => {
      channels.forEach((channel) => {
        supabase.removeChannel(channel);
      });
    };
  }, [rooms, session, lastReadAtByRoom]);

  const sortedRooms = useMemo(() => {
    return [...rooms].sort((a, b) => {
      const aTime = lastMessages[a.id]?.created_at ?? a.created_at;
      const bTime = lastMessages[b.id]?.created_at ?? b.created_at;
      return Date.parse(bTime) - Date.parse(aTime);
    });
  }, [rooms, lastMessages]);

  const handleLeave = async (room: Room) => {
    if (!session) return;
    const shouldLeave = window.confirm("이 대화를 나가시겠어요?");
    if (!shouldLeave) return;
    const { error } = await supabase.rpc("leave_chat_room", {
      room_id: room.id,
    });

    if (!error) {
      setRooms((prev) => prev.filter((r) => r.id !== room.id));
    }
  };

  if (loading) return <Loading />;

  if (!session) return <p>로그인이 필요합니다.</p>;
  if (rooms.length === 0) return <p>채팅방이 없습니다.</p>;

  const formatTime = (value: string) =>
    new Date(value).toLocaleString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">대화목록</h1>
      <ul className="space-y-2">
        {sortedRooms.map((room) => {
          const otherUserId =
            room.buyer_id === session.user.id ? room.seller_id : room.buyer_id;
          const otherNickname =
            (otherUserId ? profiles[otherUserId]?.nickname : null) ?? "상대";
          const lastMessage = lastMessages[room.id];
          const unreadCount = unreadCounts[room.id] ?? 0;

          return (
            <li
              key={room.id}
              className="cursor-pointer rounded border p-3"
              onClick={() => router.push(`/chat/${room.id}`)}
            >
              <div className="flex items-center justify-between">
                <span className="underline">{otherNickname}</span>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">
                      +{unreadCount}
                    </span>
                  )}
                  <button
                    type="button"
                    className="rounded border px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLeave(room);
                    }}
                  >
                    나가기
                  </button>
                </div>
              </div>
              <div className="mt-1 text-sm text-zinc-600">
                {lastMessage?.content ?? "최근 메시지가 없습니다."}
              </div>
              {lastMessage?.created_at && (
                <div className="mt-1 text-xs text-zinc-500">
                  {formatTime(lastMessage.created_at)}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
