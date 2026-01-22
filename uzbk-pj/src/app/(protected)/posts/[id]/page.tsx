"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import Loading from "@/components/Loading";

type Post = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  content: string | null;
  region_name: string | null;
  region_code: string | null;
  price: number | null;
  stock_quantity: number | null;
  unit_size: number | null;
  unit: string | null;
  delivery_type: string | null;
  farming_method: string | null;
  category: string | null;
  created_at: string;
  status: string | null;
};

type ImageRow = {
  id: string;
  storage_path: string;
  sort_order: number;
  url: string;
};

type Seller = {
  nickname: string | null;
  region_name: string | null;
  region_code: string | null;
};

type ShippingAddress = {
  id: string;
  label: string | null;
  receiver_name: string | null;
  receiver_phone: string | null;
  postal_code: string | null;
  road_address: string | null;
  address_detail: string | null;
  is_default: boolean | null;
};

const STATUS_OPTIONS = [
  { value: "ON_SALE", label: "판매중", className: "text-blue-600" },
  { value: "RESERVED", label: "예약중", className: "text-green-600" },
  { value: "COMPLETED", label: "판매종료", className: "text-red-600" },
];


export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session } = useAuth();
  const postId = params.id as string;

  const [post, setPost] = useState<Post | null>(null);
  const [images, setImages] = useState<ImageRow[]>([]);
  const [seller, setSeller] = useState<Seller | null>(null);
  const [farmName, setFarmName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [current, setCurrent] = useState(0);
  const [statusDraft, setStatusDraft] = useState("ON_SALE");
  const [isBuyOpen, setIsBuyOpen] = useState(false);
  const [buyQuantity, setBuyQuantity] = useState("1");
  const [shippingAddresses, setShippingAddresses] = useState<
    ShippingAddress[]
  >([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>("manual");
  const [addressLabel, setAddressLabel] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [recipientCountry, setRecipientCountry] = useState("+82");
  const [postalCode, setPostalCode] = useState("");
  const [roadAddress, setRoadAddress] = useState("");
  const [addressDetail, setAddressDetail] = useState("");
  const [addressMemo, setAddressMemo] = useState("");
  const [buyAddressQuery, setBuyAddressQuery] = useState("");
  const [buyAddressResults, setBuyAddressResults] = useState<any[]>([]);
  const [buyAddressLoading, setBuyAddressLoading] = useState(false);
  const [buyAddressHelp, setBuyAddressHelp] = useState("");
  const [isAddressPickerOpen, setIsAddressPickerOpen] = useState(false);
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [addressPickerSnapshot, setAddressPickerSnapshot] = useState("manual");
  const [saveAddress, setSaveAddress] = useState(false);
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [buyError, setBuyError] = useState("");
  const [buyLoading, setBuyLoading] = useState(false);
  const [autoBuyOpened, setAutoBuyOpened] = useState(false);
  const [addressPickerError, setAddressPickerError] = useState("");
  const [useManualAddress, setUseManualAddress] = useState(false);
  const [memoPreset, setMemoPreset] = useState("문 앞에 놔주세요");
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [modalIndex, setModalIndex] = useState(0);
  const formatPhone = (value: string) => {
    const digits = value.replace(/[^\d]/g, "");
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) {
      return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    }
    if (digits.length <= 11) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    }
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(
      7,
      11
    )}`;
  };

  const splitPhone = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return { country: "+82", local: "" };
    if (trimmed.startsWith("+")) {
      const [country, ...rest] = trimmed.split(" ");
      return { country, local: rest.join(" ") };
    }
    return { country: "+82", local: trimmed };
  };

  const resetManualAddress = () => {
    setSelectedAddressId("manual");
    setUseManualAddress(true);
    setAddressLabel("");
    setRecipientName("");
    setRecipientPhone("");
    setRecipientCountry("+82");
    setPostalCode("");
    setRoadAddress("");
    setAddressDetail("");
    setAddressMemo("");
    setBuyAddressQuery("");
    setBuyAddressResults([]);
    setBuyAddressHelp("");
    setSaveAddress(false);
    setSaveAsDefault(false);
  };

  useEffect(() => {
    if (isAddingAddress) {
      resetManualAddress();
    }
  }, [isAddingAddress]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { data: postData, error } = await supabase
        .from("posts")
        .select(
          "id,user_id,title,description,content,region_name,region_code,price,category,created_at,status,stock_quantity,unit_size,unit,delivery_type,farming_method"
        )
        .eq("id", postId)
        .single();

      if (cancelled) return;

      if (error) {
        setMessage(error.message);
        setLoading(false);
        return;
      }

      const { data: imgData } = await supabase
        .from("post_images")
        .select("id,storage_path,sort_order")
        .eq("post_id", postId)
        .order("sort_order", { ascending: true });

      const imgRows = (imgData ?? []).map((img) => {
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

      const { data: sellerData } = await supabase
        .from("profiles")
        .select("nickname,region_name,region_code")
        .eq("id", postData.user_id)
        .single();

      const { data: farmData } = await supabase
        .from("seller_verifications")
        .select("farm_name")
        .eq("user_id", postData.user_id)
        .eq("status", "approved")
        .maybeSingle();

      setPost(postData as Post);
      setStatusDraft(postData.status ?? "ON_SALE");
      setImages(imgRows);
      setSeller(sellerData ?? null);
      setFarmName(farmData?.farm_name ?? null);
      setLoading(false);
    };

    if (postId) load();
    return () => {
      cancelled = true;
    };
  }, [postId, session]);

  useEffect(() => {
    let cancelled = false;

    const loadAddresses = async () => {
      if (!session) return;
      const { data } = await supabase
        .from("shipping_addresses")
        .select(
          "id,label,receiver_name,receiver_phone,postal_code,road_address,address_detail,is_default"
        )
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      if (cancelled) return;
      setShippingAddresses((data ?? []) as ShippingAddress[]);

      if (!isAddingAddress && !useManualAddress) {
        const currentExists = (data ?? []).some(
          (addr) => addr.id === selectedAddressId
        );
        if (!currentExists || selectedAddressId === "manual") {
          const defaultAddress = (data ?? []).find((addr) => addr.is_default);
          if (defaultAddress) {
            setSelectedAddressId(defaultAddress.id);
          } else if ((data ?? []).length > 0) {
            setSelectedAddressId((data ?? [])[0].id);
          }
        }
      }
    };

    loadAddresses();
    return () => {
      cancelled = true;
    };
  }, [session, selectedAddressId, isAddingAddress, useManualAddress]);

  useEffect(() => {
    if (isAddingAddress || useManualAddress) return;
    if (selectedAddressId === "manual") return;
    const selected = shippingAddresses.find(
      (addr) => addr.id === selectedAddressId
    );
    if (!selected) return;
    setAddressLabel(selected.label ?? "");
    setRecipientName(selected.receiver_name ?? "");
    const parsed = splitPhone(selected.receiver_phone ?? "");
    setRecipientCountry(parsed.country);
    setRecipientPhone(parsed.local);
    setPostalCode(selected.postal_code ?? "");
    setRoadAddress(selected.road_address ?? "");
    setAddressDetail(selected.address_detail ?? "");
  }, [selectedAddressId, shippingAddresses, isAddingAddress, useManualAddress]);

  const isSeller = useMemo(() => {
    return session?.user.id === post?.user_id;
  }, [session, post]);

  const desc = post?.description ?? post?.content ?? "";
  const PAGE_SIZE = 3;
  const totalPages = Math.max(1, Math.ceil(images.length / PAGE_SIZE));
  const currentPage = Math.min(current, totalPages - 1);
  const startIndex = currentPage * PAGE_SIZE;
  const visibleImages = images.slice(startIndex, startIndex + PAGE_SIZE);
  const placeholderCount = Math.max(0, PAGE_SIZE - visibleImages.length);
  const primaryImage = images[0]?.url ?? null;
  const currentStatus = statusDraft;
  const statusOption =
    STATUS_OPTIONS.find((option) => option.value === currentStatus) ??
    STATUS_OPTIONS[0];
  const statusBadgeClass =
    currentStatus === "ON_SALE"
      ? "bg-blue-50 text-blue-700 border-blue-200"
      : currentStatus === "RESERVED"
      ? "bg-green-50 text-green-700 border-green-200"
      : "bg-red-50 text-red-700 border-red-200";
  const priceLabel =
    post?.price != null ? `${post.price.toLocaleString("ko-KR")}원` : "가격 미정";
  const isSoldOut = post?.stock_quantity === 0;
  const isStockUnavailable =
    post?.stock_quantity == null || post.stock_quantity <= 0;
  const stockLabel =
    post?.stock_quantity != null ? `${post.stock_quantity}개` : "재고 미정";
  const unitLabel =
    post?.unit_size && post?.unit ? `${post.unit_size} ${post.unit}` : null;
  const maxBuyQuantity = post?.stock_quantity ?? 10;
  const selectedShipping =
    selectedAddressId !== "manual"
      ? shippingAddresses.find((addr) => addr.id === selectedAddressId)
      : null;
  const shippingLabel = selectedShipping?.label ?? addressLabel.trim();
  const shippingName =
    selectedShipping?.receiver_name ?? recipientName.trim();
  const shippingPhone =
    selectedShipping?.receiver_phone ??
    (recipientPhone ? `${recipientCountry} ${recipientPhone}` : "");
  const shippingAddressLine =
    selectedShipping?.road_address ?? roadAddress.trim();
  const shippingDetailLine =
    selectedShipping?.address_detail ?? addressDetail.trim();

  useEffect(() => {
    if (!searchParams || autoBuyOpened) return;
    if (searchParams.get("buy") !== "1") return;
    if (isSeller) return;
    handleBuyClick();
    setAutoBuyOpened(true);
  }, [searchParams, autoBuyOpened, isSeller]);

  useEffect(() => {
    setCurrent((prev) => Math.min(prev, totalPages - 1));
  }, [totalPages]);

  useEffect(() => {
    if (!isImageModalOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsImageModalOpen(false);
      }
      if (event.key === "ArrowLeft" && images.length > 1) {
        setModalIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
      }
      if (event.key === "ArrowRight" && images.length > 1) {
        setModalIndex((prev) => (prev + 1) % images.length);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isImageModalOpen, images.length]);

  const handleDelete = async () => {
    if (!post || !session) return;
    if (!confirm("등록하신 상품을 삭제하시겠습니까?")) return;

    const { data: imgData } = await supabase
      .from("post_images")
      .select("storage_path")
      .eq("post_id", post.id);

    const paths = (imgData ?? []).map((i) => i.storage_path);
    if (paths.length > 0) {
      await supabase.storage.from("post-images").remove(paths);
    }

    await supabase.from("post_images").delete().eq("post_id", post.id);
    await supabase.from("posts").delete().eq("id", post.id);

    router.replace("/feed");
  };

  const handleChat = async () => {
    if (!post || !session) return;

    const buyerId = session.user.id;
    const sellerId = post.user_id;

    if (buyerId === sellerId) return;

    const { data: existing } = await supabase
      .from("chat_rooms")
      .select("id")
      .eq("buyer_id", buyerId)
      .eq("seller_id", sellerId)
      .eq("post_id", post.id)
      .maybeSingle();

    let roomId = existing?.id;

    if (!roomId) {
      const { data: created, error } = await supabase
        .from("chat_rooms")
        .insert({
          buyer_id: buyerId,
          seller_id: sellerId,
          post_id: post.id,
        })
        .select("id")
        .single();

      if (error) {
        setMessage(error.message);
        return;
      }

      roomId = created?.id;
    }

    if (roomId) {
      router.push(`/chat/${roomId}`);
    }
  };

  const handleBuyAddressSearch = async () => {
    const query = buyAddressQuery.trim();
    if (!query) {
      setBuyAddressHelp("도로명 주소를 입력하세요.");
      return;
    }
    setBuyAddressLoading(true);
    setBuyAddressHelp("");
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
      setBuyAddressResults(data ?? []);
      if (!data?.length) {
        setBuyAddressHelp(
          "검색된 주소가 없습니다. 도시/구/동까지 포함해 다시 입력해보세요."
        );
      }
    } catch {
      setBuyAddressHelp("예시: Tashkent, Afrosiyob ko'chasi 7");
    } finally {
      setBuyAddressLoading(false);
    }
  };

  const handleSelectBuyAddress = (result: any) => {
    const display = result?.display_name ?? "";
    const postcode = result?.address?.postcode ?? "";
    setRoadAddress(display);
    setPostalCode(postcode);
    setBuyAddressQuery("");
    setBuyAddressResults([]);
    setBuyAddressHelp("");
  };

  const handleBuyClick = () => {
    if (!session) {
      setMessage("로그인이 필요합니다.");
      return;
    }
    setBuyQuantity("1");
    setBuyError("");
    setSaveAddress(false);
    setSaveAsDefault(false);
    setUseManualAddress(false);
    setBuyAddressQuery("");
    setBuyAddressResults([]);
    setBuyAddressHelp("");
    setMemoPreset("문 앞에 놔주세요");
    setAddressMemo("문 앞에 놔주세요");
    const defaultAddress = shippingAddresses.find((addr) => addr.is_default);
    if (defaultAddress) {
      setSelectedAddressId(defaultAddress.id);
    } else if (shippingAddresses.length > 0) {
      setSelectedAddressId(shippingAddresses[0].id);
    } else {
      setSelectedAddressId("manual");
      setAddressLabel("");
      setRecipientName("");
      setRecipientPhone("");
      setRecipientCountry("+82");
      setPostalCode("");
      setRoadAddress("");
      setAddressDetail("");
      setAddressMemo("");
    }
    setIsBuyOpen(true);
  };

  const handlePurchase = async () => {
    if (!post || !session) return;
    if (post.price == null) {
      setBuyError("가격이 설정되지 않은 상품입니다.");
      return;
    }
    if (!recipientName.trim() || !recipientPhone.trim()) {
      setBuyError("수령인 이름과 연락처를 입력하세요.");
      return;
    }
    if (!roadAddress.trim()) {
      setBuyError("도로명 주소를 입력하세요.");
      return;
    }
    const quantity = Number(buyQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setBuyError("구매 수량을 올바르게 입력하세요.");
      return;
    }
    if (!post.stock_quantity || post.stock_quantity <= 0) {
      setBuyError("현재 재고가 없습니다.");
      return;
    }
    const maxAllowed = post.stock_quantity;
    if (quantity > maxAllowed) {
      setBuyError(`최대 구매 수량은 ${maxAllowed}개입니다.`);
      return;
    }

    setBuyLoading(true);
    setBuyError("");

    let addressId =
      selectedAddressId !== "manual" ? selectedAddressId : null;

    if (saveAddress) {
      if (saveAsDefault) {
        await supabase
          .from("shipping_addresses")
          .update({ is_default: false })
          .eq("user_id", session.user.id);
      }

      const { data: savedAddress, error: saveError } = await supabase
        .from("shipping_addresses")
        .insert({
          user_id: session.user.id,
          label: addressLabel.trim() || null,
          receiver_name: recipientName.trim(),
          receiver_phone: `${recipientCountry} ${recipientPhone.trim()}`,
          postal_code: postalCode.trim() || null,
          road_address: roadAddress.trim(),
          address_detail: addressDetail.trim() || null,
          is_default: saveAsDefault,
        })
        .select(
          "id,label,receiver_name,receiver_phone,postal_code,road_address,address_detail,is_default"
        )
        .single();

      if (saveError) {
        setBuyError(saveError.message);
        setBuyLoading(false);
        return;
      }
      if (savedAddress) {
        addressId = savedAddress.id;
        setSelectedAddressId(savedAddress.id);
        setIsAddingAddress(false);
        setShippingAddresses((prev) => {
          const normalized = saveAsDefault
            ? prev.map((addr) => ({ ...addr, is_default: false }))
            : prev;
          return [
            savedAddress as ShippingAddress,
            ...normalized.filter((addr) => addr.id !== savedAddress.id),
          ];
        });
      }
    }

    const { data: purchaseData, error: purchaseError } = await supabase.rpc(
      "create_order_and_decrement_stock",
      {
        p_post_id: post.id,
        p_quantity: quantity,
        p_shipping_address_id: addressId,
        p_recipient_name: recipientName.trim(),
        p_recipient_phone: `${recipientCountry} ${recipientPhone.trim()}`,
        p_label: addressLabel.trim() || null,
        p_postal_code: postalCode.trim() || null,
        p_road_address: roadAddress.trim(),
        p_address_detail: addressDetail.trim() || null,
        p_memo: addressMemo.trim() || null,
      }
    );

    if (purchaseError || !purchaseData?.length) {
      const message = purchaseError?.message ?? "주문 처리에 실패했습니다.";
      setBuyError(message);
      setBuyLoading(false);
      return;
    }

    const purchaseResult = purchaseData[0] as {
      order_id: string;
      remaining_stock: number | null;
      total_price?: number | null;
    };
    const totalPrice = post.price * quantity;

    const { data: existing } = await supabase
      .from("chat_rooms")
      .select("id")
      .eq("buyer_id", session.user.id)
      .eq("seller_id", post.user_id)
      .eq("post_id", post.id)
      .maybeSingle();

    let roomId = existing?.id;
    if (!roomId) {
      const { data: created, error } = await supabase
        .from("chat_rooms")
        .insert({
          buyer_id: session.user.id,
          seller_id: post.user_id,
          post_id: post.id,
        })
        .select("id")
        .single();

      if (error) {
        setBuyError(error.message);
        setBuyLoading(false);
        return;
      }
      roomId = created?.id;
    }

    if (roomId) {
      const orderPayload = {
        order_id: purchaseResult.order_id,
        post_id: post.id,
        title: post.title,
        quantity,
        total_price: totalPrice,
        thumbnail: images[0]?.url ?? null,
      };

      await supabase.from("chat_messages").insert([
        {
          room_id: roomId,
          sender_id: session.user.id,
          content: `__SYSTEM__:[${post.title}] 결제가 완료되었습니다.`,
        },
        {
          room_id: roomId,
          sender_id: session.user.id,
          content: `__ORDER__:${JSON.stringify(orderPayload)}`,
        },
      ]);
    }

    setPost((prev) =>
      prev
        ? {
            ...prev,
            stock_quantity:
              purchaseResult.remaining_stock ?? prev.stock_quantity,
          }
        : prev
    );
    setBuyLoading(false);
    setIsBuyOpen(false);
    if (roomId) {
      router.push(`/chat/${roomId}`);
    }
  };

  const handleApplyManualAddress = async () => {
    setAddressPickerError("");
    if (!session) {
      setAddressPickerError("로그인이 필요합니다.");
      return;
    }
    if (!recipientName.trim() || !recipientPhone.trim()) {
      setAddressPickerError("수령인 이름과 연락처를 입력하세요.");
      return;
    }
    if (!roadAddress.trim()) {
      setAddressPickerError("도로명 주소를 입력하세요.");
      return;
    }

    if (saveAddress) {
      if (saveAsDefault) {
        await supabase
          .from("shipping_addresses")
          .update({ is_default: false })
          .eq("user_id", session.user.id);
      }

      const { data: savedAddress, error: saveError } = await supabase
        .from("shipping_addresses")
        .insert({
          user_id: session.user.id,
          label: addressLabel.trim() || null,
          receiver_name: recipientName.trim(),
          receiver_phone: `${recipientCountry} ${recipientPhone.trim()}`,
          postal_code: postalCode.trim() || null,
          road_address: roadAddress.trim(),
          address_detail: addressDetail.trim() || null,
          is_default: saveAsDefault,
        })
        .select(
          "id,label,receiver_name,receiver_phone,postal_code,road_address,address_detail,is_default"
        )
        .single();

      if (saveError || !savedAddress) {
        setAddressPickerError(saveError?.message ?? "배송지 저장에 실패했습니다.");
        return;
      }

      setShippingAddresses((prev) => {
        const normalized = saveAsDefault
          ? prev.map((addr) => ({ ...addr, is_default: false }))
          : prev;
        return [
          savedAddress as ShippingAddress,
          ...normalized.filter((addr) => addr.id !== savedAddress.id),
        ];
      });
      setSelectedAddressId(savedAddress.id);
      setUseManualAddress(false);
      setSaveAddress(false);
      setSaveAsDefault(false);
    } else {
      setSelectedAddressId("manual");
      setUseManualAddress(true);
    }

    setIsAddingAddress(false);
    setIsAddressPickerOpen(false);
  };

  const handleStatusChange = async (nextStatus: string) => {
    if (!post || !session) return;
    setStatusDraft(nextStatus);

    const { error } = await supabase
      .from("posts")
      .update({ status: nextStatus })
      .eq("id", post.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setPost({ ...post, status: nextStatus });
  };

  if (loading) return <Loading />;
  if (message) return <p className="text-sm text-red-600">{message}</p>;
  if (!post) return <p>게시글을 찾을 수 없습니다.</p>;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 pb-12 md:px-0">
      <div className="grid gap-8 lg:grid-cols-[1.1fr,0.9fr]">
        <div className="space-y-4">
          <div className="relative rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div className="flex flex-1 flex-wrap items-center gap-4">
                <span
                  className={`rounded-full border px-5 py-2 text-base font-semibold ${statusBadgeClass}`}
                >
                  {statusOption.label}
                </span>
                {!isSeller && (
                  <div className="text-base text-zinc-500 leading-relaxed">
                    <div>작성자: {seller?.nickname ?? "판매자"}</div>
                    <div>등록일: {post.created_at.slice(0, 10)}</div>
                  </div>
                )}
                {isSeller && (
                  <select
                    className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700"
                    value={currentStatus}
                    onChange={(e) => handleStatusChange(e.target.value)}
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option
                        key={option.value}
                        value={option.value}
                        className={option.className}
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>
                )}
                {isSoldOut && (
                  <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">
                    SOLD OUT
                  </span>
                )}
                {images.length > 0 && totalPages > 1 && (
                  <span className="rounded-full bg-zinc-900/80 px-3 py-1 text-xs text-white">
                    {currentPage + 1}/{totalPages}
                  </span>
                )}
              </div>
              {!isSeller && (
                <button
                  type="button"
                  onClick={() => router.push(`/farms/${post.user_id}`)}
                  className="inline-flex shrink-0 items-center gap-3 rounded-full border border-zinc-200 bg-white px-5 py-2.5 text-base text-zinc-700 hover:border-zinc-900"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M3 10l9-6 9 6" />
                    <path d="M5 10v10h14V10" />
                    <path d="M10 20v-6h4v6" />
                  </svg>
                  <span className="whitespace-nowrap">
                    <span className="text-[13px] text-zinc-500">
                      {(seller?.nickname ?? "판매자") + "님의 농장"}
                    </span>{" "}
                    <span className="font-semibold text-zinc-800">
                      {(farmName ?? "농장") + " 바로가기"}
                    </span>
                  </span>
                </button>
              )}
              {isSeller && (
                <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-600">
                  <button
                    type="button"
                    className="rounded border border-zinc-300 px-3 py-1 text-sm"
                    onClick={() => router.push(`/posts/new?edit=${post.id}`)}
                  >
                    수정
                  </button>
                  <button
                    onClick={handleDelete}
                    className="rounded bg-red-600 px-3 py-1 text-sm text-white"
                  >
                    삭제
                  </button>
                </div>
              )}
            </div>
            {images.length > 0 ? (
              <div className="grid grid-cols-3 gap-3">
                {visibleImages.map((img, index) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => {
                      setModalIndex(startIndex + index);
                      setIsImageModalOpen(true);
                    }}
                    className="relative aspect-square overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 cursor-zoom-in"
                  >
                    <img
                      src={img.url}
                      alt={`post-${startIndex + index + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
                {Array.from({ length: placeholderCount }).map((_, index) => (
                  <div
                    key={`placeholder-${index}`}
                    className="aspect-square rounded-2xl border border-dashed border-zinc-200 bg-zinc-50"
                  />
                ))}
              </div>
            ) : (
              <div className="flex h-[220px] items-center justify-center rounded-2xl border border-dashed border-zinc-200 text-sm text-zinc-400">
                이미지가 없습니다.
              </div>
            )}
            <button
              type="button"
              className="absolute -left-12 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-200 bg-white/90 text-lg text-zinc-700 shadow-sm hover:bg-white disabled:cursor-default disabled:opacity-40"
              onClick={() =>
                setCurrent((prev) =>
                  prev === 0 ? totalPages - 1 : prev - 1
                )
              }
              aria-label="이전 이미지"
              disabled={totalPages <= 1}
            >
              ‹
            </button>
            <button
              type="button"
              className="absolute -right-12 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-200 bg-white/90 text-lg text-zinc-700 shadow-sm hover:bg-white disabled:cursor-default disabled:opacity-40"
              onClick={() =>
                setCurrent((prev) =>
                  prev === totalPages - 1 ? 0 : prev + 1
                )
              }
              aria-label="다음 이미지"
              disabled={totalPages <= 1}
            >
              ›
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
              <span className="rounded-full bg-zinc-100 px-3 py-1">
                {post.category ?? "카테고리 없음"}
              </span>
              <span className="text-zinc-400">·</span>
              <span>상품 등록일 {post.created_at.slice(0, 10)}</span>
            </div>
            <h1 className="mt-3 text-3xl font-semibold text-zinc-900">
              {post.title}
            </h1>
            <div className="mt-4 flex items-end justify-between">
              <div className="text-sm text-zinc-500">판매가</div>
              <div className="text-3xl font-bold text-lime-700">
                {priceLabel}
              </div>
            </div>
            <div className="mt-4 grid gap-3 rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-600">
              <div className="flex items-center justify-between">
                <span>재고</span>
                <span className="font-medium text-zinc-900">{stockLabel}</span>
              </div>
              {unitLabel && (
                <div className="flex items-center justify-between">
                  <span>판매 단위</span>
                  <span className="font-medium text-zinc-900">{unitLabel}</span>
                </div>
              )}
              {post.delivery_type && (
                <div className="flex items-center justify-between">
                  <span>배송 유형</span>
                  <span className="font-medium text-zinc-900">
                    {post.delivery_type}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span>재배 방식</span>
                <span className="font-medium text-zinc-900">
                  {post.farming_method ?? "미설정"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>지역</span>
                <span className="font-medium text-zinc-900">
                  {post.region_name ?? post.region_code ?? "미설정"}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="text-xs font-semibold text-zinc-400">상품 설명</div>
            <p className="mt-3 text-sm leading-6 text-zinc-700">{desc}</p>
          </div>


          {isSeller && null}

          {!isSeller && (
            <div className="space-y-4">
              <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="flex w-full gap-3">
                  <button
                    onClick={handleChat}
                    className="flex-1 rounded border border-zinc-300 px-4 py-2 text-xl font-bold text-zinc-700 hover:border-zinc-900"
                  >
                    <span className="inline-flex items-center gap-2">
                      <svg
                        width="28"
                        height="28"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M21 15a4 4 0 0 1-4 4H7l-4 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
                      </svg>
                      채팅하기
                    </span>
                  </button>
                  <button
                    onClick={handleBuyClick}
                    disabled={isStockUnavailable || post.price == null}
                    className="flex-1 rounded bg-lime-600 px-4 py-2 text-xl font-bold text-white shadow-sm hover:bg-lime-500 disabled:cursor-not-allowed disabled:bg-zinc-300"
                  >
                    <span className="inline-flex items-center gap-2">
                      <svg
                        width="28"
                        height="28"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <rect x="2" y="5" width="20" height="14" rx="2" />
                        <path d="M2 10h20" />
                        <path d="M6 15h4" />
                      </svg>
                      {isSoldOut ? "품절" : "바로 구매"}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {isImageModalOpen && images.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
          onClick={() => setIsImageModalOpen(false)}
        >
          <div
            className="relative w-full max-w-4xl rounded-3xl bg-white p-4 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between px-2 pb-3 text-xs text-zinc-500">
              <span>
                {modalIndex + 1}/{images.length}
              </span>
              <button
                type="button"
                onClick={() => setIsImageModalOpen(false)}
                className="rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-700 hover:border-zinc-400"
              >
                닫기
              </button>
            </div>
            <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-zinc-100">
              <img
                src={images[modalIndex]?.url}
                alt={`modal-${modalIndex + 1}`}
                className="h-full w-full object-cover"
              />
            </div>
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  className="absolute left-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-200 bg-white text-lg text-zinc-700 shadow-sm hover:bg-zinc-50"
                  onClick={() =>
                    setModalIndex((prev) =>
                      prev === 0 ? images.length - 1 : prev - 1
                    )
                  }
                  aria-label="이전 이미지"
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-200 bg-white text-lg text-zinc-700 shadow-sm hover:bg-zinc-50"
                  onClick={() =>
                    setModalIndex((prev) => (prev + 1) % images.length)
                  }
                  aria-label="다음 이미지"
                >
                  ›
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {isBuyOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">바로 구매</h2>
              <button
                type="button"
                className="flex h-11 w-11 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
                onClick={() => setIsBuyOpen(false)}
                aria-label="닫기"
              >
                ×
              </button>
            </div>
            <div className="mt-4 space-y-4 text-sm">
              <div className="space-y-2 rounded-xl bg-zinc-50 px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">배송지</span>
                  <button
                    type="button"
                    className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:border-zinc-900"
                    onClick={() => {
                      setAddressPickerError("");
                      setAddressPickerSnapshot(selectedAddressId);
                      setIsAddressPickerOpen(true);
                      setIsAddingAddress(false);
                    }}
                  >
                    변경
                  </button>
                </div>
                {shippingName || shippingAddressLine ? (
                  <div className="space-y-1 text-xs text-zinc-700">
                    <div className="font-medium">
                      {shippingName || "수령인"}
                      {shippingLabel ? ` (${shippingLabel})` : ""}
                    </div>
                    {shippingPhone && (
                      <div className="text-zinc-500">{shippingPhone}</div>
                    )}
                    <div>
                      {shippingAddressLine || "주소를 선택하세요."}
                      {shippingDetailLine ? ` ${shippingDetailLine}` : ""}
                      {postalCode ? ` (${postalCode})` : ""}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500">
                    배송지를 선택하세요.
                  </p>
                )}
              </div>
              <div className="space-y-2 rounded-xl bg-zinc-50 px-3 py-2">
                <label className="space-y-1">
                  <span className="text-xs text-zinc-500">배송 메모</span>
                  <select
                    className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm"
                    value={memoPreset}
                    onChange={(e) => {
                      const next = e.target.value;
                      setMemoPreset(next);
                      if (next === "직접 입력") {
                        setAddressMemo("");
                      } else {
                        setAddressMemo(next);
                      }
                    }}
                  >
                    <option value="문 앞에 놔주세요">문 앞에 놔주세요</option>
                    <option value="배송 전 연락 바랍니다">
                      배송 전 연락 바랍니다
                    </option>
                    <option value="직접 입력">직접 입력</option>
                  </select>
                </label>
                {memoPreset === "직접 입력" && (
                  <textarea
                    className="w-full resize-none rounded border border-zinc-300 px-3 py-2"
                    rows={3}
                    placeholder="요청사항을 입력해주세요"
                    value={addressMemo}
                    onChange={(e) => setAddressMemo(e.target.value)}
                  />
                )}
              </div>
              <div className="rounded-xl bg-zinc-50 px-3 py-2">
                <div className="flex items-center gap-3">
                  {primaryImage ? (
                    <img
                      src={primaryImage}
                      alt={post.title}
                      className="h-14 w-14 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-zinc-200 text-[10px] text-zinc-500">
                      No Image
                    </div>
                  )}
                  <div className="space-y-1">
                    <div className="text-[11px] text-zinc-500">구매 상품</div>
                    <div className="text-sm font-medium text-zinc-900">
                      {post.title}
                      {unitLabel ? ` · ${unitLabel}` : ""}
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-2 rounded-xl bg-zinc-50 px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">
                    수량 (최대 {maxBuyQuantity}개)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="h-8 w-8 rounded border border-zinc-300 text-base text-zinc-700 disabled:opacity-40"
                      onClick={() =>
                        setBuyQuantity((prev) => {
                          const current = Number(prev || 1);
                          return String(Math.max(1, current - 1));
                        })
                      }
                      disabled={Number(buyQuantity || 1) <= 1}
                    >
                      -
                    </button>
                    <span className="min-w-[32px] text-center text-base font-semibold">
                      {Math.min(
                        maxBuyQuantity,
                        Math.max(1, Number(buyQuantity || 1))
                      )}
                    </span>
                    <button
                      type="button"
                      className="h-8 w-8 rounded border border-zinc-300 text-base text-zinc-700 disabled:opacity-40"
                      onClick={() =>
                        setBuyQuantity((prev) => {
                          const current = Number(prev || 1);
                          return String(Math.min(maxBuyQuantity, current + 1));
                        })
                      }
                      disabled={Number(buyQuantity || 1) >= maxBuyQuantity}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex items-end justify-between">
                <span className="text-xs text-zinc-500">총 결제 금액</span>
                <span className="text-lg font-bold text-lime-700">
                  {post.price
                    ? (Number(buyQuantity || 0) * post.price).toLocaleString(
                        "ko-KR"
                      )
                    : 0}
                  원
                </span>
              </div>
              {buyError && <p className="text-sm text-red-600">{buyError}</p>}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded bg-zinc-100 px-4 py-2 text-sm text-zinc-700"
                onClick={() => setIsBuyOpen(false)}
                disabled={buyLoading}
              >
                취소
              </button>
              <button
                type="button"
                className="rounded bg-lime-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-lime-500 disabled:cursor-not-allowed disabled:bg-zinc-300"
                onClick={handlePurchase}
                disabled={buyLoading}
              >
                {buyLoading ? "처리 중..." : "결제 완료"}
              </button>
            </div>
          </div>
        </div>
      )}
      {isAddressPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">배송지 선택</h2>
              <button
                type="button"
                className="text-sm text-zinc-500 hover:text-zinc-700"
                onClick={() => {
                  const shouldRestore =
                    isAddingAddress || selectedAddressId === "manual";
                  setIsAddressPickerOpen(false);
                  setIsAddingAddress(false);
                  if (shouldRestore) {
                    setSelectedAddressId(addressPickerSnapshot);
                    setUseManualAddress(addressPickerSnapshot === "manual");
                  }
                }}
              >
                닫기
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              {shippingAddresses.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  저장된 배송지가 없습니다.
                </p>
              ) : (
                <div className="space-y-2">
                  {shippingAddresses.map((addr) => (
                    <button
                      key={addr.id}
                      type="button"
                      className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-left hover:border-zinc-400"
                      onClick={() => {
                        setSelectedAddressId(addr.id);
                        setUseManualAddress(false);
                        setIsAddingAddress(false);
                        setIsAddressPickerOpen(false);
                      }}
                    >
                      <div className="text-sm font-medium">
                        {addr.label ?? "배송지"}
                        {addr.is_default && (
                          <span className="ml-2 rounded-full border border-lime-200 bg-lime-50 px-2 py-0.5 text-[10px] text-lime-700">
                            기본
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-zinc-600">
                        {addr.receiver_name} · {addr.receiver_phone}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {addr.road_address}
                        {addr.address_detail ? ` ${addr.address_detail}` : ""}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button"
                className="w-full rounded border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                onClick={() => setIsAddingAddress((prev) => !prev)}
              >
                {isAddingAddress ? "직접 추가 닫기" : "직접 추가"}
              </button>
              {isAddingAddress && (
                <div className="space-y-3 rounded-xl border border-zinc-200 p-3">
                  <label className="space-y-1">
                    <span className="text-zinc-600">수령인 이름</span>
                    <input
                      className="w-full rounded border border-zinc-300 px-3 py-2"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-zinc-600">연락처</span>
                    <div className="flex gap-2">
                      <select
                        className="rounded border border-zinc-300 bg-white px-2 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-200"
                        value={recipientCountry}
                        onChange={(e) => setRecipientCountry(e.target.value)}
                      >
                        {[
                          { code: "+82", label: "대한민국", flag: "🇰🇷" },
                          { code: "+1", label: "미국", flag: "🇺🇸" },
                          { code: "+7", label: "카자흐스탄", flag: "🇰🇿" },
                          { code: "+81", label: "일본", flag: "🇯🇵" },
                          { code: "+86", label: "중국", flag: "🇨🇳" },
                          { code: "+998", label: "우즈베키스탄", flag: "🇺🇿" },
                        ].map((item) => (
                          <option key={item.code} value={item.code}>
                            {item.flag} {item.label} {item.code}
                          </option>
                        ))}
                      </select>
                      <input
                        className="w-full rounded border border-zinc-300 px-3 py-2"
                        value={recipientPhone}
                        onChange={(e) =>
                          setRecipientPhone(formatPhone(e.target.value))
                        }
                      />
                    </div>
                  </label>
                  <label className="space-y-1">
                    <span className="text-zinc-600">배송지명</span>
                    <input
                      className="w-full rounded border border-zinc-300 px-3 py-2"
                      placeholder="예: 집, 회사"
                      value={addressLabel}
                      onChange={(e) => setAddressLabel(e.target.value)}
                    />
                  </label>
                  <div className="space-y-1">
                    <span className="text-zinc-600">주소 검색</span>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        className="w-full rounded border border-zinc-300 px-3 py-2"
                        placeholder="주소를 검색하세요"
                        value={buyAddressQuery}
                        onChange={(e) => setBuyAddressQuery(e.target.value)}
                      />
                      <button
                        type="button"
                        className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 shadow-sm hover:bg-zinc-50"
                        onClick={handleBuyAddressSearch}
                      >
                        {buyAddressLoading ? "검색 중..." : "주소 검색"}
                      </button>
                    </div>
                    {buyAddressResults.length > 0 && (
                      <div className="max-h-40 overflow-auto rounded border border-zinc-300 bg-white text-xs shadow-sm">
                        {buyAddressResults.map((result, index) => (
                          <button
                            key={`${result.place_id}-${index}`}
                            type="button"
                            className="block w-full border-b border-zinc-200 px-3 py-2 text-left hover:bg-zinc-50"
                            onClick={() => handleSelectBuyAddress(result)}
                          >
                            {result.display_name}
                          </button>
                        ))}
                      </div>
                    )}
                    {buyAddressHelp && (
                      <p className="text-xs text-zinc-500">{buyAddressHelp}</p>
                    )}
                  </div>
                  <label className="space-y-1">
                    <span className="text-zinc-600">도로명 주소</span>
                    <input
                      className="w-full rounded border border-zinc-300 px-3 py-2"
                      value={roadAddress}
                      onChange={(e) => setRoadAddress(e.target.value)}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-zinc-600">상세 주소</span>
                    <input
                      className="w-full rounded border border-zinc-300 px-3 py-2"
                      value={addressDetail}
                      onChange={(e) => setAddressDetail(e.target.value)}
                    />
                  </label>
                  <label className="flex items-center gap-2 text-xs text-zinc-600">
                    <input
                      type="checkbox"
                      checked={saveAddress}
                      onChange={(e) => setSaveAddress(e.target.checked)}
                    />
                    이 배송지 저장
                  </label>
                  {saveAddress && (
                    <label className="flex items-center gap-2 text-xs text-zinc-600">
                      <input
                        type="checkbox"
                        checked={saveAsDefault}
                        onChange={(e) => setSaveAsDefault(e.target.checked)}
                      />
                      기본 배송지로 설정
                    </label>
                  )}
                  {addressPickerError && (
                    <p className="text-xs text-red-600">{addressPickerError}</p>
                  )}
                  <button
                    type="button"
                    className="w-full rounded bg-lime-600 px-3 py-2 text-sm font-semibold text-white"
                    onClick={handleApplyManualAddress}
                  >
                    적용하기
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
