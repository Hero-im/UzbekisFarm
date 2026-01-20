"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Loading from "@/components/Loading";

const REGIONS = [
  { code: "11", name: "서울" },
  { code: "26", name: "부산" },
  { code: "27", name: "대구" },
  { code: "28", name: "인천" },
  { code: "29", name: "광주" },
  { code: "30", name: "대전" },
  { code: "31", name: "울산" },
  { code: "41", name: "경기" },
  { code: "42", name: "강원" },
  { code: "43", name: "충북" },
  { code: "44", name: "충남" },
  { code: "45", name: "전북" },
  { code: "46", name: "전남" },
  { code: "47", name: "경북" },
  { code: "48", name: "경남" },
  { code: "50", name: "제주" },
];

export default function MePage() {
  const router = useRouter();
  const { session } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [receivedReviews, setReceivedReviews] = useState<any[]>([]);
  const [givenReviews, setGivenReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewTab, setReviewTab] = useState<"received" | "given">("received");

  const [nickname, setNickname] = useState("");
  const [regionCode, setRegionCode] = useState("");
  const [regionName, setRegionName] = useState("");
  const [search, setSearch] = useState("");

  const [nicknameMsg, setNicknameMsg] = useState("");
  const [regionMsg, setRegionMsg] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return REGIONS;
    return REGIONS.filter((r) => r.name.includes(q) || r.code.includes(q));
  }, [search]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!session) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("nickname,region_code,region_name")
        .eq("id", session.user.id)
        .single();

      const { data: postData } = await supabase
        .from("posts")
        .select("id,title,created_at")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      const { data: reviewData } = await supabase
        .from("reviews")
        .select("id,rating,content,created_at")
        .eq("reviewee_id", session.user.id)
        .order("created_at", { ascending: false });

      const { data: givenReviewData } = await supabase
        .from("reviews")
        .select("id,rating,content,created_at,reviewee_id")
        .eq("reviewer_id", session.user.id)
        .order("created_at", { ascending: false });

      if (cancelled) return;

      setNickname(profile?.nickname ?? "");
      setRegionCode(profile?.region_code ?? "");
      setRegionName(profile?.region_name ?? "");
      setPosts(postData ?? []);
      setReceivedReviews(reviewData ?? []);
      setGivenReviews(givenReviewData ?? []);
      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const handleNicknameSave = async () => {
    if (!session) return;
    const value = nickname.trim();
    if (!value) {
      setNicknameMsg("닉네임을 입력하세요.");
      return;
    }

    const { data, error } = await supabase.rpc("is_nickname_available", {
      nickname: value,
      self_id: session.user.id,
    });

    if (error) {
      setNicknameMsg(error.message);
      return;
    }
    if (data === false) {
      setNicknameMsg("이미 사용 중인 닉네임입니다.");
      return;
    }

    const { error: updateError } = await supabase.from("profiles").upsert({
      id: session.user.id,
      nickname: value || null,
    });
    if (updateError) {
      const isDuplicate =
        updateError.code === "23505" ||
        updateError.message.includes("duplicate key value");
      if (isDuplicate) {
        setNicknameMsg("이미 사용 중인 닉네임입니다.");
        return;
      }
      setNicknameMsg("닉네임 저장에 실패했습니다.");
      return;
    }
    setNicknameMsg("닉네임 저장 완료");
  };

  const handleSelect = (value: string) => {
    const selected = REGIONS.find((region) => region.code === value);
    if (!selected) return;
    setRegionCode(selected.code);
    setRegionName(selected.name);
  };

  const handleRegionSave = async () => {
    if (!session) return;
    if (!regionCode || !regionName) {
      setRegionMsg("지역 코드/이름을 입력하거나 선택하세요.");
      return;
    }
    const { error } = await supabase.from("profiles").upsert({
      id: session.user.id,
      region_code: regionCode,
      region_name: regionName,
    });
    if (error) {
      setRegionMsg(error.message);
      return;
    }
    setRegionMsg("지역 변경 완료");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/auth");
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">My page</h1>

      <section className="space-y-2 border-b pb-6">
        <h2 className="font-medium">닉네임 변경</h2>
        <input
          className="w-full max-w-sm rounded border px-3 py-2"
          placeholder="닉네임"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
        />
        <button
          className="rounded bg-zinc-900 px-4 py-2 text-white cursor-pointer"
          onClick={handleNicknameSave}
        >
          닉네임 저장
        </button>
        {nicknameMsg && (
          <p
            className={`text-sm ${
              nicknameMsg === "이미 사용 중인 닉네임입니다."
                ? "text-red-500"
                : "text-zinc-600"
            }`}
          >
            {nicknameMsg}
          </p>
        )}
      </section>

      <section className="space-y-2 border-b pb-6">
        <h2 className="font-medium">지역 변경</h2>
        <input
          className="w-full max-w-sm rounded border px-3 py-2"
          placeholder="지역 검색 (예: 서울)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="w-full max-w-sm rounded border px-3 py-2"
          value={regionCode}
          onChange={(e) => handleSelect(e.target.value)}
        >
          <option value="">지역을 선택하세요</option>
          {filtered.map((r) => (
            <option key={r.code} value={r.code}>
              {r.name}
            </option>
          ))}
        </select>
        <button
          className="rounded bg-zinc-900 px-4 py-2 text-white cursor-pointer"
          onClick={handleRegionSave}
        >
          지역 저장
        </button>
        {regionMsg && <p className="text-sm text-zinc-600">{regionMsg}</p>}
      </section>

      <section className="border-b pb-6">
        <h2 className="font-medium">내 글</h2>
        {posts.length === 0 ? (
          <p className="text-sm text-zinc-600">작성한 글이 없습니다.</p>
        ) : (
          <ul className="list-disc pl-5 text-sm">
            {posts.map((p) => (
              <li key={p.id}>{p.title}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="border-b pb-6">
        <div className="flex items-center gap-2">
          <h2 className="font-medium">내 리뷰</h2>
          <button
            className={`rounded px-2 py-1 text-xs ${
              reviewTab === "received"
                ? "bg-zinc-900 text-white"
                : "border text-zinc-600"
            }`}
            onClick={() => setReviewTab("received")}
          >
            받은 리뷰
          </button>
          <button
            className={`rounded px-2 py-1 text-xs ${
              reviewTab === "given"
                ? "bg-zinc-900 text-white"
                : "border text-zinc-600"
            }`}
            onClick={() => setReviewTab("given")}
          >
            남긴 리뷰
          </button>
        </div>
        {reviewTab === "received" ? (
          receivedReviews.length === 0 ? (
            <p className="text-sm text-zinc-600">받은 리뷰가 없습니다.</p>
          ) : (
            <ul className="list-disc pl-5 text-sm">
              {receivedReviews.map((r) => (
                <li key={r.id}>
                  {r.rating}점 · {r.content ?? "내용 없음"}
                </li>
              ))}
            </ul>
          )
        ) : givenReviews.length === 0 ? (
          <p className="text-sm text-zinc-600">남긴 리뷰가 없습니다.</p>
        ) : (
          <ul className="list-disc pl-5 text-sm">
            {givenReviews.map((r) => (
              <li key={r.id}>
                {r.rating}점 · {r.content ?? "내용 없음"}
              </li>
            ))}
          </ul>
        )}
      </section>

      <button
        onClick={handleLogout}
        className="rounded bg-zinc-900 px-4 py-2 text-white cursor-pointer"
      >
        로그아웃
      </button>
    </div>
  );
}
