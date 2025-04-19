import { useEffect, useState } from "react";
import { useRouter } from "next/router";

type Role = "USER" | "ADMIN";

interface RoleProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: Role[];
}

const RoleProtectedRoute = ({
  children,
  allowedRoles = [],
}: RoleProtectedRouteProps) => {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    const token = sessionStorage.getItem("accessToken");
    const userRole = (sessionStorage.getItem("Role") as Role) || "USER";
    const pathname = router.pathname;

    const validRoles = Array.isArray(allowedRoles) ? allowedRoles : [];

    if (!token) {
      const loginPath = validRoles.includes("ADMIN")
        ? "/auth/sign-in"
        : "/client/login";
      router.replace(loginPath);
      return;
    }

    // Logique de redirection spécifique
    if (userRole === "ADMIN" && pathname.startsWith("/client")) {
      router.replace("/");
      return;
    }

    if (
      userRole === "USER" &&
      (pathname.startsWith("/auth") || pathname.startsWith("/dashboard"))
    ) {
      router.replace("/client/account");
      return;
    }

    // Vérification d'accès générale
    const hasAccess = validRoles.includes(userRole);
    setIsAuthorized(hasAccess);
  }, [router, allowedRoles]);

  if (isAuthorized === null) return null;

  return isAuthorized ? <>{children}</> : null;
};

export default RoleProtectedRoute;
