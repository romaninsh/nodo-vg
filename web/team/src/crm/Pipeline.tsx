import { useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useNavigate } from "react-router";
import { observer, useCollection } from "@vantage-ui/client/react";
import { DndContext, DragOverlay, useDraggable, useDroppable, type Announcements, type DragEndEvent, type UniqueIdentifier } from "@dnd-kit/core";
import {
  Button, ComboBox, Form, Input, ListBox, ListBoxItem, Popover, SearchField, Select, SelectValue, TextField, ToggleButton, ToggleButtonGroup,
} from "react-aria-components";
import { ChevronDown, ChevronLeft, Plus, Search, X } from "lucide-react";
import type { CrmStages, Opportunities } from "../vantage.gen";
import { auth, call, useDb } from "../lib";
import { pendingValue, setPending, usePending, usePendingStore } from "../pending";
import { columnUnder, justDropped, markDrop, useBoardSensors } from "../dnd";
import {
  ActivityIcon, Avatar, ColumnProgress, CRM_PRIORITY_LABELS, MoneyField, Priority, PriorityStar, Ribbon, formatMoney, toast,
  type Currency, type Level, type Segment,
} from "../ui";
import { CrmTagPills, crmKey, leadCurrency, useCurrency, useMyCrm, visibleStage } from "./lib";
import { ids } from "../lib";

// The team picked in the switcher, kept across reloads as Odoo keeps it.
const TEAM_KEY = "nodo.crm.team";
const savedTeam = () => localStorage.getItem(TEAM_KEY) || null;

type Owner = "mine" | "unassigned" | "all";
type Status = "active" | "ongoing" | "won" | "lost" | "rotting";
const OWNERS: { id: Owner; label: string }[] = [
  { id: "mine", label: "My pipeline" }, { id: "unassigned", label: "Unassigned" }, { id: "all", label: "Everyone" },
];
const STATUSES: { id: Status; label: string }[] = [
  { id: "active", label: "Open" }, { id: "ongoing", label: "Ongoing" }, { id: "won", label: "Won" },
  { id: "lost", label: "Lost" }, { id: "rotting", label: "Rotting" },
];

const INSTRUCTIONS =
  "Press Enter to open this opportunity. To move it to another stage, press Space, choose the stage with the left and right arrow keys, then press Space to drop it or Escape to cancel.";

/**
 * Odoo CRM's pipeline: a column per stage with its cards, the activity bar and the expected
 * revenue in each column header, quick create, drag a card to another stage. Every card comes
 * from one query and is grouped into its column here.
 */
