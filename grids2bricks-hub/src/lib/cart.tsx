import * as React from "react";

export interface CartItem {
  id: string; // local item id
  designId?: string; // db design id (optional)
  name: string;
  thumbnail?: string; // data url or signed url
  customization: Record<string, unknown>;
  quantity: number;
  unitPriceCents: number;
}

interface CartContextValue {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "id" | "quantity"> & { quantity?: number }) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, qty: number) => void;
  clear: () => void;
  totalCents: number;
  count: number;
}

const STORAGE_KEY = "g2b_cart_v1";

const CartContext = React.createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<CartItem[]>([]);

  React.useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      if (raw) setItems(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  React.useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      }
    } catch {
      // ignore
    }
  }, [items]);

  const addItem: CartContextValue["addItem"] = (item) => {
    setItems((prev) => [
      ...prev,
      {
        ...item,
        id: crypto.randomUUID(),
        quantity: item.quantity ?? 1,
      },
    ]);
  };

  const removeItem = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));

  const updateQuantity = (id: string, qty: number) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, quantity: Math.max(1, qty) } : i)));

  const clear = () => setItems([]);

  const totalCents = items.reduce((sum, i) => sum + i.unitPriceCents * i.quantity, 0);
  const count = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, updateQuantity, clear, totalCents, count }}
    >
      {children}
    </CartContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart() {
  const ctx = React.useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}

// eslint-disable-next-line react-refresh/only-export-components
export function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}
