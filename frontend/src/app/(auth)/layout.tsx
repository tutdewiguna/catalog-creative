export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="w-full flex justify-center">
      {children}
    </main>
  );
}