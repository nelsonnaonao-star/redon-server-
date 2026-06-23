export function SkeletonLine({ width = '100%', className = '' }: { width?: string; className?: string }) {
  return (
    <div
      className={`h-3 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse ${className}`}
      style={{ width }}
    />
  );
}

export function SkeletonAvatar({ size = 'w-12 h-12', className = '' }: { size?: string; className?: string }) {
  return (
    <div
      className={`${size} rounded-2xl bg-slate-200 dark:bg-slate-700 animate-pulse flex-shrink-0 ${className}`}
    />
  );
}

export function ChatListSkeleton() {
  return (
    <div className="flex flex-col">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-slate-800/60">
          <SkeletonAvatar />
          <div className="flex-1 space-y-2">
            <SkeletonLine width="40%" />
            <SkeletonLine width="70%" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MomentsSkeleton() {
  return (
    <div className="flex gap-3 p-4 overflow-x-auto">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex flex-col items-center gap-2 flex-shrink-0">
          <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
          <SkeletonLine width="4rem" className="!h-2" />
        </div>
      ))}
    </div>
  );
}

export default SkeletonLine;
