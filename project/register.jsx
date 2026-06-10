/* Register / publish wizard. */
function RegisterPage({ onNav }) {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [data, setData] = useState({
    kind: "server", name: "", slug: "", category: "Developer Tools", summary: "",
    transport: "http", endpoint: "", auth: "OAuth 2.1", repo: "",
    readOnly: true, requireApproval: true, internalOnly: false,
    triggers: "", visibility: "org",
    parentServer: "github", params: [{ name: "", type: "string", required: true }], returns: "", isWrite: false,
    agentModel: "Claude Sonnet 4.5", agentServers: [], agentSkills: [], autonomy: "approval",
    apiStyle: "REST", baseUrl: "", apiAuth: "API key", endpoints: [{ method: "GET", path: "", summary: "" }],
  });
  const set = (patch) => setData({ ...data, ...patch });

  const isSkill = data.kind === "skill";
  const isTool = data.kind === "tool";
  const isAgent = data.kind === "agent";
  const isApi = data.kind === "api";
  const step2Label = isSkill ? "Knowledge" : isTool ? "Interface" : isAgent ? "Composition" : isApi ? "Endpoints" : "Connection";
  const step2Desc = isSkill ? "Triggers & SKILL.md" : isTool ? "Parameters & returns" : isAgent ? "Servers, skills & model" : isApi ? "Style & endpoints" : "Transport & auth";
  const STEPS = [
    { label: "Type", desc: "What you're registering" },
    { label: "Identity", desc: "Name & description" },
    { label: step2Label, desc: step2Desc },
    { label: "Governance", desc: "Access & review" },
    { label: "Review", desc: "Confirm & submit" },
  ];

  const canNext = () => {
    if (step === 1 && isTool) return data.name.trim() && data.summary.trim() && data.parentServer;
    if (step === 1) return data.name.trim() && data.slug.trim() && data.summary.trim();
    if (step === 2 && isTool) return data.params.every((p) => !p.name || p.type);
    if (step === 2 && isAgent) return data.agentServers.length + data.agentSkills.length > 0;
    if (step === 2 && isApi) return data.baseUrl.trim() && data.endpoints.some((e) => e.path.trim());
    if (step === 2 && isSkill) return data.triggers.trim();
    if (step === 2 && !isSkill && !isTool) return data.endpoint.trim();
    return true;
  };

  if (done) {
    return (
      <div className="container page">
        <div style={{ maxWidth: 520, margin: "60px auto", textAlign: "center" }} className="fade-up">
          <div style={{ width: 64, height: 64, borderRadius: 18, background: "var(--accent-wash)", border: "1px solid var(--accent-line)", display: "grid", placeItems: "center", margin: "0 auto 22px", color: "var(--accent)" }}>
            <Icon name="check" size={30} stroke={2} />
          </div>
          <h1 className="h1" style={{ marginBottom: 10 }}>Submitted for review</h1>
          <p className="lede" style={{ margin: "0 auto 26px" }}><b style={{ color: "var(--ink)" }}>{data.name}</b> is now in the moderation queue. An admin will review the requested scopes and publish it to the registry.</p>
          <div className="summary-card" style={{ textAlign: "left", marginBottom: 26 }}>
            <div className="summary-row"><span className="summary-k">Submission</span><span className="summary-v mono">{data.slug}</span></div>
            <div className="summary-row"><span className="summary-k">Type</span><span className="summary-v" style={{ textTransform: "capitalize" }}>{data.kind}</span></div>
            <div className="summary-row"><span className="summary-k">Status</span><span className="summary-v"><Badge tone="warn">Pending review</Badge></span></div>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <Button variant="primary" onClick={() => onNav({ view: "admin" })}>View in queue</Button>
            <Button variant="ghost" onClick={() => { setDone(false); setStep(0); }}>Submit another</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container page">
      <div className="page-head">
        <div className="eyebrow">Publish</div>
        <h1 className="h1">Register a new entry</h1>
        <p className="lede">Add a server, its tools, or a skill to the registry. Submissions are reviewed before they go live.</p>
      </div>

      <div className="wizard">
        <div className="steps-rail">
          {STEPS.map((s, i) => (
            <div key={i} className={`rail-step ${i === step ? "on" : ""} ${i < step ? "done" : ""}`} onClick={() => i < step && setStep(i)}>
              <span className="rail-num">{i < step ? <Icon name="check" size={12} stroke={2.4} /> : i + 1}</span>
              <div><div className="rail-label">{s.label}</div><div className="rail-desc">{s.desc}</div></div>
            </div>
          ))}
        </div>

        <div style={{ minWidth: 0 }}>
          {step === 0 && (
            <div className="fade-up">
              <h2 className="h2" style={{ marginBottom: 6 }}>What are you registering?</h2>
              <p className="field-hint" style={{ marginBottom: 20 }}>This determines how it's governed. APIs and servers carry credentials; tools live on the protocol; skills and agents live at the agent layer.</p>
              <div className="choice-grid">
                <button className={`choice ${data.kind === "agent" ? "on" : ""}`} onClick={() => set({ kind: "agent" })}>
                  <div className="choice-ic"><Icon name="agent" size={19} /></div>
                  <div className="choice-t">Agent</div>
                  <div className="choice-d">A deployable assistant that composes servers and skills under a model and an autonomy policy.</div>
                </button>
                <button className={`choice ${data.kind === "server" ? "on" : ""}`} onClick={() => set({ kind: "server" })}>
                  <div className="choice-ic"><Icon name="server" size={19} /></div>
                  <div className="choice-t">MCP Server</div>
                  <div className="choice-d">A package that exposes tools, resources, and prompts over a transport. Carries credentials and is governable by the gateway.</div>
                </button>
                <button className={`choice ${data.kind === "api" ? "on" : ""}`} onClick={() => set({ kind: "api" })}>
                  <div className="choice-ic"><Icon name="api" size={19} /></div>
                  <div className="choice-t">API</div>
                  <div className="choice-d">A raw REST or GraphQL service. The layer an MCP server wraps to make it agent-safe.</div>
                </button>
                <button className={`choice ${data.kind === "tool" ? "on" : ""}`} onClick={() => set({ kind: "tool" })}>
                  <div className="choice-ic"><Icon name="tool" size={19} /></div>
                  <div className="choice-t">Tool</div>
                  <div className="choice-d">A single callable function — name, input schema, return value — added to a server you already publish.</div>
                </button>
                <button className={`choice ${data.kind === "skill" ? "on" : ""}`} onClick={() => set({ kind: "skill" })}>
                  <div className="choice-ic"><Icon name="skill" size={19} /></div>
                  <div className="choice-t">Skill</div>
                  <div className="choice-d">Portable procedural knowledge — a SKILL.md the agent reads when a task matches. No endpoint, no credentials.</div>
                </button>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="fade-up">
              <h2 className="h2" style={{ marginBottom: 20 }}>Identity</h2>
              {isTool && (
                <div className="field">
                  <label className="field-label">Parent server <span className="req-star">*</span></label>
                  <select className="input" style={{ appearance: "auto" }} value={data.parentServer} onChange={(e) => set({ parentServer: e.target.value })}>
                    {SERVERS.map((s) => <option key={s.id} value={s.id}>{s.name} — {s.slug}</option>)}
                  </select>
                  <div className="field-hint">A tool is exposed by a server. It inherits the server's transport, auth, and credentials.</div>
                </div>
              )}
              <div className="field">
                <label className="field-label">{isTool ? "Function name" : "Name"} <span className="req-star">*</span></label>
                <input className={`input ${isTool ? "mono" : ""}`} placeholder={isSkill ? "e.g. PR Review" : isTool ? "e.g. create_issue" : "e.g. GitHub"} value={data.name} onChange={(e) => { const v = e.target.value; if (isTool) { const par = SERVERS.find((s) => s.id === data.parentServer); set({ name: v, slug: (par ? par.slug : "") + ":" + v.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_|_$/g, "") }); } else { set({ name: v, slug: v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") }); } }} />
                {isTool && <div className="field-hint">snake_case. This is the identifier the model calls.</div>}
              </div>
              {!isTool && (
                <div className="field">
                  <label className="field-label">Slug <span className="req-star">*</span></label>
                  <input className="input mono" placeholder="publisher/name" value={data.slug} onChange={(e) => set({ slug: e.target.value })} />
                  <div className="field-hint">The unique identifier. Format as <span className="mono">publisher/name</span>.</div>
                </div>
              )}
              {!isTool && (
                <div className="field">
                  <label className="field-label">Category</label>
                  <select className="input" style={{ appearance: "auto" }} value={data.category} onChange={(e) => set({ category: e.target.value })}>
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
              )}
              <div className="field">
                <label className="field-label">One-line summary <span className="req-star">*</span></label>
                <input className="input" placeholder="What does it do, in one sentence?" value={data.summary} onChange={(e) => set({ summary: e.target.value })} />
              </div>
            </div>
          )}

          {step === 2 && isTool && (
            <div className="fade-up">
              <h2 className="h2" style={{ marginBottom: 6 }}>Interface</h2>
              <p className="field-hint" style={{ marginBottom: 20 }}>The input schema the model fills in, and the shape that comes back.</p>
              <div className="field">
                <label className="field-label">Parameters</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {data.params.map((p, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input className="input mono" style={{ flex: 1 }} placeholder="name" value={p.name} onChange={(e) => { const params = [...data.params]; params[i] = { ...p, name: e.target.value }; set({ params }); }} />
                      <select className="input mono" style={{ appearance: "auto", width: 120, flex: "none" }} value={p.type} onChange={(e) => { const params = [...data.params]; params[i] = { ...p, type: e.target.value }; set({ params }); }}>
                        {["string", "integer", "boolean", "enum", "string[]", "any[]", "object"].map((t) => <option key={t}>{t}</option>)}
                      </select>
                      <button type="button" className={`switch ${p.required ? "on" : ""}`} title="Required" style={{ flex: "none" }} onClick={() => { const params = [...data.params]; params[i] = { ...p, required: !p.required }; set({ params }); }} />
                      <button type="button" className="iconbtn" style={{ flex: "none" }} onClick={() => set({ params: data.params.filter((_, j) => j !== i) })}><Icon name="close" size={16} /></button>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 10 }}>
                  <Button variant="ghost" size="sm" icon="plus" onClick={() => set({ params: [...data.params, { name: "", type: "string", required: false }] })}>Add parameter</Button>
                  <span className="field-hint" style={{ marginTop: 0 }}>Toggle marks a parameter <b>required</b>.</span>
                </div>
              </div>
              <div className="field">
                <label className="field-label">Returns</label>
                <input className="input mono" placeholder="e.g. Issue { number, url, state }" value={data.returns} onChange={(e) => set({ returns: e.target.value })} />
              </div>
              <div className="toggle-row">
                <div className="tr-text"><div className="tr-t">Write tool</div><div className="tr-d">This tool mutates state. It'll be held behind an allowlist until an admin enables it.</div></div>
                <div className={`switch ${data.isWrite ? "on" : ""}`} onClick={() => set({ isWrite: !data.isWrite })} />
              </div>
            </div>
          )}

          {step === 2 && isAgent && (
            <div className="fade-up">
              <h2 className="h2" style={{ marginBottom: 6 }}>Composition</h2>
              <p className="field-hint" style={{ marginBottom: 20 }}>Wire your agent from registry building blocks: servers for the ability to act, skills for the ability to reason.</p>
              <div className="field">
                <label className="field-label">Model</label>
                <select className="input" style={{ appearance: "auto" }} value={data.agentModel} onChange={(e) => set({ agentModel: e.target.value })}>
                  {["Claude Opus 4.1", "Claude Sonnet 4.5", "Claude Haiku 4.5"].map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="field-label">Connected servers <span className="req-star">*</span></label>
                <div className="pick-grid">
                  {SERVERS.map((s) => {
                    const on = data.agentServers.includes(s.id);
                    return (
                      <button key={s.id} type="button" className={`pick ${on ? "on" : ""}`} onClick={() => set({ agentServers: on ? data.agentServers.filter((x) => x !== s.id) : [...data.agentServers, s.id] })}>
                        <span className={`checkbox ${on ? "on" : ""}`}><Icon name="check" size={11} /></span>
                        <Icon name="server" size={15} style={{ color: "var(--muted)" }} />
                        <span className="pick-name">{s.name}</span>
                        <span className="pick-meta mono">{s.tools.length}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="field">
                <label className="field-label">Loaded skills</label>
                <div className="pick-grid">
                  {SKILLS.map((s) => {
                    const on = data.agentSkills.includes(s.id);
                    return (
                      <button key={s.id} type="button" className={`pick ${on ? "on" : ""}`} onClick={() => set({ agentSkills: on ? data.agentSkills.filter((x) => x !== s.id) : [...data.agentSkills, s.id] })}>
                        <span className={`checkbox ${on ? "on" : ""}`}><Icon name="check" size={11} /></span>
                        <Icon name="skill" size={15} style={{ color: "var(--warn)" }} />
                        <span className="pick-name">{s.name}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="field-hint">{data.agentServers.length} server(s) · {data.agentSkills.length} skill(s) selected.</div>
              </div>
            </div>
          )}

          {step === 2 && isApi && (
            <div className="fade-up">
              <h2 className="h2" style={{ marginBottom: 6 }}>Endpoints</h2>
              <p className="field-hint" style={{ marginBottom: 20 }}>Describe the service and the endpoints worth cataloguing. A server can wrap these into governed tools later.</p>
              <div className="field">
                <label className="field-label">Style</label>
                <div className="choice-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                  {[{ id: "REST", d: "Resource-oriented HTTP" }, { id: "GraphQL", d: "Single typed endpoint" }].map((st) => (
                    <button key={st.id} className={`choice ${data.apiStyle === st.id ? "on" : ""}`} onClick={() => set({ apiStyle: st.id })}>
                      <div className="choice-t mono">{st.id}</div>
                      <div className="choice-d">{st.d}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="field">
                <label className="field-label">Base URL <span className="req-star">*</span></label>
                <input className="input mono" placeholder="https://api.example.com/v1" value={data.baseUrl} onChange={(e) => set({ baseUrl: e.target.value })} />
              </div>
              <div className="field">
                <label className="field-label">Authentication</label>
                <select className="input" style={{ appearance: "auto" }} value={data.apiAuth} onChange={(e) => set({ apiAuth: e.target.value })}>
                  {["API key", "OAuth 2.1", "Bearer token", "Basic", "None"].map((a) => <option key={a}>{a}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="field-label">Endpoints <span className="req-star">*</span></label>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {data.endpoints.map((ep, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <select className="input mono" style={{ appearance: "auto", width: 104, flex: "none" }} value={ep.method} onChange={(e) => { const eps = [...data.endpoints]; eps[i] = { ...ep, method: e.target.value }; set({ endpoints: eps }); }}>
                        {(data.apiStyle === "GraphQL" ? ["QUERY", "MUTATION"] : ["GET", "POST", "PUT", "PATCH", "DELETE"]).map((m) => <option key={m}>{m}</option>)}
                      </select>
                      <input className="input mono" style={{ flex: 1 }} placeholder={data.apiStyle === "GraphQL" ? "issueCreate" : "/path/:id"} value={ep.path} onChange={(e) => { const eps = [...data.endpoints]; eps[i] = { ...ep, path: e.target.value }; set({ endpoints: eps }); }} />
                      <button type="button" className="iconbtn" style={{ flex: "none" }} onClick={() => set({ endpoints: data.endpoints.filter((_, j) => j !== i) })}><Icon name="close" size={16} /></button>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 10 }}>
                  <Button variant="ghost" size="sm" icon="plus" onClick={() => set({ endpoints: [...data.endpoints, { method: data.apiStyle === "GraphQL" ? "QUERY" : "GET", path: "", summary: "" }] })}>Add endpoint</Button>
                </div>
              </div>
            </div>
          )}

          {step === 2 && !isSkill && !isTool && !isAgent && !isApi && (
            <div className="fade-up">
              <h2 className="h2" style={{ marginBottom: 20 }}>Connection</h2>
              <div className="field">
                <label className="field-label">Transport</label>
                <div className="choice-grid">
                  {[{ id: "http", t: "HTTP", d: "Streamable HTTP endpoint" }, { id: "sse", t: "SSE", d: "Server-sent events" }, { id: "stdio", t: "stdio", d: "Local subprocess" }].map((tr) => (
                    <button key={tr.id} className={`choice ${data.transport === tr.id ? "on" : ""}`} onClick={() => set({ transport: tr.id })}>
                      <div className="choice-t mono">{tr.t}</div>
                      <div className="choice-d">{tr.d}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="field">
                <label className="field-label">{data.transport === "stdio" ? "Command" : "Endpoint URL"} <span className="req-star">*</span></label>
                <input className="input mono" placeholder={data.transport === "stdio" ? "npx -y @org/server" : "https://api.example.com/mcp"} value={data.endpoint} onChange={(e) => set({ endpoint: e.target.value })} />
              </div>
              <div className="field">
                <label className="field-label">Authentication</label>
                <select className="input" style={{ appearance: "auto" }} value={data.auth} onChange={(e) => set({ auth: e.target.value })}>
                  {["OAuth 2.1", "API key", "Bot token", "Connection string", "None"].map((a) => <option key={a}>{a}</option>)}
                </select>
                <div className="field-hint">Credentials are stored at the server boundary and never exposed to the agent.</div>
              </div>
              <div className="field">
                <label className="field-label">Repository</label>
                <input className="input mono" placeholder="github.com/org/repo" value={data.repo} onChange={(e) => set({ repo: e.target.value })} />
              </div>
            </div>
          )}

          {step === 2 && isSkill && (
            <div className="fade-up">
              <h2 className="h2" style={{ marginBottom: 20 }}>Knowledge</h2>
              <div className="field">
                <label className="field-label">Trigger phrases <span className="req-star">*</span></label>
                <textarea className="textarea" placeholder={"One per line:\nreview this PR\ncode review\nlook over my changes"} value={data.triggers} onChange={(e) => set({ triggers: e.target.value })} />
                <div className="field-hint">The agent loads the full skill only when a task matches one of these — progressive disclosure.</div>
              </div>
              <div className="field">
                <label className="field-label">SKILL.md</label>
                <textarea className="textarea mono" style={{ minHeight: 160, fontSize: 13 }} placeholder={"---\nname: ...\ndescription: ...\n---\n\n# Steps\n1. ..."} />
                <div className="field-hint">Markdown with YAML frontmatter. Keep it lean — it counts against the agent's context.</div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="fade-up">
              <h2 className="h2" style={{ marginBottom: 6 }}>Governance</h2>
              <p className="field-hint" style={{ marginBottom: 20 }}>{isSkill ? "Skills carry no credentials, but you still control who can load them." : isTool ? "A tool inherits its server's credentials, so control exactly when it becomes callable." : isAgent ? "An agent is only as powerful as the autonomy you grant it." : isApi ? "A raw API can't be governed directly — that's what wrapping it as a server is for." : "Control the blast radius before this server reaches any agent."}</p>
              {isAgent && (
                <div className="field">
                  <label className="field-label">Autonomy policy</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {[
                      { id: "read-only", t: "Read-only", d: "Drafts and reads. Never takes a mutating action." },
                      { id: "approval", t: "Asks approval", d: "Proposes actions; a human confirms before anything runs." },
                      { id: "autonomous", t: "Autonomous", d: "Acts on its own within its granted scope." },
                    ].map((a) => (
                      <button key={a.id} type="button" className={`choice ${data.autonomy === a.id ? "on" : ""}`} style={{ display: "flex", alignItems: "center", gap: 12, textAlign: "left" }} onClick={() => set({ autonomy: a.id })}>
                        <span className={`radio-dot ${data.autonomy === a.id ? "on" : ""}`} />
                        <div><div className="choice-t" style={{ fontSize: 14 }}>{a.t}</div><div className="choice-d" style={{ marginTop: 2 }}>{a.d}</div></div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {!isSkill && !isTool && !isAgent && !isApi && (
                <>
                  <div className="toggle-row">
                    <div className="tr-text"><div className="tr-t">Read-only by default</div><div className="tr-d">Write tools are disabled until an admin enables them.</div></div>
                    <div className={`switch ${data.readOnly ? "on" : ""}`} onClick={() => set({ readOnly: !data.readOnly })} />
                  </div>
                  <div className="toggle-row">
                    <div className="tr-text"><div className="tr-t">Require approval per tool</div><div className="tr-d">Each tool must be individually allowlisted into a virtual server.</div></div>
                    <div className={`switch ${data.requireApproval ? "on" : ""}`} onClick={() => set({ requireApproval: !data.requireApproval })} />
                  </div>
                </>
              )}
              {isTool && (
                <div className="toggle-row">
                  <div className="tr-text"><div className="tr-t">Require approval before exposing</div><div className="tr-d">The tool stays out of every virtual server until an admin allowlists it.</div></div>
                  <div className={`switch ${data.requireApproval ? "on" : ""}`} onClick={() => set({ requireApproval: !data.requireApproval })} />
                </div>
              )}
              <div className="toggle-row">
                <div className="tr-text"><div className="tr-t">Internal only</div><div className="tr-d">Hidden from the public registry — visible to your org alone.</div></div>
                <div className={`switch ${data.internalOnly ? "on" : ""}`} onClick={() => set({ internalOnly: !data.internalOnly })} />
              </div>
              <div className="callout accent" style={{ marginTop: 16 }}>
                <Icon name="shield" size={16} />
                <div>{isSkill ? "Skills are read by the agent, so the worst case is bad advice, not a bad action. Still, review the steps for prompt-injection risks." : isTool && data.isWrite ? "This is a write tool. Under least privilege it stays behind an allowlist until an admin opts in." : isAgent ? "An agent only ever sees the tools an admin has exposed to it through a virtual server — its autonomy is capped by that scope." : isApi ? "Cataloguing an API doesn't expose it to agents. Wrap it as an MCP server to give least-privilege, credential-free access." : "Least privilege is the default. An agent only ever sees the tools an admin explicitly exposes."}</div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="fade-up">
              <h2 className="h2" style={{ marginBottom: 20 }}>Review & submit</h2>
              <div className="summary-card" style={{ marginBottom: 18 }}>
                <div className="summary-row"><span className="summary-k">Type</span><span className="summary-v" style={{ textTransform: "capitalize" }}>{data.kind}</span></div>
                <div className="summary-row"><span className="summary-k">Name</span><span className="summary-v">{data.name || "—"}</span></div>
                <div className="summary-row"><span className="summary-k">Slug</span><span className="summary-v mono">{data.slug || "—"}</span></div>
                <div className="summary-row"><span className="summary-k">Category</span><span className="summary-v">{data.category}</span></div>
                <div className="summary-row"><span className="summary-k">Summary</span><span className="summary-v">{data.summary || "—"}</span></div>
                {isAgent ? (
                  <>
                    <div className="summary-row"><span className="summary-k">Model</span><span className="summary-v">{data.agentModel}</span></div>
                    <div className="summary-row"><span className="summary-k">Servers</span><span className="summary-v">{data.agentServers.length || "none"}</span></div>
                    <div className="summary-row"><span className="summary-k">Skills</span><span className="summary-v">{data.agentSkills.length || "none"}</span></div>
                    <div className="summary-row"><span className="summary-k">Autonomy</span><span className="summary-v" style={{ textTransform: "capitalize" }}>{data.autonomy.replace("-", " ")}</span></div>
                  </>
                ) : isApi ? (
                  <>
                    <div className="summary-row"><span className="summary-k">Style</span><span className="summary-v">{data.apiStyle}</span></div>
                    <div className="summary-row"><span className="summary-k">Base URL</span><span className="summary-v mono" style={{ wordBreak: "break-all" }}>{data.baseUrl || "—"}</span></div>
                    <div className="summary-row"><span className="summary-k">Auth</span><span className="summary-v">{data.apiAuth}</span></div>
                    <div className="summary-row"><span className="summary-k">Endpoints</span><span className="summary-v">{data.endpoints.filter((e) => e.path).length || "none"}</span></div>
                  </>
                ) : !isSkill && !isTool ? (
                  <>
                    <div className="summary-row"><span className="summary-k">Transport</span><span className="summary-v"><Transport t={data.transport} /></span></div>
                    <div className="summary-row"><span className="summary-k">Endpoint</span><span className="summary-v mono" style={{ wordBreak: "break-all" }}>{data.endpoint || "—"}</span></div>
                    <div className="summary-row"><span className="summary-k">Auth</span><span className="summary-v">{data.auth}</span></div>
                    <div className="summary-row"><span className="summary-k">Access</span><span className="summary-v">{data.readOnly ? "Read-only" : "Read-write"}{data.internalOnly ? " · Internal" : ""}</span></div>
                  </>
                ) : isTool ? (
                  <>
                    <div className="summary-row"><span className="summary-k">Parent server</span><span className="summary-v">{(SERVERS.find((s) => s.id === data.parentServer) || {}).name || "—"}</span></div>
                    <div className="summary-row"><span className="summary-k">Parameters</span><span className="summary-v">{data.params.filter((p) => p.name).length || "none"}</span></div>
                    <div className="summary-row"><span className="summary-k">Returns</span><span className="summary-v mono">{data.returns || "—"}</span></div>
                    <div className="summary-row"><span className="summary-k">Kind</span><span className="summary-v">{data.isWrite ? <Badge tone="warn">Write tool</Badge> : <Badge tone="ok">Read-only</Badge>}</span></div>
                  </>
                ) : (
                  <div className="summary-row"><span className="summary-k">Triggers</span><span className="summary-v">{data.triggers.split("\n").filter(Boolean).length} phrase(s)</span></div>
                )}
              </div>
              <div className="callout"><Icon name="flag" size={15} /><div>By submitting you confirm you have the right to publish this entry and that it follows the registry's content policy.</div></div>
            </div>
          )}

          <div className="wizard-foot">
            {step > 0 && <Button variant="ghost" icon="arrowLeft" onClick={() => setStep(step - 1)}>Back</Button>}
            <div className="spacer" />
            {step < STEPS.length - 1 ? (
              <Button variant="primary" iconRight="arrowRight" disabled={!canNext()} onClick={() => setStep(step + 1)}>Continue</Button>
            ) : (
              <Button variant="accent" icon="check" onClick={() => setDone(true)}>Submit for review</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { RegisterPage });
