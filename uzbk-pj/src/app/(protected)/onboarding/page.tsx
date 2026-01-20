"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";

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

export default function OnboardingPage() {
  const { session } = useAuth();
  const [nickname, setNickname] = useState("");
  const [regionCode, setRegionCode] = useState("");
  const [regionName, setRegionName] = useState("");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return REGIONS;
    return REGIONS.filter(
      (r) => r.name.includes(q) || r.code.includes(q)
    );
  }, [search]);

  const handleSelect = (code: string, name: string) => {
    setRegionCode(code);
    setRegionName(name);
  };

  const handleSave = async () => {
    if (!session) {
      setMessage("로그인이 필요합니다.");
      return;
    }
    if (!regionCode || !regionName) {
      setMessage("지역 코드/이름을 입력하거나 선택하세요.");
      return;
    }

    const { error } = await supabase.from("profiles").upsert({
      id: session.user.id,
      nickname: nickname || null,
      region_code: regionCode,
      region_name: regionName,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("저장 완료");
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">/onboarding</h1>

      <input
        className="w-full max-w-sm rounded border px-3 py-2"
        placeholder="닉네임 (선택)"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
      />

      <input
        className="w-full max-w-sm rounded border px-3 py-2"
        placeholder="지역 검색 (예: 서울, 11)"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="flex gap-2">
        <input
          className="w-full max-w-[120px] rounded border px-3 py-2"
          placeholder="region_code"
          value={regionCode}
          onChange={(e) => setRegionCode(e.target.value)}
        />
        <input
          className="w-full max-w-[220px] rounded border px-3 py-2"
          placeholder="region_name"
          value={regionName}
          onChange={(e) => setRegionName(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {filtered.map((r) => (
          <button
            key={r.code}
            onClick={() => handleSelect(r.code, r.name)}
            className="rounded border px-3 py-1 text-sm"
          >
            {r.name} ({r.code})
          </button>
        ))}
      </div>

      <button
        className="rounded bg-zinc-900 px-4 py-2 text-white cursor-pointer"
        onClick={handleSave}
      >
        저장
      </button>

      {message && <p className="text-sm text-zinc-600">{message}</p>}
    </div>
  );
}
