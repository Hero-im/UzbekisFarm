"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

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

export default function AuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [message, setMessage] = useState("");
  const [nickname, setNickname] = useState("");
  const [nicknameCheck, setNicknameCheck] = useState<
    "unchecked" | "checking" | "available" | "taken"
  >("unchecked");
  const [nicknameCheckMessage, setNicknameCheckMessage] = useState("");
  const [regionCode, setRegionCode] = useState("");
  const [regionName, setRegionName] = useState("");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return REGIONS;
    return REGIONS.filter((r) => r.name.includes(q) || r.code.includes(q));
  }, [search]);

  const handleSelect = (value: string) => {
    const selected = REGIONS.find((region) => region.code === value);
    if (!selected) return;
    setRegionCode(selected.code);
    setRegionName(selected.name);
  };

  const handleNicknameCheck = async () => {
    const value = nickname.trim();
    if (!value) {
      setNicknameCheck("unchecked");
      setNicknameCheckMessage("닉네임을 입력하세요.");
      return;
    }

    setNicknameCheck("checking");
    setNicknameCheckMessage("확인 중...");

    const { data, error } = await supabase.rpc(
      "is_nickname_available",
      { nickname: value, self_id: null }
    );

    if (error) {
      setNicknameCheck("unchecked");
      setNicknameCheckMessage(error.message);
      return;
    }

    if (data === false) {
      setNicknameCheck("taken");
      setNicknameCheckMessage("이미 사용 중인 닉네임입니다.");
      return;
    }

    setNicknameCheck("available");
    setNicknameCheckMessage("사용 가능한 닉네임입니다.");
  };

  const upsertProfile = async (
    user: { id: string; user_metadata?: Record<string, any> },
    defaults?: {
      nickname?: string;
      region_code?: string;
      region_name?: string;
    }
  ) => {
    const { data: existingRows } = await supabase
      .from("profiles")
      .select("nickname,region_code,region_name")
      .eq("id", user.id)
      .limit(1);

    const existing = existingRows?.[0];
    const next = {
      id: user.id,
      nickname: existing?.nickname ?? defaults?.nickname ?? null,
      region_code: existing?.region_code ?? defaults?.region_code ?? null,
      region_name: existing?.region_name ?? defaults?.region_name ?? null,
    };

    await supabase.from("profiles").upsert(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("처리 중...");

    if (isSignUp) {
      if (!nickname.trim()) {
        setMessage("닉네임을 입력하세요.");
        return;
      }
      if (nicknameCheck !== "available") {
        setMessage("닉네임 중복확인을 해주세요.");
        return;
      }
      if (!regionCode || !regionName) {
        setMessage("지역을 선택하세요.");
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            nickname: nickname.trim(),
            region_code: regionCode,
            region_name: regionName,
          },
        },
      });
      if (error) {
        if (error.code === "23505") {
          setMessage("이미 사용 중인 닉네임입니다.");
          return;
        }
        setMessage(error.message);
        return;
      }
      if (data.user && data.session) {
        await upsertProfile(data.user, {
          nickname: nickname.trim(),
          region_code: regionCode,
          region_name: regionName,
        });
      }
      setMessage("");
      alert("회원가입 완료!");
      await supabase.auth.signOut();
      setIsSignUp(false);
      setPassword("");
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setMessage(error.message);
      return;
    }

    if (data.user) {
      const meta = (data.user.user_metadata ?? {}) as {
        nickname?: string;
        region_code?: string;
        region_name?: string;
      };
      await upsertProfile(data.user, meta);
    }

    setMessage("로그인 성공!");
    router.replace("/feed");
  };

  return (
    <div className="mx-auto max-w-md rounded-lg bg-white p-6 shadow">
      <h1 className="mb-4 text-xl font-semibold">
        {isSignUp ? "회원가입" : "로그인"}
      </h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {isSignUp && (
          <>
            <section className="space-y-2">
              <h2 className="text-sm font-medium text-zinc-700">
                닉네임 설정
              </h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="닉네임"
                  className="flex-1 rounded border px-3 py-2"
                  value={nickname}
                  onChange={(e) => {
                    setNickname(e.target.value);
                    setNicknameCheck("unchecked");
                    setNicknameCheckMessage("");
                  }}
                  required
                />
                <button
                  type="button"
                  onClick={handleNicknameCheck}
                  className="rounded border px-3 py-2 text-sm cursor-pointer"
                >
                  중복확인
                </button>
              </div>
              {nicknameCheckMessage && (
                <p className="text-sm text-zinc-600">
                  {nicknameCheckMessage}
                </p>
              )}
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-medium text-zinc-700">지역 설정</h2>
              <input
                className="rounded border px-3 py-2"
                placeholder="지역 검색 (예: 서울)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <div className="flex gap-2">
                <select
                  className="w-full rounded border px-3 py-2"
                  value={regionCode}
                  onChange={(e) => handleSelect(e.target.value)}
                  required
                >
                  <option value="">지역을 선택하세요</option>
                  {filtered.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-medium text-zinc-700">이메일</h2>
              <input
                type="email"
                placeholder="이메일"
                className="w-full rounded border px-3 py-2"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-medium text-zinc-700">비밀번호</h2>
              <input
                type="password"
                placeholder="비밀번호"
                className="w-full rounded border px-3 py-2"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </section>
          </>
        )}

        {!isSignUp && (
          <>
            <input
              type="email"
              placeholder="이메일"
              className="w-full rounded border px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="비밀번호"
              className="w-full rounded border px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </>
        )}

        <button
          type="submit"
          className="rounded bg-zinc-900 px-4 py-2 text-white cursor-pointer"
        >
          {isSignUp ? "회원가입" : "로그인"}
        </button>
      </form>

      <button
        className="mt-3 text-sm text-zinc-600 underline"
        onClick={() => {
          setIsSignUp(!isSignUp);
          setMessage("");
          setNickname("");
          setNicknameCheck("unchecked");
          setNicknameCheckMessage("");
          setRegionCode("");
          setRegionName("");
          setSearch("");
          setEmail("");
          setPassword("");
        }}
      >
        {isSignUp ? "이미 계정이 있어요 (로그인)" : "처음이세요? (회원가입)"}
      </button>

      {message && <p className="mt-3 text-sm text-red-500">{message}</p>}
    </div>
  );
}
