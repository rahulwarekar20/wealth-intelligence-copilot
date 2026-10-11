import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "./api";

/** Sends the user to the login page if there is no token. */
export function useRequireAuth() {
  const router = useRouter();
  useEffect(() => {
    if (!getToken()) router.replace("/");
  }, [router]);
}
