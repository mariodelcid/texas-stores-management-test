const express = require("express");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

const POS_URL = process.env.POS_URL || "https://texasstores.up.railway.app";
const TZ = process.env.TZ_NAME || "America/Chicago";

// ---------- helpers ----------
function localDate(isoString) {
  // YYYY-MM-DD in store timezone
  return new Date(isoString).toLocaleDateString("en-CA", { timeZone: TZ });
}

let salesCache = { at: 0, data: null };
async function fetchSales() {
  if (salesCache.data && Date.now() - salesCache.at < 60_000) return salesCache.data;
  const res = await fetch(`${POS_URL}/api/sales`);
  if (!res.ok) throw new Error(`POS /api/sales returned ${res.status}`);
  const data = await res.json();
  salesCache = { at: Date.now(), data };
  return data;
}

async function bomCostByProductId() {
  const lines = await prisma.bomLine.findMany({ include: { ingredient: true } });
  const cost = {};
  for (const l of lines) {
    cost[l.productId] = (cost[l.productId] || 0) + l.quantity * (l.ingredient.costPerUnit || 0);
  }
  return cost; // dollars per unit sold
}

async function getDailyOverheadCents() {
  const s = await prisma.setting.findUnique({ where: { key: "dailyOverheadCents" } });
  return s ? parseInt(s.value, 10) || 0 : 0;
}

