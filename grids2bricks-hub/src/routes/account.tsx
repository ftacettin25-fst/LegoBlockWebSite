import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Package, LogOut } from "lucide-react";

import { SiteLayout } from "@/components/site/layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { formatPrice } from "@/lib/cart";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "My account — Grids2Bricks" },
      { name: "description", content: "View your saved BrickHeadz designs and order history." },
      { property: "og:title", content: "My account — Grids2Bricks" },
      { property: "og:description", content: "Your saved designs and orders." },
    ],
  }),
  component: AccountPage,
});

interface OrderRow {
  id: string;
  status: string;
  total_cents: number;
  created_at: string;
}

interface DesignRow {
  id: string;
  name: string | null;
  customization: Record<string, unknown>;
  created_at: string;
}

function AccountPage() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [designs, setDesigns] = useState<DesignRow[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      setFetching(true);

      const ordersQ = query(
        collection(db, "orders"),
        where("user_id", "==", user.uid),
        orderBy("created_at", "desc"),
      );
      // The user wants 'saved model data' too, which previously was in 'brickheadz_designs'
      // We will assume they also have a 'designs' collection if they choose to save.
      const designsQ = query(
        collection(db, "brickheadz_designs"),
        where("user_id", "==", user.uid),
        orderBy("created_at", "desc"),
      );

      const [ordersSn, designsSn] = await Promise.all([
        getDocs(ordersQ).catch(() => ({ docs: [] })),
        getDocs(designsQ).catch(() => ({ docs: [] })),
      ]);

      if (!active) return;

      setOrders(ordersSn.docs.map((d) => ({ id: d.id, ...d.data() }) as OrderRow));
      setDesigns(designsSn.docs.map((d) => ({ id: d.id, ...d.data() }) as DesignRow));
      setFetching(false);
    })();
    return () => {
      active = false;
    };
  }, [user]);

  if (loading || !user) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-3xl px-4 py-20 text-center text-muted-foreground">
          Loading…
        </div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">My account</h1>
            <p className="mt-2 text-sm text-muted-foreground">{user.email}</p>
          </div>
          <Button variant="outline" onClick={() => signOut()}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Card className="p-6">
            <h2 className="text-lg font-bold">Saved designs</h2>
            {fetching ? (
              <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
            ) : designs.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                No designs yet.{" "}
                <Link to="/create" className="font-semibold text-primary hover:underline">
                  Create one →
                </Link>
              </div>
            ) : (
              <ul className="mt-4 divide-y">
                {designs.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 py-3">
                    <div
                      className="h-10 w-10 rounded-lg shadow-soft"
                      style={{
                        backgroundColor:
                          (d.customization as { colorHex?: string }).colorHex ?? "#460050",
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{d.name ?? "Untitled"}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(d.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-bold">Order history</h2>
            {fetching ? (
              <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
            ) : orders.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                No orders yet.{" "}
                <Link to="/order" className="font-semibold text-primary hover:underline">
                  Go to cart →
                </Link>
              </div>
            ) : (
              <ul className="mt-4 divide-y">
                {orders.map((o) => (
                  <li key={o.id} className="flex items-center gap-3 py-3">
                    <div className="rounded-md bg-primary/10 p-2 text-primary">
                      <Package className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-mono text-xs text-muted-foreground">
                        {o.id.slice(0, 8)}…
                      </div>
                      <div className="text-sm font-semibold capitalize">
                        {o.status.replace("_", " ")}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{formatPrice(o.total_cents)}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(o.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </SiteLayout>
  );
}
