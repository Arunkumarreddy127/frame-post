import { FolderOpen, Layers, Sparkles, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

type HomepageProps = {
  user: { username: string };
};

const shortcuts: {
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    to: "/create",
    label: "Create",
    description: "Generate images and videos.",
    icon: Sparkles,
  },
  {
    to: "/pages",
    label: "Pages",
    description: "Open or start a page workspace.",
    icon: Layers,
  },
  {
    to: "/library",
    label: "Library",
    description: "Browse your inputs and outputs.",
    icon: FolderOpen,
  },
];

export function Homepage({ user }: HomepageProps) {
  return (
    <section className="home-page">
      <div className="home-page-intro">
        <p className="eyebrow">Framepost home</p>
        <h1>Hello, {user.username}</h1>
        <p className="status">Where would you like to start?</p>
      </div>
      <ul className="home-shortcuts">
        {shortcuts.map(({ to, label, description, icon: Icon }) => (
          <li key={to}>
            <Link className="home-shortcut" to={to}>
              <span className="home-shortcut-icon">
                <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <strong>{label}</strong>
              <span>{description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
