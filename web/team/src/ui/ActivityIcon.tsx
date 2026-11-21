import { Calendar, Check, Clock, Mail, Phone, TriangleAlert, Upload, type LucideIcon } from "lucide-react";

export type ActivityState = "overdue" | "today" | "planned";

// Odoo's activity type icons (mail_activity_type.icon) as Lucide icons.
const ICONS: Record<string, LucideIcon> = {
  mail: Mail, phone: Phone, check: Check, upload: Upload, warning: TriangleAlert, calendar_today: Calendar,
};
const STATE_LABEL: Record<ActivityState, string> = { overdue: "overdue", today: "due today", planned: "planned" };

/**
 * A record's next activity the way an Odoo card shows it: the activity type's icon, green when
 * planned, orange when due today, red when overdue; a grey clock when nothing is scheduled.
 * `summary` (what and when) goes in the tooltip and the accessible name.
 */
export function ActivityIcon({ state, icon, summary, size = 16 }: {
  state: ActivityState | null | undefined;
  icon: string | null | undefined;
  summary?: string | null;
  size?: number;
}) {
  const Icon = (state && icon && ICONS[icon]) || Clock;
  const label = state ? `Activity ${STATE_LABEL[state]}${summary ? `: ${summary}` : ""}` : "No activity scheduled";
  return (
    <span className={`activity ${state ?? "none"}`} role="img" aria-label={label} title={label}>
      <Icon size={size} aria-hidden="true" />
    </span>
  );
}
