"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { GalleryUpload } from "@/components/admin/GalleryUpload";
import { ChairMap } from "@/components/visitor/reserve/ChairMap";
import { TablePhoto } from "@/components/visitor/reserve/TablePhoto";
import { facilityApi } from "@/lib/api/resources";
import { queryKeys } from "@/lib/query-client";
import type { Facility, Space, SpaceTable } from "@/lib/types";
import { cn } from "@/lib/utils";
import { dt } from "./shared";

const CARD = "rounded-2xl border bg-card p-4";

/** Main photo first, then the gallery (no duplicates). */
function photosOf(t: SpaceTable | null) {
  if (!t) return [];
  return Array.from(new Set([t.imageUrl, ...(t.galleryUrls || [])].filter((u): u is string => !!u)));
}
const TITLE = "text-[11px] font-bold uppercase tracking-wide text-muted-foreground";

export function ResaSettingsView({ facility, spaces }: { facility: Facility | undefined; spaces: Space[] }) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["facility-layout"] });
    queryClient.invalidateQueries({ queryKey: queryKeys.facility });
  };

  // ----- Fee + rules -----
  const [resa, setResa] = useState({ fee: "2", perPlace: false, maxDaysAhead: "14", maxPlaces: "4", autoApprove: false });
  useEffect(() => {
    if (!facility) return;
    setResa({
      fee: String(facility.reservationFee ?? 2),
      perPlace: !!facility.reservationFeePerPlace,
      maxDaysAhead: String(facility.reservationMaxDaysAhead ?? 14),
      maxPlaces: String(facility.reservationMaxPlaces ?? 4),
      autoApprove: !!facility.reservationAutoApprove,
    });
  }, [facility]);
  const fee = Math.max(0, Number(resa.fee.replace(",", ".")) || 0);
  const saveResa = useMutation({
    mutationFn: () =>
      facilityApi.update(facility!.id, {
        reservationFee: fee,
        reservationFeePerPlace: resa.perPlace,
        reservationMaxDaysAhead: Math.max(1, Math.round(Number(resa.maxDaysAhead) || 14)),
        reservationMaxPlaces: Math.max(1, Math.round(Number(resa.maxPlaces) || 4)),
        reservationAutoApprove: resa.autoApprove,
      }),
    onSuccess: () => {
      toast.success("Réglages enregistrés");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ----- Map + table photo -----
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const space = spaces.find((s) => s.id === spaceId) ?? spaces[0] ?? null;
  const [tableId, setTableId] = useState<string | null>(null);
  const table = space?.tables?.find((t) => t.id === tableId) ?? space?.tables?.[0] ?? null;

  const [draft, setDraft] = useState({ description: "", galleryUrls: [] as string[] });
  useEffect(() => {
    setDraft({
      description: table?.description || "",
      galleryUrls: photosOf(table),
    });
  }, [table?.id, table?.description, table?.galleryUrls, table?.imageUrl]);
  const saveTable = useMutation({
    mutationFn: () =>
      facilityApi.updateTable(table!.id, {
        description: draft.description.trim() || null,
        galleryUrls: draft.galleryUrls,
        imageUrl: draft.galleryUrls[0] ?? null,
      }),
    onSuccess: () => {
      toast.success(`${table?.name} enregistrée`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const saveZonePhotos = useMutation({
    mutationFn: (urls: string[]) => facilityApi.updateSpace(space!.id, { galleryUrls: urls }),
    onSuccess: () => {
      toast.success("Photos de l’espace enregistrées");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const previewTable = table ? { ...table, description: draft.description, galleryUrls: draft.galleryUrls, imageUrl: draft.galleryUrls[0] ?? null } : null;
  const dirty =
    !!table &&
    (draft.description.trim() !== (table.description || "") ||
      JSON.stringify(draft.galleryUrls) !== JSON.stringify(photosOf(table)));

  return (
    <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)_340px]">
      <aside className="space-y-4">
        <section className={CARD}>
          <p className={TITLE}>Frais de réservation</p>
          <div className="mt-3 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="resa-fee">Montant (DT)</Label>
              <Input id="resa-fee" inputMode="decimal" value={resa.fee} onChange={(e) => setResa((r) => ({ ...r, fee: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
              {(
                [
                  [false, "Par réservation"],
                  [true, "Par place"],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={label}
                  type="button"
                  aria-pressed={resa.perPlace === v}
                  onClick={() => setResa((r) => ({ ...r, perPlace: v }))}
                  className={cn(
                    "h-8 rounded-md text-[13px] font-semibold transition-[background-color,color,box-shadow] duration-200 motion-reduce:transition-none",
                    resa.perPlace === v ? "bg-background shadow-sm" : "text-muted-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Exemple, 3 places : <strong className="text-foreground">{resa.perPlace ? `${dt(fee)} × 3 = ${dt(fee * 3)}` : dt(fee)}</strong>
            </p>
          </div>
        </section>

        <section className={CARD}>
          <p className={TITLE}>Règles</p>
          <div className="mt-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="resa-days">Réservable jusqu’à (jours)</Label>
              <Input
                id="resa-days"
                type="number"
                min={1}
                max={60}
                className="w-20"
                value={resa.maxDaysAhead}
                onChange={(e) => setResa((r) => ({ ...r, maxDaysAhead: e.target.value }))}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="resa-places">Places max par demande</Label>
              <Input
                id="resa-places"
                type="number"
                min={1}
                max={12}
                className="w-20"
                value={resa.maxPlaces}
                onChange={(e) => setResa((r) => ({ ...r, maxPlaces: e.target.value }))}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="resa-auto">
                Confirmation automatique
                <span className="mt-0.5 block text-xs font-normal text-muted-foreground">Sinon l’accueil valide chaque demande</span>
              </Label>
              <Switch id="resa-auto" checked={resa.autoApprove} onCheckedChange={(v) => setResa((r) => ({ ...r, autoApprove: v }))} />
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-indigo-50 p-4 ring-1 ring-indigo-200">
          <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-700">Aperçu visiteur</p>
          <p className="mt-2 inline-flex rounded-lg bg-amber-100 px-2 py-0.5 text-xs font-extrabold text-amber-900">
            Frais de réservation {dt(fee)}
            {resa.perPlace ? " / place" : ""}
          </p>
          <p className="mt-1.5 text-xs text-indigo-900">Réglés à l’accueil le jour J, en plus du tarif sur place.</p>
        </section>

        <Button className="w-full" disabled={!facility || saveResa.isPending} onClick={() => saveResa.mutate()}>
          Enregistrer les réglages
        </Button>
      </aside>

      <section className={cn(CARD, "min-w-0")}>
        <div className="flex flex-wrap items-center gap-2">
          {spaces.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={s.id === space?.id}
              onClick={() => {
                setSpaceId(s.id);
                setTableId(null);
              }}
              className={cn(
                "h-9 rounded-lg px-3.5 text-[13px] font-extrabold transition-colors duration-200 motion-reduce:transition-none",
                s.id === space?.id ? "bg-indigo-600 text-white" : "bg-muted text-slate-700 hover:bg-muted/70"
              )}
            >
              {s.name}
            </button>
          ))}
          <span className="flex-1" />
          <Link href="/facility" className="text-xs font-semibold text-indigo-700 hover:underline">
            Modifier le plan (tables, places) → Établissement
          </Link>
        </div>
        {space ? (
          <>
            <div className="mt-3">
              <ChairMap space={space} activeTableId={table?.id ?? null} onActiveTable={setTableId} showOrder={false} height={520} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Cliquez une table pour changer sa photo et sa description.</p>
            <div className="mt-3 border-t pt-3">
              <GalleryUpload
                key={space.id}
                label={`Photos de l’espace · ${space.name}`}
                hint="Utilisées quand une table n’a pas encore de photo."
                values={space.galleryUrls || []}
                onChange={(urls) => saveZonePhotos.mutate(urls)}
              />
            </div>
          </>
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">Aucun espace avec des tables.</p>
        )}
      </section>

      <aside className={cn(CARD, "space-y-3")}>
        {space && previewTable ? (
          <div key={previewTable.id} className="v-rise space-y-3">
            <p className={TITLE}>
              {previewTable.name} · {space.name}
            </p>
            <TablePhoto space={space} table={previewTable} badge="Vu par les visiteurs" className="h-[160px]" />
            <GalleryUpload
              label="Photos de la table"
              hint="Prise depuis l’entrée, la table bien visible. La 1re photo est affichée."
              values={draft.galleryUrls}
              onChange={(urls) => setDraft((d) => ({ ...d, galleryUrls: urls }))}
            />
            <div className="space-y-1.5">
              <Label htmlFor="table-desc">Description (vue par les visiteurs)</Label>
              <Textarea
                id="table-desc"
                rows={2}
                maxLength={140}
                placeholder="Ex. Grande table · près de la fenêtre"
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              />
            </div>
            <p className="text-sm font-semibold">
              {(previewTable.seats || []).filter((s) => s.isActive !== false).length} places autour de la table
            </p>
            <Button className="w-full" disabled={!dirty || saveTable.isPending} onClick={() => saveTable.mutate()}>
              Enregistrer la table
            </Button>
          </div>
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">Choisissez une table sur le plan.</p>
        )}
      </aside>
    </div>
  );
}
