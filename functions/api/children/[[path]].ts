import { notFound, parseBucketPath } from "@/utils/bucket";
import { can_access_path, get_allow_list } from "@/utils/auth";

export async function onRequestGet(context) {
  try {
    const [bucket, path] = parseBucketPath(context);
    const prefix = path && `${path}/`;
    if (!bucket || (prefix && prefix.startsWith("_$flaredrive$/"))) return notFound();

    // 1. 权限检查（路径级别）
    if (prefix && !can_access_path(context, prefix)) {
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
      // 根目录下隐藏系统文件夹
      folders = folders.filter((folder) => folder !== "_$flaredrive$/");
    }

    // 3. 获取用户的权限列表（用于细粒度过滤）
    const allowList = get_allow_list(context) || [];

    // 4. 如果 allowList 不是 "*"，则进行过滤（只显示允许的前缀）
    if (!allowList.includes("*") && allowList.length > 0) {
      if (!path) {
        // 根目录：过滤文件和文件夹
        objKeys = objKeys.filter((obj) =>
          allowList.some((allow) => obj.key.startsWith(allow))
        );
        folders = folders.filter((folder) =>
          allowList.some((allow) => folder.startsWith(allow))
        );
        // 确保 allowList 中声明的路径在 folders 中存在（即使 R2 中没有物理文件夹）
        for (const allow of allowList) {
          // 只添加非根路径且不以系统前缀开头的
          if (allow && allow !== "/" && !allow.startsWith("_$flaredrive$/")) {
            // 确保路径以 / 结尾，与 folders 格式一致
            const folderEntry = allow.endsWith("/") ? allow : allow + "/";
            if (!folders.includes(folderEntry)) {
              folders.push(folderEntry);
            }
          }
        }
      } else {
        // 子目录：只过滤文件（文件夹由前缀自然限制）
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
