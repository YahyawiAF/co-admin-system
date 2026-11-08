"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { endOfDay, endOfWeek, format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import {
  BadgePercent,
  CalendarDays,
  Check,
  CheckSquare,
  Clock,
  Coffee,
  CupSoda,
  Gift,
  Pencil,
  Plus,
  Search,
  Smartphone,
  Sparkles,
  Tags,
  Ticket,
  Trash2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ListPager, usePaged } from "@/components/ui/list-pager";
import { cn } from "@/lib/utils";
import { useConseilDraft } from "@/lib/hooks/use-conseil-draft";
import { pricesApi, productsApi, promotionsApi } from "@/lib/api/resources";
import { PromoGoldenCard } from "@/components/visitor/PromoGoldenCard";
import { PriceCategory, type Promotion, type PromotionInput, type PromotionTarget } from "@/lib/types";
import { promoCategoriesOf } from "@/lib/promo-price";
import { isDrink } from "@/lib/drinks";
import { DealBadge, GiftBadge } from "@/components/visitor/quest/QuestOption";

const DAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
/** Monday first, like a calendar */
const WEEK = [1, 2, 3, 4, 5, 6, 0];
const toLocalInput = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm");
const dt = (n: number) => `${String(Math.round(n * 100) / 100).replace(".", ",")} DT`;
const PER_PAGE = 18;

const CATEGORY_LABEL: Record<PriceCategory, string> = {
  [PriceCategory.JOURNEE]: "Journée",
  [PriceCategory.OPEN_SPACE]: "Open space",
  [PriceCategory.SALLE]: "Salle de réunion",
  [PriceCategory.ABONNEMENT]: "Abonnement",
};

const KINDS: Array<{ target: PromotionTarget; title: string; hint: string; icon: typeof Coffee }> = [
  { target: "PRICE", title: "Remise sur un pass", hint: "Ex. Journée −20 % aujourd’hui", icon: Ticket },
  { target: "BUNDLE", title: "Cadeau avec un pass", hint: "Ex. 4h → boisson −50 %, au choix", icon: Gift },
  { target: "PRODUCT", title: "Produits du café", hint: "Un, plusieurs ou tout le café", icon: Coffee },
  { target: "OTHER", title: "Offre libre", hint: "Appliquée par l’accueil", icon: Tags },
];
const KIND_OF = Object.fromEntries(KINDS.map((k) => [k.target, k])) as Record<PromotionTarget, (typeof KINDS)[number]>;

const TYPE_HINT: Record<PromotionTarget, string> = {
  PRICE: "Prix barré dans l’app et à l’accueil, appliqué tout seul.",
  BUNDLE: "Le client choisit son pass, voit le cadeau et répond Oui ou Non.",
  PRODUCT: "Prix barré au café, appliqué tout seul à la commande.",
  OTHER: "Le membre montre la carte, l’accueil applique l’offre.",
};

const HOURS: Array<{ id: string; label: string; from: string; to: string }> = [
  { id: "all", label: "Toute la journée", from: "", to: "" },
  { id: "morning", label: "8h–12h", from: "8", to: "12" },
  { id: "afternoon", label: "14h–17h", from: "14", to: "17" },
  { id: "evening", label: "18h–22h", from: "18", to: "22" },
];

const STYLES: Array<{ id: Promotion["style"]; label: string; swatch: string }> = [
  { id: "GOLD", label: "Or", swatch: "from-amber-200 via-yellow-100 to-amber-400" },
  { id: "VIOLET", label: "Violet", swatch: "from-violet-600 via-fuchsia-500 to-indigo-600" },
  { id: "GREEN", label: "Vert", swatch: "from-emerald-500 via-teal-400 to-emerald-600" },
];

const AUDIENCES: Array<{ id: Form["audience"]; title: string; hint: string }> = [
  { id: "ALL", title: "Tous les membres", hint: "Visible par tout le monde" },
  { id: "IN_SESSION", title: "Ceux sur place", hint: "Pendant leur visite" },
  { id: "FIRST_VISIT", title: "Nouveaux", hint: "1ʳᵉ visite seulement" },
];

const isTarifPromo = (t: PromotionTarget) => t === "PRICE" || t === "BUNDLE";
const isProductPromo = (t: PromotionTarget) => t === "PRODUCT" || t === "BUNDLE";

type Step = "type" | "what" | "when" | "who";

type Form = {
  title: string;
  description: string;
  target: PromotionTarget;
  /** PRODUCT / BUNDLE: ticked products, or the whole café */
  productScope: "pick" | "all";
  productIds: string[];
  priceId: string;
  /** PRICE / BUNDLE: one tarif or a whole category */
  priceScope: "one" | "category";
  priceCategory: PriceCategory | "";
  valueKind: "PERCENT" | "FIXED_DT";
  value: string;
  startsAt: string;
  endsAt: string;
  daysOfWeek: number[];
  fromHour: string;
  toHour: string;
  audience: "ALL" | "IN_SESSION" | "FIRST_VISIT";
  requiresApp: boolean;
  maxUsesPerMember: string;
  maxUses: string;
  style: Promotion["style"];
};

const blank = (): Form => ({
  title: "",
  description: "",
  target: "PRODUCT",
  productScope: "pick",
  productIds: [],
  priceId: "",
  priceScope: "one",
  priceCategory: "",
  valueKind: "PERCENT",
  value: "",
  startsAt: toLocalInput(new Date()),
  endsAt: "",
  daysOfWeek: [],
  fromHour: "",
  toHour: "",
  audience: "ALL",
  requiresApp: false,
  maxUsesPerMember: "1",
  maxUses: "",
  style: "GOLD",
});

