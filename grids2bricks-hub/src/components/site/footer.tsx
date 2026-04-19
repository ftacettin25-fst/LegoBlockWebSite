import { Link } from "@tanstack/react-router";
import { Mail, Instagram, Twitter } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-24 border-t bg-surface">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-4 lg:px-8">
        <div>
          <div className="flex items-center gap-1 text-xl font-extrabold tracking-tight">
            <span>Grids</span>
            <span className="text-primary">2</span>
            <span>Bricks</span>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Turn your photos into custom BrickHeadz figurines. Designed by you, built brick by
            brick.
          </p>
        </div>
        <div>
          <h4 className="text-sm font-semibold">Explore</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link to="/create" className="hover:text-foreground">
                Create
              </Link>
            </li>
            <li>
              <Link to="/order" className="hover:text-foreground">
                Order
              </Link>
            </li>
            <li>
              <Link to="/" hash="faq" className="hover:text-foreground">
                FAQ
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold">Company</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link to="/" hash="team" className="hover:text-foreground">
                Team
              </Link>
            </li>
            <li>
              <Link to="/" hash="contact" className="hover:text-foreground">
                Contact
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold">Connect</h4>
          <div className="mt-3 flex items-center gap-3 text-muted-foreground">
            <a href="mailto:hello@grids2bricks.com" className="hover:text-foreground">
              <Mail className="h-5 w-5" />
            </a>
            <a href="#" aria-label="Instagram" className="hover:text-foreground">
              <Instagram className="h-5 w-5" />
            </a>
            <a href="#" aria-label="Twitter" className="hover:text-foreground">
              <Twitter className="h-5 w-5" />
            </a>
          </div>
        </div>
      </div>
      <div className="border-t">
        <div className="mx-auto max-w-7xl px-4 py-6 text-xs text-muted-foreground sm:px-6 lg:px-8">
          © {new Date().getFullYear()} Grids2Bricks. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
