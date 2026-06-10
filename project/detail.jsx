/* Detail views for server / tool / skill. */

function CodeBlock({ children, lang }) {
  const [copied, setCopied] = useState(false);
  const text = typeof children === "string" ? children : "";
  return (
    <div className="codeblock">
      <button className="code-copy-btn" style={{ position: "absolute", top: 12, right: 12 }}
        onClick={() => { navigator.clipboard?.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1200); }}>
        <Icon name={copied ? "check" : "copy"} size={14} />
      </button>
      <pre style={{ margin: 0 }}><code>{children}</code></pre>
    </div>
  );
}

function Crumbs({ items, onNav }) {
  return (
    <div className="crumbs">
      {items.map((it, i) => (
        <React.Fragment key={i}>
          {i > 0 && <Icon name="chevronRight" size={13} />}
          {it.go ? <a onClick={() => onNav(it.go)}>{it.label}</a> : <span style={{ color: "var(--ink)" }}>{it.label}</span>}
        </React.Fragment>
      ))}
    </div>
  );
}

function ClientCompat({ ids }) {
  return (
    <div className="clients">
      {CLIENTS.map((c) => {
        const on = ids.includes(c.id);
        return <span key={c.id} className={`client-chip ${on ? "" : "off"}`}><span className="cdot" />{c.name}</span>;
      })}
    </div>
  );
}

