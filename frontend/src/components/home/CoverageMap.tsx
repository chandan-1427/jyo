// Distances are approximate offsets from Tirupati bus stand (the backend's
// TIRUPATI_CENTER), in km east and km north.
const PLACES = [
  { name: "Alipiri",      east: -1.6,  north: 2.3 },
  { name: "SV University", east: -2.5, north: 0.1 },
  { name: "Tiruchanur",   east: 3.4,   north: -2.5 },
  { name: "Karakambadi",  east: 4.9,   north: 3.4 },
  { name: "Renigunta",    east: 9.9,   north: 0.9 },
  { name: "Chandragiri",  east: -11.1, north: -4.8 },
];

const RINGS_KM = [5, 10, 20];
const OUTER_R = 180;

// Square-root scale: most places sit within 5 km, and a linear scale would
// pile their labels on top of each other. The rings are labelled in km, so
// the distortion is stated rather than hidden.
const radius = (km: number) => OUTER_R * Math.sqrt(km / 20);

function position(east: number, north: number) {
  const km = Math.hypot(east, north);
  const r = radius(km);
  return { x: (east / km) * r, y: (-north / km) * r };
}

export function CoverageMap() {
  return (
    <svg
      viewBox="-220 -200 440 400"
      className="h-auto w-full max-w-[440px]"
      aria-hidden="true"
    >
      <circle r={OUTER_R} className="fill-canvas" />
      {RINGS_KM.slice(0, -1).map((km) => (
        <circle
          key={km}
          r={radius(km)}
          className="fill-none stroke-fg/15"
          strokeDasharray="3 5"
          strokeWidth={1}
        />
      ))}
      {RINGS_KM.map((km) => (
        <text
          key={km}
          y={-radius(km) + 16}
          textAnchor="middle"
          className="fill-fg-subtle text-[12px] tabular-nums"
        >
          {km} km
        </text>
      ))}

      {PLACES.map(({ name, east, north }) => {
        const { x, y } = position(east, north);
        const west = x < 0;
        return (
          <g key={name}>
            <circle cx={x} cy={y} r={3.5} className="fill-fg-muted" />
            <text
              x={x + (west ? -9 : 9)}
              y={y + 4.5}
              textAnchor={west ? "end" : "start"}
              className="fill-fg-muted text-[14px] font-medium"
            >
              {name}
            </text>
          </g>
        );
      })}

      <circle
        r={6}
        className="origin-center fill-leaf [transform-box:fill-box] motion-safe:animate-beacon"
      />
      <circle r={6} className="fill-leaf stroke-canvas" strokeWidth={2} />
      <text y={26} textAnchor="middle" className="fill-fg text-[14px] font-semibold">
        Bus stand
      </text>
    </svg>
  );
}
