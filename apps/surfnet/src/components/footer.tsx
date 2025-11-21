export default function Footer() {
  return (
    <footer className="border-t border-zinc-800 bg-black">
      <div className="mx-auto max-w-[1265px] px-6 py-8 lg:px-8">
        <p className="text-center text-sm text-zinc-500">
          © {new Date().getFullYear()} Txtx. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
