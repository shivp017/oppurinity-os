"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Icon } from "./icons";

const navItems = [
  { icon: "grid", label: "Overview", href: "/" },
  { icon: "search", label: "Opportunity inbox", href: "/opportunities" },
  { icon: "spark", label: "Discovery & Agents", href: "/discovery" },
  { icon: "people", label: "Client pipeline", href: "/client-pipeline" },
  { icon: "briefcase", label: "Applications", href: "/applications" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <Link className="brand" href="/">
        <span className="brand-mark">O</span>
        <span>
          Opportunity<span className="brand-light">OS</span>
        </span>
      </Link>
      <nav>
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              className={isActive ? "nav-link active" : "nav-link"}
              href={item.href}
              key={item.label}
            >
              <Icon name={item.icon} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="sidebar-bottom">
        <Link className="nav-link" href="/profiles/revops">
          <Icon name="settings" />
          Profile settings
        </Link>
        <div className="user">
          <div className="avatar">SS</div>
          <span>
            <b>Shiv Singh</b>
            <small>Personal workspace</small>
          </span>
          <Icon name="chevron" />
        </div>
      </div>
    </aside>
  );
}
