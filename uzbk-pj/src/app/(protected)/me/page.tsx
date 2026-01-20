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

const LICENSE_BUCKET = "seller-licenses";
const MAX_LICENSE_MB = 5;

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

  const [verification, setVerification] = useState<any | null>(null);
  const [verificationMsg, setVerificationMsg] = useState("");
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [licenseUrl, setLicenseUrl] = useState("");
  const [isEditingApproved, setIsEditingApproved] = useState(false);

  const [farmName, setFarmName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [locationNote, setLocationNote] = useState("");
  const [farmDescription, setFarmDescription] = useState("");
  const [approvedSnapshot, setApprovedSnapshot] = useState<{
    farmName: string;
    ownerName: string;
    phone: string;
    address: string;
    locationNote: string;
    farmDescription: string;
    licensePath: string;
  } | null>(null);

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

      const { data: verificationData } = await supabase
        .from("seller_verifications")
        .select(
          "user_id,farm_name,owner_name,phone,address,location_note,description,business_license_path,status,requested_at,reviewed_at,rejection_reason"
        )
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (cancelled) return;

      setNickname(profile?.nickname ?? "");
      setRegionCode(profile?.region_code ?? "");
      setRegionName(profile?.region_name ?? "");
      setPosts(postData ?? []);
      setReceivedReviews(reviewData ?? []);
      setGivenReviews(givenReviewData ?? []);
      setVerification(verificationData ?? null);
      const snapshot = {
        farmName: verificationData?.farm_name ?? "",
        ownerName: verificationData?.owner_name ?? "",
        phone: verificationData?.phone ?? "",
        address: verificationData?.address ?? "",
        locationNote: verificationData?.location_note ?? "",
        farmDescription: verificationData?.description ?? "",
        licensePath: verificationData?.business_license_path ?? "",
      };
      setFarmName(snapshot.farmName);
      setOwnerName(snapshot.ownerName);
      setPhone(snapshot.phone);
      setAddress(snapshot.address);
      setLocationNote(snapshot.locationNote);
      setFarmDescription(snapshot.farmDescription);
      setApprovedSnapshot(
        verificationData?.status === "approved" ? snapshot : null
      );
      setLoading(false);

      if (verificationData?.business_license_path) {
        const { data: signed } = await supabase.storage
          .from(LICENSE_BUCKET)
          .createSignedUrl(verificationData.business_license_path, 60 * 30);
        if (signed?.signedUrl) {
          setLicenseUrl(signed.signedUrl);
        }
      }
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

  const handleLicenseChange = (file: File | null) => {
    if (!file) {
      setLicenseFile(null);
      return;
    }
    if (file.size > MAX_LICENSE_MB * 1024 * 1024) {
      setVerificationMsg(`파일 용량은 ${MAX_LICENSE_MB}MB 이하만 가능합니다.`);
      return;
    }
    setLicenseFile(file);
  };

  const getLicensePath = (file: File) => {
    const ext = file.name.includes(".")
      ? "." + file.name.split(".").pop()
      : "";
    return `${session?.user.id}/${Date.now()}${ext}`;
  };

  const handleVerificationSubmit = async () => {
    if (!session) return;
    if (verification?.status === "approved" && !isEditingApproved) {
      setVerificationMsg(
        "이미 판매자 인증이 승인되었습니다. 추가 변경은 고객센터에 문의하세요."
      );
      return;
    }

    const trimmedFarmName = farmName.trim();
    const trimmedOwnerName = ownerName.trim();
    const trimmedPhone = phone.trim();
    const trimmedAddress = address.trim();

    if (!trimmedFarmName || !trimmedOwnerName || !trimmedPhone || !trimmedAddress) {
      setVerificationMsg("필수 정보를 모두 입력하세요.");
      return;
    }

    const licenseChanged = Boolean(licenseFile);
    const coreChanged =
      (verification?.farm_name ?? "") !== trimmedFarmName ||
      (verification?.owner_name ?? "") !== trimmedOwnerName ||
      (verification?.address ?? "") !== trimmedAddress ||
      licenseChanged;

    const requiresReview =
      verification?.status === "approved" && isEditingApproved && coreChanged;

    if (requiresReview) {
      const ok = window.confirm(
        "심사 필요 항목을 변경한 경우 재심사를 거쳐야 하며, 재심사 기간 동안은 상품 등록을 할 수 없습니다. 변경하시겠습니까?"
      );
      if (!ok) {
        if (approvedSnapshot) {
          setFarmName(approvedSnapshot.farmName);
          setOwnerName(approvedSnapshot.ownerName);
          setPhone(approvedSnapshot.phone);
          setAddress(approvedSnapshot.address);
          setLocationNote(approvedSnapshot.locationNote);
          setFarmDescription(approvedSnapshot.farmDescription);
          setLicenseFile(null);
        }
        setVerificationMsg("정보 수정을 취소했습니다.");
        return;
      }
    }

    setVerificationLoading(true);
    setVerificationMsg("");

    let licensePath = verification?.business_license_path ?? null;
    if (licenseFile) {
      const path = getLicensePath(licenseFile);
      const { error: uploadError } = await supabase.storage
        .from(LICENSE_BUCKET)
        .upload(path, licenseFile, { upsert: true });

      if (uploadError) {
        setVerificationMsg("사업자 등록증 업로드에 실패했습니다.");
        setVerificationLoading(false);
        return;
      }
      licensePath = path;
    }

    if (!licensePath) {
      setVerificationMsg("사업자 등록증 파일을 업로드하세요.");
      setVerificationLoading(false);
      return;
    }

    const payload = {
      user_id: session.user.id,
      farm_name: trimmedFarmName,
      owner_name: trimmedOwnerName,
      phone: trimmedPhone,
      address: trimmedAddress,
      location_note: locationNote.trim() || null,
      description: farmDescription.trim() || null,
      business_license_path: licensePath,
      status:
        verification?.status === "approved" && isEditingApproved
          ? requiresReview
            ? "pending"
            : "approved"
          : "pending",
      requested_at:
        verification?.status === "approved" && isEditingApproved
          ? requiresReview
            ? new Date().toISOString()
            : verification?.requested_at ?? new Date().toISOString()
          : new Date().toISOString(),
      reviewed_at:
        verification?.status === "approved" && isEditingApproved
          ? requiresReview
            ? null
            : verification?.reviewed_at ?? null
          : null,
      rejection_reason:
        verification?.status === "approved" && isEditingApproved
          ? requiresReview
            ? null
            : verification?.rejection_reason ?? null
          : null,
      reviewed_by:
        verification?.status === "approved" && isEditingApproved
          ? requiresReview
            ? null
            : verification?.reviewed_by ?? null
          : null,
    };

    const { data: saved, error: saveError } = await supabase
      .from("seller_verifications")
      .upsert(payload, { onConflict: "user_id" })
      .select(
        "user_id,farm_name,owner_name,phone,address,location_note,description,business_license_path,status,requested_at,reviewed_at,rejection_reason"
      )
      .single();

    if (saveError) {
      setVerificationMsg("인증 요청에 실패했습니다.");
      setVerificationLoading(false);
      return;
    }

    setVerification(saved ?? null);
    if (saved?.status === "approved") {
      setApprovedSnapshot({
        farmName: saved.farm_name ?? "",
        ownerName: saved.owner_name ?? "",
        phone: saved.phone ?? "",
        address: saved.address ?? "",
        locationNote: saved.location_note ?? "",
        farmDescription: saved.description ?? "",
        licensePath: saved.business_license_path ?? "",
      });
    } else if (saved?.status === "pending") {
      setApprovedSnapshot(null);
    }
    if (saved?.business_license_path) {
      const { data: signed } = await supabase.storage
        .from(LICENSE_BUCKET)
        .createSignedUrl(saved.business_license_path, 60 * 30);
      setLicenseUrl(signed?.signedUrl ?? "");
    }
    setVerificationMsg(
      verification?.status === "approved" && isEditingApproved
        ? requiresReview
          ? "정보 수정 요청이 접수되었습니다."
          : "판매자 정보가 수정되었습니다."
        : "인증 요청을 보냈습니다."
    );
    setIsEditingApproved(false);
    setVerificationLoading(false);
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

      <section className="space-y-3 border-b pb-6">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">판매자 인증</h2>
          <span className="text-xs text-zinc-500">
            {verification?.status === "approved"
              ? "승인 완료"
              : verification?.status === "pending"
              ? "심사 중"
              : verification?.status === "rejected"
              ? "반려됨"
              : "미신청"}
          </span>
        </div>
        {verification?.status === "rejected" && verification?.rejection_reason && (
          <p className="text-sm text-red-500">
            반려 사유: {verification.rejection_reason}
          </p>
        )}
        <p className="text-xs text-zinc-500">
          * 표시된 항목은 심사 필요 항목입니다. 변경 시 재심사가 필요할 수
          있습니다.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium">
              농장 이름 <span className="text-red-500">*</span>
            </span>
            <input
              className="w-full rounded border px-3 py-2"
              placeholder="예: Uzbeki Farm"
              value={farmName}
              onChange={(e) => setFarmName(e.target.value)}
              disabled={verification?.status === "approved" && !isEditingApproved}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">
              농장주 성명 <span className="text-red-500">*</span>
            </span>
            <input
              className="w-full rounded border px-3 py-2"
              placeholder="예: 홍길동"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              disabled={verification?.status === "approved" && !isEditingApproved}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">
              연락처 <span className="text-red-500">*</span>
            </span>
            <input
              className="w-full rounded border px-3 py-2"
              placeholder="예: 010-1234-5678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={verification?.status === "approved" && !isEditingApproved}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">
              농장 주소 <span className="text-red-500">*</span>
            </span>
            <input
              className="w-full rounded border px-3 py-2"
              placeholder="예: 서울시 ... "
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={verification?.status === "approved" && !isEditingApproved}
            />
          </label>
        </div>
        <label className="space-y-1 text-sm">
          <span className="font-medium">농장 위치 부가 설명</span>
          <input
            className="w-full rounded border px-3 py-2"
            placeholder="예: 마을회관에서 200m"
            value={locationNote}
            onChange={(e) => setLocationNote(e.target.value)}
            disabled={verification?.status === "approved" && !isEditingApproved}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">농장 추가 설명</span>
          <textarea
            className="w-full rounded border px-3 py-2"
            placeholder="예: 유기농 인증, 방문 수령 가능"
            value={farmDescription}
            onChange={(e) => setFarmDescription(e.target.value)}
            disabled={verification?.status === "approved" && !isEditingApproved}
          />
        </label>
        <div className="space-y-2 text-sm">
          <div className="font-medium">
            사업자 등록증 <span className="text-red-500">*</span>
          </div>
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => handleLicenseChange(e.target.files?.[0] ?? null)}
            disabled={verification?.status === "approved" && !isEditingApproved}
          />
          {licenseUrl && (
            <a
              href={licenseUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-blue-600 underline"
            >
              업로드된 등록증 보기
            </a>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded bg-zinc-900 px-4 py-2 text-white cursor-pointer disabled:opacity-60"
            onClick={handleVerificationSubmit}
            disabled={
              verificationLoading ||
              (verification?.status === "approved" && !isEditingApproved)
            }
          >
            {verificationLoading
              ? "요청 중..."
              : verification?.status === "approved" && isEditingApproved
              ? "정보 수정 저장"
              : "인증 요청"}
          </button>
          {verification?.status === "approved" && !isEditingApproved && (
            <button
              className="rounded border px-4 py-2 text-sm text-zinc-700 cursor-pointer"
              onClick={() => {
                setIsEditingApproved(true);
                setVerificationMsg("정보 수정을 진행하세요.");
              }}
            >
              정보 수정
            </button>
          )}
        </div>
        {verificationMsg && (
          <p className="text-sm text-zinc-600">{verificationMsg}</p>
        )}
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
