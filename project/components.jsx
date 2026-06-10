/* Shared primitives + icon set. Exports to window. */
const { useState, useEffect, useRef, useMemo } = React;

/* ---------------- Icons (1.5px stroke, currentColor) ---------------- */
const Icon = ({ name, size = 16, stroke = 1.6, style }) => {
  const p = {
    width: size, height: size, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth: stroke, strokeLinecap: "round",
    strokeLinejoin: "round", style, "aria-hidden": true,
  };
  const paths = {
    search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-3.6-3.6" /></>,
    server: <><rect x="3" y="4" width="18" height="7" rx="1.5" /><rect x="3" y="13" width="18" height="7" rx="1.5" /><path d="M7 7.5h.01M7 16.5h.01" /></>,
    tool: <><path d="M4 7h7M4 12h12M4 17h7" /><path d="M16 6l3 3-3 3" /></>,
    skill: <><path d="M5 4h11l3 3v13H5z" /><path d="M9 9h6M9 13h6M9 17h3" /></>,
    check: <path d="M5 12l4.5 4.5L19 7" />,
    verified: <><path d="M12 3l2.2 1.6 2.7-.2 1 2.5 2.3 1.4-.6 2.7.6 2.7-2.3 1.4-1 2.5-2.7-.2L12 21l-2.2-1.6-2.7.2-1-2.5L3.8 16l.6-2.7L3.8 10.6l2.3-1.4 1-2.5 2.7.2z" /><path d="M9 12l2 2 4-4" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
    arrowLeft: <path d="M19 12H5M11 18l-6-6 6-6" />,
    chevronDown: <path d="M6 9l6 6 6-6" />,
    chevronRight: <path d="M9 6l6 6-6 6" />,
    copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></>,
    external: <><path d="M14 5h5v5" /><path d="M19 5l-8 8" /><path d="M19 13v6H5V5h6" /></>,
    shield: <><path d="M12 3l8 3v6c0 4.5-3 7.5-8 9-5-1.5-8-4.5-8-9V6z" /><path d="M9 12l2 2 4-4" /></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    list: <><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></>,
    install: <><path d="M12 3v11M8 11l4 4 4-4" /><path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" /></>,
    dot: <circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none" />,
    star: <path d="M12 4l2.3 4.9 5.2.7-3.8 3.6 1 5.2-4.7-2.6-4.7 2.6 1-5.2-3.8-3.6 5.2-.7z" />,
    bolt: <path d="M13 3L5 13h6l-1 8 8-10h-6z" />,
    book: <><path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2z" /><path d="M18 18H7a2 2 0 0 0-2 2" /></>,
    clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
    close: <path d="M6 6l12 12M18 6L6 18" />,
    filter: <path d="M3 5h18l-7 8v5l-4 2v-7z" />,
    play: <path d="M7 5l11 7-11 7z" />,
    link: <><path d="M9 14a4 4 0 0 0 6 .5l2.5-2.5a4 4 0 1 0-5.7-5.7L10.5 8" /><path d="M15 10a4 4 0 0 0-6-.5L6.5 12a4 4 0 1 0 5.7 5.7L13.5 16" /></>,
    flag: <><path d="M5 21V4h12l-2.5 4L17 12H5" /></>,
    warning: <><path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17h.01" /></>,
    user: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5" /></>,
    code: <><path d="M9 8l-4 4 4 4M15 8l4 4-4 4" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>,
    box: <><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" /><path d="M4 7.5l8 4.5 8-4.5M12 12v9" /></>,
    info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8h.01" /></>,
    refresh: <><path d="M20 11a8 8 0 0 0-14-4.5L4 8" /><path d="M4 4v4h4" /><path d="M4 13a8 8 0 0 0 14 4.5L20 16" /><path d="M20 20v-4h-4" /></>,
    inbox: <><path d="M3 13h5l1.5 2.5h5L16 13h5" /><path d="M5 5h14l2 8v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5z" /></>,
    lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
    globe: <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.5 2.5 2.5 14.5 0 17M12 3.5c-2.5 2.5-2.5 14.5 0 17" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
    moon: <><path d="M20 14.5A8 8 0 1 1 9.5 4a6.2 6.2 0 0 0 10.5 10.5z" /></>,
    agent: <><path d="M12 3.2c.55 5.7 2.6 7.75 8.3 8.3-5.7.55-7.75 2.6-8.3 8.3-.55-5.7-2.6-7.75-8.3-8.3 5.7-.55 7.75-2.6 8.3-8.3Z" /><path d="M18.6 4.2c.2 1.9.85 2.55 2.75 2.75-1.9.2-2.55.85-2.75 2.75-.2-1.9-.85-2.55-2.75-2.75 1.9-.2 2.55-.85 2.75-2.75Z" /></>,
    api: <><path d="M7 8l-4 4 4 4" /><path d="M17 8l4 4-4 4" /><path d="M14 5l-4 14" /></>,
  };
  return <svg {...p}>{paths[name] || null}</svg>;
};

