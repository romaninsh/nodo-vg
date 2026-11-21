import { useState } from "react";
import { Button, Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import { observer, useCollection } from "@vantage-ui/client/react";
import { X } from "lucide-react";
import { useDb } from "../lib";
import { ChoiceBadges } from "../ui";

/**
 * Odoo's "Mark Lost" dialog: the lost reasons as badges (none is allowed), then Mark as Lost or
 * Discard. Odoo's closing note isn't here: Odoo keeps it only in the chatter, which nodo
 * doesn't write yet.
 */
export const LostDialog = observer(({ open, busy, onClose, onConfirm }: {
  open: boolean;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (reason: string | null) => void;
}) => {
  const db = useDb();
  const reasons = useCollection(db.lost_reasons.all);
  const [reason, setReason] = useState<string | null>(null);
  return (
    <ModalOverlay className="overlay" isOpen={open} onOpenChange={(o) => { if (!o) onClose(); }} isDismissable>
      <Modal className="modal">
        <Dialog className="dialog">
          <header className="dialog-head">
            <Heading slot="title">Mark Lost</Heading>
            <Button className="icon-btn" aria-label="Close" onPress={onClose}><X size={18} aria-hidden="true" /></Button>
          </header>
          <ChoiceBadges label="Lost reason" choices={reasons.items.map((r) => ({ id: r.id, name: r.name ?? "" }))}
            value={reason} onChange={setReason} clearable />
          <footer className="dialog-foot">
            <Button className="btn btn-primary" isDisabled={busy} onPress={() => onConfirm(reason)}>Mark as Lost</Button>
            <Button className="btn" onPress={onClose}>Discard</Button>
          </footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
});
