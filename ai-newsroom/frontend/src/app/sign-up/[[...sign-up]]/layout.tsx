export default function SignUpLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#08090b]">
      {children}
    </div>
  );
}
