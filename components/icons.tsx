export function Icon({ name }: { name: string }) {
  const icons: Record<string, string> = {
    grid: "▦", search: "⌕", spark: "✦", briefcase: "▣", people: "◎", chart: "↗", settings: "⚙", bell: "◌", plus: "+", arrow: "→", chevron: "›", check: "✓",
  };
  return <span aria-hidden="true">{icons[name] ?? "•"}</span>;
}
