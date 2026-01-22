"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import Loading from "@/components/Loading";
import FarmMap, { FarmMarker } from "@/components/FarmMap";

type Post = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  region_code: string | null;
  region_name: string | null;
  price: number | null;
  category: string | null;
  harvest_date: string | null;
  created_at: string;
  status: string | null;
  stock_quantity: number | null;
};

const CATEGORIES = ["전체", "채소", "과일", "곡물", "기타"];
const DEFAULT_CENTER = { lat: 37.5665, lng: 126.978 };
const NEARBY_RADIUS_KM = 25;
const SECTION_LIMIT = 3;
const SECTION_EXPANDED = 9;
const CATEGORY_STYLES: Record<string, string> = {
  채소: "bg-green-50 text-green-700",
  과일: "bg-orange-50 text-orange-700",
  곡물: "bg-amber-50 text-amber-700",
  기타: "bg-zinc-100 text-zinc-700",
};

const formatHarvestLabel = (value: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
};

export default function FeedPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { session } = useAuth();
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [localPosts, setLocalPosts] = useState<Post[]>([]);
  const [profileAddress, setProfileAddress] = useState<string | null>(null);
  const [profileLocation, setProfileLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [geoError, setGeoError] = useState("");
  const [category, setCategory] = useState("전체");
  const [loading, setLoading] = useState(true);
  const [showSold, setShowSold] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [nearbyFarms, setNearbyFarms] = useState<FarmMarker[]>([]);
  const [sellerInfo, setSellerInfo] = useState<
    Record<
      string,
      {
        farmName: string | null;
        address: string | null;
        ratingAvg: number | null;
        ratingCount: number;
        lat: number | null;
        lng: number | null;
      }
    >
  >({});
  const [isLocalExpanded, setIsLocalExpanded] = useState(false);
  const [isAllExpanded, setIsAllExpanded] = useState(false);
  const [localOffset, setLocalOffset] = useState(0);
  const [allOffset, setAllOffset] = useState(0);

  const mapCenter = useMemo(
    () => currentLocation ?? profileLocation ?? DEFAULT_CENTER,
    [currentLocation, profileLocation]
  );

  const scope = useMemo<"both" | "local" | "all">(() => {
    if (pathname?.includes("/feed/local")) return "local";
    if (pathname?.includes("/feed/all")) return "all";
    return "both";
  }, [pathname]);

  const formatShortAddress = (value?: string | null) => {
    if (!value) return "";
    if (value.includes(",")) {
      const parts = value
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
      return parts.slice(0, 2).join(", ");
    }
    const parts = value.split(" ").filter(Boolean);
    return parts.slice(0, 2).join(" ");
  };

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      if (!session) return;
      const { data } = await supabase
        .from("profiles")
        .select("address,latitude,longitude")
        .eq("id", session.user.id)
        .single();

      if (cancelled) return;
      setProfileAddress(data?.address ?? null);
      if (data?.latitude != null && data?.longitude != null) {
        setProfileLocation({
          lat: Number(data.latitude),
          lng: Number(data.longitude),
        });
      }
    };

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoError("브라우저에서 위치 정보를 지원하지 않습니다.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setGeoError("");
      },
      () => {
        setGeoError("위치 권한을 허용하면 현재 위치 지도를 표시할 수 있습니다.");
      }
    );
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadFarms = async () => {
      if (!session) return;
      const { data } = await supabase
        .from("seller_verifications")
        .select("user_id,farm_name,address,latitude,longitude")
        .eq("status", "approved")
        .not("latitude", "is", null)
        .not("longitude", "is", null);

      if (cancelled) return;

      const farms = (data ?? [])
        .map((row) => ({
          id: row.user_id,
          name: row.farm_name ?? "농장",
          address: row.address,
          lat: Number(row.latitude),
          lng: Number(row.longitude),
          detailUrl: `/farms/${row.user_id}`,
          ratingAvg: null as number | null,
          ratingCount: 0,
        }))
        .filter((farm) => !Number.isNaN(farm.lat) && !Number.isNaN(farm.lng));

      const farmIds = farms.map((farm) => farm.id);
      if (farmIds.length > 0) {
        const { data: reviewData } = await supabase
          .from("reviews")
          .select("reviewee_id,rating")
          .in("reviewee_id", farmIds);

        const ratingMap = new Map<
          string,
          { total: number; count: number }
        >();
        (reviewData ?? []).forEach((review) => {
          const entry = ratingMap.get(review.reviewee_id) ?? {
            total: 0,
            count: 0,
          };
          ratingMap.set(review.reviewee_id, {
            total: entry.total + review.rating,
            count: entry.count + 1,
          });
        });

        farms.forEach((farm) => {
          const entry = ratingMap.get(farm.id);
          if (entry) {
            farm.ratingAvg = Number((entry.total / entry.count).toFixed(1));
            farm.ratingCount = entry.count;
          } else {
            farm.ratingAvg = null;
            farm.ratingCount = 0;
          }
        });
      }

      const baseLocation = currentLocation ?? profileLocation;
      if (!baseLocation) {
        setNearbyFarms(farms);
        return;
      }

      const toRad = (value: number) => (value * Math.PI) / 180;
      const distanceKm = (
        a: typeof baseLocation,
        b: { lat: number; lng: number }
      ) => {
        const earthRadius = 6371;
        const dLat = toRad(b.lat - a.lat);
        const dLng = toRad(b.lng - a.lng);
        const lat1 = toRad(a.lat);
        const lat2 = toRad(b.lat);
        const h =
          Math.sin(dLat / 2) ** 2 +
          Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
        return 2 * earthRadius * Math.asin(Math.sqrt(h));
      };

      const filtered = farms.filter(
        (farm) => distanceKm(baseLocation, farm) <= NEARBY_RADIUS_KM
      );
      setNearbyFarms(filtered);
    };

    loadFarms();
    return () => {
      cancelled = true;
    };
  }, [session, profileLocation, currentLocation]);

  useEffect(() => {
    let cancelled = false;

    const loadPosts = async () => {
      const buildQuery = (includeHarvest: boolean) => {
        const selectFields = includeHarvest
          ? "id,user_id,title,content,region_code,region_name,price,category,harvest_date,created_at,status,stock_quantity"
          : "id,user_id,title,content,region_code,region_name,price,category,created_at,status,stock_quantity";
        let query = supabase
          .from("posts")
          .select(selectFields)
          .order("created_at", { ascending: false });

        query = query.or(
          showSold
            ? "status.is.null,status.eq.ON_SALE,status.eq.RESERVED,status.eq.COMPLETED"
            : "status.is.null,status.eq.ON_SALE,status.eq.RESERVED"
        );

        const trimmed = searchTerm.trim();
        if (trimmed) {
          query = query.or(
            `title.ilike.%${trimmed}%,content.ilike.%${trimmed}%`
          );
        }

        if (category !== "전체") {
          query = query.eq("category", category);
        }

        return query;
      };

      let data: Post[] | null = null;
      let errorMessage = "";
      const primary = await buildQuery(true);
      const { data: primaryData, error: primaryError } = await primary;
      if (primaryError) {
        errorMessage = primaryError.message;
        if (primaryError.message.includes("harvest_date")) {
          const fallback = await buildQuery(false);
          const { data: fallbackData, error: fallbackError } = await fallback;
          if (fallbackError) {
            errorMessage = fallbackError.message;
          } else {
            data = fallbackData as Post[] | null;
          }
        }
      } else {
        data = primaryData as Post[] | null;
      }

      if (cancelled) return;
      if (!data) {
        console.error("posts load error:", errorMessage);
        setAllPosts([]);
        setLocalPosts([]);
        setLoading(false);
        return;
      }
      setAllPosts(data ?? []);

      const sellerIds = Array.from(
        new Set((data ?? []).map((post) => post.user_id))
      );
      let info: Record<
        string,
        {
          farmName: string | null;
          address: string | null;
          ratingAvg: number | null;
          ratingCount: number;
          lat: number | null;
          lng: number | null;
        }
      > = {};

      if (sellerIds.length > 0) {
        const { data: sellerData } = await supabase
          .from("seller_verifications")
          .select("user_id,farm_name,address,latitude,longitude")
          .eq("status", "approved")
          .in("user_id", sellerIds);

        const { data: reviewData } = await supabase
          .from("reviews")
          .select("reviewee_id,rating")
          .in("reviewee_id", sellerIds);

        const ratingMap = new Map<
          string,
          { total: number; count: number }
        >();
        (reviewData ?? []).forEach((review) => {
          const entry = ratingMap.get(review.reviewee_id) ?? {
            total: 0,
            count: 0,
          };
          ratingMap.set(review.reviewee_id, {
            total: entry.total + review.rating,
            count: entry.count + 1,
          });
        });

        (sellerData ?? []).forEach((seller) => {
          const entry = ratingMap.get(seller.user_id);
          info[seller.user_id] = {
            farmName: seller.farm_name ?? null,
            address: seller.address ?? null,
            ratingAvg: entry
              ? Number((entry.total / entry.count).toFixed(1))
              : null,
            ratingCount: entry ? entry.count : 0,
            lat: seller.latitude != null ? Number(seller.latitude) : null,
            lng: seller.longitude != null ? Number(seller.longitude) : null,
          };
        });
      }
      setSellerInfo(info);

      const postIds = (data ?? []).map((post) => post.id);
      if (postIds.length > 0) {
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
      } else {
        setThumbnails({});
      }

      if (profileLocation) {
        const toRad = (value: number) => (value * Math.PI) / 180;
        const distanceKm = (
          a: typeof profileLocation,
          b: { lat: number; lng: number }
        ) => {
          const earthRadius = 6371;
          const dLat = toRad(b.lat - a.lat);
          const dLng = toRad(b.lng - a.lng);
          const lat1 = toRad(a.lat);
          const lat2 = toRad(b.lat);
          const h =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
          return 2 * earthRadius * Math.asin(Math.sqrt(h));
        };
        const local = (data ?? []).filter((post) => {
          const seller = info[post.user_id];
          if (!seller?.lat || !seller?.lng) return false;
          return (
            distanceKm(profileLocation, {
              lat: seller.lat,
              lng: seller.lng,
            }) <= NEARBY_RADIUS_KM
          );
        });
        setLocalPosts(local);
      } else {
        setLocalPosts([]);
      }

      setLoading(false);
    };

    loadPosts();
    return () => {
      cancelled = true;
    };
  }, [category, showSold, searchTerm, profileLocation]);

  if (!session) return <p>로그인이 필요합니다.</p>;
  if (loading) return <Loading />;

  const localLimit = scope === "both"
    ? (isLocalExpanded ? SECTION_EXPANDED : SECTION_LIMIT)
    : localPosts.length;
  const allLimit = scope === "both"
    ? (isAllExpanded ? SECTION_EXPANDED : SECTION_LIMIT)
    : allPosts.length;

  const visibleLocalPosts = localPosts.slice(localOffset, localOffset + localLimit);
  const visibleAllPosts = allPosts.slice(allOffset, allOffset + allLimit);

  const localTotalPages = Math.max(
    1,
    Math.ceil(localPosts.length / Math.max(localLimit, 1))
  );
  const localCurrentPage = Math.min(
    localTotalPages - 1,
    Math.floor(localOffset / Math.max(localLimit, 1))
  );
  const localMaxOffset = Math.max(
    (localTotalPages - 1) * localLimit,
    0
  );
  const allTotalPages = Math.max(
    1,
    Math.ceil(allPosts.length / Math.max(allLimit, 1))
  );
  const allCurrentPage = Math.min(
    allTotalPages - 1,
    Math.floor(allOffset / Math.max(allLimit, 1))
  );
  const allMaxOffset = Math.max((allTotalPages - 1) * allLimit, 0);

  const handleLocalToggle = () => {
    setIsLocalExpanded((prev) => !prev);
    setLocalOffset(0);
  };

  const handleAllToggle = () => {
    setIsAllExpanded((prev) => !prev);
    setAllOffset(0);
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-72px)] w-full max-w-[1800px] flex-col gap-6 px-8 pb-16">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">오늘의 농장 상품</h1>
          <p className="text-sm text-zinc-500">
            현재 동네: {profileAddress ?? "미설정"}
          </p>
          {!profileLocation && (
            <p className="text-sm text-amber-600">
              동네 설정이 필요합니다. 마이페이지에서 주소를 등록해주세요.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            className="w-full max-w-md rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-200"
            placeholder="검색어를 입력하세요 (작물, 제목)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <label className="flex items-center gap-2 text-sm text-zinc-600">
            <input
              type="checkbox"
              checked={showSold}
              onChange={(e) => setShowSold(e.target.checked)}
            />
            판매종료 포함
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-full border border-zinc-300 px-4 py-2 text-sm shadow-sm ${
                category === c
                  ? "bg-zinc-900 text-white"
                  : "bg-white text-zinc-800 hover:bg-zinc-50"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-12 grid-cols-[minmax(0,1fr)_400px]">
        <section className="min-h-0 space-y-10">
          {(scope === "both" || scope === "local") && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">동네 농장 상품</h2>
                {scope === "both" && (
                  <button
                    type="button"
                    onClick={handleLocalToggle}
                    className="rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-sm font-semibold text-zinc-800 shadow-sm hover:border-zinc-900"
                    aria-label="동네 농장 상품 더보기"
                  >
                    {isLocalExpanded ? "-" : "+"}
                  </button>
                )}
              </div>
              {!profileLocation ? (
                <div className="rounded-2xl border p-6 text-sm text-zinc-600">
                  동네 주소를 등록하면 주변 농장 상품이 표시됩니다.
                </div>
              ) : localPosts.length === 0 ? (
                <div className="rounded-2xl border p-6 text-sm text-zinc-600">
                  동네 근처에 게시글이 없어요
                </div>
              ) : (
                <div className="relative overflow-visible">
                  <button
                    type="button"
                    onClick={() => {
                      if (localOffset === 0) return;
                      setLocalOffset((prev) => Math.max(prev - localLimit, 0));
                    }}
                    className="pointer-events-auto absolute -left-14 top-1/2 z-10 -translate-y-1/2 rounded-full border border-zinc-300 bg-white/95 px-3 py-2 text-zinc-700 shadow-md transition hover:border-zinc-900"
                    aria-label="이전"
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
                      if (localOffset >= localMaxOffset) return;
                      setLocalOffset((prev) =>
                        Math.min(prev + localLimit, localMaxOffset)
                      );
                    }}
                    className="pointer-events-auto absolute -right-14 top-1/2 z-10 -translate-y-1/2 rounded-full border border-zinc-300 bg-white/95 px-3 py-2 text-zinc-700 shadow-md transition hover:border-zinc-900"
                    aria-label="다음"
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
                    {Array.from({ length: localTotalPages }).map((_, index) => (
                      <span
                        key={`local-dot-${index}`}
                        className={
                          index === localCurrentPage
                            ? "h-1 w-6 rounded-full bg-zinc-900"
                            : "h-1 w-2 rounded-full bg-zinc-300"
                        }
                      />
                    ))}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {visibleLocalPosts.map((post) => {
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
                      const thumb = thumbnails[post.id];
                      const harvestLabel = formatHarvestLabel(post.harvest_date);
                      const categoryLabel = post.category ?? "카테고리 없음";
                      const categoryClass =
                        CATEGORY_STYLES[categoryLabel] ?? CATEGORY_STYLES["기타"];
                      const farmName = sellerInfo[post.user_id]?.farmName;
                      const farmAddress = formatShortAddress(
                        sellerInfo[post.user_id]?.address
                      );
                      const ratingAvg = sellerInfo[post.user_id]?.ratingAvg;
                      const ratingCount =
                        sellerInfo[post.user_id]?.ratingCount ?? 0;
                      const isSoldOut =
                        (post.stock_quantity ?? 0) <= 0 &&
                        post.stock_quantity !== null;

                      return (
                        <div
                          key={post.id}
                          className="group rounded-2xl border bg-white p-3 transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-sm"
                        >
                          <Link href={`/posts/${post.id}`} className="block">
                            <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-zinc-100">
                              {thumb ? (
                                <img
                                  src={thumb}
                                  alt={post.title}
                                  className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">
                                  이미지 없음
                                </div>
                              )}
                              <div className="absolute bottom-2 right-2 flex items-center gap-2">
                                {isSoldOut && (
                                  <span className="rounded-full bg-red-600/90 px-2 py-0.5 text-[11px] font-semibold text-white">
                                    SOLD OUT
                                  </span>
                                )}
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
                              <div className="flex items-center justify-between">
                                <div className="max-w-[120px] truncate text-lg font-bold text-lime-700">
                                  {priceLabel}
                                </div>
                                <div className="text-[11px] text-zinc-600">
                                  <span className="text-amber-500">★</span>{" "}
                                  {ratingAvg != null
                                    ? `${ratingAvg} (${ratingCount})`
                                    : "리뷰 없음"}
                                </div>
                              </div>
                              <div className="text-xs text-zinc-500">
                                <span
                                  className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${categoryClass}`}
                                >
                                  {categoryLabel}
                                </span>
                                {harvestLabel && (
                                  <span className="ml-2 text-[11px] font-semibold text-purple-600">
                                    수확일 {harvestLabel}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-zinc-500 line-clamp-1">
                                {post.content ?? "상품 설명이 없습니다."}
                              </div>
                            </div>
                          </Link>
                          <div className="mt-2 space-y-0.5 text-[11px] text-zinc-600">
                            {farmName ? (
                              <div className="flex items-center justify-between gap-2">
                                <button
                                  type="button"
                                  className="inline-flex max-w-[140px] items-center truncate rounded-full border border-zinc-200 px-2.5 py-1 text-xs font-semibold text-zinc-900 hover:border-zinc-900"
                                  onClick={() =>
                                    router.push(`/farms/${post.user_id}`)
                                  }
                                  title={farmName}
                                >
                                  {farmName}
                                </button>
                                {farmAddress && (
                                  <div className="max-w-[160px] truncate text-right text-xs text-zinc-500">
                                    {farmAddress}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span>농장 정보 없음</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {(scope === "both" || scope === "all") && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">전체 농장 상품</h2>
                {scope === "both" && (
                  <button
                    type="button"
                    onClick={handleAllToggle}
                    className="rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-sm font-semibold text-zinc-800 shadow-sm hover:border-zinc-900"
                    aria-label="전체 농장 상품 더보기"
                  >
                    {isAllExpanded ? "-" : "+"}
                  </button>
                )}
              </div>
              {allPosts.length === 0 ? (
                <div className="rounded-2xl border p-6 text-sm text-zinc-600">
                  등록된 게시글이 없어요
                </div>
              ) : (
                <div className="relative overflow-visible">
                  <button
                    type="button"
                    onClick={() => {
                      if (allOffset === 0) return;
                      setAllOffset((prev) => Math.max(prev - allLimit, 0));
                    }}
                    className="pointer-events-auto absolute -left-14 top-1/2 z-10 -translate-y-1/2 rounded-full border border-zinc-300 bg-white/95 px-3 py-2 text-zinc-700 shadow-md transition hover:border-zinc-900"
                    aria-label="이전"
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
                      if (allOffset >= allMaxOffset) return;
                      setAllOffset((prev) =>
                        Math.min(prev + allLimit, allMaxOffset)
                      );
                    }}
                    className="pointer-events-auto absolute -right-14 top-1/2 z-10 -translate-y-1/2 rounded-full border border-zinc-300 bg-white/95 px-3 py-2 text-zinc-700 shadow-md transition hover:border-zinc-900"
                    aria-label="다음"
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
                    {Array.from({ length: allTotalPages }).map((_, index) => (
                      <span
                        key={`all-dot-${index}`}
                        className={
                          index === allCurrentPage
                            ? "h-1 w-6 rounded-full bg-zinc-900"
                            : "h-1 w-2 rounded-full bg-zinc-300"
                        }
                      />
                    ))}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {visibleAllPosts.map((post) => {
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
                      const thumb = thumbnails[post.id];
                      const harvestLabel = formatHarvestLabel(post.harvest_date);
                      const categoryLabel = post.category ?? "카테고리 없음";
                      const categoryClass =
                        CATEGORY_STYLES[categoryLabel] ?? CATEGORY_STYLES["기타"];

                      const farmName = sellerInfo[post.user_id]?.farmName;
                      const farmAddress = formatShortAddress(
                        sellerInfo[post.user_id]?.address
                      );
                      const ratingAvg = sellerInfo[post.user_id]?.ratingAvg;
                      const ratingCount =
                        sellerInfo[post.user_id]?.ratingCount ?? 0;
                      const isSoldOut =
                        (post.stock_quantity ?? 0) <= 0 &&
                        post.stock_quantity !== null;

                      return (
                        <div
                          key={post.id}
                          className="group rounded-2xl border bg-white p-3 transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-sm"
                        >
                          <Link href={`/posts/${post.id}`} className="block">
                            <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-zinc-100">
                              {thumb ? (
                                <img
                                  src={thumb}
                                  alt={post.title}
                                  className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">
                                  이미지 없음
                                </div>
                              )}
                              <div className="absolute bottom-2 right-2 flex items-center gap-2">
                                {isSoldOut && (
                                  <span className="rounded-full bg-red-600/90 px-2 py-0.5 text-[11px] font-semibold text-white">
                                    SOLD OUT
                                  </span>
                                )}
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
                              <div className="flex items-center justify-between">
                                <div className="max-w-[120px] truncate text-lg font-bold text-lime-700">
                                  {priceLabel}
                                </div>
                                <div className="text-[11px] text-zinc-600">
                                  <span className="text-amber-500">★</span>{" "}
                                  {ratingAvg != null
                                    ? `${ratingAvg} (${ratingCount})`
                                    : "리뷰 없음"}
                                </div>
                              </div>
                              <div className="text-xs text-zinc-500">
                                <span
                                  className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${categoryClass}`}
                                >
                                  {categoryLabel}
                                </span>
                                {harvestLabel && (
                                  <span className="ml-2 text-[11px] font-semibold text-purple-600">
                                    수확일 {harvestLabel}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-zinc-500 line-clamp-1">
                                {post.content ?? "상품 설명이 없습니다."}
                              </div>
                            </div>
                          </Link>
                          <div className="mt-2 space-y-0.5 text-[11px] text-zinc-600">
                            {farmName ? (
                              <div className="flex items-center justify-between gap-2">
                                <button
                                  type="button"
                                  className="inline-flex max-w-[140px] items-center truncate rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-900 shadow-sm hover:border-zinc-900"
                                  onClick={() =>
                                    router.push(`/farms/${post.user_id}`)
                                  }
                                  title={farmName}
                                >
                                  {farmName}
                                </button>
                                {farmAddress && (
                                  <div className="max-w-[160px] truncate text-right text-xs text-zinc-500">
                                    {farmAddress}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span>농장 정보 없음</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        <aside className="min-h-0 justify-self-end">
          <div className="sticky top-4 space-y-4">
            <div className="rounded-2xl border p-4">
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-zinc-400">
                <span>주변 농장</span>
                <span className="rounded-full border px-2 py-0.5 text-[10px] text-zinc-500">
                  {nearbyFarms.length}곳
                </span>
              </div>
              <div className="mt-3 h-[420px] rounded-xl border">
                <FarmMap
                  center={mapCenter}
                  farms={nearbyFarms}
                  radiusKm={NEARBY_RADIUS_KM}
                />
              </div>
              {geoError && (
                <p className="mt-2 text-xs text-amber-600">{geoError}</p>
              )}
            </div>
            <div className="rounded-2xl border p-4 text-sm text-zinc-600">
              현재 위치 기준으로 {NEARBY_RADIUS_KM}km 이내 농장을 표시합니다.
            </div>
          </div>
        </aside>
      </div>

      <footer className="mt-10 border-t border-zinc-200 pb-10 pt-8 text-sm text-zinc-600">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <div className="font-semibold text-zinc-800">Farm Store</div>
            <div>운영: Uzbekis Farm</div>
            <div>연락처: 000-0000-0000</div>
            <div>이메일: help@uzbekisfarm.com</div>
            <div>주소: Tashkent, Uzbekistan</div>
          </div>
          <div className="space-y-2">
            <div className="font-semibold text-zinc-800">Customer</div>
            <div>공지사항</div>
            <div>이용약관</div>
            <div>개인정보 처리방침</div>
          </div>
        </div>
        <div className="mt-6 text-xs text-zinc-500">
          This service provides a platform for farm-to-market listings.
        </div>
      </footer>
    </div>
  );
}
