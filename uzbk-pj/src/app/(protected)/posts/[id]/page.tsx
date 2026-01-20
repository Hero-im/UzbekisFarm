"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import Loading from "@/components/Loading";

type Post = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  content: string | null;
  region_name: string | null;
  region_code: string | null;
  price: number | null;
  quantity: number | null;
  category: string | null;
  created_at: string;
  status: string | null;
  sold_room_id: string | null;
};

type ImageRow = {
  id: string;
  storage_path: string;
  sort_order: number;
  url: string;
};

type Seller = {
  nickname: string | null;
  region_name: string | null;
  region_code: string | null;
};

const STATUS_OPTIONS = [
  { value: "active", label: "판매중", className: "text-blue-600" },
  { value: "reserved", label: "예약중", className: "text-green-600" },
  { value: "sold", label: "거래완료", className: "text-red-600" },
];

type BuyerRoom = {
  id: string;
  buyer_id: string | null;
};

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { session } = useAuth();
  const postId = params.id as string;

  const [post, setPost] = useState<Post | null>(null);
  const [images, setImages] = useState<ImageRow[]>([]);
  const [seller, setSeller] = useState<Seller | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [current, setCurrent] = useState(0);
  const [isBuyer, setIsBuyer] = useState(false);
  const [isSoldBuyer, setIsSoldBuyer] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);
  const [rating, setRating] = useState(5);
  const [reviewContent, setReviewContent] = useState("");
  const [reviewMessage, setReviewMessage] = useState("");
  const [buyerRooms, setBuyerRooms] = useState<BuyerRoom[]>([]);
  const [buyersById, setBuyersById] = useState<Record<string, string>>({});
  const [selectedSoldRoomId, setSelectedSoldRoomId] = useState<string | null>(
    null
  );
  const [soldMessage, setSoldMessage] = useState("");
  const [statusDraft, setStatusDraft] = useState("active");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { data: postData, error } = await supabase
        .from("posts")
        .select(
          "id,user_id,title,description,content,region_name,region_code,price,quantity,category,created_at,status,sold_room_id"
        )
        .eq("id", postId)
        .single();

      if (cancelled) return;

      if (error) {
        setMessage(error.message);
        setLoading(false);
        return;
      }

      const { data: imgData } = await supabase
        .from("post_images")
        .select("id,storage_path,sort_order")
        .eq("post_id", postId)
        .order("sort_order", { ascending: true });

      const imgRows = (imgData ?? []).map((img) => {
        const { data } = supabase.storage
          .from("post-images")
          .getPublicUrl(img.storage_path);

        return {
          id: img.id,
          storage_path: img.storage_path,
          sort_order: img.sort_order,
          url: data.publicUrl,
        };
      });

      const { data: sellerData } = await supabase
        .from("profiles")
        .select("nickname,region_name,region_code")
        .eq("id", postData.user_id)
        .single();

      if (session) {
        const { data: roomData } = await supabase
          .from("chat_rooms")
          .select("id")
          .eq("post_id", postData.id)
          .eq("buyer_id", session.user.id)
          .maybeSingle();
        setIsBuyer(Boolean(roomData));

        if (postData.sold_room_id) {
          const { data: soldRoom } = await supabase
            .from("chat_rooms")
            .select("buyer_id")
            .eq("id", postData.sold_room_id)
            .maybeSingle();
          setIsSoldBuyer(soldRoom?.buyer_id === session.user.id);
        } else {
          setIsSoldBuyer(false);
        }

        const { data: reviewData } = await supabase
          .from("reviews")
          .select("id")
          .eq("post_id", postData.id)
          .eq("reviewer_id", session.user.id)
          .maybeSingle();
        setHasReviewed(Boolean(reviewData));
      }

      if (session?.user.id === postData.user_id) {
        const { data: roomList } = await supabase
          .from("chat_rooms")
          .select("id,buyer_id")
          .eq("post_id", postData.id);

        const buyerRoomList = (roomList ?? []).filter(
          (room) => room.buyer_id
        ) as BuyerRoom[];
        setBuyerRooms(buyerRoomList);

        const buyerIds = buyerRoomList
          .map((room) => room.buyer_id)
          .filter((id): id is string => Boolean(id));

        if (buyerIds.length > 0) {
          const { data: buyerProfiles } = await supabase
            .from("profiles")
            .select("id,nickname")
            .in("id", buyerIds);

          const nextBuyers: Record<string, string> = {};
          (buyerProfiles ?? []).forEach((profile) => {
            nextBuyers[profile.id] = profile.nickname ?? "미설정";
          });
          setBuyersById(nextBuyers);
        }
      }

      setPost(postData as Post);
      setStatusDraft(postData.status ?? "active");
      setImages(imgRows);
      setSeller(sellerData ?? null);
      setLoading(false);
    };

    if (postId) load();
    return () => {
      cancelled = true;
    };
  }, [postId, session]);

  const isSeller = useMemo(() => {
    return session?.user.id === post?.user_id;
  }, [session, post]);

  const desc = post?.description ?? post?.content ?? "";
  const currentImage = images[current];
  const currentStatus = statusDraft;
  const statusOption =
    STATUS_OPTIONS.find((option) => option.value === currentStatus) ??
    STATUS_OPTIONS[0];
  const showSoldPicker =
    isSeller && currentStatus === "sold" && post?.status !== "sold";
  const priceLabel =
    post?.price != null ? `${post.price.toLocaleString("ko-KR")}원` : "가격 미정";

  const handleDelete = async () => {
    if (!post || !session) return;
    if (!confirm("삭제할까요?")) return;

    const { data: imgData } = await supabase
      .from("post_images")
      .select("storage_path")
      .eq("post_id", post.id);

    const paths = (imgData ?? []).map((i) => i.storage_path);
    if (paths.length > 0) {
      await supabase.storage.from("post-images").remove(paths);
    }

    await supabase.from("post_images").delete().eq("post_id", post.id);
    await supabase.from("posts").delete().eq("id", post.id);

    router.replace("/feed");
  };

  const handleChat = async () => {
    if (!post || !session) return;

    const buyerId = session.user.id;
    const sellerId = post.user_id;

    if (buyerId === sellerId) return;

    const { data: existing } = await supabase
      .from("chat_rooms")
      .select("id")
      .eq("buyer_id", buyerId)
      .eq("seller_id", sellerId)
      .eq("post_id", post.id)
      .maybeSingle();

    let roomId = existing?.id;

    if (!roomId) {
      const { data: created, error } = await supabase
        .from("chat_rooms")
        .insert({
          buyer_id: buyerId,
          seller_id: sellerId,
          post_id: post.id,
        })
        .select("id")
        .single();

      if (error) {
        setMessage(error.message);
        return;
      }

      roomId = created?.id;
    }

    if (roomId) {
      router.push(`/chat/${roomId}`);
    }
  };

  const handleStatusChange = async (nextStatus: string) => {
    if (!post || !session) return;
    setSoldMessage("");
    setStatusDraft(nextStatus);

    if (nextStatus === "sold") {
      setSelectedSoldRoomId(post.sold_room_id ?? null);
      return;
    }

    const { error } = await supabase
      .from("posts")
      .update({ status: nextStatus, sold_room_id: null })
      .eq("id", post.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setPost({ ...post, status: nextStatus, sold_room_id: null });
  };

  const handleConfirmSold = async () => {
    if (!post || !session) return;
    if (!selectedSoldRoomId) {
      setSoldMessage("거래 완료 상대를 선택하세요.");
      return;
    }

    const { error } = await supabase
      .from("posts")
      .update({ status: "sold", sold_room_id: selectedSoldRoomId })
      .eq("id", post.id);

    if (error) {
      setSoldMessage(error.message);
      return;
    }

    const buyerRoom = buyerRooms.find(
      (room) => room.id === selectedSoldRoomId
    );
    const buyerName =
      (buyerRoom?.buyer_id && buyersById[buyerRoom.buyer_id]) || "구매자";

    await supabase.from("chat_messages").insert({
      room_id: selectedSoldRoomId,
      sender_id: session.user.id,
      content: `__SOLD__:${post.id}:${post.title}`,
    });

    setPost({ ...post, status: "sold", sold_room_id: selectedSoldRoomId });
    setStatusDraft("sold");
    setSoldMessage("거래 완료 처리되었습니다.");
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!post || !session) return;
    const trimmed = reviewContent.trim();
    if (!trimmed) {
      setReviewMessage("리뷰 내용을 입력하세요.");
      return;
    }
    if (rating < 1 || rating > 5) {
      setReviewMessage("평점을 1~5 사이로 입력하세요.");
      return;
    }

    const { error } = await supabase.from("reviews").insert({
      reviewer_id: session.user.id,
      reviewee_id: post.user_id,
      post_id: post.id,
      rating,
      content: trimmed,
    });

    if (error) {
      setReviewMessage(error.message);
      return;
    }

    setHasReviewed(true);
    setReviewContent("");
    setReviewMessage("리뷰가 등록되었습니다.");
  };

  if (loading) return <Loading />;
  if (message) return <p className="text-sm text-red-600">{message}</p>;
  if (!post) return <p>게시글을 찾을 수 없습니다.</p>;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8">
      <div className="grid gap-8 lg:grid-cols-[1.1fr,0.9fr]">
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-2xl border bg-zinc-50">
            {currentImage ? (
              <img
                src={currentImage.url}
                alt="post"
                className="h-[420px] w-full object-cover"
              />
            ) : (
              <div className="flex h-[420px] items-center justify-center text-sm text-zinc-400">
                이미지가 없습니다.
              </div>
            )}
            {images.length > 1 && (
              <div className="absolute right-4 top-4 rounded-full bg-zinc-900/80 px-3 py-1 text-xs text-white">
                {current + 1}/{images.length}
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex items-center justify-between text-sm">
              <button
                className="rounded border px-3 py-1"
                onClick={() =>
                  setCurrent((prev) =>
                    prev === 0 ? images.length - 1 : prev - 1
                  )
                }
              >
                이전
              </button>
              <span className="text-xs text-zinc-500">
                {current + 1} / {images.length}
              </span>
              <button
                className="rounded border px-3 py-1"
                onClick={() => setCurrent((prev) => (prev + 1) % images.length)}
              >
                다음
              </button>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.2em] text-zinc-400">
              {post.category ?? "카테고리 없음"}
            </div>
            <h1 className="text-2xl font-semibold">{post.title}</h1>
            <div className="text-3xl font-semibold">{priceLabel}</div>
            <div className="text-sm text-zinc-500">
              {post.region_name ?? post.region_code} · 수량{" "}
              {post.quantity ?? "미정"}
            </div>
            <div
              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${statusOption.className}`}
            >
              {statusOption.label}
            </div>
          </div>

          <div className="rounded-2xl border p-4 text-sm leading-6 text-zinc-700">
            {desc}
          </div>

          <div className="rounded-2xl border p-4 text-sm">
            <div className="text-xs uppercase tracking-[0.2em] text-zinc-400">
              판매자 정보
            </div>
            <div className="mt-2 space-y-1 text-zinc-700">
              <div>닉네임: {seller?.nickname ?? "미설정"}</div>
              <div>
                지역: {seller?.region_name ?? seller?.region_code ?? "미설정"}
              </div>
            </div>
          </div>

          {isSeller && (
            <div className="space-y-3 rounded-2xl border p-4">
              <div className="flex items-center gap-2 text-sm text-zinc-600">
                <span>상태 변경</span>
                <select
                  className="rounded border px-2 py-1 text-zinc-700"
                  value={currentStatus}
                  onChange={(e) => handleStatusChange(e.target.value)}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option
                      key={option.value}
                      value={option.value}
                      className={option.className}
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              {showSoldPicker && (
                <div className="rounded border p-3 text-sm">
                  <p className="mb-2 text-zinc-600">
                    거래 완료 상대를 선택하세요.
                  </p>
                  {buyerRooms.length === 0 ? (
                    <p className="text-zinc-500">
                      구매자 채팅이 없어 선택할 수 없습니다.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {buyerRooms.map((room) => {
                        const buyerName =
                          (room.buyer_id && buyersById[room.buyer_id]) ||
                          "구매자";
                        return (
                          <label
                            key={room.id}
                            className="flex items-center gap-2"
                          >
                            <input
                              type="radio"
                              name="sold-room"
                              value={room.id}
                              checked={selectedSoldRoomId === room.id}
                              onChange={() => setSelectedSoldRoomId(room.id)}
                            />
                            <span>{buyerName}</span>
                          </label>
                        );
                      })}
                      <button
                        type="button"
                        className="rounded bg-zinc-900 px-3 py-2 text-white"
                        onClick={handleConfirmSold}
                      >
                        거래 완료 확정
                      </button>
                      {soldMessage && (
                        <p className="text-sm text-zinc-600">{soldMessage}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div className="flex gap-2">
                <button className="rounded border px-4 py-2">편집(선택)</button>
                <button
                  onClick={handleDelete}
                  className="rounded bg-red-600 px-4 py-2 text-white"
                >
                  삭제
                </button>
              </div>
            </div>
          )}

          {!isSeller && (
            <div className="space-y-3">
              <button
                onClick={handleChat}
                className="w-full rounded bg-zinc-900 px-4 py-3 text-white cursor-pointer"
              >
                판매자에게 채팅하기
              </button>
              {post.status === "sold" && isSoldBuyer && !hasReviewed && (
                <form onSubmit={handleReviewSubmit} className="space-y-2">
                  <h2 className="font-medium">리뷰 작성</h2>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-zinc-600" htmlFor="rating">
                      평점
                    </label>
                    <input
                      id="rating"
                      type="number"
                      min={1}
                      max={5}
                      className="w-20 rounded border px-2 py-1"
                      value={rating}
                      onChange={(e) => setRating(Number(e.target.value))}
                    />
                  </div>
                  <textarea
                    className="w-full rounded border px-3 py-2"
                    placeholder="리뷰 내용을 입력하세요"
                    rows={4}
                    value={reviewContent}
                    onChange={(e) => setReviewContent(e.target.value)}
                  />
                  <button
                    type="submit"
                    className="rounded bg-zinc-900 px-4 py-2 text-white cursor-pointer"
                  >
                    리뷰 등록
                  </button>
                  {reviewMessage && (
                    <p className="text-sm text-zinc-600">{reviewMessage}</p>
                  )}
                </form>
              )}
              {post.status === "sold" && isSoldBuyer && hasReviewed && (
                <p className="text-sm text-zinc-600">
                  이미 리뷰를 작성했습니다.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
