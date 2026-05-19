import api from "services/api";

const API_ROOT = String(api.defaults.baseURL || "").replace(
  /\/api\/v1\/?$/,
  "",
);

export function resolveImageUrl(image?: string | null) {
  if (!image) return undefined;
  const trimmed = String(image).trim();
  if (!trimmed) return undefined;
  if (/^\/\//.test(trimmed)) return `https:${trimmed}`;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (!API_ROOT) return trimmed;
  return `${API_ROOT}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
}

function resolveAnyImage(value: any): string | undefined {
  if (typeof value === "string") return resolveImageUrl(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      const resolved = resolveAnyImage(item);
      if (resolved) return resolved;
    }
    return undefined;
  }

  if (value && typeof value === "object") {
    const direct =
      resolveImageUrl(value.url) ||
      resolveImageUrl(value.image_url) ||
      resolveImageUrl(value.image) ||
      resolveImageUrl(value.path) ||
      resolveImageUrl(value.secure_url) ||
      resolveImageUrl(value.src);
    if (direct) return direct;
  }

  return undefined;
}

export function pickImageUrl(entity: any, fields: string[]) {
  for (const key of fields) {
    const value = key.includes(".")
      ? key
          .split(".")
          .reduce<any>(
            (acc, part) => (acc == null ? undefined : acc[part]),
            entity,
          )
      : entity?.[key];

    const resolved = resolveAnyImage(value);
    if (resolved) return resolved;
  }
  return undefined;
}
