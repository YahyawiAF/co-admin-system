"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Download, Link2, Phone, Unlink, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MemberSearchSelect } from "@/components/admin/MemberSearchSelect";
import { membersApi, surveysApi } from "@/lib/api/resources";
import { queryKeys } from "@/lib/query-client";
import { cn } from "@/lib/utils";
import {
  AVAILABILITY_DAYS,
  AVAILABILITY_TIMES,
  ROLE_LABEL,
  TYPE_LABEL,
  asList,
  type RespondentType,
  type SurveyDetail,
  type SurveyResponseRow,
} from "@/lib/surveys";
import { SourceTag, TypeBadge } from "./shared";

const PAGE = 50;

export function ResponsesTab({ survey }: { survey: SurveyDetail }) {
  const qc = useQueryClient();
  const [type, setType] = useState<RespondentType | "">("");
  const [all, setAll] = useState(false);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<SurveyResponseRow | null>(null);
  const [linking, setLinking] = useState<SurveyResponseRow | null>(null);
  const [exporting, setExporting] = useState(false);

  const filters = { ...(type && { type }), ...(all && { all: "1" as const }), page, pageSize: PAGE };
  const { data, isLoading } = useQuery({
    queryKey: ["survey-responses", survey.id, filters],
    queryFn: () => surveysApi.responses(survey.id, filters),
    placeholderData: (prev) => prev,
  });

  const subjectLabel = useMemo(() => {
    const m = new Map<string, string>();
    for (const qq of survey.questions) for (const o of qq.options ?? []) if (!m.has(o.value)) m.set(o.value, o.label);
    return (v: string) => m.get(v) ?? v;
  }, [survey.questions]);

  const rows = (data?.rows ?? []).filter((r) => {
    if (!q.trim()) return true;
    const hay = [r.contactName, r.member?.firstName, r.member?.lastName, r.contactPhone, r.source, r.medium, ...r.subjects.map(subjectLabel)]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE)) : 1;

  const unlink = useMutation({
    mutationFn: (r: SurveyResponseRow) => surveysApi.unlinkMember(survey.id, r.id),
    onSuccess: () => {
      toast.success("Association retirée");
      qc.invalidateQueries({ queryKey: ["survey-responses", survey.id] });
      qc.invalidateQueries({ queryKey: ["survey-dashboard", survey.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id="responses-search"
            type="search"
            placeholder="Prénom, numéro, sujet, source…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-9 w-64 max-w-full"
          />
          <div className="flex flex-wrap gap-1.5">
            {(["", "MEMBER", "NEW_MEMBER", "KNOWN", "ANONYMOUS"] as const).map((t) => (
              <button
                key={t || "all"}
                type="button"
                onClick={() => {
                  setType(t);
                  setPage(1);
                }}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-150",
                  type === t ? "border-foreground bg-foreground text-background" : "bg-background hover:bg-muted"
                )}
              >
                {t ? TYPE_LABEL[t] : "Tous"}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground" htmlFor="show-all">
            <Switch id="show-all" checked={all} onCheckedChange={(v) => { setAll(v); setPage(1); }} />
            Afficher les réponses mises de côté
          </label>
          <span className="flex-1" />
          <Button
            variant="outline"
            size="sm"
            disabled={exporting}
            onClick={async () => {
              setExporting(true);
              try {
                await surveysApi.downloadCsv(survey.id, { ...(type && { type }), all: "1" });
                toast.success("Export téléchargé");
              } catch (e) {
                toast.error((e as Error).message);
              } finally {
                setExporting(false);
              }
            }}
          >
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Client = déjà client avant de répondre · Nouveau client = devenu client après · Connu = a laissé prénom et WhatsApp · Anonyme = sans contact.
          {all ? " Les réponses grisées sont remplacées (même navigateur) ou suspectes." : ""}
        </p>

        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3 font-semibold">Date</th>
                <th className="px-3 py-2 font-semibold">Personne</th>
                <th className="px-3 py-2 font-semibold">Type</th>
                <th className="px-3 py-2 font-semibold">Rôle</th>
                <th className="px-3 py-2 font-semibold">Sujets</th>
                <th className="px-3 py-2 font-semibold">Source · medium</th>
                <th className="py-2 pl-3" />
              </tr>
            </thead>
            <tbody className="ls-stagger">
              {rows.map((r, i) => {
                const name = r.member ? `${r.member.firstName ?? ""} ${r.member.lastName ?? ""}`.trim() : r.contactName;
                const dim = r.flagged || !!r.supersededAt;
                return (
                  <tr
                    key={r.id}
                    style={{ ["--i" as string]: i }}
                    className={cn("cursor-pointer border-t transition-colors hover:bg-muted/50", dim && "opacity-50")}
                    onClick={() => setOpen(r)}
                  >
                    <td className="whitespace-nowrap py-2.5 pr-3 tabular-nums">{format(new Date(r.createdAt), "dd/MM HH:mm")}</td>
                    <td className="px-3 py-2.5">
                      {name ? <b>{name}</b> : <span className="text-muted-foreground">Anonyme</span>}
                      {r.contactPhone && !r.member ? <p className="text-xs text-muted-foreground">{r.contactPhone}</p> : null}
                      {r.flagged ? <p className="text-[11px] font-medium text-rose-600">Suspecte</p> : r.supersededAt ? <p className="text-[11px] text-muted-foreground">Remplacée</p> : null}
                    </td>
                    <td className="px-3 py-2.5"><TypeBadge type={r.type} /></td>
                    <td className="whitespace-nowrap px-3 py-2.5">{r.role ? ROLE_LABEL[r.role] : "—"}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {r.subjects.map((s) => (
                          <span key={s} className="whitespace-nowrap rounded-md bg-muted px-1.5 py-0.5 text-xs">{subjectLabel(s)}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2.5"><SourceTag source={r.source} medium={r.medium} /></td>
                    <td className="py-2.5 pl-3 text-right" onClick={(e) => e.stopPropagation()}>
                      {r.member ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-emerald-700"><Link2 className="h-3.5 w-3.5" />Relié</span>
                          {r.memberLinkMethod === "STAFF" ? (
                            <Button variant="ghost" size="sm" aria-label="Retirer l’association" onClick={() => unlink.mutate(r)}>
                              <Unlink className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </span>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => setLinking(r)}>
                          <UserPlus className="h-4 w-4" /> Associer à un client
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!isLoading && rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    {data?.total ? "Aucune réponse ne correspond à la recherche." : "Pas encore de réponse. Partagez un lien depuis l’onglet Liens."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="tabular-nums">{data ? `${data.total} réponse${data.total > 1 ? "s" : ""} · page ${page} sur ${pages}` : ""}</span>
          <span className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" /> Préc.
            </Button>
            <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              Suiv. <ChevronRight className="h-4 w-4" />
            </Button>
          </span>
        </div>
      </CardContent>

      <AnswerDialog survey={survey} row={open} onClose={() => setOpen(null)} />
      <LinkDialog survey={survey} row={linking} onClose={() => setLinking(null)} />
    </Card>
  );
}

function AnswerDialog({ survey, row, onClose }: { survey: SurveyDetail; row: SurveyResponseRow | null; onClose: () => void }) {
  const slot = (v: string) => {
    const [d, t] = v.split(":");
    return `${AVAILABILITY_DAYS.find((x) => x.value === d)?.label ?? d} ${AVAILABILITY_TIMES.find((x) => x.value === t)?.label.toLowerCase() ?? t}`;
  };
  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        {row ? (
          <>
            <DialogHeader>
              <DialogTitle>{row.member ? `${row.member.firstName ?? ""} ${row.member.lastName ?? ""}`.trim() : row.contactName || "Réponse anonyme"}</DialogTitle>
              <DialogDescription>
                {format(new Date(row.createdAt), "EEEE d MMMM à HH:mm", { locale: fr })} · <SourceTag source={row.source} medium={row.medium} />
                {row.link?.label ? ` · ${row.link.label}` : ""}
              </DialogDescription>
            </DialogHeader>
            <dl className="space-y-3 text-sm">
              {survey.questions.map((q) => {
                const v = asList(row.answers[q.id]);
                if (!v.length) return null;
                const other = row.answers[`${q.id}__other`];
                const shown = v.map((x) => (q.type === "availability" ? slot(x) : q.options?.find((o) => o.value === x)?.label ?? x));
                if (typeof other === "string" && other) shown.push(`Autre : ${other}`);
                return (
                  <div key={q.id}>
                    <dt className="text-xs font-semibold text-muted-foreground">{q.label}</dt>
                    <dd className="whitespace-pre-wrap">{shown.join(" · ")}</dd>
                  </div>
                );
              })}
              {row.contactPhone ? (
                <div>
                  <dt className="text-xs font-semibold text-muted-foreground">WhatsApp</dt>
                  <dd className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5" /> {row.contactPhone}
                    {row.contactConsentAt ? <span className="text-xs text-emerald-700">accord donné</span> : null}
                  </dd>
                </div>
              ) : null}
            </dl>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function LinkDialog({ survey, row, onClose }: { survey: SurveyDetail; row: SurveyResponseRow | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [memberId, setMemberId] = useState("");
  const { data: matches = [] } = useQuery({
    queryKey: ["survey-matches", survey.id, row?.id],
    queryFn: () => surveysApi.matches(survey.id, row!.id),
    enabled: !!row,
  });
  const { data: members = [] } = useQuery({ queryKey: queryKeys.members, queryFn: membersApi.list, enabled: !!row });
  const save = useMutation({
    mutationFn: () => surveysApi.linkMember(survey.id, row!.id, memberId),
    onSuccess: () => {
      toast.success("Réponse associée au client");
      qc.invalidateQueries({ queryKey: ["survey-responses", survey.id] });
      qc.invalidateQueries({ queryKey: ["survey-dashboard", survey.id] });
      setMemberId("");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={!!row} onOpenChange={(o) => { if (!o) { setMemberId(""); onClose(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Associer à un client</DialogTitle>
          <DialogDescription>
            {row?.contactName || "Réponse anonyme"} · {row ? format(new Date(row.createdAt), "dd/MM HH:mm") : ""}. La source d’origine de la réponse est gardée.
          </DialogDescription>
        </DialogHeader>
        {matches.length ? (
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700"><Phone className="h-3.5 w-3.5" />Même numéro WhatsApp</p>
            {matches.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMemberId(m.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                  memberId === m.id ? "border-primary bg-primary/5" : "hover:border-primary/50"
                )}
              >
                <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {(m.firstName?.[0] ?? "?") + (m.lastName?.[0] ?? "")}
                </span>
                <span>
                  <b className="block text-sm">{`${m.firstName ?? ""} ${m.lastName ?? ""}`.trim() || "Sans nom"}</b>
                  <span className="text-xs text-muted-foreground">{m.phone}{m.visitorNumber ? ` · n° ${m.visitorNumber}` : ""}</span>
                </span>
              </button>
            ))}
          </div>
        ) : row?.contactPhone ? (
          <p className="text-xs text-muted-foreground">Aucun client avec ce numéro. Cherchez-le par nom.</p>
        ) : null}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground">Chercher un client</p>
          <MemberSearchSelect members={members} value={memberId} onChange={setMemberId} placeholder="Nom ou numéro du client" />
        </div>
        <p className="text-xs text-muted-foreground">Associez seulement si vous êtes sûr que c’est la même personne.</p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button disabled={!memberId || save.isPending} onClick={() => save.mutate()}>
            <Link2 className="h-4 w-4" /> Associer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
