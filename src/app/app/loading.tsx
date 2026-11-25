import { Skeleton } from "@/components/ui/card";

/** Shown while a page of the player app loads. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <Skeleton className="h-3 w-28" />
      <Skeleton className="h-10 w-2/3 max-w-sm" />
      <Skeleton className="mt-4 h-40 w-full rounded-card" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-24 rounded-card" />
        ))}
      </div>
    </div>
  );
}
