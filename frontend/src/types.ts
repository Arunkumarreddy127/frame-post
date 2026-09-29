export type User = { username: string };

export type Page = {
  id: string;
  name: string;
  description: string;
  bio: string;
  createdAt: string;
  updatedAt: string;
};

export type PageFormState = {
  name: string;
  description: string;
  bio: string;
};

export type ShellRouteProps = {
  user: User;
  onLogout: () => Promise<void>;
};
