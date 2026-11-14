import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { UserInfo } from "./UserInfo";

type HeaderProps = {
  username: string;
  pageTitle: string;
  onLogout: () => Promise<void>;
  actions?: ReactNode;
};

export function Header({ username, pageTitle, onLogout, actions }: HeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header-inner">
        <LinkBrand />
        <div className="app-header-title">{pageTitle}</div>
        <div className="app-header-right">
          {actions}
          <UserInfo username={username} onLogout={onLogout} />
        </div>
      </div>
    </header>
  );
}

function LinkBrand() {
  return (
    <Link className="brand-mark" to="/home" aria-label="Framepost home">
      FRAMEPOST
    </Link>
  );
}
