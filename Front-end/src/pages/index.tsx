import { useEffect } from "react";
import { useRouter } from "next/router";
import type { ReactElement } from "react";
import Loader from "src/components/Loader";

function RootRedirect() {
  const router = useRouter();

  useEffect(() => {
    const token = sessionStorage.getItem("accessToken");
    if (token) {
      router.replace("/dashboard/landing");
    } else {
      router.replace("/auth/sign-in");
    }
  }, [router]);

  return <Loader />;
}

RootRedirect.getLayout = function getLayout(page: ReactElement) {
  return page;
};

export default RootRedirect;
