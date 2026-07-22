import type { Metadata } from 'next';
import { Inspector } from 'react-dev-inspector';
import './globals.css';

export const metadata: Metadata = {
  title: '视频素材处理工具',
  description:
    '自动分析拍摄视频，节选精华片段，预处理调色后输出到素材库。支持产品空镜、生产线空镜、人物空镜、环境空镜等多种场景。',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.COZE_PROJECT_ENV === 'DEV';

  return (
    <html lang="zh-CN" className="dark">
      <body className="antialiased bg-zinc-950 text-zinc-100">
        {isDev && <Inspector />}
        {children}
      </body>
    </html>
  );
}