const TEMPLATES: Array<{
  label: string;
  icon: typeof Coffee;
  apply: (f: Form, ctx: { drinkIds: string[] }) => Form;
}> = [
  {
    label: "Boisson −50 % avec un pass",
    icon: CupSoda,
    apply: (f, { drinkIds }) => ({
      ...f,
      target: "BUNDLE",
      productScope: "pick",
      productIds: drinkIds,
      title: "Boisson −50 % avec votre pass",
      description: "Une boisson au choix à moitié prix pendant votre visite.",
      valueKind: "PERCENT",
      value: "50",
      audience: "ALL",
      maxUsesPerMember: "",
      style: "GOLD",
    }),
  },
  {
    label: "Tout le café −20 % l’après-midi",
    icon: Coffee,
    apply: (f) => ({
      ...f,
      target: "PRODUCT",
      productScope: "all",
      title: "Le café à −20 %",
      description: "Toute la carte à −20 % l’après-midi, commandez dans l’app.",
      valueKind: "PERCENT",
      value: "20",
      fromHour: "14",
      toHour: "17",
      audience: "IN_SESSION",
      maxUsesPerMember: "",
      style: "GOLD",
    }),
  },
  {
    label: "Bienvenue : 2 h au prix d’1 h",
    icon: Gift,
    apply: (f) => ({
      ...f,
      target: "PRICE",
      priceScope: "one",
      title: "2 h au prix d’1 h",
      description: "Cadeau de bienvenue pour ta 1ʳᵉ visite, avec l’app installée. Choisissez le tarif « 2h ».",
      valueKind: "FIXED_DT",
      value: "1.5",
      audience: "FIRST_VISIT",
      requiresApp: true,
      maxUsesPerMember: "1",
      style: "GOLD",
    }),
  },
  {
    label: "Pass −10 %",
    icon: Ticket,
    apply: (f) => ({
      ...f,
      target: "PRICE",
      title: "−10 % sur votre pass",
      description: "Offre de la semaine, appliquée automatiquement.",
      valueKind: "PERCENT",
      value: "10",
      audience: "ALL",
      maxUsesPerMember: "1",
      style: "VIOLET",
    }),
  },
  {
    label: "Pass −20 % aujourd’hui",
    icon: BadgePercent,
    apply: (f) => ({
      ...f,
      target: "PRICE",
      title: "−20 % aujourd’hui",
      description: "Promo du jour, appliquée automatiquement.",
      valueKind: "PERCENT",
      value: "20",
      startsAt: toLocalInput(new Date()),
      endsAt: toLocalInput(endOfDay(new Date())),
      audience: "ALL",
      maxUsesPerMember: "",
      style: "VIOLET",
    }),
  },
  {
    label: "Offre libre (accueil)",
    icon: Tags,
    apply: (f) => ({
      ...f,
      target: "OTHER",
      title: "Place avec lampe −10 %",
      description: "Montrez cette carte à l’accueil pour en profiter.",
      valueKind: "PERCENT",
      value: "10",
      style: "GREEN",
    }),
  },
];

function toInput(f: Form): PromotionInput {
  const num = (v: string) => (v.trim() === "" ? null : Number(v));
  const products = isProductPromo(f.target);
  return {
    title: f.title,
    description: f.description || null,
    target: f.target,
    productId: null,
    productIds: products && f.productScope === "pick" ? f.productIds : [],
    allProducts: products && f.productScope === "all",
    priceId: isTarifPromo(f.target) && f.priceScope === "one" ? f.priceId || null : null,
    priceCategory:
      isTarifPromo(f.target) && f.priceScope === "category" ? f.priceCategory || null : null,
    valueKind: f.valueKind,
    value: Number(f.value.replace(",", ".")),
    startsAt: new Date(f.startsAt).toISOString(),
    endsAt: f.endsAt ? new Date(f.endsAt).toISOString() : null,
    daysOfWeek: f.daysOfWeek,
    fromHour: num(f.fromHour),
    toHour: num(f.toHour),
    audience: f.audience,
    requiresApp: f.requiresApp,
    maxUsesPerMember: num(f.maxUsesPerMember),
    maxUses: num(f.maxUses),
    style: f.style,
  };
}

function fromPromo(p: Promotion): Form {
  return {
    title: p.title,
    description: p.description ?? "",
    target: p.target,
    productScope: p.allProducts ? "all" : "pick",
    productIds: p.allProducts ? [] : p.productIds?.length ? p.productIds : p.productId ? [p.productId] : [],
    priceId: p.priceId ?? "",
    priceScope: p.priceCategory && !p.priceId ? "category" : "one",
    priceCategory: p.priceCategory ?? "",
    valueKind: p.valueKind,
    value: String(p.value),
    startsAt: toLocalInput(new Date(p.startsAt)),
    endsAt: p.endsAt ? toLocalInput(new Date(p.endsAt)) : "",
    daysOfWeek: p.daysOfWeek,
    fromHour: p.fromHour != null ? String(p.fromHour) : "",
    toHour: p.toHour != null ? String(p.toHour) : "",
    audience: p.audience,
    requiresApp: !!p.requiresApp,
    maxUsesPerMember: p.maxUsesPerMember != null ? String(p.maxUsesPerMember) : "",
    maxUses: p.maxUses != null ? String(p.maxUses) : "",
    style: p.style,
  };
}

/** « Café », « Café, Thé ou Jus, au choix », « 5 produits », « Tout le café » — same wording as the API. */
function productsLabel(target: PromotionTarget, all: boolean, names: string[]) {
  const or = target === "BUNDLE";
  if (all) return or ? "Un produit du café au choix" : "Tout le café";
  if (!names.length) return null;
  if (names.length === 1) return names[0];
  if (names.length <= 3) {
    return `${names.slice(0, -1).join(", ")} ${or ? "ou" : "et"} ${names[names.length - 1]}${or ? ", au choix" : ""}`;
  }
  return `${names.length} produits${or ? " au choix" : ""}`;
}

// ---------- small building blocks (same look as the check-in modal) ----------

function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{children}</p>
      {aside ? <span className="text-xs text-muted-foreground">{aside}</span> : null}
    </div>
  );
}

/** Glass chip in the banner. */
function BannerChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[84px] rounded-2xl bg-white/15 px-3 py-2 text-center backdrop-blur-sm">
      <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-100">{label}</p>
      <p
        key={value}
        className="animate-in fade-in-0 text-base font-black tabular-nums duration-200 motion-reduce:animate-none"
      >
        {value}
      </p>
    </div>
  );
}

/** Selectable card (type, product scope, audience). */
function ChoiceCard({
  active,
  onClick,
  icon,
  title,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon?: ReactNode;
  title: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex min-w-0 items-center gap-3 rounded-xl border-2 px-3 py-2.5 text-left transition-all duration-200 motion-reduce:transition-none",
        active
          ? "border-indigo-600 bg-indigo-50 shadow-sm dark:bg-indigo-950/40"
          : "border-transparent bg-muted/50 hover:border-muted-foreground/20 hover:bg-muted"
      )}
    >
      {icon ? (
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-200",
            active ? "bg-indigo-600 text-white" : "bg-background text-muted-foreground"
          )}
        >
          {icon}
        </span>
      ) : null}
      <span className="min-w-0">
        <span className="block text-sm font-bold">{title}</span>
        {hint ? <span className="block truncate text-xs text-muted-foreground">{hint}</span> : null}
      </span>
    </button>
  );
}

