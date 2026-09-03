"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import {
  bookingApi,
  facilityApi,
  journalApi,
  membersApi,
  organizationsApi,
} from "@/lib/api/resources";
import { queryKeys } from "@/lib/query-client";
import { BOOKING_EVENT_KEY } from "@/lib/facility-spaces";
import { layoutSeatsOnTable, SEAT_LAYOUT_OPTIONS, type SeatLayoutMode } from "@/lib/seat-layout";
import { FloorPlanCanvas, type EditTool, FIXTURE_OPTIONS } from "@/components/admin/FloorPlanCanvas";
import { ImageUpload } from "@/components/admin/ImageUpload";
import { GalleryUpload } from "@/components/admin/GalleryUpload";
import { VisitorQrCard } from "@/components/admin/VisitorQrCard";
import { PriceCategory, type FixtureKind, type Space, type SpaceFixture, type SpaceSeat, type SpaceTable, type SpaceWall } from "@/lib/types";
import { PRICE_CATEGORY_LABEL, spaceCategoriesOf } from "@/lib/tarif-labels";
import { SPACE_RESERVE_MODE_LABEL } from "@/lib/space-occupy";
import { isActiveVisit } from "@/lib/journal-utils";

type TableFormState = {
  name: string;
  imageUrl: string;
  galleryUrls: string[];
  seatCount: number;
  overflowCount: number;
};

const emptyTableForm = (): TableFormState => ({
  name: "",
  imageUrl: "",
  galleryUrls: [],
  seatCount: 4,
  overflowCount: 1,
});

const SPACE_VISIT_CATS = [
  PriceCategory.JOURNEE,
  PriceCategory.OPEN_SPACE,
  PriceCategory.SALLE,
] as const;

function toggleSpaceCategory(
  current: PriceCategory[],
  cat: PriceCategory
): PriceCategory[] {
  const on = current.includes(cat);
  if (on) {
    const next = current.filter((c) => c !== cat);
    return next.length ? next : current;
  }
  return [...current, cat];
}

function SpaceWifiEditor({
  space,
  onSave,
  saving,
}: {
  space: Space;
  onSave: (data: { wifiSsid: string | null; wifiPassword: string | null }) => void;
  saving?: boolean;
}) {
  const [ssid, setSsid] = useState(space.wifiSsid || "");
  const [password, setPassword] = useState(space.wifiPassword || "");

  useEffect(() => {
    setSsid(space.wifiSsid || "");
    setPassword(space.wifiPassword || "");
  }, [space.id, space.wifiSsid, space.wifiPassword]);

  const dirty =
    ssid.trim() !== (space.wifiSsid || "") ||
    password.trim() !== (space.wifiPassword || "");

  return (
    <div className="rounded-lg border p-3 space-y-3">
      <p className="text-sm font-medium">Wi‑Fi de l’espace</p>
      <p className="text-xs text-muted-foreground">
        Affiché au visiteur après confirmation de sa place. Modifiez puis
        enregistrez.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Nom du réseau (SSID)</Label>
          <Input
            value={ssid}
            onChange={(e) => setSsid(e.target.value)}
            placeholder="Collabora-Guest"
          />
        </div>
        <div className="space-y-1">
          <Label>Mot de passe</Label>
          <Input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe Wi‑Fi"
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={saving || !dirty}
          onClick={() =>
            onSave({
              wifiSsid: ssid.trim() || null,
              wifiPassword: password.trim() || null,
            })
          }
        >
          Enregistrer Wi‑Fi
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={saving || (!ssid && !password && !space.wifiSsid && !space.wifiPassword)}
          onClick={() => {
            setSsid("");
            setPassword("");
            onSave({ wifiSsid: null, wifiPassword: null });
          }}
        >
          Effacer
        </Button>
      </div>
    </div>
  );
}

