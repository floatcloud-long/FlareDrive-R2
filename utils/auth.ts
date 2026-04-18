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

function getAllowListForRequest(context) {
  const headers = new Headers(context.request.headers);
  const authorization = headers.get("Authorization");
  if (authorization && authorization.startsWith("Basic ")) {
    const base64 = authorization.split(" ")[1];
    const decoded = atob(base64);
    const colonIndex = decoded.indexOf(":");
    if (colonIndex !== -1) {
      const username = decoded.substring(0, colonIndex);
      // 假设环境变量中存储的是对应用户的权限列表，如 context.env[username] = "*,/private"
      if (username && context.env[username]) {
        return parseAllowList(context.env[username]);
      }
    }
  }
  if (context.env["GUEST"]) {
    return parseAllowList(context.env["GUEST"]);
  }
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
