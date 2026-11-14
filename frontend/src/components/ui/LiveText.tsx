import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { cn } from "@/lib/utils";
import { playTypingSound } from "@/lib/typingSounds";

// Draws a field's text so each character can animate. The real field stays
// underneath with its text and caret transparent (`.live-input`), so typing,
// autofill, password managers and screen readers work as usual. Kerning and
// ligatures are off on both, so every character here is exactly as wide as
// the one under it and clicks land where the text is drawn.

export type LiveField = HTMLInputElement | HTMLTextAreaElement;

type Glyph = { key: number; text: string; enter: boolean; delay: number };

// By grapheme, so a Telugu syllable or an emoji animates as one character.
const segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl
  ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
  : null;
const split = (value: string) => (segmenter ? Array.from(segmenter.segment(value), (s) => s.segment) : Array.from(value));

// Unchanged glyphs keep their keys, so only inserted ones animate.
function diff(prev: Glyph[], next: string[], newKey: () => number, enter: boolean): Glyph[] {
  let head = 0;
  while (head < prev.length && head < next.length && prev[head].text === next[head]) head++;
  let tail = 0;
  while (
    tail < prev.length - head &&
    tail < next.length - head &&
    prev[prev.length - 1 - tail].text === next[next.length - 1 - tail]
  ) tail++;
  const inserted = next.slice(head, next.length - tail);
  const step = inserted.length > 1 ? Math.min(12, 160 / inserted.length) : 0;
  return [
    ...prev.slice(0, head),
    ...inserted.map((text, i) => ({ key: newKey(), text, enter, delay: Math.round(i * step) })),
    ...prev.slice(prev.length - tail),
  ];
}

const reducedMotion = () =>
  typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Matches --animate-flip-out's duration in index.css.
const FLIP_HALF_MS = 100;

type Selection = { start: number; end: number; focused: boolean; left: number; top: number };

// Values set from code (react-hook-form's reset(), a controlled value) fire
// no input event, so the `value` setter is wrapped to catch them. It chains
// to the existing setter, which is React's value tracker.
function watchValue(field: LiveField, onChange: () => void) {
  const own = Object.getOwnPropertyDescriptor(field, "value");
  const base = own ?? Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), "value");
  const get = base?.get;
  const set = base?.set;
  if (!get || !set) return () => {};
  const setValue = function (this: LiveField, value: string) {
    set.call(this, value);
    queueMicrotask(onChange);
  };
  Object.defineProperty(field, "value", {
    configurable: true,
    enumerable: base?.enumerable,
    get() {
      return get.call(this);
    },
    set: setValue,
  });
  return () => {
    if (Object.getOwnPropertyDescriptor(field, "value")?.set !== setValue) return;
    if (own) Object.defineProperty(field, "value", own);
    else delete (field as { value?: string }).value;
  };
}

interface LiveTextProps {
  fieldRef: RefObject<LiveField | null>;
  multiline?: boolean;
  // Each character in a 1ch slot (the field uses font-mono), so a dot and
  // its letter are the same width and showing the password moves nothing.
  password?: boolean;
  masked?: boolean;
  padding?: string;
  className?: string;
}

