import React from 'react';
import { AppUser } from '../types';

interface MainPageProps {
  user: AppUser;
}

/**
 * MainPage – replace this with your app's main view.
 */
export default function MainPage({ user }: MainPageProps) {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-2">
        Welcome, {user.email ?? user.convergeId}
      </h1>
      <p className="text-[var(--color-text-secondary)]">
        Build your app here. This is the main page placeholder.
      </p>
    </div>
  );
}
