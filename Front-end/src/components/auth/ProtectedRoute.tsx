import { useEffect } from 'react';
import { useRouter } from 'next/router';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const isAuthenticated = !!sessionStorage.getItem('accessToken'); // Vérifiez si le token existe

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/auth/sign-in'); // Redirigez vers la page de connexion
    }
  }, [isAuthenticated, router]);

  return isAuthenticated ? <>{children}</> : null; // Affichez les enfants uniquement si l'utilisateur est authentifié
};

export default ProtectedRoute;