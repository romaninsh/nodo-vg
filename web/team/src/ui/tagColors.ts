// Odoo's twelve tag colours (index = the tag's `color`; 0 is "no colour"). Teal and violet are
// a shade darker than Odoo's (#2C8397, #9365B8): neither white nor dark text reaches 4.5:1 on
// Odoo's own.
export const TAG_COLORS = [
  "#e9ecef", "#F06050", "#F4A460", "#F7CD1F", "#6CC1ED", "#814968",
  "#EB7E7F", "#2A7E91", "#475577", "#D6145F", "#30C381", "#8A5BB0",
] as const;
export const TAG_COLOR_NAMES = [
  "No color", "Red", "Orange", "Yellow", "Cyan", "Purple", "Almond", "Teal", "Blue", "Raspberry", "Green", "Violet",
] as const;

export const tagColor = (c: number | null | undefined) => TAG_COLORS[(c ?? 0) % 12] ?? TAG_COLORS[0];

// White text where it reads at 4.5:1 (WCAG AA) on the tag's colour, dark text elsewhere.
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const tagText = (c: number | null | undefined) => (1.05 / (luminance(tagColor(c)) + 0.05) >= 4.5 ? "#fff" : "#212529");