export default function FacilityPage() {
  const queryClient = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const [tool, setTool] = useState<EditTool>("select");
  const [fixtureKind, setFixtureKind] = useState<FixtureKind>("ARMCHAIR");
  /** Space selected for Plan + Réglages (unified Espaces tab). */
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);
  const [spacePanel, setSpacePanel] = useState<"plan" | "config">("plan");
  const [showNewSpace, setShowNewSpace] = useState(false);
  const [selectedTable, setSelectedTable] = useState<SpaceTable | null>(null);
  const [selectedWall, setSelectedWall] = useState<SpaceWall | null>(null);
  const [selectedFixture, setSelectedFixture] = useState<SpaceFixture | null>(null);
  const [selectedSeat, setSelectedSeat] = useState<SpaceSeat | null>(null);
  const [tableDraft, setTableDraft] = useState({
    name: "",
    imageUrl: "" as string | null,
    galleryUrls: [] as string[],
    width: 120,
    height: 80,
  });
  const [wallDraft, setWallDraft] = useState({
    label: "",
    width: 200,
    height: 12,
    rotation: 0,
  });
  const [fixtureDraft, setFixtureDraft] = useState({
    label: "",
    width: 44,
    height: 44,
    rotation: 0,
  });
  const [seatDraft, setSeatDraft] = useState({
    label: "",
    isOverflow: false,
  });
  const [assignSeat, setAssignSeat] = useState<SpaceSeat | null>(null);
  const [memberId, setMemberId] = useState("");
  const [seatOverflow, setSeatOverflow] = useState(false);

  const [newSpaceName, setNewSpaceName] = useState("");
  const [newSpaceCategories, setNewSpaceCategories] = useState<PriceCategory[]>(
    [PriceCategory.JOURNEE]
  );
  const [floorPlanUrl, setFloorPlanUrl] = useState<string | null>(null);
  const [tableForms, setTableForms] = useState<Record<string, TableFormState>>(
    {}
  );
  /** Table being edited in « Espaces & tables » (explicit Appliquer / Annuler). */
  const [manageTableId, setManageTableId] = useState<string | null>(null);
  const [manageTableDraft, setManageTableDraft] = useState<{
    name: string;
    imageUrl: string | null;
    galleryUrls: string[];
    width: number;
    height: number;
  }>({ name: "", imageUrl: null, galleryUrls: [], width: 120, height: 80 });
  const [manageTableBusy, setManageTableBusy] = useState(false);
  const [seatLayoutMode, setSeatLayoutMode] =
    useState<SeatLayoutMode>("left-right");

  const { data: facilities = [], isLoading: facilitiesLoading } = useQuery({
    queryKey: queryKeys.facility,
    queryFn: () => facilityApi.list(),
  });
  const { data: organizations = [] } = useQuery({
    queryKey: ["organizations"],
    queryFn: () => organizationsApi.list(),
  });

  /** Prefer the real desk facility (has places/spaces), not empty auto-created shells. */
  const facility = useMemo(() => {
    if (!facilities.length) return undefined;
    const scored = [...facilities].sort((a, b) => {
      const score = (f: (typeof facilities)[0]) => {
        const places =
          f.places && typeof f.places === "object"
            ? Object.keys(f.places).length
            : 0;
        const spaces = Array.isArray(f.spaces) ? f.spaces.length : 0;
        return places * 100 + spaces * 50 + (f.nbrPlaces || 0);
      };
      return score(b) - score(a);
    });
    return scored[0];
  }, [facilities]);

  useEffect(() => {
    if (facilitiesLoading) return;
    if (facilities.length === 0) {
      facilityApi.create().then(() => {
        queryClient.invalidateQueries({ queryKey: queryKeys.facility });
      });
    }
  }, [facilities.length, facilitiesLoading, queryClient]);

  const { data: layout, refetch: refetchLayout, isError: layoutError, error: layoutErr } =
    useQuery({
      queryKey: ["facility-layout", facility?.id],
      queryFn: () => facilityApi.layout(facility?.id),
      enabled: !!facility?.id,
    });

  const spaces = layout?.spaces || [];
  const activeSpace =
    spaces.find((s) => s.id === activeSpaceId) || spaces[0] || null;

  /** Fresh table row from layout (keeps seat list up to date after edits). */
  const liveSelectedTable = useMemo(() => {
    if (!selectedTable || !activeSpace) return selectedTable;
    return (
      activeSpace.tables?.find((t) => t.id === selectedTable.id) || selectedTable
    );
  }, [selectedTable, activeSpace]);

  useEffect(() => {
    if (!spaces.length) {
      setActiveSpaceId(null);
      return;
    }
    if (!activeSpaceId || !spaces.some((s) => s.id === activeSpaceId)) {
      setActiveSpaceId(spaces[0].id);
    }
  }, [spaces, activeSpaceId]);

  useEffect(() => {
    if (!selectedTable) return;
    setTableDraft({
      name: selectedTable.name,
      imageUrl: selectedTable.imageUrl || null,
      galleryUrls: selectedTable.galleryUrls || [],
      width: selectedTable.width,
      height: selectedTable.height,
    });
  }, [selectedTable]);

  useEffect(() => {
    if (!selectedWall) return;
    setWallDraft({
      label: selectedWall.label || "",
      width: selectedWall.width,
      height: selectedWall.height,
      rotation: selectedWall.rotation,
    });
  }, [selectedWall]);

  useEffect(() => {
    if (!selectedFixture) return;
    setFixtureDraft({
      label: selectedFixture.label || "",
      width: selectedFixture.width,
      height: selectedFixture.height,
      rotation: selectedFixture.rotation,
    });
  }, [selectedFixture]);

  useEffect(() => {
    if (!selectedSeat) return;
    setSeatDraft({
      label: selectedSeat.label,
      isOverflow: selectedSeat.isOverflow,
    });
  }, [selectedSeat]);

  const getTableForm = (spaceId: string) =>
    tableForms[spaceId] || emptyTableForm();

  const patchTableForm = (spaceId: string, patch: Partial<TableFormState>) =>
    setTableForms((prev) => ({
      ...prev,
      [spaceId]: { ...(prev[spaceId] || emptyTableForm()), ...patch },
    }));

  const { data: occupancy } = useQuery({
    queryKey: ["facility-occupancy"],
    queryFn: () => facilityApi.occupancy(),
    refetchInterval: 10_000,
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ["bookings"],
    queryFn: () => bookingApi.list(),
  });

  const { data: members = [] } = useQuery({
    queryKey: queryKeys.members,
    queryFn: () => membersApi.list(),
  });

  const { data: journalPage } = useQuery({
    queryKey: queryKeys.journal(new Date()),
    queryFn: () => journalApi.list({ journalDate: new Date(), perPage: 100 }),
  });

  const presentMembers = useMemo(() => {
    const ids = new Set(
      (journalPage?.data || [])
        .filter(isActiveVisit)
        .map((j) => j.memberID)
        .filter(Boolean) as string[]
    );
    return (Array.isArray(members) ? members : []).filter((m) => ids.has(m.id));
  }, [members, journalPage]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["facility-layout"] });
    queryClient.invalidateQueries({ queryKey: ["facility-occupancy"] });
    queryClient.invalidateQueries({ queryKey: queryKeys.facility });
    queryClient.invalidateQueries({ queryKey: ["bookings"] });
    refetchLayout();
  };

  const createSpace = useMutation({
    mutationFn: () =>
      facilityApi.createSpace({
        facilityId: facility!.id,
        name: newSpaceName.trim(),
        floorPlanUrl: floorPlanUrl || undefined,
        category: newSpaceCategories[0],
        categories: newSpaceCategories,
      }),
    onSuccess: (s) => {
      toast.success("Espace créé");
      setNewSpaceName("");
      setNewSpaceCategories([PriceCategory.JOURNEE]);
      setFloorPlanUrl(null);
      setShowNewSpace(false);
      setSpacePanel("plan");
      setActiveSpaceId(s.id);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateSpace = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Space> }) =>
      facilityApi.updateSpace(id, data),
    onSuccess: (_data, vars) => {
      const onlyCats =
        vars.data &&
        Object.keys(vars.data).every((k) => k === "categories" || k === "category");
      if (!onlyCats) toast.success("Espace mis à jour");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createTable = useMutation({
    mutationFn: ({
      spaceId,
      form,
    }: {
      spaceId: string;
      form: TableFormState;
    }) =>
      facilityApi.createTable({
        spaceId,
        name: form.name.trim(),
        imageUrl: form.imageUrl || undefined,
        galleryUrls: form.galleryUrls || [],
        seatCount: form.seatCount,
        overflowCount: form.overflowCount,
        x: 60 + Math.random() * 80,
        y: 60 + Math.random() * 80,
      }),
    onSuccess: (_t, { spaceId }) => {
      toast.success("Table ajoutée");
      setTableForms((prev) => ({ ...prev, [spaceId]: emptyTableForm() }));
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const applyTableEdits = useMutation({
    mutationFn: () =>
      facilityApi.updateTable(selectedTable!.id, {
        name: tableDraft.name.trim() || selectedTable!.name,
        imageUrl: tableDraft.imageUrl,
        galleryUrls: tableDraft.galleryUrls,
        width: Number(tableDraft.width),
        height: Number(tableDraft.height),
      }),
    onSuccess: () => {
      toast.success("Table mise à jour");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const applyWallEdits = useMutation({
    mutationFn: () =>
      facilityApi.updateWall(selectedWall!.id, {
        label: wallDraft.label.trim() || null,
        width: Number(wallDraft.width),
        height: Number(wallDraft.height),
        rotation: Number(wallDraft.rotation),
      }),
    onSuccess: () => {
      toast.success("Mur mis à jour");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const applyFixtureEdits = useMutation({
    mutationFn: () =>
      facilityApi.updateFixture(selectedFixture!.id, {
        label: fixtureDraft.label.trim() || null,
        width: Number(fixtureDraft.width),
        height: Number(fixtureDraft.height),
        rotation: Number(fixtureDraft.rotation),
      }),
    onSuccess: () => {
      toast.success("Élément mis à jour");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const applySeatEdits = useMutation({
    mutationFn: () =>
      facilityApi.updateSeat(selectedSeat!.id, {
        label: seatDraft.label.trim() || selectedSeat!.label,
        isOverflow: seatDraft.isOverflow,
      }),
    onSuccess: () => {
      toast.success("Place mise à jour");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const spreadTableSeats = async (
    table: SpaceTable,
    width: number,
    height: number,
    mode: SeatLayoutMode = seatLayoutMode
  ) => {
    const seats = table.seats || [];
    if (!seats.length) {
      toast.message("Ajoutez des places avant de les répartir");
      return;
    }
    const w = Math.max(40, Number(width) || table.width);
    const h = Math.max(40, Number(height) || table.height);
    await facilityApi.updateTable(table.id, { width: w, height: h });
    const layout = layoutSeatsOnTable(seats, w, h, mode);
    await Promise.all(
      layout.map((p) =>
        facilityApi.updateSeat(p.id, {
          offsetX: p.offsetX,
          offsetY: p.offsetY,
          tableId: table.id,
        })
      )
    );
    const label =
      SEAT_LAYOUT_OPTIONS.find((o) => o.mode === mode)?.label || mode;
    toast.success(`Places réparties : ${label}`);
    invalidate();
  };

  const moveTable = useMutation({
    mutationFn: ({ id, x, y }: { id: string; x: number; y: number }) =>
      facilityApi.updateTable(id, { x, y }),
    onSuccess: () => invalidate(),
  });

  const updateTableLocal = (tableId: string, x: number, y: number) => {
    moveTable.mutate({ id: tableId, x, y });
  };

  const moveSeat = useMutation({
    mutationFn: ({
      id,
      offsetX,
      offsetY,
      tableId,
    }: {
      id: string;
      offsetX: number;
      offsetY: number;
      tableId: string | null;
    }) => facilityApi.updateSeat(id, { offsetX, offsetY, tableId }),
    onSuccess: () => invalidate(),
  });

  const moveWall = useMutation({
    mutationFn: ({ id, x, y }: { id: string; x: number; y: number }) =>
      facilityApi.updateWall(id, { x, y }),
    onSuccess: () => invalidate(),
  });

  const moveFixture = useMutation({
    mutationFn: ({ id, x, y }: { id: string; x: number; y: number }) =>
      facilityApi.updateFixture(id, { x, y }),
    onSuccess: () => invalidate(),
  });

  const nextSeatLabel = (spaceId: string, tableId?: string) => {
    const space = spaces.find((s) => s.id === spaceId);
    const table = tableId
      ? space?.tables?.find((t) => t.id === tableId)
      : null;
    const prefix = table?.name || space?.name || "P";
    const existing = [
      ...(space?.seats || []),
      ...(space?.tables || []).flatMap((t) => t.seats || []),
    ];
    let n = existing.length + 1;
    let label = `${prefix}-${n}`;
    while (existing.some((s) => s.label === label)) {
      n += 1;
      label = `${prefix}-${n}`;
    }
    return label;
  };

  const placeOnCanvas = async (
    placeTool: EditTool,
    x: number,
    y: number,
    tableId?: string
  ) => {
    if (!activeSpace) return;
    try {
      if (placeTool === "seat") {
        if (tableId) {
          const table = activeSpace.tables?.find((t) => t.id === tableId);
          const ox = table ? x - table.x : x;
          const oy = table ? y - table.y : y;
          await facilityApi.createSeat({
            spaceId: activeSpace.id,
            tableId,
            label: nextSeatLabel(activeSpace.id, tableId),
            offsetX: ox - 14,
            offsetY: oy - 14,
            isOverflow: seatOverflow,
          });
        } else {
          await facilityApi.createSeat({
            spaceId: activeSpace.id,
            label: nextSeatLabel(activeSpace.id),
            offsetX: x - 14,
            offsetY: y - 14,
            isOverflow: seatOverflow,
          });
        }
        toast.success("Place ajoutée");
      } else if (placeTool === "wall") {
        await facilityApi.createWall({
          spaceId: activeSpace.id,
          label: "Mur",
          x: x - 80,
          y: y - 6,
          width: 160,
          height: 12,
        });
        toast.success("Mur ajouté");
      } else if (placeTool === "table") {
        const name = `Table ${
          (activeSpace.tables?.length || 0) + 1
        }`;
        await facilityApi.createTable({
          spaceId: activeSpace.id,
          name,
          x: x - 60,
          y: y - 40,
          seatCount: 0,
          overflowCount: 0,
        });
        toast.success("Table ajoutée — placez les sièges avec l’outil Place");
      } else if (placeTool === "fixture") {
        const opt = FIXTURE_OPTIONS.find((f) => f.kind === fixtureKind);
        const created = await facilityApi.createFixture({
          spaceId: activeSpace.id,
          kind: fixtureKind,
          label: fixtureKind === "TEXT" ? "" : opt?.label,
          x: x - (fixtureKind === "TEXT" ? 60 : 22),
          y: y - (fixtureKind === "TEXT" ? 20 : 22),
        });
        setSelectedFixture(created);
        toast.success(
          fixtureKind === "TEXT"
            ? "Bloc texte — saisissez le libellé"
            : "Élément ajouté"
        );
      }
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
  };

  const book = useMutation({
    mutationFn: ({ seatId, memberId }: { seatId: string; memberId: string }) =>
      bookingApi.create({
        eventKey: BOOKING_EVENT_KEY,
        seats: [seatId],
        memberId,
        spaceId: activeSpace?.id,
      }),
    onSuccess: () => {
      toast.success("Place assignée");
      setAssignSeat(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const release = useMutation({
    mutationFn: (id: string) => bookingApi.remove(id),
    onSuccess: () => {
      toast.success("Place libérée");
      setAssignSeat(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [mapZoom, setMapZoom] = useState(1);
  const [profile, setProfile] = useState({
    name: "",
    numtel: "",
    email: "",
    adresse: "",
    logo: "" as string | null,
    facebook: "",
    instagram: "",
    mobileSeatMode: "ADMIN_ASSIGN" as "ADMIN_ASSIGN" | "VISITOR_CHOOSE" | "AUTO_ASSIGN",
    receptionAway: false,
  });
  const [orgDraft, setOrgDraft] = useState({
    id: "",
    name: "",
    slug: "",
    logo: "" as string | null,
    facebookUrl: "",
    instagramUrl: "",
  });
  const [newOrg, setNewOrg] = useState({ name: "", slug: "" });

  useEffect(() => {
    if (!facility) return;
    const social = facility.socialNetworks || {};
    setProfile({
      name: facility.name || "",
      numtel: facility.numtel || "",
      email: facility.email || "",
      adresse: facility.adresse || "",
      logo: facility.logo || null,
      facebook: social.facebook || "",
      instagram: social.instagram || "",
      mobileSeatMode: facility.mobileSeatMode || "ADMIN_ASSIGN",
      receptionAway: !!facility.receptionAway,
    });
  }, [facility]);

  useEffect(() => {
    const org =
      organizations.find((o) => o.facility?.id === facility?.id) ||
      organizations[0];
    if (!org) return;
    setOrgDraft({
      id: org.id,
      name: org.name || "",
      slug: org.slug || "",
      logo: org.logo || null,
      facebookUrl: org.facebookUrl || "",
      instagramUrl: org.instagramUrl || "",
    });
  }, [organizations, facility?.id]);

  const updateProfile = useMutation({
    mutationFn: () =>
      facilityApi.update(facility!.id, {
        name: profile.name,
        numtel: profile.numtel,
        email: profile.email,
        adresse: profile.adresse,
        logo: profile.logo || undefined,
        mobileSeatMode: profile.mobileSeatMode,
        receptionAway: profile.receptionAway,
        socialNetworks: {
          facebook: profile.facebook,
          instagram: profile.instagram,
        },
        ...(orgDraft.id ? { organizationId: orgDraft.id } : {}),
      } as Parameters<typeof facilityApi.update>[1] & {
        organizationId?: string;
      }),
    onSuccess: () => {
      toast.success("Profil enregistré");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateOrg = useMutation({
    mutationFn: () =>
      organizationsApi.update(orgDraft.id, {
        name: orgDraft.name,
        slug: orgDraft.slug,
        logo: orgDraft.logo,
        facebookUrl: orgDraft.facebookUrl || null,
        instagramUrl: orgDraft.instagramUrl || null,
      }),
    onSuccess: () => {
      toast.success("Organisation enregistrée");
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createOrg = useMutation({
    mutationFn: () =>
      organizationsApi.create({
        name: newOrg.name,
        slug: newOrg.slug || newOrg.name,
      }),
    onSuccess: (org) => {
      toast.success(`Organisation ${org.slug} créée`);
      setNewOrg({ name: "", slug: "" });
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      setOrgDraft({
        id: org.id,
        name: org.name,
        slug: org.slug,
        logo: org.logo || null,
        facebookUrl: org.facebookUrl || "",
        instagramUrl: org.instagramUrl || "",
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const orgSlug =
    organizations.find((o) => o.facility?.id === facility?.id)?.slug ||
    organizations[0]?.slug ||
    "";

  const bookingForSeat = (label: string) =>
    bookings.find(
      (b) =>
        b.isBooked &&
        b.seatId === label &&
        (!b.spaceId || !activeSpace || b.spaceId === activeSpace.id)
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Facility / Map</h1>
          <p className="text-muted-foreground">
            Plan d&apos;étage, tables avec photos, places + overflow
          </p>
          {facility ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {spaces.length} espace{spaces.length !== 1 ? "s" : ""}
              {facility.name ? ` · ${facility.name}` : ""}
            </p>
          ) : null}
        </div>
        {occupancy ? (
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">
              {occupancy.normalOccupied}/{occupancy.normalCapacity} places
            </Badge>
            {occupancy.overflowOccupied > 0 || occupancy.isFull ? (
              <Badge className="bg-rose-600 hover:bg-rose-600">
                Overflow {occupancy.overflowOccupied}/
                {occupancy.overflowCapacity}
              </Badge>
            ) : null}
            {occupancy.isFull ? (
              <Badge variant="destructive">Complet</Badge>
            ) : null}
          </div>
        ) : null}
      </div>

      <Tabs defaultValue="espaces">
        <TabsList>
          <TabsTrigger value="espaces">Espaces</TabsTrigger>
          <TabsTrigger value="profile">Profil & QR</TabsTrigger>
        </TabsList>

        <TabsContent value="espaces" className="mt-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
            <aside className="w-full shrink-0 space-y-3 lg:sticky lg:top-4 lg:w-60">
              <div className="rounded-lg border bg-card p-2">
                <p className="mb-2 px-1 text-xs font-medium text-muted-foreground">
                  Espaces
                </p>
                <div className="flex max-h-64 flex-col gap-1 overflow-y-auto lg:max-h-[min(60vh,28rem)]">
                  {spaces.map((s) => (
                    <Button
                      key={s.id}
                      size="sm"
                      variant={activeSpace?.id === s.id ? "default" : "ghost"}
                      className="h-9 justify-start"
                      onClick={() => setActiveSpaceId(s.id)}
                    >
                      {s.name}
                    </Button>
                  ))}
                  {!spaces.length && !layoutError ? (
                    <p className="px-1 text-xs text-muted-foreground">
                      Aucun espace pour le moment
                    </p>
                  ) : null}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 w-full"
                  onClick={() => {
                    setShowNewSpace((v) => !v);
                    setSpacePanel("config");
                  }}
                >
                  {showNewSpace ? "Fermer" : "+ Nouvel espace"}
                </Button>
              </div>
              {showNewSpace ? (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Nouvel espace</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1">
                      <Label>Nom</Label>
                      <Input
                        value={newSpaceName}
                        onChange={(e) => setNewSpaceName(e.target.value)}
                        placeholder="Open Space"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Catégories</Label>
                      <div className="flex flex-wrap gap-1">
                        {SPACE_VISIT_CATS.map((c) => {
                          const on = newSpaceCategories.includes(c);
                          return (
                            <Button
                              key={c}
                              type="button"
                              size="sm"
                              variant={on ? "default" : "outline"}
                              className="h-7 text-xs"
                              onClick={() =>
                                setNewSpaceCategories((prev) =>
                                  toggleSpaceCategory(prev, c)
                                )
                              }
                            >
                              {PRICE_CATEGORY_LABEL[c]}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                    <ImageUpload
                      label="Plan schématique"
                      value={floorPlanUrl}
                      onChange={setFloorPlanUrl}
                    />
                    <Button
                      className="w-full"
                      disabled={
                        !facility ||
                        !newSpaceName.trim() ||
                        createSpace.isPending
                      }
                      onClick={() => createSpace.mutate()}
                    >
                      Créer
                    </Button>
                  </CardContent>
                </Card>
              ) : null}
            </aside>

            <div className="min-w-0 flex-1 space-y-4">
              {activeSpace ? (
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold tracking-tight">
                    {activeSpace.name}
                  </h2>
                  <div className="flex rounded-lg border p-0.5">
                    <Button
                      type="button"
                      size="sm"
                      variant={spacePanel === "plan" ? "default" : "ghost"}
                      className="h-8"
                      onClick={() => setSpacePanel("plan")}
                    >
                      Plan des places
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={spacePanel === "config" ? "default" : "ghost"}
                      className="h-8"
                      onClick={() => setSpacePanel("config")}
                    >
                      Réglages & tables
                    </Button>
                  </div>
                </div>
              ) : null}

              {spacePanel === "plan" ? (
                <div className="space-y-4">
          {layoutError ? (
            <Card>
              <CardContent className="p-4 text-sm text-destructive">
                Impossible de charger le plan :{" "}
                {layoutErr instanceof Error
                  ? layoutErr.message
                  : "erreur serveur"}
                . Redémarrez le backend après migrate.
              </CardContent>
            </Card>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex-1" />
            <Button
              size="sm"
              variant={editMode ? "default" : "outline"}
              onClick={() => {
                setEditMode((v) => !v);
                setTool("select");
              }}
            >
              {editMode ? "Mode édition ON" : "Éditer le plan"}
            </Button>
          </div>

          {editMode ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-2">
              {(
                [
                  ["select", "Déplacer"],
                  ["table", "Table"],
                  ["seat", "Place"],
                  ["wall", "Mur"],
                  ["fixture", "Mobilier"],
                ] as const
              ).map(([id, label]) => (
                <Button
                  key={id}
                  size="sm"
                  variant={tool === id ? "default" : "outline"}
                  onClick={() => setTool(id)}
                >
                  {label}
                </Button>
              ))}
              {tool === "fixture" ? (
                <Select
                  value={fixtureKind}
                  onValueChange={(v) => setFixtureKind(v as FixtureKind)}
                >
                  <SelectTrigger className="h-8 w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIXTURE_OPTIONS.map((f) => (
                      <SelectItem key={f.kind} value={f.kind}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
              {tool === "seat" ? (
                <label className="ml-2 flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={seatOverflow}
                    onChange={(e) => setSeatOverflow(e.target.checked)}
                  />
                  Overflow
                </label>
              ) : null}
              <span className="text-xs text-muted-foreground">
                {tool === "select"
                  ? "Glissez tables, places, murs et mobilier"
                  : tool === "seat"
                    ? "Cliquez sur le plan (ou sur une table) pour poser une place"
                    : tool === "wall"
                      ? "Cliquez pour poser un mur — redimensionnez dans le panneau"
                      : tool === "fixture"
                        ? "Cliquez pour poser l’élément choisi"
                        : "Cliquez pour poser une table vide, puis ajoutez des places"}
              </span>
            </div>
          ) : null}

          {!activeSpace ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                Sélectionnez un espace à gauche, ou créez-en un avec « Nouvel
                espace ».
              </CardContent>
            </Card>
          ) : (
            <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Taille du plan</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={mapZoom <= 0.6}
                onClick={() => setMapZoom((z) => Math.max(0.6, +(z - 0.1).toFixed(2)))}
              >
                −
              </Button>
              <span className="w-12 text-center text-sm font-medium">
                {Math.round(mapZoom * 100)}%
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={mapZoom >= 1.8}
                onClick={() => setMapZoom((z) => Math.min(1.8, +(z + 0.1).toFixed(2)))}
              >
                +
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setMapZoom(1)}
              >
                Reset
              </Button>
            </div>
            <FloorPlanCanvas
              space={activeSpace}
              bookings={bookings}
              editMode={editMode}
              tool={tool}
              zoom={mapZoom}
              selectedTableId={liveSelectedTable?.id}
              selectedWallId={selectedWall?.id}
              selectedSeatId={selectedSeat?.id}
              selectedFixtureId={selectedFixture?.id}
              onSelectTable={(t) => {
                setSelectedTable(t);
                setSelectedWall(null);
                setSelectedSeat(null);
                setSelectedFixture(null);
              }}
              onSelectWall={(w) => {
                setSelectedWall(w);
                setSelectedTable(null);
                setSelectedSeat(null);
                setSelectedFixture(null);
              }}
              onSelectFixture={(f) => {
                setSelectedFixture(f);
                setSelectedTable(null);
                setSelectedWall(null);
                setSelectedSeat(null);
              }}
              onMoveTable={updateTableLocal}
              onMoveWall={(id, x, y) => moveWall.mutate({ id, x, y })}
              onMoveFixture={(id, x, y) => moveFixture.mutate({ id, x, y })}
              onMoveSeat={(id, offsetX, offsetY, tableId) =>
                moveSeat.mutate({ id, offsetX, offsetY, tableId })
              }
              onCanvasPlace={placeOnCanvas}
              onSelectSeat={(seat) => {
                if (editMode) {
                  setSelectedSeat(seat);
                  setSelectedTable(null);
                  setSelectedWall(null);
                  setSelectedFixture(null);
                  return;
                }
                const b = bookingForSeat(seat.label);
                if (b) {
                  if (
                    confirm(
                      `Libérer ${seat.label}${
                        seat.isOverflow ? " (overflow)" : ""
                      } ?`
                    )
                  ) {
                    release.mutate(b.id);
                  }
                } else {
                  setAssignSeat(seat);
                  setMemberId(presentMembers[0]?.id || "");
                }
              }}
            />
            </>
          )}

          {editMode && liveSelectedTable ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Table : {liveSelectedTable.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                  <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label>Nom</Label>
                        <Input
                          value={tableDraft.name}
                          onChange={(e) =>
                            setTableDraft((d) => ({
                              ...d,
                              name: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label>Largeur (px)</Label>
                          <Input
                            type="number"
                            min={40}
                            value={tableDraft.width}
                            onChange={(e) =>
                              setTableDraft((d) => ({
                                ...d,
                                width: Number(e.target.value),
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Hauteur (px)</Label>
                          <Input
                            type="number"
                            min={40}
                            value={tableDraft.height}
                            onChange={(e) =>
                              setTableDraft((d) => ({
                                ...d,
                                height: Number(e.target.value),
                              }))
                            }
                          />
                        </div>
                      </div>
                    </div>
                    <GalleryUpload
                      label="Galerie table"
                      hint="Photos de la table pour la réservation (pas le plan)."
                      values={tableDraft.galleryUrls}
                      onChange={(urls) =>
                        setTableDraft((d) => ({ ...d, galleryUrls: urls }))
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-2 sm:items-stretch sm:justify-start">
                    <Button
                      size="sm"
                      disabled={applyTableEdits.isPending}
                      onClick={() => applyTableEdits.mutate()}
                    >
                      Appliquer taille
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        if (
                          !confirm(
                            `Supprimer la table « ${liveSelectedTable.name} » et ses places ?`
                          )
                        )
                          return;
                        facilityApi
                          .deleteTable(liveSelectedTable.id)
                          .then(() => {
                            setSelectedTable(null);
                            invalidate();
                          });
                      }}
                    >
                      Supprimer table
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border bg-muted/20 p-3">
                  <p className="mb-2 text-sm font-medium">
                    Répartir les places
                  </p>
                  <p className="mb-3 text-xs text-muted-foreground">
                    Choisissez un côté (ou une combinaison), puis appliquez.
                    L&apos;espacement suit la largeur / hauteur de la table.
                  </p>
                  <div className="mb-3 flex flex-wrap gap-2">
                    {SEAT_LAYOUT_OPTIONS.map((opt) => (
                      <Button
                        key={opt.mode}
                        type="button"
                        size="sm"
                        variant={
                          seatLayoutMode === opt.mode ? "default" : "outline"
                        }
                        title={opt.hint}
                        onClick={() => setSeatLayoutMode(opt.mode)}
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    disabled={
                      manageTableBusy ||
                      !(liveSelectedTable.seats || []).length
                    }
                    onClick={async () => {
                      setManageTableBusy(true);
                      try {
                        await spreadTableSeats(
                          liveSelectedTable,
                          tableDraft.width,
                          tableDraft.height,
                          seatLayoutMode
                        );
                      } catch (e) {
                        toast.error(
                          e instanceof Error
                            ? e.message
                            : "Répartition impossible"
                        );
                      } finally {
                        setManageTableBusy(false);
                      }
                    }}
                  >
                    Appliquer la répartition
                  </Button>
                </div>

                <div className="rounded-lg border p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">
                      Places de cette table (
                      {(liveSelectedTable.seats || []).length})
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (!activeSpace) return;
                        const n = (liveSelectedTable.seats || []).length + 1;
                        facilityApi
                          .createSeat({
                            spaceId: activeSpace.id,
                            tableId: liveSelectedTable.id,
                            label: `${liveSelectedTable.name}-${n}`,
                            offsetX: 8 + ((n - 1) % 4) * 28,
                            offsetY: 8 + Math.floor((n - 1) / 4) * 28,
                          })
                          .then(() => {
                            toast.success("Place ajoutée");
                            invalidate();
                          })
                          .catch((e: Error) => toast.error(e.message));
                      }}
                    >
                      + Place
                    </Button>
                  </div>
                  {(liveSelectedTable.seats || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Aucune place liée — ajoutez-en avec « + Place » ou
                      l&apos;outil Place sur le plan.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {(liveSelectedTable.seats || []).map((seat) => {
                        const draft =
                          selectedSeat?.id === seat.id ? seatDraft : null;
                        return (
                          <div
                            key={seat.id}
                            className={`flex flex-wrap items-end gap-2 rounded-md border px-2 py-2 ${
                              selectedSeat?.id === seat.id
                                ? "border-primary bg-primary/5"
                                : ""
                            }`}
                          >
                            <button
                              type="button"
                              className="text-left text-xs font-semibold underline-offset-2 hover:underline"
                              onClick={() => {
                                setSelectedSeat(seat);
                                setSelectedWall(null);
                              }}
                            >
                              {seat.label}
                            </button>
                            <div className="space-y-1">
                              <Label className="text-[10px]">Label</Label>
                              <Input
                                className="h-8 w-28"
                                value={
                                  draft ? draft.label : seat.label
                                }
                                onFocus={() => {
                                  setSelectedSeat(seat);
                                  setSelectedWall(null);
                                }}
                                onChange={(e) =>
                                  setSeatDraft((d) => ({
                                    ...d,
                                    label: e.target.value,
                                  }))
                                }
                              />
                            </div>
                            <label className="flex items-center gap-1.5 pb-1 text-xs">
                              <input
                                type="checkbox"
                                checked={
                                  draft
                                    ? draft.isOverflow
                                    : seat.isOverflow
                                }
                                onChange={(e) => {
                                  setSelectedSeat(seat);
                                  setSeatDraft({
                                    label: seat.label,
                                    isOverflow: e.target.checked,
                                  });
                                }}
                              />
                              Overflow
                            </label>
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-8"
                              disabled={
                                selectedSeat?.id !== seat.id ||
                                applySeatEdits.isPending
                              }
                              onClick={() => applySeatEdits.mutate()}
                            >
                              Appliquer
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-8"
                              onClick={() => {
                                if (
                                  !confirm(`Supprimer la place ${seat.label} ?`)
                                )
                                  return;
                                facilityApi
                                  .deleteSeat(seat.id)
                                  .then(() => {
                                    if (selectedSeat?.id === seat.id) {
                                      setSelectedSeat(null);
                                    }
                                    toast.success("Place supprimée");
                                    invalidate();
                                  })
                                  .catch((e: Error) =>
                                    toast.error(e.message)
                                  );
                              }}
                            >
                              Supprimer
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {editMode && selectedWall ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Mur {selectedWall.label ? `— ${selectedWall.label}` : ""}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <div className="space-y-1">
                  <Label>Libellé</Label>
                  <Input
                    value={wallDraft.label}
                    onChange={(e) =>
                      setWallDraft((d) => ({ ...d, label: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Longueur</Label>
                  <Input
                    type="number"
                    className="w-24"
                    value={wallDraft.width}
                    onChange={(e) =>
                      setWallDraft((d) => ({
                        ...d,
                        width: Number(e.target.value),
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Épaisseur</Label>
                  <Input
                    type="number"
                    className="w-24"
                    value={wallDraft.height}
                    onChange={(e) =>
                      setWallDraft((d) => ({
                        ...d,
                        height: Number(e.target.value),
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Rotation °</Label>
                  <Input
                    type="number"
                    className="w-24"
                    value={wallDraft.rotation}
                    onChange={(e) =>
                      setWallDraft((d) => ({
                        ...d,
                        rotation: Number(e.target.value),
                      }))
                    }
                  />
                </div>
                <Button
                  size="sm"
                  className="self-end"
                  disabled={applyWallEdits.isPending}
                  onClick={() => applyWallEdits.mutate()}
                >
                  Appliquer
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="self-end"
                  onClick={() =>
                    facilityApi.deleteWall(selectedWall.id).then(() => {
                      setSelectedWall(null);
                      invalidate();
                    })
                  }
                >
                  Supprimer mur
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {editMode && selectedFixture ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {FIXTURE_OPTIONS.find((f) => f.kind === selectedFixture.kind)
                    ?.label || "Mobilier"}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <div className="space-y-1">
                  <Label>Libellé</Label>
                  <Input
                    autoFocus={selectedFixture.kind === "TEXT"}
                    placeholder={
                      selectedFixture.kind === "TEXT" ? "Texte…" : undefined
                    }
                    value={fixtureDraft.label}
                    onChange={(e) =>
                      setFixtureDraft((d) => ({ ...d, label: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Largeur</Label>
                  <Input
                    type="number"
                    className="w-24"
                    value={fixtureDraft.width}
                    onChange={(e) =>
                      setFixtureDraft((d) => ({
                        ...d,
                        width: Number(e.target.value),
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Hauteur</Label>
                  <Input
                    type="number"
                    className="w-24"
                    value={fixtureDraft.height}
                    onChange={(e) =>
                      setFixtureDraft((d) => ({
                        ...d,
                        height: Number(e.target.value),
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Rotation °</Label>
                  <Input
                    type="number"
                    className="w-24"
                    value={fixtureDraft.rotation}
                    onChange={(e) =>
                      setFixtureDraft((d) => ({
                        ...d,
                        rotation: Number(e.target.value),
                      }))
                    }
                  />
                </div>
                <Button
                  size="sm"
                  className="self-end"
                  disabled={applyFixtureEdits.isPending}
                  onClick={() => applyFixtureEdits.mutate()}
                >
                  Appliquer
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="self-end"
                  onClick={() =>
                    facilityApi.deleteFixture(selectedFixture.id).then(() => {
                      setSelectedFixture(null);
                      invalidate();
                    })
                  }
                >
                  Supprimer
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {editMode && selectedSeat ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Place : {selectedSeat.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <div className="space-y-1">
                  <Label>Label (booking)</Label>
                  <Input
                    value={seatDraft.label}
                    onChange={(e) =>
                      setSeatDraft((d) => ({ ...d, label: e.target.value }))
                    }
                  />
                </div>
                <label className="flex items-center gap-2 self-end text-sm">
                  <input
                    type="checkbox"
                    checked={seatDraft.isOverflow}
                    onChange={(e) =>
                      setSeatDraft((d) => ({
                        ...d,
                        isOverflow: e.target.checked,
                      }))
                    }
                  />
                  Overflow
                </label>
                <Button
                  size="sm"
                  className="self-end"
                  disabled={applySeatEdits.isPending}
                  onClick={() => applySeatEdits.mutate()}
                >
                  Appliquer
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="self-end"
                  onClick={() =>
                    facilityApi.deleteSeat(selectedSeat.id).then(() => {
                      setSelectedSeat(null);
                      invalidate();
                    })
                  }
                >
                  Supprimer place
                </Button>
              </CardContent>
            </Card>
          ) : null}
                </div>
              ) : (
                <div className="space-y-4">
          {!spaces.length ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                Aucun espace pour le moment. Créez le premier à gauche.
              </CardContent>
            </Card>
          ) : !activeSpace ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                Sélectionnez un espace dans la liste.
              </CardContent>
            </Card>
          ) : (
            [activeSpace].map((space) => {
              const form = getTableForm(space.id);
              return (
                <Card key={space.id}>
                  <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
                    <CardTitle className="text-base">{space.name}</CardTitle>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {SPACE_VISIT_CATS.map((c) => {
                        const cats = spaceCategoriesOf(space);
                        const on = cats.includes(c);
                        return (
                          <Button
                            key={c}
                            type="button"
                            size="sm"
                            variant={on ? "default" : "outline"}
                            className="h-8"
                            onClick={() =>
                              updateSpace.mutate({
                                id: space.id,
                                data: {
                                  categories: toggleSpaceCategory(cats, c),
                                },
                              })
                            }
                          >
                            {PRICE_CATEGORY_LABEL[c]}
                          </Button>
                        );
                      })}
                    </div>
                    <label className="flex items-center gap-2 rounded-md border px-2 py-1 text-xs">
                      <Switch
                        checked={!!space.openForReservation}
                        onCheckedChange={(on) =>
                          updateSpace.mutate({
                            id: space.id,
                            data: { openForReservation: on },
                          })
                        }
                      />
                      Réservation mobile
                    </label>
                    <Select
                      value={space.reserveMode || "BOTH"}
                      onValueChange={(v) =>
                        updateSpace.mutate({
                          id: space.id,
                          data: {
                            reserveMode: v as "SEAT" | "WHOLE" | "BOTH",
                          },
                        })
                      }
                    >
                      <SelectTrigger className="h-8 w-[220px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SEAT">
                          {SPACE_RESERVE_MODE_LABEL.SEAT}
                        </SelectItem>
                        <SelectItem value="WHOLE">
                          {SPACE_RESERVE_MODE_LABEL.WHOLE}
                        </SelectItem>
                        <SelectItem value="BOTH">
                          {SPACE_RESERVE_MODE_LABEL.BOTH}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSpacePanel("plan")}
                      >
                        Voir le plan
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (!confirm(`Supprimer ${space.name} ?`)) return;
                          facilityApi
                            .deleteSpace(space.id)
                            .then(() => {
                              toast.success(`${space.name} supprimé`);
                              if (activeSpaceId === space.id) {
                                setActiveSpaceId(null);
                              }
                              invalidate();
                            })
                            .catch((e: Error) =>
                              toast.error(
                                e.message || "Suppression impossible"
                              )
                            );
                        }}
                      >
                        Supprimer
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ImageUpload
                      label="Plan schématique"
                      value={space.floorPlanUrl}
                      onChange={(url) =>
                        updateSpace.mutate({
                          id: space.id,
                          data: { floorPlanUrl: url },
                        })
                      }
                    />
                    <GalleryUpload
                      label="Galerie de l’espace"
                      hint="Photos du lieu pour la réservation. Elles ne s’affichent pas sur le plan."
                      values={space.galleryUrls || []}
                      onChange={(urls) =>
                        updateSpace.mutate({
                          id: space.id,
                          data: { galleryUrls: urls },
                        })
                      }
                    />

                    <SpaceWifiEditor
                      space={space}
                      saving={updateSpace.isPending}
                      onSave={(data) =>
                        updateSpace.mutate({ id: space.id, data })
                      }
                    />

                    <div className="rounded-lg border p-3">
                      <p className="mb-1 text-sm font-medium">
                        Ajouter une table
                      </p>
                      <p className="mb-3 text-xs text-muted-foreground">
                        Crée une nouvelle table. Pour modifier ou supprimer une
                        table existante, utilisez la liste ci-dessous.
                      </p>
                      <div className="flex flex-wrap items-end gap-3">
                        <div className="space-y-1">
                          <Label>Nom</Label>
                          <Input
                            value={form.name}
                            onChange={(e) =>
                              patchTableForm(space.id, {
                                name: e.target.value,
                              })
                            }
                            placeholder="Table A"
                          />
                        </div>
                        <GalleryUpload
                          className="min-w-[220px]"
                          label="Galerie table"
                          hint="Photos de la table (réservation)."
                          values={form.galleryUrls || []}
                          onChange={(urls) =>
                            patchTableForm(space.id, {
                              galleryUrls: urls,
                            })
                          }
                        />
                        <div className="space-y-1">
                          <Label>Places</Label>
                          <Input
                            type="number"
                            min={0}
                            className="w-20"
                            value={form.seatCount}
                            onChange={(e) =>
                              patchTableForm(space.id, {
                                seatCount: Number(e.target.value),
                              })
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Overflow</Label>
                          <Input
                            type="number"
                            min={0}
                            className="w-20"
                            value={form.overflowCount}
                            onChange={(e) =>
                              patchTableForm(space.id, {
                                overflowCount: Number(e.target.value),
                              })
                            }
                          />
                        </div>
                        <Button
                          disabled={
                            !form.name.trim() || createTable.isPending
                          }
                          onClick={() =>
                            createTable.mutate({ spaceId: space.id, form })
                          }
                        >
                          Ajouter table
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium">
                        Tables de cet espace
                      </p>
                      {(space.tables || []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Aucune table — ajoutez-en une ci-dessus ou sur le
                          plan.
                        </p>
                      ) : null}
                      {(space.tables || []).map((t) => {
                        const editing = manageTableId === t.id;
                        const normalSeats = (t.seats || []).filter(
                          (s) => !s.isOverflow
                        ).length;
                        const overflowSeats = (t.seats || []).filter(
                          (s) => s.isOverflow
                        ).length;
                        return (
                          <div
                            key={t.id}
                            className="rounded-lg border px-3 py-3 text-sm"
                          >
                            {!editing ? (
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                  {(t.galleryUrls?.[0] || t.imageUrl) ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={t.galleryUrls?.[0] || t.imageUrl || ""}
                                      alt=""
                                      className="h-10 w-14 rounded object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-10 w-14 items-center justify-center rounded bg-muted text-[10px]">
                                      —
                                    </div>
                                  )}
                                  <div>
                                    <div className="font-medium">{t.name}</div>
                                    <div className="text-muted-foreground">
                                      {normalSeats} places · {overflowSeats}{" "}
                                      overflow
                                    </div>
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setManageTableId(t.id);
                                      setManageTableDraft({
                                        name: t.name,
                                        imageUrl: t.imageUrl || null,
                                        galleryUrls: t.galleryUrls || [],
                                        width: t.width || 120,
                                        height: t.height || 80,
                                      });
                                    }}
                                  >
                                    Modifier
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    disabled={manageTableBusy}
                                    onClick={() => {
                                      const seatN = (t.seats || []).length;
                                      if (
                                        !confirm(
                                          `Supprimer la table « ${t.name} » ?\n\n` +
                                            `${seatN} place(s) liée(s) seront aussi supprimées.\n` +
                                            `Cette action est définitive.`
                                        )
                                      ) {
                                        return;
                                      }
                                      setManageTableBusy(true);
                                      facilityApi
                                        .deleteTable(t.id)
                                        .then(() => {
                                          toast.success(
                                            `Table « ${t.name} » supprimée`
                                          );
                                          if (manageTableId === t.id) {
                                            setManageTableId(null);
                                          }
                                          if (selectedTable?.id === t.id) {
                                            setSelectedTable(null);
                                          }
                                          invalidate();
                                        })
                                        .catch((e: Error) =>
                                          toast.error(
                                            e.message ||
                                              "Suppression impossible"
                                          )
                                        )
                                        .finally(() =>
                                          setManageTableBusy(false)
                                        );
                                    }}
                                  >
                                    Supprimer
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <p className="text-xs font-medium text-muted-foreground">
                                  Modification de « {t.name} » — cliquez
                                  Enregistrer pour appliquer (rien n&apos;est
                                  sauvé tant que vous n&apos;avez pas confirmé).
                                </p>
                                <div className="grid gap-3 sm:grid-cols-2">
                                  <div className="space-y-1">
                                    <Label>Nom</Label>
                                    <Input
                                      value={manageTableDraft.name}
                                      onChange={(e) =>
                                        setManageTableDraft((d) => ({
                                          ...d,
                                          name: e.target.value,
                                        }))
                                      }
                                    />
                                  </div>
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                      <Label>Largeur (px)</Label>
                                      <Input
                                        type="number"
                                        min={40}
                                        value={manageTableDraft.width}
                                        onChange={(e) =>
                                          setManageTableDraft((d) => ({
                                            ...d,
                                            width: Number(e.target.value),
                                          }))
                                        }
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label>Hauteur (px)</Label>
                                      <Input
                                        type="number"
                                        min={40}
                                        value={manageTableDraft.height}
                                        onChange={(e) =>
                                          setManageTableDraft((d) => ({
                                            ...d,
                                            height: Number(e.target.value),
                                          }))
                                        }
                                      />
                                    </div>
                                  </div>
                                </div>
                                <GalleryUpload
                                  label="Galerie table"
                                  hint="Photos de la table pour la réservation (pas le plan)."
                                  values={manageTableDraft.galleryUrls}
                                  onChange={(urls) =>
                                    setManageTableDraft((d) => ({
                                      ...d,
                                      galleryUrls: urls,
                                    }))
                                  }
                                />
                                <div className="rounded-md border bg-muted/20 p-3">
                                  <p className="mb-2 text-xs font-medium">
                                    Répartir les places
                                  </p>
                                  <div className="mb-3 flex flex-wrap gap-2">
                                    {SEAT_LAYOUT_OPTIONS.map((opt) => (
                                      <Button
                                        key={opt.mode}
                                        type="button"
                                        size="sm"
                                        variant={
                                          seatLayoutMode === opt.mode
                                            ? "default"
                                            : "outline"
                                        }
                                        title={opt.hint}
                                        onClick={() =>
                                          setSeatLayoutMode(opt.mode)
                                        }
                                      >
                                        {opt.label}
                                      </Button>
                                    ))}
                                  </div>
                                  <Button
                                    size="sm"
                                    disabled={
                                      manageTableBusy ||
                                      !(t.seats || []).length
                                    }
                                    onClick={async () => {
                                      setManageTableBusy(true);
                                      try {
                                        await spreadTableSeats(
                                          t,
                                          manageTableDraft.width,
                                          manageTableDraft.height,
                                          seatLayoutMode
                                        );
                                      } catch (e) {
                                        toast.error(
                                          e instanceof Error
                                            ? e.message
                                            : "Répartition impossible"
                                        );
                                      } finally {
                                        setManageTableBusy(false);
                                      }
                                    }}
                                  >
                                    Appliquer la répartition
                                  </Button>
                                </div>
                                <div className="rounded-md border bg-muted/30 p-2">
                                  <p className="mb-2 text-xs font-medium">
                                    Places liées ({(t.seats || []).length})
                                  </p>
                                  {(t.seats || []).length === 0 ? (
                                    <p className="text-xs text-muted-foreground">
                                      Aucune place sur cette table.
                                    </p>
                                  ) : (
                                    <div className="space-y-1">
                                      {(t.seats || []).map((seat) => (
                                        <div
                                          key={seat.id}
                                          className="flex items-center justify-between gap-2 rounded border bg-background px-2 py-1.5 text-xs"
                                        >
                                          <span>
                                            {seat.label}
                                            {seat.isOverflow
                                              ? " (overflow)"
                                              : ""}
                                          </span>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 text-destructive"
                                            onClick={() => {
                                              if (
                                                !confirm(
                                                  `Supprimer la place « ${seat.label} » ?`
                                                )
                                              )
                                                return;
                                              facilityApi
                                                .deleteSeat(seat.id)
                                                .then(() => {
                                                  toast.success(
                                                    "Place supprimée"
                                                  );
                                                  invalidate();
                                                })
                                                .catch((e: Error) =>
                                                  toast.error(e.message)
                                                );
                                            }}
                                          >
                                            Supprimer place
                                          </Button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    size="sm"
                                    disabled={
                                      manageTableBusy ||
                                      !manageTableDraft.name.trim()
                                    }
                                    onClick={() => {
                                      setManageTableBusy(true);
                                      facilityApi
                                        .updateTable(t.id, {
                                          name: manageTableDraft.name.trim(),
                                          imageUrl: manageTableDraft.imageUrl,
                                          galleryUrls: manageTableDraft.galleryUrls,
                                          width: Math.max(
                                            40,
                                            Number(manageTableDraft.width) ||
                                              120
                                          ),
                                          height: Math.max(
                                            40,
                                            Number(manageTableDraft.height) ||
                                              80
                                          ),
                                        })
                                        .then(() => {
                                          toast.success(
                                            "Table enregistrée"
                                          );
                                          setManageTableId(null);
                                          invalidate();
                                        })
                                        .catch((e: Error) =>
                                          toast.error(e.message)
                                        )
                                        .finally(() =>
                                          setManageTableBusy(false)
                                        );
                                    }}
                                  >
                                    Enregistrer
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={manageTableBusy}
                                    onClick={() => setManageTableId(null)}
                                  >
                                    Annuler
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    disabled={manageTableBusy}
                                    onClick={() => {
                                      const seatN = (t.seats || []).length;
                                      if (
                                        !confirm(
                                          `Supprimer la table « ${t.name} » ?\n\n` +
                                            `${seatN} place(s) liée(s) seront aussi supprimées.\n` +
                                            `Cette action est définitive.`
                                        )
                                      ) {
                                        return;
                                      }
                                      setManageTableBusy(true);
                                      facilityApi
                                        .deleteTable(t.id)
                                        .then(() => {
                                          toast.success(
                                            `Table « ${t.name} » supprimée`
                                          );
                                          setManageTableId(null);
                                          if (selectedTable?.id === t.id) {
                                            setSelectedTable(null);
                                          }
                                          invalidate();
                                        })
                                        .catch((e: Error) =>
                                          toast.error(e.message)
                                        )
                                        .finally(() =>
                                          setManageTableBusy(false)
                                        );
                                    }}
                                  >
                                    Supprimer la table
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="profile" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Places mobile (visiteurs)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Contrôle comment la place est attribuée après le choix du forfait sur /m.
              </p>
              <div className="grid gap-2">
                {(
                  [
                    [
                      "ADMIN_ASSIGN",
                      "1. Admin choisit la place",
                      "Après le forfait, l’accueil sélectionne la place sur le plan puis confirme. Le visiteur voit sa place sur le plan.",
                    ],
                    [
                      "VISITOR_CHOOSE",
                      "2. Visiteur choisit sa place",
                      "L’accueil confirme la visite ; le visiteur choisit ensuite sa place sur le plan mobile.",
                    ],
                    [
                      "AUTO_ASSIGN",
                      "3. Attribution automatique",
                      "Place libre attribuée automatiquement. Activez « Accueil absent » pour confirmer sans réception.",
                    ],
                  ] as const
                ).map(([value, title, desc]) => (
                  <label
                    key={value}
                    className={`flex cursor-pointer gap-3 rounded-lg border p-3 text-left ${
                      profile.mobileSeatMode === value
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/40"
                    }`}
                  >
                    <input
                      type="radio"
                      className="mt-1"
                      name="mobileSeatMode"
                      checked={profile.mobileSeatMode === value}
                      onChange={() =>
                        setProfile((p) => ({
                          ...p,
                          mobileSeatMode: value,
                          receptionAway:
                            value === "AUTO_ASSIGN" ? p.receptionAway : false,
                        }))
                      }
                    />
                    <span>
                      <span className="block text-sm font-medium">{title}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {desc}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
              {profile.mobileSeatMode === "AUTO_ASSIGN" ? (
                <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
                  <span>
                    Accueil absent
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Confirme automatiquement la demande + place libre
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={profile.receptionAway}
                    onChange={(e) =>
                      setProfile((p) => ({
                        ...p,
                        receptionAway: e.target.checked,
                      }))
                    }
                  />
                </label>
              ) : null}
              <Button
                disabled={!facility || updateProfile.isPending}
                onClick={() => updateProfile.mutate()}
              >
                Enregistrer les places mobile
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">QR visiteur</CardTitle>
            </CardHeader>
            <CardContent>
              {orgSlug ? (
                <VisitorQrCard
                  orgSlug={orgSlug}
                  orgName={
                    organizations.find((o) => o.slug === orgSlug)?.name ||
                    orgDraft.name ||
                    null
                  }
                  size="md"
                  className="max-w-sm"
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Créez ou liez une organisation pour générer le QR.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Organisation (mobile /m)</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Organisation liée</Label>
                <Select
                  value={orgDraft.id || undefined}
                  onValueChange={(id) => {
                    const org = organizations.find((o) => o.id === id);
                    if (!org) return;
                    setOrgDraft({
                      id: org.id,
                      name: org.name,
                      slug: org.slug,
                      logo: org.logo || null,
                      facebookUrl: org.facebookUrl || "",
                      instagramUrl: org.instagramUrl || "",
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir une organisation" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name} ({o.slug})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nom public</Label>
                <Input
                  value={orgDraft.name}
                  onChange={(e) =>
                    setOrgDraft((o) => ({ ...o, name: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Slug URL (/m/…)</Label>
                <Input
                  value={orgDraft.slug}
                  onChange={(e) =>
                    setOrgDraft((o) => ({ ...o, slug: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <ImageUpload
                  label="Logo organisation"
                  value={orgDraft.logo}
                  onChange={(url) => setOrgDraft((o) => ({ ...o, logo: url }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Facebook</Label>
                <Input
                  placeholder="https://facebook.com/…"
                  value={orgDraft.facebookUrl}
                  onChange={(e) =>
                    setOrgDraft((o) => ({ ...o, facebookUrl: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Instagram</Label>
                <Input
                  placeholder="https://instagram.com/…"
                  value={orgDraft.instagramUrl}
                  onChange={(e) =>
                    setOrgDraft((o) => ({ ...o, instagramUrl: e.target.value }))
                  }
                />
              </div>
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <Button
                  disabled={!orgDraft.id || updateOrg.isPending}
                  onClick={() => updateOrg.mutate()}
                >
                  Enregistrer l&apos;organisation
                </Button>
                <Button
                  variant="secondary"
                  disabled={!facility || !orgDraft.id || updateProfile.isPending}
                  onClick={() => updateProfile.mutate()}
                >
                  Lier à cette facility
                </Button>
              </div>
              <div className="rounded-lg border border-dashed p-3 sm:col-span-2">
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Nouvelle organisation
                </p>
                <div className="flex flex-wrap gap-2">
                  <Input
                    className="max-w-[180px]"
                    placeholder="Nom"
                    value={newOrg.name}
                    onChange={(e) =>
                      setNewOrg((n) => ({ ...n, name: e.target.value }))
                    }
                  />
                  <Input
                    className="max-w-[160px]"
                    placeholder="slug"
                    value={newOrg.slug}
                    onChange={(e) =>
                      setNewOrg((n) => ({ ...n, slug: e.target.value }))
                    }
                  />
                  <Button
                    variant="outline"
                    disabled={!newOrg.name.trim() || createOrg.isPending}
                    onClick={() => createOrg.mutate()}
                  >
                    Créer
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Détails facility</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["name", "Nom"],
                  ["numtel", "Téléphone"],
                  ["email", "Email"],
                  ["adresse", "Adresse"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="space-y-2">
                  <Label>{label}</Label>
                  <Input
                    value={profile[key]}
                    onChange={(e) =>
                      setProfile((p) => ({ ...p, [key]: e.target.value }))
                    }
                  />
                </div>
              ))}
              <div className="space-y-2 sm:col-span-2">
                <ImageUpload
                  label="Logo facility"
                  value={profile.logo}
                  onChange={(url) => setProfile((p) => ({ ...p, logo: url }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Facebook</Label>
                <Input
                  placeholder="https://facebook.com/…"
                  value={profile.facebook}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, facebook: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Instagram</Label>
                <Input
                  placeholder="https://instagram.com/…"
                  value={profile.instagram}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, instagram: e.target.value }))
                  }
                />
              </div>
              <Button
                className="sm:col-span-2"
                disabled={!facility || updateProfile.isPending}
                onClick={() => updateProfile.mutate()}
              >
                Enregistrer la facility
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog
        open={!!assignSeat}
        onOpenChange={(o) => {
          if (!o) setAssignSeat(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Assigner {assignSeat?.label}
              {assignSeat?.isOverflow ? " (overflow)" : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Membre présent</Label>
            <Select value={memberId} onValueChange={setMemberId}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir" />
              </SelectTrigger>
              <SelectContent>
                {presentMembers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.firstName || "Visiteur"} {m.phone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              disabled={!memberId || !assignSeat || book.isPending}
              onClick={() =>
                book.mutate({ seatId: assignSeat!.label, memberId })
              }
            >
              Assigner
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
