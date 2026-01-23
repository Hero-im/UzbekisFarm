"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";

export default function Nav() {
  const { session, isLoading } = useAuth();
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [roomIds, setRoomIds] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [navQuery, setNavQuery] = useState("");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isFeed = pathname?.startsWith("/feed") || pathname === "/";
  useEffect(() => {
    if (!isFeed) return;
    setNavQuery(searchParams.get("q") ?? "");
  }, [isFeed, searchParams]);

  useEffect(() => {
    let cancelled = false;

    const loadAdmin = async () => {
      if (!session) {
        setIsAdmin(false);
        return;
      }
      const { data } = await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (cancelled) return;
      setIsAdmin(!!data);
    };

    loadAdmin();
    return () => {
      cancelled = true;
    };
  }, [session]);

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
    if (!session) return;

    const messageChannel = supabase
      .channel("chat-messages:nav")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
        },
        () => {
          loadUnread();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messageChannel);
    };
  }, [session, loadUnread]);

  useEffect(() => {
    if (!session) return;

    const buyerChannel = supabase
      .channel(`chat-rooms:nav-buyer:${session.user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_rooms",
          filter: `buyer_id=eq.${session.user.id}`,
        },
        () => {
          loadUnread();
        }
      )
      .subscribe();

    const sellerChannel = supabase
      .channel(`chat-rooms:nav-seller:${session.user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_rooms",
          filter: `seller_id=eq.${session.user.id}`,
        },
        () => {
          loadUnread();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(buyerChannel);
      supabase.removeChannel(sellerChannel);
    };
  }, [session, loadUnread]);

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

  const handleSearchChange = (value: string) => {
    setNavQuery(value);
    if (!isFeed) return;
    const params = new URLSearchParams(searchParams.toString());
    if (value.trim()) {
      params.set("q", value);
    } else {
      params.delete("q");
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <header className="nav-gradient border-b border-zinc-200/80 backdrop-blur">
      <div className="mx-auto w-full max-w-none px-6 py-4 sm:px-10 xl:px-16">
        {isLoading ? (
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-500">로딩 중...</span>
          </div>
        ) : session ? (
          <div className="grid items-center gap-6 md:grid-cols-[1fr_auto_1fr]">
            <div className="hidden md:block" />
            <div className="flex items-center justify-center gap-4">
              <Link href="/" className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[color:var(--leaf)] text-white shadow-[0_10px_24px_rgba(46,113,74,0.22)]">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M7 14c3-6 7-8 10-8 0 6-4 11-10 11" />
                    <path d="M7 14c0 3 2 4 5 4" />
                  </svg>
                </span>
                <span className="flex flex-col leading-none">
                  <span className="font-display text-base font-semibold tracking-tight text-[color:var(--leaf)]">
                    Farm Store
                  </span>
                  <span className="mt-1 text-[10px] uppercase tracking-[0.3em] text-[color:var(--moss)]">
                    fresh local
                  </span>
                </span>
              </Link>

              {isFeed && (
                <div className="relative w-[460px] max-w-[52vw]">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  </span>
                  <input
                    className="w-full rounded-full border border-zinc-200 bg-zinc-50 px-11 py-2.5 text-sm text-zinc-900 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-100"
                    placeholder="어떤 상품을 찾으시나요? 작물/제목 검색"
                    value={navQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                  />
                </div>
              )}
            </div>
            <nav className="flex items-center justify-end gap-3 text-[15px]">
            <Link
              href="/posts/new"
              className="inline-flex items-center gap-2 rounded-full border border-zinc-300/70 bg-transparent px-4.5 py-2.5 hover:border-zinc-900"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
              상품등록
            </Link>
            <Link
              href={`/farms/${session.user.id}`}
              className="inline-flex items-center gap-2 rounded-full border border-zinc-300/70 bg-transparent px-4.5 py-2.5 hover:border-zinc-900"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 10l9-6 9 6" />
                <path d="M5 10v10h14V10" />
                <path d="M10 20v-6h4v6" />
              </svg>
              농장 관리
            </Link>
            <Link
              href="/chat"
              className="relative inline-flex items-center gap-2 rounded-full border border-zinc-300/70 bg-transparent px-4.5 py-2.5 hover:border-zinc-900"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 15a4 4 0 0 1-4 4H7l-4 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
              </svg>
              채팅
              {unreadTotal > 0 && (
                <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500" />
              )}
            </Link>
            {isAdmin && (
              <Link
                href="/admin/seller-verifications"
                className="inline-flex items-center gap-2 rounded-full border border-zinc-300/70 bg-transparent px-4.5 py-2.5 hover:border-zinc-900"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 3l8 4v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
                관리자
              </Link>
            )}
            <Link
              href="/me"
              className="inline-flex items-center gap-2 rounded-full border border-zinc-300/70 bg-transparent px-4.5 py-2.5 hover:border-zinc-900"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M20 21a8 8 0 0 0-16 0" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              마이페이지
            </Link>
          </nav>
          </div>
        ) : (
          <div className="grid items-center gap-6 md:grid-cols-[1fr_auto_1fr]">
            <div />
            <Link href="/feed" className="flex items-center justify-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[color:var(--leaf)] text-white shadow-[0_10px_24px_rgba(46,113,74,0.22)]">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M7 14c3-6 7-8 10-8 0 6-4 11-10 11" />
                  <path d="M7 14c0 3 2 4 5 4" />
                </svg>
              </span>
              <span className="flex flex-col leading-none">
                <span className="font-display text-base font-semibold tracking-tight text-[color:var(--leaf)]">
                  Farm Store
                </span>
                <span className="mt-1 text-[10px] uppercase tracking-[0.3em] text-[color:var(--moss)]">
                  fresh local
                </span>
              </span>
            </Link>
            <nav className="flex items-center justify-end gap-3 text-[15px]">
              <Link
                href="/auth?mode=signup"
                className="inline-flex items-center rounded-full border border-zinc-200 bg-white/60 px-4.5 py-2.5 font-semibold text-[color:var(--leaf)] shadow-[0_10px_22px_rgba(46,113,74,0.16)] hover:border-zinc-900"
              >
                무료로 시작하기
              </Link>
              <Link
                href="/auth?mode=login"
                className="inline-flex items-center gap-2 rounded-full border border-zinc-300/70 bg-transparent px-4.5 py-2.5 hover:border-zinc-900"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M20 21a8 8 0 0 0-16 0" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                로그인하기
              </Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
