import { PrismaClient, ReservationStatus } from '@prisma/client';

const prisma = new PrismaClient();

// Mirrors saluna-frontend/server/data/menuData.ts so both apps start from the same catalog.
const menuItems = [
  // Pizza
  {
    name: 'Margherita',
    description:
      'Classic delight with tomato sauce, mozzarella cheese, fresh basil, and a drizzle of olive oil.',
    price: 175000,
    image: '/menu/pizza/margherita.png',
    category: 'pizza',
  },
  {
    name: 'Pepperoni',
    description:
      'Tomato sauce, mozzarella cheese, beef pepperoni, and a blend of Italian herbs.',
    price: 195000,
    image: '/menu/pizza/pepperoni.png',
    category: 'pizza',
  },
  {
    name: 'Truffle Mushroom',
    description:
      'Creamy truffle sauce, mozzarella, sautéed mushrooms, arugula, and parmesan cheese.',
    price: 180000,
    image: '/menu/pizza/truffle_mushroom.png',
    category: 'pizza',
  },
  {
    name: 'Quattro Formaggi',
    description:
      'A rich blend of mozzarella, gorgonzola, parmesan, and fontina cheese on a crispy crust.',
    price: 175000,
    image: '/menu/pizza/quattro_formaggi.png',
    category: 'pizza',
  },

  // Pasta
  {
    name: 'Penne Arrabbiata',
    description: 'Spicy tomato sauce with garlic, chili, and fresh basil.',
    price: 120000,
    image: '/menu/pasta/penne_arrabbiata.png',
    category: 'pasta',
  },
  {
    name: 'Fettuccine Carbonara',
    description: 'Creamy sauce with egg, parmesan cheese, and smoked beef.',
    price: 150000,
    image: '/menu/pasta/fettuccine_carbonara.png',
    category: 'pasta',
  },
  {
    name: 'Linguine Pesto Genovese',
    description:
      'Classic basil pesto with parmesan cheese, pine nuts, and extra virgin olive oil.',
    price: 120000,
    image: '/menu/pasta/linguine_pesto_genovese.png',
    category: 'pasta',
  },
  {
    name: 'Spaghetti Frutti di Mare',
    description:
      'Seafood pasta with shrimp, mussels, clams, cherry tomatoes, and white wine garlic sauce.',
    price: 150000,
    image: '/menu/pasta/spaghetti_frutti_di_mare.png',
    category: 'pasta',
  },

  // Seafood
  {
    name: 'Grilled Tiger Prawns',
    description:
      'Juicy tiger prawns grilled to perfection, served with lemon garlic butter and fresh herbs.',
    price: 250000,
    image: '/menu/seafood/grilled_tiger_prawns.png',
    category: 'seafood',
  },
  {
    name: 'Calamari Fritti',
    description:
      'Crispy calamari lightly seasoned and fried golden, served with lemon aioli.',
    price: 150000,
    image: '/menu/seafood/calamari_fritti.png',
    category: 'seafood',
  },
  {
    name: 'Pan-Seared Salmon',
    description:
      'Seared salmon fillet with lemon dill cream sauce, served with grilled vegetables.',
    price: 350000,
    image: '/menu/seafood/pan-seared_salmon.png',
    category: 'seafood',
  },
  {
    name: 'Mussels in White Wine Sauce',
    description:
      'Steamed mussels in a fragrant white wine, garlic, and parsley sauce, served with toasted bread.',
    price: 250000,
    image: '/menu/seafood/mussels_in_white_wine_sauce.png',
    category: 'seafood',
  },

  // Drinks
  {
    name: 'Ice Tea',
    description: '',
    price: 40000,
    image: '/menu/drink/ice_tea.png',
    category: 'drinks',
  },
  {
    name: 'Ice Latte',
    description: '',
    price: 60000,
    image: '/menu/drink/ice_latte.png',
    category: 'drinks',
  },
  {
    name: 'Coca Cola',
    description: '',
    price: 28000,
    image: '/menu/drink/coca_cola.png',
    category: 'drinks',
  },
  {
    name: 'Aqua',
    description: '',
    price: 20000,
    image: '/menu/drink/Aqua.png',
    category: 'drinks',
  },
  {
    name: 'Chocolate Frappe',
    description: '',
    price: 50000,
    image: '/menu/drink/chocolate_frappe.png',
    category: 'drinks',
  },
  {
    name: 'Sangria Wine (Cocktail)',
    description: '',
    price: 120000,
    image: '/menu/drink/sangria_wine.png',
    category: 'drinks',
  },
  {
    name: 'Bintang Beer (Small)',
    description: '',
    price: 50000,
    image: '/menu/drink/bintang_small.png',
    category: 'drinks',
  },
  {
    name: 'Bloody Mary (Cocktail)',
    description: '',
    price: 100000,
    image: '/menu/drink/bloody_marry.png',
    category: 'drinks',
  },
];

const reservations = [
  {
    customerName: 'Budi Santoso',
    email: 'budi@example.com',
    phone: '+62 812 3456 7890',
    partySize: 4,
    date: new Date('2026-08-01T19:00:00.000Z'),
    status: ReservationStatus.CONFIRMED,
    notes: 'Window seat please',
  },
  {
    customerName: 'Siti Aminah',
    email: 'siti@example.com',
    phone: '+62 813 5555 1212',
    partySize: 2,
    date: new Date('2026-08-02T18:30:00.000Z'),
    status: ReservationStatus.PENDING,
    notes: null,
  },
  {
    customerName: 'John Miller',
    email: 'john.miller@example.com',
    phone: '+62 811 9999 0000',
    partySize: 6,
    date: new Date('2026-07-20T20:00:00.000Z'),
    status: ReservationStatus.CANCELLED,
    notes: 'Birthday celebration',
  },
];

async function main() {
  await prisma.reservation.deleteMany();
  await prisma.menu.deleteMany();

  await prisma.menu.createMany({ data: menuItems });
  for (const reservation of reservations) {
    await prisma.reservation.create({ data: reservation });
  }

  console.log(
    `Seeded ${menuItems.length} menu items and ${reservations.length} reservations.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
