import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import { ImageOff, Minus, Plus } from "lucide-react";
import { cn, preventDoubleClickSelection } from "@/lib/utils";

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const STEP = 0.5;
// At normal zoom a photo is fitted to the frame but never enlarged past twice
// its real size, so a tiny image isn't blown up into a blur before anyone asks.
const MAX_FIT = 2;

type Point = { x: number; y: number };

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

const CONTROL =
  "grid size-9 cursor-pointer place-items-center rounded-lg text-fg transition-colors hover:bg-fg/10 " +
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-leaf disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent";

interface ImageViewerProps {
  src: string | null;
  alt: string;
  // Shown in the frame when there's no image.
  placeholder?: ReactNode;
  // The frame's shape and limits; 4:3 and at most 75% of the screen's
  // height by default. Override with e.g. "aspect-[3/4] max-h-[70vh]"; add
  // "shadow-card" where it sits on the page rather than in a dialog.
  className?: string;
}

// An image in a fixed frame, whole and uncropped whatever size or shape was
// uploaded, so the frame never grows or shrinks with the image. + and − zoom
// in steps; once zoomed in, dragging moves around the image (mouse or
// finger). Panning stops at the image's edges, so it can't be dragged out of
// view. Used for a post's photo and a requester's selfie.
export function ImageViewer({ src, alt, placeholder, className }: ImageViewerProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ pointer: Point; pan: Point } | null>(null);

  // Keeps the photo covering the frame along any side where, zoomed, it's
  // bigger than the frame, and centred along any side where it isn't.
  const clampPan = (p: Point, z: number): Point => {
    const frame = frameRef.current;
    if (!frame || !natural) return { x: 0, y: 0 };
    const fit = Math.min(frame.clientWidth / natural.w, frame.clientHeight / natural.h, MAX_FIT);
    const maxX = Math.max(0, (natural.w * fit * z - frame.clientWidth) / 2);
    const maxY = Math.max(0, (natural.h * fit * z - frame.clientHeight) / 2);
    return { x: clamp(p.x, -maxX, maxX), y: clamp(p.y, -maxY, maxY) };
  };

  const zoomTo = (z: number) => {
    const next = clamp(z, MIN_ZOOM, MAX_ZOOM);
    setZoom(next);
    setPan((p) => clampPan(p, next));
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (zoom === MIN_ZOOM) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = { pointer: { x: e.clientX, y: e.clientY }, pan };
    setDragging(true);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const start = dragStart.current;
    if (!start) return;
    setPan(clampPan({ x: start.pan.x + e.clientX - start.pointer.x, y: start.pan.y + e.clientY - start.pointer.y }, zoom));
  };

  const endDrag = () => {
    dragStart.current = null;
    setDragging(false);
  };

  const zoomed = zoom > MIN_ZOOM;

  return (
    <div
      className={cn(
        "relative aspect-[4/3] max-h-[75vh] overflow-hidden rounded-2xl bg-raised ring-1 ring-inset ring-fg/[0.06]",
        className
      )}
    >
      {src ? (
        <>
          <div
            ref={frameRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            // Zoomed in, a drag pans the photo instead of scrolling the page.
            className={cn(
              "absolute inset-0 select-none",
              zoomed && "touch-none",
              zoomed && (dragging ? "cursor-grabbing" : "cursor-grab")
            )}
          >
            <img
              src={src}
              alt={alt}
              draggable={false}
              onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                ...(natural && { maxWidth: natural.w * MAX_FIT, maxHeight: natural.h * MAX_FIT }),
              }}
              // Follows the pointer exactly while dragging; eases between zoom
              // steps. Hidden until its real size is known, so a small image
              // doesn't flash enlarged first.
              className={cn(
                // Absolute with auto margins, so the frame alone sets its size
                // (centred when the size cap makes it smaller). In a grid or
                // in flow, a tall photo's real height stretched its row and
                // only its middle showed.
                "absolute inset-0 m-auto size-full object-contain",
                natural ? "opacity-100" : "opacity-0",
                !dragging && "transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none"
              )}
            />
          </div>

          <div onMouseDown={preventDoubleClickSelection} className="absolute right-3 bottom-3 flex items-center gap-0.5 rounded-xl bg-canvas/80 p-1 ring-1 ring-inset ring-fg/[0.08] backdrop-blur-sm">
            <button
              type="button"
              onClick={() => zoomTo(zoom - STEP)}
              disabled={!zoomed}
              aria-label="Zoom out"
              className={CONTROL}
            >
              <Minus className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => zoomTo(zoom + STEP)}
              disabled={zoom >= MAX_ZOOM}
              aria-label="Zoom in"
              className={CONTROL}
            >
              <Plus className="size-4" aria-hidden="true" />
            </button>
          </div>
        </>
      ) : (
        <div className="grid size-full place-items-center text-fg-subtle [&>svg]:size-10" aria-hidden="true">
          {placeholder ?? <ImageOff />}
        </div>
      )}
    </div>
  );
}
