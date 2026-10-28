"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, format, setHours, setMinutes, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { CalendarDays, CalendarPlus, CheckCircle2, Clock, Gift, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { surveysApi } from "@/lib/api/resources";
import { cn } from "@/lib/utils";
import { AVAILABILITY_DAYS, AVAILABILITY_TIMES, plural, type LearningSession, type SurveyDetail } from "@/lib/surveys";
import { CopyButton, selectClass, sessionUrl } from "./shared";

export function SessionsTab({ survey, orgSlug, onCreate }: { survey: SurveyDetail; orgSlug: string; onCreate: () => void }) {
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["survey-sessions", survey.id],
    queryFn: () => surveysApi.sessions(survey.id),
  });
  const now = new Date();
  const registered = sessions.reduce((a, s) => a + s.registered, 0);
  const attended = sessions.reduce((a, s) => a + s.attended, 0);

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-semibold">Séances issues de ce sondage</h2>
          <span className="flex-1" />
          <Button variant="outline" size="sm" asChild>
            <Link href="/events"><CalendarDays className="h-4 w-4" /> Ouvrir Événements</Link>
          </Button>
          <Button size="sm" onClick={onCreate}>
            <Plus className="h-4 w-4" /> Créer une séance
          </Button>
        </div>
        <div className="flex flex-wrap gap-8">
          {(
            [
              [sessions.length, "séances"],
              [registered, "inscrits"],
              [attended, "venus"],
              [sessions.filter((s) => s.rewardGivenAt).length, "récompenses données"],
            ] as const
          ).map(([n, t]) => (
            <div key={t} className="text-xs text-muted-foreground">
              <b className="block text-2xl tabular-nums text-foreground">{n}</b>
              {t}
            </div>
          ))}
        </div>

        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3 font-semibold">Date</th>
                <th className="px-3 py-2 font-semibold">Séance</th>
                <th className="px-3 py-2 font-semibold">Volontaire</th>
                <th className="px-3 py-2 font-semibold">Inscrits / venus</th>
                <th className="px-3 py-2 font-semibold">Lien d’inscription</th>
                <th className="py-2 pl-3 font-semibold">Récompense donnée</th>
              </tr>
            </thead>
            <tbody className="ls-stagger">
              {sessions.map((s, i) => {
                const done = new Date(s.endAt) < now;
                return (
                  <tr key={s.id} style={{ ["--i" as string]: i }} className="border-t align-top">
                    <td className="whitespace-nowrap py-3 pr-3 tabular-nums">
                      {format(new Date(s.startAt), "EEE d MMM · HH:mm", { locale: fr })}
                      <p>
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", done ? "bg-muted text-muted-foreground" : s.status === "DRAFT" ? "bg-amber-50 text-amber-700" : "bg-primary/10 text-primary")}>
                          {done ? "Terminée" : s.status === "DRAFT" ? "Brouillon" : s.status === "CANCELLED" ? "Annulée" : "À venir"}
                        </span>
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <b>{s.title}</b>
                      <p className="text-xs text-muted-foreground">{s.subject ? `${s.subject} · ` : ""}gratuit{s.capacity ? ` · ${s.capacity} places` : ""}</p>
                    </td>
                    <td className="px-3 py-3">{s.hostName ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="whitespace-nowrap px-3 py-3 tabular-nums">
                      {s.registered} / {done ? s.attended : "—"}
                      {done && s.registered ? (
                        <div className="mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                          <div className="ls-bar h-full rounded-full bg-emerald-600" style={{ width: `${(s.attended / s.registered) * 100}%` }} />
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
                      {s.status === "PUBLISHED" ? <CopyButton text={sessionUrl(orgSlug, s.id)} label="Copier" /> : <span className="text-xs text-muted-foreground">Publiez-la dans Événements</span>}
                    </td>
                    <td className="py-3 pl-3">
                      <RewardCell survey={survey} session={s} done={done} />
                    </td>
                  </tr>
                );
              })}
              {!isLoading && !sessions.length ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    Aucune séance. Dans Résultats, choisissez le sujet le plus demandé puis « Créer une séance ».
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          Le lien d’inscription marche sans compte : prénom + téléphone. La personne est reliée à sa réponse au sondage si elle s’inscrit depuis le même téléphone.
        </p>
      </CardContent>
    </Card>
  );
}

function RewardCell({ survey, session, done }: { survey: SurveyDetail; session: LearningSession; done: boolean }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(session.rewardNote ?? "1 semaine coworking offerte");
  const save = useMutation({
    mutationFn: (given: boolean) => surveysApi.setReward(survey.id, session.id, given, note.trim() || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["survey-sessions", survey.id] });
      setEditing(false);
      toast.success("Récompense notée");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (session.rewardGivenAt) {
    return (
      <span className="flex items-start gap-1.5 text-xs text-emerald-700">
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span className="text-foreground">
          <b>{format(new Date(session.rewardGivenAt), "d MMM", { locale: fr })}</b>
          {session.rewardNote ? ` · ${session.rewardNote}` : ""}
          <button type="button" className="ml-2 text-muted-foreground underline" onClick={() => save.mutate(false)}>Annuler</button>
        </span>
      </span>
    );
  }
  if (!session.hostName && !session.hostResponseId) return <span className="text-xs text-muted-foreground">Pas de volontaire</span>;
  if (!done) return <span className="text-xs text-muted-foreground">Après la séance</span>;
  if (editing) {
    return (
      <form
        className="ls-enter flex flex-wrap items-center gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(true);
        }}
      >
        <Input id={`rw-${session.id}`} className="h-8 w-48 text-xs" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="Ex. semaine offerte" />
        <Button size="sm" type="submit" disabled={save.isPending}>Enregistrer</Button>
        <Button size="sm" type="button" variant="ghost" onClick={() => setEditing(false)}>Annuler</Button>
      </form>
    );
  }
  return (
    <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
      <Gift className="h-4 w-4" /> Noter la récompense
    </Button>
  );
}

const TIME_HOUR: Record<string, number> = { morning: 10, afternoon: 14, evening: 18 };
const JS_DAY: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

/** Next date (from tomorrow) for a weekday + moment. */
function nextSlot(day: string, time: string) {
  let d = addDays(startOfDay(new Date()), 1);
  while (d.getDay() !== JS_DAY[day]) d = addDays(d, 1);
  return setMinutes(setHours(d, TIME_HOUR[time] ?? 18), 0);
}
const toLocal = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm");

export function CreateSessionDialog({
  survey,
  subjects,
  slots,
  initialSubject,
  open,
  onClose,
}: {
  survey: SurveyDetail;
  subjects: Array<{ value: string; label: string; learners: number; volunteers: number }>;
  slots: Array<{ day: string; time: string; count: number }>;
  initialSubject: string | null;
  open: boolean;
  onClose: (created?: LearningSession) => void;
}) {
  const qc = useQueryClient();
  const [subject, setSubject] = useState("");
  const [title, setTitle] = useState("");
  const [host, setHost] = useState("");
  const [start, setStart] = useState("");
  const [hours, setHours_] = useState("2");
  const [capacity, setCapacity] = useState("15");
  const [location, setLocation] = useState("");
  const [publish, setPublish] = useState(true);

  const subjectLabel = subjects.find((s) => s.value === subject)?.label ?? "";
  const { data: volunteers = [] } = useQuery({
    queryKey: ["survey-volunteers", survey.id, subject],
    queryFn: () => surveysApi.volunteers(survey.id, subject || undefined),
    enabled: open,
  });
  const best = useMemo(() => [...slots].filter((s) => s.count).sort((a, b) => b.count - a.count).slice(0, 3), [slots]);

  useEffect(() => {
    if (!open) return;
    const s = initialSubject ?? subjects[0]?.value ?? "";
    setSubject(s);
    setTitle(subjects.find((x) => x.value === s)?.label ?? "");
    setHost("");
    setStart(best[0] ? toLocal(nextSlot(best[0].day, best[0].time)) : toLocal(setHours(addDays(startOfDay(new Date()), 3), 18)));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const create = useMutation({
    mutationFn: () => {
      const startAt = new Date(start);
      const endAt = new Date(startAt.getTime() + (Number(hours) || 2) * 3600_000);
      return surveysApi.createSession(survey.id, {
        title: title.trim(),
        subject: subjectLabel || undefined,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        capacity: Number(capacity) || undefined,
        location: location.trim() || undefined,
        hostResponseId: host || undefined,
        status: publish ? "PUBLISHED" : "DRAFT",
      });
    },
    onSuccess: (ev) => {
      qc.invalidateQueries({ queryKey: ["survey-sessions", survey.id] });
      qc.invalidateQueries({ queryKey: ["survey-dashboard", survey.id] });
      onClose(ev);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dayLabel = (d: string) => AVAILABILITY_DAYS.find((x) => x.value === d)?.label ?? d;
  const timeLabel = (t: string) => AVAILABILITY_TIMES.find((x) => x.value === t)?.label.toLowerCase() ?? t;
  const subj = subjects.find((s) => s.value === subject);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Créer une séance{subjectLabel ? ` · ${subjectLabel}` : ""}</DialogTitle>
          <DialogDescription>Séance gratuite ajoutée à Événements. Les non-clients s’inscrivent avec prénom + téléphone.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim() || !start) return toast.error("Titre et date requis");
            create.mutate();
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="se-subject">Sujet</Label>
              <select
                id="se-subject"
                className={cn(selectClass, "w-full")}
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  setHost("");
                  if (!title.trim() || subjects.some((s) => s.label === title)) setTitle(subjects.find((s) => s.value === e.target.value)?.label ?? "");
                }}
              >
                {subjects.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              {subj ? <p className="text-xs text-muted-foreground">{plural(subj.learners, "apprenant")} · {plural(subj.volunteers, "volontaire")}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="se-title">Titre</Label>
              <Input id="se-title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. Club de conversation" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="se-host">Volontaire</Label>
            <select id="se-host" className={cn(selectClass, "w-full")} value={host} onChange={(e) => setHost(e.target.value)}>
              <option value="">À trouver</option>
              {volunteers.map((v) => (
                <option key={v.responseId} value={v.responseId}>
                  {v.name || "Anonyme"}
                  {v.phone ? ` · ${v.phone}` : ""}
                  {v.host === "yes" ? " · veut animer" : v.host === "maybe" ? " · peut-être" : ""}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              {volunteers.length ? `${volunteers.length} volontaire${volunteers.length > 1 ? "s" : ""} pour ce sujet.` : "Aucun volontaire pour ce sujet pour l’instant."}
              {volunteers.some((v) => !v.phone) ? " Les anonymes ne peuvent pas être contactés." : ""}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="se-start">Créneau</Label>
            {best.length ? (
              <div className="flex flex-wrap gap-1.5">
                {best.map((b) => {
                  const d = nextSlot(b.day, b.time);
                  const on = toLocal(d) === start;
                  return (
                    <button
                      key={`${b.day}:${b.time}`}
                      type="button"
                      onClick={() => setStart(toLocal(d))}
                      className={cn("flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors", on ? "border-primary bg-primary/5" : "hover:border-primary/50")}
                    >
                      <Clock className="h-3.5 w-3.5" />
                      <span>
                        <b className="block">{format(d, "EEE d MMM · HH:mm", { locale: fr })}</b>
                        {b.count} volontaire{b.count > 1 ? "s libres" : " libre"} {dayLabel(b.day).toLowerCase()} {timeLabel(b.time)}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <Input id="se-start" type="datetime-local" className="w-auto" value={start} onChange={(e) => setStart(e.target.value)} />
              <select id="se-hours" aria-label="Durée" className={selectClass} value={hours} onChange={(e) => setHours_(e.target.value)}>
                {["1", "1.5", "2", "3"].map((h) => (
                  <option key={h} value={h}>{h.replace(".", ",")} h</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="se-cap">Places</Label>
              <Input id="se-cap" type="number" min={2} max={500} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="se-loc">Lieu (optionnel)</Label>
              <Input id="se-loc" value={location} maxLength={120} onChange={(e) => setLocation(e.target.value)} placeholder="Ex. Salle 2" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm" htmlFor="se-publish">
            <input id="se-publish" type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
            Publier tout de suite dans l’app (sinon brouillon)
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onClose()}>Annuler</Button>
            <Button type="submit" disabled={create.isPending}>
              <CalendarPlus className="h-4 w-4" /> Créer la séance
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
