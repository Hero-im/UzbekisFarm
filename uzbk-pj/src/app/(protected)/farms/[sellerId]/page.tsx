"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import Loading from "@/components/Loading";

type FarmProfile = {
  farm_name: string | null;
  owner_name: string | null;
  phone: string | null;
  address: string | null;
  address_detail: string | null;
};

type Post = {
  id: string;
  title: string;
  content: string;
  price: number | null;
  category: string | null;
  created_at: string;
  status: string | null;
};

export default function FarmDetailPage() {
  const { session } = useAuth();
  const params = useParams();
  const sellerId = params?.sellerId as string;
  const [loading, setLoading] = useState(true);
  const [farm, setFarm] = useState<FarmProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [ratingAvg, setRatingAvg] = useState<number | null>(null);
  const [ratingCount, setRatingCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const loadFarm = async () => {
      if (!session || !sellerId) return;
      const { data: farmData } = await supabase
        .from("seller_verifications")
        .select("farm_name,owner_name,phone,address,address_detail")
        .eq("user_id", sellerId)
        .eq("status", "approved")
        .maybeSingle();

      const { data: postData } = await supabase
        .from("posts")
        .select("id,title,content,price,category,created_at,status")
        .eq("user_id", sellerId)
        .order("created_at", { ascending: false });

      const { data: reviewData } = await supabase
        .from("reviews")
        .select("rating")
        .eq("reviewee_id", sellerId);

      if (cancelled) return;
      setFarm(farmData ?? null);
      setPosts(postData ?? []);
      const ratings = (reviewData ?? []).map((r) => r.rating);
      if (ratings.length > 0) {
        const sum = ratings.reduce((acc, value) => acc + value, 0);
        setRatingAvg(Number((sum / ratings.length).toFixed(1)));
        setRatingCount(ratings.length);
      } else {
        setRatingAvg(null);
        setRatingCount(0);
      }
      setLoading(false);
    };

    loadFarm();
    return () => {
      cancelled = true;
    };
  }, [session, sellerId]);

  if (!session) return <p>로그인이 필요합니다.</p>;
  if (loading) return <Loading />;
  if (!farm) {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-semibold">농장 정보가 없습니다.</h1>
        <Link href="/" className="text-sm text-blue-600 underline">
          메인으로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="rounded-2xl border p-5">
        <h1 className="text-2xl font-semibold">
          {farm.farm_name ?? "농장"}
        </h1>
        <div className="mt-3 inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-sm">
          <span className="text-amber-500">★</span>
          {ratingAvg != null ? (
            <>
              <span className="font-semibold text-zinc-900">{ratingAvg}</span>
              <span className="text-xs text-zinc-400">({ratingCount})</span>
            </>
          ) : (
            <span className="text-xs text-zinc-500">리뷰 없음</span>
          )}
        </div>
        <div className="mt-2 space-y-1 text-sm text-zinc-600">
          {farm.owner_name && <div>농장주: {farm.owner_name}</div>}
          {farm.phone && <div>연락처: {farm.phone}</div>}
          {farm.address && (
            <div>
              주소: {farm.address}
              {farm.address_detail ? ` (${farm.address_detail})` : ""}
            </div>
          )}
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">판매 상품</h2>
        {posts.length === 0 ? (
          <div className="rounded-2xl border p-6 text-sm text-zinc-600">
            등록된 상품이 없습니다.
          </div>
        ) : (
          <ul className="space-y-4">
            {posts.map((post) => {
              const safeStatus = post.status ?? "ON_SALE";
              const statusLabel =
                safeStatus === "COMPLETED"
                  ? "판매종료"
                  : safeStatus === "RESERVED"
                  ? "예약중"
                  : "판매중";
              const statusClass =
                safeStatus === "COMPLETED"
                  ? "text-red-600"
                  : safeStatus === "RESERVED"
                  ? "text-green-600"
                  : "text-blue-600";
              const priceLabel =
                post.price != null
                  ? `${post.price.toLocaleString("ko-KR")}원`
                  : "가격 미정";

              return (
                <li key={post.id}>
                  <Link
                    href={`/posts/${post.id}`}
                    className="flex flex-col gap-1 rounded-2xl border p-4 transition hover:border-zinc-300"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-semibold">{post.title}</h3>
                      <span className={`text-xs font-medium ${statusClass}`}>
                        {statusLabel}
                      </span>
                    </div>
                    <div className="text-sm text-zinc-600 line-clamp-2">
                      {post.content}
                    </div>
                    <div className="text-sm font-semibold">{priceLabel}</div>
                    <div className="text-xs text-zinc-500">
                      {post.category ?? "카테고리 없음"}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
