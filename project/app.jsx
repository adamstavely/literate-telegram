/* Root app: routing, header, invoke drawer, install modal, tweaks. */

/* -------- Invoke drawer (Use) -------- */
function InvokeDrawer({ ctx, onClose }) {
  const { server, tool } = ctx;
  const [args, setArgs] = useState(() => Object.fromEntries(tool.params.map((p) => [p.name, ""])));
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);

  const run = () => {
    setRunning(true); setResult(null);
    setTimeout(() => {
      setRunning(false);
      setResult(mockResult(server, tool, args));
    }, 1100);
  };

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="drawer">
        <div className="drawer-head">
          <div className="ec-logo" style={{ width: 34, height: 34 }}><Icon name="tool" size={16} style={{ color: "var(--ok)" }} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="mono" style={{ fontWeight: 600, fontSize: 14 }}>{tool.name}</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>{server.name} · {server.transports[0]}</div>
          </div>
          <button className="iconbtn" onClick={onClose}><Icon name="close" size={18} /></button>
        </div>
        <div className="drawer-body">
          <div className="callout" style={{ marginBottom: 18 }}>
            <Icon name="play" size={15} />
            <div>Sandbox invocation. This runs against a mock so you can feel the tool's shape before connecting it for real.</div>
          </div>
          <div className="section-title">Arguments</div>
          {tool.params.length === 0 ? (
            <div className="field-hint">This tool takes no arguments.</div>
          ) : tool.params.map((p) => (
            <div className="field" key={p.name}>
              <label className="field-label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="mono">{p.name}</span>
                <span className="param-type">{p.type}</span>
                {p.required && <span className="param-req">required</span>}
              </label>
              <input className="input mono" placeholder={p.desc} value={args[p.name]} onChange={(e) => setArgs({ ...args, [p.name]: e.target.value })} />
            </div>
          ))}
          {result && (
            <div className="fade-up" style={{ marginTop: 8 }}>
              <div className="section-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>Result <Badge tone="ok" style={{ marginLeft: 0 }}>200 OK · 0.4s</Badge></div>
              <div className="result-pane">{result}</div>
            </div>
          )}
        </div>
        <div className="drawer-foot">
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <div style={{ flex: 1 }} />
          <Button variant="accent" icon={running ? null : "play"} onClick={run} disabled={running}>{running ? "Running…" : "Run tool"}</Button>
        </div>
      </div>
    </>
  );
}

function mockResult(server, tool, args) {
  const ex = {
    create_issue: `{\n  "number": 482,\n  "url": "https://github.com/${args.repo || "acme/app"}/issues/482",\n  "state": "open"\n}`,
    search_code: `[\n  { "path": "src/auth/session.ts", "line": 44, "match": "${args.query || "createSession"}" },\n  { "path": "src/api/login.ts", "line": 12, "match": "${args.query || "createSession"}" }\n]`,
    run_query: `[\n  { "id": 1, "email": "ada@acme.com", "plan": "pro" },\n  { "id": 2, "email": "linus@acme.com", "plan": "team" }\n]`,
    web_search: `[\n  { "title": "Model Context Protocol", "url": "https://modelcontextprotocol.io" },\n  { "title": "Spec — Tools", "url": "https://spec.mcp.dev/tools" }\n]`,
    send_message: `{\n  "ok": true,\n  "channel": "${args.channel || "#general"}",\n  "ts": "1717286400.001"\n}`,
    read_file: `"export function createSession(user) {\\n  return signJWT(user, SECRET);\\n}"`,
  };
  return ex[tool.name] || `{\n  "ok": true,\n  "tool": "${tool.name}",\n  "args": ${JSON.stringify(args)}\n}`;
}

