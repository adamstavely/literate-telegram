/* Catalog: entry cards, browse page with filters + collections. */
const { SERVERS, SKILLS, AGENTS, APIS, CATEGORIES, CLIENTS } = window.REGISTRY;

// flat list of every browsable entry (tools are surfaced on demand via the type filter)
function allEntries() {
  return [...SERVERS, ...APIS, ...SKILLS, ...AGENTS];
}

function EntryCard({ entry, onOpen, view }) {
  const isSkill = entry.type === "skill";
  const isAgent = entry.type === "agent";
  const isApi = entry.type === "api";
  const tools = entry.tools || [];
  if (view === "list") {
    return (
      <div className="row fade-up" onClick={() => onOpen(entry)}>
        <div className="ec-logo"><Icon name={TYPE_META[entry.type].icon} size={17} /></div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="ec-title">
            {entry.name}
            {entry.verified && <VerifiedMark />}
            {entry.version && <span className="ec-ver mono">v{entry.version}</span>}
          </div>
          <div className="ec-summary" style={{ marginTop: 2 }}>{entry.summary}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 18, flex: "none" }}>
          <SensitivityBadge level={entry.sensitivity || "internal"} />
          <Stat icon="install" value={fmt(entry.installs)} />
          <Icon name="chevronRight" size={16} style={{ color: "var(--faint)" }} />
        </div>
      </div>);

  }
  return (
    <div className="card card-link ec fade-up" onClick={() => onOpen(entry)}>
      <div className="ec-top">
        <div className="ec-logo"><Icon name={TYPE_META[entry.type].icon} size={19} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="ec-title">
            {entry.name}
            {entry.verified && <VerifiedMark />}
          </div>
          <div className="ec-slug-row">
            <span className="ec-slug mono">{entry.slug}</span>
            {entry.version && <span className="ec-ver mono">v{entry.version}</span>}
          </div>
        </div>
        <SensitivityBadge level={entry.sensitivity || "internal"} />
      </div>
      <div className="ec-summary">{entry.summary}</div>
      {isAgent ?
      <div className="tool-pills">
          {(entry.servers || []).slice(0, 3).map((sid) => {
          const sv = SERVERS.find((s) => s.id === sid);
          return <span key={sid} className="tool-pill"><Icon name="server" size={11} style={{ marginRight: 4, verticalAlign: "-1px", color: "var(--faint)" }} />{sv ? sv.name : sid}</span>;
        })}
          {(entry.skills || []).length > 0 && <span className="tool-pill more">+{entry.skills.length} skill{entry.skills.length > 1 ? "s" : ""}</span>}
        </div> :
      isApi ?
      <div className="tool-pills">
          {entry.endpoints.slice(0, 3).map((ep, i) =>
        <span key={i} className="tool-pill"><span className={`ep-verb ev-${ep.method.toLowerCase()}`}>{ep.method}</span>{ep.path}</span>
        )}
          {entry.endpoints.length > 3 && <span className="tool-pill more">+{entry.endpoints.length - 3}</span>}
        </div> :
      isSkill ?
      <div className="tool-pills">
          {entry.triggers.slice(0, 2).map((t) =>
        <span key={t} className="tool-pill" style={{ fontStyle: "italic" }}>"{t}"</span>
        )}
          {entry.triggers.length > 2 && <span className="tool-pill more">+{entry.triggers.length - 2}</span>}
        </div> :

      <div className="tool-pills">
          {tools.slice(0, 3).map((t) => <span key={t.id} className="tool-pill">{t.name}</span>)}
          {tools.length > 3 && <span className="tool-pill more">+{tools.length - 3} tools</span>}
        </div>
      }
      <div className="ec-foot">
        <div className="installs-trend">
          <Stat icon="install" value={fmt(entry.installs)} label="installs" />
          <Sparkline seed={entry.slug || entry.name} up={(entry.rating || 4.5) >= 4.4} />
        </div>
        <div className="spacer" />
        {isAgent ?
        <span className="model-chip"><Icon name="agent" size={12} />{(entry.model || "").replace("Claude ", "")}</span> :
        isApi ?
        <span className={`api-style-chip style-${entry.style.toLowerCase()}`}>{entry.style}</span> :
        isSkill ?
        <Stat icon="book" value={entry.tokens} /> :

        <div style={{ display: "flex", gap: 5 }}>
            {entry.transports.map((t) => <Transport key={t} t={t} />)}
          </div>
        }
      </div>
    </div>);

}

