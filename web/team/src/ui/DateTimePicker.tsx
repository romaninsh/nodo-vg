import { parseDateTime, type CalendarDateTime } from "@internationalized/date";
import {
  Button, Calendar, CalendarCell, CalendarGrid, DateInput, DatePicker, DateSegment, Dialog, Group, Heading, Popover,
} from "react-aria-components";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

/**
 * A date and time field like Odoo's: typed segments (day, month, year, hours, minutes in the
 * browser's locale, 24-hour) and a calendar button. The value is local wall time as
 * "YYYY-MM-DDTHH:mm" (the format of `<input type="datetime-local">`), "" for none.
 */
export function DateTimePicker({ value, onChange, labelId, disabled }: {
  value: string;
  onChange: (value: string) => void;
  labelId: string;
  disabled?: boolean;
}) {
  const parsed = value ? parseDateTime(value) : null;
  return (
    <DatePicker<CalendarDateTime> className="dt" aria-labelledby={labelId} granularity="minute" hourCycle={24} hideTimeZone
      shouldForceLeadingZeros isDisabled={disabled} value={parsed}
      onChange={(v) => onChange(v ? v.toString().slice(0, 16) : "")}>
      <Group className="dt-group">
        <DateInput className="dt-input">{(segment) => <DateSegment segment={segment} className="dt-seg" />}</DateInput>
        <Button className="dt-btn"><CalendarDays size={16} aria-hidden="true" /></Button>
      </Group>
      <Popover className="popover" placement="bottom start" offset={4}>
        <Dialog className="dt-dialog">
          <Calendar className="cal">
            <header className="cal-head">
              <Button slot="previous" className="cal-nav"><ChevronLeft size={16} aria-hidden="true" /></Button>
              <Heading className="cal-title" />
              <Button slot="next" className="cal-nav"><ChevronRight size={16} aria-hidden="true" /></Button>
            </header>
            <CalendarGrid className="cal-grid">{(date) => <CalendarCell date={date} className="cal-cell" />}</CalendarGrid>
          </Calendar>
        </Dialog>
      </Popover>
    </DatePicker>
  );
}
