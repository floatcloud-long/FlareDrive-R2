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

  console.log("Authorization header:", authorization ? "present" : "missing");

  if (authorization && authorization.startsWith("Basic ")) {
    const base64 = authorization.split(" ")[1];
    try {
      const credentials = atob(base64);
      console.log("Decoded credentials:", credentials);
      const colonIndex = credentials.indexOf(":");
      if (colonIndex !== -1) {
        const username = credentials.substring(0, colonIndex);
        const password = credentials.substring(colonIndex + 1);
        console.log("Username:", username, "Password:", password);
        const userEntry = context.env[username];
        console.log(`Env entry for ${username}:`, userEntry);
        if (userEntry) {
          const firstColon = userEntry.indexOf(":");
          if (firstColon !== -1) {
            const storedPassword = userEntry.substring(0, firstColon);
            const allowListValue = userEntry.substring(firstColon + 1);
            console.log("Stored password:", storedPassword, "AllowList value:", allowListValue);
            if (password === storedPassword) {
              const parsed = parseAllowList(allowListValue);
              console.log("Authenticated, allowlist:", parsed);
              return parsed;
            } else {
              console.log("Password mismatch");
            }
          } else {
            console.log("No colon in userEntry, format invalid");
          }
        } else {
          console.log(`No env variable found for username: ${username}`);
        }
      } else {
        console.log("No colon in credentials");
      }
    } catch (e) {
      console.error("Basic Auth decode error", e);
    }
  } else {
    console.log("No Basic Auth header");
  }

  // 游客模式
  if (context.env["GUEST"]) {
    const guestList = parseAllowList(context.env["GUEST"]);
    console.log("Using GUEST mode, allowlist:", guestList);
    return guestList;
  }

  console.log("No allowlist, returning null");
  return null;
}

export function can_access_path(context: any, targetPath: string): boolean {
  if (targetPath.startsWith(THUMBNAIL_PREFIX)) {
    console.log("Thumbnail path, allowing");
    return true;
  }
  const allowlist = getAllowListForRequest(context);
  if (allowlist === null) {
    console.log("allowlist is null, denying");
    return false;
  }
  const result = matchesAllowList(targetPath, allowlist);
  console.log(`Path ${targetPath} matches allowlist ${allowlist}? ${result}`);
  return result;
}

export function get_allow_list(context: any): string[] | null {
  return getAllowListForRequest(context);
}

export function get_auth_status(context: any): boolean {
  const dopath = context.request.url.split("/api/write/items/")[1];
  if (!dopath) return false;
  return can_access_path(context, dopath);
}