/** Round chip (quick values, tarifs, days, hours). */
function Pill({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors duration-200 motion-reduce:transition-none",
        active
          ? "border-indigo-600 bg-indigo-600 text-white"
          : "bg-background hover:border-muted-foreground/30 hover:bg-muted",
        className
      )}
    >
      {children}
    </button>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<[T, string]>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-lg bg-muted p-1">
      {options.map(([id, text]) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          onClick={() => onChange(id)}
          className={cn(
            "h-8 rounded-md px-3 text-sm font-semibold transition-[background-color,color,box-shadow] duration-200 motion-reduce:transition-none",
            value === id ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

const stepContent =
  "mt-0 space-y-6 data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-bottom-1 data-[state=active]:duration-200 motion-reduce:animate-none";

// ---------- the modal ----------

function PromotionDialog({
  editing,
  open,
  onClose,
  initial,
  onCreated,
}: {
  editing: Promotion | null;
  open: boolean;
  onClose: () => void;
  /** Pre-filled by Conseil IA (« Préparer la promo ») */
  initial?: Partial<Form> | null;
  onCreated?: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Form>(blank);
  const [step, setStep] = useState<Step>("type");
  const [search, setSearch] = useState("");
  useEffect(() => {
    if (!open) return;
    setForm(editing ? fromPromo(editing) : { ...blank(), ...(initial ?? {}) });
    setStep("type");
    setSearch("");
  }, [open, editing]);
  const products = useQuery({ queryKey: ["products"], queryFn: productsApi.list, enabled: open });
  const prices = useQuery({ queryKey: ["prices"], queryFn: pricesApi.list, enabled: open });
  const save = useMutation({
    mutationFn: () =>
      editing ? promotionsApi.update(editing.id, toInput(form)) : promotionsApi.create(toInput(form)),
    onSuccess: (saved) => {
      toast.success(editing ? "Offre mise à jour" : "Offre créée : elle apparaît dans l’app");
      qc.invalidateQueries({ queryKey: ["promotions"] });
      onClose();
      if (!editing && saved?.id) onCreated?.(saved.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  const productList = useMemo(
    () => [...(products.data ?? [])].sort((a, b) => a.name.localeCompare(b.name, "fr")),
    [products.data]
  );
  const drinkIds = productList.filter((p) => isDrink(p.name, p.description)).map((p) => p.id);
  const withProducts = isProductPromo(form.target);
  const byTarif = isTarifPromo(form.target);
  const all = form.productScope === "all";
  const picked = productList.filter((p) => form.productIds.includes(p.id));
  const covered = all ? productList : picked;
  const single = withProducts && !all && picked.length === 1 ? picked[0] : null;
  const needle = search.trim().toLowerCase();
  const shown = needle ? productList.filter((p) => p.name.toLowerCase().includes(needle)) : productList;
  const allDrinksPicked = drinkIds.length > 0 && drinkIds.every((id) => form.productIds.includes(id));

  const activePrices = (prices.data ?? []).filter((p) => p.isActive !== false);
  const scopePrices =
    form.priceScope === "category" && form.priceCategory
      ? activePrices.filter((p) => promoCategoriesOf(p).includes(form.priceCategory as PriceCategory))
      : [];
  const price =
    form.priceScope === "one" ? activePrices.find((p) => p.id === form.priceId) : scopePrices[0];
  const categories = Object.values(PriceCategory).filter((c) =>
    activePrices.some((p) => promoCategoriesOf(p).includes(c))
  );

  const value = Number(form.value.replace(",", ".")) || 0;
  const off = (n: number) =>
    Math.max(0, form.valueKind === "PERCENT" ? n * (1 - value / 100) : n - value);
  const label =
    value > 0
      ? form.valueKind === "PERCENT"
        ? value >= 100
          ? "Offert"
          : `−${form.value.replace(".", ",")} %`
        : `−${form.value.replace(".", ",")} DT`
      : "−?";
  const base = withProducts ? single?.sellingPrice : form.target === "PRICE" ? price?.price : null;
  const after = base != null && value > 0 ? off(base) : null;
  const itemName = withProducts
    ? productsLabel(form.target, all, picked.map((p) => p.name))
    : price?.name ?? null;
  const scopeName =
    form.priceScope === "category"
      ? form.priceCategory
        ? `Tous les pass ${CATEGORY_LABEL[form.priceCategory as PriceCategory]}`
        : "Catégorie ?"
      : price?.name ?? "Pass ?";
  const preview = {
    title: form.title || "Titre de l’offre",
    description: form.description || null,
    label,
    itemName,
    priceBefore: after != null ? base! : null,
    priceAfter: after,
    style: form.style,
    liveUntil: null,
    fromHour: form.fromHour ? Number(form.fromHour) : null,
    toHour: form.toHour ? Number(form.toHour) : null,
  };

  const today = toLocalInput(endOfDay(new Date()));
  const week = toLocalInput(endOfWeek(new Date(), { weekStartsOn: 1 }));
  const periods = [
    { id: "none", label: "Sans fin", end: "" },
    { id: "today", label: "Aujourd’hui seulement", end: today },
    { id: "week", label: "Cette semaine", end: week },
  ];
  const hours = HOURS.find((h) => h.from === form.fromHour && h.to === form.toHour);
  const whenShort =
    form.fromHour && form.toHour
      ? `${form.fromHour}h–${form.toHour}h`
      : form.endsAt === today
        ? "Aujourd’hui"
        : form.endsAt === week
          ? "Semaine"
          : form.endsAt
            ? `→ ${format(new Date(form.endsAt), "d MMM", { locale: fr })}`
            : "Toujours";

  const okWhat =
    (!withProducts || all || form.productIds.length > 0) &&
    (!byTarif || (form.priceScope === "one" ? !!form.priceId : !!form.priceCategory));
  const done: Record<Step, boolean> = {
    type: !!form.title.trim(),
    what: okWhat,
    when: value > 0,
    who: true,
  };
  const STEPS: Array<{ value: Step; label: string; count?: string }> = [
    { value: "type", label: "Type & carte" },
    {
      value: "what",
      label:
        form.target === "PRICE"
          ? "Pass"
          : form.target === "PRODUCT"
            ? "Produits"
            : form.target === "BUNDLE"
              ? "Pass & produits"
              : "Détails",
      count: withProducts ? (all ? "Tous" : String(form.productIds.length)) : undefined,
    },
    { value: "when", label: "Remise & horaire" },
    { value: "who", label: "Public & limites" },
  ];
  const idx = STEPS.findIndex((s) => s.value === step);
  const submit = () => {
    const missing = STEPS.find((s) => !done[s.value]);
    if (missing) {
      setStep(missing.value);
      toast.error(
        missing.value === "type"
          ? "Donnez un titre à l’offre"
          : missing.value === "what"
            ? "Choisissez le pass et les produits"
            : "Indiquez la remise"
      );
      return;
    }
    save.mutate();
  };

  const toggleProduct = (id: string) =>
    set({
      productIds: form.productIds.includes(id)
        ? form.productIds.filter((x) => x !== id)
        : [...form.productIds, id],
    });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[92vh] max-h-[92vh] w-[96vw] max-w-6xl flex-col gap-0 overflow-hidden rounded-2xl border-0 p-0 sm:max-w-6xl [&>button]:right-4 [&>button]:top-4 [&>button]:rounded-full [&>button]:bg-white/20 [&>button]:p-1.5 [&>button]:text-white [&>button]:opacity-100 [&>button]:transition-colors [&>button:hover]:bg-white/30">
        {/* Banner — same "mission" look as the check-in modal */}
        <div className="relative overflow-hidden bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-600 px-6 pb-4 pt-5 text-white">
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <div className="absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/10" />
            <div className="absolute -bottom-14 left-1/3 h-32 w-32 rounded-full bg-white/10" />
          </div>
          <div className="relative flex flex-wrap items-end justify-between gap-4 pr-10">
            <DialogHeader className="min-w-0 space-y-1 text-left">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-100">
                Promotions · {editing ? "Modifier l’offre" : "Nouvelle offre"}
              </p>
              <DialogTitle className="flex items-center gap-2 text-2xl font-extrabold leading-tight text-white">
                <BadgePercent className="h-6 w-6 shrink-0" />
                <span className="truncate">{form.title.trim() || (editing ? "Modifier l’offre" : "Nouvelle offre")}</span>
              </DialogTitle>
              <DialogDescription className="text-[13px] text-indigo-100">
                {TYPE_HINT[form.target]}
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-2">
              <BannerChip label="Remise" value={label} />
              <BannerChip
                label={withProducts ? "Produits" : byTarif ? "Pass" : "Type"}
                value={
                  withProducts
                    ? all
                      ? "Tous"
                      : String(form.productIds.length)
                    : byTarif
                      ? form.priceScope === "one"
                        ? price?.name.split(" ")[0] ?? "?"
                        : `${scopePrices.length} tarifs`
                      : "Libre"
                }
              />
              <BannerChip label="Quand" value={whenShort} />
            </div>
          </div>
          {!editing ? (
            <div className="relative mt-4 flex flex-wrap items-center gap-1.5">
              <span className="mr-0.5 text-[11px] font-bold text-indigo-100">Modèles :</span>
              {TEMPLATES.map((t) => (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => {
                    setForm((f) => t.apply(f, { drinkIds }));
                    setStep("what");
                  }}
                  className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm transition-colors duration-200 hover:bg-white/25 motion-reduce:transition-none"
                >
                  <t.icon className="h-3 w-3" />
                  {t.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex min-h-0 flex-1">
          <Tabs
            value={step}
            onValueChange={(v) => setStep(v as Step)}
            className="flex min-h-0 min-w-0 flex-1 flex-col"
          >
            <div className="border-b bg-muted/30 px-6 py-3">
              <TabsList className="h-auto flex-wrap justify-start gap-2 bg-transparent p-0">
                {STEPS.map((s, i) => {
                  const ok = done[s.value] && step !== s.value;
                  return (
                    <TabsTrigger
                      key={s.value}
                      value={s.value}
                      className="group gap-2 rounded-full border bg-background px-3 py-1.5 text-sm font-semibold text-muted-foreground shadow-none transition-all duration-200 data-[state=active]:border-indigo-600 data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md motion-reduce:transition-none"
                    >
                      <span
                        className={cn(
                          "flex h-5 w-5 items-center justify-center rounded-full text-[11px] transition-colors duration-200",
                          ok
                            ? "bg-emerald-500 text-white"
                            : "bg-muted text-foreground group-data-[state=active]:bg-white/25 group-data-[state=active]:text-white"
                        )}
                      >
                        {ok ? <Check className="h-3 w-3" /> : i + 1}
                      </span>
                      {s.label}
                      {s.count ? (
                        <span className="rounded-full bg-indigo-100 px-1.5 text-[10px] text-indigo-700">
                          {s.count}
                        </span>
                      ) : null}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              {/* 1 · Type & card */}
              <TabsContent value="type" className={stepContent}>
                <section>
                  <SectionTitle>Type de promo</SectionTitle>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {KINDS.map((k) => (
                      <ChoiceCard
                        key={k.target}
                        active={form.target === k.target}
                        onClick={() => set({ target: k.target })}
                        icon={<k.icon className="h-4 w-4" />}
                        title={k.title}
                        hint={k.hint}
                      />
                    ))}
                  </div>
                </section>
                <section className="space-y-3">
                  <SectionTitle>La carte dans l’app</SectionTitle>
                  <label className="block space-y-1 text-sm font-semibold">
                    Titre (gros, sur la carte)
                    <Input
                      className="h-11 rounded-xl text-base"
                      value={form.title}
                      maxLength={120}
                      placeholder="Ex. Boisson −50 % avec votre pass"
                      onChange={(e) => set({ title: e.target.value })}
                    />
                  </label>
                  <label className="block space-y-1 text-sm font-semibold">
                    Texte
                    <Textarea
                      rows={2}
                      className="rounded-xl font-normal"
                      value={form.description}
                      onChange={(e) => set({ description: e.target.value })}
                    />
                  </label>
                </section>
              </TabsContent>

              {/* 2 · Pass & products */}
              <TabsContent value="what" className={stepContent}>
                {byTarif ? (
                  <section>
                    <SectionTitle>
                      {form.target === "BUNDLE" ? "Quel pass donne le cadeau ?" : "Sur quel pass ?"}
                    </SectionTitle>
                    <div className="mb-3">
                      <Segmented
                        value={form.priceScope}
                        onChange={(v) => set({ priceScope: v })}
                        options={[
                          ["one", "Un tarif"],
                          ["category", "Toute une catégorie"],
                        ]}
                      />
                    </div>
                    <div
                      key={form.priceScope}
                      className="flex flex-wrap gap-1.5 animate-in fade-in-0 duration-200 motion-reduce:animate-none"
                    >
                      {form.priceScope === "one"
                        ? activePrices.map((p) => (
                            <Pill key={p.id} active={form.priceId === p.id} onClick={() => set({ priceId: p.id })}>
                              <span className="font-semibold">{p.name}</span>
                              <span className="tabular-nums opacity-70">{dt(p.price)}</span>
                            </Pill>
                          ))
                        : categories.map((c) => {
                            const n = activePrices.filter((p) => promoCategoriesOf(p).includes(c)).length;
                            return (
                              <Pill
                                key={c}
                                active={form.priceCategory === c}
                                onClick={() => set({ priceCategory: c })}
                              >
                                <span className="font-semibold">{CATEGORY_LABEL[c]}</span>
                                <span className="opacity-70">
                                  {n} tarif{n > 1 ? "s" : ""}
                                </span>
                              </Pill>
                            );
                          })}
                      {prices.isLoading ? <Skeleton className="h-9 w-64 rounded-full" /> : null}
                    </div>
                  </section>
                ) : null}

                {withProducts ? (
                  <section>
                    <SectionTitle
                      aside={
                        form.target === "BUNDLE"
                          ? "Le client en choisit 1 pendant sa visite"
                          : "Chaque produit coché est remisé"
                      }
                    >
                      {form.target === "BUNDLE" ? "Produits offerts" : "Produits en promo"}
                    </SectionTitle>
                    <div className="mb-3 grid gap-2 sm:grid-cols-2">
                      <ChoiceCard
                        active={all}
                        onClick={() => set({ productScope: "all" })}
                        icon={<Coffee className="h-4 w-4" />}
                        title="Tout le café"
                        hint={`Les ${productList.length} produits, et les futurs`}
                      />
                      <ChoiceCard
                        active={!all}
                        onClick={() => set({ productScope: "pick" })}
                        icon={<CheckSquare className="h-4 w-4" />}
                        title="Choisir les produits"
                        hint="Un ou plusieurs"
                      />
                    </div>
                    {all ? (
                      <div className="animate-in fade-in-0 rounded-xl bg-indigo-50 px-3.5 py-3 text-sm text-indigo-900 duration-200 motion-reduce:animate-none dark:bg-indigo-950/40 dark:text-indigo-100">
                        Toute la carte du café est en promo. Un produit ajouté plus tard l’est aussi.
                      </div>
                    ) : (
                      <div className="animate-in fade-in-0 space-y-2.5 duration-200 motion-reduce:animate-none">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="relative min-w-[200px] flex-1">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              className="h-10 rounded-xl pl-9"
                              placeholder="Chercher un produit…"
                              aria-label="Chercher un produit"
                              value={search}
                              onChange={(e) => setSearch(e.target.value)}
                            />
                          </div>
                          {drinkIds.length ? (
                            <Button
                              type="button"
                              variant="outline"
                              className={cn(
                                "h-10 gap-1.5 rounded-xl transition-colors duration-200",
                                allDrinksPicked && "border-indigo-600 bg-indigo-50 text-indigo-800"
                              )}
                              onClick={() =>
                                set({
                                  productIds: allDrinksPicked
                                    ? form.productIds.filter((id) => !drinkIds.includes(id))
                                    : [...new Set([...form.productIds, ...drinkIds])],
                                })
                              }
                            >
                              <CupSoda className="h-4 w-4" />
                              Toutes les boissons ({drinkIds.length})
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            variant="outline"
                            className="h-10 rounded-xl"
                            onClick={() => set({ productIds: productList.map((p) => p.id) })}
                          >
                            Tout cocher
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-10 rounded-xl"
                            onClick={() => set({ productIds: [] })}
                          >
                            Aucun
                          </Button>
                          <span
                            key={form.productIds.length}
                            className="animate-in fade-in-0 whitespace-nowrap rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-bold tabular-nums text-indigo-700 duration-200 motion-reduce:animate-none"
                          >
                            {form.productIds.length} / {productList.length}
                          </span>
                        </div>
                        {products.isLoading ? (
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {Array.from({ length: 6 }).map((_, i) => (
                              <Skeleton key={i} className="h-14 rounded-xl" />
                            ))}
                          </div>
                        ) : shown.length ? (
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {shown.map((p) => {
                              const on = form.productIds.includes(p.id);
                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  aria-pressed={on}
                                  onClick={() => toggleProduct(p.id)}
                                  className={cn(
                                    "flex min-w-0 items-center gap-2.5 rounded-xl border-2 px-3 py-2 text-left transition-all duration-200 motion-reduce:transition-none",
                                    on
                                      ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40"
                                      : "border-transparent bg-muted/50 hover:border-muted-foreground/20 hover:bg-muted"
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors duration-150",
                                      on ? "border-indigo-600 bg-indigo-600 text-white" : "border-muted-foreground/30 bg-background"
                                    )}
                                  >
                                    {on ? <Check className="h-3 w-3 animate-in zoom-in-50 duration-150" strokeWidth={3.5} /> : null}
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-bold">{p.name}</span>
                                    <span className="block text-xs tabular-nums text-muted-foreground">
                                      {on && value > 0 ? `${dt(p.sellingPrice)} → ${dt(off(p.sellingPrice))}` : dt(p.sellingPrice)}
                                    </span>
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="rounded-xl bg-muted/50 px-3 py-4 text-center text-sm text-muted-foreground">
                            {productList.length ? "Aucun produit ne correspond." : "Aucun produit. Ajoutez-en dans Products."}
                          </p>
                        )}
                      </div>
                    )}
                  </section>
                ) : null}

                {form.target === "OTHER" ? (
                  <div className="rounded-xl bg-muted/60 px-4 py-3.5 text-sm text-muted-foreground">
                    Offre libre : rien à choisir ici. Le membre montre la carte à l’accueil, qui applique l’offre.
                  </div>
                ) : null}
              </TabsContent>

              {/* 3 · Discount & schedule */}
              <TabsContent value="when" className={stepContent}>
                <section>
                  <SectionTitle>{form.target === "BUNDLE" ? "Remise sur le produit offert" : "Remise"}</SectionTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      inputMode="decimal"
                      aria-label="Remise"
                      className="h-12 w-24 rounded-xl border-2 border-indigo-600 text-center text-xl font-black tabular-nums"
                      value={form.value}
                      onChange={(e) => set({ value: e.target.value })}
                    />
                    <Segmented
                      value={form.valueKind}
                      onChange={(v) => set({ valueKind: v })}
                      options={[
                        ["PERCENT", "%"],
                        ["FIXED_DT", "DT"],
                      ]}
                    />
                    <span className="w-2" />
                    {(
                      [
                        ["10", "−10 %"],
                        ["20", "−20 %"],
                        ["50", "−50 %"],
                        ["100", "Offert"],
                      ] as const
                    ).map(([v, text]) => (
                      <Pill
                        key={v}
                        active={form.value === v && form.valueKind === "PERCENT"}
                        onClick={() => set({ value: v, valueKind: "PERCENT" })}
                      >
                        {text}
                      </Pill>
                    ))}
                  </div>
                </section>
                <section>
                  <SectionTitle>Période</SectionTitle>
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {periods.map((q) => (
                      <Pill
                        key={q.id}
                        active={form.endsAt === q.end}
                        onClick={() =>
                          set(q.end ? { startsAt: toLocalInput(new Date()), endsAt: q.end } : { endsAt: "" })
                        }
                      >
                        {q.label}
                      </Pill>
                    ))}
                  </div>
                  <div className="grid max-w-xl gap-3 sm:grid-cols-2">
                    <label className="block space-y-1 text-xs font-semibold text-muted-foreground">
                      Début
                      <Input
                        type="datetime-local"
                        className="h-10 rounded-xl text-sm text-foreground"
                        value={form.startsAt}
                        onChange={(e) => set({ startsAt: e.target.value })}
                      />
                    </label>
                    <label className="block space-y-1 text-xs font-semibold text-muted-foreground">
                      Fin (optionnel)
                      <Input
                        type="datetime-local"
                        className="h-10 rounded-xl text-sm text-foreground"
                        value={form.endsAt}
                        onChange={(e) => set({ endsAt: e.target.value })}
                      />
                    </label>
                  </div>
                </section>
                <section>
                  <SectionTitle aside="Aucun = tous les jours">Jours</SectionTitle>
                  <div className="flex flex-wrap gap-1.5">
                    {WEEK.map((i) => {
                      const on = form.daysOfWeek.includes(i);
                      return (
                        <Pill
                          key={i}
                          active={on}
                          className="w-14 justify-center px-0"
                          onClick={() =>
                            set({
                              daysOfWeek: on ? form.daysOfWeek.filter((x) => x !== i) : [...form.daysOfWeek, i],
                            })
                          }
                        >
                          {DAYS[i]}
                        </Pill>
                      );
                    })}
                  </div>
                </section>
                <section>
                  <SectionTitle>Happy hour</SectionTitle>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {HOURS.map((h) => (
                      <Pill key={h.id} active={hours?.id === h.id} onClick={() => set({ fromHour: h.from, toHour: h.to })}>
                        {h.label}
                      </Pill>
                    ))}
                    <span className="ml-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                      ou de
                      <Input
                        type="number"
                        min={0}
                        max={24}
                        aria-label="De (heure)"
                        placeholder="—"
                        className="h-9 w-16 rounded-xl text-center"
                        value={form.fromHour}
                        onChange={(e) => set({ fromHour: e.target.value })}
                      />
                      h à
                      <Input
                        type="number"
                        min={0}
                        max={24}
                        aria-label="À (heure)"
                        placeholder="—"
                        className="h-9 w-16 rounded-xl text-center"
                        value={form.toHour}
                        onChange={(e) => set({ toHour: e.target.value })}
                      />
                      h
                    </span>
                  </div>
                </section>
              </TabsContent>

              {/* 4 · Audience & limits */}
              <TabsContent value="who" className={stepContent}>
                <section>
                  <SectionTitle>Qui la voit ?</SectionTitle>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {AUDIENCES.map((a) => (
                      <ChoiceCard
                        key={a.id}
                        active={form.audience === a.id}
                        onClick={() => set({ audience: a.id })}
                        icon={<Users className="h-4 w-4" />}
                        title={a.title}
                        hint={a.hint}
                      />
                    ))}
                  </div>
                  <label className="mt-3 flex w-fit cursor-pointer items-center gap-2.5 text-sm">
                    <Switch checked={form.requiresApp} onCheckedChange={(v) => set({ requiresApp: v })} />
                    Seulement avec l’app installée
                  </label>
                </section>
                <section>
                  <SectionTitle>Limites</SectionTitle>
                  <div className="grid max-w-xl gap-3 sm:grid-cols-2">
                    <label className="block space-y-1 text-xs font-semibold text-muted-foreground">
                      Par client
                      <Input
                        type="number"
                        min={0}
                        placeholder="Illimité"
                        className="h-10 rounded-xl text-sm text-foreground"
                        value={form.maxUsesPerMember}
                        onChange={(e) => set({ maxUsesPerMember: e.target.value })}
                      />
                    </label>
                    <label className="block space-y-1 text-xs font-semibold text-muted-foreground">
                      Au total
                      <Input
                        type="number"
                        min={0}
                        placeholder="Illimité"
                        className="h-10 rounded-xl text-sm text-foreground"
                        value={form.maxUses}
                        onChange={(e) => set({ maxUses: e.target.value })}
                      />
                    </label>
                  </div>
                </section>
                <section>
                  <SectionTitle>Couleur de la carte</SectionTitle>
                  <div className="flex flex-wrap gap-2">
                    {STYLES.map((s) => {
                      const on = form.style === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          aria-pressed={on}
                          onClick={() => set({ style: s.id })}
                          className={cn(
                            "flex items-center gap-2 rounded-xl border-2 py-1.5 pl-1.5 pr-3.5 text-sm font-semibold transition-colors duration-200 motion-reduce:transition-none",
                            on ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40" : "hover:bg-muted"
                          )}
                        >
                          <span className={cn("h-7 w-7 rounded-lg bg-gradient-to-br", s.swatch)} />
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                </section>
              </TabsContent>
            </div>
          </Tabs>

          {/* Live preview */}
          <aside className="hidden w-[350px] shrink-0 flex-col gap-3.5 overflow-y-auto border-l bg-muted/30 p-5 lg:flex">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Aperçu dans l’app</p>
            <PromoGoldenCard
              promo={preview}
              action={
                <span className="flex h-10 w-full items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                  {form.target === "OTHER" ? "Montrer à l’accueil" : "J’en profite"}
                </span>
              }
            />
            {byTarif ? (
              <div className="rounded-2xl border bg-background p-3 pt-4">
                <p className="mb-2 text-[11px] font-bold text-muted-foreground">Choix du pass</p>
                <div
                  key={form.target}
                  className={cn(
                    "v-rise relative flex items-center gap-3 rounded-[18px] px-3 py-2.5 ring-1",
                    form.target === "BUNDLE" ? "bg-amber-50 ring-amber-300" : "bg-rose-50 ring-rose-300"
                  )}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-indigo-50 text-[11px] font-black text-indigo-700">
                    {price?.durationHours ? (price.durationHours >= 7 ? "Jour" : `${price.durationHours}h`) : "Pass"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-extrabold text-slate-900">{scopeName}</span>
                    <span
                      className={cn(
                        "block truncate text-xs",
                        form.target === "BUNDLE" ? "font-extrabold text-amber-700" : "text-slate-600"
                      )}
                    >
                      {form.target === "BUNDLE"
                        ? itemName
                          ? `+ ${single ? single.name : all ? "café au choix" : "produit au choix"} ${label}`
                          : "+ produit offert ?"
                        : form.priceScope === "category" && scopePrices.length
                          ? `${scopePrices.length} tarifs : ${label}`
                          : "Promo"}
                    </span>
                  </span>
                  {price && form.priceScope === "one" ? (
                    <span className="flex shrink-0 flex-col items-end text-sm font-black tabular-nums">
                      {form.target === "PRICE" && value > 0 ? (
                        <>
                          <span className="text-[11px] font-medium text-slate-500 line-through">{dt(price.price)}</span>
                          <span className="text-rose-700">{dt(off(price.price))}</span>
                        </>
                      ) : (
                        <span className="text-indigo-800">{dt(price.price)}</span>
                      )}
                    </span>
                  ) : null}
                  {form.target === "BUNDLE" ? (
                    <GiftBadge label="Cadeau" />
                  ) : (
                    <DealBadge label={form.endsAt === today ? `${label} aujourd’hui` : label} />
                  )}
                </div>
              </div>
            ) : null}
            {withProducts ? (
              <div className="rounded-2xl border bg-background p-3">
                <p className="mb-2 text-[11px] font-bold text-muted-foreground">
                  {form.target === "BUNDLE" ? "Au café : le client choisit 1 de ces produits" : "Au café : prix barré sur"}
                </p>
                <div className="space-y-1.5">
                  {covered.slice(0, 4).map((p) => (
                    <div
                      key={p.id}
                      className="flex animate-in fade-in-0 items-center justify-between gap-2 text-[13px] duration-200 motion-reduce:animate-none"
                    >
                      <span className="truncate font-semibold">{p.name}</span>
                      <span className="shrink-0 tabular-nums">
                        {value > 0 ? (
                          <>
                            <span className="mr-1.5 text-muted-foreground line-through">{dt(p.sellingPrice)}</span>
                            <span className="font-extrabold text-rose-700">{dt(off(p.sellingPrice))}</span>
                          </>
                        ) : (
                          dt(p.sellingPrice)
                        )}
                      </span>
                    </div>
                  ))}
                  {covered.length > 4 ? (
                    <p className="text-xs text-muted-foreground">
                      + {covered.length - 4} autre{covered.length - 4 > 1 ? "s" : ""}
                    </p>
                  ) : null}
                  {!covered.length ? <p className="text-xs text-muted-foreground">Cochez au moins un produit</p> : null}
                </div>
              </div>
            ) : null}
          </aside>
        </div>

        <DialogFooter className="gap-2 border-t px-6 py-3 sm:justify-between">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <div className="flex flex-wrap gap-2">
            {idx > 0 ? (
              <Button variant="outline" className="rounded-xl" onClick={() => setStep(STEPS[idx - 1].value)}>
                Précédent
              </Button>
            ) : null}
            {idx < STEPS.length - 1 ? (
              <Button
                variant="outline"
                className="rounded-xl border-indigo-200 bg-indigo-50 font-bold text-indigo-800 hover:bg-indigo-100"
                onClick={() => setStep(STEPS[idx + 1].value)}
              >
                Suivant
              </Button>
            ) : null}
            <Button
              className="rounded-xl bg-indigo-600 px-5 font-bold text-white transition-colors hover:bg-indigo-700"
              disabled={save.isPending}
              onClick={submit}
            >
              {editing ? "Enregistrer" : "Créer l’offre"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- the page ----------

type StatusKey = "live" | "off-hours" | "scheduled" | "paused" | "ended";

function status(p: Promotion): { key: StatusKey; label: string; tone: string; dot: string } {
  const now = Date.now();
  if (!p.isActive) return { key: "paused", label: "En pause", tone: "bg-muted text-muted-foreground", dot: "bg-zinc-400" };
  if (p.endsAt && new Date(p.endsAt).getTime() < now)
    return { key: "ended", label: "Terminée", tone: "bg-muted text-muted-foreground", dot: "bg-zinc-400" };
  if (new Date(p.startsAt).getTime() > now)
    return { key: "scheduled", label: "Programmée", tone: "bg-sky-100 text-sky-800", dot: "bg-sky-500" };
  if (p.liveNow)
    return { key: "live", label: "Visible maintenant", tone: "bg-emerald-100 text-emerald-800", dot: "bg-emerald-500" };
  return { key: "off-hours", label: "Hors créneau", tone: "bg-amber-100 text-amber-800", dot: "bg-amber-500" };
}

const FILTERS: Array<{ id: "all" | "running" | "scheduled" | "paused" | "ended"; label: string }> = [
  { id: "all", label: "Toutes" },
  { id: "running", label: "En cours" },
  { id: "scheduled", label: "Programmées" },
  { id: "paused", label: "En pause" },
  { id: "ended", label: "Terminées" },
];
type Filter = (typeof FILTERS)[number]["id"];

const inFilter = (f: Filter, k: StatusKey) =>
  f === "all" ||
  (f === "running" && (k === "live" || k === "off-hours")) ||
  (f === "scheduled" && k === "scheduled") ||
  (f === "paused" && k === "paused") ||
  (f === "ended" && k === "ended");

function MetaChip({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-muted/70 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}

function PromoCard({
  p,
  index,
  onEdit,
  onToggle,
  onDelete,
  busy,
}: {
  p: Promotion;
  index: number;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const st = status(p);
  const kind = KIND_OF[p.target];
  const tarif = p.priceName ?? (p.priceCategory ? `Tous les pass ${CATEGORY_LABEL[p.priceCategory]}` : null);
  const products = isProductPromo(p.target)
    ? p.allProducts
      ? "Tout le café"
      : p.itemName ?? (p.productIds?.length ? `${p.productIds.length} produits` : null)
    : null;
  const stats: Array<[string, string | number]> = p.stats
    ? p.target === "BUNDLE"
      ? [
          ["Proposé", p.stats.offered ?? 0],
          ["Accepté", p.stats.accepted ?? 0],
          ["Commandé", p.stats.redeemed ?? 0],
          ["Remise", dt(p.stats.discount)],
        ]
      : [
          ["Vues", p.stats.views],
          ["Utilisée", p.stats.uses],
          ["Encaissé", dt(p.stats.revenue)],
          ["Remise", dt(p.stats.discount)],
        ]
    : [];
  return (
    <article
      style={{ animationDelay: `${Math.min(index * 40, 280)}ms` }}
      className={cn(
        "flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm transition-[box-shadow,opacity] duration-200 animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both hover:shadow-md motion-reduce:animate-none",
        !p.isActive && "opacity-70"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold", st.tone)}>
            <span className="relative flex h-2 w-2">
              {st.key === "live" ? (
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 motion-safe:animate-ping" />
              ) : null}
              <span className={cn("relative inline-flex h-2 w-2 rounded-full", st.dot)} />
            </span>
            {st.label}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200">
            <kind.icon className="h-3 w-3" />
            {kind.title}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Switch checked={p.isActive} disabled={busy} onCheckedChange={onToggle} aria-label="Activer l’offre" />
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onEdit} aria-label="Modifier">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-rose-600"
            onClick={onDelete}
            aria-label="Supprimer"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <button type="button" onClick={onEdit} className="text-left" aria-label={`Modifier ${p.title}`}>
        <PromoGoldenCard promo={p} compact />
      </button>

      {tarif || products ? (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {tarif ? (
            <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2 py-1 font-semibold text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-100">
              <Ticket className="h-3.5 w-3.5" />
              {p.target === "BUNDLE" ? "Avec " : "Sur "}
              {tarif}
            </span>
          ) : null}
          {products ? (
            <span className="inline-flex min-w-0 items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 font-semibold text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              {p.target === "BUNDLE" ? <Gift className="h-3.5 w-3.5 shrink-0" /> : <Coffee className="h-3.5 w-3.5 shrink-0" />}
              <span className="truncate">
                {products}
                {p.target === "BUNDLE" ? ` ${p.label}` : ""}
              </span>
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1">
        <MetaChip icon={<CalendarDays className="h-3 w-3" />}>
          {format(new Date(p.startsAt), "d MMM", { locale: fr })}
          {p.endsAt ? ` → ${format(new Date(p.endsAt), "d MMM HH:mm", { locale: fr })}` : " · sans fin"}
        </MetaChip>
        {p.fromHour != null && p.toHour != null ? (
          <MetaChip icon={<Clock className="h-3 w-3" />}>
            {p.fromHour}h–{p.toHour}h
          </MetaChip>
        ) : null}
        {p.daysOfWeek.length ? (
          <MetaChip icon={<CalendarDays className="h-3 w-3" />}>
            {WEEK.filter((d) => p.daysOfWeek.includes(d))
              .map((d) => DAYS[d])
              .join(", ")}
          </MetaChip>
        ) : null}
        {p.audience !== "ALL" ? (
          <MetaChip icon={<Users className="h-3 w-3" />}>
            {p.audience === "IN_SESSION" ? "Sur place" : "1ʳᵉ visite"}
          </MetaChip>
        ) : null}
        {p.requiresApp ? <MetaChip icon={<Smartphone className="h-3 w-3" />}>Avec l’app</MetaChip> : null}
        {p.maxUsesPerMember ? (
          <MetaChip icon={<Sparkles className="h-3 w-3" />}>{p.maxUsesPerMember}× par client</MetaChip>
        ) : null}
      </div>

      {stats.length ? (
        <div className="mt-auto grid grid-cols-4 gap-1.5 text-center">
          {stats.map(([k, v]) => (
            <div key={k} className="rounded-xl bg-muted/50 px-1 py-1.5">
              <div className="text-sm font-bold tabular-nums">{v}</div>
              <div className="truncate text-[11px] text-muted-foreground">{k}</div>
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}

export default function PromotionsPage() {
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<{ open: boolean; editing: Promotion | null }>({
    open: false,
    editing: null,
  });
  const [filter, setFilter] = useState<Filter>("all");
  const { data, isLoading } = useQuery({ queryKey: ["promotions"], queryFn: promotionsApi.list });
  const refresh = () => qc.invalidateQueries({ queryKey: ["promotions"] });
  const toggle = useMutation({
    mutationFn: (p: Promotion) => promotionsApi.update(p.id, { isActive: !p.isActive }),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => promotionsApi.remove(id),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = useMemo(() => (data ?? []).map((p) => ({ p, key: status(p).key })), [data]);
  const totals = useMemo(() => {
    const t = { live: 0, uses: 0, revenue: 0, discount: 0 };
    for (const { p, key } of rows) {
      if (key === "live") t.live += 1;
      t.uses += p.stats?.uses ?? 0;
      t.revenue += p.stats?.revenue ?? 0;
      t.discount += p.stats?.discount ?? 0;
    }
    return t;
  }, [rows]);
  const filtered = useMemo(() => rows.filter((r) => inFilter(filter, r.key)).map((r) => r.p), [rows, filter]);
  const paged = usePaged(filtered, PER_PAGE, filter);
  const openNew = () => setDialog({ open: true, editing: null });
  // Opened from Conseil IA: the AI's promo, ready to check and save
  const conseil = useConseilDraft("PROMOTION");
  const conseilForm = useMemo<Partial<Form> | null>(() => {
    const d = conseil.draft as
      | { title?: string; description?: string; valueKind?: Form["valueKind"]; value?: number; productIds?: string[]; daysOfWeek?: number[]; fromHour?: number; toHour?: number; startsAt?: string; endsAt?: string }
      | null;
    if (!d) return null;
    return {
      title: d.title ?? "",
      description: d.description ?? "",
      target: "PRODUCT",
      productScope: d.productIds?.length ? "pick" : "all",
      productIds: d.productIds ?? [],
      valueKind: d.valueKind ?? "PERCENT",
      value: d.value != null ? String(d.value) : "",
      startsAt: d.startsAt ? toLocalInput(new Date(`${d.startsAt}T08:00:00`)) : toLocalInput(new Date()),
      endsAt: d.endsAt ? toLocalInput(new Date(`${d.endsAt}T23:00:00`)) : "",
      daysOfWeek: d.daysOfWeek ?? [],
      fromHour: d.fromHour != null ? String(d.fromHour) : "",
      toHour: d.toHour != null ? String(d.toHour) : "",
    };
  }, [conseil.draft]);
  useEffect(() => {
    if (conseilForm) setDialog({ open: true, editing: null });
  }, [conseilForm]);

  return (
    <div className="space-y-5">
      {/* Hero — same banner as the check-in modal */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-600 px-6 py-5 text-white shadow-sm">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute -right-8 -top-12 h-44 w-44 rounded-full bg-white/10" />
          <div className="absolute -bottom-16 left-1/4 h-36 w-36 rounded-full bg-white/10" />
        </div>
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-100">Marketing · Offres</p>
            <h1 className="flex items-center gap-2 text-2xl font-extrabold leading-tight">
              <BadgePercent className="h-6 w-6" />
              Promotions
            </h1>
            <p className="text-[13px] text-indigo-100">
              Des cartes dorées dans l’app : café à −50 % l’après-midi, boisson offerte avec un pass…
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <BannerChip label="En ligne" value={String(totals.live)} />
            <BannerChip label="Utilisations" value={String(totals.uses)} />
            <BannerChip label="Encaissé" value={dt(totals.revenue)} />
            <BannerChip label="Remises" value={dt(totals.discount)} />
            <Button
              onClick={openNew}
              className="ml-1 h-12 rounded-2xl bg-white px-5 font-bold text-indigo-700 shadow-md transition-colors hover:bg-indigo-50"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Nouvelle offre
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const n = rows.filter((r) => inFilter(f.id, r.key)).length;
          const on = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={on}
              onClick={() => setFilter(f.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-all duration-200 motion-reduce:transition-none",
                on
                  ? "border-indigo-600 bg-indigo-600 text-white shadow-md"
                  : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {f.label}
              <span
                className={cn(
                  "rounded-full px-1.5 text-[11px] tabular-nums transition-colors duration-200",
                  on ? "bg-white/25 text-white" : "bg-muted text-foreground"
                )}
              >
                {n}
              </span>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-80 rounded-2xl" />
          ))}
        </div>
      ) : paged.pageItems.length ? (
        <div className="space-y-2">
          <div key={`${filter}-${paged.page}`} className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {paged.pageItems.map((p, i) => (
              <PromoCard
                key={p.id}
                p={p}
                index={i}
                busy={toggle.isPending}
                onEdit={() => setDialog({ open: true, editing: p })}
                onToggle={() => toggle.mutate(p)}
                onDelete={() => confirm(`Supprimer « ${p.title} » ?`) && remove.mutate(p.id)}
              />
            ))}
          </div>
          <ListPager page={paged.page} lastPage={paged.lastPage} total={paged.total} onPage={paged.setPage} />
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-12 text-center animate-in fade-in-0 duration-200 motion-reduce:animate-none">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            <BadgePercent className="h-6 w-6" />
          </span>
          <p className="max-w-md text-sm text-muted-foreground">
            {data?.length
              ? "Aucune offre dans ce filtre."
              : "Aucune offre. Commencez avec un modèle : « Boisson −50 % avec un pass » fait venir et fait vendre du café."}
          </p>
          {!data?.length ? (
            <Button onClick={openNew} className="rounded-xl bg-indigo-600 font-bold hover:bg-indigo-700">
              <Plus className="mr-1.5 h-4 w-4" />
              Nouvelle offre
            </Button>
          ) : null}
        </div>
      )}

      <PromotionDialog
        open={dialog.open}
        editing={dialog.editing}
        initial={dialog.editing ? null : conseilForm}
        onCreated={conseil.active ? (id) => void conseil.linked(id) : undefined}
        onClose={() => {
          setDialog({ open: false, editing: null });
          if (conseil.active) conseil.dismiss();
        }}
      />
    </div>
  );
}
