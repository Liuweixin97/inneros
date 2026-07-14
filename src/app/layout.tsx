import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import MobileNav from "@/components/layout/MobileNav";
import ContextPanel from "@/components/layout/ContextPanel";
import ThemeInitializer from "@/components/layout/ThemeInitializer";
import { UserProvider } from "@/components/auth/UserProvider";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "InnerOS | 第二大脑工作台",
  description: "基于 LLM 的个人第二大脑笔记 Web 工作台，帮助你记录、回溯、理解自己、提炼方法论、转化行动。",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  return (
    <html lang="zh-CN">
      <body>
        <ThemeInitializer />
        <UserProvider user={user}>
          <div className="flex h-screen overflow-hidden">
            {/* Left Sidebar - Desktop only */}
            <Sidebar />

            {/* Main Content Area */}
            <main
              className="
                flex-1 flex flex-col
                min-w-0 h-screen overflow-hidden
                md:ml-[var(--sidebar-width)] has-[.auth-page]:md:ml-0
              "
            >
              <div className="flex-1 overflow-y-auto pb-16 md:pb-0 has-[.auth-page]:pb-0 has-[.no-parent-scroll]:overflow-hidden has-[.no-parent-scroll]:h-full has-[.no-parent-scroll]:pb-0 has-[.no-parent-scroll]:flex has-[.no-parent-scroll]:flex-col">
                {children}
              </div>
            </main>
          </div>

          <ContextPanel />

          {/* Mobile Bottom Nav */}
          <MobileNav />
        </UserProvider>
      </body>
    </html>
  );
}
