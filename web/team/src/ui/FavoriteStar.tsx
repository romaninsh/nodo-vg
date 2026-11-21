import type { SyntheticEvent } from "react";
import { ToggleButton } from "react-aria-components";
import { Star } from "lucide-react";
import { Hint } from "./Hint";

const stop = (e: SyntheticEvent) => e.stopPropagation();

/**
 * Odoo's favourite star on a project: yellow when it is one of my favourites; pressing it
 * toggles. Its name stays "Favorite"; aria-pressed says whether it is one.
 */
export function FavoriteStar({ on, onToggle, disabled, size = 16 }: { on: boolean; onToggle: () => void; disabled?: boolean; size?: number }) {
  return (
    <span className="fav-wrap" onClick={stop} onPointerDown={stop} onMouseDown={stop} onKeyDown={stop}>
      <Hint text={on ? "Remove from favorites" : "Add to favorites"}>
        <ToggleButton className="fav" aria-label="Favorite" isSelected={on} isDisabled={disabled} onChange={onToggle}>
          <Star size={size} aria-hidden="true" />
        </ToggleButton>
      </Hint>
    </span>
  );
}
