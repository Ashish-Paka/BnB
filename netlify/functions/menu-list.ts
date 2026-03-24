import type { Context } from "@netlify/functions";
import { getMenu, setMenu } from "./_shared/store.js";
import { requireOwner } from "./_shared/auth.js";
import type { MenuItem } from "./_shared/types.js";

const SEED_MENU: MenuItem[] = [
  {
    id: "latte",
    name: "Latte",
    description: "Creamy espresso with steamed milk",
    base_price_cents: 500,
    category: "coffee",
    is_available: true,
    sort_order: 1,
    options: [
      { name: "Temperature", choices: [{ label: "Hot", extra_cents: 0 }, { label: "Iced", extra_cents: 0 }] },
      { name: "Milk", choices: [{ label: "2%", extra_cents: 0 }, { label: "Oat", extra_cents: 0 }, { label: "Almond", extra_cents: 0 }] },
      { name: "Syrup", choices: [{ label: "No Syrup", extra_cents: 0 }, { label: "Syrup", extra_cents: 100 }] },
    ],
  },
  {
    id: "cappuccino",
    name: "Cappuccino",
    description: "Rich espresso with thick foam",
    base_price_cents: 500,
    category: "coffee",
    is_available: true,
    sort_order: 2,
    options: [
      { name: "Temperature", choices: [{ label: "Hot", extra_cents: 0 }, { label: "Iced", extra_cents: 0 }] },
      { name: "Milk", choices: [{ label: "2%", extra_cents: 0 }, { label: "Oat", extra_cents: 0 }, { label: "Almond", extra_cents: 0 }] },
      { name: "Syrup", choices: [{ label: "No Syrup", extra_cents: 0 }, { label: "Syrup", extra_cents: 100 }] },
    ],
  },
  {
    id: "flat-white",
    name: "Flat White",
    description: "Velvety microfoam espresso",
    base_price_cents: 500,
    category: "coffee",
    is_available: true,
    sort_order: 3,
    options: [
      { name: "Temperature", choices: [{ label: "Hot", extra_cents: 0 }, { label: "Iced", extra_cents: 0 }] },
      { name: "Milk", choices: [{ label: "2%", extra_cents: 0 }, { label: "Oat", extra_cents: 0 }, { label: "Almond", extra_cents: 0 }] },
      { name: "Syrup", choices: [{ label: "No Syrup", extra_cents: 0 }, { label: "Syrup", extra_cents: 100 }] },
    ],
  },
  {
    id: "americano",
    name: "Americano",
    description: "Espresso with hot water",
    base_price_cents: 400,
    category: "coffee",
    is_available: true,
    sort_order: 4,
  },
  {
    id: "cortado",
    name: "Cortado",
    description: "Equal parts espresso and steamed milk",
    base_price_cents: 500,
    category: "coffee",
    is_available: true,
    sort_order: 5,
    options: [
      { name: "Temperature", choices: [{ label: "Hot", extra_cents: 0 }, { label: "Iced", extra_cents: 0 }] },
      { name: "Milk", choices: [{ label: "2%", extra_cents: 0 }, { label: "Oat", extra_cents: 0 }, { label: "Almond", extra_cents: 0 }] },
    ],
  },
  {
    id: "espresso",
    name: "Espresso",
    description: "Bold single or double shot",
    base_price_cents: 300,
    category: "coffee",
    is_available: true,
    sort_order: 6,
  },
  {
    id: "lemonade",
    name: "Lemonade",
    description: "Fresh squeezed lemonade",
    base_price_cents: 500,
    category: "lemonade",
    is_available: true,
    sort_order: 7,
  },
];

export default async (req: Request, context: Context) => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  let menu = await getMenu();

  // Seed menu if empty
  if (menu.length === 0) {
    menu = SEED_MENU;
    await setMenu(menu);
  }

  // If authenticated owner, return all items; otherwise only available
  const headers = Object.fromEntries(req.headers.entries());
  if (requireOwner(headers)) {
    return Response.json(menu);
  }
  const available = menu.filter((item) => item.is_available);
  return Response.json(available);
};
