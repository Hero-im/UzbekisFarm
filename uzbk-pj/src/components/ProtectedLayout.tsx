"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Loading from "@/components/Loading";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, isLoading } = useAuth();
  const isPublic = pathname?.startsWith("/feed") ?? false;

  useEffect(() => {
    if (!isLoading && !session && !isPublic) {
      const timer = setTimeout(() => {
        router.replace("/auth");
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isLoading, session, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <Loading />
      </div>
    );
  }

  if (!session && !isPublic) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <p className="text-sm text-zinc-600">로그인이 필요합니다</p>
        <Loading />
      </div>
    );
  }

  return <>{children}</>;
}
