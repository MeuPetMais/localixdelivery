-- Ensure public restaurant profile tabs can read only the safe fields required by the UI.
GRANT SELECT ON public.restaurants_public TO anon, authenticated;

GRANT SELECT (
  id, name, slug, description, logo_url, cover_url,
  delivery_fee, min_order, is_open, created_at, updated_at,
  address, address_number, complement, neighborhood, city, state, zip_code,
  category, primary_color, delivery_time, delivery_radius,
  avg_delivery_minutes, avg_pickup_minutes,
  opening_hours, instagram, facebook, website, email,
  latitude, longitude, google_maps_url, landline_phone,
  payment_methods, active
) ON public.restaurants TO anon, authenticated;

GRANT SELECT ON public.reviews TO anon, authenticated;
