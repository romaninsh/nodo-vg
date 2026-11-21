/**
 * Odoo's corner ribbon on a card or a form ("Won", "Lost", "Archived"). Its parent needs
 * `position: relative`; the ribbon sits in the top right corner and lets clicks through.
 */
export function Ribbon({ text, tone }: { text: string; tone: "ok" | "danger" | "muted" }) {
  return (
    <span className={`ribbon ${tone}`} role="status">
      <span>{text}</span>
    </span>
  );
}
