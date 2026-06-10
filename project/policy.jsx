/* Policy settings — the rules that drive the moderation queue. */

/* ---------- defaults ---------- */
const DEFAULT_POLICY = {
  // posture
  readOnlyDefault: true,
  perToolApproval: true,
  blockWriteUntilReview: true,
  quarantineHighRisk: true,
  // review & approval
  requireReview: true,
  autoApproveVerified: false,
  autoApproveSkills: false,
  twoApproversHighRisk: true,
  republishAfterDays: 90,
  // capabilities
  transports: { http: true, sse: true, stdio: false },
  auth: { "OAuth 2.1": true, "API key": true, "Bot token": true, "Connection string": true, None: false },
  // skills
  scanInjection: true,
  requireTriggers: true,
  tokenCap: true,
  // visibility
  defaultVisibility: "org",
};

const DEFAULT_RULES = [
  { id: "arbitrary-exec", name: "Arbitrary code execution", cond: "tool runs shell / eval", desc: "A tool can execute unbounded commands on the host. The single highest-blast-radius capability.", severity: "high", action: "block", enabled: true, flag: "Arbitrary code execution" },
  { id: "no-sandbox", name: "No sandbox declared", cond: "sandbox: none", desc: "Server performs writes or exec without declaring an isolation boundary.", severity: "high", action: "block", enabled: true, flag: "No sandbox declared" },
  { id: "write-default", name: "Write tools on by default", cond: "write && !readOnly", desc: "Mutating tools are exposed before an admin opts in. Least privilege wants these off until reviewed.", severity: "medium", action: "review", enabled: true, flag: "Write tools enabled by default" },
  { id: "broad-scope", name: "Broad scope request", cond: "scope ⊇ {file:read, admin:*}", desc: "Requests a wide credential scope rather than the minimum the tools need.", severity: "medium", action: "review", enabled: true, flag: "Requests file:read scope" },
  { id: "unverified-domain", name: "Unverified publisher domain", cond: "!domain ∈ allowlist", desc: "Publisher's domain isn't on the trusted allowlist and hasn't completed verification.", severity: "medium", action: "flag", enabled: true, flag: "New publisher — unverified domain" },
  { id: "destructive-verbs", name: "Destructive verbs, no confirm", cond: "name ~ /^(delete|drop|purge)_/", desc: "Tool names imply irreversible actions but declare no confirmation step.", severity: "high", action: "review", enabled: true, flag: "Destructive verbs, no confirm" },
  { id: "internal-visibility", name: "Internal-only not restricted", cond: "internal && visibility = public", desc: "An entry tagged internal is still publicly visible. Tighten before publish.", severity: "low", action: "flag", enabled: true, flag: "Internal only — restrict visibility" },
  { id: "injection", name: "Prompt-injection patterns in SKILL.md", cond: "skill body ~ injection heuristics", desc: "Skill text contains instructions that could hijack the agent (\"ignore previous\", tool-call coercion).", severity: "medium", action: "flag", enabled: true, flag: null },
];

const ACTION_OPTS = [
  { v: "flag", label: "Flag only" },
  { v: "review", label: "Require review" },
  { v: "block", label: "Block publish" },
  { v: "reject", label: "Auto-reject" },
];

const SEV_TONE = { high: "danger", medium: "warn", low: "default" };

const PRESETS = [
  {
    id: "strict", name: "Strict", icon: "shield",
    desc: "Lock everything down. Every entry is human-reviewed; nothing auto-approves.",
    values: { readOnlyDefault: true, perToolApproval: true, blockWriteUntilReview: true, quarantineHighRisk: true, requireReview: true, autoApproveVerified: false, autoApproveSkills: false, twoApproversHighRisk: true },
  },
  {
    id: "balanced", name: "Balanced", icon: "check",
    desc: "Least privilege by default, but trusted publishers and credential-free skills flow through.",
    values: { readOnlyDefault: true, perToolApproval: true, blockWriteUntilReview: true, quarantineHighRisk: true, requireReview: true, autoApproveVerified: true, autoApproveSkills: true, twoApproversHighRisk: false },
  },
  {
    id: "open", name: "Open", icon: "bolt",
    desc: "Optimize for velocity. Reviews are advisory; only high-risk submissions are held.",
    values: { readOnlyDefault: false, perToolApproval: false, blockWriteUntilReview: false, quarantineHighRisk: true, requireReview: false, autoApproveVerified: true, autoApproveSkills: true, twoApproversHighRisk: false },
  },
];

