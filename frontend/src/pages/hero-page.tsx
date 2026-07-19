import { Link } from "react-router-dom"

export default function HeroPage() {
  return (
    <div style={styles.page}>
      <div style={styles.bgGlowTop} />
      <div style={styles.bgGlowBottom} />
      <div style={styles.grid} />

      <nav style={styles.nav}>
        <div style={styles.navBrand}>
          <span style={styles.navBrandMark}>{"</>"}</span>
          <span style={styles.navBrandText}>CAP</span>
        </div>
        <div style={styles.navLinks}>
          <Link to="/login" style={styles.navLink}>
            Login
          </Link>
          <Link to="/register" style={{ ...styles.navLink, ...styles.navLinkOutline }}>
            Register
          </Link>
        </div>
      </nav>

      <main style={styles.hero}>
        <div style={styles.heroLeft}>
          <div style={styles.eyebrow}>
            <span style={styles.eyebrowDot} />
            coding_assessment_platform
          </div>

          <h1 style={styles.title}>
            Ship code.
            <br />
            <span style={styles.titleAccent}>Prove it works.</span>
          </h1>

          <p style={styles.sub}>
            Real environments, real test suites, real signal. Run technical
            assessments that actually tell you who can build the thing —
            graded automatically, the moment the last test finishes.
          </p>

          <div style={styles.btnGroup}>
            <Link to="/register" style={{ ...styles.btn, ...styles.btnPrimary }}>
              Get started <span style={styles.btnArrow}>&rarr;</span>
            </Link>
            <Link to="/login" style={{ ...styles.btn, ...styles.btnOutline }}>
              Login
            </Link>
          </div>

          <div style={styles.statsRow}>
            <div style={styles.stat}>
              <div style={styles.statNumber}>40+</div>
              <div style={styles.statLabel}>languages</div>
            </div>
            <div style={styles.statDivider} />
            <div style={styles.stat}>
              <div style={styles.statNumber}>120k</div>
              <div style={styles.statLabel}>assessments run</div>
            </div>
            <div style={styles.statDivider} />
            <div style={styles.stat}>
              <div style={styles.statNumber}>&lt;2s</div>
              <div style={styles.statLabel}>avg. grading time</div>
            </div>
          </div>
        </div>

        <div style={styles.heroRight}>
          <div style={styles.codeWindow}>
            <div style={styles.codeWindowHeader}>
              <div style={styles.codeDots}>
                <span style={{ ...styles.dot, background: "#F2555A" }} />
                <span style={{ ...styles.dot, background: "#F2B84B" }} />
                <span style={{ ...styles.dot, background: "#3ED98A" }} />
              </div>
              <span style={styles.codeFileName}>solution.ts</span>
            </div>
            <div style={styles.codeBody}>
              <div style={styles.codeLine}>
                <span style={styles.lineNum}>1</span>
                <span style={styles.kw}>function</span>{" "}
                <span style={styles.fn}>twoSum</span>(nums, target) {"{"}
              </div>
              <div style={styles.codeLine}>
                <span style={styles.lineNum}>2</span>
                &nbsp;&nbsp;<span style={styles.kw}>const</span> seen = <span style={styles.kw}>new</span> Map()
              </div>
              <div style={styles.codeLine}>
                <span style={styles.lineNum}>3</span>
                &nbsp;&nbsp;<span style={styles.kw}>for</span> (<span style={styles.kw}>let</span> i = 0; i &lt; nums.length; i++) {"{"}
              </div>
              <div style={styles.codeLine}>
                <span style={styles.lineNum}>4</span>
                &nbsp;&nbsp;&nbsp;&nbsp;<span style={styles.kw}>const</span> rest = target - nums[i]
              </div>
              <div style={styles.codeLine}>
                <span style={styles.lineNum}>5</span>
                &nbsp;&nbsp;&nbsp;&nbsp;<span style={styles.kw}>if</span> (seen.has(rest)) <span style={styles.kw}>return</span> [seen.get(rest), i]
              </div>
              <div style={styles.codeLine}>
                <span style={styles.lineNum}>6</span>
                &nbsp;&nbsp;&nbsp;&nbsp;seen.set(nums[i], i)
                <span style={styles.cursor} />
              </div>
              <div style={styles.codeLine}>
                <span style={styles.lineNum}>7</span>
                &nbsp;&nbsp;{"}"}
              </div>
              <div style={styles.codeLine}>
                <span style={styles.lineNum}>8</span>
                {"}"}
              </div>
            </div>
            <div style={styles.testBar}>
              <div style={styles.testBarLeft}>
                <span style={styles.testDotGlow} />
                4 / 4 tests passed
              </div>
              <span style={styles.testBarTime}>312ms</span>
            </div>
          </div>
        </div>
      </main>

      <section style={styles.features}>
        <div style={styles.featureCard}>
          <div style={styles.featureIcon}>⌘</div>
          <h3 style={styles.featureTitle}>Real environments</h3>
          <p style={styles.featureText}>
            Full containers, not toy sandboxes. Candidates write and run code
            the same way they would on the job.
          </p>
        </div>
        <div style={styles.featureCard}>
          <div style={styles.featureIcon}>✓</div>
          <h3 style={styles.featureTitle}>Auto-graded tests</h3>
          <p style={styles.featureText}>
            Every submission runs against your test suite the instant it's
            in — no manual review queue, no waiting.
          </p>
        </div>
        <div style={styles.featureCard}>
          <div style={styles.featureIcon}>⚡</div>
          <h3 style={styles.featureTitle}>Instant feedback</h3>
          <p style={styles.featureText}>
            Pass/fail, edge cases, and runtime all land in seconds so
            candidates and reviewers never lose momentum.
          </p>
        </div>
      </section>

      <style>{`
        @keyframes blink {
          0%, 45% { opacity: 1; }
          50%, 95% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(62, 217, 138, 0.55); }
          50% { box-shadow: 0 0 0 6px rgba(62, 217, 138, 0); }
        }
        a[href="/register"]:hover {
          filter: brightness(1.08);
          transform: translateY(-1px);
        }
        a[href="/login"]:hover {
          border-color: #3ED9C4 !important;
          color: #3ED9C4 !important;
        }
      `}</style>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    position: "relative",
    minHeight: "100vh",
    backgroundColor: "#0B0E14",
    color: "#E7EAF0",
    fontFamily:
      "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    overflow: "hidden",
    paddingBottom: "4rem",
  },
  bgGlowTop: {
    position: "absolute",
    top: "-220px",
    left: "-120px",
    width: "560px",
    height: "560px",
    borderRadius: "50%",
    background:
      "radial-gradient(circle, rgba(62,217,196,0.16) 0%, rgba(62,217,196,0) 70%)",
    filter: "blur(10px)",
    pointerEvents: "none",
  },
  bgGlowBottom: {
    position: "absolute",
    top: "120px",
    right: "-200px",
    width: "620px",
    height: "620px",
    borderRadius: "50%",
    background:
      "radial-gradient(circle, rgba(124,111,240,0.18) 0%, rgba(124,111,240,0) 70%)",
    filter: "blur(10px)",
    pointerEvents: "none",
  },
  grid: {
    position: "absolute",
    inset: 0,
    backgroundImage:
      "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
    backgroundSize: "48px 48px",
    maskImage:
      "radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%)",
    pointerEvents: "none",
  },
  nav: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "1.75rem clamp(1.5rem, 6vw, 5rem)",
  },
  navBrand: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    fontFamily: "'JetBrains Mono', monospace",
    fontWeight: 700,
    fontSize: "1.1rem",
    letterSpacing: "0.03em",
  },
  navBrandMark: {
    color: "#3ED9C4",
  },
  navBrandText: {
    color: "#E7EAF0",
  },
  navLinks: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
  },
  navLink: {
    fontSize: "0.9rem",
    color: "#B5BCCB",
    textDecoration: "none",
    padding: "0.5rem 1rem",
    borderRadius: "6px",
    border: "1px solid transparent",
    transition: "all 0.15s ease",
  },
  navLinkOutline: {
    border: "1px solid #262C3B",
    color: "#E7EAF0",
  },
  hero: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "3rem",
    padding: "3rem clamp(1.5rem, 6vw, 5rem) 2rem",
    flexWrap: "wrap",
  },
  heroLeft: {
    flex: "1 1 460px",
    maxWidth: "620px",
  },
  eyebrow: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.5rem",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "0.8rem",
    color: "#3ED9C4",
    background: "rgba(62,217,196,0.08)",
    border: "1px solid rgba(62,217,196,0.25)",
    padding: "0.35rem 0.85rem",
    borderRadius: "999px",
    marginBottom: "1.5rem",
  },
  eyebrowDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: "#3ED9C4",
    boxShadow: "0 0 8px 2px rgba(62,217,196,0.7)",
  },
  title: {
    margin: "0 0 1.25rem 0",
    fontSize: "clamp(2.4rem, 5vw, 3.6rem)",
    fontWeight: 700,
    lineHeight: 1.08,
    letterSpacing: "-0.02em",
    color: "#F4F6FA",
  },
  titleAccent: {
    background: "linear-gradient(90deg, #3ED9C4 0%, #7C6FF0 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  sub: {
    margin: "0 0 2.25rem 0",
    fontSize: "1.05rem",
    lineHeight: 1.65,
    color: "#9AA2B5",
    maxWidth: "520px",
  },
  btnGroup: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.85rem",
    marginBottom: "2.75rem",
  },
  btn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.4rem",
    padding: "0.85rem 1.6rem",
    borderRadius: "8px",
    fontSize: "0.98rem",
    fontWeight: 600,
    textDecoration: "none",
    textAlign: "center",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  btnPrimary: {
    background: "linear-gradient(90deg, #3ED9C4 0%, #34B8E0 100%)",
    color: "#08110F",
    boxShadow: "0 0 24px rgba(62,217,196,0.35)",
  },
  btnArrow: {
    fontSize: "1rem",
  },
  btnOutline: {
    backgroundColor: "transparent",
    color: "#E7EAF0",
    border: "1px solid #262C3B",
  },
  statsRow: {
    display: "flex",
    alignItems: "center",
    gap: "1.5rem",
    flexWrap: "wrap",
  },
  stat: {
    display: "flex",
    flexDirection: "column",
  },
  statNumber: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "1.35rem",
    fontWeight: 700,
    color: "#F4F6FA",
  },
  statLabel: {
    fontSize: "0.78rem",
    color: "#767E90",
    marginTop: "0.15rem",
  },
  statDivider: {
    width: "1px",
    height: "32px",
    background: "#20263400",
    borderLeft: "1px solid #262C3B",
  },
  heroRight: {
    flex: "1 1 420px",
    display: "flex",
    justifyContent: "center",
  },
  codeWindow: {
    width: "100%",
    maxWidth: "460px",
    background: "#0F1420",
    border: "1px solid #232A3A",
    borderRadius: "12px",
    boxShadow:
      "0 20px 60px rgba(0,0,0,0.45), 0 0 40px rgba(62,217,196,0.08)",
    overflow: "hidden",
  },
  codeWindowHeader: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    padding: "0.7rem 1rem",
    borderBottom: "1px solid #1D2331",
    background: "#0C1119",
  },
  codeDots: {
    display: "flex",
    gap: "6px",
  },
  dot: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    display: "inline-block",
  },
  codeFileName: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "0.78rem",
    color: "#6B7385",
  },
  codeBody: {
    padding: "1.1rem 1.25rem",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "0.82rem",
    lineHeight: 1.9,
    color: "#C7CCDA",
  },
  codeLine: {
    whiteSpace: "pre",
  },
  lineNum: {
    display: "inline-block",
    width: "1.4rem",
    color: "#3A4155",
    userSelect: "none",
  },
  kw: {
    color: "#7C9CF0",
  },
  fn: {
    color: "#F2B84B",
  },
  cursor: {
    display: "inline-block",
    width: "6px",
    height: "1rem",
    background: "#3ED9C4",
    marginLeft: "2px",
    verticalAlign: "middle",
    animation: "blink 1.1s step-end infinite",
  },
  testBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0.7rem 1.25rem",
    borderTop: "1px solid #1D2331",
    background: "#0C1119",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "0.78rem",
    color: "#3ED98A",
  },
  testBarLeft: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  testDotGlow: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: "#3ED98A",
    animation: "pulseGlow 1.8s ease-out infinite",
  },
  testBarTime: {
    color: "#6B7385",
  },
  features: {
    position: "relative",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "1.25rem",
    padding: "2rem clamp(1.5rem, 6vw, 5rem) 0",
    maxWidth: "1200px",
    margin: "0 auto",
  },
  featureCard: {
    background: "#0F1420",
    border: "1px solid #1D2331",
    borderRadius: "12px",
    padding: "1.75rem",
  },
  featureIcon: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "36px",
    height: "36px",
    borderRadius: "8px",
    background: "rgba(62,217,196,0.1)",
    color: "#3ED9C4",
    fontSize: "1.1rem",
    marginBottom: "1rem",
  },
  featureTitle: {
    margin: "0 0 0.5rem 0",
    fontSize: "1.05rem",
    fontWeight: 600,
    color: "#F4F6FA",
  },
  featureText: {
    margin: 0,
    fontSize: "0.9rem",
    lineHeight: 1.6,
    color: "#8A93A6",
  },
}