const TYPE_META = {
  server: { icon: "server", label: "Server" },
  api: { icon: "api", label: "API" },
  tool: { icon: "tool", label: "Tool" },
  skill: { icon: "skill", label: "Skill" },
  agent: { icon: "agent", label: "Agent" },
};

/* ---------------- Badges & chips ---------------- */
const Badge = ({ children, tone = "default", style }) => (
  <span className={`badge badge-${tone}`} style={style}>{children}</span>
);

const TypeBadge = ({ type, size = 14 }) => {
  const m = TYPE_META[type] || TYPE_META.server;
  return (
    <span className={`type-badge type-${type}`}>
      <Icon name={m.icon} size={size} stroke={1.7} />
      {m.label}
    </span>
  );
};

/* Data-sensitivity classification — the tier an entry is approved to handle. */
const SENSITIVITY = {
  public:       { label: "Public",       rank: 0, icon: "globe",  tip: "Approved for public, non-sensitive data only." },
  internal:     { label: "Internal",     rank: 1, icon: "shield", tip: "Approved for internal business data." },
  confidential: { label: "Confidential", rank: 2, icon: "lock",   tip: "Approved for confidential data — restricted access." },
  restricted:   { label: "Restricted",   rank: 3, icon: "lock",   tip: "Approved for restricted data: PII, secrets, financial." },
};

const SensitivityBadge = ({ level = "internal", compact = false }) => {
  const m = SENSITIVITY[level] || SENSITIVITY.internal;
  return (
    <span className={`sens-badge sens-${level}`} title={m.tip}>
      <Icon name={m.icon} size={12.5} stroke={1.9} />
      {!compact && m.label}
    </span>
  );
};

/* Generative network-graph backdrop — nodes + edges, the "capability graph" motif.
   Deterministic (seeded) so it's stable across renders. */
function NetworkField() {
  const W = 1600, H = 660;
  const { nodes, edges } = useMemo(() => {
    let s = 0x1a2b3c4d;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return (s >>> 8) / 0xffffff; };
    const cols = 11, rows = 5, nodes = [];
    const cellW = W / (cols - 1), cellH = H / (rows - 1);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (rnd() < 0.13) continue; // drop a few for irregularity
        const jx = (rnd() - 0.5) * cellW * 0.82;
        const jy = (rnd() - 0.5) * cellH * 0.82;
        nodes.push({
          x: +(c * cellW + jx).toFixed(1),
          y: +(r * cellH + jy).toFixed(1),
          r: +(1.7 + rnd() * 2.4).toFixed(2),
          accent: rnd() < 0.13,
        });
      }
    }
    // connect near neighbours, capped degree
    const edges = [], deg = new Array(nodes.length).fill(0);
    const maxD = cellW * 1.12;
    for (let i = 0; i < nodes.length; i++) {
      const cand = [];
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y;
        const d = Math.hypot(dx, dy);
        if (d < maxD) cand.push({ j, d });
      }
      cand.sort((a, b) => a.d - b.d);
      for (const { j } of cand.slice(0, 3)) {
        if (i < j && deg[i] < 4 && deg[j] < 4) {
          edges.push([i, j]); deg[i]++; deg[j]++;
        }
      }
    }
    return { nodes, edges };
  }, []);

  return (
    <div className="net-field" aria-hidden="true">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMin slice" fill="none">
        <g stroke="var(--net-line)" strokeWidth="1">
          {edges.map(([a, b], i) => (
            <line key={i} x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y} />
          ))}
        </g>
        {nodes.map((n, i) => (
          n.accent ? (
            <g key={i}>
              <circle cx={n.x} cy={n.y} r={n.r + 5} fill="var(--accent)" opacity="0.10" />
              <circle cx={n.x} cy={n.y} r={n.r + 0.6} fill="var(--accent)" opacity="0.55" />
            </g>
          ) : (
            <circle key={i} cx={n.x} cy={n.y} r={n.r} fill="var(--net-node)" />
          )
        ))}
      </svg>
    </div>
  );
}

