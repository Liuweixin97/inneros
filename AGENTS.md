<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## 本地验证约定

- 每次完成代码构建后，都要启动开发服务器。
- 启动成功后，必须把可访问的本地地址明确提供给用户，方便用户立即验证。
- 除非用户另有指定，使用项目现有的 `npm run dev` 命令和默认端口。
