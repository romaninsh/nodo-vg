import type { Meta, StoryObj } from "@storybook/react-vite";
import { MemoryRouter, useHref, useNavigate } from "react-router";
import { RouterProvider } from "react-aria-components";
import { expect, screen } from "storybook/test";
import { AppSwitcher } from "../src/shell/AppSwitcher";
import { APPS } from "../src/shell/apps";

/** In the top bar's colours, with a router so picking an app stays on the page. */
function Bar({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  return (
    <RouterProvider navigate={navigate} useHref={useHref}>
      <nav className="navbar" aria-label="To-do">{children}<span className="app">To-do</span></nav>
    </RouterProvider>
  );
}

const meta = {
  title: "Shell/AppSwitcher",
  component: AppSwitcher,
  args: { current: APPS[0]! },
  decorators: [(Story) => <MemoryRouter initialEntries={["/list"]}><Bar><Story /></Bar></MemoryRouter>],
} satisfies Meta<typeof AppSwitcher>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {
  play: async () => { await expect(screen.getByRole("button", { name: "Apps" })).toHaveAttribute("aria-expanded", "false"); },
};

/** The apps, the current one ticked; CRM is still to come. */
export const Open: Story = {
  play: async ({ userEvent }) => {
    await userEvent.click(screen.getByRole("button", { name: "Apps" }));
    await expect(await screen.findByRole("listbox", { name: "Apps" })).toBeVisible();
    await expect(screen.getByRole("option", { name: /CRM/ })).toHaveAttribute("aria-disabled", "true");
    await expect(screen.getByRole("option", { name: /To-do/ })).toHaveFocus();
  },
};

export const PickWithKeyboard: Story = {
  play: async ({ userEvent }) => {
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    await expect(await screen.findByRole("listbox", { name: "Apps" })).toBeVisible();
    await userEvent.keyboard("{Enter}");
    await expect(screen.queryByRole("listbox", { name: "Apps" })).toBeNull();
  },
};
