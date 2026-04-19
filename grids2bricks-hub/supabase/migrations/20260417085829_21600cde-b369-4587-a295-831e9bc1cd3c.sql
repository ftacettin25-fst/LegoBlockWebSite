
DROP POLICY IF EXISTS "Anyone can create an order" ON public.orders;
DROP POLICY IF EXISTS "Anyone can insert order items" ON public.order_items;

-- Orders: signed-in users must set their own user_id; guests must leave user_id NULL
CREATE POLICY "Authenticated users create their own orders"
  ON public.orders FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Guests create orders without user_id"
  ON public.orders FOR INSERT
  TO anon
  WITH CHECK (user_id IS NULL);

-- Order items: only insert into an order owned by the same actor
CREATE POLICY "Users insert items into their own orders"
  ON public.order_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.user_id = auth.uid()
    )
  );

CREATE POLICY "Guests insert items into guest orders"
  ON public.order_items FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.user_id IS NULL
    )
  );
