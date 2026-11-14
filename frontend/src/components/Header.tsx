import { Link } from "react-router-dom";
import { UserInfo } from "./UserInfo";

type HeaderProps = {
  username: string;
  pageTitle: string;
  chatOpen: boolean;
  onLogout: () => Promise<void>;
};

export function Header({ username, pageTitle, chatOpen, onLogout }: HeaderProps) {
  return (
    <header className="app-header">
      <div className={`app-header-inner${chatOpen ? " has-chat" : ""}`}>
        <LinkBrand />
        <div className="app-header-main">
          <div className="app-header-title">{pageTitle}</div>
          <div className="app-header-right">
            <UserInfo username={username} onLogout={onLogout} />
          </div>
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
