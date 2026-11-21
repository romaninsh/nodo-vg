import { observer, useCollection } from "@vantage-ui/client/react";
import type { MyCrm, Opportunities } from "../vantage.gen";
import { call, ids, tagColor, tagText, useDb } from "../lib";
import { TagColorPicker, USD, toast, type Currency } from "../ui";

/** The pending-store key of an opportunity (to-dos use their bare id). */
export const crmKey = (id: string | number) => `crm:${id}`;

/** The signed-in person's CRM rights (their own row only): teams, delete right, currency. */
export function useMyCrm(): MyCrm | undefined {
  const db = useDb();
  return useCollection(db.my_crm.all).items[0];
}

const currencyOf = (symbol: string | null | undefined, position: string | null | undefined, decimals: number | null | undefined, fallback: Currency): Currency =>
  symbol ? { symbol, position: position === "after" ? "after" : "before", decimals: decimals ?? 2 } : fallback;

/** The person's own company currency (what Odoo shows totals and company-less amounts in). */
export function useCurrency(): Currency {
  const me = useMyCrm();
  return currencyOf(me?.currency_symbol, me?.currency_position, me?.currency_decimals, USD);
}

/** An opportunity's amounts are in its company's currency (Odoo's company_currency), else the person's. */
export const leadCurrency = (o: Opportunities, fallback: Currency) =>
  currencyOf(o.currency_symbol, o.currency_position, o.currency_decimals, fallback);

/**
 * The stages a pipeline shows, as Odoo's: shared stages, the stages of the chosen team (or,
 * under "All Teams", of the person's own teams), and any stage holding a card on the board.
 */
export function visibleStage(teamIds: string | null | undefined, teams: string[], holding: boolean) {
  if (!teamIds || holding) return true;
  return ids(teamIds).some((t) => teams.includes(t));
}

/** Whether a stage belongs to a team's pipeline: shared, or limited to that team. */
export const stageForTeam = (teamIds: string | null | undefined, team: string | number | null | undefined) =>
  !teamIds || (team != null && ids(teamIds).includes(String(team)));

/**
 * CRM tag pills in Odoo's colours, from a "1,5" id list. A click on one opens Odoo's colour
 * picker for that tag (the tag's colour changes everywhere it is used).
 */
export const CrmTagPills = observer(({ tagIds, editable = true }: { tagIds: string | null | undefined; editable?: boolean }) => {
  const db = useDb();
  const { items } = useCollection(db.crm_tags.sort("name", "asc"));
  const wanted = ids(tagIds);
  if (wanted.length === 0) return null;
  const byId = new Map(items.map((t) => [t.id, t]));
  const recolour = async (id: string, color: number) => {
    const out = await call(db.run.crm_tag_color, { id: Number(id), color });
    if (!out.ok) toast(out.message);
  };
  return (
    <span className="tags">
      {wanted.map((id) => {
        const t = byId.get(id);
        return editable ? (
          <TagColorPicker key={id} name={t?.name ?? "…"} color={t?.color ?? 0} onChange={(c) => void recolour(id, c)} />
        ) : (
          <span key={id} className="tag" style={{ background: tagColor(t?.color), color: tagText(t?.color) }}>{t?.name ?? "…"}</span>
        );
      })}
    </span>
  );
});
