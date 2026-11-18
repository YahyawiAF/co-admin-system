import { redirect } from "next/navigation";

/** Conseil IA was replaced by the Directeur: old links land there. */
export default function ConseillerPage() {
  redirect("/directeur");
}
