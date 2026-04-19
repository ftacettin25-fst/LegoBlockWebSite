import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Trash2, Search, ShoppingBag, CheckCircle2, Plus, Minus, Package } from "lucide-react";
import { toast } from "sonner";

import { SiteLayout } from "@/components/site/layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCart, formatPrice } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/order")({
  head: () => ({
    meta: [
      { title: "Order & Cart — Grids2Bricks" },
      { name: "description", content: "Review your custom BrickHeadz cart, check out, or look up an existing order." },
      { property: "og:title", content: "Order & Cart — Grids2Bricks" },
      { property: "og:description", content: "Check out your BrickHeadz designs or look up an existing order." },
    ],
  }),
  component: OrderPage,
});

const checkoutSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  fullName: z.string().trim().min(1, "Name is required").max(100),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  line1: z.string().trim().min(1, "Address is required").max(200),
  city: z.string().trim().min(1, "City is required").max(100),
  state: z.string().trim().max(100).optional().or(z.literal("")),
  postalCode: z.string().trim().min(1, "Postal code is required").max(20),
  country: z.string().trim().min(1, "Country is required").max(100),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

type CheckoutForm = z.infer<typeof checkoutSchema>;

function OrderPage() {
  const { user } = useAuth();
  const { items, removeItem, updateQuantity, totalCents, clear } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<{ id: string; email: string } | null>(null);

  const [lookupId, setLookupId] = useState("");
  const [lookupEmail, setLookupEmail] = useState("");
  const [lookupResult, setLookupResult] = useState<{ status: string; total_cents: number; created_at: string } | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const form = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      email: user?.email ?? "",
      fullName: "",
      phone: "",
      line1: "",
      city: "",
      state: "",
      postalCode: "",
      country: "",
      notes: "",
    },
  });

  const onSubmit = async (values: CheckoutForm) => {
    if (items.length === 0) {
      toast.error("Your cart is empty.");
      return;
    }
    setSubmitting(true);
    try {
      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
          user_id: user?.id ?? null,
          email: values.email,
          full_name: values.fullName,
          phone: values.phone || null,
          shipping_address: {
            line1: values.line1,
            city: values.city,
            state: values.state || null,
            postal_code: values.postalCode,
            country: values.country,
          },
          notes: values.notes || null,
          total_cents: totalCents,
          status: "pending",
        })
        .select()
        .single();
      if (orderErr) throw orderErr;

      const itemsPayload = items.map((i) => ({
        order_id: order.id,
        design_id: i.designId ?? null,
        design_snapshot: { name: i.name, customization: i.customization } as unknown as never,
        quantity: i.quantity,
        unit_price_cents: i.unitPriceCents,
      }));

      const { error: itemsErr } = await supabase.from("order_items").insert(itemsPayload);
      if (itemsErr) throw itemsErr;

      setConfirmation({ id: order.id, email: order.email });
      clear();
      toast.success("Order placed!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not place order.");
    } finally {
      setSubmitting(false);
    }
  };

  const lookup = async () => {
    setLookupError(null);
    setLookupResult(null);
    if (!lookupId.trim() || !lookupEmail.trim()) {
      setLookupError("Enter both order ID and email.");
      return;
    }
    // Guests can only look up their order if signed in or via secured endpoint;
    // Here we'll attempt a limited public-safe check via .select where they own the email.
    // RLS only allows owners/admins to read, so this works for signed-in owners.
    const { data, error } = await supabase
      .from("orders")
      .select("status, total_cents, created_at, email")
      .eq("id", lookupId.trim())
      .maybeSingle();
    if (error || !data) {
      setLookupError("Order not found, or you don't have access. Sign in with the account that placed it.");
      return;
    }
    if (data.email.toLowerCase() !== lookupEmail.trim().toLowerCase()) {
      setLookupError("Email doesn't match this order.");
      return;
    }
    setLookupResult({ status: data.status, total_cents: data.total_cents, created_at: data.created_at });
  };

  if (confirmation) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-2xl px-4 py-20 sm:px-6 lg:px-8">
          <Card className="p-8 text-center shadow-elegant">
            <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h1 className="mt-6 text-3xl font-extrabold tracking-tight">Order placed!</h1>
            <p className="mt-3 text-muted-foreground">
              We've emailed a confirmation to <span className="font-semibold text-foreground">{confirmation.email}</span>.
            </p>
            <div className="mt-6 rounded-lg bg-surface p-4 text-left">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Order ID</div>
              <div className="mt-1 break-all font-mono text-sm font-semibold">{confirmation.id}</div>
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link to="/create"><Button variant="outline">Make another</Button></Link>
              <Link to="/"><Button className="bg-gradient-primary text-primary-foreground hover:opacity-95">Back home</Button></Link>
            </div>
          </Card>
        </div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Cart & order</h1>
        <p className="mt-2 text-muted-foreground">Check out, or look up an existing order.</p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr,1.3fr]">
          {/* Left: order lookup */}
          <Card className="h-fit p-6">
            <div className="flex items-center gap-2">
              <div className="rounded-md bg-primary/10 p-2 text-primary"><Search className="h-4 w-4" /></div>
              <h2 className="text-lg font-bold">Track an order</h2>
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <Label htmlFor="lookupId" className="text-xs uppercase tracking-wider text-muted-foreground">Order ID</Label>
                <Input id="lookupId" value={lookupId} onChange={(e) => setLookupId(e.target.value)} placeholder="UUID" className="mt-1.5 font-mono text-sm" />
              </div>
              <div>
                <Label htmlFor="lookupEmail" className="text-xs uppercase tracking-wider text-muted-foreground">Email</Label>
                <Input id="lookupEmail" type="email" value={lookupEmail} onChange={(e) => setLookupEmail(e.target.value)} placeholder="you@example.com" className="mt-1.5" />
              </div>
              <Button onClick={lookup} variant="outline" className="w-full">Look up</Button>
              {lookupError && <p className="text-xs text-destructive">{lookupError}</p>}
              {lookupResult && (
                <div className="rounded-lg bg-surface p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Package className="h-4 w-4 text-primary" /> Status: <span className="capitalize">{lookupResult.status.replace("_", " ")}</span>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Placed {new Date(lookupResult.created_at).toLocaleDateString()} · Total {formatPrice(lookupResult.total_cents)}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Right: cart + checkout */}
          <div className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="rounded-md bg-primary/10 p-2 text-primary"><ShoppingBag className="h-4 w-4" /></div>
                  <h2 className="text-lg font-bold">Your cart</h2>
                </div>
                <div className="text-sm text-muted-foreground">{items.length} {items.length === 1 ? "item" : "items"}</div>
              </div>

              {items.length === 0 ? (
                <div className="mt-6 rounded-xl border border-dashed p-8 text-center">
                  <p className="text-sm text-muted-foreground">Your cart is empty.</p>
                  <Link to="/create" className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">Create your first BrickHeadz →</Link>
                </div>
              ) : (
                <ul className="mt-4 divide-y">
                  {items.map((i) => (
                    <li key={i.id} className="flex items-center gap-4 py-4">
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-surface">
                        {i.thumbnail ? (
                          <img src={i.thumbnail} alt={i.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground"><Package className="h-5 w-5" /></div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold">{i.name}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {(i.customization as { style?: string; color?: string }).style ?? ""} · {(i.customization as { color?: string }).color ?? ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 rounded-md border">
                        <button onClick={() => updateQuantity(i.id, i.quantity - 1)} className="px-2 py-1 hover:bg-muted" aria-label="Decrease"><Minus className="h-3 w-3" /></button>
                        <span className="w-6 text-center text-sm font-semibold">{i.quantity}</span>
                        <button onClick={() => updateQuantity(i.id, i.quantity + 1)} className="px-2 py-1 hover:bg-muted" aria-label="Increase"><Plus className="h-3 w-3" /></button>
                      </div>
                      <div className="w-20 text-right font-bold">{formatPrice(i.unitPriceCents * i.quantity)}</div>
                      <button onClick={() => removeItem(i.id)} className="text-muted-foreground hover:text-destructive" aria-label="Remove">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {items.length > 0 && (
                <div className="mt-4 flex items-center justify-between border-t pt-4">
                  <div className="text-sm text-muted-foreground">Subtotal</div>
                  <div className="text-2xl font-extrabold">{formatPrice(totalCents)}</div>
                </div>
              )}
            </Card>

            {items.length > 0 && (
              <Card className="p-6">
                <h2 className="text-lg font-bold">Shipping & contact</h2>
                <form onSubmit={form.handleSubmit(onSubmit)} className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" {...form.register("email")} className="mt-1.5" />
                    {form.formState.errors.email && <p className="mt-1 text-xs text-destructive">{form.formState.errors.email.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="fullName">Full name</Label>
                    <Input id="fullName" {...form.register("fullName")} className="mt-1.5" />
                    {form.formState.errors.fullName && <p className="mt-1 text-xs text-destructive">{form.formState.errors.fullName.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone (optional)</Label>
                    <Input id="phone" {...form.register("phone")} className="mt-1.5" />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="line1">Address</Label>
                    <Input id="line1" {...form.register("line1")} className="mt-1.5" />
                    {form.formState.errors.line1 && <p className="mt-1 text-xs text-destructive">{form.formState.errors.line1.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="city">City</Label>
                    <Input id="city" {...form.register("city")} className="mt-1.5" />
                    {form.formState.errors.city && <p className="mt-1 text-xs text-destructive">{form.formState.errors.city.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="state">State / Region</Label>
                    <Input id="state" {...form.register("state")} className="mt-1.5" />
                  </div>
                  <div>
                    <Label htmlFor="postalCode">Postal code</Label>
                    <Input id="postalCode" {...form.register("postalCode")} className="mt-1.5" />
                    {form.formState.errors.postalCode && <p className="mt-1 text-xs text-destructive">{form.formState.errors.postalCode.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="country">Country</Label>
                    <Input id="country" {...form.register("country")} className="mt-1.5" />
                    {form.formState.errors.country && <p className="mt-1 text-xs text-destructive">{form.formState.errors.country.message}</p>}
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="notes">Notes (optional)</Label>
                    <Textarea id="notes" rows={3} {...form.register("notes")} className="mt-1.5" />
                  </div>
                  <div className="sm:col-span-2 flex items-center justify-between gap-3 border-t pt-4">
                    <div className="text-sm text-muted-foreground">Total: <span className="text-base font-bold text-foreground">{formatPrice(totalCents)}</span></div>
                    <Button type="submit" disabled={submitting} className="bg-gradient-primary text-primary-foreground shadow-elegant hover:opacity-95">
                      {submitting ? "Placing order..." : "Place order"}
                    </Button>
                  </div>
                  <p className="sm:col-span-2 text-xs text-muted-foreground">Payment isn't processed yet — we'll contact you with payment instructions.</p>
                </form>
              </Card>
            )}
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
