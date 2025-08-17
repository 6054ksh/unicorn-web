'use client';
import { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { firebaseApp } from '@/lib/firebase';

export function useAuthReady() {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    const auth = getAuth(firebaseApp);
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setReady(true);
    });
    return () => unsub();
  }, []);
  return { ready, user };
}
