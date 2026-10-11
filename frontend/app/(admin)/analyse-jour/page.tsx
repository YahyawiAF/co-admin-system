import { redirect } from "next/navigation";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const q = new URLSearchParams({ tab: "jour" });
  for (const [k, v] of Object.entries(await searchParams)) {
    if (typeof v === "string") q.set(k, v);
  }
  redirect(`/finance?${q.toString()}`);
}
