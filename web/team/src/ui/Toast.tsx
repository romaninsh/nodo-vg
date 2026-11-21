import { useEffect, useState } from "react";

let push: ((text: string) => void) | null = null;

/** Show a short message at the bottom right for a few seconds. */
export const toast = (text: string) => push?.(text);

/** `duration` is how long a message stays, in ms (the gallery keeps it up for its snapshots). */
export function Toaster({ duration = 3500 }: { duration?: number }) {
  const [text, setText] = useState("");
  useEffect(() => {
    push = (t) => setText(t);
    return () => { push = null; };
  }, []);
  useEffect(() => {
    if (!text) return;
    const h = setTimeout(() => setText(""), duration);
    return () => clearTimeout(h);
  }, [text, duration]);
  return text ? <div className="toast" role="status">{text}</div> : null;
}
