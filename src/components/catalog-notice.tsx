import { LocalizedLabel } from "./localized-label";
import type { CatalogStatus } from "@/lib/catalog/repository";
export function CatalogNotice({
  status,
  empty = false,
}: {
  status: CatalogStatus;
  empty?: boolean;
}) {
  if (status === "ready" && !empty) return null;
  return (
    <p className="empty-state" role="status">
      <LocalizedLabel source={status === "unavailable"
        ? "The collection is temporarily unavailable. Please try again shortly."
        : status === "unconfigured"
          ? "The collection is being prepared. Check back soon."
          : "New pieces are on the way. Check back soon."} />
    </p>
  );
}
