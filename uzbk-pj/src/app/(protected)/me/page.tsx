"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Loading from "@/components/Loading";

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
  const [nicknameMsg, setNicknameMsg] = useState("");
  const [addressMsg, setAddressMsg] = useState("");

  const [verification, setVerification] = useState<any | null>(null);
  const [verificationMsg, setVerificationMsg] = useState("");
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [licenseUrl, setLicenseUrl] = useState("");
  const [isEditingApproved, setIsEditingApproved] = useState(false);

  const [farmName, setFarmName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [roadAddress, setRoadAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [addressDetail, setAddressDetail] = useState("");
  const [locationNote, setLocationNote] = useState("");
  const [farmDescription, setFarmDescription] = useState("");
  const [addressQuery, setAddressQuery] = useState("");
  const [addressResults, setAddressResults] = useState<any[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressHelp, setAddressHelp] = useState("");
  const [approvedSnapshot, setApprovedSnapshot] = useState<{
    farmName: string;
    ownerName: string;
    phone: string;
    roadAddress: string;
    postalCode: string;
    addressDetail: string;
    locationNote: string;
    farmDescription: string;
    licensePath: string;
  } | null>(null);

  const [profileRoadAddress, setProfileRoadAddress] = useState("");
  const [profilePostalCode, setProfilePostalCode] = useState("");
  const [profileAddressDetail, setProfileAddressDetail] = useState("");
  const [profileAddressQuery, setProfileAddressQuery] = useState("");
  const [profileAddressResults, setProfileAddressResults] = useState<any[]>([]);
  const [profileAddressLoading, setProfileAddressLoading] = useState(false);
  const [profileAddressHelp, setProfileAddressHelp] = useState("");
  const [profileCoords, setProfileCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!session) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select(
          "nickname,address,postal_code,address_detail,latitude,longitude"
        )
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
          "user_id,farm_name,owner_name,phone,address,postal_code,address_detail,location_note,description,business_license_path,status,requested_at,reviewed_at,rejection_reason,latitude,longitude"
        )
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (cancelled) return;

      setNickname(profile?.nickname ?? "");
      setProfileRoadAddress(profile?.address ?? "");
      setProfilePostalCode(profile?.postal_code ?? "");
      setProfileAddressDetail(profile?.address_detail ?? "");
      if (profile?.latitude != null && profile?.longitude != null) {
        setProfileCoords({
          lat: Number(profile.latitude),
          lng: Number(profile.longitude),
        });
      }
      setPosts(postData ?? []);
      setReceivedReviews(reviewData ?? []);
      setGivenReviews(givenReviewData ?? []);
      setVerification(verificationData ?? null);
      const snapshot = {
        farmName: verificationData?.farm_name ?? "",
        ownerName: verificationData?.owner_name ?? "",
        phone: verificationData?.phone ?? "",
        roadAddress: verificationData?.address ?? "",
        postalCode: verificationData?.postal_code ?? "",
        addressDetail: verificationData?.address_detail ?? "",
        locationNote: verificationData?.location_note ?? "",
        farmDescription: verificationData?.description ?? "",
        licensePath: verificationData?.business_license_path ?? "",
      };
      setFarmName(snapshot.farmName);
      setOwnerName(snapshot.ownerName);
      setPhone(snapshot.phone);
      setRoadAddress(snapshot.roadAddress);
      setPostalCode(snapshot.postalCode);
      setAddressDetail(snapshot.addressDetail);
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

  const handleProfileAddressSearch = async () => {
    const query = profileAddressQuery.trim();
    if (!query) {
      setAddressMsg("도로명 주소를 입력하세요.");
      return;
    }
    setProfileAddressLoading(true);
    setProfileAddressHelp("");
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
      setProfileAddressResults(data ?? []);
      if (!data?.length) {
        setProfileAddressHelp(
          "검색된 주소가 없습니다. 도시/구/동까지 포함해 다시 입력해보세요."
        );
      }
    } catch {
      setProfileAddressHelp("예시: Tashkent, Afrosiyob ko'chasi 7");
    } finally {
      setProfileAddressLoading(false);
    }
  };

  const handleSelectProfileAddress = (result: any) => {
    const display = result?.display_name ?? "";
    const postcode = result?.address?.postcode ?? "";
    const lat = Number(result?.lat);
    const lng = Number(result?.lon);
    setProfileRoadAddress(display);
    setProfilePostalCode(postcode);
    setProfileAddressQuery("");
    setProfileAddressResults([]);
    setProfileAddressHelp("");
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      setProfileCoords({ lat, lng });
    }
  };

  const handleProfileAddressSave = async () => {
    if (!session) return;
    const address = profileRoadAddress.trim();
    if (!address) {
      setAddressMsg("동네 주소를 검색해 선택하세요.");
      return;
    }
    let coords = profileCoords;
    if (!coords) {
      try {
        const next = await geocodeAddress(address);
        if (!next) {
          setAddressMsg("주소를 찾을 수 없습니다. 다시 검색해주세요.");
          return;
        }
        coords = next;
        setProfileCoords(next);
      } catch {
        setAddressMsg("주소 좌표 변환에 실패했습니다.");
        return;
      }
    }
    const { error } = await supabase.from("profiles").upsert({
      id: session.user.id,
      address,
      postal_code: profilePostalCode.trim() || null,
      address_detail: profileAddressDetail.trim() || null,
      latitude: coords.lat,
      longitude: coords.lng,
    });
    if (error) {
      setAddressMsg(error.message);
      return;
    }
    setAddressMsg("동네 변경 완료");
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

  const handleAddressSearch = async () => {
    const query = addressQuery.trim();
    if (!query) {
      setVerificationMsg("도로명 주소를 입력하세요.");
      return;
    }
    setAddressLoading(true);
    setVerificationMsg("");
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
      setVerificationMsg("주소 검색에 실패했습니다.");
      setAddressHelp("예시: Tashkent, Afrosiyob ko'chasi 7");
    } finally {
      setAddressLoading(false);
    }
  };

  const handleSelectAddress = (result: any) => {
    const display = result?.display_name ?? "";
    const postcode = result?.address?.postcode ?? "";
    setRoadAddress(display);
    setPostalCode(postcode);
    setAddressQuery("");
    setAddressResults([]);
    setAddressHelp("");
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
    const trimmedAddress = roadAddress.trim();

    if (!trimmedFarmName || !trimmedOwnerName || !trimmedPhone || !trimmedAddress) {
      setVerificationMsg("필수 정보를 모두 입력하세요.");
      return;
    }

    const licenseChanged = Boolean(licenseFile);
    const farmNameChanged = (verification?.farm_name ?? "") !== trimmedFarmName;
    const ownerNameChanged = (verification?.owner_name ?? "") !== trimmedOwnerName;
    const addressChanged = (verification?.address ?? "") !== trimmedAddress;
    const coreChanged =
      farmNameChanged || ownerNameChanged || addressChanged || licenseChanged;

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
          setRoadAddress(approvedSnapshot.roadAddress);
          setPostalCode(approvedSnapshot.postalCode);
          setAddressDetail(approvedSnapshot.addressDetail);
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

    let latitude = verification?.latitude ?? null;
    let longitude = verification?.longitude ?? null;
    const shouldGeocode =
      addressChanged || latitude == null || longitude == null;
    if (shouldGeocode) {
      try {
        const coords = await geocodeAddress(trimmedAddress);
        if (!coords) {
          setVerificationMsg("주소를 찾을 수 없습니다. 다시 확인해주세요.");
          setVerificationLoading(false);
          return;
        }
        latitude = coords.lat;
        longitude = coords.lng;
      } catch {
        setVerificationMsg("주소 좌표 변환에 실패했습니다.");
        setVerificationLoading(false);
        return;
      }
    }

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
      postal_code: postalCode.trim() || null,
      address_detail: addressDetail.trim() || null,
      location_note: locationNote.trim() || null,
      description: farmDescription.trim() || null,
      business_license_path: licensePath,
      latitude,
      longitude,
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
        roadAddress: saved.address ?? "",
        postalCode: saved.postal_code ?? "",
        addressDetail: saved.address_detail ?? "",
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
        <h2 className="font-medium">동네 변경</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="w-full max-w-sm rounded border px-3 py-2"
            placeholder="도로명 주소를 검색하세요"
            value={profileAddressQuery}
            onChange={(e) => setProfileAddressQuery(e.target.value)}
          />
          <button
            type="button"
            className="whitespace-nowrap rounded border px-3 py-2 text-sm"
            onClick={handleProfileAddressSearch}
          >
            {profileAddressLoading ? "검색 중..." : "주소 검색"}
          </button>
        </div>
        {profileAddressResults.length > 0 && (
          <div className="max-h-40 overflow-auto rounded border text-xs">
            {profileAddressResults.map((result, index) => (
              <button
                key={`${result.place_id}-${index}`}
                type="button"
                className="block w-full border-b px-3 py-2 text-left hover:bg-zinc-50"
                onClick={() => handleSelectProfileAddress(result)}
              >
                {result.display_name}
              </button>
            ))}
          </div>
        )}
        {profileAddressHelp && (
          <p className="text-xs text-zinc-500">{profileAddressHelp}</p>
        )}
        <input
          className="w-full max-w-sm rounded border px-3 py-2"
          placeholder="선택된 도로명 주소"
          value={profileRoadAddress}
          readOnly
        />
        <div className="grid w-full max-w-sm gap-2 sm:grid-cols-2">
          <input
            className="rounded border px-3 py-2"
            placeholder="우편번호"
            value={profilePostalCode}
            readOnly
          />
          <input
            className="rounded border px-3 py-2"
            placeholder="상세 주소"
            value={profileAddressDetail}
            onChange={(e) => setProfileAddressDetail(e.target.value)}
          />
        </div>
        <button
          className="rounded bg-zinc-900 px-4 py-2 text-white cursor-pointer"
          onClick={handleProfileAddressSave}
        >
          동네 저장
        </button>
        {addressMsg && <p className="text-sm text-zinc-600">{addressMsg}</p>}
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
        <div className="grid gap-4 md:grid-cols-2">
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
          <div className="space-y-2 text-sm md:col-span-2">
            <span className="font-medium">
              농장 주소 <span className="text-red-500">*</span>
            </span>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                className="w-full rounded border px-3 py-2"
                placeholder="도로명 주소를 검색하세요"
                value={addressQuery}
                onChange={(e) => setAddressQuery(e.target.value)}
                disabled={verification?.status === "approved" && !isEditingApproved}
              />
              <button
                className="whitespace-nowrap rounded border px-4 py-2 text-xs text-zinc-700"
                type="button"
                onClick={handleAddressSearch}
                disabled={
                  addressLoading ||
                  (verification?.status === "approved" && !isEditingApproved)
                }
              >
                {addressLoading ? "검색 중..." : "주소 검색"}
              </button>
            </div>
            {addressResults.length > 0 && (
              <div className="max-h-40 overflow-auto rounded border">
                {addressResults.map((result, index) => (
                  <button
                    key={`${result.place_id}-${index}`}
                    type="button"
                    className="block w-full border-b px-3 py-2 text-left text-xs hover:bg-zinc-50"
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
              className="w-full rounded border px-3 py-2"
              placeholder="선택된 도로명 주소"
              value={roadAddress}
              readOnly
            />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium">우편번호</span>
            <input
              className="w-full rounded border px-3 py-2"
              placeholder="우편번호"
              value={postalCode}
              readOnly
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">상세 주소</span>
            <input
              className="w-full rounded border px-3 py-2"
              placeholder="상세 주소"
              value={addressDetail}
              onChange={(e) => setAddressDetail(e.target.value)}
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
