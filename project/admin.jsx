/* Admin / governance queue. */
function AdminPage({ onNav }) {
  const [items, setItems] = useState(window.REGISTRY.PENDING);
  const [filter, setFilter] = useState("all");
  const [toast, setToast] = useState(null);

  const act = (id, verdict) => {
    const item = items.find((x) => x.id === id);
    setItems(items.filter((x) => x.id !== id));
    setToast({ name: item.name, verdict });
    setTimeout(() => setToast(null), 2600);
  };

  const shown = filter === "all" ? items : items.filter((i) => i.type === filter || i.risk === filter);

  const KPIS = [
  { n: items.length, l: "Awaiting review", trend: null },
  { n: 8, l: "Published", trend: "+3 this week", up: true },
  { n: items.filter((i) => i.risk === "high").length, l: "High risk flagged", trend: null, danger: true },
  { n: "2.1k", l: "Avg time to review", suffix: "min", trend: "−18%", up: true }];


  return (
    <div className="container page">
      <div className="page-head" style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div>
          <div className="eyebrow">Governance</div>
          <h1 className="h1">Moderation queue</h1>
          <p className="lede">Review what publishers want to add. Approve, request changes, or reject — least privilege is the default.</p>
        </div>
        <Button variant="secondary" icon="shield" onClick={() => onNav({ view: "policy" })}>Policy settings</Button>
      </div>

      <div className="admin-stats">
        {KPIS.map((k, i) =>
        <div key={i} className="kpi">
            <div className="kpi-n" style={k.danger && k.n > 0 ? { color: "var(--danger)" } : {}}>{k.n}{k.suffix && <span style={{ fontSize: 14, color: "var(--muted)", fontWeight: 500 }}> {k.suffix}</span>}</div>
            <div className="kpi-l">{k.l}</div>
            {k.trend && <div className="kpi-trend" style={{ color: k.up ? "var(--ok)" : "var(--muted)" }}>{k.trend}</div>}
          </div>
        )}
      </div>

      <div className="tabs" style={{ marginBottom: 20 }} data-comment-anchor="31c7461117-div-44-7">
        {[{ id: "all", label: `All · ${items.length}` }, { id: "server", label: "Servers" }, { id: "tool", label: "Tools" }, { id: "skill", label: "Skills" }, { id: "high", label: "High risk" }].map((t) =>
        <div key={t.id} className={`tab ${filter === t.id ? "on" : ""}`} onClick={() => setFilter(t.id)}>{t.label}</div>
        )}
      </div>

      {shown.length === 0 ?
      <div className="empty">
          <div className="empty-ic"><Icon name="check" size={22} /></div>
          <div style={{ fontWeight: 600, color: "var(--ink)", fontSize: 16 }}>Queue clear</div>
          <div style={{ marginTop: 6 }}>Nothing waiting for review. Nicely done.</div>
        </div> :

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {shown.map((item) =>
        <div key={item.id} className="queue-item fade-up">
              <div className={`risk-bar risk-${item.risk}`} />
              <div className="ec-logo" style={{ width: 42, height: 42 }}><Icon name={TYPE_META[item.type].icon} size={20} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 600, fontSize: 16 }}>{item.name}</span>
                  <span className="mono" style={{ fontSize: 12.5, color: "var(--muted)" }}>{item.slug}</span>
                  <TypeBadge type={item.type} />
                  <Badge tone={item.risk === "high" ? "danger" : item.risk === "medium" ? "warn" : "ok"}>{item.risk} risk</Badge>
                </div>
                <div className="ec-summary" style={{ marginTop: 7 }}>{item.summary}</div>
                <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
                  <Stat icon="user" value={item.publisher} />
                  <Stat icon="clock" value={timeAgo(item.submitted)} />
                  {item.parent && <Stat icon="server" value={item.parent} label="server" />}
                  {item.transports && <span style={{ display: "flex", gap: 5 }}>{item.transports.map((t) => <Transport key={t} t={t} />)}</span>}
                  {item.toolCount > 0 && <Stat icon="tool" value={item.toolCount} label="tools" />}
                  {item.auth && <Stat value={item.auth} />}
                </div>
                {item.flags.length > 0 &&
            <div className="flag-list">
                    {item.flags.map((f, i) =>
              <div key={i} className={`flag ${item.risk === "high" ? "high" : ""}`}><Icon name="warning" size={14} />{f}</div>
              )}
                  </div>
            }
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: "none", width: 150 }}>
                <Button variant="accent" size="sm" icon="check" full onClick={() => act(item.id, "approved")}>Approve</Button>
                <Button variant="secondary" size="sm" icon="flag" full onClick={() => act(item.id, "changes requested")}>Request changes</Button>
                <Button variant="danger" size="sm" icon="close" full onClick={() => act(item.id, "rejected")}>Reject</Button>
              </div>
            </div>
        )}
        </div>
      }

      {toast &&
      <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 95, background: "var(--ink)", color: "white", padding: "12px 18px", borderRadius: 11, boxShadow: "var(--shadow-lg)", display: "flex", alignItems: "center", gap: 10, fontSize: 14 }} className="fade-up">
          <Icon name={toast.verdict === "rejected" ? "close" : "check"} size={16} stroke={2.2} style={{ color: toast.verdict === "rejected" ? "#ff9b91" : "#86efac" }} />
          <span><b>{toast.name}</b> {toast.verdict}</span>
        </div>
      }
    </div>);

}

Object.assign(window, { AdminPage });