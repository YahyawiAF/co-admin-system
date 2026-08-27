"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Pencil, Plus, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { eventsApi } from "@/lib/api/resources";
import { queryKeys } from "@/lib/query-client";
import type { EventKind, EventStatus, SpaceEvent } from "@/lib/types";
import { ImageUpload } from "@/components/admin/ImageUpload";

const KIND_LABEL: Record<EventKind, string> = {
  WORKSHOP: "Atelier",
  NETWORKING: "Networking",
  OTHER: "Autre",
};

const STATUS_LABEL: Record<EventStatus, string> = {
  DRAFT: "Brouillon",
  PUBLISHED: "Publié",
  CANCELLED: "Annulé",
};

function toLocalInput(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type FormState = {
  title: string;
  description: string;
  kind: EventKind;
  location: string;
  startAt: string;
  endAt: string;
  capacity: string;
  status: EventStatus;
  coverImage: string;
};

const emptyForm: FormState = {
  title: "",
  description: "",
  kind: "OTHER",
  location: "",
  startAt: "",
  endAt: "",
  capacity: "",
  status: "PUBLISHED",
  coverImage: "",
};

export default function AdminEventsPage() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [edit, setEdit] = useState<SpaceEvent | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [code, setCode] = useState("");

  const { data: events = [], isLoading } = useQuery({
    queryKey: queryKeys.events,
    queryFn: () => eventsApi.adminList(),
  });
  const { data: detail } = useQuery({
    queryKey: ["admin-event", detailId],
    queryFn: () => eventsApi.adminGet(detailId!),
    enabled: !!detailId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.events });
    queryClient.invalidateQueries({ queryKey: ["admin-event"] });
  };

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        kind: form.kind,
        location: form.location.trim() || undefined,
        startAt: new Date(form.startAt).toISOString(),
        endAt: new Date(form.endAt).toISOString(),
        capacity: form.capacity ? Number(form.capacity) : null,
        status: form.status,
        coverImage: form.coverImage || "",
      };
      return edit
        ? eventsApi.update(edit.id, payload)
        : eventsApi.create(payload);
    },
    onSuccess: () => {
      toast.success(edit ? "Événement mis à jour" : "Événement créé");
      setFormOpen(false);
      setEdit(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelEv = useMutation({
    mutationFn: (id: string) => eventsApi.cancel(id),
    onSuccess: () => {
      toast.success("Événement annulé");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const attend = useMutation({
    mutationFn: () => eventsApi.markAttendance(detailId!, code),
    onSuccess: () => {
      toast.success("Présence enregistrée");
      setCode("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openCreate = () => {
    setEdit(null);
    setForm(emptyForm);
    setFormOpen(true);
  };
  const openEdit = (event: SpaceEvent) => {
    setEdit(event);
    setForm({
      title: event.title,
      description: event.description || "",
      kind: event.kind,
      location: event.location || "",
      startAt: toLocalInput(event.startAt),
      endAt: toLocalInput(event.endAt),
      capacity: event.capacity != null ? String(event.capacity) : "",
      status: event.status,
      coverImage: event.coverImage || "",
    });
    setFormOpen(true);
  };

  const sorted = useMemo(
    () =>
      [...events].sort(
        (a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime()
      ),
    [events]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Événements</h1>
          <p className="text-sm text-muted-foreground">
            Ateliers, networking, inscriptions et présence.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          Nouvel événement
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : sorted.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Aucun événement. Créez le premier.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {sorted.map((event) => (
            <Card key={event.id}>
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                {event.coverImage ? (
                  <img
                    src={event.coverImage}
                    alt=""
                    className="h-16 w-24 rounded-md object-cover"
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{event.title}</p>
                    <Badge variant="outline">{KIND_LABEL[event.kind]}</Badge>
                    <Badge
                      variant={
                        event.status === "CANCELLED"
                          ? "destructive"
                          : event.status === "PUBLISHED"
                            ? "default"
                            : "secondary"
                      }
                    >
                      {STATUS_LABEL[event.status]}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(event.startAt), "d MMM yyyy HH:mm", {
                      locale: fr,
                    })}
                    {event.location ? ` · ${event.location}` : ""}
                    {" · "}
                    {event.capacity == null
                      ? `${event.registeredCount || 0} inscrits`
                      : `${event.registeredCount || 0}/${event.capacity}`}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDetailId(event.id)}
                >
                  <ScanLine className="mr-1 h-4 w-4" />
                  Présence
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openEdit(event)}
                >
                  <Pencil className="mr-1 h-4 w-4" />
                  Modifier
                </Button>
                {event.status !== "CANCELLED" ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => cancelEv.mutate(event.id)}
                  >
                    Annuler
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {edit ? "Modifier l’événement" : "Nouvel événement"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Titre</Label>
              <Input
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Type</Label>
                <Select
                  value={form.kind}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, kind: v as EventKind }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WORKSHOP">Atelier</SelectItem>
                    <SelectItem value="NETWORKING">Networking</SelectItem>
                    <SelectItem value="OTHER">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Statut</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, status: v as EventStatus }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PUBLISHED">Publié</SelectItem>
                    <SelectItem value="DRAFT">Brouillon</SelectItem>
                    <SelectItem value="CANCELLED">Annulé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Début</Label>
                <Input
                  type="datetime-local"
                  value={form.startAt}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, startAt: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Fin</Label>
                <Input
                  type="datetime-local"
                  value={form.endAt}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, endAt: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Lieu</Label>
                <Input
                  value={form.location}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, location: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Places max (vide = illimité)</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.capacity}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, capacity: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>
            <ImageUpload
              label="Image de l’événement"
              value={form.coverImage || null}
              onChange={(url) =>
                setForm((f) => ({ ...f, coverImage: url || "" }))
              }
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Fermer
            </Button>
            <Button
              disabled={!form.title.trim() || !form.startAt || !form.endAt || save.isPending}
              onClick={() => save.mutate()}
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!detailId}
        onOpenChange={(o) => {
          if (!o) setDetailId(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{detail?.title || "Présence"}</DialogTitle>
          </DialogHeader>
          {detail ? (
            <div className="space-y-4">
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (code.trim()) attend.mutate();
                }}
              >
                <Input
                  autoFocus
                  placeholder="Code / scan QR"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                />
                <Button type="submit" disabled={!code.trim() || attend.isPending}>
                  Marquer présent
                </Button>
              </form>
              {detail.feedback.count > 0 ? (
                <p className="text-sm text-muted-foreground">
                  Avis : {detail.feedback.average}/5 ({detail.feedback.count})
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Pas encore d’avis.</p>
              )}
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {detail.registrations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun inscrit.</p>
                ) : (
                  detail.registrations.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="font-medium">
                          {[r.member.firstName, r.member.lastName]
                            .filter(Boolean)
                            .join(" ") || r.member.phone}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {r.attendanceCode}
                          {r.feedbackRating
                            ? ` · ${r.feedbackRating}/5`
                            : ""}
                        </p>
                      </div>
                      <Badge variant="outline">{r.status}</Badge>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
