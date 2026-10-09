import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "메디맵 | 전국 의료기관·거래처 분석",
  description: "전국 약국·병의원의 지역별 분포와 동원약품그룹 거래처 커버리지",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
