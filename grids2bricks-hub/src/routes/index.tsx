import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Upload, Box, Truck, ChevronRight, Mail, Github, Camera, Blocks } from "lucide-react";
import { SiteLayout } from "@/components/site/layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Grids2Bricks — Custom BrickHeadz from your photos" },
      {
        name: "description",
        content:
          "Turn any photo into a personalized BrickHeadz figurine. Design it yourself in 3D and we'll ship it to your door.",
      },
      { property: "og:title", content: "Grids2Bricks — Custom BrickHeadz from your photos" },
      {
        property: "og:description",
        content: "Turn any photo into a personalized BrickHeadz figurine.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <SiteLayout>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-hero">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-32">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                Your photo,
                <br />
                rebuilt in <span className="text-primary">bricks</span>.
              </h1>
              <p className="mt-5 max-w-lg text-base text-muted-foreground sm:text-lg">
                Upload a portrait, customize the look, preview it in 3D, and we'll ship a
                one-of-a-kind BrickHeadz figurine of you, your pet, or anyone you love.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link to="/create">
                  <Button
                    size="lg"
                    className="bg-gradient-primary text-primary-foreground shadow-elegant hover:opacity-95"
                  >
                    Create yours <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/order">
                  <Button size="lg" variant="outline">
                    View cart
                  </Button>
                </Link>
              </div>
              <div className="mt-8 flex items-center gap-6 text-xs text-muted-foreground">
                <div>
                  <span className="font-bold text-foreground">2,400+</span> figurines built
                </div>
                <div className="h-4 w-px bg-border" />
                <div>
                  <span className="font-bold text-foreground">4.9★</span> avg rating
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 -z-10 bg-gradient-primary opacity-20 blur-3xl" />
              <Card className="aspect-square overflow-hidden border-2 shadow-lift">
                <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/10 via-transparent to-primary-glow/20">
                  <div className="grid grid-cols-3 gap-2 p-8">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <div
                        key={i}
                        className="aspect-square rounded-md bg-gradient-primary shadow-soft transition-spring hover:scale-110"
                        style={{ opacity: 0.3 + (i % 3) * 0.25 }}
                      />
                    ))}
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">How it works</h2>
          <p className="mt-3 text-muted-foreground">Three steps from a photo to your doorstep.</p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {[
            {
              icon: Upload,
              title: "Upload",
              desc: "Drop a clear, front-facing photo. We'll handle the rest.",
            },
            {
              icon: Box,
              title: "Preview in 3D",
              desc: "Tweak the style, colors, and name plate. Spin it around live.",
            },
            {
              icon: Truck,
              title: "Order & ship",
              desc: "Add to cart, check out, and we'll build and ship it.",
            },
          ].map((step, i) => (
            <Card
              key={step.title}
              className="p-6 transition-spring hover:-translate-y-1 hover:shadow-elegant"
            >
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-elegant">
                <step.icon className="h-5 w-5" />
              </div>
              <div className="mt-4 text-xs font-semibold tracking-widest text-primary">
                STEP {i + 1}
              </div>
              <h3 className="mt-1 text-lg font-bold">{step.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{step.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Gallery */}
      <section className="bg-surface py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                Sample BrickHeadz
              </h2>
              <p className="mt-2 text-muted-foreground">A few favorites from our community.</p>
            </div>
            <Link
              to="/create"
              className="hidden text-sm font-semibold text-primary hover:underline sm:inline-flex"
            >
              Make yours →
            </Link>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card
                key={i}
                className="aspect-square overflow-hidden p-0 transition-spring hover:-translate-y-1 hover:shadow-elegant"
              >
                <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/15 to-primary-glow/30">
                  <div className="grid grid-cols-2 gap-1.5 p-6">
                    {Array.from({ length: 4 }).map((_, j) => (
                      <div
                        key={j}
                        className="h-8 w-8 rounded bg-primary shadow-soft"
                        style={{ opacity: 0.5 + ((i + j) % 4) * 0.15 }}
                      />
                    ))}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <TeamSection />

      {/* FAQ */}
      <section id="faq" className="bg-surface py-20 scroll-mt-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-3xl font-extrabold tracking-tight sm:text-4xl">FAQ</h2>
          <Accordion type="single" collapsible className="mt-10">
            {[
              {
                q: "What kind of photo works best?",
                a: "A clear, front-facing portrait with good lighting. Single subjects work best — we'll guide you in the editor.",
              },
              {
                q: "How long does shipping take?",
                a: "Build time is about 5–7 business days. Standard shipping adds 3–5 days domestically.",
              },
              {
                q: "Can I order without an account?",
                a: "Yes. Guest checkout is fully supported. Creating an account just lets you save designs and track orders.",
              },
              {
                q: "What's your return policy?",
                a: "Custom builds aren't returnable, but if anything arrives damaged we'll rebuild it free of charge.",
              },
            ].map((item, i) => (
              <AccordionItem key={i} value={`item-${i}`}>
                <AccordionTrigger className="text-left text-base font-semibold">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Contact / CTA */}
      <section id="contact" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-20 sm:px-6 lg:px-8">
        <Card className="overflow-hidden border-0 bg-gradient-primary p-8 text-primary-foreground shadow-lift sm:p-12">
          <div className="grid items-center gap-8 md:grid-cols-2">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                Ready to build yours?
              </h2>
              <p className="mt-3 max-w-md text-primary-foreground/80">
                It takes 5 minutes from photo to finished design. Order whenever you're happy with
                the preview.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 md:justify-end">
              <Link to="/create">
                <Button
                  size="lg"
                  variant="secondary"
                  className="bg-white text-primary hover:bg-white/90"
                >
                  Start creating <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
              <a href="mailto:hello@grids2bricks.com">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/30 bg-transparent text-primary-foreground hover:bg-white/10"
                >
                  Contact us
                </Button>
              </a>
            </div>
          </div>
        </Card>
      </section>
    </SiteLayout>
  );
}

// TODO: Replace with real photos of Halil & Fikret (real together + BrickHeadz versions)
const TEAM_PHOTO_REAL =
  "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&auto=format&fit=crop&q=80";
const TEAM_PHOTO_LEGO =
  "https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=1200&auto=format&fit=crop&q=80";

function TeamSection() {
  const [mode, setMode] = useState<"real" | "lego">("real");
  const toggle = () => setMode((m) => (m === "real" ? "lego" : "real"));

  return (
    <section id="team" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Meet the team</h2>
        <p className="mt-3 text-muted-foreground">Two builders behind every BrickHead.</p>
      </div>

      <div className="mt-12 grid gap-6 lg:grid-cols-4">
        {/* Halil — left 1/4 */}
        <Card className="flex flex-col p-6 lg:col-span-1">
          <div className="mb-4 h-16 w-16 rounded-full bg-gradient-primary shadow-elegant" />
          <div className="text-xs font-semibold tracking-widest text-primary">CO-FOUNDER</div>
          <h3 className="mt-1 text-xl font-bold">Halil</h3>
          <p className="mt-3 text-sm text-muted-foreground">
            Designs the brick patterns and obsesses over color accuracy. Turns photos into
            pixel-perfect builds.
          </p>
          <div className="mt-auto flex gap-3 pt-5">
            <a
              href="mailto:halil@grids2bricks.com"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Email Halil"
            >
              <Mail className="h-4 w-4" />
            </a>
            <a
              href="#"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Halil on GitHub"
            >
              <Github className="h-4 w-4" />
            </a>
          </div>
        </Card>

        {/* Photo — middle 2/4 */}
        <div className="lg:col-span-2">
          <Card className="relative aspect-[4/5] overflow-hidden border-2 p-0 shadow-lift sm:aspect-[5/4] lg:aspect-[4/5]">
            <img
              src={TEAM_PHOTO_REAL}
              alt="Halil and Fikret together"
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
                mode === "real" ? "opacity-100" : "opacity-0"
              }`}
            />
            <img
              src={TEAM_PHOTO_LEGO}
              alt="Halil and Fikret as BrickHeadz"
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
                mode === "lego" ? "opacity-100" : "opacity-0"
              }`}
            />

            <button
              type="button"
              onClick={toggle}
              aria-label="Toggle between real photo and BrickHeadz version"
              className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full border border-border bg-background/90 p-1 shadow-elegant backdrop-blur"
            >
              <div className="relative flex items-center text-xs font-semibold">
                <span
                  className={`relative z-10 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors ${
                    mode === "real" ? "text-primary-foreground" : "text-muted-foreground"
                  }`}
                >
                  <Camera className="h-3.5 w-3.5" />
                  Real
                </span>
                <span
                  className={`relative z-10 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors ${
                    mode === "lego" ? "text-primary-foreground" : "text-muted-foreground"
                  }`}
                >
                  <Blocks className="h-3.5 w-3.5" />
                  Lego
                </span>
                <span
                  className={`absolute top-0 h-full w-1/2 rounded-full bg-gradient-primary shadow-soft transition-transform duration-300 ${
                    mode === "real" ? "translate-x-0" : "translate-x-full"
                  }`}
                />
              </div>
            </button>
          </Card>
        </div>

        {/* Fikret — right 1/4 */}
        <Card className="flex flex-col p-6 lg:col-span-1">
          <div className="mb-4 h-16 w-16 rounded-full bg-gradient-primary shadow-elegant" />
          <div className="text-xs font-semibold tracking-widest text-primary">CO-FOUNDER</div>
          <h3 className="mt-1 text-xl font-bold">Fikret</h3>
          <p className="mt-3 text-sm text-muted-foreground">
            Builds the 3D pipeline and ships every order on time. Keeps the bricks (and the servers)
            running.
          </p>
          <div className="mt-auto flex gap-3 pt-5">
            <a
              href="mailto:fikret@grids2bricks.com"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Email Fikret"
            >
              <Mail className="h-4 w-4" />
            </a>
            <a
              href="#"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Fikret on GitHub"
            >
              <Github className="h-4 w-4" />
            </a>
          </div>
        </Card>
      </div>
    </section>
  );
}
