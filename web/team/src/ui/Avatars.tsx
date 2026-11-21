// Odoo's avatar hues, the light ones darkened until white initials read at 4.5:1 (WCAG AA).
const AVATAR = ["#714B67", "#2A7E91", "#D6145F", "#208457", "#8F60B6", "#B65A0D", "#475577"];

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1]![0] : "")).toUpperCase();
}

export const avatarColor = (name: string) =>
  AVATAR[[...name].reduce((a, ch) => a + ch.charCodeAt(0), 0) % AVATAR.length]!;

/** A round badge with someone's initials, coloured from their name. */
export function Avatar({ name, large }: { name: string; large?: boolean }) {
  return (
    <span className={`avatar${large ? " lg" : ""}`} style={{ background: avatarColor(name) }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

/** Overlapping initials for a comma-separated list of names ("Marc Demo, Mitchell Admin"). */
export function Avatars({ names }: { names: string | null | undefined }) {
  const list = (names ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  // Rendered even when empty: it pushes what follows it to the right of a card's bottom row.
  if (list.length === 0) return <span className="avatars" />;
  return (
    <span className="avatars" title={list.join(", ")} role="img" aria-label={`Assigned to ${list.join(", ")}`}>
      {list.map((n) => <Avatar key={n} name={n} />)}
    </span>
  );
}