const VerifiedMark = ({ size = 15, title = "Verified publisher" }) => {
  // Perfectly symmetric 12-bump seal, computed so it never renders lopsided.
  const cx = 12, cy = 12, bumps = 11, rOut = 11, rIn = 9;
  let d = "";
  const steps = bumps * 2;
  for (let i = 0; i < steps; i++) {
    const a = (Math.PI * 2 * i) / steps - Math.PI / 2;
    const r = i % 2 === 0 ? rOut : rIn;
    const x = (cx + r * Math.cos(a)).toFixed(2);
    const y = (cy + r * Math.sin(a)).toFixed(2);
    d += (i === 0 ? "M" : "L") + x + " " + y + " ";
  }
  d += "Z";
  return (
    <span className="verified-mark" title={title}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flex: "none", display: "block" }}>
        <path fill="currentColor" d={d} />
        <path d="M8.3 12.2l2.5 2.4 4.8-4.9" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    </span>
  );
};

/* Deterministic install-trend sparkline. Seeded from a string so it's stable. */
const Sparkline = ({ seed = "", width = 52, height = 16, up = true }) => {
  const pts = useMemo(() => {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    const rnd = () => { h = (h * 1664525 + 1013904223) >>> 0; return (h >>> 8) / 0xffffff; };
    const N = 12;
    const vals = [];
    let v = 0.35 + rnd() * 0.25;
    for (let i = 0; i < N; i++) {
      const drift = (up ? 0.055 : -0.02) + (rnd() - 0.5) * 0.16;
      v = Math.max(0.05, Math.min(0.97, v + drift));
      vals.push(v);
    }
    return vals;
  }, [seed, up]);

  const N = pts.length;
  const stepX = width / (N - 1);
  const coords = pts.map((v, i) => [i * stepX, height - v * height]);
  const line = coords.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${width} ${height} L0 ${height} Z`;
  const last = coords[coords.length - 1];
  const gid = "sg-" + Math.abs(seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0));

  return (
    <svg className="spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.18" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="1.7" fill="currentColor" />
    </svg>
  );
};

const Transport = ({ t }) => <span className="transport mono">{t}</span>;

/* ---------------- Buttons ---------------- */
const Button = ({ children, variant = "secondary", size = "md", icon, iconRight, onClick, type, full, disabled, style }) => (
  <button
    type={type || "button"}
    onClick={onClick}
    disabled={disabled}
    className={`btn btn-${variant} btn-${size}${full ? " btn-full" : ""}`}
    style={style}
  >
    {icon && <Icon name={icon} size={size === "sm" ? 14 : 16} />}
    {children && <span>{children}</span>}
    {iconRight && <Icon name={iconRight} size={size === "sm" ? 14 : 16} />}
  </button>
);

/* ---------------- Misc ---------------- */
const fmt = (n) => {
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, "") + "k";
  return String(n);
};
const timeAgo = (iso) => {
  const d = (Date.now() - new Date(iso + "T00:00:00").getTime()) / 86400000;
  if (d < 1) return "today";
  if (d < 2) return "yesterday";
  if (d < 30) return `${Math.round(d)}d ago`;
  return `${Math.round(d / 30)}mo ago`;
};

const Avatar = ({ name, size = 24, round }) => {
  const initials = name.split(/[\s/]/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.42, borderRadius: round ? "50%" : 6 }}>{initials}</span>
  );
};

const Stat = ({ icon, value, label }) => (
  <span className="stat">
    {icon && <Icon name={icon} size={14} />}
    <span className="stat-val mono">{value}</span>
    {label && <span className="stat-label">{label}</span>}
  </span>
);

const Tooltip = ({ label, children }) => (
  <span className="tt-wrap">{children}<span className="tt">{label}</span></span>
);

const CopyField = ({ value, label }) => {
  const [copied, setCopied] = useState(false);
  return (
    <div className="copy-field">
      {label && <span className="copy-field-label mono">{label}</span>}
      <code className="copy-field-val mono">{value}</code>
      <button className="copy-btn" onClick={() => { navigator.clipboard?.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1200); }}>
        <Icon name={copied ? "check" : "copy"} size={14} />
      </button>
    </div>
  );
};

const Segmented = ({ options, value, onChange }) => (
  <div className="segmented">
    {options.map((o) => (
      <button key={o.value} className={`seg ${value === o.value ? "seg-on" : ""}`} onClick={() => onChange(o.value)}>
        {o.icon && <Icon name={o.icon} size={15} />}
        {o.label && <span>{o.label}</span>}
      </button>
    ))}
  </div>
);

Object.assign(window, {
  Icon, Badge, TypeBadge, SensitivityBadge, SENSITIVITY, VerifiedMark, Sparkline, NetworkField, Transport, Button, Avatar, Stat, Tooltip,
  CopyField, Segmented, TYPE_META, fmt, timeAgo,
});
