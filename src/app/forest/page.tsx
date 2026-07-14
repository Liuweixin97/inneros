import ForestWorld from '@/components/forest/ForestWorld';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { buildForestAtlas } from '@/lib/forest/atlas';
import { getForestProfile } from '@/lib/forest/profile';

export default async function ForestPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/forest');
  const profile = getForestProfile(user.id, { persistent: true });
  const atlas = buildForestAtlas({ userId: user.id, requestedWindow: profile.activeWindow });

  return (
    <ForestWorld
      initialAtlas={atlas}
      initialProfile={profile}
      viewer={{ name: user.name, username: user.username }}
    />
  );
}