export const Pipeline = observer(() => {
  const db = useDb();
  const me = auth.me();
  const currency = useCurrency();
  const [owner, setOwner] = useState<Owner>("mine");
  const [status, setStatus] = useState<Status>("active");
  const [picked, setPicked] = useState<string | null>(savedTeam);
  const setTeam = (t: string | null) => {
    if (t) localStorage.setItem(TEAM_KEY, t); else localStorage.removeItem(TEAM_KEY);
    setPicked(t);
  };
  const mine = useMyCrm();
  const teams = useCollection(db.sales_teams.sort("sequence", "asc"));
  // The switcher lists the person's own teams, all of them with "All Documents" (Odoo's rule),
  // and only shows when there are two teams or more.
  const myTeams = ids(mine?.team_ids);
  const switcherTeams = teams.items.filter((t) => mine?.all_docs || myTeams.includes(t.id));
  // A remembered team the person can't pick (any more) falls back to All Teams.
  const loaded = !!mine && teams.loadState !== "loading";
  const team = picked && (!loaded || switcherTeams.some((t) => t.id === picked)) ? picked : null;
  const [text, setText] = useState("");
  const [adding, setAdding] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [dragging, setDragging] = useState<UniqueIdentifier | null>(null);
  const pending = usePendingStore();
  const sensors = useBoardSensors();

  // The server filters; the page only groups the cards into their stage's column.
  let q = db.opportunities.where({});
  if (owner === "mine") q = q.where({ user_id: me?.uid ?? 0 });
  if (owner === "unassigned") q = q.where({ user_id: null });
  if (status === "active") q = q.where({ active: true });
  if (status === "ongoing") q = q.where({ active: true, won_status: "pending" });
  if (status === "won") q = q.where({ won_status: "won" });
  if (status === "lost") q = q.where({ active: false, won_status: "lost" });
  if (status === "rotting") q = q.where({ active: true, rotting_days: { gt: 0 } });
  // A team's pipeline is Odoo's: its own opportunities, and those with no team sitting in one
  // of its stages (`switch_teams` lists the teams whose pipeline shows a card).
  if (team) q = q.where({ switch_teams: { like: `,${team},` } });
  if (text.trim()) q = q.where({ search_text: { like: text.trim() } });
  const cards = useCollection(q.sort("priority", "desc"));
  const allStages = useCollection(db.crm_stages.sort("sequence", "asc"));

  const stageOf = (c: Opportunities) => String(pendingValue(pending, crmKey(c.id), "stage_id") ?? c.stage_id ?? "");
  const byStage = new Map<string, Opportunities[]>();
  for (const c of cards.items) {
    const key = stageOf(c);
    byStage.set(key, [...(byStage.get(key) ?? []), c]);
  }
  // Odoo's columns: shared stages, the chosen team's (or the person's teams' under All Teams),
  // and any stage that holds a card.
  const stages = allStages.items.filter((s) => visibleStage(s.team_ids, team ? [team] : myTeams, byStage.has(String(s.id))));
  const cardOf = (id: UniqueIdentifier | undefined) => cards.items.find((c) => String(c.id) === String(id));
  const stageName = (id: UniqueIdentifier | undefined) => stages.find((s) => s.id === String(id))?.name ?? "";
  const nameOf = (id: UniqueIdentifier) => cardOf(id)?.name ?? "the opportunity";

  const drop = async ({ active, over }: DragEndEvent) => {
    setDragging(null);
    markDrop();
    const card = cardOf(active.id);
    if (!over || !card) return;
    const from = stageOf(card);
    const to = String(over.id);
    if (from === to) return;
    setPending(crmKey(card.id), { stage_id: to });
    const out = await call<{ id: number; stage: number }, { won: boolean }>(db.run.crm_move, { id: Number(card.id), stage: Number(to) });
    if (!out.ok) {
      setPending(crmKey(card.id), { stage_id: from });
      toast(out.message);
    } else if (out.value.won) {
      toast(`Won: ${card.name}. Congratulations!`);
    }
  };

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${nameOf(active.id)}.`,
    onDragOver: ({ active, over }) => over ? `${nameOf(active.id)} is over ${stageName(over.id)}.` : `${nameOf(active.id)} is not over a stage.`,
    onDragEnd: ({ active, over }) => over ? `${nameOf(active.id)} dropped in ${stageName(over.id)}.` : `${nameOf(active.id)} dropped where it was.`,
    onDragCancel: ({ active }) => `Moving ${nameOf(active.id)} was cancelled.`,
  };

  const lifted = dragging == null ? undefined : cardOf(dragging);
  const firstOpen = stages.find((s) => !s.fold)?.id ?? stages[0]?.id;
  return (
    <>
      <div className="cp">
        <div className="crumbs">Pipeline</div>
        <Button className="btn btn-primary" isDisabled={!firstOpen || status === "lost"} onPress={() => firstOpen && setAdding(firstOpen)}>New</Button>
        {teams.items.length > 1 && (
          <TeamSwitcher teams={switcherTeams.map((t) => ({ id: t.id, name: t.name ?? "" }))} value={team} onChange={setTeam} />
        )}
        <SearchField aria-label="Search opportunities" className="search" value={text} onChange={setText}>
          <Search size={14} aria-hidden="true" />
          <Input className="search-input" placeholder="Search…" />
          <Button className="search-clear"><X size={14} aria-hidden="true" /></Button>
        </SearchField>
        <Chips label="Whose" items={OWNERS} value={owner} onChange={setOwner} />
        <Chips label="Status" items={STATUSES} value={status} onChange={setStatus} />
      </div>
      {cards.error && <p className="alert">{cards.error}</p>}
      {allStages.loadState === "loading" && <p className="muted pad">Loading…</p>}
      <DndContext sensors={sensors} collisionDetection={columnUnder}
        accessibility={{ announcements, screenReaderInstructions: { draggable: INSTRUCTIONS } }}
        onDragStart={({ active }) => setDragging(active.id)} onDragCancel={() => setDragging(null)}
        onDragEnd={(e) => void drop(e)}>
        <div className="board crm">
          {stages.map((s) => (
            <Column key={s.id} stage={s} cards={byStage.get(String(s.id)) ?? []} currency={currency} showTeam={!team}
              folded={!!s.fold && !open[s.id]} onToggle={() => setOpen((o) => ({ ...o, [s.id]: !o[s.id] }))}
              adding={adding === s.id} onAdd={() => setAdding(s.id)} onAdded={() => setAdding(null)} team={team} />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>{lifted && <CardFace card={lifted} currency={currency} showTeam={!team} lifted />}</DragOverlay>
      </DndContext>
    </>
  );
});

/** A group of filter chips where one is on at a time (Odoo's filters, as chips). */
function Chips<T extends string>({ label, items, value, onChange }: {
  label: string; items: { id: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <ToggleButtonGroup aria-label={label} className="chips" selectionMode="single" disallowEmptySelection
      selectedKeys={[value]} onSelectionChange={(keys) => { const k = [...keys][0]; if (k != null) onChange(String(k) as T); }}>
      {items.map((i) => <ToggleButton key={i.id} id={i.id} className="chip">{i.label}</ToggleButton>)}
    </ToggleButtonGroup>
  );
}

/** Odoo's "All Teams" switcher: the pipeline of one sales team, or all of them. */
function TeamSwitcher({ teams, value, onChange }: { teams: { id: string; name: string }[]; value: string | null; onChange: (v: string | null) => void }) {
  const items = [{ id: "", name: "All Teams" }, ...teams];
  return (
    <Select aria-label="Sales team" className="team-switch" selectedKey={value ?? ""} onSelectionChange={(k) => onChange(k ? String(k) : null)}>
      <Button className="btn team-btn"><SelectValue /><ChevronDown size={14} aria-hidden="true" /></Button>
      <Popover className="popover" placement="bottom start" offset={4}>
        <ListBox className="menu" items={items}>
          {(t) => <ListBoxItem id={t.id} textValue={t.name} className="menu-item">{t.name}</ListBoxItem>}
        </ListBox>
      </Popover>
    </Select>
  );
}

const SEGMENTS: { key: string; label: string; tone: Segment["tone"] }[] = [
  { key: "planned", label: "planned", tone: "ok" },
  { key: "today", label: "due today", tone: "warn" },
  { key: "overdue", label: "overdue", tone: "danger" },
  { key: "none", label: "without activities scheduled", tone: "none" },
];

type ColumnProps = {
  stage: CrmStages; cards: Opportunities[]; currency: Currency; showTeam: boolean; folded: boolean; onToggle: () => void;
  adding: boolean; onAdd: () => void; onAdded: () => void; team: string | null;
};

const Column = observer(({ stage, cards, currency, showTeam, folded, onToggle, adding, onAdd, onAdded, team }: ColumnProps) => {
  const [only, setOnly] = useState<string | null>(null);
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const stateOf = (c: Opportunities) => c.activity_state ?? "none";
  // The bar picks which of this column's cards show; all of them are already loaded.
  const shown = only ? cards.filter((c) => stateOf(c) === only) : cards;
  const total = shown.reduce((n, c) => n + (c.expected_revenue ?? 0), 0);
  const isRotting = (c: Opportunities) => (c.rotting_days ?? 0) > 0;
  const rotting = cards.filter(isRotting).length;
  // The rotting count in the header shows only the rotting cards when pressed, as Odoo's does;
  // the column total stays the column's.
  const [rotOnly, setRotOnly] = useState(false);
  const listed = rotOnly && rotting > 0 ? shown.filter(isRotting) : shown;

  if (folded) {
    return (
      <div ref={setNodeRef} className={`col folded${isOver ? " drop" : ""}`} role="button" tabIndex={0}
        aria-label={`${stage.name}, ${cards.length} opportunities, folded. Show`} onClick={onToggle}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}>
        <h3>{stage.name} <span className="count">({cards.length})</span></h3>
      </div>
    );
  }
  return (
    <section ref={setNodeRef} className={`col${isOver ? " drop" : ""}`} aria-label={stage.name ?? undefined}>
      <h3 title={stage.requirements ?? undefined}>
        {stage.name}
        <span className="col-tools">
          {stage.fold && (
            <Button className="icon-btn" aria-label={`Fold ${stage.name}`} onPress={onToggle}><ChevronLeft size={16} aria-hidden="true" /></Button>
          )}
          <Button className="icon-btn" aria-label={`Add an opportunity to ${stage.name}`} onPress={onAdd}><Plus size={16} aria-hidden="true" /></Button>
        </span>
      </h3>
      <div className="col-head">
        <ColumnProgress label={`Activities in ${stage.name}`} selected={only} onSelect={setOnly}
          segments={SEGMENTS.map((s) => ({ ...s, count: cards.filter((c) => stateOf(c) === s.key).length }))} />
        {rotting > 0 && (
          <ToggleButton className="rot-count" isSelected={rotOnly} onChange={setRotOnly}
            aria-label={`${rotting} rotting: show only those`}>{rotting}</ToggleButton>
        )}
        <span className="col-total">{formatMoney(total, currency, true)}</span>
      </div>
      {adding && <QuickCreate stage={stage} team={team} currency={currency} onClose={onAdded} />}
      {listed.map((c) => <Card key={c.id} card={c} currency={currency} showTeam={showTeam} />)}
    </section>
  );
});

/**
 * Odoo's quick create: contact, name, email, phone, expected revenue and priority. Add creates
 * it in this column (and keeps the box open for the next one); Edit opens the full form with
 * what was typed, unsaved, so discarding there creates nothing.
 * Picking a contact fills empty email and phone from it, and an empty name becomes
 * "<contact>'s opportunity", as Odoo does.
 */
const QuickCreate = observer(({ stage, team, currency, onClose }: { stage: CrmStages; team: string | null; currency: Currency; onClose: () => void }) => {
  const db = useDb();
  const navigate = useNavigate();
  const customers = useCollection(db.customers.sort("name", "asc"));
  const [partner, setPartner] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [revenue, setRevenue] = useState(0);
  const [priority, setPriority] = useState<Level>("0");
  const [busy, setBusy] = useState(false);
  const partnerRow = customers.items.find((c) => c.id === partner);
  const finalName = name.trim() || (partnerRow?.name ? `${partnerRow.name}'s opportunity` : "");
  const edit = () => {
    const p = new URLSearchParams({ stage: stage.id, name: name.trim(), email, phone, revenue: String(revenue), priority });
    if (partner) p.set("partner", partner);
    if (team) p.set("team", team);
    navigate(`/crm/new?${p.toString()}`);
  };
  const add = async (e: FormEvent | null) => {
    e?.preventDefault();
    if (!finalName) return;
    setBusy(true);
    type Args = { name: string; partner_id?: string; email_from?: string; phone?: string; expected_revenue?: string; priority?: string; stage?: string; team?: string };
    const out = await call<Args, { id: number }>(db.run.crm_create, {
      name: finalName, partner_id: partner ?? "", email_from: email, phone, expected_revenue: String(revenue), priority,
      stage: stage.id, team: team ?? "",
    });
    setBusy(false);
    if (!out.ok) { toast(out.message); return; }
    setPartner(null); setName(""); setEmail(""); setPhone(""); setRevenue(0); setPriority("0"); setRound((r) => r + 1);
  };
  const pick = (id: string | null) => {
    setPartner(id);
    const c = customers.items.find((x) => x.id === id);
    if (c) { if (!email && c.email) setEmail(c.email); if (!phone && c.phone) setPhone(c.phone); }
  };
  return (
    <div onKeyDown={(e: ReactKeyboardEvent) => { if (e.key === "Escape" && !e.defaultPrevented) onClose(); }}>
    <Form className="quick crm-quick" onSubmit={(e) => void add(e)}>
      <ComboBox key={round} aria-label="Contact" className="combo" menuTrigger="focus" defaultItems={customers.items} selectedKey={partner}
        onSelectionChange={(k) => pick(k == null ? null : String(k))} autoFocus>
        <span className="combo-field">
          <Input className="combo-input" placeholder="Contact" />
          <Button className="combo-btn"><ChevronDown size={14} aria-hidden="true" /></Button>
        </span>
        <Popover className="popover" placement="bottom start" offset={2}>
          <ListBox className="menu" renderEmptyState={() => <div className="menu-empty">No contact found</div>}>
            {(c: { id: string; name: string | null }) => <ListBoxItem id={c.id} textValue={c.name ?? ""} className="menu-item">{c.name}</ListBoxItem>}
          </ListBox>
        </Popover>
      </ComboBox>
      <TextField aria-label="Opportunity's name" value={name} onChange={setName}>
        <Input className="input" placeholder={partnerRow?.name ? `${partnerRow.name}'s opportunity` : "Opportunity's name"} />
      </TextField>
      <TextField aria-label="Contact email" type="email" value={email} onChange={setEmail}>
        <Input className="input" placeholder="Contact email" />
      </TextField>
      <TextField aria-label="Contact phone" type="tel" value={phone} onChange={setPhone}>
        <Input className="input" placeholder="Contact phone" />
      </TextField>
      <div className="quick-money">
        <MoneyField label="Expected revenue" value={revenue} onChange={setRevenue} currency={currency} />
        <Priority value={priority} onChange={setPriority} labels={CRM_PRIORITY_LABELS} />
      </div>
      <div className="row">
        <Button type="submit" className="btn btn-primary" isDisabled={busy || !finalName}>Add</Button>
        <Button className="btn" isDisabled={busy} onPress={edit}>Edit</Button>
        <span className="grow" />
        <Button className="btn icon" aria-label="Discard" onPress={onClose}><X size={14} aria-hidden="true" /></Button>
      </div>
    </Form>
    </div>
  );
});