/* -------- Install modal -------- */
function InstallModal({ entry, onClose }) {
  const isSkill = entry.type === "skill";
  const [client, setClient] = useState(entry.clients ? entry.clients[0] : "claude-desktop");
  const [added, setAdded] = useState(false);
  const snippet = isSkill
    ? `registry add ${entry.slug}\n# loads SKILL.md into your agent's skill index`
    : `{\n  "mcpServers": {\n    "${entry.id}": {\n      "transport": "${entry.transports[0]}",\n      "url": "https://registry.dev/${entry.slug}"\n    }\n  }\n}`;
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="drawer" style={{ width: 460 }}>
        <div className="drawer-head">
          <div className="ec-logo" style={{ width: 34, height: 34 }}><Icon name={TYPE_META[entry.type].icon} size={16} /></div>
          <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 15 }}>{added ? "Added" : "Install"} {entry.name}</div><div style={{ fontSize: 12, color: "var(--muted)" }} className="mono">{entry.slug}</div></div>
          <button className="iconbtn" onClick={onClose}><Icon name="close" size={18} /></button>
        </div>
        <div className="drawer-body">
          {!isSkill && (
            <div style={{ marginBottom: 20 }}>
              <div className="section-title">Target client</div>
              <div className="clients">
                {CLIENTS.filter((c) => entry.clients.includes(c.id)).map((c) => (
                  <button key={c.id} className={`client-chip ${client === c.id ? "" : "off"}`} style={client === c.id ? { borderColor: "var(--accent)", color: "var(--accent-ink)", background: "var(--accent-wash)" } : {}} onClick={() => setClient(c.id)}>
                    <span className="cdot" style={client === c.id ? { background: "var(--accent)" } : {}} />{c.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="section-title">{isSkill ? "Add to your skill index" : "Add to config"}</div>
          <CodeBlock>{snippet}</CodeBlock>
          <div className="callout accent" style={{ marginTop: 16 }}>
            <Icon name="shield" size={15} />
            <div>{isSkill ? <>This skill is read by your agent on a matching task. It requests no credentials.</> : <>Authenticates with <b>{entry.auth}</b>. You'll be prompted to authorize on first use.</>}</div>
          </div>
        </div>
        <div className="drawer-foot">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <div style={{ flex: 1 }} />
          <Button variant="accent" icon={added ? "check" : "install"} onClick={() => setAdded(true)}>{added ? "Installed" : (isSkill ? "Add skill" : "Install")}</Button>
        </div>
      </div>
    </>
  );
}

/* -------- Notifications center -------- */
function NotificationsMenu({ onClose, onNav }) {
  const [items, setItems] = useState(window.REGISTRY.NOTIFICATIONS);
  const [tab, setTab] = useState("all");
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const esc = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", esc); };
  }, []);

  const shown = tab === "unread" ? items.filter((n) => n.unread) : items;
  const unreadCount = items.filter((n) => n.unread).length;
  const markAll = () => setItems(items.map((n) => ({ ...n, unread: false })));
  const readOne = (id) => setItems(items.map((n) => (n.id === id ? { ...n, unread: false } : n)));

  return (
    <div className="notif-pop" ref={ref}>
      <div className="notif-head">
        <span className="notif-head-t">Notifications</span>
        {unreadCount > 0 && <span className="notif-head-n">{unreadCount}</span>}
        <div style={{ flex: 1 }} />
        {unreadCount > 0 && <button className="notif-markall" onClick={markAll}>Mark all read</button>}
      </div>
      <div className="notif-tabs">
        <div className={`notif-tab ${tab === "all" ? "on" : ""}`} onClick={() => setTab("all")}>All</div>
        <div className={`notif-tab ${tab === "unread" ? "on" : ""}`} onClick={() => setTab("unread")}>Unread{unreadCount > 0 ? ` · ${unreadCount}` : ""}</div>
      </div>
      <div className="notif-list">
        {shown.length === 0 ? (
          <div className="notif-empty">
            <div className="notif-empty-ic"><Icon name="check" size={20} /></div>
            <div style={{ fontSize: 14, fontWeight: 540, color: "var(--ink)" }}>You're all caught up</div>
            <div style={{ fontSize: 12.5, marginTop: 3 }}>No unread notifications.</div>
          </div>
        ) : shown.map((n) => (
          <div key={n.id} className={`notif-item ${n.unread ? "unread" : ""}`} onClick={() => readOne(n.id)}>
            <div className={`notif-ic ${n.kind}`}><Icon name={n.icon} size={17} /></div>
            <div className="notif-body">
              <div className="notif-t">{renderBold(n.title)}</div>
              <div className="notif-d">{n.desc}</div>
              <span className="notif-time">{n.time} ago · {n.cat}</span>
            </div>
            {n.unread && <span className="notif-unread-dot" />}
          </div>
        ))}
      </div>
      <div className="notif-foot">
        <button onClick={() => { onClose(); onNav({ view: "admin" }); }}>Open admin queue</button>
      </div>
    </div>
  );
}

function renderBold(str) {
  const parts = str.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => p.startsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : p);
}

/* -------- Header -------- */
function Header({ route, onNav, search, setSearch, theme, onToggleTheme }) {
  const [notifOpen, setNotifOpen] = useState(false);
  const unread = window.REGISTRY.NOTIFICATIONS.filter((n) => n.unread).length;
  const NAV = [
    { id: "browse", label: "Browse" },
    { id: "docs", label: "Docs" },
    { id: "admin", label: "Admin" },
  ];
  return (
    <header className="hdr">
      <div className={`container hdr-row ${route.view === "browse" ? "hdr-wide" : ""}`}>
        <div className="brand" onClick={() => onNav({ view: "browse" })}>
          <div className="brand-mark">
            <svg viewBox="0 0 128 128" fill="none" aria-hidden="true">
              <rect x="0" y="0" width="128" height="128" rx="28" fill="#3b5bff" />
              <g transform="rotate(22.5 64 64)">
                <rect x="33.5" y="46" width="36" height="36" rx="11" fill="none" stroke="#ffffff" strokeWidth="6.5" />
                <rect x="58.5" y="46" width="36" height="36" rx="11" fill="none" stroke="#c9d3ff" strokeWidth="6.5" />
                <path d="M58.5 46 Q69.5 46 69.5 57 L69.5 65" fill="none" stroke="#ffffff" strokeWidth="6.5" strokeLinecap="round" />
              </g>
            </svg>
          </div>
          <div className="brand-name">Interop</div>
        </div>
        <nav className="nav">
          {NAV.map((n) => (
            <div key={n.id} className={`nav-item ${route.view === n.id ? "on" : ""}`} onClick={() => onNav({ view: n.id })}>{n.label}</div>
          ))}
        </nav>
        <div className="hdr-spacer" />
        {route.view === "browse" && (
          <div className="hdr-search">
            <Icon name="search" size={16} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" />
            <span className="kbd">⌘K</span>
          </div>
        )}
        <Button variant="primary" size="sm" icon="plus" onClick={() => onNav({ view: "register" })}>Publish</Button>
        <button className="iconbtn" title={theme === "dark" ? "Switch to light" : "Switch to dark"} onClick={onToggleTheme}>
          <Icon name={theme === "dark" ? "sun" : "moon"} size={18} />
        </button>
        <div style={{ position: "relative" }}>
          <button className="iconbtn" style={{ position: "relative" }} title="Notifications" onClick={() => setNotifOpen((o) => !o)}>
            <Icon name="bell" size={18} />
            {unread > 0 && <span style={{ position: "absolute", top: 6, right: 6, width: 7, height: 7, borderRadius: "50%", background: "var(--accent)", boxShadow: "0 0 0 2px var(--bg)" }} />}
          </button>
          {notifOpen && <NotificationsMenu onClose={() => setNotifOpen(false)} onNav={onNav} />}
        </div>
        <Avatar name="You" size={30} round />
      </div>
    </header>
  );
}

/* -------- App root -------- */
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#3b5bff"
}/*EDITMODE-END*/;

const ACCENTS = [
  { v: "#3b5bff", ink: "#2742d6", name: "Cobalt" },
  { v: "#6d4ade", ink: "#5733c4", name: "Iris" },
  { v: "#1f9d62", ink: "#16804f", name: "Emerald" },
  { v: "#d4602a", ink: "#b54c1d", name: "Ember" },
  { v: "#16181d", ink: "#000000", name: "Mono" },
];

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("interop-theme") || "light"; } catch (e) { return "light"; }
  });
  const [route, setRoute] = useState({ view: "browse" });
  const [browseState, setBrowseState] = useState({
    query: "", typeFilter: "all", cats: [], clients: [], sort: "installs", viewMode: "grid",
  });
  const [invoke, setInvoke] = useState(null);
  const [install, setInstall] = useState(null);

  // apply theme
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("interop-theme", theme); } catch (e) {}
  }, [theme]);

  // apply accent — accent-ink lightens in dark mode for legible text/icons
  useEffect(() => {
    const a = ACCENTS.find((x) => x.v === t.accent) || ACCENTS[0];
    const root = document.documentElement.style;
    root.setProperty("--accent", a.v);
    root.setProperty("--accent-ink", theme === "dark" ? `color-mix(in oklch, ${a.v} 62%, white)` : a.ink);
  }, [t.accent, theme]);

  const nav = (r) => {
    if (r.type) setBrowseState((s) => ({ ...s, typeFilter: r.type }));
    setRoute(r);
    window.scrollTo(0, 0);
  };

  const openEntry = (entry) => {
    if (entry.type === "skill") nav({ view: "skill", id: entry.id });
    else if (entry.type === "agent") nav({ view: "agent", id: entry.id });
    else if (entry.type === "api") nav({ view: "api", id: entry.id });
    else if (entry.type === "tool" && entry.parent) nav({ view: "server", id: entry.parent.id, tool: entry.id });
    else nav({ view: "server", id: entry.id });
  };

  // ⌘K focus
  useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        nav({ view: "browse" });
        setTimeout(() => document.querySelector(".bigsearch input, .hdr-search input")?.focus(), 50);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  let page;
  if (route.view === "browse") {
    page = <BrowsePage state={browseState} setState={setBrowseState} onOpen={openEntry} />;
  } else if (route.view === "server") {
    const server = SERVERS.find((s) => s.id === route.id);
    page = <ServerDetail server={server} onNav={nav} onInstall={(e) => setInstall(e)} onInvoke={(c) => setInvoke(c)} />;
  } else if (route.view === "skill") {
    const skill = SKILLS.find((s) => s.id === route.id);
    page = <SkillDetail skill={skill} onNav={nav} onInstall={(e) => setInstall(e)} />;
  } else if (route.view === "agent") {
    const agent = window.REGISTRY.AGENTS.find((a) => a.id === route.id);
    page = <AgentDetail agent={agent} onNav={nav} onInstall={(e) => setInstall(e)} />;
  } else if (route.view === "api") {
    const api = window.REGISTRY.APIS.find((a) => a.id === route.id);
    page = <ApiDetail api={api} onNav={nav} />;
  } else if (route.view === "register") {
    page = <RegisterPage onNav={nav} />;
  } else if (route.view === "admin") {
    page = <AdminPage onNav={nav} />;
  } else if (route.view === "policy") {
    page = <PolicyPage onNav={nav} />;
  } else if (route.view === "docs") {
    page = <DocsPage route={route} onNav={nav} />;
  }

  return (
    <div className="app">
      <Header
        route={route}
        onNav={nav}
        theme={theme}
        onToggleTheme={() => setTheme((m) => (m === "dark" ? "light" : "dark"))}
        search={browseState.query}
        setSearch={(q) => setBrowseState((s) => ({ ...s, query: q }))}
      />
      <div className="app-main">
        {page}
      </div>
      {invoke && <InvokeDrawer ctx={invoke} onClose={() => setInvoke(null)} />}
      {install && <InstallModal entry={install} onClose={() => setInstall(null)} />}

      <TweaksPanel>
        <TweakSection label="Appearance" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: "4px 2px 8px" }}>
          {[{ k: "light", label: "Light", icon: "sun" }, { k: "dark", label: "Dark", icon: "moon" }].map((m) => (
            <button key={m.k} onClick={() => setTheme(m.k)}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, height: 38, borderRadius: 9, cursor: "pointer", fontSize: 13, fontWeight: 540, fontFamily: "inherit", color: theme === m.k ? "var(--ink)" : "var(--muted)", border: theme === m.k ? "2px solid var(--accent)" : "1px solid var(--line)", background: theme === m.k ? "var(--accent-wash)" : "var(--bg)" }}>
              <Icon name={m.icon} size={15} />{m.label}
            </button>
          ))}
        </div>
        <TweakSection label="Accent" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8, padding: "4px 2px" }}>
          {ACCENTS.map((a) => (
            <button key={a.v} title={a.name} onClick={() => setTweak("accent", a.v)}
              style={{ height: 34, borderRadius: 9, border: t.accent === a.v ? "2px solid var(--ink)" : "1px solid var(--line)", background: a.v, cursor: "pointer", boxShadow: t.accent === a.v ? "0 0 0 3px color-mix(in oklch, " + a.v + " 22%, white)" : "none" }} />
          ))}
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", padding: "2px 2px 6px" }}>{(ACCENTS.find((a) => a.v === t.accent) || ACCENTS[0]).name}</div>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
