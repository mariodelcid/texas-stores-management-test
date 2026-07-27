// Idempotent seed: only runs on an empty database.
const { PrismaClient } = require("@prisma/client");
const { ingredients, products, bom, posMaps, mixes } = require("./data.js");

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.ingredient.count();
  if (count > 0) {
    console.log("Database already seeded, skipping.");
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
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
