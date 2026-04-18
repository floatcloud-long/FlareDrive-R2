import { notFound, parseBucketPath } from "@/utils/bucket";
import { can_access_path, get_allow_list } from "@/utils/auth";

export async function onRequestGet(context) {
  try {
    const [bucket, path] = parseBucketPath(context);
    const prefix = path ? `${path}/` : "";
    if (!bucket || (prefix && prefix.startsWith("_$flaredrive$/"))) return notFound();

    // 1. 权限检查（路径级别）
    if (!can_access_path(context, prefix)) {
      const headers = new Headers();
      headers.set("WWW-Authenticate", 'Basic realm="需要登录"');
      return new Response("没有读取权限", { status: 401, headers });
    }

    // 2. 列出对象和文件夹
    const objList = await bucket.list({
      prefix: prefix || "",
      delimiter: "/",
      include: ["httpMetadata", "customMetadata"],
    });
    let objKeys = objList.objects
      .filter((obj) => !obj.key.endsWith("/_$folder$"))
      .map((obj) => {
        const { key, size, uploaded, httpMetadata, customMetadata } = obj;
        return { key, size, uploaded, httpMetadata, customMetadata };
      });

    let folders = objList.delimitedPrefixes;
    if (!path) {
      folders = folders.filter((folder) => folder !== "_$flaredrive$/");
    }

    // 3. 获取用户的权限列表
    const allowList = get_allow_list(context) || [];

    // 4. 如果 allowList 不是 "*"，则进行过滤（包括空数组情况）
    if (!allowList.includes("*")) {
      if (!path) {
        objKeys = objKeys.filter((obj) =>
          allowList.some((allow) => obj.key.startsWith(allow))
        );
        folders = folders.filter((folder) =>
          allowList.some((allow) => folder.startsWith(allow))
        );
        for (const allow of allowList) {
          if (allow && allow !== "/" && !allow.startsWith("_$flaredrive$/")) {
            const folderEntry = allow.endsWith("/") ? allow : allow + "/";
            if (!folders.includes(folderEntry)) {
              folders.push(folderEntry);
            }
          }
        }
      } else {
        objKeys = objKeys.filter((obj) =>
          allowList.some((allow) => obj.key.startsWith(allow))
        );
      }
    }

    return new Response(JSON.stringify({ value: objKeys, folders }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(e.toString(), { status: 500 });
  }
}
