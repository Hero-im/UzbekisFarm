"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import Loading from "@/components/Loading";

type Order = {
  id: string;
  post_id: string;
  seller_id: string;
  quantity: number;
  unit_price: number | null;
  total_price: number | null;
  status: string;
  created_at: string;
};

type PostSummary = {
  id: string;
  title: string | null;
  price: number | null;
};

const STATUS_LABELS: Record<string, string> = {
  PAYMENT_COMPLETED: "결제 완료",
  SHIPPING: "배송 중",
  DELIVERED: "배송 완료",
  CONFIRMED: "구매 확정",
};

export default function OrderHistoryPage() {
  const { session } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [posts, setPosts] = useState<Record<string, PostSummary>>({});
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [reviewedPosts, setReviewedPosts] = useState<Record<string, boolean>>(
    {}
  );
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [reviewTarget, setReviewTarget] = useState<Order | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewContent, setReviewContent] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!session) return;
      setLoading(true);
      setMessage("");

      const { data: orderData, error } = await supabase
        .from("orders")
        .select(
          "id,post_id,seller_id,quantity,unit_price,total_price,status,created_at"
        )
        .eq("buyer_id", session.user.id)
        .order("created_at", { ascending: false });

      if (cancelled) return;
      if (error) {
        setMessage(error.message);
        setLoading(false);
        return;
      }

      const orderList = (orderData ?? []) as Order[];
      setOrders(orderList);

      const postIds = Array.from(
        new Set(orderList.map((order) => order.post_id))
      );

      if (postIds.length > 0) {
        const { data: postData } = await supabase
          .from("posts")
          .select("id,title,price")
          .in("id", postIds);

        const nextPosts: Record<string, PostSummary> = {};
        (postData ?? []).forEach((post) => {
          nextPosts[post.id] = post as PostSummary;
        });
        setPosts(nextPosts);

        const { data: imageData } = await supabase
          .from("post_images")
          .select("post_id,storage_path,sort_order")
          .in("post_id", postIds)
          .order("sort_order", { ascending: true });

        const nextThumbs: Record<string, string> = {};
        (imageData ?? []).forEach((img) => {
          if (nextThumbs[img.post_id]) return;
          const { data: publicData } = supabase.storage
            .from("post-images")
            .getPublicUrl(img.storage_path);
          nextThumbs[img.post_id] = publicData.publicUrl;
        });
        setThumbnails(nextThumbs);

        const { data: reviewData } = await supabase
          .from("reviews")
          .select("post_id")
          .eq("reviewer_id", session.user.id)
          .in("post_id", postIds);

        const nextReviewed: Record<string, boolean> = {};
        (reviewData ?? []).forEach((review) => {
          nextReviewed[review.post_id] = true;
        });
        setReviewedPosts(nextReviewed);
      } else {
        setPosts({});
        setThumbnails({});
        setReviewedPosts({});
      }

      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const handleConfirm = async (order: Order) => {
    if (!session) return;
    const { data, error } = await supabase
      .from("orders")
      .update({ status: "CONFIRMED" })
      .eq("id", order.id)
      .select("id,status")
      .single();

    if (error || !data) {
      setMessage(error?.message ?? "구매 확정에 실패했습니다.");
      return;
    }

    setOrders((prev) =>
      prev.map((item) =>
        item.id === order.id ? { ...item, status: "CONFIRMED" } : item
      )
    );
    setReviewTarget(order);
    setReviewRating(5);
    setReviewContent("");
    setReviewError("");
  };

  const handleReviewSubmit = async () => {
    if (!session || !reviewTarget) return;
    const trimmed = reviewContent.trim();
    if (!trimmed) {
      setReviewError("리뷰 내용을 입력하세요.");
      return;
    }

    setReviewSubmitting(true);
    setReviewError("");

    const { error } = await supabase.from("reviews").insert({
      reviewer_id: session.user.id,
      reviewee_id: reviewTarget.seller_id,
      post_id: reviewTarget.post_id,
      rating: reviewRating,
      content: trimmed,
    });

    if (error) {
      setReviewError(error.message);
      setReviewSubmitting(false);
      return;
    }

    setReviewedPosts((prev) => ({
      ...prev,
      [reviewTarget.post_id]: true,
    }));
    setReviewSubmitting(false);
    setReviewTarget(null);
  };

  const orderRows = useMemo(() => {
    return orders.map((order) => {
      const post = posts[order.post_id];
      const title = post?.title ?? "상품";
      const priceLabel =
        order.total_price != null
          ? `${order.total_price.toLocaleString("ko-KR")}원`
          : post?.price != null
          ? `${post.price.toLocaleString("ko-KR")}원`
          : "가격 미정";
      const statusLabel = STATUS_LABELS[order.status] ?? order.status;
      const thumbnail = thumbnails[order.post_id];
      const reviewed = reviewedPosts[order.post_id];

      return {
        ...order,
        title,
        priceLabel,
        statusLabel,
        thumbnail,
        reviewed,
      };
    });
  }, [orders, posts, thumbnails, reviewedPosts]);

  if (!session) return <p>로그인이 필요합니다.</p>;
  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">주문 내역</h1>
        <p className="text-sm text-zinc-500">
          결제 완료 이후의 주문 진행 상태를 확인할 수 있습니다.
        </p>
      </div>

      {message && <p className="text-sm text-red-600">{message}</p>}

      {orderRows.length === 0 ? (
        <div className="rounded-2xl border p-6 text-sm text-zinc-600">
          주문 내역이 없습니다.
        </div>
      ) : (
        <div className="space-y-4">
          {orderRows.map((order) => (
            <div
              key={order.id}
              className="flex flex-col gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex gap-4">
                <div className="h-20 w-20 overflow-hidden rounded-xl border bg-zinc-100">
                  {order.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={order.thumbnail}
                      alt={order.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">
                      이미지 없음
                    </div>
                  )}
                </div>
                <div className="space-y-1 text-sm">
                  <Link
                    href={`/posts/${order.post_id}`}
                    className="font-semibold text-zinc-900 hover:underline"
                  >
                    {order.title}
                  </Link>
                  <div className="text-zinc-500">
                    수량 {order.quantity} · {order.priceLabel}
                  </div>
                  <div className="text-xs text-zinc-400">
                    주문번호: {order.id}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-700">
                  {order.statusLabel}
                </span>
                {order.status === "DELIVERED" && (
                  <button
                    type="button"
                    className="rounded bg-lime-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-lime-500"
                    onClick={() => handleConfirm(order)}
                  >
                    수취 확인
                  </button>
                )}
                {order.status === "CONFIRMED" && !order.reviewed && (
                  <button
                    type="button"
                    className="rounded border border-zinc-300 px-3 py-2 text-xs text-zinc-700 hover:border-zinc-900"
                    onClick={() => {
                      setReviewTarget(order);
                      setReviewRating(5);
                      setReviewContent("");
                      setReviewError("");
                    }}
                  >
                    리뷰 작성
                  </button>
                )}
                {order.status === "CONFIRMED" && order.reviewed && (
                  <span className="text-xs text-zinc-500">
                    리뷰 작성 완료
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {reviewTarget && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">리뷰 작성</h2>
              <button
                type="button"
                className="text-sm text-zinc-500 hover:text-zinc-700"
                onClick={() => setReviewTarget(null)}
              >
                닫기
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
                {posts[reviewTarget.post_id]?.title ?? "상품"}
              </div>
              <label className="space-y-1">
                <span className="text-zinc-600">평점 (1~5)</span>
                <input
                  type="number"
                  min={1}
                  max={5}
                  className="w-full rounded border border-zinc-300 px-3 py-2"
                  value={reviewRating}
                  onChange={(e) => setReviewRating(Number(e.target.value))}
                />
              </label>
              <label className="space-y-1">
                <span className="text-zinc-600">리뷰 내용</span>
                <textarea
                  className="w-full rounded border border-zinc-300 px-3 py-2"
                  rows={4}
                  placeholder="상품에 대한 솔직한 후기를 남겨주세요."
                  value={reviewContent}
                  onChange={(e) => setReviewContent(e.target.value)}
                />
              </label>
              {reviewError && (
                <p className="text-sm text-red-600">{reviewError}</p>
              )}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded border border-zinc-300 px-4 py-2 text-sm"
                onClick={() => setReviewTarget(null)}
                disabled={reviewSubmitting}
              >
                취소
              </button>
              <button
                type="button"
                className="rounded bg-zinc-900 px-4 py-2 text-sm text-white"
                onClick={handleReviewSubmit}
                disabled={reviewSubmitting}
              >
                {reviewSubmitting ? "등록 중..." : "리뷰 등록"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
