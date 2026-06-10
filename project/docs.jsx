/* Docs section — three-pane documentation: sidebar nav · prose · on-this-page TOC. */

/* Inline markup: **bold**, `code`, [label](slug-or-#anchor) */
function parseInline(str, onNav) {
  const nodes = [];
  const re = /(\*\*([^*]+)\*\*)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)]+)\))/g;
  let last = 0, m, key = 0;
  while ((m = re.exec(str))) {
    if (m.index > last) nodes.push(str.slice(last, m.index));
    if (m[1]) nodes.push(<strong key={key++}>{m[2]}</strong>);
    else if (m[3]) nodes.push(<code key={key++} className="doc-icode">{m[4]}</code>);
    else if (m[5]) {
      const label = m[6], target = m[7];
      nodes.push(
        <a key={key++} className="doc-link" onClick={(e) => {
          e.preventDefault();
          if (target === "#browse") onNav({ view: "browse" });
          else if (target.startsWith("#")) onNav({ view: "docs", id: target.slice(1) });
          else onNav({ view: "docs", id: target });
        }}>{label}</a>
      );
    }
    last = m.index + m[0].length;
  }
  if (last < str.length) nodes.push(str.slice(last));
  return nodes;
}

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/* Block renderer */
function DocBlock({ b, onNav }) {
  switch (b.t) {
    case "lead":
      return <p className="doc-lead">{parseInline(b.v, onNav)}</p>;
    case "h2":
      return <h2 id={slugify(b.v)} className="doc-h2">{b.v}</h2>;
    case "h3":
      return <h3 className="doc-h3">{b.v}</h3>;
    case "p":
      return <p className="doc-p">{parseInline(b.v, onNav)}</p>;
    case "code":
      return <CodeBlock lang={b.lang}>{b.v}</CodeBlock>;
    case "callout":
      return (
        <div className={`callout ${b.tone === "accent" ? "accent" : ""} doc-callout`} data-tone={b.tone}>
          <Icon name={b.icon || "info"} size={16} />
          <div>{parseInline(b.v, onNav)}</div>
        </div>
      );
    case "list":
      return (
        <ul className="doc-list">
          {b.v.map((it, i) => <li key={i}>{parseInline(it, onNav)}</li>)}
        </ul>
      );
    case "steps":
      return (
        <ol className="doc-steps">
          {b.v.map((s, i) => (
            <li key={i}>
              <span className="doc-step-n">{i + 1}</span>
              <div><div className="doc-step-t">{parseInline(s.title, onNav)}</div><div className="doc-step-b">{parseInline(s.body, onNav)}</div></div>
            </li>
          ))}
        </ol>
      );
    case "cards":
      return (
        <div className="doc-cards">
          {b.v.map((c, i) => (
            <button key={i} className="doc-card" onClick={() => c.go && onNav({ view: "docs", id: c.go })}>
              <div className="doc-card-ic"><Icon name={c.icon} size={17} /></div>
              <div className="doc-card-t">{c.title}{c.go && <Icon name="arrowRight" size={14} />}</div>
              <div className="doc-card-b">{c.body}</div>
            </button>
          ))}
        </div>
      );
    case "keyval":
      return (
        <div className="doc-keyval">
          {b.v.map(([k, v], i) => (
            <div className="doc-kv-row" key={i}>
              <div className="doc-kv-k mono">{k}</div>
              <div className="doc-kv-v">{parseInline(v, onNav)}</div>
            </div>
          ))}
        </div>
      );
    case "table":
      return (
        <div className="doc-table-wrap">
          <table className="doc-table">
            <thead><tr>{b.head.map((h, i) => <th key={i} className={i === 0 ? "lead" : ""}>{h}</th>)}</tr></thead>
            <tbody>
              {b.rows.map((row, i) => (
                <tr key={i}>{row.map((cell, j) => j === 0 ? <th key={j} scope="row">{cell}</th> : <td key={j}>{parseInline(cell, onNav)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "divider":
      return <hr className="doc-divider" />;
    default:
      return null;
  }
}

/* On-this-page TOC with scroll spy */
function DocsToc({ headings, activeId }) {
  if (headings.length < 2) return null;
  return (
    <aside className="docs-toc">
      <div className="docs-toc-label">On this page</div>
      <nav>
        {headings.map((h) => (
          <a key={h.id} href={`#${h.id}`} className={`docs-toc-item ${activeId === h.id ? "on" : ""}`}
            onClick={(e) => { e.preventDefault(); document.getElementById(h.id)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>
            {h.label}
          </a>
        ))}
      </nav>
    </aside>
  );
}

function DocsPage({ route, onNav }) {
  const { NAV, ARTICLES } = window.DOCS;
  const id = route.id && ARTICLES[route.id] ? route.id : "overview";
  const article = ARTICLES[id];
  const headings = article.blocks.filter((b) => b.t === "h2").map((b) => ({ id: slugify(b.v), label: b.v }));
  const [activeId, setActiveId] = useState(headings[0] && headings[0].id);
  const contentRef = useRef(null);

  // reset + scroll top on article change
  useEffect(() => {
    setActiveId(headings[0] && headings[0].id);
    window.scrollTo(0, 0);
  }, [id]);

  // scroll spy
  useEffect(() => {
    const onScroll = () => {
      const hs = headings.map((h) => document.getElementById(h.id)).filter(Boolean);
      let cur = hs[0] && hs[0].id;
      for (const el of hs) {
        if (el.getBoundingClientRect().top <= 120) cur = el.id;
      }
      if (cur) setActiveId(cur);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [id]);

  // prev / next within flat order
  const flat = NAV.flatMap((g) => g.items);
  const idx = flat.findIndex((x) => x.id === id);
  const prev = flat[idx - 1], next = flat[idx + 1];

  return (
    <div className="docs-shell">
      {/* sidebar */}
      <aside className="docs-nav">
        <div className="docs-nav-inner">
          {NAV.map((g) => (
            <div className="docs-nav-group" key={g.group}>
              <div className="docs-nav-glabel">{g.group}</div>
              {g.items.map((it) => (
                <a key={it.id} className={`docs-nav-item ${it.id === id ? "on" : ""}`}
                  onClick={() => onNav({ view: "docs", id: it.id })}>{it.label}</a>
              ))}
            </div>
          ))}
        </div>
      </aside>

      {/* content */}
      <main className="docs-main" ref={contentRef}>
        <div className="docs-article fade-up" key={id}>
          <div className="docs-eyebrow">Documentation</div>
          <h1 className="docs-title">{article.title}</h1>
          <p className="docs-desc">{article.desc}</p>
          <div className="docs-meta">
            <span className="stat"><Icon name="clock" size={13} />{article.read} min read</span>
            <span className="stat"><Icon name="check" size={13} />Updated {fmtDate(article.updated)}</span>
          </div>
          <div className="docs-divider-full" />
          <div className="docs-body">
            {article.blocks.map((b, i) => <DocBlock key={i} b={b} onNav={onNav} />)}
          </div>

          <div className="docs-pager">
            {prev ? (
              <button className="docs-pager-btn" onClick={() => onNav({ view: "docs", id: prev.id })}>
                <Icon name="arrowLeft" size={15} />
                <div><div className="dp-dir">Previous</div><div className="dp-label">{prev.label}</div></div>
              </button>
            ) : <span />}
            {next ? (
              <button className="docs-pager-btn next" onClick={() => onNav({ view: "docs", id: next.id })}>
                <div><div className="dp-dir">Next</div><div className="dp-label">{next.label}</div></div>
                <Icon name="arrowRight" size={15} />
              </button>
            ) : <span />}
          </div>
        </div>
      </main>

      {/* toc */}
      <DocsToc headings={headings} activeId={activeId} />
    </div>
  );
}

function fmtDate(s) {
  try {
    return new Date(s + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch (e) { return s; }
}

Object.assign(window, { DocsPage });
