"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";

const CATEGORIES = ["채소", "과일", "곡물", "기타"];
const FARMING_METHODS = ["유기농", "무농약", "저농약", "일반"];
const UNIT_OPTIONS = ["kg", "g", "박스", "개"];
const DELIVERY_TYPES = ["직거래", "팜스토어 배달", "개인 배달"];
const MAX_SIZE_MB = 5;

export default function NewPostPage() {
  const router = useRouter();
  const { session } = useAuth();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [farmingMethod, setFarmingMethod] = useState(FARMING_METHODS[0]);
  const [harvestDate, setHarvestDate] = useState("");
  const [unit, setUnit] = useState(UNIT_OPTIONS[0]);
  const [unitSize, setUnitSize] = useState("");
  const [deliveryType, setDeliveryType] = useState(DELIVERY_TYPES[0]);
  const [regionCode, setRegionCode] = useState("");
  const [regionName, setRegionName] = useState("");
  const [address, setAddress] = useState("");

  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [message, setMessage] = useState("");
  const [sellerStatus, setSellerStatus] = useState<
    "none" | "pending" | "approved" | "rejected"
  >("none");

  const inputBase =
    "w-full rounded border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-200";
  const selectBase =
    "rounded border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-200";
  const labelText = "font-medium text-zinc-800 drop-shadow-sm";

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      if (!session) return;
      const { data } = await supabase
        .from("profiles")
        .select("address,postal_code")
        .eq("id", session.user.id)
        .single();

      const { data: verification } = await supabase
        .from("seller_verifications")
        .select("status")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (cancelled) return;
      setAddress(data?.address ?? "");
      setRegionCode(data?.postal_code ?? "");
      setRegionName(data?.address ?? "");
      setSellerStatus((verification?.status ?? "none") as typeof sellerStatus);
    };

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const previewUrls = useMemo(
    () => files.map((file) => URL.createObjectURL(file)),
    [files]
  );

  useEffect(() => {
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

  const handleFiles = (list: FileList | null) => {
    if (!list) return;
    const selected = Array.from(list);

    const tooLarge = selected.find(
      (f) => f.size > MAX_SIZE_MB * 1024 * 1024
    );
    if (tooLarge) {
      setMessage(`파일 용량은 ${MAX_SIZE_MB}MB 이하만 가능합니다.`);
      return;
    }

    setFiles(selected);
    setMessage("");
  };

  const formatNumber = (value: string) => {
    const digits = value.replace(/[^\d]/g, "");
    if (!digits) return "";
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  const handlePriceChange = (value: string) => {
    setPrice(formatNumber(value));
  };

  const handleUnitSizeChange = (value: string) => {
    const cleaned = value.replace(/[^\d.]/g, "");
    const parts = cleaned.split(".");
    if (parts.length > 2) return;
    const normalized =
      parts.length === 2 ? `${parts[0]}.${parts[1]}` : parts[0];
    setUnitSize(normalized);
  };

  const handleQuantityChange = (value: string) => {
    const cleaned = value.replace(/[^\d]/g, "");
    setQuantity(cleaned);
  };

  const getSafeFileName = (file: File, index: number) => {
    const ext = file.name.includes(".")
      ? "." + file.name.split(".").pop()
      : "";
    return `${Date.now()}-${index}${ext}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) {
      setMessage("로그인이 필요합니다.");
      return;
    }
    if (sellerStatus !== "approved") {
      setMessage("판매자 인증 승인 후 등록할 수 있습니다.");
      return;
    }
    if (!address) {
      setMessage("먼저 마이페이지에서 동네를 설정하세요.");
      return;
    }
    if (!title.trim()) {
      alert("상품명을 입력해주세요.");
      return;
    }
    if (!category) {
      alert("카테고리를 선택해주세요.");
      return;
    }
    if (!price) {
      alert("판매 가격을 입력해주세요.");
      return;
    }
    if (!quantity) {
      alert("총 재고 수량을 입력해주세요.");
      return;
    }

    setUploading(true);
    setUploadedCount(0);

    const { data: post, error: postError } = await supabase
      .from("posts")
      .insert({
        user_id: session.user.id,
        title,
        description,
        content: description,
        region_code: regionCode,
        region_name: regionName,
        price: price ? Number(price.replace(/,/g, "")) : null,
        stock_quantity: quantity ? Number(quantity) : null,
        unit_size: unitSize ? Number(unitSize) : null,
        unit,
        delivery_type: deliveryType,
        harvest_date: harvestDate || null,
        status: "ON_SALE",
        category,
      })
      .select("id")
      .single();

    if (postError || !post) {
      setMessage(postError?.message ?? "게시글 등록 실패");
      setUploading(false);
      return;
    }

    const postId = post.id as string;

    const imageRows: {
      post_id: string;
      user_id: string;
      storage_path: string;
      sort_order: number;
    }[] = [];

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      const safeName = getSafeFileName(file, i);
      const path = `${session.user.id}/${postId}/${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("post-images")
        .upload(path, file, { cacheControl: "3600", upsert: false });

      if (uploadError) {
        setMessage(uploadError.message);
        setUploading(false);
        return;
      }

      imageRows.push({
        post_id: postId,
        user_id: session.user.id,
        storage_path: path,
        sort_order: i,
      });
      setUploadedCount(i + 1);
    }

    if (imageRows.length > 0) {
      const { error: imageError } = await supabase
        .from("post_images")
        .insert(imageRows);

      if (imageError) {
        setMessage(imageError.message);
        setUploading(false);
        return;
      }
    }

    setUploading(false);
    router.replace(`/posts/${postId}`);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">상품 등록</h1>
      <p className="text-sm text-zinc-600">
        동네: {regionName || regionCode || "미설정"}
      </p>
      {sellerStatus !== "approved" && (
        <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          판매자 인증 승인 후 판매글을 등록할 수 있습니다. 마이페이지에서
          인증 요청을 진행해주세요.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div
          className={`rounded border-2 border-dashed p-4 text-sm transition ${
            isDragging
              ? "border-zinc-900 bg-zinc-50"
              : "border-zinc-300 bg-white"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            handleFiles(e.dataTransfer.files);
          }}
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className={labelText}>이미지 업로드</p>
              <p className="text-xs text-zinc-500">
                드래그 앤 드롭 또는 파일 선택 (최대 {MAX_SIZE_MB}MB)
              </p>
            </div>
            <label className="inline-flex cursor-pointer items-center justify-center rounded bg-zinc-900 px-3 py-2 text-xs text-white">
              파일 선택
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
            </label>
          </div>
          {files.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {previewUrls.map((src, index) => (
                <div
                  key={`${files[index]?.name}-${index}`}
                  className="aspect-square overflow-hidden rounded border border-zinc-200 bg-zinc-50"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={`업로드 이미지 ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className={labelText}>제목</span>
            <input
              className={inputBase}
              placeholder="예: 꿀고구마, 못난이 감자 (상품명을 입력하세요)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className={labelText}>카테고리</span>
            <select
              className={inputBase}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <div className="space-y-2 text-sm md:col-span-2">
            <span className={labelText}>배송 유형</span>
            <div className="flex flex-wrap gap-2">
              {DELIVERY_TYPES.map((type) => {
                const selected = type === deliveryType;
                return (
                  <button
                    key={type}
                    type="button"
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      selected
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                    }`}
                    onClick={() => setDeliveryType(type)}
                  >
                    {type}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2 text-sm md:col-span-2">
            <span className={labelText}>재배 방식</span>
            <div className="flex flex-wrap gap-2">
              {FARMING_METHODS.map((method) => {
                const selected = method === farmingMethod;
                return (
                  <button
                    key={method}
                    type="button"
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      selected
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                    }`}
                    onClick={() => setFarmingMethod(method)}
                  >
                    {method}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="space-y-1 text-sm">
            <span className={labelText}>수확일</span>
            <input
              type="date"
              className={inputBase}
              value={harvestDate}
              onChange={(e) => setHarvestDate(e.target.value)}
            />
          </label>

          <div className="space-y-2 text-sm md:col-span-2">
            <span className={labelText}>판매 단위 (규격)</span>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                className={inputBase}
                placeholder="예: 5"
                value={unitSize}
                inputMode="decimal"
                onChange={(e) => handleUnitSizeChange(e.target.value)}
              />
              <select
                className={`${selectBase} text-sm`}
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              >
                {UNIT_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2 text-sm md:col-span-2">
            <span className={labelText}>가격 및 재고</span>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-2">
                <input
                  className={inputBase}
                  placeholder="0"
                  value={price}
                  inputMode="numeric"
                  onChange={(e) => handlePriceChange(e.target.value)}
                />
                <span className="text-xs text-zinc-600">원</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  className={inputBase}
                  placeholder="예: 100"
                  value={quantity}
                  inputMode="numeric"
                  onChange={(e) => handleQuantityChange(e.target.value)}
                />
                <span className="text-xs text-zinc-600">개</span>
              </div>
            </div>
            <p className="text-xs text-zinc-500">
              현재 판매 가능한 총 수량을 입력하세요.
            </p>
          </div>

          <label className="space-y-1 text-sm md:col-span-2">
            <span className={labelText}>설명</span>
            <textarea
              className={inputBase}
              placeholder="예: 재배 과정, 맛의 특징, 보관 방법, 추천 요리 등을 적어주세요. 자세히 적을수록 판매가 잘 됩니다!"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </label>
        </div>

        <div className="flex justify-end">
          <button
            className="w-full rounded bg-lime-600 px-5 py-3 text-white shadow-sm hover:bg-lime-500 sm:w-auto"
            disabled={uploading}
          >
            {uploading
              ? `업로드 중... (${uploadedCount}/${files.length})`
              : "등록"}
          </button>
        </div>
      </form>

      {message && <p className="text-sm text-zinc-600">{message}</p>}
    </div>
  );
}
