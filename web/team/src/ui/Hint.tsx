import type { ReactNode } from "react";
import { Tooltip, TooltipTrigger } from "react-aria-components";

/** A short tooltip on hover or keyboard focus, for a React Aria button or toggle passed as the child. */
export function Hint({ text, children }: { text: string; children: ReactNode }) {
  return (
    <TooltipTrigger delay={600} closeDelay={0}>
      {children}
      <Tooltip className="hint" offset={6}>{text}</Tooltip>
    </TooltipTrigger>
  );
}
