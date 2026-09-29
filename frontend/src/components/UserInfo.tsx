type UserInfoProps = {
  username: string;
  onLogout: () => Promise<void>;
};

export function UserInfo({ username, onLogout }: UserInfoProps) {
  return (
    <div className="user-info">
      <div>
        <span className="user-info-label">User Info</span>
        <strong>{username}</strong>
      </div>
      <button
        className="user-logout"
        type="button"
        onClick={() => void onLogout()}
      >
        Log out
      </button>
    </div>
  );
}
