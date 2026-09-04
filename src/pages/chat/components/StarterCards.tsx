import {
  ImagePlus,
  Code2,
  Video as VideoIcon,
  Presentation,
  ScanSearch,
  FileText,
} from "lucide-react";
import { m as motion, AnimatePresence } from "framer-motion";

export interface StarterCardsProps {
  /** Activates the service chip for the picked card. */
  onPick: (prompt: string, mode?: string) => void;
  className?: string;
}

/** Every real service the app offers — no filler. Short labels, no descriptions. */
const CARDS = [
  { id: "image", mode: "images", Icon: ImagePlus, title: "Images" },
  { id: "web", mode: "code", Icon: Code2, title: "Website" },
  { id: "video", mode: "video", Icon: VideoIcon, title: "Video" },
  { id: "slides", mode: "slides", Icon: Presentation, title: "Slides" },
  { id: "research", mode: "deep-research", Icon: ScanSearch, title: "Research" },
  { id: "docs", mode: "docs", Icon: FileText, title: "Documents" },
];

const handleCardClick = (
  c: (typeof CARDS)[number],
  onPick: StarterCardsProps["onPick"],
) => {
  if (c.id === "integrations") {
    window.dispatchEvent(new CustomEvent("megsy:open-integrations"));
    return;
  }
  onPick("", (c as { mode?: string }).mode);
};

const chipClass =
  "group flex items-center gap-1.5 rounded-full border border-border/40 bg-muted/40 backdrop-blur-sm " +
  "px-2.5 h-7 shadow-[0_1px_2px_hsl(var(--foreground)/0.04)] " +
  "hover:bg-muted/70 hover:border-border/70 transition-colors duration-150 active:scale-[0.97]";


/** Desktop-only: compact icon chips shown below the composer (no images). */
export function StarterChips({ onPick, className = "" }: StarterCardsProps) {
  return (
    <AnimatePresence initial={false}>
      <motion.div
        key="starter-chips-desktop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className={`hidden md:flex flex-wrap items-center justify-center gap-2 ${className}`}
      >
        {CARDS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => handleCardClick(c, onPick)}
            className={chipClass}
          >
            <c.Icon
              className="w-[13px] h-[13px] text-muted-foreground shrink-0 transition-colors group-hover:text-foreground"
              strokeWidth={1.75}
            />
            <span className="text-[11.5px] font-medium tracking-[-0.01em] text-foreground/80 whitespace-nowrap transition-colors group-hover:text-foreground">
              {c.title}
            </span>
          </button>
        ))}
      </motion.div>
    </AnimatePresence>
  );
}

export function StarterCards({ onPick, className = "" }: StarterCardsProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={`w-full md:hidden ${className}`}
    >
      <div className="flex gap-2 overflow-x-auto px-2 pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden snap-x">
        {CARDS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => handleCardClick(c, onPick)}
            className={`snap-start shrink-0 ${chipClass}`}
          >
            <c.Icon
              className="w-[13px] h-[13px] text-muted-foreground shrink-0 transition-colors group-hover:text-foreground"
              strokeWidth={1.75}
            />
            <span className="text-[11.5px] font-medium tracking-[-0.01em] text-foreground/80 whitespace-nowrap transition-colors group-hover:text-foreground">
              {c.title}
            </span>
          </button>
        ))}
      </div>
    </motion.div>
  );
}

export default StarterCards;
