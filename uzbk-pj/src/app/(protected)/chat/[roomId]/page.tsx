"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import Loading from "@/components/Loading";

type Message = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

type Room = {
  id: string;
  post_id: string | null;
  buyer_id: string | null;
  seller_id: string | null;
};

const MAX_MESSAGE_LENGTH = 500;

export default function ChatRoomPage() {
  const params = useParams();
  const roomId = params.roomId as string;
  const router = useRouter();
  const { session } = useAuth();

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const lastReadUpdateRef = useRef<number>(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [room, setRoom] = useState<Room | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [sendError, setSendError] = useState("");
  const [otherNickname, setOtherNickname] = useState<string | null>(null);
  const [postId, setPostId] = useState<string | null>(null);
  const [postStatus, setPostStatus] = useState<string | null>(null);
  const [soldRoomId, setSoldRoomId] = useState<string | null>(null);
  const [postTitle, setPostTitle] = useState<string | null>(null);
  const [postPrice, setPostPrice] = useState<number | null>(null);
  const [postImageUrl, setPostImageUrl] = useState<string | null>(null);
  const [supportMessage, setSupportMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!session || !roomId) return;
      setLoading(true);
      setAccessDenied(false);
      setRoom(null);
      setMessages([]);
      setOtherNickname(null);

      const { data: roomData, error: roomError } = await supabase
        .from("chat_rooms")
        .select("id,post_id,buyer_id,seller_id")
        .eq("id", roomId)
        .single();

      if (cancelled) return;
      if (roomError || !roomData) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }

      const isParticipant =
        roomData.buyer_id === session.user.id ||
        roomData.seller_id === session.user.id;

      if (!isParticipant) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }

      setRoom(roomData);
      setPostId(roomData.post_id ?? null);

      const otherUserId =
        roomData.buyer_id === session.user.id
          ? roomData.seller_id
          : roomData.buyer_id;

      if (otherUserId) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("nickname")
          .eq("id", otherUserId)
          .single();

        if (!cancelled) {
          setOtherNickname(profileData?.nickname ?? null);
        }
      }

      if (roomData.post_id) {
        const { data: postData } = await supabase
          .from("posts")
          .select("status,sold_room_id,title,price")
          .eq("id", roomData.post_id)
          .maybeSingle();
        setPostStatus(postData?.status ?? null);
        setSoldRoomId(postData?.sold_room_id ?? null);
        setPostTitle(postData?.title ?? null);
        setPostPrice(postData?.price ?? null);

        const { data: imageData } = await supabase
          .from("post_images")
          .select("storage_path")
          .eq("post_id", roomData.post_id)
          .order("sort_order", { ascending: true })
          .limit(1);

        const storagePath = imageData?.[0]?.storage_path;
        if (storagePath) {
          const { data } = supabase.storage
            .from("post-images")
            .getPublicUrl(storagePath);
          setPostImageUrl(data.publicUrl);
        } else {
          setPostImageUrl(null);
        }
      } else {
        setPostStatus(null);
        setSoldRoomId(null);
        setPostTitle(null);
        setPostPrice(null);
        setPostImageUrl(null);
      }

      const { data: messageData } = await supabase
        .from("chat_messages")
        .select("id,sender_id,content,created_at")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true });

      if (cancelled) return;
      setMessages(messageData ?? []);
      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [roomId, session]);

  useEffect(() => {
    if (!roomId || !room || !session) return;

    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const nextMessage = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((msg) => msg.id === nextMessage.id)) return prev;
            return [...prev, nextMessage];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, room, session]);

  useEffect(() => {
    if (!postId || !session) return;

    const channel = supabase
      .channel(`post:${postId}:chat`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "posts",
          filter: `id=eq.${postId}`,
        },
        (payload) => {
          const nextPost = payload.new as {
            status?: string | null;
            sold_room_id?: string | null;
            title?: string | null;
            price?: number | null;
          };
          setPostStatus(nextPost.status ?? null);
          setSoldRoomId(nextPost.sold_room_id ?? null);
          setPostTitle(nextPost.title ?? null);
          setPostPrice(
            typeof nextPost.price === "number" ? nextPost.price : null
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId, session]);

  useEffect(() => {
    if (!roomId || !session) return;

    const intervalId = setInterval(async () => {
      const { data: messageData } = await supabase
        .from("chat_messages")
        .select("id,sender_id,content,created_at")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true });
      setMessages(messageData ?? []);

      if (postId) {
        const { data: postData } = await supabase
          .from("posts")
          .select("status,sold_room_id,title,price")
          .eq("id", postId)
          .maybeSingle();
        setPostStatus(postData?.status ?? null);
        setSoldRoomId(postData?.sold_room_id ?? null);
        setPostTitle(postData?.title ?? null);
        setPostPrice(postData?.price ?? null);

        const { data: imageData } = await supabase
          .from("post_images")
          .select("storage_path")
          .eq("post_id", postId)
          .order("sort_order", { ascending: true })
          .limit(1);

        const storagePath = imageData?.[0]?.storage_path;
        if (storagePath) {
          const { data } = supabase.storage
            .from("post-images")
            .getPublicUrl(storagePath);
          setPostImageUrl(data.publicUrl);
        } else {
          setPostImageUrl(null);
        }
      }
    }, 5000);

    return () => {
      clearInterval(intervalId);
    };
  }, [roomId, postId, session]);

  useEffect(() => {
    if (loading) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (!room || !session) return;
    markRoomRead();
  }, [messages.length, room, session]);

  const handleSend = async () => {
    if (!session || !room) return;
    const trimmed = content.trim();
    if (!trimmed) {
      setSendError("메시지를 입력하세요.");
      return;
    }
    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      setSendError("메시지는 500자 이하로 입력하세요.");
      return;
    }

    const { data, error } = await supabase
      .from("chat_messages")
      .insert({
        room_id: roomId,
        sender_id: session.user.id,
        content: trimmed,
      })
      .select("id,sender_id,content,created_at")
      .single();

    if (error) {
      setSendError(error.message);
      return;
    }

    if (data) {
      setMessages((prev) => {
        if (prev.some((msg) => msg.id === data.id)) return prev;
        return [...prev, data];
      });
    }

    setContent("");
    setSendError("");
  };

  const markRoomRead = async () => {
    if (!session || !room) return;
    const now = Date.now();
    if (now - lastReadUpdateRef.current < 2000) return;
    lastReadUpdateRef.current = now;

    const field =
      room.buyer_id === session.user.id
        ? "buyer_last_read_at"
        : "seller_last_read_at";

    await supabase
      .from("chat_rooms")
      .update({ [field]: new Date(now).toISOString() })
      .eq("id", room.id);
  };

  const handleLeave = async () => {
    if (!session || !room) return;
    const shouldLeave = window.confirm("이 대화를 나가시겠어요?");
    if (!shouldLeave) return;
    const { error } = await supabase.rpc("leave_chat_room", {
      room_id: room.id,
    });

    if (error) {
      setSendError(error.message);
      return;
    }

    router.replace("/chat");
  };

  const handleSupportChat = async () => {
    if (!session) return;
    const supportUserId = process.env.NEXT_PUBLIC_SUPPORT_USER_ID;
    if (!supportUserId) {
      setSupportMessage("고객센터 계정이 설정되지 않았습니다.");
      return;
    }

    const { data: existing } = await supabase
      .from("chat_rooms")
      .select("id")
      .eq("buyer_id", session.user.id)
      .eq("seller_id", supportUserId)
      .is("post_id", null)
      .maybeSingle();

    let supportRoomId = existing?.id;
    if (!supportRoomId) {
      const { data: created, error } = await supabase
        .from("chat_rooms")
        .insert({
          buyer_id: session.user.id,
          seller_id: supportUserId,
          post_id: null,
        })
        .select("id")
        .single();

      if (error) {
        setSupportMessage(error.message);
        return;
      }

      supportRoomId = created?.id;
    }

    if (supportRoomId) {
      router.push(`/chat/${supportRoomId}`);
    }
  };

  if (!session) return <p>로그인이 필요합니다.</p>;
  if (loading) return <Loading />;
  if (accessDenied) return <p>이 채팅방에 접근할 권한이 없습니다.</p>;

  const formatTime = (value: string) =>
    new Date(value).toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });

  const isBuyer = session?.user.id && room?.buyer_id === session.user.id;
  const isSoldRoom = Boolean(
    postStatus === "sold" && soldRoomId && soldRoomId === roomId
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">
          {(otherNickname ?? "상대") + " 님과의 대화"}
        </h1>
        <button
          type="button"
          onClick={handleLeave}
          className="rounded border px-3 py-1 text-sm text-zinc-600 hover:bg-zinc-50"
        >
          대화 나가기
        </button>
      </div>
      <div className="max-h-[60vh] space-y-2 overflow-y-auto rounded border p-3">
        {messages.length === 0 && <p>메시지가 없습니다.</p>}
        {messages.map((m) => {
          const isMine = m.sender_id === session?.user.id;
          const senderLabel = isMine ? "나" : otherNickname ?? "상대";
          const isSoldMessage = m.content.startsWith("__SOLD__:");
          return (
            <div key={m.id} className={`text-sm ${isMine ? "text-right" : ""}`}>
              <div className="text-xs text-zinc-500">
                {senderLabel} · {formatTime(m.created_at)}
              </div>
              {isSoldMessage ? (
                <div
                  className="mt-1 flex cursor-pointer gap-3 rounded border p-3 text-sm text-zinc-700"
                  onClick={() => {
                    if (postId) router.push(`/posts/${postId}`);
                  }}
                >
                  <div className="flex-1">
                    <div className="font-medium">
                      {otherNickname ?? "상대"} 님과 거래완료 되었습니다.
                    </div>
                    {postTitle && (
                      <div className="mt-1 text-xs text-zinc-500">
                        상품: {postTitle}
                        {postPrice != null ? ` · ${postPrice}` : ""}
                      </div>
                    )}
                    {isBuyer && isSoldRoom && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded border px-3 py-2 text-sm text-zinc-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSupportChat();
                          }}
                        >
                          상품을 받지 못했어요
                        </button>
                        <button
                          type="button"
                          className="rounded bg-zinc-900 px-3 py-2 text-sm text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (postId) router.push(`/posts/${postId}`);
                          }}
                        >
                          리뷰작성
                        </button>
                        {supportMessage && (
                          <p className="text-sm text-red-500">{supportMessage}</p>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="h-16 w-16 overflow-hidden rounded border bg-zinc-100">
                    {postImageUrl ? (
                      <img
                        src={postImageUrl}
                        alt={postTitle ?? "post"}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">
                        이미지 없음
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div>{m.content}</div>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2">
        <input
          className="flex-1 rounded border px-3 py-2"
          placeholder="메시지 입력"
          value={content}
          maxLength={MAX_MESSAGE_LENGTH}
          autoFocus
          onChange={(e) => {
            setContent(e.target.value);
            if (sendError) setSendError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <button
          onClick={handleSend}
          className="rounded bg-zinc-900 px-4 py-2 text-white cursor-pointer"
        >
          보내기
        </button>
      </div>
      {sendError && <p className="text-sm text-red-500">{sendError}</p>}
    </div>
  );
}
