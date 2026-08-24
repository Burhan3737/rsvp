import { clearAdminCookie } from '@/lib/auth';
import { redirect } from 'next/navigation';

async function signOut() {
  'use server';
  await clearAdminCookie();
  redirect('/admin/login');
}

const LINKS = [
  { id: 'dashboard', href: '/admin', label: 'Dashboard' },
  { id: 'content', href: '/admin/content', label: 'The wedding' },
  { id: 'events', href: '/admin/events', label: 'Events' },
  { id: 'pages', href: '/admin/pages', label: 'Sections' },
  { id: 'invites', href: '/admin/invites', label: 'Invite links' },
  { id: 'themes', href: '/admin/themes', label: 'Themes' },
];

export function AdminNav({ active }: { active: string }) {
  return (
    <nav className="admin-nav" aria-label="Admin">
      <div className="wide admin-nav-inner">
        <ul className="admin-nav-list">
          {LINKS.map((l) => (
            <li key={l.id}>
              <a href={l.href} className={`admin-nav-link${active === l.id ? ' is-active' : ''}`}>
                {l.label}
              </a>
            </li>
          ))}
          <li>
            <a href="/admin/export" className="admin-nav-link">
              Export CSV
            </a>
          </li>
        </ul>
        <form action={signOut}>
          <button type="submit" className="admin-nav-link admin-signout">
            Sign out
          </button>
        </form>
      </div>
    </nav>
  );
}
