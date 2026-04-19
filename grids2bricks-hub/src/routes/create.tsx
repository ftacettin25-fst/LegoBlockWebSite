import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Upload, Download, ShoppingCart, Image as ImageIcon, X, Heart, Square, Ban } from "lucide-react";
import jsPDF from "jspdf";
import { toast } from "sonner";

import { SiteLayout } from "@/components/site/layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useCart, formatPrice } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { getGuestToken } from "@/lib/guest";
import { BuildOverlay } from "@/components/site/build-overlay";

export const Route = createFileRoute("/create")({
  head: () => ({
    meta: [
      { title: "Create your BrickHeadz — Grids2Bricks" },
      { name: "description", content: "Upload a photo, customize colors and style, preview your BrickHeadz in 3D, and add it to your cart." },
      { property: "og:title", content: "Create your BrickHeadz" },
      { property: "og:description", content: "Design your custom BrickHeadz figurine in real-time 3D." },
    ],
  }),
  component: CreatePage,
});

const EXTRAS = [
  { id: "heart", name: "Heart", icon: Heart },
  { id: "frame", name: "Frame", icon: Square },
] as const;
type ExtraId = typeof EXTRAS[number]["id"];

const COLORS = [
  { name: "Purple", hex: "#460050" },
  { name: "Indigo", hex: "#3b3091" },
  { name: "Crimson", hex: "#a3123a" },
  { name: "Forest", hex: "#1f6b3a" },
  { name: "Charcoal", hex: "#2a2a2a" },
  { name: "Gold", hex: "#c89a2a" },
];

const PRICE_CENTS = 4900;

