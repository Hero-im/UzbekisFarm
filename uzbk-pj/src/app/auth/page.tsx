"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

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
  const [roadAddress, setRoadAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [addressDetail, setAddressDetail] = useState("");
  const [addressQuery, setAddressQuery] = useState("");
  const [addressResults, setAddressResults] = useState<any[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressHelp, setAddressHelp] = useState("");
  const [addressCoords, setAddressCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

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

  const handleAddressSearch = async () => {
    const query = addressQuery.trim();
    if (!query) {
      setMessage("도로명 주소를 입력하세요.");
      return;
    }
    setAddressLoading(true);
    setAddressHelp("");
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=${encodeURIComponent(
          query
        )}`,
        {
          headers: {
            "Accept-Language": "ko",
          },
        }
      );
      const data = (await response.json()) as any[];
      setAddressResults(data ?? []);
      if (!data?.length) {
        setAddressHelp(
          "검색된 주소가 없습니다. 도시/구/동까지 포함해 다시 입력해보세요."
        );
      }
    } catch {
      setAddressHelp("예시: Tashkent, Afrosiyob ko'chasi 7");
    } finally {
      setAddressLoading(false);
    }
  };

  const handleSelectAddress = (result: any) => {
    const display = result?.display_name ?? "";
    const postcode = result?.address?.postcode ?? "";
    const lat = Number(result?.lat);
    const lng = Number(result?.lon);
    setRoadAddress(display);
    setPostalCode(postcode);
    setAddressQuery("");
    setAddressResults([]);
    setAddressHelp("");
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      setAddressCoords({ lat, lng });
    }
  };

  const geocodeAddress = async (value: string) => {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
      value
    )}`;
    const response = await fetch(url, {
      headers: {
        "Accept-Language": "ko",
      },
    });
    if (!response.ok) {
      throw new Error("geocode_failed");
    }
    const data = (await response.json()) as Array<{
      lat: string;
      lon: string;
    }>;
    if (!data.length) return null;
    return { lat: Number(data[0].lat), lng: Number(data[0].lon) };
  };

  const upsertProfile = async (
    user: { id: string; user_metadata?: Record<string, any> },
    defaults?: {
      nickname?: string;
      address?: string;
      postal_code?: string;
      address_detail?: string;
      latitude?: number;
      longitude?: number;
    }
  ) => {
    const { data: existingRows } = await supabase
      .from("profiles")
      .select("nickname,address,postal_code,address_detail,latitude,longitude")
      .eq("id", user.id)
      .limit(1);

    const existing = existingRows?.[0];
    const next = {
      id: user.id,
      nickname: existing?.nickname ?? defaults?.nickname ?? null,
      address: existing?.address ?? defaults?.address ?? null,
      postal_code: existing?.postal_code ?? defaults?.postal_code ?? null,
      address_detail:
        existing?.address_detail ?? defaults?.address_detail ?? null,
      latitude: existing?.latitude ?? defaults?.latitude ?? null,
      longitude: existing?.longitude ?? defaults?.longitude ?? null,
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
      if (!roadAddress.trim()) {
        setMessage("동네 주소를 검색해 선택하세요.");
        return;
      }
      let coords = addressCoords;
      if (!coords) {
        coords = await geocodeAddress(roadAddress.trim());
      }
      if (!coords) {
        setMessage("주소를 찾을 수 없습니다. 다시 검색해주세요.");
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            nickname: nickname.trim(),
            address: roadAddress.trim(),
            postal_code: postalCode.trim() || null,
            address_detail: addressDetail.trim() || null,
            latitude: coords.lat,
            longitude: coords.lng,
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
          address: roadAddress.trim(),
          postal_code: postalCode.trim() || null,
          address_detail: addressDetail.trim() || null,
          latitude: coords.lat,
          longitude: coords.lng,
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
        address?: string;
        postal_code?: string;
        address_detail?: string;
        latitude?: number;
        longitude?: number;
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
              <h2 className="text-sm font-medium text-zinc-700">동네 설정</h2>
              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    className="w-full rounded border px-3 py-2"
                    placeholder="도로명 주소를 검색하세요"
                    value={addressQuery}
                    onChange={(e) => setAddressQuery(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={handleAddressSearch}
                    className="whitespace-nowrap rounded border px-3 py-2 text-sm"
                  >
                    {addressLoading ? "검색 중..." : "주소 검색"}
                  </button>
                </div>
                {addressResults.length > 0 && (
                  <div className="max-h-40 overflow-auto rounded border text-xs">
                    {addressResults.map((result, index) => (
                      <button
                        key={`${result.place_id}-${index}`}
                        type="button"
                        className="block w-full border-b px-3 py-2 text-left hover:bg-zinc-50"
                        onClick={() => handleSelectAddress(result)}
                      >
                        {result.display_name}
                      </button>
                    ))}
                  </div>
                )}
                {addressHelp && (
                  <p className="text-xs text-zinc-500">{addressHelp}</p>
                )}
                <input
                  className="rounded border px-3 py-2"
                  placeholder="선택된 도로명 주소"
                  value={roadAddress}
                  readOnly
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    className="rounded border px-3 py-2"
                    placeholder="우편번호"
                    value={postalCode}
                    readOnly
                  />
                  <input
                    className="rounded border px-3 py-2"
                    placeholder="상세 주소"
                    value={addressDetail}
                    onChange={(e) => setAddressDetail(e.target.value)}
                  />
                </div>
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
          setRoadAddress("");
          setPostalCode("");
          setAddressDetail("");
          setAddressQuery("");
          setAddressResults([]);
          setAddressHelp("");
          setAddressCoords(null);
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
