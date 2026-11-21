import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { observer, useCollection } from "@vantage-ui/client/react";
import { Button, Menu, MenuItem, MenuTrigger, Popover, Tab, TabList, TabPanel, Tabs } from "react-aria-components";
import { ArrowLeft, RotateCcw, Settings, Sparkles, X } from "lucide-react";
import type { Opportunities } from "../vantage.gen";
import { call, ids, tagColor, tagText, useDb, type Outcome } from "../lib";
import { setPending, usePending } from "../pending";
import {
  Avatar, CRM_PRIORITY_LABELS, DateTimePicker, MoneyField, MultiPicker, OnePicker, Priority, Ribbon, StageBar, TagColorPopover, toast,
  type Level,
} from "../ui";
import { crmKey, leadCurrency, stageForTeam, useCurrency, useMyCrm } from "./lib";
import { LostDialog } from "./LostDialog";

/**
 * One opportunity: Odoo's form, with Won, Lost and Restore, the stage bar and the action menu.
 * It reads its row as a live collection of one, so changes made anywhere (this form's own
 * actions, the board, Odoo) arrive as they happen.
 */
export const OpportunityForm = observer(() => {
  const db = useDb();
  const { id = "" } = useParams();
  const one = useCollection(db.opportunities.where({ id: Number(id) }));
  const value = one.items[0];
  if (one.error) return <p className="alert">{one.error}</p>;
  if (!value && one.loadState === "loading") return <p className="muted pad">Loading…</p>;
  if (!value) return <p className="alert">This opportunity isn't in your pipeline. <Link to="/crm">Back to the pipeline</Link></p>;
  return <Editor key={value.id} opp={value} />;
});

type Fields = { name: string; revenue: number; probability: string; deadline: string; notes: string; email: string; phone: string };
const pct = (n: number | null | undefined) => (Math.round((n ?? 0) * 100) / 100).toFixed(2);

// Odoo's form hotkeys (Alt + the key, as Odoo's data-hotkey).
const HOTKEYS = { won: "w", lost: "l", restore: "x" } as const;

