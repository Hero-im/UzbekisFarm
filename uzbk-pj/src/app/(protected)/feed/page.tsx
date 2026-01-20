"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import Loading from "@/components/Loading";

type Post = {
  id: string;
  title: string;
  content: string;
  region_code: string | null;
  region_name: string | null;
  price: number | null;
  category: string | null;
  created_at: string;
  status: string | null;
};

const CATEGORIES = ["전체", "채소", "과일", "곡물", "기타"];

export default function FeedPage() {
  const { session } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [regionCode, setRegionCode] = useState<string | null>(null);
  const [regionName, setRegionName] = useState<string | null>(null);
  const [category, setCategory] = useState("전체");
  const [loading, setLoading] = useState(true);
  const [showSold, setShowSold] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      if (!session) return;
      const { data } = await supabase
        .from("profiles")
        .select("region_code,region_name")
        .eq("id", session.user.id)
        .single();

      if (cancelled) return;
      setRegionCode(data?.region_code ?? null);
      setRegionName(data?.region_name ?? null);
    };

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    let cancelled = false;

    const loadPosts = async () => {
      if (!regionCode) return;

      let query = supabase
        .from("posts")
        .select(
          "id,title,content,region_code,region_name,price,category,created_at,status"
        )
        .eq("region_code", regionCode)
        .order("created_at", { ascending: false });

      query = query.or(
        showSold
          ? "status.is.null,status.eq.active,status.eq.reserved,status.eq.sold"
          : "status.is.null,status.eq.active,status.eq.reserved"
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

      const { data } = await query;

      if (cancelled) return;
      setPosts(data ?? []);

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

      setLoading(false);
    };

    loadPosts();
    return () => {
      cancelled = true;
    };
  }, [regionCode, category, showSold, searchTerm]);

  if (!session) return <p>로그인이 필요합니다.</p>;
  if (!regionCode) {
    return (
      <p>
        지역 설정이 필요합니다.{" "}
        <Link href="/onboarding" className="underline">
          /onboarding 이동
        </Link>
      </p>
    );
  }
  if (loading) return <Loading />;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">오늘의 농장 상품</h1>
          <p className="text-sm text-zinc-500">
            현재 지역: {regionName ?? regionCode}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            className="w-full max-w-md rounded-full border px-4 py-2 text-sm"
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
            거래완료 포함
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-full border px-4 py-2 text-sm ${
                category === c
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-700"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-3">
          {posts.length === 0 ? (
            <div className="rounded-2xl border p-6 text-sm text-zinc-600">
              이 지역에 게시글이 없어요
            </div>
          ) : (
            <ul className="space-y-4">
              {posts.map((post) => {
                const statusLabel =
                  post.status === "sold"
                    ? "거래완료"
                    : post.status === "reserved"
                    ? "예약중"
                    : "판매중";
                const statusClass =
                  post.status === "sold"
                    ? "text-red-600"
                    : post.status === "reserved"
                    ? "text-green-600"
                    : "text-blue-600";
                const priceLabel =
                  post.price != null
                    ? `${post.price.toLocaleString("ko-KR")}원`
                    : "가격 미정";
                const thumb = thumbnails[post.id];

                return (
                  <li key={post.id}>
                    <Link
                      href={`/posts/${post.id}`}
                      className="group flex gap-4 rounded-2xl border p-4 transition hover:border-zinc-300"
                    >
                      <div className="h-24 w-28 overflow-hidden rounded-xl bg-zinc-100">
                        {thumb ? (
                          <img
                            src={thumb}
                            alt={post.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">
                            이미지 없음
                          </div>
                        )}
                      </div>
                      <div className="flex flex-1 flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <h2 className="text-base font-semibold">
                            {post.title}
                          </h2>
                          <span
                            className={`text-xs font-medium ${statusClass}`}
                          >
                            {statusLabel}
                          </span>
                        </div>
                        <div className="text-sm text-zinc-600 line-clamp-2">
                          {post.content}
                        </div>
                        <div className="text-sm font-semibold">
                          {priceLabel}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {post.region_name ?? post.region_code} ·{" "}
                          {post.category ?? "카테고리 없음"}
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-zinc-400">
              주변 농장
            </div>
            <div className="mt-3 h-[420px] rounded-xl border bg-gradient-to-br from-zinc-50 to-zinc-100">
              <div className="flex h-full items-center justify-center text-xs text-zinc-400">
                지도 영역 (준비 중)
              </div>
            </div>
          </div>
          <div className="rounded-2xl border p-4 text-sm text-zinc-600">
            현재 위치 주변의 농장 데이터를 준비하고 있어요.
          </div>
        </aside>
      </div>
    </div>
  );
}