// ---------- profit endpoints ----------
// GET /api/daily?date=YYYY-MM-DD  (default: today in store timezone)
app.get("/api/daily", async (req, res) => {
  try {
    const date = req.query.date || new Date().toLocaleDateString("en-CA", { timeZone: TZ });
    const [sales, maps, costs, overheadCents] = await Promise.all([
      fetchSales(),
      prisma.posMap.findMany({ include: { product: true } }),
      bomCostByProductId(),
      getDailyOverheadCents()
    ]);
    const mapByName = Object.fromEntries(maps.map(m => [m.posName, m]));

    const rows = {}; // posName -> aggregate
    let saleCount = 0;
    for (const sale of sales) {
      if (localDate(sale.createdAt) !== date) continue;
      saleCount++;
      for (const li of sale.items || []) {
        const name = li.item ? li.item.name : `item #${li.itemId}`;
        const r = (rows[name] ||= {
          posName: name, qty: 0, revenueCents: 0, costCents: 0,
          profitCents: 0, mapped: true, productCode: null
        });
        const m = mapByName[name];
        const revenue = li.lineTotalCents || 0;
        r.qty += li.quantity || 0;
        r.revenueCents += revenue;
        if (m && m.kind === "ignore") { r.ignored = true; continue; }
        if (m && m.kind === "zerocost") {
          r.profitCents += revenue;
          r.productCode = "(no cost)";
        } else if (m && m.product) {
          const unitCostCents = Math.round((costs[m.productId] || 0) * 100);
          const c = unitCostCents * (li.quantity || 0);
          r.costCents += c;
          r.profitCents += revenue - c;
          r.productCode = m.product.code;
        } else {
          r.mapped = false; // unmapped: revenue counted, profit unknown
        }
      }
    }

    const list = Object.values(rows).sort((a, b) => b.revenueCents - a.revenueCents);
    const totals = list.reduce((t, r) => {
      t.qty += r.qty;
      t.revenueCents += r.revenueCents;
      t.costCents += r.costCents;
      if (r.mapped) t.profitCents += r.profitCents;
      else t.unmappedRevenueCents += r.revenueCents;
      return t;
    }, { qty: 0, revenueCents: 0, costCents: 0, profitCents: 0, unmappedRevenueCents: 0 });

    res.json({
      date, timezone: TZ, saleCount,
      overheadCents,
      items: list,
      totals: {
        ...totals,
        netProfitCents: totals.profitCents - overheadCents
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/range?start=YYYY-MM-DD&end=YYYY-MM-DD  -> per-day totals
app.get("/api/range", async (req, res) => {
  try {
    const [sales, maps, costs, overheadCents] = await Promise.all([
      fetchSales(),
      prisma.posMap.findMany({ include: { product: true } }),
      bomCostByProductId(),
      getDailyOverheadCents()
    ]);
    const mapByName = Object.fromEntries(maps.map(m => [m.posName, m]));
    const days = {};
    for (const sale of sales) {
      const d = localDate(sale.createdAt);
      if (req.query.start && d < req.query.start) continue;
      if (req.query.end && d > req.query.end) continue;
      const day = (days[d] ||= { date: d, revenueCents: 0, costCents: 0, profitCents: 0, unmappedRevenueCents: 0 });
      for (const li of sale.items || []) {
        const name = li.item ? li.item.name : `item #${li.itemId}`;
        const m = mapByName[name];
        const revenue = li.lineTotalCents || 0;
        day.revenueCents += revenue;
        if (m && m.kind === "ignore") continue;
        if (m && m.kind === "zerocost") day.profitCents += revenue;
        else if (m && m.product) {
          const c = Math.round((costs[m.productId] || 0) * 100) * (li.quantity || 0);
          day.costCents += c;
          day.profitCents += revenue - c;
        } else day.unmappedRevenueCents += revenue;
      }
    }
    const list = Object.values(days).sort((a, b) => b.date.localeCompare(a.date));
    for (const d of list) d.netProfitCents = d.profitCents - overheadCents;
    res.json({ overheadCents, days: list });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- ingredients ----------
app.get("/api/ingredients", async (_req, res) => {
  res.json(await prisma.ingredient.findMany({ orderBy: { code: "asc" } }));
});
app.post("/api/ingredients", async (req, res) => {
  try { res.json(await prisma.ingredient.create({ data: req.body })); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
app.put("/api/ingredients/:id", async (req, res) => {
  try {
    const { id, ...data } = req.body;
    res.json(await prisma.ingredient.update({ where: { id: +req.params.id }, data }));
  } catch (e) { res.status(400).json({ error: e.message }); }
});
app.delete("/api/ingredients/:id", async (req, res) => {
  try { res.json(await prisma.ingredient.delete({ where: { id: +req.params.id } })); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// ---------- products (with computed BOM cost) ----------
app.get("/api/products", async (_req, res) => {
  const [products, costs] = await Promise.all([
    prisma.product.findMany({
      orderBy: { code: "asc" },
      include: { bomLines: { include: { ingredient: true }, orderBy: { id: "asc" } } }
    }),
    bomCostByProductId()
  ]);
  res.json(products.map(p => ({ ...p, bomCost: +(costs[p.id] || 0).toFixed(4) })));
});
app.post("/api/products", async (req, res) => {
  try { res.json(await prisma.product.create({ data: req.body })); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
app.put("/api/products/:id", async (req, res) => {
  try {
    const { id, bomLines, bomCost, posMaps, ...data } = req.body;
    res.json(await prisma.product.update({ where: { id: +req.params.id }, data }));
  } catch (e) { res.status(400).json({ error: e.message }); }
});
app.delete("/api/products/:id", async (req, res) => {
  try { res.json(await prisma.product.delete({ where: { id: +req.params.id } })); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// Replace all BOM lines of a product: body = [{ingredientCode, componentType, quantity}]
app.put("/api/products/:id/bom", async (req, res) => {
  try {
    const productId = +req.params.id;
    const ing = Object.fromEntries((await prisma.ingredient.findMany()).map(i => [i.code, i.id]));
    const lines = [];
    for (const l of req.body) {
      if (!ing[l.ingredientCode]) return res.status(400).json({ error: `Unknown ingredient code ${l.ingredientCode}` });
      lines.push({ productId, ingredientId: ing[l.ingredientCode], componentType: l.componentType || null, quantity: +l.quantity || 0 });
    }
    await prisma.$transaction([
      prisma.bomLine.deleteMany({ where: { productId } }),
      prisma.bomLine.createMany({ data: lines })
    ]);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ---------- mixes ----------
app.get("/api/mixes", async (_req, res) => {
  res.json(await prisma.mix.findMany({ include: { lines: true }, orderBy: { id: "asc" } }));
});
app.post("/api/mixes", async (req, res) => {
  try {
    const { name, linkedIngredientCode, lines = [] } = req.body;
    res.json(await prisma.mix.create({
      data: { name, linkedIngredientCode, lines: { create: lines } },
      include: { lines: true }
    }));
  } catch (e) { res.status(400).json({ error: e.message }); }
});
app.put("/api/mixes/:id", async (req, res) => {
  try {
    const { name, linkedIngredientCode, lines = [] } = req.body;
    const id = +req.params.id;
    await prisma.$transaction([
      prisma.mixLine.deleteMany({ where: { mixId: id } }),
      prisma.mix.update({
        where: { id },
        data: {
          name, linkedIngredientCode,
          lines: { create: lines.map(l => ({ componentName: l.componentName, oz: l.oz, cost: l.cost })) }
        }
      })
    ]);
    res.json(await prisma.mix.findUnique({ where: { id }, include: { lines: true } }));
  } catch (e) { res.status(400).json({ error: e.message }); }
});
app.delete("/api/mixes/:id", async (req, res) => {
  try { res.json(await prisma.mix.delete({ where: { id: +req.params.id } })); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// ---------- POS mapping ----------
app.get("/api/mappings", async (_req, res) => {
  res.json(await prisma.posMap.findMany({ include: { product: true }, orderBy: { posName: "asc" } }));
});
app.post("/api/mappings", async (req, res) => {
  try {
    const { posName, kind, productCode } = req.body;
    let productId = null;
    if (productCode) {
      const p = await prisma.product.findUnique({ where: { code: productCode } });
      if (!p) return res.status(400).json({ error: `Unknown product code ${productCode}` });
      productId = p.id;
    }
    res.json(await prisma.posMap.upsert({
      where: { posName },
      create: { posName, kind: kind || "product", productId },
      update: { kind: kind || "product", productId }
    }));
  } catch (e) { res.status(400).json({ error: e.message }); }
});
app.delete("/api/mappings/:id", async (req, res) => {
  try { res.json(await prisma.posMap.delete({ where: { id: +req.params.id } })); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// POS items passthrough (to help build mappings)
app.get("/api/pos-items", async (_req, res) => {
  try {
    const r = await fetch(`${POS_URL}/api/items`);
    res.json(await r.json());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------- settings ----------
app.get("/api/settings", async (_req, res) => {
  const all = await prisma.setting.findMany();
  res.json(Object.fromEntries(all.map(s => [s.key, s.value])));
});
app.put("/api/settings", async (req, res) => {
  try {
    for (const [key, value] of Object.entries(req.body)) {
      await prisma.setting.upsert({ where: { key }, create: { key, value: String(value) }, update: { value: String(value) } });
    }
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});


// ---------- inventory ----------
// GET /api/inventory?start=YYYY-MM-DD&end=YYYY-MM-DD
// - POS item stock (live from the POS)
// - ingredient usage in the range (from sales x BOM)
// - estimated remaining per ingredient (last count - usage since count)
app.get("/api/inventory", async (req, res) => {
  try {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: TZ });
    const start = req.query.start || today;
    const end = req.query.end || today;
    const [sales, maps, ingredients, bomLines, posItemsRes] = await Promise.all([
      fetchSales(),
      prisma.posMap.findMany(),
      prisma.ingredient.findMany({ orderBy: { code: "asc" } }),
      prisma.bomLine.findMany(),
      fetch(`${POS_URL}/api/items`).then(r => r.json()).catch(() => [])
    ]);
    const mapByName = Object.fromEntries(maps.map(m => [m.posName, m]));
    const bomByProduct = {};
    for (const l of bomLines) (bomByProduct[l.productId] ||= []).push(l);

    const rangeUsage = {};      // ingredientId -> qty used in [start, end]
    const sinceUsage = {};      // ingredientId -> qty used since that ingredient's countedAt
    const counted = Object.fromEntries(
      ingredients.filter(i => i.countedAt).map(i => [i.id, new Date(i.countedAt).getTime()])
    );

    for (const sale of sales) {
      const d = localDate(sale.createdAt);
      const t = new Date(sale.createdAt).getTime();
      const inRange = d >= start && d <= end;
      for (const li of sale.items || []) {
        const name = li.item ? li.item.name : null;
        const m = name && mapByName[name];
        if (!m || m.kind !== "product" || !m.productId) continue;
        for (const bl of bomByProduct[m.productId] || []) {
          const used = bl.quantity * (li.quantity || 0);
          if (inRange) rangeUsage[bl.ingredientId] = (rangeUsage[bl.ingredientId] || 0) + used;
          if (counted[bl.ingredientId] && t > counted[bl.ingredientId])
            sinceUsage[bl.ingredientId] = (sinceUsage[bl.ingredientId] || 0) + used;
        }
      }
    }

    res.json({
      start, end, timezone: TZ,
      ingredients: ingredients.map(i => {
        const usageSinceCount = i.countedAt ? +(sinceUsage[i.id] || 0).toFixed(2) : null;
        return {
          id: i.id, code: i.code, name: i.name, unit: i.unit,
          used: +(rangeUsage[i.id] || 0).toFixed(2),
          stockOnHand: i.stockOnHand, countedAt: i.countedAt,
          usageSinceCount,
          estRemaining: i.stockOnHand != null && usageSinceCount != null
            ? +(i.stockOnHand - usageSinceCount).toFixed(2) : null
        };
      }),
      posItems: (Array.isArray(posItemsRes) ? posItemsRes : []).map(p => ({
        name: p.name, category: p.category, stock: p.stock, priceCents: p.priceCents
      })).sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0))
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// ---------- reports ----------
// GET /api/report?period=week|month&date=YYYY-MM-DD (any date inside the period; default today)
app.get("/api/report", async (req, res) => {
  try {
    const period = req.query.period === "month" ? "month" : "week";
    const today = new Date().toLocaleDateString("en-CA", { timeZone: TZ });
    const ref = req.query.date || today;
    const [y, m, d] = ref.split("-").map(Number);
    let start, end;
    if (period === "month") {
      start = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-01`;
      const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
      end = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
    } else {
      const dt = new Date(Date.UTC(y, m - 1, d));
      const dow = (dt.getUTCDay() + 6) % 7; // Monday = 0
      const mon = new Date(dt); mon.setUTCDate(dt.getUTCDate() - dow);
      const sun = new Date(mon); sun.setUTCDate(mon.getUTCDate() + 6);
      start = mon.toISOString().slice(0, 10);
      end = sun.toISOString().slice(0, 10);
    }
    const [sales, maps, costs, overheadCents] = await Promise.all([
      fetchSales(),
      prisma.posMap.findMany({ include: { product: true } }),
      bomCostByProductId(),
      getDailyOverheadCents()
    ]);
    const mapByName = Object.fromEntries(maps.map(m2 => [m2.posName, m2]));

    const days = {}, items = {};
    let saleCount = 0;
    for (const sale of sales) {
      const dd = localDate(sale.createdAt);
      if (dd < start || dd > end) continue;
      saleCount++;
      const day = (days[dd] ||= { date: dd, revenueCents: 0, costCents: 0, profitCents: 0, unmappedRevenueCents: 0, sales: 0 });
      day.sales++;
      for (const li of sale.items || []) {
        const name = li.item ? li.item.name : `item #${li.itemId}`;
        const it = (items[name] ||= { posName: name, qty: 0, revenueCents: 0, costCents: 0, profitCents: 0, mapped: true });
        const revenue = li.lineTotalCents || 0;
        const m2 = mapByName[name];
        day.revenueCents += revenue;
        it.qty += li.quantity || 0;
        it.revenueCents += revenue;
        if (m2 && m2.kind === "ignore") continue;
        if (m2 && m2.kind === "zerocost") { day.profitCents += revenue; it.profitCents += revenue; }
        else if (m2 && m2.product) {
          const c = Math.round((costs[m2.productId] || 0) * 100) * (li.quantity || 0);
          day.costCents += c; day.profitCents += revenue - c;
          it.costCents += c; it.profitCents += revenue - c;
        } else { day.unmappedRevenueCents += revenue; it.mapped = false; }
      }
    }

    // overhead applies to each day of the period that has already passed
    const lastDay = end < today ? end : today;
    let daysElapsed = 0;
    if (start <= lastDay) {
      const s = new Date(start + "T00:00:00Z"), e = new Date(lastDay + "T00:00:00Z");
      daysElapsed = Math.round((e - s) / 86400000) + 1;
    }
    const dayList = Object.values(days).sort((a, b) => a.date.localeCompare(b.date));
    const itemList = Object.values(items).sort((a, b) => b.revenueCents - a.revenueCents);
    const totals = dayList.reduce((t, x) => {
      t.revenueCents += x.revenueCents; t.costCents += x.costCents;
      t.profitCents += x.profitCents; t.unmappedRevenueCents += x.unmappedRevenueCents;
      t.sales += x.sales; return t;
    }, { revenueCents: 0, costCents: 0, profitCents: 0, unmappedRevenueCents: 0, sales: 0 });
    const overheadTotalCents = overheadCents * daysElapsed;
    res.json({
      period, start, end, timezone: TZ, saleCount,
      overheadCents, daysElapsed, overheadTotalCents,
      days: dayList, items: itemList,
      totals: { ...totals, netProfitCents: totals.profitCents - overheadTotalCents }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Management app on :${port} (POS: ${POS_URL}, TZ: ${TZ})`));
