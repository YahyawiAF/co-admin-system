import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { Journal } from "@/lib/types";
import { memberOf, priceOf, visitStatus } from "@/lib/journal-utils";

export type ExportSeatMap = Map<string, string>; // memberId -> seatId

function rowLine(row: Journal, seats?: ExportSeatMap) {
  const m = memberOf(row);
  const p = priceOf(row);
  const status = visitStatus(row);
  const statusLabel =
    status === "reservation"
      ? "Réservé"
      : status === "left"
        ? "Terminé"
        : "En cours";
  const seat =
    m?.id && seats?.get(m.id) ? ` · Place ${seats.get(m.id)}` : "";
  const paid = row.isPayed ? "Payé" : "Non payé";
  return `${m?.firstName || "Visiteur"}${
    m?.visitorNumber ? ` #${m.visitorNumber}` : ""
  } · ${p?.name || "—"} · ${format(new Date(row.registredTime), "HH:mm")}${
    row.leaveTime ? `→${format(new Date(row.leaveTime), "HH:mm")}` : ""
  } · ${row.payedAmount} DT · ${paid} · ${statusLabel}${seat}`;
}

export function buildDayWhatsAppText(
  date: Date,
  rows: Journal[],
  seats?: ExportSeatMap
) {
  const present = rows.filter((r) => visitStatus(r) === "present");
  const left = rows.filter((r) => visitStatus(r) === "left");
  const reservations = rows.filter((r) => visitStatus(r) === "reservation");
  const revenue = rows
    .filter((r) => r.isPayed)
    .reduce((a, r) => a + (r.payedAmount || 0), 0);
  const unpaid = rows.filter((r) => !r.isPayed);

  const lines = [
    `📋 Journal Collabora Hub — ${format(date, "EEEE d MMMM yyyy", {
      locale: fr,
    })}`,
    ``,
    `Présents: ${present.length} · Terminés: ${left.length} · Réservations: ${reservations.length}`,
    `Revenu encaissé: ${revenue.toFixed(1)} DT · Impayés: ${unpaid.length}`,
    ``,
  ];

  if (present.length) {
    lines.push(`🟢 EN COURS`);
    present.forEach((r) => lines.push(`• ${rowLine(r, seats)}`));
    lines.push(``);
  }
  if (left.length) {
    lines.push(`⚪ TERMINÉS`);
    left.forEach((r) => lines.push(`• ${rowLine(r, seats)}`));
    lines.push(``);
  }
  if (reservations.length) {
    lines.push(`🟣 RÉSERVATIONS`);
    reservations.forEach((r) => lines.push(`• ${rowLine(r, seats)}`));
    lines.push(``);
  }
  if (unpaid.length) {
    lines.push(`💰 IMPAYÉS`);
    unpaid.forEach((r) => {
      const m = memberOf(r);
      lines.push(
        `• ${m?.firstName || "Visiteur"} — ${r.payedAmount} DT${
          m?.phone ? ` (${m.phone})` : ""
        }`
      );
    });
  }

  return lines.join("\n").trim();
}

export function openDayPrintView(
  date: Date,
  rows: Journal[],
  seats?: ExportSeatMap
) {
  const title = `Journal — ${format(date, "dd/MM/yyyy")}`;
  const revenue = rows
    .filter((r) => r.isPayed)
    .reduce((a, r) => a + (r.payedAmount || 0), 0);
  const present = rows.filter((r) => visitStatus(r) === "present").length;
  const unpaid = rows.filter((r) => !r.isPayed).length;

  const bodyRows = rows
    .map((row) => {
      const m = memberOf(row);
      const p = priceOf(row);
      const status = visitStatus(row);
      const statusLabel =
        status === "reservation"
          ? "Réservé"
          : status === "left"
            ? "Terminé"
            : "En cours";
      const seat =
        m?.id && seats?.get(m.id) ? seats.get(m.id)! : "—";
      return `<tr>
        <td>${m?.visitorNumber ? `#${m.visitorNumber}` : "—"}</td>
        <td>${escapeHtml(m?.firstName || "Visiteur")}<br/><small>${escapeHtml(
          m?.phone || ""
        )}</small></td>
        <td>${escapeHtml(p?.name || "—")}</td>
        <td>${format(new Date(row.registredTime), "HH:mm")}</td>
        <td>${
          row.leaveTime ? format(new Date(row.leaveTime), "HH:mm") : "—"
        }</td>
        <td>${escapeHtml(seat)}</td>
        <td>${row.payedAmount} DT</td>
        <td>${row.isPayed ? "Oui" : "Non"}</td>
        <td>${statusLabel}</td>
      </tr>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 24px; color: #111; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    .meta { color: #555; margin-bottom: 16px; font-size: 13px; }
    .kpis { display: flex; gap: 16px; margin-bottom: 20px; font-size: 13px; }
    .kpis span { background: #f4f4f5; padding: 6px 10px; border-radius: 6px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #f8fafc; }
    @media print {
      .no-print { display: none !important; }
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom:16px;display:flex;gap:8px;">
    <button onclick="window.print()" style="padding:8px 14px;font-weight:600;cursor:pointer;">
      Imprimer / PDF
    </button>
    <button onclick="window.close()" style="padding:8px 14px;cursor:pointer;">Fermer</button>
  </div>
  <h1>Collabora Hub — ${escapeHtml(title)}</h1>
  <p class="meta">${format(date, "EEEE d MMMM yyyy", { locale: fr })}</p>
  <div class="kpis">
    <span>${rows.length} entrées</span>
    <span>${present} présents</span>
    <span>${revenue.toFixed(1)} DT encaissés</span>
    <span>${unpaid} impayés</span>
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th><th>Nom</th><th>Forfait</th><th>Arrivée</th>
        <th>Départ</th><th>Place</th><th>Montant</th><th>Payé</th><th>Statut</th>
      </tr>
    </thead>
    <tbody>${bodyRows || `<tr><td colspan="9">Aucune entrée</td></tr>`}</tbody>
  </table>
</body>
</html>`;

  const w = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
  if (!w) {
    throw new Error("Pop-up bloquée — autorisez les fenêtres pour exporter");
  }
  w.document.write(html);
  w.document.close();
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
