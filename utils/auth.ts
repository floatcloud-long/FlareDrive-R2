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
  
  // 1. 首先检查是否有有效的授权
  if (authorization && authorization.startsWith("Basic ")) {
    try {
      const account = atob(authorization.split("Basic "));
      if (account && context.env[account]) {
        return parseAllowList(context.env[account]);
      }
      // 如果授权无效，继续检查 GUEST，而不是直接返回 false
    } catch (error) {
      // base64 解码失败，继续检查 GUEST
      console.error("Authorization decode error:", error);
    }
  }
  
  // 2. 检查 GUEST 配置
  if (context.env["GUEST"]) {
    return parseAllowList(context.env["GUEST"]);
  }
  
  // 3. 都没有则返回 null
  return null;
}

export function can_access_path(context, targetPath) {
  // 缩略图路径无条件放行
  if (targetPath.startsWith(THUMBNAIL_PREFIX)) return true;
  
  const allowList = getAllowListForRequest(context);
  if (!allowList) return false;
  
  return matchesAllowList(targetPath, allowList);
}

export function get_allow_list(context) {
  return getAllowListForRequest(context);
}

export function get_auth_status(context) {
  // 使用更健壮的路径提取方法
  const url = new URL(context.request.url);
  const pathname = url.pathname;
  
  // 提取 /api/write/items/ 之后的路径部分
  const prefix = "/api/write/items/";
  if (!pathname.startsWith(prefix)) {
    return false;
  }
  
  const dopath = pathname.slice(prefix.length);
  if (!dopath) return false;
  
  return can_access_path(context, dopath);
}
