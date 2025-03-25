import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // Cette partie ne s'exécute que côté client
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('accessToken') : null;
    setIsAuthenticated(!!token);

    if (!token) {
      router.replace('/auth/sign-in');
    }
  }, [router]);

  if (isAuthenticated === null) {
    // Pendant la vérification de l'authentification
    return null; // ou un composant de chargement
  }

  return isAuthenticated ? <>{children}</> : null;
};

export default ProtectedRoute;