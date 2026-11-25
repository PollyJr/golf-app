import { Badge, LiveDot, type Tone } from "@/components/ui/badge";
import type { AppTranslate } from "@/lib/i18n/dictionaries";
import type { RoundStatus } from "@/lib/types";

const STATUS_TONES: Record<RoundStatus, Tone> = {
  inviting: "neutral",
  active: "brand",
  pending: "gold",
  approved: "under",
  rejected: "over",
};

export function RoundStatusBadge({ status, t }: { status: RoundStatus; t: AppTranslate }) {
  return (
    <Badge tone={STATUS_TONES[status]} icon={status === "active" ? <LiveDot /> : undefined}>
      {t(`common.status.${status}`)}
    </Badge>
  );
}

/**
 * Human wording for an audit action such as `round.approved`; unknown codes
 * are shown as they are, so new actions never disappear from the log.
 */
export function auditActionLabel(t: AppTranslate, action: string): string {
  const key = `admin.audit.actions.${action.replace(/[^a-z0-9]+/gi, "_")}`;
  const label = (t as (key: string) => string)(key);
  return label === key ? action : label;
}
