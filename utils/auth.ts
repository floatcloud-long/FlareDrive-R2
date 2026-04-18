const THUMBNAIL_PREFIX = "_$flaredrive$/thumbnails/";

function parseAllowList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function matchesAllowList(targetPath: string, allowList: string[]): boolean {
  if (allowList.includes("*")) return true;
  return allowList.some((allow) => targetPath.startsWith(allow));
}

function getAllowListForRequest(context: any): string[] | null {
  const headers = new Headers(context.request.headers);
  const authorization = headers.get("Authorization");

  // 1. Basic 认证
  if (authorization && authorization.startsWith("Basic ")) {
    const base64 = authorization.split(" ")[1];
    try {
      const credentials = atob(base64); // "username:password"
      const colonIndex = credentials.indexOf(":");
      if (colonIndex !== -1) {
        const username = credentials.substring(0, colonIndex);
        const password = credentials.substring(colonIndex + 1);
        const userEntry = context.env[username]; // 格式 "密码:权限列表"
        if (userEntry) {
          const firstColon = userEntry.indexOf(":");
          if (firstColon !== -1) {
            const storedPassword = userEntry.substring(0, firstColon);
            const allowListValue = userEntry.substring(firstColon + 1);
            if (password === storedPassword) {
              return parseAllowList(allowListValue);
            }
          }
        }
      }
    } catch (e) {
      console.error("Basic Auth decode error", e);
    }
  }

  // 2. 游客模式
  if (context.env["GUEST"]) {
    return parseAllowList(context.env["GUEST"]);
  }

  // 3. 无权限配置
  return null;
}

export function can_access_path(context: any, targetPath: string): boolean {
  if (targetPath.startsWith(THUMBNAIL_PREFIX)) return true;
  const allowlist = getAllowListForRequest(context);
  if (allowlist === null) return false;
  return matchesAllowList(targetPath, allowlist);
}

export function get_allow_list(context: any): string[] | null {
  return getAllowListForRequest(context);
}

export function get_auth_status(context: any): boolean {
  const dopath = context.request.url.split("/api/write/items/")[1];
  if (!dopath) return false;
  return can_access_path(context, dopath);
}