const Editor = observer(({ opp }: { opp: Opportunities }) => {
  const db = useDb();
  const navigate = useNavigate();
  const mine = useMyCrm();
  const currency = leadCurrency(opp, useCurrency());
  const id = Number(opp.id);
  const key = crmKey(opp.id);
  const v = usePending(key, {
    stage_id: String(opp.stage_id ?? ""),
    priority: opp.priority as string | null,
    won_status: opp.won_status as string | null,
    active: opp.active,
    tag_ids: opp.tag_ids ?? "",
    user_id: opp.user_id == null ? "" : String(opp.user_id),
    partner_id: opp.partner_id == null ? "" : String(opp.partner_id),
    team_id: opp.team_id == null ? "" : String(opp.team_id),
    company_id: opp.company_id == null ? "" : String(opp.company_id),
  });
  const saved: Fields = {
    name: opp.name ?? "", revenue: opp.expected_revenue ?? 0, probability: pct(opp.probability),
    deadline: opp.date_deadline ?? "", notes: opp.notes ?? "", email: opp.email_from ?? "", phone: opp.phone ?? "",
  };
  const [f, setF] = useState<Fields>(saved);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [losing, setLosing] = useState(false);
  const edit = (patch: Partial<Fields>) => { setEditing(true); setF((x) => ({ ...x, ...patch })); };
  const dirty = (Object.keys(saved) as (keyof Fields)[]).some((k) => f[k] !== saved[k]);

  // Changes made elsewhere (the board, Odoo, this form's buttons) show here unless you are editing.
  useEffect(() => {
    if (!editing) setF(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved.name, saved.revenue, saved.probability, saved.deadline, saved.notes, saved.email, saved.phone]);

  const stages = useCollection(db.crm_stages.sort("sequence", "asc")).items.filter((s) => stageForTeam(s.team_ids, v.team_id || null));
  const people = useCollection(db.people.sort("name", "asc")).items.map((p) => ({ id: p.id, name: p.name ?? "" }));
  const customers = useCollection(db.customers.sort("name", "asc")).items.map((c) => ({ id: c.id, name: c.name ?? "" }));
  const teams = useCollection(db.sales_teams.sort("sequence", "asc")).items.map((t) => ({ id: t.id, name: t.name ?? "" }));
  const companies = useCollection(db.companies.sort("name", "asc")).items
    .filter((c) => !mine?.company_ids || ids(mine.company_ids).includes(c.id))
    .map((c) => ({ id: c.id, name: c.name ?? "" }));
  const tags = useCollection(db.crm_tags.sort("name", "asc")).items;
  const tagColour = new Map(tags.map((t) => [t.id, t.color]));
  // The tag whose colour picker is open, and the chip it opens from.
  const [recolour, setRecolour] = useState<string | null>(null);
  const recolourAnchor = useRef<HTMLElement | null>(null);
  const recolourTag = tags.find((t) => t.id === recolour);

  const lost = v.won_status === "lost";
  const won = v.won_status === "won";
  const pending = v.won_status === "pending" && v.active !== false;
  const archived = v.active === false && !lost && !won;
  const automated = pct(opp.automated_probability);
  const rotting = (opp.rotting_days ?? 0) > 0 ? `${opp.rotting_days}d` : null;

  const run = async (p: Promise<Outcome>, ok?: () => void, message?: string) => {
    setBusy(true);
    const out = await p;
    setBusy(false);
    if (!out.ok) toast(out.message);
    else { ok?.(); if (message) toast(message); }
    return out.ok;
  };

  const save = async () => {
    const args: { id: number; name?: string; expected_revenue?: string; probability?: string; date_deadline?: string; description?: string } = { id };
    if (f.name !== saved.name) args.name = f.name;
    if (f.revenue !== saved.revenue) args.expected_revenue = String(f.revenue);
    if (f.probability !== saved.probability) args.probability = f.probability;
    if (f.deadline !== saved.deadline) args.date_deadline = f.deadline;
    if (f.notes !== saved.notes) args.description = f.notes;
    if (Object.keys(args).length > 1 && !(await run(call(db.run.crm_save, args)))) return;
    // Email and phone are saved through Odoo, which checks them and copies them to the contact.
    const odoo = [f.email !== saved.email && "email_from", f.phone !== saved.phone && "phone"].filter(Boolean) as string[];
    if (odoo.length && !(await run(call(db.run.crm_odoo_write, { id, fields: odoo.join(","), email_from: f.email, phone: f.phone })))) return;
    setEditing(false);
    toast("Saved");
  };
  const discard = () => { setF(saved); setEditing(false); };

  const odooWrite = (fields: string, args: Record<string, string>, pendingPatch: Record<string, string>) =>
    run(call(db.run.crm_odoo_write, { id, fields, ...args }), () => setPending(key, pendingPatch));
  const move = (stage: string, name: string) =>
    run(call<{ id: number; stage: number }, { won: boolean }>(db.run.crm_move, { id, stage: Number(stage) }).then((o) => {
      if (o.ok) { setPending(key, { stage_id: stage }); toast(o.value.won ? `Won. Congratulations!` : `Moved to ${name}`); }
      return o;
    }));
  const markWon = () => run(call(db.run.crm_won, { id }), undefined, "Won. Congratulations!");
  const markLost = (reason: string | null) =>
    run(call(db.run.crm_lost, reason ? { id, reason: Number(reason) } : { id }), () => setLosing(false), "Marked as lost");
  const restore = () => run(call(db.run.crm_restore, { id }), undefined, "Restored");
  const archive = (active: boolean) => run(call(db.run.crm_archive, { id, active }), undefined, active ? "Unarchived" : "Archived");
  const duplicate = async () => {
    setBusy(true);
    const out = await call<{ id: number }, { id: number }>(db.run.crm_duplicate, { id });
    setBusy(false);
    if (!out.ok) { toast(out.message); return; }
    toast("Duplicated");
    navigate(`/crm/${out.value.id}`);
  };
  const remove = async () => {
    if (!window.confirm(`Delete "${saved.name}"? This can't be undone.`)) return;
    if (await run(call(db.run.crm_delete, { id }), undefined, "Deleted")) navigate("/crm");
  };

  // Odoo's hotkeys: Alt+W Won, Alt+L Lost, Alt+X Restore.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey || busy) return;
      const k = e.code.replace("Key", "").toLowerCase();
      if (k === HOTKEYS.won && pending) { e.preventDefault(); void markWon(); }
      else if (k === HOTKEYS.lost && pending) { e.preventDefault(); setLosing(true); }
      else if (k === HOTKEYS.restore && lost) { e.preventDefault(); void restore(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <>
      <div className="cp">
        <div className="crumbs"><Link to="/crm">Pipeline</Link><span className="sep">/</span><span>{saved.name}</span></div>
        <ActionMenu canDelete={!!mine?.manager} pending={pending} archived={v.active === false} disabled={busy}
          onDuplicate={() => void duplicate()} onArchive={() => void archive(v.active === false)}
          onDelete={() => void remove()} onLost={() => setLosing(true)} />
        <Button className="btn btn-primary" isDisabled={busy || !dirty || !f.name.trim()} onPress={() => void save()}>Save</Button>
        {dirty && <Button className="btn" onPress={discard}>Discard</Button>}
      </div>
      <div className="sheet crm-sheet">
        <div className="status">
          {pending && <Button className="btn btn-primary" isDisabled={busy} aria-keyshortcuts="Alt+W" onPress={() => void markWon()}>Won</Button>}
          {pending && <Button className="btn secondary" isDisabled={busy} aria-keyshortcuts="Alt+L" onPress={() => setLosing(true)}>Lost</Button>}
          {lost && <Button className="btn" isDisabled={busy} aria-keyshortcuts="Alt+X" onPress={() => void restore()}><RotateCcw size={14} aria-hidden="true" /> Restore</Button>}
          <div className="grow" />
          <StageBar label="Stage" stages={stages.map((s) => ({ id: s.id, name: s.name ?? "", folded: !!s.fold }))} badge={rotting}
            current={v.stage_id} disabled={busy || lost || v.active === false} onSelect={(s) => void move(s.id, s.name)} />
        </div>
        <div className="sheet-body">
          {won && <Ribbon text="Won" tone="ok" />}
          {lost && <Ribbon text="Lost" tone="danger" />}
          {archived && <Ribbon text="Archived" tone="danger" />}
          <div className="titlerow">
            <input aria-label="Opportunity" value={f.name} placeholder="e.g. Product Pricing"
              onChange={(e) => edit({ name: e.target.value })}
              onKeyDown={(e) => { if (e.key === "Enter" && dirty) void save(); }} />
          </div>
          <div className="revenue-row">
            <div>
              <span className="flabel" id="f-revenue">Expected Revenue</span>
              <MoneyField label="Expected Revenue" value={f.revenue} currency={currency} onChange={(n) => edit({ revenue: n })} />
            </div>
            <span className="at">at</span>
            <div>
              <span className="flabel" id="f-probability">Probability</span>
              <span className="prob">
                <input aria-labelledby="f-probability" inputMode="decimal" value={f.probability} disabled={!pending}
                  onChange={(e) => edit({ probability: e.target.value })} />
                <span>%</span>
                {!lost && f.probability !== automated && (
                  <Button className="auto-prob" isDisabled={busy || !pending}
                    aria-label={`Use the automated probability, ${automated} %`}
                    onPress={() => void run(call(db.run.crm_automated_probability, { id }), () => setEditing(false))}>
                    <Sparkles size={14} aria-hidden="true" /> ~ {automated} %
                  </Button>
                )}
              </span>
            </div>
          </div>
          <div className="crm-groups">
            <div className="fields">
              <span className="flabel" id="f-contact">Contact</span>
              <OnePicker labelId="f-contact" options={customers} selected={v.partner_id || null} clearable placeholder="Select a contact…"
                disabled={busy} onChange={(p) => void odooWrite("partner_id", { partner_id: p ?? "" }, { partner_id: p ?? "" })} />
              <label className="flabel" htmlFor="f-email">Email</label>
              <input id="f-email" className="line-input" type="email" value={f.email} onChange={(e) => edit({ email: e.target.value })} />
              <label className="flabel" htmlFor="f-phone">Phone</label>
              <input id="f-phone" className="line-input" type="tel" value={f.phone} placeholder="e.g. (555) 555-0199" onChange={(e) => edit({ phone: e.target.value })} />
              {lost && <><span className="flabel">Lost Reason</span><span>{opp.lost_reason ?? "—"}</span></>}
            </div>
            <div className="fields">
              <span className="flabel" id="f-user">Salesperson</span>
              <OnePicker labelId="f-user" options={people} selected={v.user_id || null} clearable placeholder="Unassigned"
                disabled={busy} before={(o) => <Avatar name={o.name} large />}
                onChange={(u) => void odooWrite("user_id", { user_id: u ?? "" }, { user_id: u ?? "" })} />
              <span className="flabel" id="f-deadline">Expected Closing</span>
              <span className="deadline-field">
                <DateTimePicker dateOnly labelId="f-deadline" value={f.deadline} onChange={(d) => edit({ deadline: d })} />
                {f.deadline && <Button className="btn icon" aria-label="Clear the expected closing" onPress={() => edit({ deadline: "" })}><X size={14} aria-hidden="true" /></Button>}
                <span className="grow" />
                <Priority value={v.priority} labels={CRM_PRIORITY_LABELS} disabled={busy}
                  onChange={(priority: Level) => void run(call(db.run.crm_save, { id, priority }), () => setPending(key, { priority }))} />
              </span>
              <span className="flabel" id="f-tags">Tags</span>
              <MultiPicker labelId="f-tags" addLabel="Add a tag" placeholder="Add a tag…" disabled={busy}
                options={tags.map((t) => ({ id: t.id, name: t.name ?? "" }))} selected={ids(v.tag_ids)}
                chipStyle={(o) => ({ background: tagColor(tagColour.get(o.id)), color: tagText(tagColour.get(o.id)) })}
                chip={(o) => (
                  // A plain button: React Aria controls can't sit inside a chip. It opens the one
                  // colour picker below, anchored to it.
                  <button type="button" className="tag-btn chip-color" aria-label={`${o.name}: change its colour`}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { recolourAnchor.current = e.currentTarget; setRecolour(o.id); }}>
                    {o.name}
                  </button>
                )}
                onChange={(l) => {
                  const sorted = [...l].sort((a, b) => Number(a) - Number(b)).join(",");
                  void odooWrite("tag_ids", { tag_ids: l.join(",") }, { tag_ids: sorted });
                }} />
              {recolourTag && (
                <TagColorPopover anchor={recolourAnchor} open onOpenChange={(o) => { if (!o) setRecolour(null); }}
                  name={recolourTag.name ?? ""} color={recolourTag.color ?? 0}
                  onChange={(c) => void run(call(db.run.crm_tag_color, { id: Number(recolourTag.id), color: c }))} />
              )}
            </div>
          </div>
          <Tabs className="form-tabs">
            <TabList aria-label="More" className="tablist">
              <Tab id="notes" className="tab">Notes</Tab>
              <Tab id="extra" className="tab">Extra Info</Tab>
            </TabList>
            <TabPanel id="notes">
              <textarea className="desc" aria-label="Notes" value={f.notes} placeholder="Add a description…" onChange={(e) => edit({ notes: e.target.value })} />
            </TabPanel>
            <TabPanel id="extra">
              <div className="crm-groups">
                <div className="fields">
                  <span className="group-title">Marketing</span><span />
                  <span className="flabel">Campaign</span><span>{opp.campaign ?? ""}</span>
                  <span className="flabel">Medium</span><span>{opp.medium ?? ""}</span>
                  <span className="flabel">Source</span><span>{opp.source ?? ""}</span>
                  <span className="flabel">Referred By</span><span>{opp.referred ?? ""}</span>
                </div>
                <div className="fields">
                  <span className="group-title">Ownership</span><span />
                  <span className="flabel" id="f-company">Company</span>
                  <OnePicker labelId="f-company" options={companies} selected={v.company_id || null} clearable disabled={busy}
                    onChange={(c) => void odooWrite("company_id", { company_id: c ?? "" }, { company_id: c ?? "" })} />
                  <span className="flabel" id="f-team">Sales Team</span>
                  <OnePicker labelId="f-team" options={teams} selected={v.team_id || null} clearable disabled={busy}
                    onChange={(t) => void odooWrite("team_id", { team_id: t ?? "" }, { team_id: t ?? "" })} />
                </div>
              </div>
            </TabPanel>
          </Tabs>
          <p className="muted">Name, revenue, probability, expected closing, email, phone and notes are kept with Save; the stage, priority, contact, salesperson, tags, company and team are saved at once.</p>
          <Button className="btn" onPress={() => navigate(-1)}><ArrowLeft size={14} aria-hidden="true" /> Back</Button>
        </div>
      </div>
      <LostDialog open={losing} busy={busy} onClose={() => setLosing(false)} onConfirm={(r) => void markLost(r)} />
    </>
  );
});

/**
 * Odoo's action menu (the gear beside the record's name): Duplicate, Archive or Unarchive,
 * Delete (Sales administrators only, as in Odoo) and Mark Lost.
 */
function ActionMenu({ canDelete, pending, archived, disabled, onDuplicate, onArchive, onDelete, onLost }: {
  canDelete: boolean; pending: boolean; archived: boolean; disabled: boolean;
  onDuplicate: () => void; onArchive: () => void; onDelete: () => void; onLost: () => void;
}) {
  return (
    <MenuTrigger>
      <Button className="btn icon" aria-label="Actions" isDisabled={disabled}><Settings size={16} aria-hidden="true" /></Button>
      <Popover className="popover" placement="bottom start" offset={4}>
        <Menu className="menu" aria-label="Actions" onAction={(k) => {
          if (k === "duplicate") onDuplicate();
          if (k === "archive") onArchive();
          if (k === "delete") onDelete();
          if (k === "lost") onLost();
        }}>
          <MenuItem id="duplicate" className="menu-item">Duplicate</MenuItem>
          <MenuItem id="archive" className="menu-item">{archived ? "Unarchive" : "Archive"}</MenuItem>
          {canDelete && <MenuItem id="delete" className="menu-item">Delete</MenuItem>}
          {pending && <MenuItem id="lost" className="menu-item">Mark Lost</MenuItem>}
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}

/**
 * The full form for a new opportunity, opened by quick create's Edit with what was typed there.
 * Nothing is created until Save (through Odoo's own create); Discard goes back.
 */
export const NewOpportunityForm = observer(() => {
  const db = useDb();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const currency = useCurrency();
  const customers = useCollection(db.customers.sort("name", "asc")).items;
  const [name, setName] = useState(params.get("name") ?? "");
  const [partner, setPartner] = useState<string | null>(params.get("partner"));
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [phone, setPhone] = useState(params.get("phone") ?? "");
  const [revenue, setRevenue] = useState(Number(params.get("revenue") ?? 0) || 0);
  const [priority, setPriority] = useState<Level>((params.get("priority") as Level) ?? "0");
  const [busy, setBusy] = useState(false);
  const partnerName = customers.find((c) => c.id === partner)?.name ?? "";
  const finalName = name.trim() || (partnerName ? `${partnerName}'s opportunity` : "");
  const save = async () => {
    setBusy(true);
    type Args = { name: string; partner_id?: string; email_from?: string; phone?: string; expected_revenue?: string; priority?: string; stage?: string; team?: string };
    const out = await call<Args, { id: number }>(db.run.crm_create, {
      name: finalName, partner_id: partner ?? "", email_from: email, phone, expected_revenue: String(revenue), priority,
      stage: params.get("stage") ?? "", team: params.get("team") ?? "",
    });
    setBusy(false);
    if (!out.ok) { toast(out.message); return; }
    navigate(`/crm/${out.value.id}`, { replace: true });
  };
  return (
    <>
      <div className="cp">
        <div className="crumbs"><Link to="/crm">Pipeline</Link><span className="sep">/</span><span>New</span></div>
        <Button className="btn btn-primary" isDisabled={busy || !finalName} onPress={() => void save()}>Save</Button>
        <Button className="btn" onPress={() => navigate(-1)}>Discard</Button>
      </div>
      <div className="sheet crm-sheet">
        <div className="titlerow">
          <input aria-label="Opportunity" value={name} placeholder={partnerName ? `${partnerName}'s opportunity` : "e.g. Product Pricing"}
            onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="revenue-row">
          <div>
            <span className="flabel">Expected Revenue</span>
            <MoneyField label="Expected Revenue" value={revenue} currency={currency} onChange={setRevenue} />
          </div>
          <Priority value={priority} labels={CRM_PRIORITY_LABELS} onChange={setPriority} />
        </div>
        <div className="crm-groups">
          <div className="fields">
            <span className="flabel" id="n-contact">Contact</span>
            <OnePicker labelId="n-contact" options={customers.map((c) => ({ id: c.id, name: c.name ?? "" }))} selected={partner} clearable
              placeholder="Select a contact…" onChange={(p) => {
                setPartner(p);
                const c = customers.find((x) => x.id === p);
                if (c) { if (!email && c.email) setEmail(c.email); if (!phone && c.phone) setPhone(c.phone); }
              }} />
            <label className="flabel" htmlFor="n-email">Email</label>
            <input id="n-email" className="line-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <label className="flabel" htmlFor="n-phone">Phone</label>
            <input id="n-phone" className="line-input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>
        <p className="muted">Saved through Odoo's own create when you press Save, which fills in the team, the stage, the probability and the rest.</p>
      </div>
    </>
  );
});
