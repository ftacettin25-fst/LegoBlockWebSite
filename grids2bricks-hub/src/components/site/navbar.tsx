import { Link, useRouter } from "@tanstack/react-router";
import { ShoppingCart, User as UserIcon, Menu, X, LogOut } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Navbar() {
  const { user, signOut } = useAuth();
  const { count } = useCart();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const links = [
    { to: "/", label: "Home" },
    { to: "/create", label: "Create" },
    { to: "/order", label: "Order" },
  ] as const;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl" style={{ backgroundColor: "var(--color-nav)" }}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-1 text-xl font-extrabold tracking-tight text-nav-foreground">
          <span>Grids</span>
          <span className="text-primary-glow">2</span>
          <span>Bricks</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="rounded-md px-3 py-2 text-sm font-medium text-nav-foreground/80 transition-smooth hover:bg-white/10 hover:text-nav-foreground"
              activeProps={{ className: "rounded-md px-3 py-2 text-sm font-semibold text-nav-foreground bg-white/10" }}
              activeOptions={{ exact: true }}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            to="/order"
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-nav-foreground/80 transition-smooth hover:bg-white/10 hover:text-nav-foreground"
            aria-label="Cart"
          >
            <ShoppingCart className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -top-1 -right-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-glow px-1 text-[10px] font-bold text-nav-foreground">
                {count}
              </span>
            )}
          </Link>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="inline-flex h-9 w-9 items-center justify-center rounded-md text-nav-foreground/80 transition-smooth hover:bg-white/10 hover:text-nav-foreground" aria-label="Account">
                  <UserIcon className="h-5 w-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => router.navigate({ to: "/account" })}>
                  My account
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.navigate({ to: "/order" })}>
                  Cart & orders
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()}>
                  <LogOut className="h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link to="/auth" className="hidden sm:inline-flex">
              <Button size="sm" variant="secondary" className="bg-white/10 text-nav-foreground hover:bg-white/20 border-0">
                Sign in
              </Button>
            </Link>
          )}

          <button
            className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-md text-nav-foreground/80 hover:bg-white/10"
            onClick={() => setOpen(!open)}
            aria-label="Menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-white/10 px-4 pb-4 pt-2">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-2.5 text-sm font-medium text-nav-foreground/90 hover:bg-white/10"
              activeProps={{ className: "block rounded-md px-3 py-2.5 text-sm font-semibold text-nav-foreground bg-white/10" }}
              activeOptions={{ exact: true }}
            >
              {l.label}
            </Link>
          ))}
          {!user && (
            <Link to="/auth" onClick={() => setOpen(false)} className="block rounded-md px-3 py-2.5 text-sm font-medium text-nav-foreground/90 hover:bg-white/10">
              Sign in
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
