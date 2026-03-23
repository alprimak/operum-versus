import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';

function AppContent() {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Not authenticated</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6">
      <h1 className="text-2xl font-semibold text-gray-900">Operum Versus</h1>
      <p className="text-gray-600 mt-2">
        Signed in as {user?.name ?? user?.email}
      </p>
    </main>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
