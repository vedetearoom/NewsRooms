"use client";

type V2NavbarProps = {
  accent?: string;
  onLogin?: () => void;
  onRegister?: () => void;
};

const navItems = [
  { label: "Product", href: "#discover" },
  { label: "Agents", href: "#agents" },
  { label: "Workflow", href: "#pipeline" },
  { label: "Pricing", href: "#cta" },
  { label: "Changelog", href: "#kanban" },
];

export function V2Navbar({ accent = "#ffffff", onLogin, onRegister }: V2NavbarProps) {
  return (
    <nav
      style={{
        position: "relative",
        zIndex: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "20px 40px",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: "radial-gradient(circle at 35% 30%, #666 0%, #1a1a1a 70%)",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: `0 0 18px ${accent}22`,
          }}
        />
        <span
          style={{
            fontSize: 14.5,
            fontWeight: 600,
            color: "white",
            letterSpacing: "-0.02em",
          }}
        >
          Newsroom
        </span>
        <span
          style={{
            marginLeft: 8,
            fontSize: 10,
            color: "rgba(255,255,255,0.3)",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 4,
            padding: "2px 6px",
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          v2.4
        </span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 28,
          fontSize: 13,
          color: "rgba(255,255,255,0.5)",
          letterSpacing: "-0.005em",
        }}
      >
        {navItems.map((item) => (
          <a
            key={item.label}
            href={item.href}
            style={{ color: "inherit", textDecoration: "none", cursor: "pointer" }}
          >
            {item.label}
          </a>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button
          type="button"
          onClick={onLogin}
          style={{
            background: "transparent",
            border: "none",
            fontSize: 13,
            color: "rgba(255,255,255,0.55)",
            cursor: "pointer",
            letterSpacing: "-0.005em",
          }}
        >
          Log in
        </button>
        <button
          type="button"
          onClick={onRegister}
          style={{
            background: "white",
            color: "#08090b",
            fontSize: 13,
            fontWeight: 600,
            padding: "7px 14px",
            borderRadius: 7,
            border: "none",
            cursor: "pointer",
            letterSpacing: "-0.005em",
          }}
        >
          Get access &rarr;
        </button>
      </div>
    </nav>
  );
}
