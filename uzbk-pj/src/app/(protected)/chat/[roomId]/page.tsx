"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import Loading from "@/components/Loading";

type Message = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

type Room = {
  id: string;
  post_id: string | null;
  buyer_id: string | null;
  seller_id: string | null;
};

type PostSummary = {
  id: string;
  title: string | null;
  price: number | null;
  category: string | null;
  unit_size: number | null;
  unit: string | null;
  stock_quantity: number | null;
  thumbnail: string | null;
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

const MAX_MESSAGE_LENGTH = 500;

export default function ChatRoomPage() {
  const params = useParams();
  const roomId = params.roomId as string;
  const router = useRouter();
  const { session } = useAuth();

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const lastReadUpdateRef = useRef<number>(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [room, setRoom] = useState<Room | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [sendError, setSendError] = useState("");
  const [otherNickname, setOtherNickname] = useState<string | null>(null);
  const [postId, setPostId] = useState<string | null>(null);
  const [postSummary, setPostSummary] = useState<PostSummary | null>(null);
  const [farmName, setFarmName] = useState<string | null>(null);
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
  const [saveAddress, setSaveAddress] = useState(false);
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [isBuyOpen, setIsBuyOpen] = useState(false);
  const [buyQuantity, setBuyQuantity] = useState("1");
  const [buyError, setBuyError] = useState("");
  const [buyLoading, setBuyLoading] = useState(false);
  const [addressPickerError, setAddressPickerError] = useState("");
  const [useManualAddress, setUseManualAddress] = useState(false);
  const [memoPreset, setMemoPreset] = useState("문 앞에 놔주세요");
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

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!session || !roomId) return;
      setLoading(true);
      setAccessDenied(false);
      setRoom(null);
      setMessages([]);
      setOtherNickname(null);

      const { data: roomData, error: roomError } = await supabase
        .from("chat_rooms")
        .select("id,post_id,buyer_id,seller_id")
        .eq("id", roomId)
        .single();

      if (cancelled) return;
      if (roomError || !roomData) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }

      const isParticipant =
        roomData.buyer_id === session.user.id ||
        roomData.seller_id === session.user.id;

      if (!isParticipant) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }

      setRoom(roomData);
      setPostId(roomData.post_id ?? null);
      setPostSummary(null);
      setFarmName(null);

      const otherUserId =
        roomData.buyer_id === session.user.id
          ? roomData.seller_id
          : roomData.buyer_id;

      if (otherUserId) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("nickname")
          .eq("id", otherUserId)
          .single();

        if (!cancelled) {
          setOtherNickname(profileData?.nickname ?? null);
        }
      }

      if (roomData.post_id) {
        const { data: postData } = await supabase
          .from("posts")
          .select("id,title,price,category,unit_size,unit,stock_quantity")
          .eq("id", roomData.post_id)
          .maybeSingle();

        const { data: imageData } = await supabase
          .from("post_images")
          .select("storage_path")
          .eq("post_id", roomData.post_id)
          .order("sort_order", { ascending: true })
          .limit(1);

        const storagePath = imageData?.[0]?.storage_path;
        let thumbnail: string | null = null;
        if (storagePath) {
          const { data } = supabase.storage
            .from("post-images")
            .getPublicUrl(storagePath);
          thumbnail = data.publicUrl;
        }

        if (!cancelled && postData) {
          setPostSummary({
            id: postData.id,
            title: postData.title ?? null,
            price: postData.price ?? null,
            category: postData.category ?? null,
            unit_size: postData.unit_size ?? null,
            unit: postData.unit ?? null,
            stock_quantity: postData.stock_quantity ?? null,
            thumbnail,
          });
        }
      }

      if (roomData.seller_id) {
        const { data: farmData } = await supabase
          .from("seller_verifications")
          .select("farm_name")
          .eq("user_id", roomData.seller_id)
          .eq("status", "approved")
          .maybeSingle();

        if (!cancelled) {
          setFarmName(farmData?.farm_name ?? null);
        }
      }

      const { data: messageData } = await supabase
        .from("chat_messages")
        .select("id,sender_id,content,created_at")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true });

      if (cancelled) return;
      setMessages(messageData ?? []);
      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [roomId, session]);

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

  useEffect(() => {
    if (!isAddingAddress) return;
    resetManualAddress();
  }, [isAddingAddress]);

  useEffect(() => {
    if (!roomId || !room || !session) return;

    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const nextMessage = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((msg) => msg.id === nextMessage.id)) return prev;
            return [...prev, nextMessage];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, room, session]);


  useEffect(() => {
    if (loading) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (!room || !session) return;
    markRoomRead();
  }, [messages.length, room, session]);

  const handleSend = async () => {
    if (!session || !room) return;
    const trimmed = content.trim();
    if (!trimmed) {
      setSendError("메시지를 입력하세요.");
      return;
    }
    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      setSendError("메시지는 500자 이하로 입력하세요.");
      return;
    }

    const { data, error } = await supabase
      .from("chat_messages")
      .insert({
        room_id: roomId,
        sender_id: session.user.id,
        content: trimmed,
      })
      .select("id,sender_id,content,created_at")
      .single();

    if (error) {
      setSendError(error.message);
      return;
    }

    if (data) {
      setMessages((prev) => {
        if (prev.some((msg) => msg.id === data.id)) return prev;
        return [...prev, data];
      });
    }

    setContent("");
    setSendError("");
  };

  const markRoomRead = async () => {
    if (!session || !room) return;
    const now = Date.now();
    if (now - lastReadUpdateRef.current < 2000) return;
    lastReadUpdateRef.current = now;

    const field =
      room.buyer_id === session.user.id
        ? "buyer_last_read_at"
        : "seller_last_read_at";

    await supabase
      .from("chat_rooms")
      .update({ [field]: new Date(now).toISOString() })
      .eq("id", room.id);
  };

  const handleLeave = async () => {
    if (!session || !room) return;
    const shouldLeave = window.confirm("이 대화를 나가시겠어요?");
    if (!shouldLeave) return;
    const { error } = await supabase.rpc("leave_chat_room", {
      room_id: room.id,
    });

    if (error) {
      setSendError(error.message);
      return;
    }

    router.replace("/chat");
  };

  const handlePaymentRequest = async () => {
    if (!session || !room) return;
    const raw = window.prompt("결제 요청 금액을 입력하세요.");
    if (!raw) return;
    const cleaned = raw.replace(/[^\d]/g, "");
    const amount = Number(cleaned);
    if (!Number.isFinite(amount) || amount <= 0) {
      setSendError("결제 요청 금액을 올바르게 입력하세요.");
      return;
    }

    const { error } = await supabase.from("chat_messages").insert({
      room_id: room.id,
      sender_id: session.user.id,
      content: `__PAYMENT_REQUEST__:${JSON.stringify({
        amount,
        post_id: postId,
      })}`,
    });

    if (error) {
      setSendError(error.message);
      return;
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
    if (!session || !postSummary) return;
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
    if (!session || !postSummary) return;
    const quantity = Number(buyQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setBuyError("구매 수량을 올바르게 입력하세요.");
      return;
    }
    if (postSummary.price == null) {
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
    const maxAllowed = postSummary.stock_quantity ?? 10;
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
        p_post_id: postSummary.id,
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
    };
    const totalPrice = postSummary.price * quantity;

    await supabase.from("chat_messages").insert([
      {
        room_id: roomId,
        sender_id: session.user.id,
        content: `__SYSTEM__:[${postSummary.title ?? "상품"}] 결제가 완료되었습니다.`,
      },
      {
        room_id: roomId,
        sender_id: session.user.id,
        content: `__ORDER__:${JSON.stringify({
          order_id: purchaseResult.order_id,
          post_id: postSummary.id,
          title: postSummary.title,
          quantity,
          total_price: totalPrice,
          thumbnail: postSummary.thumbnail,
        })}`,
      },
    ]);

    setPostSummary((prev) =>
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

  if (!session) return <p>로그인이 필요합니다.</p>;
  if (loading) return <Loading />;
  if (accessDenied) return <p>이 채팅방에 접근할 권한이 없습니다.</p>;

  const formatTime = (value: string) =>
    new Date(value).toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });

  const isSeller = room?.seller_id === session?.user.id;
  const postPriceLabel =
    postSummary?.price != null
      ? `${postSummary.price.toLocaleString("ko-KR")}원`
      : "가격 미정";
  const primaryImage = postSummary?.thumbnail ?? null;
  const unitLabel =
    postSummary?.unit_size && postSummary?.unit
      ? `${postSummary.unit_size} ${postSummary.unit}`
      : null;
  const maxBuyQuantity = postSummary?.stock_quantity ?? 10;
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">
          {(otherNickname ?? "상대") + " 님과의 대화"}
        </h1>
        <button
          type="button"
          onClick={handleLeave}
          className="rounded border px-3 py-1 text-sm text-zinc-600 hover:bg-zinc-50"
        >
          대화 나가기
        </button>
      </div>
      {postSummary && (
        <div
          role="button"
          tabIndex={0}
          className="flex w-full items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition hover:border-zinc-300"
          onClick={() => router.push(`/posts/${postSummary.id}`)}
          onKeyDown={(e) => {
            if (e.key === "Enter") router.push(`/posts/${postSummary.id}`);
          }}
        >
          <div className="h-16 w-16 overflow-hidden rounded-xl border bg-zinc-100">
            {postSummary.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={postSummary.thumbnail}
                alt={postSummary.title ?? "post"}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">
                이미지 없음
              </div>
            )}
          </div>
          <div className="flex-1 space-y-1">
            <div className="text-xs text-zinc-400">
              {postSummary.category ?? "상품 정보"}
            </div>
            <div className="text-sm font-semibold text-zinc-900">
              {postSummary.title ?? "상품"}
            </div>
            <div className="text-sm font-semibold">{postPriceLabel}</div>
            <div className="text-xs text-zinc-500">
              {unitLabel ? `${unitLabel} · ` : ""}
              재고{" "}
              {postSummary.stock_quantity != null
                ? `${postSummary.stock_quantity}개`
                : "미정"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded border border-zinc-300 px-3 py-1 text-xs text-zinc-700 hover:border-zinc-900"
              onClick={(e) => {
                e.stopPropagation();
                if (room?.seller_id) router.push(`/farms/${room.seller_id}`);
              }}
            >
              {farmName ? `${farmName} 농장` : "농장 정보"}
            </button>
            <button
              type="button"
              className="flex-1 rounded bg-lime-600 px-5 py-2 text-sm font-semibold text-white hover:bg-lime-500"
              onClick={(e) => {
                e.stopPropagation();
                handleBuyClick();
              }}
            >
              바로 구매
            </button>
          </div>
        </div>
      )}
      <div className="max-h-[60vh] space-y-2 overflow-y-auto rounded border p-3">
        {messages.length === 0 && <p>메시지가 없습니다.</p>}
        {messages.map((m) => {
          const isMine = m.sender_id === session?.user.id;
          const senderLabel = isMine ? "나" : otherNickname ?? "상대";
          const isSystemMessage = m.content.startsWith("__SYSTEM__:");
          const isOrderMessage = m.content.startsWith("__ORDER__:");
          const isPaymentRequest = m.content.startsWith("__PAYMENT_REQUEST__:");
          const orderPayload = isOrderMessage
            ? (() => {
                try {
                  return JSON.parse(m.content.replace("__ORDER__:", ""));
                } catch {
                  return null;
                }
              })()
            : null;
          const paymentPayload = isPaymentRequest
            ? (() => {
                try {
                  return JSON.parse(
                    m.content.replace("__PAYMENT_REQUEST__:", "")
                  );
                } catch {
                  return null;
                }
              })()
            : null;
          return (
            <div key={m.id} className={`text-sm ${isMine ? "text-right" : ""}`}>
              <div className="text-xs text-zinc-500">
                {senderLabel} · {formatTime(m.created_at)}
              </div>
              {isSystemMessage ? (
                <div className="mt-1 inline-block rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                  {m.content.replace("__SYSTEM__:", "")}
                </div>
              ) : isOrderMessage ? (
                <div
                  className="mt-1 flex cursor-pointer gap-3 rounded border border-zinc-200 bg-white p-3 text-sm text-zinc-700 shadow-sm"
                  onClick={() => {
                    const targetId = orderPayload?.post_id ?? postId;
                    if (targetId) router.push(`/posts/${targetId}`);
                  }}
                >
                  {orderPayload?.thumbnail ? (
                    <div className="h-16 w-16 overflow-hidden rounded border bg-zinc-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={orderPayload.thumbnail}
                        alt={orderPayload.title ?? "order"}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : null}
                  <div className="flex-1">
                    <div className="font-medium">
                      {orderPayload?.title ?? "주문 상품"}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      수량 {orderPayload?.quantity ?? "-"} · 결제 금액{" "}
                      {orderPayload?.total_price != null
                        ? `${Number(orderPayload.total_price).toLocaleString(
                            "ko-KR"
                          )}원`
                        : "-"}
                    </div>
                    {orderPayload?.order_id && (
                      <div className="mt-1 text-[11px] text-zinc-400">
                        주문번호: {orderPayload.order_id}
                      </div>
                    )}
                  </div>
                </div>
              ) : isPaymentRequest ? (
                <div className="mt-1 flex flex-wrap items-center gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  <span>
                    결제 요청:{" "}
                    {paymentPayload?.amount != null
                      ? `${Number(paymentPayload.amount).toLocaleString(
                          "ko-KR"
                        )}원`
                      : "금액 미정"}
                  </span>
                  <button
                    type="button"
                    className="rounded border border-amber-300 bg-white px-2 py-1 text-[11px] text-amber-700 hover:border-amber-500"
                    onClick={() => {
                      const targetId = paymentPayload?.post_id ?? postId;
                      if (targetId) router.push(`/posts/${targetId}`);
                    }}
                    disabled={!paymentPayload?.post_id && !postId}
                  >
                    결제하기
                  </button>
                </div>
              ) : (
                <div
                  className={`mt-1 inline-block rounded border px-3 py-2 ${
                    isMine
                      ? "border-zinc-200 bg-zinc-900 text-white"
                      : "border-zinc-200 bg-white text-zinc-700"
                  }`}
                >
                  {m.content}
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2">
        <input
          className="flex-1 rounded border px-3 py-2"
          placeholder="메시지 입력"
          value={content}
          maxLength={MAX_MESSAGE_LENGTH}
          autoFocus
          onChange={(e) => {
            setContent(e.target.value);
            if (sendError) setSendError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        {isSeller && (
          <button
            type="button"
            onClick={handlePaymentRequest}
            className="rounded border px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            결제 요청
          </button>
        )}
        <button
          onClick={handleSend}
          className="rounded bg-zinc-900 px-4 py-2 text-white cursor-pointer"
        >
          보내기
        </button>
      </div>
      {sendError && <p className="text-sm text-red-500">{sendError}</p>}
      {isBuyOpen && postSummary && (
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
                      alt={postSummary.title ?? "상품"}
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
                      {postSummary.title ?? "상품"}
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
                  {postSummary.price
                    ? (Number(buyQuantity || 0) * postSummary.price).toLocaleString(
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
