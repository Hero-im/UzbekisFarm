"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";

const CATEGORIES = ["채소", "과일", "곡물", "기타"];
const FARMING_METHODS = ["유기농", "무농약", "저농약", "일반"];
const UNIT_OPTIONS = ["kg", "g", "박스", "개"];
const DELIVERY_TYPES = ["직거래", "팜스토어 배달", "개인 배달"];
const MAX_SIZE_MB = 5;

type ExistingImage = {
  id: string;
  storage_path: string;
  sort_order: number;
  url: string;
};

export default function NewPostPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session } = useAuth();
  const editPostId = searchParams.get("edit");
  const isEditing = Boolean(editPostId);

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
  const [existingImages, setExistingImages] = useState<ExistingImage[]>([]);
  const [removedImages, setRemovedImages] = useState<ExistingImage[]>([]);

  const MAX_IMAGES = 10;
  const totalImageCount = existingImages.length + files.length;

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

  useEffect(() => {
    let cancelled = false;

    const loadEditPost = async () => {
      if (!session || !editPostId) {
        setExistingImages([]);
        setRemovedImages([]);
        setFiles([]);
        setTitle("");
        setDescription("");
        setCategory(CATEGORIES[0]);
        setFarmingMethod(FARMING_METHODS[0]);
        setHarvestDate("");
        setUnit(UNIT_OPTIONS[0]);
        setUnitSize("");
        setDeliveryType(DELIVERY_TYPES[0]);
        setRegionCode("");
        setRegionName("");
        setPrice("");
        setQuantity("");
        setMessage("");
        return;
      }

      let postData: any = null;
      let postError: { message: string } | null = null;
      const primary = await supabase
        .from("posts")
        .select(
          "id,user_id,title,description,content,price,stock_quantity,category,harvest_date,unit,unit_size,delivery_type,region_code,region_name,farming_method"
        )
        .eq("id", editPostId)
        .single();

      if (primary.error) {
        const message = primary.error.message ?? "";
        if (message.includes("harvest_date")) {
          const fallback = await supabase
            .from("posts")
            .select(
              "id,user_id,title,description,content,price,stock_quantity,category,unit,unit_size,delivery_type,region_code,region_name,farming_method"
            )
            .eq("id", editPostId)
            .single();
          postData = fallback.data ?? null;
          postError = fallback.error
            ? { message: fallback.error.message }
            : null;
        } else {
          postError = { message: message || "게시글 불러오기 실패" };
        }
      } else {
        postData = primary.data ?? null;
      }

      if (cancelled) return;
      if (postError || !postData) {
        setMessage(postError?.message ?? "게시글 불러오기 실패");
        return;
      }
      if (postData.user_id !== session.user.id) {
        setMessage("수정 권한이 없습니다.");
        return;
      }

      setTitle(postData.title ?? "");
      setDescription(postData.description ?? postData.content ?? "");
      setCategory(postData.category ?? CATEGORIES[0]);
      setFarmingMethod(postData.farming_method ?? FARMING_METHODS[0]);
      setHarvestDate(postData.harvest_date ?? "");
      setUnit(postData.unit ?? UNIT_OPTIONS[0]);
      setUnitSize(postData.unit_size != null ? String(postData.unit_size) : "");
      setDeliveryType(postData.delivery_type ?? DELIVERY_TYPES[0]);
      setRegionCode(postData.region_code ?? "");
      setRegionName(postData.region_name ?? "");
      setPrice(
        postData.price != null ? postData.price.toLocaleString("ko-KR") : ""
      );
      setQuantity(
        postData.stock_quantity != null ? String(postData.stock_quantity) : ""
      );
      setFiles([]);
      setRemovedImages([]);
      setMessage("");

      const { data: imageData } = await supabase
        .from("post_images")
        .select("id,storage_path,sort_order")
        .eq("post_id", editPostId)
        .order("sort_order", { ascending: true });

      const mapped = (imageData ?? []).map((img) => {
        const { data } = supabase.storage
          .from("post-images")
          .getPublicUrl(img.storage_path);
        return {
          id: img.id,
          storage_path: img.storage_path,
          sort_order: img.sort_order,
          url: data.publicUrl,
        };
      });

      setExistingImages(mapped);
      setRemovedImages([]);
    };

    loadEditPost();
    return () => {
      cancelled = true;
    };
  }, [session, editPostId]);

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

    if (totalImageCount + selected.length > MAX_IMAGES) {
      setMessage(`이미지는 최대 ${MAX_IMAGES}장까지 업로드할 수 있습니다.`);
      return;
    }

    setFiles((prev) => [...prev, ...selected]);
    setMessage("");
  };

  const handleRemoveNewFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveExisting = (image: ExistingImage) => {
    setExistingImages((prev) => prev.filter((img) => img.id !== image.id));
    setRemovedImages((prev) => [...prev, image]);
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
    setMessage("");
    if (!session) {
      setMessage("로그인이 필요합니다.");
      return;
    }
    if (sellerStatus !== "approved" && !isEditing) {
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

    const basePayload = {
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
      farming_method: farmingMethod,
      category,
    };
    const payloadWithHarvest = {
      ...basePayload,
      harvest_date: harvestDate || null,
    };

    let post: { id: string } | null = null;
    let postError: { message: string } | null = null;

    if (isEditing && editPostId) {
      const updateWithHarvest = await supabase
        .from("posts")
        .update(payloadWithHarvest)
        .eq("id", editPostId)
        .eq("user_id", session.user.id)
        .select("id")
        .single();

      if (updateWithHarvest.error) {
        const message = updateWithHarvest.error.message ?? "";
        if (message.includes("harvest_date")) {
          const fallback = await supabase
            .from("posts")
            .update(basePayload)
            .eq("id", editPostId)
            .eq("user_id", session.user.id)
            .select("id")
            .single();
          post = (fallback.data as { id: string }) ?? null;
          postError = fallback.error
            ? { message: fallback.error.message }
            : null;
        } else {
          postError = { message: message || "게시글 수정 실패" };
        }
      } else {
        post = (updateWithHarvest.data as { id: string }) ?? null;
      }
    } else {
      const primary = await supabase
        .from("posts")
        .insert({ ...payloadWithHarvest, status: "ON_SALE" })
        .select("id")
        .single();

      if (primary.error) {
        const message = primary.error.message ?? "";
        if (message.includes("harvest_date")) {
          const fallback = await supabase
            .from("posts")
            .insert({ ...basePayload, status: "ON_SALE" })
            .select("id")
            .single();
          post = (fallback.data as { id: string }) ?? null;
          postError = fallback.error
            ? { message: fallback.error.message }
            : null;
        } else {
          postError = { message: message || "게시글 등록 실패" };
        }
      } else {
        post = (primary.data as { id: string }) ?? null;
      }
    }

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

    const maxSortOrder = existingImages.reduce(
      (max, img) => Math.max(max, img.sort_order ?? 0),
      0
    );

    if (isEditing && removedImages.length > 0) {
      const removedIds = removedImages.map((img) => img.id);
      const removedPaths = removedImages.map((img) => img.storage_path);
      if (removedPaths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from("post-images")
          .remove(removedPaths);
        if (storageError) {
          setMessage(storageError.message);
          setUploading(false);
          return;
        }
      }
      const { error: removeError } = await supabase
        .from("post_images")
        .delete()
        .in("id", removedIds);
      if (removeError) {
        setMessage(removeError.message);
        setUploading(false);
        return;
      }
    }

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
        sort_order: maxSortOrder + i + 1,
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
      <h1 className="text-2xl font-bold">
        {isEditing ? "상품 수정" : "상품 등록"}
      </h1>
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
            <div className="flex items-center gap-2">
              <p className={labelText}>이미지 업로드</p>
              <span className="text-xs font-semibold text-lime-600">
                ({totalImageCount}/{MAX_IMAGES})
              </span>
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
                onChange={(e) => {
                  handleFiles(e.target.files);
                  e.currentTarget.value = "";
                }}
              />
            </label>
          </div>
          {(existingImages.length > 0 || files.length > 0) && (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {existingImages.map((img) => (
                <div
                  key={img.id}
                  className="group relative aspect-square overflow-hidden rounded border border-zinc-200 bg-zinc-50"
                >
                  <img
                    src={img.url}
                    alt="기존 이미지"
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveExisting(img)}
                    className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-1 text-xs text-zinc-700 shadow-sm opacity-0 transition group-hover:opacity-100"
                  >
                    삭제
                  </button>
                </div>
              ))}
              {previewUrls.map((src, index) => (
                <div
                  key={`${files[index]?.name}-${index}`}
                  className="group relative aspect-square overflow-hidden rounded border border-dashed border-zinc-300 bg-white"
                >
                  <img
                    src={src}
                    alt={`새 이미지 ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveNewFile(index)}
                    className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-1 text-xs text-zinc-700 shadow-sm opacity-0 transition group-hover:opacity-100"
                  >
                    삭제
                  </button>
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

        <div className="flex justify-end gap-2">
          {isEditing && (
            <button
              type="button"
              className="w-full rounded border border-zinc-300 bg-white px-5 py-3 text-zinc-700 shadow-sm hover:border-zinc-900 sm:w-auto"
              onClick={() => router.push(`/posts/${editPostId}`)}
              disabled={uploading}
            >
              취소
            </button>
          )}
          <button
            type="submit"
            className="w-full rounded bg-lime-600 px-5 py-3 text-white shadow-sm hover:bg-lime-500 sm:w-auto"
            disabled={uploading}
          >
            {uploading
              ? files.length > 0
                ? `업로드 중... (${uploadedCount}/${files.length})`
                : "저장 중..."
              : isEditing
              ? "수정 저장"
              : "등록"}
          </button>
        </div>
      </form>

      {message && <p className="text-sm text-zinc-600">{message}</p>}
    </div>
  );
}