/* -------- Server detail -------- */
function ServerDetail({ server, onNav, onInstall, onInvoke }) {
  const [tab, setTab] = useState("tools");
  const [openTool, setOpenTool] = useState(server.tools[0]?.id);

  const installSnippet = `{
  "mcpServers": {
    "${server.id}": {
      "transport": "${server.transports[0]}",
      "url": "https://registry.dev/${server.slug}"
    }
  }
}`;

  return (
    <div className="container page">
      <Crumbs onNav={onNav} items={[{ label: "Registry", go: { view: "browse" } }, { label: "Servers", go: { view: "browse", type: "server" } }, { label: server.name }]} />
      <div className="detail-head">
        <div className="detail-logo"><Icon name="server" size={30} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="detail-titlerow">
            <h1 className="detail-title">{server.name}</h1>
            <TypeBadge type="server" />
            {server.verified && <Badge tone="accent"><Icon name="verified" size={12} /> Verified</Badge>}
            {server.official && <Badge tone="ok">Official</Badge>}
          </div>
          <div className="detail-slug">{server.slug} · v{server.version}</div>
          <p className="detail-summary">{server.summary}</p>
          <div style={{ display: "flex", gap: 18, marginTop: 16, flexWrap: "wrap" }}>
            <Stat icon="install" value={fmt(server.installs)} label="installs" />
            <Stat icon="bolt" value={fmt(server.callsWeek)} label="calls / wk" />
            <Stat icon="star" value={server.rating} label="rating" />
            <Stat icon="clock" value={timeAgo(server.updated)} />
          </div>
        </div>
        <div className="detail-cta">
          <Button variant="accent" icon="install" full onClick={() => onInstall(server)}>Install</Button>
          <Button variant="secondary" icon="play" full onClick={() => onInvoke({ server, tool: server.tools[0] })}>Try a tool</Button>
        </div>
      </div>

      <div className="detail-grid">
        <div>
          <div className="tabs">
            {["tools", "overview", "install"].map((t) => (
              <div key={t} className={`tab ${tab === t ? "on" : ""}`} onClick={() => setTab(t)} style={{ textTransform: "capitalize" }}>
                {t === "tools" ? `Tools · ${server.tools.length}` : t}
              </div>
            ))}
          </div>

          {tab === "tools" && (
            <div>
              <div className="callout" style={{ marginBottom: 16 }}>
                <Icon name="server" size={16} />
                <div>Tools are the callable surface of this server. The gateway can expose a subset of them as a <b>virtual server</b> — least-privilege access over the capability axis.</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {server.tools.map((t) => {
                  const open = openTool === t.id;
                  return (
                    <div key={t.id} className="tool-item">
                      <div className="tool-item-head" style={{ cursor: "pointer" }} onClick={() => setOpenTool(open ? null : t.id)}>
                        <Icon name="tool" size={16} style={{ color: "var(--ok)" }} />
                        <span className="tool-name">{t.name}</span>
                        <span className="tool-sig">({t.params.map((p) => p.name).join(", ") || ""}) → {t.returns}</span>
                        {t.write && <Badge tone="warn" style={{ marginLeft: 4 }}>write</Badge>}
                        <div style={{ flex: 1 }} />
                        <Stat value={fmt(t.calls)} />
                        <button className="iconbtn" onClick={(e) => { e.stopPropagation(); onInvoke({ server, tool: t }); }}><Icon name="play" size={15} /></button>
                        <Icon name="chevronDown" size={15} style={{ color: "var(--faint)", transform: open ? "rotate(180deg)" : "", transition: ".15s" }} />
                      </div>
                      <div className="tool-desc">{t.summary}</div>
                      {open && t.params.length > 0 && (
                        <div className="params">
                          {t.params.map((p) => (
                            <div key={p.name} className="param">
                              <span className="param-name">{p.name}</span>
                              <span className="param-type">{p.type}</span>
                              {p.required && <span className="param-req">required</span>}
                              <span className="param-desc">{p.desc}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === "overview" && (
            <div className="fade-up">
              <div className="section">
                <p style={{ fontSize: 15.5, lineHeight: 1.65, color: "var(--ink-2)", margin: 0 }}>{server.description}</p>
              </div>
              <div className="section">
                <div className="section-title">Compatibility</div>
                <ClientCompat ids={server.clients} />
              </div>
              <div className="section">
                <div className="section-title">Also exposes</div>
                <div style={{ display: "flex", gap: 10 }}>
                  <div className="aside-card" style={{ flex: 1, textAlign: "center" }}>
                    <div className="kpi-n" style={{ fontSize: 22 }}>{server.resources}</div>
                    <div className="kpi-l">resources</div>
                  </div>
                  <div className="aside-card" style={{ flex: 1, textAlign: "center" }}>
                    <div className="kpi-n" style={{ fontSize: 22 }}>{server.prompts}</div>
                    <div className="kpi-l">prompts</div>
                  </div>
                  <div className="aside-card" style={{ flex: 1, textAlign: "center" }}>
                    <div className="kpi-n" style={{ fontSize: 22 }}>{server.tools.length}</div>
                    <div className="kpi-l">tools</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === "install" && (
            <div className="fade-up">
              <div className="section">
                <div className="section-title">1 · Add to your client config</div>
                <CodeBlock>{installSnippet}</CodeBlock>
              </div>
              <div className="section">
                <div className="section-title">2 · Or install via CLI</div>
                <CopyField label="$" value={`registry add ${server.slug}`} />
              </div>
              <div className="callout accent">
                <Icon name="shield" size={16} />
                <div>This server authenticates with <b>{server.auth}</b>. Credentials stay at the server boundary — the agent never sees the token.</div>
              </div>
            </div>
          )}
        </div>

        {/* aside */}
        <aside>
          <div className="aside-card" style={{ marginBottom: 16 }}>
            <div className="section-title" style={{ marginBottom: 12 }}>Specification</div>
            <div className="spec">
              <div className="spec-row"><span className="spec-k">Publisher</span><span className="spec-v"><Avatar name={server.publisher} size={18} />{server.publisher}{server.verified && <VerifiedMark size={13} />}</span></div>
              <div className="spec-row"><span className="spec-k">Transport</span><span className="spec-v">{server.transports.map((t) => <Transport key={t} t={t} />)}</span></div>
              <div className="spec-row"><span className="spec-k">Auth</span><span className="spec-v">{server.auth}</span></div>
              <div className="spec-row"><span className="spec-k">Version</span><span className="spec-v mono">{server.version}</span></div>
              <div className="spec-row"><span className="spec-k">License</span><span className="spec-v">{server.license}</span></div>
              <div className="spec-row"><span className="spec-k">Updated</span><span className="spec-v">{timeAgo(server.updated)}</span></div>
            </div>
          </div>
          <div className="aside-card">
            <div className="section-title" style={{ marginBottom: 10 }}>Source</div>
            <a className="reach-item" style={{ cursor: "pointer" }}><Icon name="external" size={15} />{server.repo}</a>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* -------- Skill detail -------- */
function SkillDetail({ skill, onNav, onInstall }) {
  const [tab, setTab] = useState("playbook");
  return (
    <div className="container page">
      <Crumbs onNav={onNav} items={[{ label: "Registry", go: { view: "browse" } }, { label: "Skills", go: { view: "browse", type: "skill" } }, { label: skill.name }]} />
      <div className="detail-head">
        <div className="detail-logo" style={{ background: "color-mix(in oklch, var(--warn) 9%, white)", borderColor: "color-mix(in oklch, var(--warn) 22%, white)" }}><Icon name="skill" size={30} style={{ color: "var(--warn)" }} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="detail-titlerow">
            <h1 className="detail-title">{skill.name}</h1>
            <TypeBadge type="skill" />
            {skill.verified && <Badge tone="accent"><Icon name="verified" size={12} /> Verified</Badge>}
          </div>
          <div className="detail-slug">{skill.slug} · v{skill.version}</div>
          <p className="detail-summary">{skill.summary}</p>
          <div style={{ display: "flex", gap: 18, marginTop: 16, flexWrap: "wrap" }}>
            <Stat icon="install" value={fmt(skill.installs)} label="installs" />
            <Stat icon="book" value={skill.tokens} label="loaded" />
            <Stat icon="star" value={skill.rating} label="rating" />
            <Stat icon="clock" value={timeAgo(skill.updated)} />
          </div>
        </div>
        <div className="detail-cta">
          <Button variant="accent" icon="install" full onClick={() => onInstall(skill)}>Add skill</Button>
          <Button variant="secondary" icon="copy" full onClick={() => navigator.clipboard?.writeText(skill.skillmd)}>Copy SKILL.md</Button>
        </div>
      </div>

      <div className="detail-grid">
        <div>
          <div className="callout accent" style={{ marginBottom: 22 }}>
            <Icon name="book" size={16} />
            <div>A skill is <b>procedural knowledge, not an endpoint</b>. The agent doesn't call it — it reads the SKILL.md when a task matches and follows the steps. Servers give an agent the ability to <i>do</i>; skills give it the ability to <i>think</i>.</div>
          </div>

          <div className="tabs">
            {["playbook", "SKILL.md"].map((t) => (
              <div key={t} className={`tab ${tab === t ? "on" : ""}`} onClick={() => setTab(t)}>{t === "playbook" ? "Playbook" : "SKILL.md"}</div>
            ))}
          </div>

          {tab === "playbook" ? (
            <div className="fade-up">
              <div className="section">
                <div className="section-title">Trigger phrases</div>
                <div className="triggers">
                  {skill.triggers.map((t) => <span key={t} className="trigger">{t}</span>)}
                </div>
                <div className="field-hint" style={{ marginTop: 10 }}>Progressive disclosure: the agent sees only the name and description until one of these matches — then it loads the full {skill.tokens} playbook.</div>
              </div>
              <div className="section">
                <div className="section-title">How it works</div>
                <div className="steps">
                  {skill.steps.map((s, i) => (
                    <div key={i} className="step"><span className="step-n" /><span className="step-text">{s}</span></div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="fade-up section">
              <CodeBlock>{skill.skillmd}</CodeBlock>
            </div>
          )}
        </div>

        <aside>
          <div className="aside-card" style={{ marginBottom: 16 }}>
            <div className="section-title" style={{ marginBottom: 12 }}>Reaches for</div>
            <div className="reach">
              {skill.reaches.map((r) => (
                <div key={r} className="reach-item"><Icon name="tool" size={14} />{r}</div>
              ))}
            </div>
            <div className="field-hint" style={{ marginTop: 12 }}>Skills are tool-agnostic — they name capabilities, and bind to whichever servers you have connected.</div>
          </div>
          <div className="aside-card">
            <div className="section-title" style={{ marginBottom: 12 }}>Specification</div>
            <div className="spec">
              <div className="spec-row"><span className="spec-k">Author</span><span className="spec-v"><Avatar name={skill.publisher} size={18} />{skill.publisher}</span></div>
              <div className="spec-row"><span className="spec-k">Type</span><span className="spec-v">SKILL.md</span></div>
              <div className="spec-row"><span className="spec-k">Footprint</span><span className="spec-v mono">{skill.tokens}</span></div>
              <div className="spec-row"><span className="spec-k">Version</span><span className="spec-v mono">{skill.version}</span></div>
              <div className="spec-row"><span className="spec-k">License</span><span className="spec-v">{skill.license}</span></div>
            </div>
          </div>
          <div className="callout" style={{ marginTop: 16, fontSize: 12.5 }}>
            <Icon name="shield" size={15} />
            <div>Skills live at the agent layer, above the MCP protocol. Your gateway governs servers — it has nothing to say about skills.</div>
          </div>
        </aside>
      </div>
    </div>
  );
}

Object.assign(window, { ServerDetail, SkillDetail, CodeBlock, Crumbs, ClientCompat });
