/* Detail views for the composition layer: agent + api. */

const AUTONOMY = {
  "read-only": { label: "Read-only", tone: "ok", desc: "Drafts and reads. Never takes a mutating action." },
  approval: { label: "Asks approval", tone: "warn", desc: "Proposes actions; a human confirms before anything runs." },
  autonomous: { label: "Autonomous", tone: "danger", desc: "Acts on its own within its granted scope." },
};

/* -------- Agent detail -------- */
function AgentDetail({ agent, onNav, onInstall }) {
  const [tab, setTab] = useState("capabilities");
  const SERVERS = window.REGISTRY.SERVERS, SKILLS = window.REGISTRY.SKILLS;
  const servers = (agent.servers || []).map((id) => SERVERS.find((s) => s.id === id)).filter(Boolean);
  const skills = (agent.skills || []).map((id) => SKILLS.find((s) => s.id === id)).filter(Boolean);
  const toolCount = servers.reduce((n, s) => n + s.tools.length, 0);
  const auto = AUTONOMY[agent.autonomy] || AUTONOMY.approval;

  const manifest = `{
  "agent": "${agent.slug}",
  "model": "${agent.model}",
  "autonomy": "${agent.autonomy}",
  "servers": [${servers.map((s) => `"${s.slug}"`).join(", ")}],
  "skills": [${skills.map((s) => `"${s.slug}"`).join(", ")}]
}`;

  return (
    <div className="container page">
      <Crumbs onNav={onNav} items={[{ label: "Registry", go: { view: "browse" } }, { label: "Agents", go: { view: "browse", type: "agent" } }, { label: agent.name }]} />
      <div className="detail-head">
        <div className="detail-logo dl-agent"><Icon name="agent" size={30} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="detail-titlerow">
            <h1 className="detail-title">{agent.name}</h1>
            <TypeBadge type="agent" />
            {agent.verified && <Badge tone="accent"><Icon name="verified" size={12} /> Verified</Badge>}
            {agent.official && <Badge tone="ok">Official</Badge>}
            <Badge tone={auto.tone}>{auto.label}</Badge>
          </div>
          <div className="detail-slug">{agent.slug} · v{agent.version}</div>
          <p className="detail-summary">{agent.summary}</p>
          <div style={{ display: "flex", gap: 18, marginTop: 16, flexWrap: "wrap" }}>
            <Stat icon="install" value={fmt(agent.installs)} label="installs" />
            <Stat icon="bolt" value={fmt(agent.runsWeek)} label="runs / wk" />
            <Stat icon="star" value={agent.rating} label="rating" />
            <Stat icon="clock" value={timeAgo(agent.updated)} />
          </div>
        </div>
        <div className="detail-cta">
          <Button variant="accent" icon="install" full onClick={() => onInstall(agent)}>Deploy agent</Button>
          <Button variant="secondary" icon="copy" full onClick={() => navigator.clipboard?.writeText(manifest)}>Copy manifest</Button>
        </div>
      </div>

      <div className="detail-grid">
        <div>
          <div className="callout accent" style={{ marginBottom: 22 }}>
            <Icon name="agent" size={16} />
            <div>An agent is the <b>composition layer</b>. It wires together servers and tools for the ability to <i>act</i>, and skills for the ability to <i>reason</i> — running on {agent.model} under a <b>{auto.label.toLowerCase()}</b> policy.</div>
          </div>

          <div className="tabs">
            {["capabilities", "overview", "config"].map((t) => (
              <div key={t} className={`tab ${tab === t ? "on" : ""}`} onClick={() => setTab(t)} style={{ textTransform: "capitalize" }}>
                {t === "capabilities" ? `Capabilities · ${servers.length + skills.length}` : t}
              </div>
            ))}
          </div>

          {tab === "capabilities" && (
            <div className="fade-up">
              <div className="section">
                <div className="section-title"><Icon name="server" size={15} style={{ verticalAlign: "-2px", marginRight: 6, color: "var(--muted)" }} />Connected servers · {servers.length}</div>
                <div className="field-hint" style={{ marginBottom: 12 }}>The capabilities this agent can act through. Each is a governed server in the registry — click to inspect its tools.</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {servers.map((s) => (
                    <div key={s.id} className="compose-card" onClick={() => onNav({ view: "server", id: s.id })}>
                      <div className="ec-logo"><Icon name="server" size={17} /></div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="compose-name">{s.name}{s.verified && <VerifiedMark size={13} />}<span className="compose-slug mono">{s.slug}</span></div>
                        <div className="compose-sum">{s.summary}</div>
                      </div>
                      <div className="compose-meta">
                        <span className="mono">{s.tools.length} tools</span>
                        <Icon name="chevronRight" size={15} style={{ color: "var(--faint)" }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="section">
                <div className="section-title"><Icon name="skill" size={15} style={{ verticalAlign: "-2px", marginRight: 6, color: "var(--muted)" }} />Loaded skills · {skills.length}</div>
                <div className="field-hint" style={{ marginBottom: 12 }}>Procedural knowledge the agent reads. These shape how it uses the tools above.</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {skills.length === 0 && <div className="field-hint">No skills loaded — this agent runs on its base instructions alone.</div>}
                  {skills.map((s) => (
                    <div key={s.id} className="compose-card" onClick={() => onNav({ view: "skill", id: s.id })}>
                      <div className="ec-logo" style={{ color: "var(--warn)" }}><Icon name="skill" size={17} /></div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="compose-name">{s.name}{s.verified && <VerifiedMark size={13} />}<span className="compose-slug mono">{s.slug}</span></div>
                        <div className="compose-sum">{s.summary}</div>
                      </div>
                      <div className="compose-meta">
                        <span className="mono">{s.tokens}</span>
                        <Icon name="chevronRight" size={15} style={{ color: "var(--faint)" }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "overview" && (
            <div className="fade-up">
              <div className="section">
                <p style={{ fontSize: 15.5, lineHeight: 1.65, color: "var(--ink-2)", margin: 0 }}>{agent.description}</p>
              </div>
              <div className="section">
                <div className="section-title">Role</div>
                <div className="role-quote">{agent.role}</div>
              </div>
              <div className="section">
                <div className="section-title">Example tasks</div>
                <div className="task-list">
                  {agent.tasks.map((t, i) => (
                    <div key={i} className="task-item"><Icon name="bolt" size={14} />{t}</div>
                  ))}
                </div>
              </div>
              <div className="section">
                <div className="section-title">Runs in</div>
                <ClientCompat ids={agent.clients} />
              </div>
            </div>
          )}

          {tab === "config" && (
            <div className="fade-up">
              <div className="section">
                <div className="section-title">Agent manifest</div>
                <CodeBlock lang="json">{manifest}</CodeBlock>
                <div className="field-hint" style={{ marginTop: 8 }}>The manifest references registry slugs — deploying resolves them to the governed servers and skills your org has approved.</div>
              </div>
              <div className="section">
                <div className="section-title">Deploy via CLI</div>
                <CopyField label="$" value={`registry agent deploy ${agent.slug}`} />
              </div>
              <div className="callout accent">
                <Icon name="shield" size={16} />
                <div>This agent runs under a <b>{auto.label.toLowerCase()}</b> policy — {auto.desc.toLowerCase()} It only ever sees the tools an admin has exposed to it through a virtual server.</div>
              </div>
            </div>
          )}
        </div>

        <aside>
          <div className="aside-card" style={{ marginBottom: 16 }}>
            <div className="section-title" style={{ marginBottom: 12 }}>Composed of</div>
            <div style={{ display: "flex", gap: 10 }}>
              <div className="aside-card" style={{ flex: 1, textAlign: "center", padding: "12px 6px" }}>
                <div className="kpi-n" style={{ fontSize: 22 }}>{servers.length}</div>
                <div className="kpi-l">servers</div>
              </div>
              <div className="aside-card" style={{ flex: 1, textAlign: "center", padding: "12px 6px" }}>
                <div className="kpi-n" style={{ fontSize: 22 }}>{toolCount}</div>
                <div className="kpi-l">tools</div>
              </div>
              <div className="aside-card" style={{ flex: 1, textAlign: "center", padding: "12px 6px" }}>
                <div className="kpi-n" style={{ fontSize: 22 }}>{skills.length}</div>
                <div className="kpi-l">skills</div>
              </div>
            </div>
          </div>
          <div className="aside-card" style={{ marginBottom: 16 }}>
            <div className="section-title" style={{ marginBottom: 12 }}>Specification</div>
            <div className="spec">
              <div className="spec-row"><span className="spec-k">Publisher</span><span className="spec-v"><Avatar name={agent.publisher} size={18} />{agent.publisher}{agent.verified && <VerifiedMark size={13} />}</span></div>
              <div className="spec-row"><span className="spec-k">Model</span><span className="spec-v">{agent.model}</span></div>
              <div className="spec-row"><span className="spec-k">Autonomy</span><span className="spec-v"><Badge tone={auto.tone}>{auto.label}</Badge></span></div>
              <div className="spec-row"><span className="spec-k">Version</span><span className="spec-v mono">{agent.version}</span></div>
              <div className="spec-row"><span className="spec-k">License</span><span className="spec-v">{agent.license}</span></div>
              <div className="spec-row"><span className="spec-k">Updated</span><span className="spec-v">{timeAgo(agent.updated)}</span></div>
            </div>
          </div>
          <div className="aside-card">
            <div className="section-title" style={{ marginBottom: 10 }}>Source</div>
            <a className="reach-item" style={{ cursor: "pointer" }}><Icon name="external" size={15} />{agent.repo}</a>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* -------- API detail -------- */
function ApiDetail({ api, onNav }) {
  const [tab, setTab] = useState("endpoints");
  const SERVERS = window.REGISTRY.SERVERS;
  const wrapper = api.wrappedBy ? SERVERS.find((s) => s.id === api.wrappedBy) : null;

  const curl = api.style === "GraphQL"
    ? `curl ${api.baseUrl} \\
  -H "Authorization: Bearer $TOKEN" \\
  -d '{ "query": "{ viewer { id } }" }'`
    : `curl ${api.baseUrl}${api.endpoints[0].path.replace(/:\w+/g, "123")} \\
  -H "Authorization: Bearer $TOKEN"`;

  return (
    <div className="container page">
      <Crumbs onNav={onNav} items={[{ label: "Registry", go: { view: "browse" } }, { label: "APIs", go: { view: "browse", type: "api" } }, { label: api.name }]} />
      <div className="detail-head">
        <div className="detail-logo dl-api"><Icon name="api" size={30} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="detail-titlerow">
            <h1 className="detail-title">{api.name}</h1>
            <TypeBadge type="api" />
            <span className={`api-style-chip style-${api.style.toLowerCase()}`} style={{ fontSize: 11 }}>{api.style}</span>
            {api.verified && <Badge tone="accent"><Icon name="verified" size={12} /> Verified</Badge>}
            {api.official && <Badge tone="ok">Official</Badge>}
          </div>
          <div className="detail-slug">{api.slug} · {api.version}</div>
          <p className="detail-summary">{api.summary}</p>
          <div style={{ display: "flex", gap: 18, marginTop: 16, flexWrap: "wrap" }}>
            <Stat icon="install" value={fmt(api.installs)} label="installs" />
            <Stat icon="bolt" value={fmt(api.callsWeek)} label="calls / wk" />
            <Stat icon="api" value={api.endpoints.length} label="endpoints" />
            <Stat icon="star" value={api.rating} label="rating" />
          </div>
        </div>
        <div className="detail-cta">
          {wrapper ? (
            <Button variant="accent" icon="server" full onClick={() => onNav({ view: "server", id: wrapper.id })}>Open MCP server</Button>
          ) : (
            <Button variant="accent" icon="plus" full onClick={() => onNav({ view: "register" })}>Wrap as MCP server</Button>
          )}
          <Button variant="secondary" icon="external" full>View spec</Button>
        </div>
      </div>

      <div className="detail-grid">
        <div>
          <div className={`callout ${wrapper ? "accent" : ""}`} style={{ marginBottom: 22 }}>
            <Icon name={wrapper ? "server" : "shield"} size={16} />
            <div>
              {wrapper
                ? <>This API is wrapped by the <a className="inline-link" onClick={() => onNav({ view: "server", id: wrapper.id })}>{wrapper.name} server</a>, which holds the credential and exposes a governed subset as MCP tools. Agents use the server — never the raw API.</>
                : <>This API isn't wrapped as an MCP server yet. Raw APIs can't be governed by the gateway — <b>wrap it</b> to give agents least-privilege, credential-free access.</>}
            </div>
          </div>

          <div className="tabs">
            {["endpoints", "overview"].map((t) => (
              <div key={t} className={`tab ${tab === t ? "on" : ""}`} onClick={() => setTab(t)} style={{ textTransform: "capitalize" }}>
                {t === "endpoints" ? `Endpoints · ${api.endpoints.length}` : t}
              </div>
            ))}
          </div>

          {tab === "endpoints" && (
            <div className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {api.endpoints.map((ep, i) => (
                <div key={i} className="endpoint-row">
                  <span className={`ep-verb-badge ev-${ep.method.toLowerCase()}`}>{ep.method}</span>
                  <span className="ep-path mono">{ep.path}</span>
                  <span className="ep-sum">{ep.summary}</span>
                </div>
              ))}
            </div>
          )}

          {tab === "overview" && (
            <div className="fade-up">
              <div className="section">
                <p style={{ fontSize: 15.5, lineHeight: 1.65, color: "var(--ink-2)", margin: 0 }}>{api.description}</p>
              </div>
              <div className="section">
                <div className="section-title">Example request</div>
                <CodeBlock lang="bash">{curl}</CodeBlock>
              </div>
            </div>
          )}
        </div>

        <aside>
          <div className="aside-card" style={{ marginBottom: 16 }}>
            <div className="section-title" style={{ marginBottom: 12 }}>Specification</div>
            <div className="spec">
              <div className="spec-row"><span className="spec-k">Publisher</span><span className="spec-v"><Avatar name={api.publisher} size={18} />{api.publisher}{api.verified && <VerifiedMark size={13} />}</span></div>
              <div className="spec-row"><span className="spec-k">Style</span><span className="spec-v">{api.style}</span></div>
              <div className="spec-row"><span className="spec-k">Auth</span><span className="spec-v">{api.auth}</span></div>
              <div className="spec-row"><span className="spec-k">Base URL</span><span className="spec-v mono" style={{ fontSize: 11.5, wordBreak: "break-all" }}>{api.baseUrl}</span></div>
              <div className="spec-row"><span className="spec-k">Version</span><span className="spec-v mono">{api.version}</span></div>
              <div className="spec-row"><span className="spec-k">License</span><span className="spec-v">{api.license}</span></div>
            </div>
          </div>
          <div className="aside-card" style={{ marginBottom: 16 }}>
            <div className="section-title" style={{ marginBottom: 10 }}>Wrapped by</div>
            {wrapper ? (
              <div className="compose-card" style={{ padding: 12 }} onClick={() => onNav({ view: "server", id: wrapper.id })}>
                <div className="ec-logo" style={{ width: 32, height: 32 }}><Icon name="server" size={16} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="compose-name" style={{ fontSize: 14 }}>{wrapper.name}</div>
                  <div className="compose-slug mono" style={{ marginLeft: 0 }}>{wrapper.slug}</div>
                </div>
                <Icon name="chevronRight" size={15} style={{ color: "var(--faint)" }} />
              </div>
            ) : (
              <div className="field-hint" style={{ marginTop: 0 }}>No MCP server wraps this API yet.</div>
            )}
          </div>
          <div className="aside-card">
            <div className="section-title" style={{ marginBottom: 10 }}>Source</div>
            <a className="reach-item" style={{ cursor: "pointer" }}><Icon name="external" size={15} />{api.repo}</a>
          </div>
        </aside>
      </div>
    </div>
  );
}

Object.assign(window, { AgentDetail, ApiDetail });
