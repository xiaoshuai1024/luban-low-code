interface BuildPreviewUrlOptions {
  slug?: string;
  baseUrl?: string;
  path?: string;
}

function normalizePath(path?: string): string {
  if (!path) return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

export function buildPublishedPagePreviewUrl({
  slug,
  baseUrl,
  path,
}: BuildPreviewUrlOptions): string | null {
  const safePath = normalizePath(path);

  if (baseUrl) {
    try {
      const url = new URL(baseUrl);
      url.pathname = safePath;
      return url.toString();
    } catch {
      // ignore invalid baseUrl and fallback to slug route
    }
  }

  if (!slug) return null;
  return `/api/public/sites/${encodeURIComponent(slug)}/pages?path=${encodeURIComponent(safePath)}`;
}
