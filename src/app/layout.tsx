// app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body style={{ background:'#fcfcfd', color:'#111' }}>
        {children}
      </body>
    </html>
  );
}
