export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";

export function buildPageForm(page?: {
  name: string;
  description: string;
  bio: string;
}) {
  return {
    name: page?.name ?? "",
    description: page?.description ?? "",
    bio: page?.bio ?? "",
  };
}
