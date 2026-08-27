"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { productsApi, mobileApi, type Product } from "@/lib/api/resources";
import { queryKeys } from "@/lib/query-client";
import { Badge } from "@/components/ui/badge";
import { ImageUpload } from "@/components/admin/ImageUpload";

const schema = z.object({
  name: z.string().min(1),
  purchasePrice: z.coerce.number().min(0),
  sellingPrice: z.coerce.number().min(0),
  stock: z.coerce.number().int().min(0),
  description: z.string().optional(),
  img: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Product | null>(null);

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => productsApi.list(),
  });
  const { data: pending = [] } = useQuery({
    queryKey: queryKeys.productOrdersPending,
    queryFn: () => mobileApi.pendingOrders(),
    refetchInterval: 8_000,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      purchasePrice: 0,
      sellingPrice: 0,
      stock: 0,
      description: "",
      img: "",
    },
  });

  const openCreate = () => {
    setEdit(null);
    form.reset({
      name: "",
      purchasePrice: 0,
      sellingPrice: 0,
      stock: 0,
      description: "",
      img: "",
    });
    setOpen(true);
  };

  const openEdit = (p: Product) => {
    setEdit(p);
    form.reset({
      name: p.name,
      purchasePrice: p.purchasePrice,
      sellingPrice: p.sellingPrice,
      stock: p.stock,
      description: p.description || "",
      img: p.img || "",
    });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: (v: FormValues) =>
      edit ? productsApi.update(edit.id, v) : productsApi.create(v),
    onSuccess: () => {
      toast.success(edit ? "Produit mis à jour" : "Produit créé");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => productsApi.remove(id),
    onSuccess: () => {
      toast.success("Produit supprimé");
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const confirmOrder = useMutation({
    mutationFn: (id: string) => mobileApi.confirmOrder(id),
    onSuccess: () => {
      toast.success("Commande confirmée");
      queryClient.invalidateQueries({
        queryKey: queryKeys.productOrdersPending,
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-muted-foreground">Stock café / boutique</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>+ Produit</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {edit ? "Modifier le produit" : "Nouveau produit"}
              </DialogTitle>
            </DialogHeader>
            <form
              className="space-y-3"
              onSubmit={form.handleSubmit((v) => save.mutate(v))}
            >
              <div className="space-y-2">
                <Label>Nom</Label>
                <Input {...form.register("name")} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-2">
                  <Label>Achat</Label>
                  <Input type="number" step="0.1" {...form.register("purchasePrice")} />
                </div>
                <div className="space-y-2">
                  <Label>Vente</Label>
                  <Input type="number" step="0.1" {...form.register("sellingPrice")} />
                </div>
                <div className="space-y-2">
                  <Label>Stock</Label>
                  <Input type="number" {...form.register("stock")} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input {...form.register("description")} />
              </div>
              <ImageUpload
                label="Photo (café / boutique)"
                value={form.watch("img")}
                onChange={(url) => form.setValue("img", url || "")}
              />
              <DialogFooter>
                <Button type="submit">Enregistrer</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Commandes café / boutique</h2>
            <Badge variant={pending.length ? "default" : "secondary"}>
              {pending.length} en attente
            </Badge>
          </div>
          {!pending.length ? (
            <p className="text-sm text-muted-foreground">
              Aucune commande en attente. Les visiteurs commandent depuis
              l’app mobile (Café + Boutique).
            </p>
          ) : (
            <div className="space-y-2">
              {pending.map((o) => (
                <div
                  key={o.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {o.memberName || "Visiteur"}
                      {o.visitorNumber ? ` #${o.visitorNumber}` : ""}
                    </p>
                    <p className="text-muted-foreground">
                      {o.quantity}× {o.productName} · {o.amount.toFixed(2)} DT
                    </p>
                  </div>
                  <Button
                    size="sm"
                    disabled={confirmOrder.isPending}
                    onClick={() => confirmOrder.mutate(o.id)}
                  >
                    Confirmer
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Achat</TableHead>
                <TableHead>Vente</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(Array.isArray(products) ? products : []).map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.purchasePrice} DT</TableCell>
                  <TableCell>{p.sellingPrice} DT</TableCell>
                  <TableCell
                    className={
                      p.stock <= 5 ? "font-semibold text-amber-600" : undefined
                    }
                  >
                    {p.stock}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
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
                          <AlertDialogAction onClick={() => remove.mutate(p.id)}>
                            Supprimer
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
