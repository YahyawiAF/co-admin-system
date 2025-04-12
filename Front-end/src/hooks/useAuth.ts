import { useContext, useEffect, useState } from "react";
import { AuthContext } from "../contexts/JWTContext";

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("AuthContext must be placed within AuthProvider");

  const [user, setUser] = useState(() => context.user || null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const userID = sessionStorage.getItem("userID");
      const username = sessionStorage.getItem("username");
      const role = sessionStorage.getItem("role");
  
      // Vérifier si les informations sont bien disponibles
      if (userID && username && role) {
        setUser({
          id: userID,  // Assurez-vous que l'ID est bien stocké
          username,
          role,
          email: sessionStorage.getItem("email") || "", 
          phone: sessionStorage.getItem("phone") || "", 
        });
      }
    }
  }, []);

  return { user };
};


export default useAuth;