// Idempotent seed: only runs on an empty database.
const { PrismaClient } = require("@prisma/client");
const { ingredients, products, bom, posMaps, mixes } = require("./data.js");

const prisma = new PrismaClient();

async function ensureExtras() {
  // Elote Entero product + BOM (not in the original sheet)
  const codes = ["1002","1003","1005","1006","1007","1008","1009","1010","3014"];
  const ing = Object.fromEntries(
    (await prisma.ingredient.findMany({ where: { code: { in: codes } } })).map(i => [i.code, i.id])
  );
  let entero = await prisma.product.findUnique({ where: { code: "4040" } });
  if (!entero) {
    entero = await prisma.product.create({ data: { code: "4040", name: "Elote Entero", priceCents: 500 } });
    const lines = [["1002",1],["1003",1],["1005",1],["1006",1],["1007",1],["1008",1],["1009",1],["1010",1],["3014",2]];
    for (const [c, q] of lines) {
      if (ing[c]) await prisma.bomLine.create({
        data: { productId: entero.id, ingredientId: ing[c], componentType: c === "3014" ? "Disposable" : "Ingredient", quantity: q }
      });
    }
    console.log("Created product 4040 Elote Entero with BOM.");
  }
  // Mappings used by the manual (paper) sales import
  const mapTo = async (posName, productCode) => {
    const p = await prisma.product.findUnique({ where: { code: productCode } });
    if (!p) return;
    await prisma.posMap.upsert({
      where: { posName },
      create: { posName, kind: "product", productId: p.id },
      update: {}
    });
  };
  await mapTo("Elote Entero", "4040");
  await mapTo("Drink 24 oz", "4019"); // representative 24oz-cup drink (horchata) for costing
  await mapTo("Drink 20 oz", "4016"); // representative 20oz-cup drink (chamoyada) for costing
  await mapTo("Hot Drink", "4038");   // representative hot-cup drink
}

async function importManualSales() {
  const { manualSales, manualCard } = require("./manual-sales.js");
  if ((await prisma.manualSale.count()) === 0) {
    await prisma.manualSale.createMany({
      data: manualSales.map(([date, posName, qty, revenue]) => ({
        date, posName, qty, revenueCents: Math.round(revenue * 100)
      }))
    });
    console.log(`Imported ${manualSales.length} manual sale lines from the paper sheets.`);
  }
  if ((await prisma.manualDay.count()) === 0 && manualCard) {
    await prisma.manualDay.createMany({
      data: manualCard.map(([date, card]) => ({ date, cardCents: Math.round(card * 100) }))
    });
    console.log(`Imported card totals for ${manualCard.length} paper days.`);
  }
  await prisma.setting.upsert({
    where: { key: "cardFeePct" },
    create: { key: "cardFeePct", value: "8.25" },
    update: {}
  });
}

async function main() {
  const count = await prisma.ingredient.count();
  if (count > 0) {
    console.log("Database already seeded, skipping base seed.");
    await ensureExtras();
    await importManualSales();
    return;
  }
  console.log("Seeding database from spreadsheet data...");

  for (const [code, name, unit, purchaseUnits, pricePerPU, costPerUnit, p1, p1p, p2, p2p] of ingredients) {
    await prisma.ingredient.create({
      data: {
        code, name, unit,
        purchaseUnits: purchaseUnits ?? null,
        pricePerPU: pricePerPU ?? null,
        costPerUnit: costPerUnit ?? 0,
        provider1: p1 ?? null, provider1Price: p1p ?? null,
        provider2: p2 ?? null, provider2Price: p2p ?? null
      }
    });
  }

  for (const [code, name, priceCents] of products) {
    await prisma.product.create({ data: { code, name, priceCents } });
  }

  const ing = Object.fromEntries((await prisma.ingredient.findMany()).map(i => [i.code, i.id]));
  const prod = Object.fromEntries((await prisma.product.findMany()).map(p => [p.code, p.id]));

  for (const [pc, type, ic, qty] of bom) {
    if (!prod[pc] || !ing[ic]) { console.warn("skip bom line", pc, ic); continue; }
    await prisma.bomLine.create({
      data: { productId: prod[pc], ingredientId: ing[ic], componentType: type || null, quantity: qty || 0 }
    });
  }

  for (const [posName, kind, pc] of posMaps) {
    await prisma.posMap.create({
      data: { posName, kind, productId: pc ? prod[pc] ?? null : null }
    });
  }

  for (const m of mixes) {
    await prisma.mix.create({
      data: {
        name: m.name,
        linkedIngredientCode: m.linkedIngredientCode,
        lines: { create: m.lines.map(([componentName, oz, cost]) => ({ componentName, oz, cost })) }
      }
    });
  }

  await prisma.setting.upsert({
    where: { key: "dailyOverheadCents" },
    create: { key: "dailyOverheadCents", value: "20000" },
    update: {}
  });

  console.log("Seed complete.");
  await ensureExtras();
  await importManualSales();
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
