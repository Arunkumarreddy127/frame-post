import { Link } from "react-router-dom";
import { UserInfo } from "./UserInfo";

type HeaderProps = {
  username: string;
  pageTitle: string;
  onLogout: () => Promise<void>;
};

export function Header({ username, pageTitle, onLogout }: HeaderProps) {
  return (
    <header className="app-header">
      <LinkBrand />
      <div className="app-header-title">{pageTitle}</div>
      <UserInfo username={username} onLogout={onLogout} />
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
