import RestaurantMenuClient from './RestaurantMenuClient';

// ISR: Revalidate every 60 seconds
// First visitor: Vercel fetches from backend, caches the result
// Next 60s: All NZ visitors get instant cached response (no Singapore round trip)
// After 60s: Vercel serves stale page while regenerating in background
export const revalidate = 60;

async function getMenuData(restaurantId: string) {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  try {
    const res = await fetch(`${API_URL}/api/public/menu/${restaurantId}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch (error) {
    console.error('Failed to fetch menu data server-side:', error);
    return null;
  }
}

export default async function RestaurantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getMenuData(id);

  // Pass server-fetched data to client component
  // If data is null, client component will fetch client-side as fallback
  return <RestaurantMenuClient initialData={data} restaurantId={id} />;
}
