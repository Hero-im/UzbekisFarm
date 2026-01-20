"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";

const CATEGORIES = ["채소", "과일", "곡물", "기타"];
const MAX_SIZE_MB = 5;

export default function NewPostPage() {
  const router = useRouter();
  const { session } = useAuth();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [regionCode, setRegionCode] = useState("");
  const [regionName, setRegionName] = useState("");

  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      if (!session) return;
      const { data } = await supabase
        .from("profiles")
        .select("region_code,region_name")
        .eq("id", session.user.id)
        .single();

      if (cancelled) return;
      setRegionCode(data?.region_code ?? "");
      setRegionName(data?.region_name ?? "");
    };

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [session]);

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
    if (!regionCode) {
      setMessage("먼저 /onboarding에서 지역을 설정하세요.");
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
        price: price ? Number(price) : null,
        quantity: quantity ? Number(quantity) : null,
        status: "active",
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
      <h1 className="text-xl font-semibold">/posts/new</h1>
      <p className="text-sm text-zinc-600">
        지역: {regionName || regionCode || "미설정"}
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          className="w-full rounded border px-3 py-2"
          placeholder="제목"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <textarea
          className="w-full rounded border px-3 py-2"
          placeholder="설명"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />
        <select
          className="w-full rounded border px-3 py-2"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          className="w-full rounded border px-3 py-2"
          placeholder="가격(선택)"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        <input
          className="w-full rounded border px-3 py-2"
          placeholder="수량(선택)"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />

        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => handleFiles(e.target.files)}
        />

        <button
          className="rounded bg-zinc-900 px-4 py-2 text-white cursor-pointer"
          disabled={uploading}
        >
          {uploading
            ? `업로드 중... (${uploadedCount}/${files.length})`
            : "등록"}
        </button>
      </form>

      {message && <p className="text-sm text-zinc-600">{message}</p>}
    </div>
  );
}
