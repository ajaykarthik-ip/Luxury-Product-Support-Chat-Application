/**
 * Demo seed for the AGENT dashboard at scale.
 *
 * Creates 10 demo customers and a conversation for each (customer × product)
 * pair — with the 9 seeded products that's up to 90 conversations, each with a
 * short, realistic message thread. Some threads are left "waiting for the agent"
 * (customer-only) so the dashboard shows a mix of answered/pending states.
 *
 * Why a SEPARATE script from `seed.ts`?
 * - `seed.ts` curates the product catalog and is safe to run on production.
 * - This one fabricates demo *conversations* — useful locally to eyeball how the
 *   agent UI handles volume, but not something you'd run against real data.
 *
 * Run (local):  npm run seed         (products first, if not already)
 *               npm run seed:demo
 *
 * Idempotent: customers are upserted by email; conversations use the
 * (customerId, productId) unique key; a conversation that already has messages
 * is skipped, so re-running won't pile up duplicate threads.
 */
import { ConversationStatus, PrismaClient, Role, User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Everyone shares one password so you can log in as any of them while testing.
const DEMO_PASSWORD = 'demo1234';
const DEMO_AGENT_EMAIL = 'agent@du.demo';

const CUSTOMER_NAMES = [
  'Olivia Bennett',
  'Liam Carter',
  'Sophia Nguyen',
  'Noah Williams',
  'Ava Rossi',
  'Ethan Kim',
  'Isabella Costa',
  'Mason Dubois',
  'Mia Lindqvist',
  'Lucas Moreau',
];

// Canned, product-agnostic copy. `{p}` is replaced with the product name.
const OPENERS = [
  'Hi — I just received my {p} and had a question about the warranty.',
  'Is the {p} available for engraving? I’d like to gift it.',
  'My {p} clasp feels a little loose — is that normal?',
  'Could you tell me more about servicing for the {p}?',
  'I’m considering the {p}. How does sizing run?',
  'Does the {p} come with a certificate of authenticity?',
  'How long does delivery take for the {p} to Mumbai?',
  'Can the {p} be returned if it doesn’t suit me?',
];

const AGENT_REPLIES = [
  'Hello! Thank you for reaching out about the {p}. I’d be happy to help.',
  'Great question — the {p} includes our complimentary 2-year warranty.',
  'Absolutely. We offer lifetime servicing on the {p} at any DU atelier.',
  'Let me check the details on the {p} for you — one moment.',
  'Of course. The {p} can be personalised; I’ll share the options.',
];

const CUSTOMER_FOLLOWUPS = [
  'Perfect, thank you so much!',
  'That’s really helpful — I’ll think it over.',
  'Wonderful. Could you also confirm the delivery window?',
  'Appreciate the quick reply.',
];

/** Stable pseudo-random pick so re-runs read the same (no Math.random churn). */
function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const agent = await prisma.user.upsert({
    where: { email: DEMO_AGENT_EMAIL },
    update: {},
    create: {
      email: DEMO_AGENT_EMAIL,
      name: 'DU Concierge',
      password: passwordHash,
      role: Role.AGENT,
    },
  });

  const customers: User[] = [];
  for (let i = 0; i < CUSTOMER_NAMES.length; i++) {
    const customer = await prisma.user.upsert({
      where: { email: `customer${i + 1}@du.demo` },
      update: {},
      create: {
        email: `customer${i + 1}@du.demo`,
        name: CUSTOMER_NAMES[i],
        password: passwordHash,
        role: Role.CUSTOMER,
      },
    });
    customers.push(customer);
  }

  const products = await prisma.product.findMany({
    orderBy: { createdAt: 'asc' },
  });
  if (products.length === 0) {
    console.error('No products found. Run `npm run seed` first, then re-run.');
    return;
  }

  const now = Date.now();
  const minute = 60_000;
  let conversationCount = 0;
  let messageCount = 0;
  let skipped = 0;
  // Keep only a few answered chats OPEN+assigned (under an agent's capacity), so
  // there's headroom for the queue to drain on login; resolve the rest.
  const OPEN_ASSIGNED_TARGET = 3;
  let openAssigned = 0;

  for (let ci = 0; ci < customers.length; ci++) {
    for (let pi = 0; pi < products.length; pi++) {
      const customer = customers[ci];
      const product = products[pi];
      const seed = ci * products.length + pi;

      // Find-or-create — the same core rule the app uses (one per pair).
      const conversation = await prisma.conversation.upsert({
        where: {
          customerId_productId: {
            customerId: customer.id,
            productId: product.id,
          },
        },
        update: {},
        create: { customerId: customer.id, productId: product.id },
      });
      conversationCount++;

      // Spread activity across the last several hours so timestamps/order vary.
      // Newer `seed` → more recent. Oldest threads land a day+ back.
      const startAgoMin = 5 + seed * 11;

      // Every 3rd thread is left "waiting for the agent" (customer-only) so the
      // dashboard shows pending chats alongside answered ones.
      const answered = seed % 3 !== 0;

      const fill = (s: string) => s.replace('{p}', product.name);
      type Draft = { senderId: string; content: string; agoMin: number };
      const drafts: Draft[] = [
        {
          senderId: customer.id,
          content: fill(pick(OPENERS, seed)),
          agoMin: startAgoMin,
        },
      ];
      if (answered) {
        drafts.push({
          senderId: agent.id,
          content: fill(pick(AGENT_REPLIES, seed + 1)),
          agoMin: startAgoMin - 3,
        });
        if (seed % 2 === 0) {
          drafts.push({
            senderId: customer.id,
            content: pick(CUSTOMER_FOLLOWUPS, seed),
            agoMin: startAgoMin - 5,
          });
        }
      }

      // Only create messages once (idempotent re-runs); status/assignment below
      // is still re-applied so changing the seed logic takes effect on a re-run.
      const existing = await prisma.message.count({
        where: { conversationId: conversation.id },
      });
      if (existing > 0) {
        skipped++;
      } else {
        for (const d of drafts) {
          await prisma.message.create({
            data: {
              conversationId: conversation.id,
              senderId: d.senderId,
              content: d.content,
              createdAt: new Date(now - d.agoMin * minute),
            },
          });
          messageCount++;
        }
      }

      // Mirror the app: assign the agent when they've replied, and set updatedAt
      // to the latest message so list ordering looks natural. Keep only the first
      // few answered chats OPEN (under capacity); resolve the rest so the "Closed"
      // view is populated and the agent has room to pull from the queue.
      const lastAgo = drafts[drafts.length - 1].agoMin;
      let resolved = false;
      if (answered) {
        if (openAssigned < OPEN_ASSIGNED_TARGET) openAssigned++;
        else resolved = true;
      }
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          updatedAt: new Date(now - lastAgo * minute),
          ...(answered ? { agentId: agent.id } : {}),
          status: resolved
            ? ConversationStatus.CLOSED
            : ConversationStatus.OPEN,
        },
      });
    }
  }

  console.log(
    `Demo seed complete: ${customers.length} customers, ` +
      `${conversationCount} conversations (${skipped} already had messages, skipped), ` +
      `${messageCount} messages added.`,
  );
  console.log(
    `Log in as agent → ${DEMO_AGENT_EMAIL} / ${DEMO_PASSWORD}  ` +
      `(or any customer1..${customers.length}@du.demo / ${DEMO_PASSWORD}).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
