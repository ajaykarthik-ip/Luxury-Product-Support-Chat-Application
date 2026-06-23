import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Free, license-clear stock photos from Unsplash (each verified 200 OK).
// w=1600 keeps them crisp on retina/4K without shipping the full 3000px file.
const img = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1600&q=80`;

// 3 categories × 3 products = 9.
const products = [
  // ⌚ Timepieces
  {
    name: 'Aurélian Chronograph',
    category: 'Timepieces',
    description:
      '18k rose-gold case with an automatic movement and hand-stitched alligator strap. A statement of quiet precision.',
    imageUrl: img('1507679252487-e3db58b1642e'),
  },
  {
    name: 'Noir Tourbillon',
    category: 'Timepieces',
    description:
      'A skeleton tourbillon beneath sapphire crystal, set against a deep onyx dial. Mechanical artistry on full display.',
    imageUrl: img('1600003014755-ba31aa59c4b6'),
  },
  {
    name: 'Lune Perpétuel',
    category: 'Timepieces',
    description:
      'An ultra-thin steel timepiece with a poetic moonphase complication. Designed to be worn for a lifetime.',
    imageUrl: img('1618215650148-e8e61eae521c'),
  },
  // 👜 Handmade Bags
  {
    name: 'Cézanne Tote',
    category: 'Handmade Bags',
    description:
      'Full-grain Tuscan leather, hand-stitched by a single artisan over two days. Ages beautifully with you.',
    imageUrl: img('1605733513597-a8f8341084e6'),
  },
  {
    name: 'Margaux Shoulder',
    category: 'Handmade Bags',
    description:
      'Quilted lambskin with a gold chain strap. Lightweight, structured, and effortlessly elegant.',
    imageUrl: img('1548036328-c9fa89d128fa'),
  },
  {
    name: 'Colette Clutch',
    category: 'Handmade Bags',
    description:
      'A woven calfskin evening clutch finished by hand. Small in size, considerable in presence.',
    imageUrl: img('1594223274512-ad4803739b7c'),
  },
  // 🪙 Leather Accessories
  {
    name: 'Continental Wallet',
    category: 'Leather Accessories',
    description:
      'A full-grain leather long wallet with hand-painted edges and twelve card slots. Everyday luxury.',
    imageUrl: img('1627123424574-724758594e93'),
  },
  {
    name: 'Card Holder',
    category: 'Leather Accessories',
    description:
      'A slim, structured card case in vegetable-tanned leather. Minimal lines, maximal craft.',
    imageUrl: img('1601592996763-f05c9c80a7f1'),
  },
  {
    name: 'Artisan Belt',
    category: 'Leather Accessories',
    description:
      'Hand-cut bridle leather with a solid brass buckle. Built to outlast trends and seasons.',
    imageUrl: img('1664286074176-5206ee5dc878'),
  },
];

async function main() {
  // Idempotent upsert by name; refresh category/description/image on existing.
  for (const p of products) {
    const existing = await prisma.product.findFirst({ where: { name: p.name } });
    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          category: p.category,
          description: p.description,
          imageUrl: p.imageUrl,
        },
      });
    } else {
      await prisma.product.create({ data: p });
    }
  }

  // Reset the catalog: remove anything not in the curated list (e.g. leftover
  // "Gold Watch"/"Leather Bag" from the API smoke test). Delete conversations
  // first (messages cascade); products have no cascade from conversations.
  const keepNames = products.map((p) => p.name);
  const junk = await prisma.product.findMany({
    where: { name: { notIn: keepNames } },
  });
  for (const p of junk) {
    await prisma.conversation.deleteMany({ where: { productId: p.id } });
    await prisma.product.delete({ where: { id: p.id } });
  }
  if (junk.length) {
    console.log(`Removed ${junk.length} non-catalog product(s) and their chats.`);
  }

  const count = await prisma.product.count();
  console.log(
    `Seed complete. ${products.length} products across 3 categories. Total in DB: ${count}.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