const COLLECTIONS = [
{ id: "dev", title: "Developer essentials", desc: "The toolbox every coding agent reaches for.", n: 12, icon: "code" },
{ id: "official", title: "Official & verified", desc: "First-party servers from the source.", n: 24, icon: "verified" },
{ id: "skills", title: "Top skills this week", desc: "Procedural knowledge worth loading.", n: 18, icon: "skill" }];


function BrowsePage({ state, setState, onOpen }) {
  const { query, typeFilter, cats, clients, sort } = state;

  const counts = useMemo(() => {
    const all = allEntries();
    const byType = { server: 0, api: 0, tool: 0, skill: 0, agent: 0 };
    all.forEach((e) => {byType[e.type]++;});
    // tools counted across servers
    byType.tool = SERVERS.reduce((s, sv) => s + sv.tools.length, 0);
    const byCat = {};
    CATEGORIES.forEach((c) => byCat[c] = all.filter((e) => e.category === c).length);
    return { byType, byCat };
  }, []);

  const filtered = useMemo(() => {
    let list = allEntries();
    if (typeFilter !== "all") {
      if (typeFilter === "tool") {
        // surface tools as entries
        list = SERVERS.flatMap((sv) => sv.tools.map((t) => ({
          ...t, type: "tool", parent: sv, slug: `${sv.slug.split("/")[0]}/${t.name}`,
          summary: t.summary, installs: t.calls, category: sv.category, verified: sv.verified,
          transports: sv.transports, triggers: [], tools: []
        })));
      } else {
        list = list.filter((e) => e.type === typeFilter);
      }
    }
    if (cats.length) list = list.filter((e) => cats.includes(e.category));
    if (clients.length) list = list.filter((e) => !e.clients || clients.every((c) => e.clients.includes(c)));
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((e) =>
      e.name.toLowerCase().includes(q) ||
      e.summary.toLowerCase().includes(q) ||
      (e.slug || "").toLowerCase().includes(q) ||
      (e.tools || []).some((t) => t.name.includes(q)) ||
      (e.triggers || []).some((t) => t.toLowerCase().includes(q))
      );
    }
    list = [...list].sort((a, b) => {
      if (sort === "installs") return b.installs - a.installs;
      if (sort === "recent") return (b.updated || "").localeCompare(a.updated || "");
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "rating") return (b.rating || 0) - (a.rating || 0);
      return 0;
    });
    return list;
  }, [query, typeFilter, cats, clients, sort]);

  const set = (patch) => setState({ ...state, ...patch });
  const toggleCat = (c) => set({ cats: cats.includes(c) ? cats.filter((x) => x !== c) : [...cats, c] });
  const toggleClient = (c) => set({ clients: clients.includes(c) ? clients.filter((x) => x !== c) : [...clients, c] });

  const TYPES = [
  { id: "all", label: "Everything", icon: "grid", n: counts.byType.server + counts.byType.api + counts.byType.skill + counts.byType.agent },
  { id: "agent", label: "Agents", icon: "agent", n: counts.byType.agent },
  { id: "server", label: "Servers", icon: "server", n: counts.byType.server },
  { id: "api", label: "APIs", icon: "api", n: counts.byType.api },
  { id: "tool", label: "Tools", icon: "tool", n: counts.byType.tool },
  { id: "skill", label: "Skills", icon: "skill", n: counts.byType.skill }];


  const activeChips = [
  ...cats.map((c) => ({ k: "cat", v: c, label: c })),
  ...clients.map((c) => ({ k: "client", v: c, label: CLIENTS.find((x) => x.id === c)?.name }))];


  return (
    <div className="browse-page">
      {/* hero */}
      <div className="hero">
        <div className="container hero-flex">
          <div className="hero-left">
            <div className="hero-brand">
              <div className="hero-logo" aria-hidden="true">
                <svg viewBox="0 0 140 140" fill="none">
                  <g transform="rotate(38 70 70)">
                    <rect x="26" y="44" width="52" height="52" rx="16" fill="none" stroke="var(--accent)" strokeWidth="9" />
                    <rect x="62" y="44" width="52" height="52" rx="16" fill="none" stroke="color-mix(in oklch, var(--accent) 52%, var(--cm))" strokeWidth="9" />
                    <path d="M62 44 Q78 44 78 60 L78 72" fill="none" stroke="var(--accent)" strokeWidth="9" strokeLinecap="round" />
                  </g>
                </svg>
              </div>
              <div className="hero-text">
                <h1 className="hero-title" style={{ width: "400px" }}>Interop: Making the stack work <span className="accent">together</span>.</h1>
                <p className="hero-sub" style={{ width: "450px" }}>MCP, skills, tools, agents, & APIs. Discover, govern, and integrate them from a single interface.
                </p>
              </div>
            </div>
          </div>
          <div className="hero-meta">
            <div className="hero-stat"><div className="n mono">{counts.byType.agent}</div><div className="l"><Icon name="agent" size={14} />agents</div></div>
            <div className="hero-stat"><div className="n mono">{counts.byType.server}</div><div className="l"><Icon name="server" size={14} />servers</div></div>
            <div className="hero-stat"><div className="n mono">{counts.byType.api}</div><div className="l"><Icon name="api" size={14} />APIs</div></div>
            <div className="hero-stat"><div className="n mono">{counts.byType.tool}</div><div className="l"><Icon name="tool" size={14} />tools</div></div>
            <div className="hero-stat"><div className="n mono">{counts.byType.skill}</div><div className="l"><Icon name="skill" size={14} />skills</div></div>
          </div>
        </div>
      </div>

      <div className="container">
        <div className="layout">
          {/* sidebar */}
          <aside className="side">
            <div>
              <div className="side-group-label">Type</div>
              <div className="facet">
                {TYPES.map((t) => <div key={t.id} className={`facet-item ${typeFilter === t.id ? "on" : ""}`} onClick={() => set({ typeFilter: t.id })}>
                    <span className="fi-icon"><Icon name={t.icon} size={15} /></span>
                    {t.label}
                    <span className="count">{t.n}</span>
                  </div>
                )}
              </div>
            </div>
            <div>
              <div className="side-group-label">Category</div>
              <div className="facet">
                {CATEGORIES.map((c) =>
                <div key={c} className={`facet-item ${cats.includes(c) ? "on" : ""}`} onClick={() => toggleCat(c)}>
                    <span className={`checkbox ${cats.includes(c) ? "on" : ""}`}><Icon name="check" size={11} /></span>
                    {c}
                    <span className="count">{counts.byCat[c]}</span>
                  </div>
                )}
              </div>
            </div>
            <div>
              <div className="side-group-label">Compatible with</div>
              <div className="facet">
                {CLIENTS.map((c) =>
                <div key={c.id} className={`facet-item ${clients.includes(c.id) ? "on" : ""}`} onClick={() => toggleClient(c.id)}>
                    <span className={`checkbox ${clients.includes(c.id) ? "on" : ""}`}><Icon name="check" size={11} /></span>
                    {c.name}
                  </div>
                )}
              </div>
            </div>
          </aside>

          {/* results */}
          <main>
            <div className="results-bar">
              <div className="results-count"><b>{filtered.length}</b> {filtered.length === 1 ? "result" : "results"}{typeFilter !== "all" ? ` · ${TYPES.find((t) => t.id === typeFilter).label.toLowerCase()}` : ""}</div>
              <div style={{ flex: 1 }} />
              <div className="sortbar">
                <select className="select" value={sort} onChange={(e) => set({ sort: e.target.value })}>
                  <option value="installs">Most installed</option>
                  <option value="recent">Recently updated</option>
                  <option value="rating">Highest rated</option>
                  <option value="name">Name (A–Z)</option>
                </select>
                <Segmented
                  value={state.viewMode}
                  onChange={(v) => set({ viewMode: v })}
                  options={[{ value: "grid", icon: "grid" }, { value: "list", icon: "list" }]} />
                
              </div>
            </div>

            {activeChips.length > 0 &&
            <div className="chips" style={{ marginBottom: 16 }}>
                {activeChips.map((c) =>
              <span key={c.k + c.v} className="chip">
                    {c.label}
                    <button onClick={() => c.k === "cat" ? toggleCat(c.v) : toggleClient(c.v)}><Icon name="close" size={12} /></button>
                  </span>
              )}
                <button className="chip" style={{ paddingRight: 10, color: "var(--muted)", cursor: "pointer" }} onClick={() => set({ cats: [], clients: [] })}>Clear all</button>
              </div>
            }

            {filtered.length === 0 ?
            <div className="empty">
                <div className="empty-ic"><Icon name="search" size={22} /></div>
                <div style={{ fontWeight: 600, color: "var(--ink)", fontSize: 16 }}>No matches</div>
                <div style={{ marginTop: 6 }}>Try a different search or clear your filters.</div>
              </div> :

            <div className={state.viewMode === "grid" ? "grid grid-cards" : "grid"} style={{ gap: state.viewMode === "grid" ? 14 : 10 }}>
                {filtered.map((e) =>
              <EntryCard key={(e.parent ? e.parent.id + "-" : "") + e.id} entry={e} onOpen={onOpen} view={state.viewMode} />
              )}
              </div>
            }
          </main>
        </div>
      </div>
    </div>);

}

Object.assign(window, { BrowsePage, EntryCard, allEntries });