const SEED_DOMAINS = [
  { d: "anthropic.com", verified: true },
  { d: "stripe.com", verified: true },
  { d: "linear.app", verified: true },
  { d: "sentry.io", verified: true },
  { d: "acme.internal", verified: false },
];

/* ---------- small controls ---------- */
const Switch = ({ on, onChange }) => (
  <div className={`switch ${on ? "on" : ""}`} onClick={() => onChange(!on)} role="switch" aria-checked={on} />
);

const SetRow = ({ title, badge, desc, children }) => (
  <div className="set-row">
    <div className="set-text">
      <div className="set-t">{title}{badge}</div>
      {desc && <div className="set-d">{desc}</div>}
    </div>
    <div className="set-control">{children}</div>
  </div>
);

const PCard = ({ icon, title, desc, children }) => (
  <div className="pcard">
    <div className="pcard-head">
      <div className="pcard-title">{icon && <Icon name={icon} size={16} />}{title}</div>
      {desc && <div className="pcard-desc">{desc}</div>}
    </div>
    <div className="pcard-body">{children}</div>
  </div>
);

/* ---------- page ---------- */
function PolicyPage({ onNav }) {
  const [sec, setSec] = useState("posture");
  const [policy, setPolicy] = useState(DEFAULT_POLICY);
  const [rules, setRules] = useState(DEFAULT_RULES);
  const [domains, setDomains] = useState(SEED_DOMAINS);
  const [newDomain, setNewDomain] = useState("");
  const [snap, setSnap] = useState(() => JSON.stringify({ policy: DEFAULT_POLICY, rules: DEFAULT_RULES, domains: SEED_DOMAINS }));
  const [toast, setToast] = useState(null);

  const current = JSON.stringify({ policy, rules, domains });
  const dirty = current !== snap;

  const set = (patch) => setPolicy((p) => ({ ...p, ...patch }));

  const activePreset = PRESETS.find((pr) => Object.entries(pr.values).every(([k, v]) => policy[k] === v));

  const applyPreset = (pr) => set(pr.values);

  const save = () => {
    setSnap(current);
    setToast("Policy saved · applies to new submissions immediately");
    setTimeout(() => setToast(null), 2800);
  };
  const discard = () => {
    const s = JSON.parse(snap);
    setPolicy(s.policy); setRules(s.rules); setDomains(s.domains);
  };

  const setRule = (id, patch) => setRules((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  // queue connection
  const PENDING = window.REGISTRY.PENDING;
  const flagCount = (flag) => (flag ? PENDING.filter((p) => p.flags.includes(flag)).length : 0);
  const totalFlags = rules.filter((r) => r.enabled).reduce((n, r) => n + flagCount(r.flag), 0);
  const enabledRules = rules.filter((r) => r.enabled).length;

  const addDomain = () => {
    const d = newDomain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!d || domains.some((x) => x.d === d)) return;
    setDomains([...domains, { d, verified: false }]);
    setNewDomain("");
  };

  const NAV = [
    { id: "posture", label: "Default posture", icon: "shield" },
    { id: "review", label: "Review & approval", icon: "flag" },
    { id: "rules", label: "Risk rules", icon: "warning", count: enabledRules },
    { id: "publishers", label: "Publisher trust", icon: "verified", count: domains.length },
    { id: "capabilities", label: "Capabilities", icon: "server" },
    { id: "skills", label: "Skill policy", icon: "skill" },
  ];

  const PANE = {
    posture: { title: "Default posture", desc: "The baseline governance applied to every newly registered server before any human looks at it. Pick a preset or tune each control." },
    review: { title: "Review & approval", desc: "Who has to look at a submission, and when it can skip the queue." },
    rules: { title: "Risk rules", desc: "Conditions evaluated against every submission. Each produces a flag and an action — these are exactly what shows up in the moderation queue." },
    publishers: { title: "Publisher trust", desc: "Domains you trust. Entries from an allowlisted, verified domain can take the fast path; everything else is treated as unverified." },
    capabilities: { title: "Capabilities", desc: "Which transports and authentication methods are permitted on the registry at all." },
    skills: { title: "Skill policy", desc: "Skills carry no credentials, so the risk is bad advice, not a bad action — these checks guard against prompt-injection and context bloat." },
  };

  return (
    <div className="container page">
      <div className="crumbs">
        <a onClick={() => onNav({ view: "admin" })}>Admin</a>
        <Icon name="chevronRight" size={14} />
        <span style={{ color: "var(--ink)" }}>Policy settings</span>
      </div>

      <div className="page-head" style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div>
          <div className="eyebrow">Governance</div>
          <h1 className="h1">Policy settings</h1>
          <p className="lede">The rules that decide what reaches an agent. Set the default blast radius, the review bar, and the checks that auto-flag risky submissions.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>Posture</span>
          <Badge tone={activePreset ? "accent" : "default"}>{activePreset ? activePreset.name : "Custom"}</Badge>
        </div>
      </div>

      <div className="policy-layout">
        <div className="policy-nav">
          {NAV.map((n) => (
            <div key={n.id} className={`facet-item ${sec === n.id ? "on" : ""}`} onClick={() => setSec(n.id)}>
              <span className="fi-icon"><Icon name={n.icon} size={16} /></span>
              {n.label}
              {n.count != null && <span className="count">{n.count}</span>}
            </div>
          ))}
        </div>

        <div className="policy-pane">
          <div className="policy-pane-head fade-up" key={sec + "-head"}>
            <div className="policy-pane-title">{PANE[sec].title}</div>
            <div className="policy-pane-desc">{PANE[sec].desc}</div>
          </div>

          <div className="fade-up" key={sec}>
            {/* ---------------- POSTURE ---------------- */}
            {sec === "posture" && (
              <>
                <div style={{ marginBottom: 18 }}>
                  <div className="preset-grid">
                    {PRESETS.map((pr) => (
                      <button key={pr.id} className={`preset ${activePreset && activePreset.id === pr.id ? "on" : ""}`} onClick={() => applyPreset(pr)}>
                        <div className="preset-t"><Icon name={pr.icon} size={16} style={{ color: "var(--accent)" }} />{pr.name}</div>
                        <div className="preset-d">{pr.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <PCard icon="shield" title="Access defaults" desc="Applied to every server the moment it's registered.">
                  <SetRow title="Read-only by default" desc="Write tools stay disabled until an admin explicitly enables them.">
                    <Switch on={policy.readOnlyDefault} onChange={(v) => set({ readOnlyDefault: v })} />
                  </SetRow>
                  <SetRow title="Per-tool approval" desc="Each tool must be individually allowlisted into a virtual server before any caller sees it.">
                    <Switch on={policy.perToolApproval} onChange={(v) => set({ perToolApproval: v })} />
                  </SetRow>
                  <SetRow title="Block writes until reviewed" desc="Mutating tools are held even if the publisher shipped them enabled.">
                    <Switch on={policy.blockWriteUntilReview} onChange={(v) => set({ blockWriteUntilReview: v })} />
                  </SetRow>
                  <SetRow title="Quarantine high-risk submissions" desc="Anything a high-severity rule blocks is held out of the catalog entirely until cleared.">
                    <Switch on={policy.quarantineHighRisk} onChange={(v) => set({ quarantineHighRisk: v })} />
                  </SetRow>
                </PCard>
                <div className="callout accent" style={{ marginTop: 16 }}>
                  <Icon name="shield" size={16} />
                  <div>Least privilege is the registry's default. An agent only ever sees the tools an admin has explicitly exposed through a virtual server.</div>
                </div>
              </>
            )}

            {/* ---------------- REVIEW ---------------- */}
            {sec === "review" && (
              <>
                <PCard icon="flag" title="When review is required">
                  <SetRow title="Require review before publish" desc="Every submission lands in the moderation queue. Turn off only with auto-approve rules below.">
                    <Switch on={policy.requireReview} onChange={(v) => set({ requireReview: v })} />
                  </SetRow>
                  <SetRow title="Auto-approve verified publishers" badge={<Badge tone="ok">fast path</Badge>} desc="Servers from an allowlisted, verified domain skip the queue when no rule flags them.">
                    <Switch on={policy.autoApproveVerified} onChange={(v) => set({ autoApproveVerified: v })} />
                  </SetRow>
                  <SetRow title="Auto-approve skills" desc="Skills request no credentials, so they can publish without review unless a content rule flags them.">
                    <Switch on={policy.autoApproveSkills} onChange={(v) => set({ autoApproveSkills: v })} />
                  </SetRow>
                  <SetRow title="Two approvers for high risk" desc="High-severity submissions need a second admin to sign off before going live.">
                    <Switch on={policy.twoApproversHighRisk} onChange={(v) => set({ twoApproversHighRisk: v })} />
                  </SetRow>
                </PCard>
                <PCard icon="clock" title="Lifecycle">
                  <SetRow title="Re-verify after inactivity" desc="A published entry that goes untouched is re-queued for review past this window.">
                    <select className="select" style={{ appearance: "auto" }} value={policy.republishAfterDays} onChange={(e) => set({ republishAfterDays: +e.target.value })}>
                      {[30, 60, 90, 180, 365].map((d) => <option key={d} value={d}>{d} days</option>)}
                    </select>
                  </SetRow>
                  <SetRow title="Default visibility" desc="Where a new entry shows up before an admin widens it.">
                    <select className="select" style={{ appearance: "auto" }} value={policy.defaultVisibility} onChange={(e) => set({ defaultVisibility: e.target.value })}>
                      <option value="private">Private (publisher)</option>
                      <option value="org">Organization</option>
                      <option value="public">Public</option>
                    </select>
                  </SetRow>
                </PCard>
              </>
            )}

            {/* ---------------- RULES ---------------- */}
            {sec === "rules" && (
              <>
                <div className="callout" style={{ marginBottom: 16 }}>
                  <Icon name="warning" size={15} />
                  <div>Your enabled rules produced <b>{totalFlags} flag{totalFlags === 1 ? "" : "s"}</b> across the <b>{PENDING.length}</b> submissions currently in the queue. <a style={{ color: "var(--accent-ink)", cursor: "pointer", fontWeight: 600 }} onClick={() => onNav({ view: "admin" })}>Open queue →</a></div>
                </div>
                <PCard icon="warning" title="Automated checks" desc="Evaluated top to bottom on every submission. The most severe matched action wins.">
                  {rules.map((r) => {
                    const n = flagCount(r.flag);
                    return (
                      <div key={r.id} className={`rule-row ${r.enabled ? "" : "off"}`}>
                        <div className="rule-main">
                          <div className="rule-name">
                            {r.name}
                            <Badge tone={SEV_TONE[r.severity]}>{r.severity}</Badge>
                            <span className="rule-cond mono">{r.cond}</span>
                          </div>
                          <div className="rule-desc">{r.desc}</div>
                          {r.enabled && (
                            <div className={`rule-hint ${n === 0 ? "zero" : ""}`}>
                              <Icon name={n === 0 ? "check" : "flag"} size={13} />
                              {n === 0 ? "No matches in current queue" : `Flagged ${n} item${n === 1 ? "" : "s"} in queue`}
                            </div>
                          )}
                        </div>
                        <div className="rule-ctrls">
                          <select className="select select-sm" style={{ appearance: "auto" }} value={r.action} disabled={!r.enabled} onChange={(e) => setRule(r.id, { action: e.target.value })}>
                            {ACTION_OPTS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                          </select>
                          <Switch on={r.enabled} onChange={(v) => setRule(r.id, { enabled: v })} />
                        </div>
                      </div>
                    );
                  })}
                </PCard>
                <div style={{ marginTop: 12 }}>
                  <Button variant="secondary" size="sm" icon="plus" onClick={() => setRules([...rules, { id: "custom-" + Date.now(), name: "Custom rule", cond: "edit condition", desc: "Describe what this rule matches.", severity: "medium", action: "flag", enabled: true, flag: null }])}>Add custom rule</Button>
                </div>
              </>
            )}

            {/* ---------------- PUBLISHERS ---------------- */}
            {sec === "publishers" && (
              <>
                <PCard icon="verified" title="Allowlisted domains" desc="Publishers whose domain matches one of these are eligible for the verified badge and the auto-approve fast path.">
                  <div className="domain-row">
                    {domains.map((dm) => (
                      <span key={dm.d} className={`domain-chip ${dm.verified ? "verified" : ""}`}>
                        {dm.verified && <Icon name="verified" size={13} />}
                        {dm.d}
                        <button onClick={() => setDomains(domains.filter((x) => x.d !== dm.d))} title="Remove"><Icon name="close" size={13} /></button>
                      </span>
                    ))}
                    <span className="domain-add">
                      <input
                        value={newDomain}
                        placeholder="add domain…"
                        onChange={(e) => setNewDomain(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addDomain()}
                      />
                      <button disabled={!newDomain.trim()} onClick={addDomain}><Icon name="plus" size={13} /></button>
                    </span>
                  </div>
                </PCard>
                <PCard icon="shield" title="Verification">
                  <SetRow title="Require DNS verification" desc="A domain isn't trusted until the publisher proves control with a TXT record.">
                    <Switch on={true} onChange={() => {}} />
                  </SetRow>
                  <SetRow title="Show unverified publishers" desc="Community entries from unlisted domains still appear in browse, marked unverified.">
                    <Switch on={true} onChange={() => {}} />
                  </SetRow>
                </PCard>
                <div className="callout" style={{ marginTop: 16 }}>
                  <Icon name="verified" size={15} />
                  <div>The <b>unverified publisher domain</b> rule reads this list. {flagCount("New publisher — unverified domain")} submission in the queue currently trips it.</div>
                </div>
              </>
            )}

            {/* ---------------- CAPABILITIES ---------------- */}
            {sec === "capabilities" && (
              <>
                <PCard icon="server" title="Allowed transports" desc="The wire protocols a server may use. stdio runs a local subprocess and carries the most host risk.">
                  {[
                    { id: "http", label: "Streamable HTTP", d: "Remote endpoint over HTTP." },
                    { id: "sse", label: "Server-sent events", d: "Long-lived remote stream." },
                    { id: "stdio", label: "stdio (local subprocess)", d: "Runs a process on the host. Highest blast radius." },
                  ].map((tr) => (
                    <SetRow key={tr.id} title={<span className="mono" style={{ fontSize: 13.5 }}>{tr.label}</span>} desc={tr.d}>
                      <Switch on={policy.transports[tr.id]} onChange={(v) => set({ transports: { ...policy.transports, [tr.id]: v } })} />
                    </SetRow>
                  ))}
                </PCard>
                <PCard icon="shield" title="Allowed authentication" desc="Credential schemes a server may declare. Disallowing None blocks anonymous servers.">
                  {Object.keys(policy.auth).map((a) => (
                    <SetRow key={a} title={a} badge={a === "None" ? <Badge tone="warn">anonymous</Badge> : null}>
                      <Switch on={policy.auth[a]} onChange={(v) => set({ auth: { ...policy.auth, [a]: v } })} />
                    </SetRow>
                  ))}
                </PCard>
              </>
            )}

            {/* ---------------- SKILLS ---------------- */}
            {sec === "skills" && (
              <>
                <PCard icon="skill" title="Content checks" desc="Run on the SKILL.md body when a skill is submitted or updated.">
                  <SetRow title="Scan for prompt injection" badge={<Badge tone="ok">recommended</Badge>} desc="Heuristics flag instructions that try to override the agent or coerce tool calls.">
                    <Switch on={policy.scanInjection} onChange={(v) => set({ scanInjection: v })} />
                  </SetRow>
                  <SetRow title="Require trigger phrases" desc="A skill must declare the phrases that load it, so progressive disclosure works.">
                    <Switch on={policy.requireTriggers} onChange={(v) => set({ requireTriggers: v })} />
                  </SetRow>
                  <SetRow title="Enforce token budget" desc="Reject a SKILL.md that would consume more than the agent's per-skill context allowance.">
                    <Switch on={policy.tokenCap} onChange={(v) => set({ tokenCap: v })} />
                  </SetRow>
                </PCard>
                <div className="callout accent" style={{ marginTop: 16 }}>
                  <Icon name="skill" size={16} />
                  <div>A skill is read, not called. The worst case is bad advice, not a bad action — so these checks target the text itself, not credentials or scopes.</div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {dirty && (
        <div className="savebar fade-up">
          <span className="savebar-dot" />
          <span className="savebar-txt">Unsaved policy changes</span>
          <Button variant="ghost" size="sm" onClick={discard}>Discard</Button>
          <Button variant="accent" size="sm" icon="check" onClick={save}>Save policy</Button>
        </div>
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 95, background: "var(--ink)", color: "white", padding: "12px 18px", borderRadius: 11, boxShadow: "var(--shadow-lg)", display: "flex", alignItems: "center", gap: 10, fontSize: 14 }} className="fade-up">
          <Icon name="check" size={16} stroke={2.2} style={{ color: "#86efac" }} />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { PolicyPage });
