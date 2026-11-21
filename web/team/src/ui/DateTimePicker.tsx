import { parseDate, parseDateTime, type DateValue } from "@internationalized/date";
import {
  Button, Calendar, CalendarCell, CalendarGrid, DateInput, DatePicker, DateSegment, Dialog, Group, Heading, Popover,
} from "react-aria-components";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

/**
 * A date and time field like Odoo's: typed segments (day, month, year, hours, minutes in the
 * browser's locale, 24-hour) and a calendar button. The value is local wall time as
 * "YYYY-MM-DDTHH:mm" (the format of `<input type="datetime-local">`), "" for none. With
 * `dateOnly` it is a date field (CRM's Expected Closing): "YYYY-MM-DD", no time segments.
 */
export function DateTimePicker({ value, onChange, labelId, disabled, dateOnly }: {
  value: string;
  onChange: (value: string) => void;
  labelId: string;
  disabled?: boolean;
  dateOnly?: boolean;
}) {
  const parsed: DateValue | null = value ? (dateOnly ? parseDate(value.slice(0, 10)) : parseDateTime(value)) : null;
  return (
    <DatePicker<DateValue> className="dt" aria-labelledby={labelId} granularity={dateOnly ? "day" : "minute"} hourCycle={24} hideTimeZone
      shouldForceLeadingZeros isDisabled={disabled} value={parsed}
      onChange={(v) => onChange(v ? v.toString().slice(0, dateOnly ? 10 : 16) : "")}>
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
