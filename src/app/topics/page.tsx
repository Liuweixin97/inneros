import { redirect } from 'next/navigation';

export default function TopicsPage() {
  redirect('/insights?tab=topics');
}
