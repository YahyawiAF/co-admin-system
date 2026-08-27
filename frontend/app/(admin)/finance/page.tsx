"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  caisseApi,
  dailyExpensesApi,
  dailyProductsApi,
  expensesApi,
  productsApi,
  type Expense,
} from "@/lib/api/resources";

const expenseSchema = z.object({
  name: z.string().min(1),
  amount: z.coerce.number().min(0),
  type: z.enum(["MENSUEL", "JOURNALIER"]),
  description: z.string().optional(),
});
type ExpenseForm = z.infer<typeof expenseSchema>;

export default function FinancePage() {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [openingFloat, setOpeningFloat] = useState("0");
  const [countedClose, setCountedClose] = useState("");
  const [notes, setNotes] = useState("");
  const [moveAmount, setMoveAmount] = useState("");
  const [moveLabel, setMoveLabel] = useState("");
  const [productId, setProductId] = useState("");
  const [productQty, setProductQty] = useState("1");
  const [expenseId, setExpenseId] = useState("");
  const [coffreAmount, setCoffreAmount] = useState("");
  const [coffreLabel, setCoffreLabel] = useState("");
  const [monthKey, setMonthKey] = useState(format(new Date(), "yyyy-MM"));
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);

  const year = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(5, 7));

  const { data: summary, refetch } = useQuery({
    queryKey: ["caisse-summary", date],
    queryFn: () => caisseApi.summary(date),
  });
  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => productsApi.list(),
  });
  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses"],
    queryFn: () => expensesApi.list(),
  });
  const { data: coffre } = useQuery({
    queryKey: ["coffre"],
    queryFn: () => caisseApi.coffre(),
  });
  const { data: monthData } = useQuery({
    queryKey: ["caisse-month", year, month],
    queryFn: () => caisseApi.month(year, month),
  });

  const session = summary?.session;
  const isOpen = !!session && !session.closedAt;
  const isClosed = !!session?.closedAt;
  const expected = summary?.expectedClose ?? 0;
  const counted = Number(countedClose);
  const closeDiff = countedClose === "" ? null : counted - expected;
  const closeMismatch =
    closeDiff !== null && Number.isFinite(counted) && Math.abs(closeDiff) > 0.05;

  const expenseForm = useForm<ExpenseForm>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      name: "",
      amount: 0,
      type: "JOURNALIER",
      description: "",
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["caisse-summary"] });
    queryClient.invalidateQueries({ queryKey: ["coffre"] });
    queryClient.invalidateQueries({ queryKey: ["caisse-month"] });
    queryClient.invalidateQueries({ queryKey: ["expenses"] });
    refetch();
  };

  const openCaisse = useMutation({
    mutationFn: () => caisseApi.open(date, Number(openingFloat) || 0),
    onSuccess: () => {
      toast.success("Caisse ouverte");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const closeCaisse = useMutation({
    mutationFn: () => {
      if (closeMismatch) {
        throw new Error(
          `Écart caisse : attendu ${expected.toFixed(2)} DT, compté ${counted.toFixed(2)} DT`
        );
      }
      return caisseApi.close(date, counted, notes || undefined);
    },
    onSuccess: (s) => {
      toast.success(
        s.syncedAt
          ? "Clôturée, versée au coffre et synchronisée ERP"
          : "Caisse clôturée — montant versé au coffre"
      );
      setCountedClose("");
      setNotes("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addMove = useMutation({
    mutationFn: (type: "IN" | "OUT") =>
      caisseApi.addMovement(session!.id, {
        type,
        amount: Number(moveAmount),
        label: moveLabel || undefined,
      }),
    onSuccess: () => {
      toast.success("Mouvement enregistré");
      setMoveAmount("");
      setMoveLabel("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addProduct = useMutation({
    mutationFn: () =>
      dailyProductsApi.create({
        productId,
        quantite: Number(productQty) || 1,
        date,
      }),
    onSuccess: () => {
      toast.success("Vente produit");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addExpense = useMutation({
    mutationFn: () =>
      dailyExpensesApi.create({
        expenseId,
        date,
      }),
    onSuccess: () => {
      toast.success("Dépense enregistrée");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addCoffre = useMutation({
    mutationFn: (type: "IN" | "OUT") =>
      caisseApi.addCoffre({
        type,
        amount: Number(coffreAmount),
        label: coffreLabel || undefined,
        date,
      }),
    onSuccess: () => {
      toast.success("Coffre mis à jour");
      setCoffreAmount("");
      setCoffreLabel("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveExpense = useMutation({
    mutationFn: (v: ExpenseForm) =>
      editExpense
        ? expensesApi.update(editExpense.id, v)
        : expensesApi.create(v),
    onSuccess: () => {
      toast.success(editExpense ? "Dépense mise à jour" : "Dépense créée");
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setExpenseOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeExpense = useMutation({
    mutationFn: (id: string) => expensesApi.remove(id),
    onSuccess: () => {
      toast.success("Dépense supprimée");
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const erpPreview = useMutation({
    mutationFn: () => caisseApi.erpPayloadPreview(date),
    onSuccess: async (payload) => {
      try {
        await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
        toast.success("Payload ERP copié");
      } catch {
        toast.message(JSON.stringify(payload));
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const kpis = useMemo(() => {
    if (!summary) return [];
    return [
      { label: "Journal payé", value: `${summary.revenueJournal.toFixed(1)} DT` },
      {
        label: "Abonnements",
        value: `${summary.revenueAbonnements.toFixed(1)} DT`,
      },
      { label: "Produits", value: `${summary.revenueProducts.toFixed(1)} DT` },
      { label: "Dépenses", value: `${summary.expenses.toFixed(1)} DT` },
      { label: "Net jour", value: `${summary.net.toFixed(1)} DT` },
      {
        label: "Attendu en caisse",
        value: `${summary.expectedClose.toFixed(1)} DT`,
      },
    ];
  }, [summary]);

  const expenseList = Array.isArray(expenses) ? expenses : [];
  const dailyCatalog = expenseList.filter((e) => e.type === "JOURNALIER");
  const monthlyCatalog = expenseList.filter((e) => e.type === "MENSUEL");

  const openCreateExpense = () => {
    setEditExpense(null);
    expenseForm.reset({
      name: "",
      amount: 0,
      type: "JOURNALIER",
      description: "",
    });
    setExpenseOpen(true);
  };

  const openEditExpense = (e: Expense) => {
    setEditExpense(e);
    expenseForm.reset({
      name: e.name,
      amount: e.amount,
      type: e.type,
      description: e.description || "",
    });
    setExpenseOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Finance</h1>
          <p className="text-muted-foreground">
            Caisse, dépenses journalières / mensuelles, coffre et analytics du
            mois
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            className="w-auto"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <Badge variant={isClosed ? "secondary" : isOpen ? "default" : "outline"}>
            {isClosed ? "Clôturée" : isOpen ? "Ouverte" : "Fermée"}
          </Badge>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {k.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{k.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="caisse">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="caisse">Caisse</TabsTrigger>
          <TabsTrigger value="depenses">Dépenses</TabsTrigger>
          <TabsTrigger value="coffre">Coffre</TabsTrigger>
          <TabsTrigger value="mois">Mensuel</TabsTrigger>
        </TabsList>

        <TabsContent value="caisse" className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Caisse du jour</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!session ? (
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="space-y-1">
                      <Label>Fond de caisse (ouverture)</Label>
                      <Input
                        type="number"
                        className="w-32"
                        value={openingFloat}
                        onChange={(e) => setOpeningFloat(e.target.value)}
                      />
                    </div>
                    <Button
                      disabled={openCaisse.isPending}
                      onClick={() => openCaisse.mutate()}
                    >
                      Ouvrir la caisse
                    </Button>
                  </div>
                ) : null}

                {isOpen ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Ouverte{" "}
                      {format(new Date(session!.openedAt), "HH:mm", {
                        locale: fr,
                      })}{" "}
                      · fond {session!.openingFloat} DT · attendu{" "}
                      {expected.toFixed(1)} DT
                    </p>
                    <div className="flex flex-wrap items-end gap-2 rounded-lg border p-3">
                      <div className="space-y-1">
                        <Label>Montant</Label>
                        <Input
                          type="number"
                          className="w-28"
                          value={moveAmount}
                          onChange={(e) => setMoveAmount(e.target.value)}
                        />
                      </div>
                      <div className="min-w-[140px] flex-1 space-y-1">
                        <Label>Libellé</Label>
                        <Input
                          value={moveLabel}
                          onChange={(e) => setMoveLabel(e.target.value)}
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!moveAmount || addMove.isPending}
                        onClick={() => addMove.mutate("IN")}
                      >
                        Entrée
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!moveAmount || addMove.isPending}
                        onClick={() => addMove.mutate("OUT")}
                      >
                        Sortie
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <Label>Espèces comptées à la clôture</Label>
                      <Input
                        type="number"
                        value={countedClose}
                        onChange={(e) => setCountedClose(e.target.value)}
                        placeholder={String(expected.toFixed(1))}
                      />
                      {closeMismatch ? (
                        <Alert variant="destructive">
                          <AlertDescription>
                            Écart de {closeDiff!.toFixed(2)} DT — la caisse ne
                            peut pas être clôturée tant que le comptage ne
                            correspond pas à l&apos;attendu (
                            {expected.toFixed(2)} DT).
                          </AlertDescription>
                        </Alert>
                      ) : countedClose ? (
                        <p className="text-xs text-muted-foreground">
                          Écart 0 — le montant sera versé au coffre.
                        </p>
                      ) : null}
                      <Textarea
                        placeholder="Notes…"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            disabled={
                              !countedClose ||
                              closeMismatch ||
                              closeCaisse.isPending
                            }
                          >
                            Clôturer
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Clôturer la caisse ?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Attendu {expected.toFixed(1)} DT · compté{" "}
                              {countedClose} DT. Le montant ira au coffre.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => closeCaisse.mutate()}
                            >
                              Confirmer
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </>
                ) : null}

                {isClosed && session ? (
                  <div className="space-y-1 text-sm">
                    <p>
                      Compté {session.countedClose} DT · attendu{" "}
                      {session.expectedClose} DT · écart{" "}
                      <strong>{session.difference} DT</strong>
                    </p>
                    <p className="text-muted-foreground">
                      Montant versé au coffre.
                    </p>
                    {session.externalRef ? (
                      <p className="text-muted-foreground">
                        ERP ref : {session.externalRef}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => erpPreview.mutate()}
                >
                  Copier payload ERP
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Ventes &amp; dépenses du jour
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[160px] flex-1 space-y-1">
                    <Label>Produit</Label>
                    <Select value={productId} onValueChange={setProductId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choisir" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} ({p.sellingPrice} DT)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    type="number"
                    className="w-20"
                    value={productQty}
                    onChange={(e) => setProductQty(e.target.value)}
                  />
                  <Button
                    size="sm"
                    disabled={!productId || addProduct.isPending}
                    onClick={() => addProduct.mutate()}
                  >
                    + Vente
                  </Button>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[160px] flex-1 space-y-1">
                    <Label>Dépense du jour</Label>
                    <Select value={expenseId} onValueChange={setExpenseId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choisir" />
                      </SelectTrigger>
                      <SelectContent>
                        {expenseList.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.name} ({e.amount} DT) · {e.type === "MENSUEL" ? "mensuel" : "journalier"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!expenseId || addExpense.isPending}
                    onClick={() => addExpense.mutate()}
                  >
                    Enregistrer
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(date), "EEEE d MMMM yyyy", { locale: fr })}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="depenses" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Catalogue : journalier (récurrent chaque jour) et mensuel.
              Appliquez-les sur l&apos;onglet Caisse.
            </p>
            <Dialog open={expenseOpen} onOpenChange={setExpenseOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreateExpense}>+ Dépense</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editExpense ? "Modifier la dépense" : "Nouvelle dépense"}
                  </DialogTitle>
                </DialogHeader>
                <form
                  className="space-y-3"
                  onSubmit={expenseForm.handleSubmit((v) =>
                    saveExpense.mutate(v)
                  )}
                >
                  <div className="space-y-2">
                    <Label>Nom</Label>
                    <Input {...expenseForm.register("name")} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label>Montant</Label>
                      <Input
                        type="number"
                        step="0.1"
                        {...expenseForm.register("amount")}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select
                        value={expenseForm.watch("type")}
                        onValueChange={(v) =>
                          expenseForm.setValue(
                            "type",
                            v as ExpenseForm["type"]
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="JOURNALIER">Journalier</SelectItem>
                          <SelectItem value="MENSUEL">Mensuel</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={saveExpense.isPending}>
                      Enregistrer
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {(["JOURNALIER", "MENSUEL"] as const).map((type) => {
            const list =
              type === "JOURNALIER" ? dailyCatalog : monthlyCatalog;
            return (
              <Card key={type}>
                <CardHeader>
                  <CardTitle className="text-base">
                    {type === "JOURNALIER"
                      ? "Dépenses journalières"
                      : "Dépenses mensuelles"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nom</TableHead>
                        <TableHead>Montant</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {list.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell className="font-medium">{e.name}</TableCell>
                          <TableCell>{e.amount} DT</TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => openEditExpense(e)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="icon" variant="ghost">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Supprimer ?</AlertDialogTitle>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => removeExpense.mutate(e.id)}
                                  >
                                    Supprimer
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      ))}
                      {!list.length ? (
                        <TableRow>
                          <TableCell
                            colSpan={3}
                            className="text-muted-foreground"
                          >
                            Aucune
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="coffre" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Solde coffre{" "}
                <span className="ml-2 text-2xl font-bold text-primary">
                  {(coffre?.balance ?? 0).toFixed(1)} DT
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                À la clôture (quand le comptage correspond), le cash du jour
                est versé ici. Entrée / sortie manuelle pour ajuster.
              </p>
              <div className="flex flex-wrap items-end gap-2 rounded-lg border p-3">
                <div className="space-y-1">
                  <Label>Montant</Label>
                  <Input
                    type="number"
                    className="w-28"
                    value={coffreAmount}
                    onChange={(e) => setCoffreAmount(e.target.value)}
                  />
                </div>
                <div className="min-w-[140px] flex-1 space-y-1">
                  <Label>Libellé</Label>
                  <Input
                    value={coffreLabel}
                    onChange={(e) => setCoffreLabel(e.target.value)}
                  />
                </div>
                <Button
                  size="sm"
                  disabled={!coffreAmount || addCoffre.isPending}
                  onClick={() => addCoffre.mutate("IN")}
                >
                  Entrée
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!coffreAmount || addCoffre.isPending}
                  onClick={() => addCoffre.mutate("OUT")}
                >
                  Sortie
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Libellé</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(coffre?.entries || []).map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>
                        {format(new Date(e.date), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={e.type === "IN" ? "default" : "secondary"}
                        >
                          {e.type === "IN" ? "Entrée" : "Sortie"}
                        </Badge>
                      </TableCell>
                      <TableCell>{e.label || "—"}</TableCell>
                      <TableCell className="text-right">
                        {e.type === "OUT" ? "−" : "+"}
                        {e.amount} DT
                      </TableCell>
                    </TableRow>
                  ))}
                  {!coffre?.entries?.length ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-muted-foreground">
                        Aucun mouvement
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mois" className="mt-4 space-y-4">
          <div className="flex items-center gap-2">
            <Label>Mois</Label>
            <Input
              type="month"
              className="w-auto"
              value={monthKey}
              onChange={(e) => setMonthKey(e.target.value)}
            />
          </div>
          {monthData ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    label: "Journal",
                    value: monthData.revenueJournal,
                  },
                  {
                    label: "Abonnements",
                    value: monthData.revenueAbonnements,
                  },
                  {
                    label: "Produits",
                    value: monthData.revenueProducts,
                  },
                  {
                    label: "Dépenses jour",
                    value: monthData.expensesDaily,
                  },
                  {
                    label: "Dépenses mois",
                    value: monthData.expensesMonthly,
                  },
                  { label: "Net", value: monthData.net },
                  { label: "Coffre net", value: monthData.coffreNet },
                  {
                    label: "Jours clôturés",
                    value: monthData.daysClosed,
                    raw: true,
                  },
                ].map((k) => (
                  <Card key={k.label}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        {k.label}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {"raw" in k && k.raw
                          ? k.value
                          : `${Number(k.value).toFixed(1)} DT`}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Clôtures du mois</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>État</TableHead>
                        <TableHead>Attendu</TableHead>
                        <TableHead>Compté</TableHead>
                        <TableHead>Écart</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthData.sessions.map((s) => (
                        <TableRow key={String(s.date)}>
                          <TableCell>
                            {format(new Date(s.date), "dd/MM")}
                          </TableCell>
                          <TableCell>
                            {s.closedAt ? "Clôturée" : "Ouverte"}
                          </TableCell>
                          <TableCell>
                            {s.expectedClose != null
                              ? `${s.expectedClose.toFixed(1)} DT`
                              : "—"}
                          </TableCell>
                          <TableCell>
                            {s.countedClose != null
                              ? `${s.countedClose.toFixed(1)} DT`
                              : "—"}
                          </TableCell>
                          <TableCell>
                            {s.difference != null
                              ? `${s.difference.toFixed(1)} DT`
                              : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                      {!monthData.sessions.length ? (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className="text-muted-foreground"
                          >
                            Aucune session ce mois
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
