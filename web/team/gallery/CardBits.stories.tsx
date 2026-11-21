import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, screen } from "storybook/test";
import { ActivityIcon, Ribbon } from "../src/ui";

/** The small pieces of a CRM card: the next activity's icon and the corner ribbon. */
const meta = {
  title: "Controls/CardBits",
  component: ActivityIcon,
  args: { state: "planned", icon: "phone" },
} satisfies Meta<typeof ActivityIcon>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Each activity state, for a call, an email and a to-do; a grey clock when nothing is planned. */
export const Activities: Story = {
  render: () => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, auto)", gap: 12, justifyContent: "start" }}>
      {(["planned", "today", "overdue"] as const).map((s) => (
        <span key={s} style={{ display: "contents" }}>
          <span>{s}</span>
          <ActivityIcon state={s} icon="phone" summary="Call back · 2026-11-22" />
          <ActivityIcon state={s} icon="mail" />
          <ActivityIcon state={s} icon="check" />
        </span>
      ))}
      <span>none</span><ActivityIcon state={null} icon={null} /><span /><span />
    </div>
  ),
  play: async () => {
    await expect(screen.getByRole("img", { name: "Activity overdue: Call back · 2026-11-22" })).toBeVisible();
    await expect(screen.getByRole("img", { name: "No activity scheduled" })).toBeVisible();
  },
};

/** Won, Lost and Archived on a card-sized box. */
export const Ribbons: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 12 }}>
      {([["Won", "ok"], ["Lost", "danger"], ["Archived", "muted"]] as const).map(([t, tone]) => (
        <div key={t} className="card" style={{ position: "relative", overflow: "hidden", width: 200, height: 90 }}>
          <Ribbon text={t} tone={tone} />
          <span className="title">Office Design</span>
        </div>
      ))}
    </div>
  ),
  play: async () => {
    await expect(screen.getAllByRole("status")).toHaveLength(3);
    await expect(screen.getByText("Lost")).toBeVisible();
  },
};
