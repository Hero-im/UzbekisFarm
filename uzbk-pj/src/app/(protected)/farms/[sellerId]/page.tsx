"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import Loading from "@/components/Loading";
import FarmMap, { FarmMarker } from "@/components/FarmMap";

type FarmProfile = {
  farm_name: string | null;
  owner_name: string | null;
  phone: string | null;
  address: string | null;
  address_detail: string | null;
  latitude: number | null;
  longitude: number | null;
};

type Post = {
  id: string;
  title: string;
  content: string;
  price: number | null;
  category: string | null;
  created_at: string;
  status: string | null;
  thumbnail: string | null;
};

const CATEGORY_STYLES: Record<string, string> = {
  채소: "bg-green-50 text-green-700",
  과일: "bg-orange-50 text-orange-700",
  곡물: "bg-amber-50 text-amber-700",
  기타: "bg-zinc-100 text-zinc-700",
};

const SECTION_LIMIT = 5;

export default function FarmDetailPage() {
  const { session } = useAuth();
  const params = useParams();
  const sellerId = params?.sellerId as string;
  const [loading, setLoading] = useState(true);
  const [farm, setFarm] = useState<FarmProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [ratingAvg, setRatingAvg] = useState<number | null>(null);
  const [ratingCount, setRatingCount] = useState(0);
  const [postOffset, setPostOffset] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredPosts = useMemo(() => {
    if (!normalizedSearch) return posts;
    return posts.filter((post) => {
      const haystack = [post.title, post.content, post.category]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [posts, normalizedSearch]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredPosts.length / SECTION_LIMIT));
  }, [filteredPosts.length]);
  const currentPage = Math.min(
    totalPages - 1,
    Math.floor(postOffset / SECTION_LIMIT)
  );
  const maxOffset = Math.max((totalPages - 1) * SECTION_LIMIT, 0);
  const visiblePosts = filteredPosts.slice(
    postOffset,
    postOffset + SECTION_LIMIT
  );

  useEffect(() => {
    setPostOffset(0);
  }, [normalizedSearch]);

  useEffect(() => {
    if (postOffset > maxOffset) {
      setPostOffset(maxOffset);
    }
  }, [maxOffset, postOffset]);

  const mapCenter =
    farm?.latitude != null && farm?.longitude != null
      ? { lat: Number(farm.latitude), lng: Number(farm.longitude) }
      : null;

  const mapMarkers: FarmMarker[] = useMemo(() => {
    if (!farm || !mapCenter) return [];
    return [
      {
        id: sellerId,
        name: farm.farm_name ?? "농장",
        address: farm.address,
        lat: mapCenter.lat,
        lng: mapCenter.lng,
        ratingAvg: ratingAvg ?? null,
        ratingCount,
      },
    ];
  }, [farm, mapCenter, ratingAvg, ratingCount, sellerId]);

  useEffect(() => {
    let cancelled = false;

    const loadFarm = async () => {
      if (!session || !sellerId) return;
      const { data: farmData } = await supabase
        .from("seller_verifications")
        .select(
          "farm_name,owner_name,phone,address,address_detail,latitude,longitude"
        )
        .eq("user_id", sellerId)
        .eq("status", "approved")
        .maybeSingle();
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", sellerId)
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

      const postIds = (postData ?? []).map((post) => post.id);
      let thumbnails: Record<string, string> = {};
      if (postIds.length > 0) {
        const { data: imageData } = await supabase
          .from("post_images")
          .select("post_id,storage_path,sort_order")
          .in("post_id", postIds)
          .order("sort_order", { ascending: true });
        (imageData ?? []).forEach((img) => {
          if (thumbnails[img.post_id]) return;
          const { data } = supabase.storage
            .from("post-images")
            .getPublicUrl(img.storage_path);
          thumbnails[img.post_id] = data.publicUrl;
        });
      }
      const enrichedPosts = (postData ?? []).map((post) => ({
        ...post,
        thumbnail: thumbnails[post.id] ?? null,
      }));
      setPosts(enrichedPosts);

      const ratings = (reviewData ?? []).map((r) => r.rating);
      if (ratings.length > 0) {
        const sum = ratings.reduce((acc, value) => acc + value, 0);
        setRatingAvg(Number((sum / ratings.length).toFixed(1)));
        setRatingCount(ratings.length);
      } else {
        setRatingAvg(null);
        setRatingCount(0);
      }
      const resolvedProfileImage =
        (profileData as Record<string, any> | null)?.avatar_url ??
        (profileData as Record<string, any> | null)?.profile_image_url ??
        (profileData as Record<string, any> | null)?.image_url ??
        null;
      setProfileImageUrl(resolvedProfileImage);
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

  const profileInitial = (farm.farm_name ?? "농장").trim().slice(0, 1);
  const isSearching = normalizedSearch.length > 0;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="rounded-2xl border p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
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
          <div className="flex shrink-0 justify-end sm:justify-start">
            {profileImageUrl ? (
              <img
                src={profileImageUrl}
                alt={`${farm.farm_name ?? "농장"} 프로필`}
                className="h-20 w-20 rounded-full border border-zinc-200 object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 text-sm font-semibold text-zinc-500">
                {profileInitial || "?"}
              </div>
            )}
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold">판매 상품</h2>
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="상품 검색"
              className="w-full rounded-full border border-zinc-200 bg-white px-4 py-2 pr-10 text-sm text-zinc-700 placeholder:text-zinc-400"
            />
            <button
              type="button"
              onClick={() => setPostOffset(0)}
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full p-2 text-zinc-500 transition hover:bg-zinc-100"
              aria-label="상품 검색"
            >
              <svg
                width="16"
                height="16"
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
            </button>
          </div>
        </div>
        {filteredPosts.length === 0 ? (
          <div className="relative">
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
              <div className="invisible rounded-2xl border bg-white p-3">
                <div className="aspect-square w-full rounded-xl" />
                <div className="mt-3 min-h-[88px]" />
              </div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl border px-6 text-center text-sm text-zinc-600">
              {isSearching ? "상품 검색 결과가 없습니다." : "등록된 상품이 없습니다."}
            </div>
          </div>
        ) : (
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                if (postOffset <= 0) return;
                setPostOffset((prev) => Math.max(prev - SECTION_LIMIT, 0));
              }}
              className={`pointer-events-auto absolute -left-14 top-1/2 z-10 -translate-y-1/2 rounded-full border border-zinc-300 bg-white/95 px-3 py-2 text-zinc-700 shadow-md transition hover:border-zinc-900 ${
                postOffset <= 0 ? "opacity-40" : ""
              }`}
              aria-label="이전"
              disabled={postOffset <= 0}
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
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => {
                if (postOffset >= maxOffset) return;
                setPostOffset((prev) =>
                  Math.min(prev + SECTION_LIMIT, maxOffset)
                );
              }}
              className={`pointer-events-auto absolute -right-14 top-1/2 z-10 -translate-y-1/2 rounded-full border border-zinc-300 bg-white/95 px-3 py-2 text-zinc-700 shadow-md transition hover:border-zinc-900 ${
                postOffset >= maxOffset ? "opacity-40" : ""
              }`}
              aria-label="다음"
              disabled={postOffset >= maxOffset}
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
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
            <div className="absolute -bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
              {Array.from({ length: totalPages }).map((_, index) => (
                <span
                  key={`farm-dot-${index}`}
                  className={
                    index === currentPage
                      ? "h-1 w-6 rounded-full bg-zinc-900"
                      : "h-1 w-2 rounded-full bg-zinc-300"
                  }
                />
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
              {visiblePosts.map((post) => {
                const safeStatus = post.status ?? "ON_SALE";
                const statusLabel =
                  safeStatus === "COMPLETED"
                    ? "판매종료"
                    : safeStatus === "RESERVED"
                    ? "예약중"
                    : "판매중";
                const statusClass =
                  safeStatus === "COMPLETED"
                    ? "bg-red-600/90 text-white"
                    : safeStatus === "RESERVED"
                    ? "bg-green-600/90 text-white"
                    : "bg-blue-600/90 text-white";
                const priceLabel =
                  post.price != null
                    ? `${post.price.toLocaleString("ko-KR")}원`
                    : "가격 미정";
                const categoryLabel = post.category ?? "카테고리 없음";
                const categoryClass =
                  CATEGORY_STYLES[categoryLabel] ?? CATEGORY_STYLES["기타"];

                return (
                  <div
                    key={post.id}
                    className="group rounded-2xl border bg-white p-3 transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-sm"
                  >
                    <Link href={`/posts/${post.id}`} className="block">
                      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-zinc-100">
                        {post.thumbnail ? (
                          <img
                            src={post.thumbnail}
                            alt={post.title}
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">
                            이미지 없음
                          </div>
                        )}
                        <div className="absolute bottom-2 right-2 flex items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusClass}`}
                          >
                            {statusLabel}
                          </span>
                        </div>
                      </div>
                      <div className="mt-3 min-h-[88px] space-y-1">
                        <h2 className="line-clamp-1 text-sm font-semibold">
                          {post.title}
                        </h2>
                        <div className="text-lg font-bold text-lime-700">
                          {priceLabel}
                        </div>
                        <div className="text-xs text-zinc-500">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${categoryClass}`}
                          >
                            {categoryLabel}
                          </span>
                        </div>
                      </div>
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">농장 위치</h2>
        {mapCenter ? (
          <div className="rounded-2xl border p-4">
            <div className="h-[320px] w-full">
              <FarmMap
                center={mapCenter}
                farms={mapMarkers}
                zoom={13}
                popupMode="location"
              />
            </div>
            <p className="mt-3 text-xs text-zinc-500">
              지도는 농장 인증 주소 기준으로 표시됩니다.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border p-6 text-sm text-zinc-600">
            농장 위치 정보가 없습니다.
          </div>
        )}
      </section>
    </div>
  );
}
