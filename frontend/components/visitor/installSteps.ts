import type { AndroidBrowser } from "@/lib/visitor-notify";

/** `src` = screenshot; without it the guide draws `icon` instead. */
export type InstallStep = {
  src?: string;
  icon?: "menu" | "add" | "done";
  alt: string;
  title: string;
  hint: string;
};

export const IOS_INSTALL_STEPS: readonly InstallStep[] = [
  {
    src: "/install/install-ios-1.jpg",
    alt: "Safari : appuyez sur le bouton Partager en bas de l’écran",
    title: "Appuyez sur Partager",
    hint: "Le carré avec la flèche, en bas au centre.",
  },
  {
    src: "/install/install-ios-2.jpg",
    alt: "Dans le menu Partager, appuyez sur Sur l’écran d’accueil",
    title: "Sur l’écran d’accueil",
    hint: "Faites défiler la liste, puis appuyez.",
  },
  {
    src: "/install/install-ios-3.jpg",
    alt: "L’icône de l’app apparaît sur l’écran d’accueil",
    title: "C’est installé",
    hint: "Ouvrez l’app depuis l’écran d’accueil.",
  },
];

export const ANDROID_INSTALL_STEPS: readonly InstallStep[] = [
  {
    src: "/install/install-android-1.jpg",
    alt: "Chrome : appuyez sur le menu à trois points",
    title: "Ouvrez le menu",
    hint: "Les trois points ⋮ en haut à droite.",
  },
  {
    src: "/install/install-android-2.jpg",
    alt: "Dans le menu Chrome, appuyez sur Installer l’application",
    title: "Installer l’application",
    hint: "Puis confirmez l’installation.",
  },
  {
    src: "/install/install-android-3.jpg",
    alt: "L’app est installée sur l’écran d’accueil",
    title: "C’est installé",
    hint: "L’icône est sur l’écran d’accueil.",
  },
];

/** Samsung Internet (default browser on Galaxy phones, opens QR links). */
export const SAMSUNG_INSTALL_STEPS: readonly InstallStep[] = [
  {
    icon: "menu",
    alt: "Samsung Internet : appuyez sur le menu ≡ en bas à droite",
    title: "Ouvrez le menu",
    hint: "Le bouton ≡ en bas à droite de l’écran.",
  },
  {
    icon: "add",
    alt: "Appuyez sur Ajouter la page à, puis Écran d’accueil",
    title: "Ajouter la page à → Écran d’accueil",
    hint: "Puis appuyez sur Ajouter (ou Installer).",
  },
  {
    icon: "done",
    alt: "L’app est installée sur l’écran d’accueil",
    title: "C’est installé",
    hint: "Ouvrez l’app depuis l’écran d’accueil.",
  },
];

export function pickInstallSteps(
  ios: boolean,
  browser: AndroidBrowser | null
): readonly InstallStep[] {
  if (ios) return IOS_INSTALL_STEPS;
  return browser === "samsung" ? SAMSUNG_INSTALL_STEPS : ANDROID_INSTALL_STEPS;
}

/** One-line summary under the guide title. */
export function installSummary(ios: boolean, browser: AndroidBrowser | null) {
  if (ios) return "Safari — 3 gestes pour l’ajouter à l’écran d’accueil.";
  if (browser === "samsung") {
    return "Samsung Internet — menu ≡ puis Ajouter la page à → Écran d’accueil.";
  }
  return "Chrome — menu ⋮ puis Installer l’application.";
}
