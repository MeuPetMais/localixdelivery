-- Logged-in customers must see active restaurants exactly like anonymous
-- visitors. Until now, authenticated users could only see restaurants they
-- OWN (auth.uid() = owner_id), which broke the customer storefront/session
-- after login while owners kept working.
CREATE POLICY "Authenticated users can view active public restaurants"
ON public.restaurants
FOR SELECT
TO authenticated
USING (active = true);