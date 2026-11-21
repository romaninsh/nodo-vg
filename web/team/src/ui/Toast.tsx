import { useEffect, useState } from "react";

let push: ((text: string) => void) | null = null;

/** Show a short message at the bottom right for a few seconds. */
export const toast = (text: string) => push?.(text);

export function Toaster() {
  const [text, setText] = useState("");
  useEffect(() => {
    push = (t) => setText(t);
    return () => { push = null; };
  }, []);
  useEffect(() => {
    if (!text) return;
    const h = setTimeout(() => setText(""), 3500);
    return () => clearTimeout(h);
  }, [text]);
  return text ? <div className="toast" role="status">{text}</div> : null;
}