function BrickHead({ baseColor, extras }: { baseColor: string; extras: ExtraId[] }) {
  return (
    <group>
      {/* head */}
      <mesh position={[0, 0.6, 0]} castShadow>
        <boxGeometry args={[1.6, 1.6, 1.6]} />
        <meshStandardMaterial color={baseColor} />
      </mesh>
      {/* eyes */}
      <mesh position={[-0.35, 0.7, 0.81]}>
        <cylinderGeometry args={[0.12, 0.12, 0.05, 24]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0.35, 0.7, 0.81]}>
        <cylinderGeometry args={[0.12, 0.12, 0.05, 24]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <mesh position={[-0.35, 0.7, 0.84]}>
        <cylinderGeometry args={[0.05, 0.05, 0.05, 24]} />
        <meshStandardMaterial color="#000000" />
      </mesh>
      <mesh position={[0.35, 0.7, 0.84]}>
        <cylinderGeometry args={[0.05, 0.05, 0.05, 24]} />
        <meshStandardMaterial color="#000000" />
      </mesh>
      {/* body */}
      <mesh position={[0, -0.6, 0]} castShadow>
        <boxGeometry args={[1.4, 1.2, 1]} />
        <meshStandardMaterial color={baseColor} />
      </mesh>
      {/* base */}
      <mesh position={[0, -1.4, 0]} castShadow>
        <boxGeometry args={[1.8, 0.3, 1.2]} />
        <meshStandardMaterial color="#cccccc" />
      </mesh>
      {/* studs */}
      {[-0.5, 0.5].map((x) =>
        [-0.3, 0.3].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 1.42, z]}>
            <cylinderGeometry args={[0.18, 0.18, 0.15, 24]} />
            <meshStandardMaterial color={baseColor} />
          </mesh>
        )),
      )}
      {/* heart extra */}
      {extras.includes("heart") && (
        <mesh position={[0, -0.6, 0.51]}>
          <sphereGeometry args={[0.22, 24, 24]} />
          <meshStandardMaterial color="#e11d48" />
        </mesh>
      )}
      {/* frame extra */}
      {extras.includes("frame") && (
        <group>
          {[
            { p: [0, 1.45, 0.81] as [number, number, number], s: [1.7, 0.08, 0.08] as [number, number, number] },
            { p: [0, -0.25, 0.81] as [number, number, number], s: [1.7, 0.08, 0.08] as [number, number, number] },
            { p: [-0.81, 0.6, 0.81] as [number, number, number], s: [0.08, 1.7, 0.08] as [number, number, number] },
            { p: [0.81, 0.6, 0.81] as [number, number, number], s: [0.08, 1.7, 0.08] as [number, number, number] },
          ].map((b, i) => (
            <mesh key={i} position={b.p}>
              <boxGeometry args={b.s} />
              <meshStandardMaterial color="#c89a2a" metalness={0.6} roughness={0.3} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}

function CreatePage() {
  const { user } = useAuth();
  const { addItem } = useCart();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [extras, setExtras] = useState<ExtraId[]>([]);
  const [color, setColor] = useState(COLORS[0]);
  const [submitting, setSubmitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [built, setBuilt] = useState(false);
  const [building, setBuilding] = useState(false);

  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Max file size is 8MB.");
      return;
    }
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoFile(file);
    setPhotoUrl(URL.createObjectURL(file));
    setBuilt(false);
  };

  const handleBuild = () => {
    if (!photoFile) {
      toast.error("Please upload a photo first.");
      return;
    }
    setBuilt(false);
    setBuilding(true);
  };

  const handleBuildDone = () => {
    setBuilding(false);
    setBuilt(true);
    toast.success("Your BrickHead is built! Preview it below.");
    setTimeout(() => {
      document.getElementById("build-output")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const downloadPdf = () => {
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("Grids2Bricks — Build Instructions", 14, 22);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(`Design: BrickHead`, 14, 34);
    doc.text(`Extras: ${extras.length ? extras.join(", ") : "None"}`, 14, 42);
    doc.text(`Base color: ${color.name} (${color.hex})`, 14, 50);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 58);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Steps", 14, 74);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const steps = [
      "1. Lay out the base plate (1 x 6 studs).",
      "2. Build the body block in the chosen color.",
      "3. Stack the head block on top of the body.",
      "4. Attach the eye tiles to the front of the head.",
      "5. Add the two top studs.",
      "6. (Optional) Add selected extras (heart, frame).",
    ];
    steps.forEach((s, i) => doc.text(s, 14, 84 + i * 8));

    doc.save(`brickheadz-design.pdf`);
  };

  const addToCart = async () => {
    if (!photoFile) {
      toast.error("Please upload a photo first.");
      return;
    }
    setSubmitting(true);
    try {
      const folder = user?.id ?? "guest";
      const ext = photoFile.name.split(".").pop() || "jpg";
      const path = `${folder}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("brickheadz-photos")
        .upload(path, photoFile, { upsert: false });
      if (upErr) throw upErr;

      const customization = { extras, color: color.name, colorHex: color.hex };
      const guestToken = user ? null : getGuestToken();

      const { data: design, error: insErr } = await supabase
        .from("brickheadz_designs")
        .insert({
          user_id: user?.id ?? null,
          guest_token: guestToken,
          photo_path: path,
          name: "BrickHead",
          customization,
        })
        .select()
        .single();
      if (insErr) throw insErr;

      addItem({
        designId: design.id,
        name: "BrickHead",
        thumbnail: photoUrl ?? undefined,
        customization,
        unitPriceCents: PRICE_CENTS,
        quantity: 1,
      });

      toast.success("Added to cart!");
      navigate({ to: "/order" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save design.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SiteLayout>
      <BuildOverlay open={building} onDone={handleBuildDone} />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Create your BrickHeadz</h1>
          <p className="mt-2 text-muted-foreground">Upload, customize, preview in 3D, and add to cart.</p>
        </div>

        {/* Step 1 + 2: Upload + Customize */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-5">
            <Label className="text-sm font-semibold">1. Photo</Label>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files[0];
                if (f) handleFile(f);
              }}
              onClick={() => !photoUrl && fileRef.current?.click()}
              className={`mt-3 rounded-xl border-2 border-dashed transition-smooth ${
                photoUrl ? "border-border" : "cursor-pointer p-10 text-center"
              } ${dragOver ? "border-primary bg-primary/5" : !photoUrl ? "border-border hover:border-primary/50 hover:bg-muted/50" : ""}`}
            >
              {photoUrl ? (
                <div className="relative">
                  <img
                    src={photoUrl}
                    alt="Uploaded preview"
                    className="block w-full rounded-lg object-cover"
                    style={{ maxHeight: "520px", minHeight: "360px" }}
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (photoUrl) URL.revokeObjectURL(photoUrl);
                      setPhotoFile(null);
                      setPhotoUrl(null);
                      setBuilt(false);
                    }}
                    className="absolute right-3 top-3 rounded-full bg-destructive p-1.5 text-destructive-foreground shadow-lg"
                    aria-label="Remove"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      fileRef.current?.click();
                    }}
                    className="absolute bottom-3 right-3 rounded-md bg-background/90 px-3 py-1.5 text-xs font-medium shadow hover:bg-background"
                  >
                    Replace
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
                  <div className="rounded-full bg-primary/10 p-4 text-primary">
                    <Upload className="h-6 w-6" />
                  </div>
                  <div className="text-base font-semibold text-foreground">Drop a photo or click to upload</div>
                  <div className="text-sm">JPG or PNG, up to 8MB</div>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </div>
          </Card>

          <Card className="p-5">
            <Label className="text-sm font-semibold">2. Customize</Label>
            <div className="mt-4 space-y-4">
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Extras</Label>
                <div className="mt-1.5 grid grid-cols-3 gap-2">
                  <button
                    onClick={() => { setExtras([]); setBuilt(false); }}
                    className={`flex items-center justify-center gap-2 rounded-lg border-2 px-3 py-2.5 text-sm font-semibold transition-all ${
                      extras.length === 0
                        ? "border-primary bg-primary text-primary-foreground shadow-md ring-2 ring-primary/30 scale-[1.02]"
                        : "border-border bg-background hover:border-primary/50 hover:bg-primary/5"
                    }`}
                  >
                    <Ban className="h-4 w-4" /> None
                  </button>
                  {EXTRAS.map((ex) => {
                    const Icon = ex.icon;
                    const selected = extras.includes(ex.id);
                    return (
                      <button
                        key={ex.id}
                        onClick={() => {
                          setExtras((prev) =>
                            prev.includes(ex.id) ? prev.filter((x) => x !== ex.id) : [...prev, ex.id],
                          );
                          setBuilt(false);
                        }}
                        className={`flex items-center justify-center gap-2 rounded-lg border-2 px-3 py-2.5 text-sm font-semibold transition-all ${
                          selected
                            ? "border-primary bg-primary text-primary-foreground shadow-md ring-2 ring-primary/30 scale-[1.02]"
                            : "border-border bg-background hover:border-primary/50 hover:bg-primary/5"
                        }`}
                      >
                        <Icon className={`h-4 w-4 ${selected ? "fill-current" : ""}`} /> {ex.name}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Select multiple extras to combine them. They appear in the 3D preview.</p>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Base color</Label>
                <div className="mt-1.5 grid grid-cols-6 gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c.hex}
                      onClick={() => { setColor(c); setBuilt(false); }}
                      title={c.name}
                      aria-label={c.name}
                      className={`aspect-square rounded-lg border-2 transition-smooth ${
                        color.hex === c.hex ? "border-foreground scale-105" : "border-transparent hover:scale-105"
                      }`}
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Step 3: Build */}
        <div className="mt-6 flex justify-center">
          <Button
            onClick={handleBuild}
            disabled={!photoFile}
            size="lg"
            className="bg-gradient-primary px-10 text-primary-foreground shadow-elegant hover:opacity-95"
          >
            <ImageIcon className="h-4 w-4" /> {built ? "Rebuild" : "Build my BrickHead"}
          </Button>
        </div>

        {/* Step 4: Output (instructions, order, 3D preview) */}
        {built && (
          <div id="build-output" className="mt-10 space-y-6">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight">Your BrickHead is ready</h2>
              <p className="mt-1 text-muted-foreground">Download instructions, place your order, and explore the 3D preview.</p>
            </div>

            <Card className="p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Price</div>
                  <div className="text-2xl font-extrabold">{formatPrice(PRICE_CENTS)}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={downloadPdf}>
                    <Download className="h-4 w-4" /> Instructions
                  </Button>
                  <Button onClick={addToCart} disabled={submitting} className="bg-gradient-primary text-primary-foreground shadow-elegant hover:opacity-95">
                    <ShoppingCart className="h-4 w-4" /> {submitting ? "Saving..." : "Place order"}
                  </Button>
                </div>
              </div>
              {!user && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Checking out as a guest is fine.{" "}
                  <Link to="/auth" className="font-semibold text-primary hover:underline">Sign in</Link> to save your designs.
                </p>
              )}
            </Card>

            <Card className="overflow-hidden p-0">
              <div className="flex items-center justify-between border-b p-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <ImageIcon className="h-4 w-4 text-primary" /> Live 3D preview
                </div>
                <div className="text-xs text-muted-foreground">Drag to rotate · Scroll to zoom</div>
              </div>
              <div className="h-[480px] w-full bg-gradient-to-br from-surface to-accent/40 lg:h-[560px]">
                <Canvas shadows camera={{ position: [3, 2, 4], fov: 45 }}>
                  <ambientLight intensity={0.6} />
                  <directionalLight position={[5, 5, 5]} intensity={1.2} castShadow />
                  <directionalLight position={[-5, 3, -2]} intensity={0.4} />
                  <BrickHead baseColor={color.hex} extras={extras} />
                  <OrbitControls enablePan={false} minDistance={3} maxDistance={9} />
                </Canvas>
              </div>
              {extras.length > 0 && (
                <div className="border-t bg-card p-4 text-center">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Extras</div>
                  <div className="mt-1 font-bold tracking-wide capitalize">{extras.join(" + ")}</div>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </SiteLayout>
  );
}