export function LiveText({ fieldRef, multiline = false, password = false, masked = false, padding, className }: LiveTextProps) {
  const [glyphs, setGlyphs] = useState<Glyph[]>([]);
  const [selection, setSelection] = useState<Selection>({ start: 0, end: 0, focused: false, left: 0, top: 0 });
  // Chrome hides autofilled text from the page until the person interacts,
  // so meanwhile the field shows its own text.
  const [autofilled, setAutofilled] = useState(false);

  const glyphsRef = useRef(glyphs);
  const valueRef = useRef("");
  const nextKey = useRef(0);
  const maskedRef = useRef(masked);
  const scrollRef = useRef(0);
  const lastCaret = useRef<string | null>(null);
  const boundaries = useRef<{ x: number; index: number }[]>([]);

  const rootRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const caretRef = useRef<HTMLSpanElement>(null);
  const highlightRef = useRef<HTMLSpanElement>(null);

  // Derived during render, so the frame right after Show/Hide already flips.
  const [reveal, setReveal] = useState({ masked, epoch: 0, keys: new Set<number>() });
  if (reveal.masked !== masked) {
    setReveal({ masked, epoch: reveal.epoch + 1, keys: new Set(glyphs.map((g) => g.key)) });
  }

  useEffect(() => {
    maskedRef.current = masked;
  }, [masked]);

  const sync = useCallback((enter: boolean) => {
    const field = fieldRef.current;
    if (!field) return;
    const { value } = field;
    if (value !== valueRef.current) {
      valueRef.current = value;
      glyphsRef.current = diff(glyphsRef.current, split(value), () => ++nextKey.current, enter && !reducedMotion());
      setGlyphs(glyphsRef.current);
    }
    const next = {
      start: field.selectionStart ?? value.length,
      end: field.selectionEnd ?? value.length,
      focused: document.activeElement === field,
      left: field.scrollLeft,
      top: field.scrollTop,
    };
    setSelection((prev) =>
      prev.start === next.start && prev.end === next.end && prev.focused === next.focused &&
      prev.left === next.left && prev.top === next.top
        ? prev
        : next
    );
  }, [fieldRef]);

  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;

    // Arrow keys, drags and the browser scrolling the field fire no single
    // event, so the focused field is read every frame.
    let frame = 0;
    const loop = () => {
      sync(false);
      frame = requestAnimationFrame(loop);
    };

    const onInput = (event: Event) => {
      const { inputType = "", isComposing = false, data = null } = event as InputEvent;
      sync(inputType.startsWith("insert") && !isComposing);
      const numeric = field.inputMode === "numeric" || field.inputMode === "decimal";
      if (inputType.startsWith("delete")) playTypingSound(numeric ? "digit-delete" : "delete");
      else if (inputType.startsWith("insert")) {
        // No distinct space sound in a password: it would give away where the spaces are.
        const wide = data === " " || inputType === "insertLineBreak";
        playTypingSound(wide && !password ? "space" : numeric ? "digit" : "key");
      }
    };
    const onFocus = () => {
      cancelAnimationFrame(frame);
      loop();
    };
    const onBlur = () => {
      cancelAnimationFrame(frame);
      sync(false);
    };
    const onAnimation = (event: AnimationEvent) => {
      if (event.animationName === "autofill-on") setAutofilled(true);
      if (event.animationName === "autofill-off") {
        setAutofilled(false);
        sync(false);
      }
    };
    // Our dots may not be the browser's width, so the browser's caret can
    // land somewhere other than where the click was on the drawn dots.
    const onPointerUp = (event: PointerEvent) => {
      if (!maskedRef.current) return;
      const x = event.clientX;
      requestAnimationFrame(() => {
        const track = trackRef.current;
        if (!track || field.selectionStart !== field.selectionEnd) return;
        const local = x - track.getBoundingClientRect().left;
        let best = boundaries.current[0];
        for (const b of boundaries.current) if (Math.abs(b.x - local) < Math.abs(best.x - local)) best = b;
        if (best) field.setSelectionRange(best.index, best.index);
      });
    };
    const onReset = () => requestAnimationFrame(() => sync(false));

    const el: HTMLElement = field;
    const unwatch = watchValue(field, () => sync(false));
    sync(false);
    if (document.activeElement === field) loop();
    el.addEventListener("input", onInput);
    el.addEventListener("focus", onFocus);
    el.addEventListener("blur", onBlur);
    el.addEventListener("animationstart", onAnimation);
    el.addEventListener("pointerup", onPointerUp);
    field.form?.addEventListener("reset", onReset);
    return () => {
      cancelAnimationFrame(frame);
      unwatch();
      el.removeEventListener("input", onInput);
      el.removeEventListener("focus", onFocus);
      el.removeEventListener("blur", onBlur);
      el.removeEventListener("animationstart", onAnimation);
      el.removeEventListener("pointerup", onPointerUp);
      field.form?.removeEventListener("reset", onReset);
    };
  }, [fieldRef, sync, password]);

  // Sized to the textarea's client box, which excludes its scrollbar, so
  // lines wrap at the same width.
  useLayoutEffect(() => {
    const field = fieldRef.current;
    const root = rootRef.current;
    if (!multiline || !field || !root) return;
    const fit = () => {
      root.style.left = `${field.offsetLeft + field.clientLeft}px`;
      root.style.top = `${field.offsetTop + field.clientTop}px`;
      root.style.width = `${field.clientWidth}px`;
      root.style.height = `${field.clientHeight}px`;
    };
    fit();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(fit);
    observer.observe(field);
    return () => observer.disconnect();
  }, [fieldRef, multiline]);

  // Written to the DOM directly rather than through state: it runs on every
  // cursor move.
  useLayoutEffect(() => {
    const view = viewRef.current;
    const track = trackRef.current;
    const caret = caretRef.current;
    const highlight = highlightRef.current;
    if (!view || !track || !caret || !highlight) return;

    const origin = track.getBoundingClientRect();
    const boxes: { x: number; y: number; w: number; h: number; index: number }[] = [];
    let index = 0;
    track.querySelectorAll<HTMLElement>("[data-glyph]").forEach((el, i) => {
      const rect = el.getClientRects()[0] ?? el.getBoundingClientRect();
      boxes.push({ x: rect.left - origin.left, y: rect.top - origin.top, w: rect.width, h: rect.height, index });
      index += glyphs[i]?.text.length ?? 0;
    });
    boundaries.current = boxes;
    const at = (i: number) => boxes.find((b) => b.index >= i) ?? boxes[boxes.length - 1];

    const { start, end, focused } = selection;
    const caretBox = at(end);
    let left = selection.left;
    if (masked) {
      const width = view.clientWidth;
      left = scrollRef.current;
      if (caretBox.x - left > width - 2) left = caretBox.x - width + 2;
      if (caretBox.x < left) left = caretBox.x;
      left = Math.max(0, Math.min(left, boxes[boxes.length - 1].x + 2 - width));
    }
    scrollRef.current = left;
    track.style.transform = `translate(${-left}px, ${multiline ? -selection.top : 0}px)`;

    const collapsed = start === end;
    caret.style.display = focused && collapsed ? "" : "none";
    const place = multiline ? `translate(${caretBox.x - 1}px, ${caretBox.y}px)` : `translateX(${caretBox.x - 1}px)`;
    if (lastCaret.current !== place) {
      // Restarts the blink, so the caret stays solid while it moves.
      caret.style.animation = "none";
      void caret.offsetWidth;
      caret.style.animation = "";
    }
    caret.style.transform = place;
    if (multiline) caret.style.height = `${caretBox.h}px`;
    lastCaret.current = place;

    const bars: HTMLElement[] = [];
    if (focused && !collapsed) {
      const from = Math.min(start, end);
      const to = Math.max(start, end);
      if (multiline) {
        const lines = new Map<number, { x: number; r: number; y: number; h: number }>();
        for (const b of boxes) {
          if (b.index < from || b.index >= to) continue;
          const key = Math.round(b.y);
          const line = lines.get(key);
          if (line) {
            line.x = Math.min(line.x, b.x);
            line.r = Math.max(line.r, b.x + b.w);
          } else lines.set(key, { x: b.x, r: b.x + b.w, y: b.y, h: b.h });
        }
        lines.forEach((line) => bars.push(bar(line.x, line.r - line.x, line.y, line.h)));
      } else {
        const x = at(from).x;
        bars.push(bar(x, at(to).x - x));
      }
    }
    highlight.replaceChildren(...bars);
  }, [glyphs, selection, masked, multiline, reveal.epoch]);

  const count = reveal.keys.size;
  const revealStep = count ? Math.min(16, 160 / count) : 0;
  let revealIndex = 0;
  // Chrome gives a box holding only a space zero width (it treats the space
  // as trailing), which drew "a b" as "ab". A no-break space keeps its width.
  const face = (hidden: boolean, text: string) =>
    hidden ? <span className="inline-block size-[0.4em] rounded-full bg-current" /> : text === " " ? " " : text;

  const slots = glyphs.map((glyph) => {
    const revealing = reveal.keys.has(glyph.key);
    const delay = revealing ? Math.round(revealIndex++ * revealStep) : 0;
    const enterStyle = glyph.enter && glyph.delay ? { animationDelay: `${glyph.delay}ms` } : undefined;

    // Inline, so lines break where the textarea breaks them. An inline box
    // can't be transformed, so these only fade in.
    if (multiline) {
      return (
        <span
          key={glyph.key}
          data-glyph=""
          className={cn(glyph.enter && "animate-glyph-fade motion-reduce:animate-none")}
          style={enterStyle}
        >
          {glyph.text}
        </span>
      );
    }
    return (
      <span
        key={glyph.key}
        data-glyph=""
        className={cn(
          "relative",
          password ? "inline-flex h-[1.3em] w-[1ch] items-center justify-center [perspective:4em]" : "inline-block",
          glyph.enter && "animate-glyph-in motion-reduce:animate-none"
        )}
        style={enterStyle}
      >
        <span
          key={reveal.epoch}
          className={cn("inline-flex", revealing && "animate-flip-in motion-reduce:animate-none")}
          style={revealing ? { animationDelay: `${delay + FLIP_HALF_MS}ms` } : undefined}
        >
          {face(masked, glyph.text)}
        </span>
        {revealing && (
          <span
            key={`out-${reveal.epoch}`}
            className="absolute inset-0 flex animate-flip-out items-center justify-center motion-reduce:hidden"
            style={{ animationDelay: `${delay}ms` }}
          >
            {face(!masked, glyph.text)}
          </span>
        )}
      </span>
    );
  });

  const caretClass =
    "live-caret absolute top-0 left-0 w-0.5 rounded-full bg-leaf transition-transform duration-[90ms] ease-out motion-reduce:transition-none";

  // The zero-width marker after the last glyph is where the caret sits at
  // the end of the text, including on the new line after a final Enter.
  if (multiline) {
    return (
      <div
        ref={rootRef}
        aria-hidden="true"
        className={cn("pointer-events-none absolute overflow-hidden", className)}
      >
        <div ref={viewRef} className="absolute inset-0">
          <div
            ref={trackRef}
            className={cn(
              "absolute top-0 left-0 w-full whitespace-pre-wrap break-words text-fg [font-kerning:none] [font-variant-ligatures:none]",
              padding
            )}
          >
            <span ref={highlightRef} />
            {slots}
            <span data-glyph="">{"​"}</span>
            <span ref={caretRef} className={caretClass} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 flex", autofilled && "invisible", padding, className)}
    >
      <div ref={viewRef} className="relative flex-1 overflow-hidden">
        <div
          ref={trackRef}
          className="absolute inset-y-0 left-0 flex items-center whitespace-pre leading-[normal] text-fg [font-kerning:none] [font-variant-ligatures:none]"
        >
          <span ref={highlightRef} />
          {slots}
          <span data-glyph="" className="inline-block">{"​"}</span>
          <span ref={caretRef} className={cn(caretClass, "top-1/2 -mt-[0.6em] h-[1.2em]")} />
        </div>
      </div>
    </div>
  );
}

function bar(x: number, width: number, y?: number, height?: number) {
  const el = document.createElement("span");
  el.className = "absolute rounded-[3px] bg-leaf/30";
  el.style.left = `${x}px`;
  el.style.width = `${width}px`;
  if (y === undefined) {
    el.style.top = "50%";
    el.style.height = "1.3em";
    el.style.marginTop = "-0.65em";
  } else {
    el.style.top = `${y}px`;
    el.style.height = `${height}px`;
  }
  return el;
}
