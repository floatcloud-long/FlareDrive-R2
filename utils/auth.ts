const THUMBNAIL_PREFIX = "_$flaredrive$/thumbnails/";

function parseAllowList(value) {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function matchesAllowList(targetPath, allowList) {
  if (allowList.includes("*")) return true;
  return allowList.some((allow) => targetPath.startsWith(allow));
}

function getAllowListForRequest(context: any): string[] | null {
  const headers = new Headers(context.request.headers);
  const authorization = headers.get("Authorization");

  // 1. 尝试 Basic Auth
  if (authorization && authorization.startsWith("Basic ")) {
    const base64 = authorization.split(" ")[1];
    try {
      const credentials = atob(base64); // 格式 "username:password"
      // 直接用完整的 "username:password" 作为键名去环境变量中查找
      const allowListValue = context.env[credentials];
      if (allowListValue !== undefined) {
        return parseAllowList(allowListValue);
      }
    } catch (e) {
      console.error("Basic Auth decode error", e);
    }
  }

  // 2. 游客模式（未提供 Authorization 或认证失败）
  if (context.env["GUEST"]) {
    return parseAllowList(context.env["GUEST"]);
  }

  // 3. 没有任何权限配置
  return null;
}

export function can_access_path(context, targetPath){
  if (targetPath.startsWith(THUMBNAIL_PREFIX)) return true;
  const allowlist = getAllowListForRequest(context);
  if (allowlist === null) return false;
  return matchesAllowlist(targetPath, allowlist);
}

export function get_allow_list(context) {
  return getAllowListForRequest(context);
}

export function get_auth_status(context) {
  const dopath = context.request.url.split("/api/write/items/")[1];
  if (!dopath) return false;
  return can_access_path(context, dopath);
}
