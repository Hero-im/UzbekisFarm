"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import Loading from "@/components/Loading";

const LICENSE_BUCKET = "seller-licenses";

type Verification = {
  user_id: string;
  farm_name: string | null;
  owner_name: string | null;
  phone: string | null;
  address: string | null;
  location_note: string | null;
  description: string | null;
  business_license_path: string | null;
  status: "pending" | "approved" | "rejected";
  requested_at: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
};

export default function SellerVerificationsAdminPage() {
  const { session } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<Verification[]>([]);
  const [selected, setSelected] = useState<Verification | null>(null);
  const [documentUrl, setDocumentUrl] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadAdmin = async () => {
      if (!session) return;
      const { data } = await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (cancelled) return;
      setIsAdmin(!!data);
      setLoading(false);
    };

    loadAdmin();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const loadRequests = async () => {
    const { data } = await supabase
      .from("seller_verifications")
      .select(
        "user_id,farm_name,owner_name,phone,address,location_note,description,business_license_path,status,requested_at,reviewed_at,rejection_reason"
      )
      .order("requested_at", { ascending: false });
    setRequests((data ?? []) as Verification[]);
  };

  useEffect(() => {
    if (!isAdmin) return;
    loadRequests();
  }, [isAdmin]);

  const loadDocument = async (path?: string | null) => {
    if (!path) {
      setDocumentUrl("");
      return;
    }
    const { data } = await supabase.storage
      .from(LICENSE_BUCKET)
      .createSignedUrl(path, 60 * 30);
    setDocumentUrl(data?.signedUrl ?? "");
  };

  const handleSelect = async (row: Verification) => {
    setSelected(row);
    setReviewNote(row.rejection_reason ?? "");
    await loadDocument(row.business_license_path);
  };

  const handleApprove = async () => {
    if (!selected || !session) return;
    setActionMessage("");
    const { error } = await supabase
      .from("seller_verifications")
      .update({
        status: "approved",
        reviewed_at: new Date().toISOString(),
        reviewed_by: session.user.id,
        rejection_reason: null,
      })
      .eq("user_id", selected.user_id);
    if (error) {
      setActionMessage("승인 처리에 실패했습니다.");
      return;
    }
    await loadRequests();
    setActionMessage("승인 완료");
  };

  const handleReject = async () => {
    if (!selected || !session) return;
    if (!reviewNote.trim()) {
      setActionMessage("반려 사유를 입력하세요.");
      return;
    }
    setActionMessage("");
    const { error } = await supabase
      .from("seller_verifications")
      .update({
        status: "rejected",
        reviewed_at: new Date().toISOString(),
        reviewed_by: session.user.id,
        rejection_reason: reviewNote.trim(),
      })
      .eq("user_id", selected.user_id);
    if (error) {
      setActionMessage("반려 처리에 실패했습니다.");
      return;
    }
    await loadRequests();
    setActionMessage("반려 완료");
  };

  if (loading) return <Loading />;
  if (!isAdmin) {
    return <p className="text-sm text-zinc-600">접근 권한이 없습니다.</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">판매자 인증 관리</h1>

      <div className="grid gap-6 md:grid-cols-[280px_1fr]">
        <div className="space-y-2">
          <h2 className="text-sm font-medium">요청 목록</h2>
          <ul className="space-y-2">
            {requests.length === 0 ? (
              <li className="text-sm text-zinc-600">요청이 없습니다.</li>
            ) : (
              requests.map((row) => (
                <li key={row.user_id}>
                  <button
                    className={`w-full rounded border px-3 py-2 text-left text-sm ${
                      selected?.user_id === row.user_id
                        ? "border-zinc-900"
                        : "border-zinc-200"
                    }`}
                    onClick={() => handleSelect(row)}
                  >
                    <div className="font-medium">
                      {row.farm_name ?? "농장명 없음"}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {row.status} · {row.requested_at ?? ""}
                    </div>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="space-y-3 rounded border px-4 py-3">
          {!selected ? (
            <p className="text-sm text-zinc-600">요청을 선택하세요.</p>
          ) : (
            <>
              <div className="space-y-1 text-sm">
                <div>사용자 ID: {selected.user_id}</div>
                <div>농장명: {selected.farm_name}</div>
                <div>농장주: {selected.owner_name}</div>
                <div>연락처: {selected.phone}</div>
                <div>주소: {selected.address}</div>
                {selected.location_note && <div>위치 설명: {selected.location_note}</div>}
                {selected.description && <div>추가 설명: {selected.description}</div>}
              </div>
              {documentUrl && (
                <a
                  href={documentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-blue-600 underline"
                >
                  등록증 보기
                </a>
              )}

              <div className="space-y-2">
                <textarea
                  className="w-full rounded border px-3 py-2 text-sm"
                  placeholder="반려 사유 (반려 시 필수)"
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                />
                <div className="flex gap-2">
                  <button
                    className="rounded bg-zinc-900 px-4 py-2 text-sm text-white cursor-pointer"
                    onClick={handleApprove}
                  >
                    승인
                  </button>
                  <button
                    className="rounded border px-4 py-2 text-sm text-zinc-700 cursor-pointer"
                    onClick={handleReject}
                  >
                    반려
                  </button>
                </div>
                {actionMessage && (
                  <p className="text-sm text-zinc-600">{actionMessage}</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