const Card = observer(({ card, currency, showTeam }: { card: Opportunities; currency: Currency; showTeam: boolean }) => {
  const navigate = useNavigate();
  const { attributes: { "aria-pressed": _, ...attributes }, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: String(card.id),
    disabled: card.active === false,
    attributes: { role: "group", roleDescription: "draggable opportunity" },
  });
  const openIt = () => { if (!justDropped()) navigate(`/crm/${card.id}`); };
  const ref = (el: HTMLElement | null) => { setNodeRef(el); setActivatorNodeRef(el); };
  const onKeyDown = (e: ReactKeyboardEvent) => {
    listeners?.onKeyDown?.(e);
    if (e.key === "Enter" && e.target === e.currentTarget && !isDragging) openIt();
  };
  return <CardFace card={card} currency={currency} showTeam={showTeam} cardRef={ref} dimmed={isDragging}
    props={{ ...attributes, ...listeners, onKeyDown, onClick: openIt }} />;
});

/** A card's face, on the board and under the pointer while it is dragged (`lifted`, no controls). */
const CardFace = observer(({ card, currency, showTeam, lifted, dimmed, cardRef, props }: {
  card: Opportunities; currency: Currency; showTeam: boolean; lifted?: boolean; dimmed?: boolean;
  cardRef?: (el: HTMLElement | null) => void; props?: React.HTMLAttributes<HTMLElement>;
}) => {
  const db = useDb();
  const v = usePending(crmKey(card.id), { priority: card.priority as string | null });
  const setPriority = async (priority: Level) => {
    const out = await call(db.run.crm_save, { id: Number(card.id), priority });
    if (!out.ok) toast(out.message);
    else setPending(crmKey(card.id), { priority });
  };
  const lost = card.won_status === "lost";
  const archived = card.active === false && !lost && card.won_status !== "won";
  const cls = `card crm-card${dimmed ? " dimmed" : ""}${lifted ? " lifted" : ""}`;
  return (
    <article ref={cardRef} className={cls} aria-label={card.name ?? undefined} {...props}>
      {lost && <Ribbon text="Lost" tone="danger" />}
      {archived && <Ribbon text="Archived" tone="danger" />}
      <div className="top"><span className="title">{card.name}</span></div>
      {!!card.expected_revenue && <div className="revenue">{formatMoney(card.expected_revenue, leadCurrency(card, currency))}</div>}
      {card.customer && (
        <div className="customer">
          {card.partner_id != null && <Avatar name={card.customer} />}
          <span>{card.customer}</span>
        </div>
      )}
      <CrmTagPills tagIds={card.tag_ids} />
      <div className="bottom">
        {lifted ? <PriorityStar level={Number(v.priority ?? 0)} />
          : <Priority value={v.priority} onChange={(p) => void setPriority(p)} labels={CRM_PRIORITY_LABELS} />}
        <ActivityIcon state={card.activity_state} icon={card.activity_icon} summary={card.activity_summary} />
        <span className="grow" />
        {(card.rotting_days ?? 0) > 0 && <span className="rot" title={`Rotting for ${card.rotting_days} days`}>{card.rotting_days}d</span>}
        {showTeam && card.team_name && <span className="team-badge">{card.team_name}</span>}
        {card.user_name && <span title={card.user_name} className="owner"><Avatar name={card.user_name} large /><span className="sr-only">Salesperson: {card.user_name}</span></span>}
      </div>
    </article>
  );
});
