export default function Loading() {
  return (
    <div className="flex items-center gap-2 text-sm text-zinc-500">
      <span className="h-2 w-2 animate-pulse rounded-full bg-zinc-400" />
      <span>로딩 중...</span>
    </div>
  );
}
