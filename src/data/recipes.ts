/**
 * Breeze launch recipes (© M3XI).
 * Each ingredient references a UK CoFID 2021 food by id with its weight in grams
 * (raw or cooked as stated in `note`). Nutrition, allergens and diet labels are
 * calculated from these in src/lib/recipes.ts — do not add nutrition numbers here.
 * Status: written by Breeze, not yet reviewed by a registered nutritionist.
 */
import type { Allergen, RecipeTag } from '../lib/recipes'

export interface RecipeIngredient { food: string; grams: number; label: string; note?: string }
export interface RecipeStep { text: string; timerMin?: number }
export interface Recipe {
  id: string
  title: string
  description: string
  emoji: string
  servings: number
  prepMin: number
  cookMin: number
  ingredients: RecipeIngredient[]
  steps: RecipeStep[]
  /** editorial tags only; nutrition/diet/time tags are derived */
  editorial: Extract<RecipeTag, 'pre-workout' | 'post-workout' | 'budget'>[]
  /** allergens a name-match can't see (e.g. celery in stock) */
  alsoContains?: Allergen[]
  /** cover colour for the typographic card */
  cover: 'night' | 'dawn' | 'day'
  reviewed: false
}

const OATS = 'cofid-11-788', GREEK_YOG = 'cofid-12-555', QUARK = 'cofid-12-174', MILK = 'cofid-12-313', BLUEBERRIES = 'cofid-14-325', HONEY = 'cofid-17-050'
const EGG = 'cofid-12-937', EGG_WHITE = 'cofid-12-938', WHOLEMEAL = 'cofid-11-981', SPINACH = 'cofid-13-572', RAPESEED = 'cofid-17-041', OLIVE = 'cofid-17-038'
const CHICKEN_RAW = 'cofid-18-290', CHICKEN_COOKED = 'cofid-18-323', BASMATI = 'cofid-11-858', BROWN_RICE = 'cofid-11-869', BROCCOLI = 'cofid-13-503'
const LEMON = 'cofid-14-277', LIME = 'cofid-14-279', GARLIC = 'cofid-13-244', GINGER = 'cofid-13-890', BEEF_MINCE = 'cofid-18-508', KIDNEY = 'cofid-13-660'
const TOMS_CAN = 'cofid-13-530', ONION = 'cofid-13-499', RED_PEPPER = 'cofid-13-524', PUREE = 'cofid-13-531', SALMON = 'cofid-16-356', SWEET_POTATO = 'cofid-13-672'
const GREEN_BEANS = 'cofid-13-515', PASTA = 'cofid-11-1129', TUNA = 'cofid-16-416', SWEETCORN = 'cofid-13-529', MAYO_LIGHT = 'cofid-17-679', CUCUMBER = 'cofid-13-523'
const CHERRY_TOMS = 'cofid-13-519', LENTILS = 'cofid-13-657', CURRY_POWDER = 'cofid-13-876', COCONUT_LIGHT = 'cofid-14-890', TOFU = 'cofid-13-570', RICE_NOODLES = 'cofid-11-725'
const PAK_CHOI = 'cofid-13-516', BEANSPROUTS = 'cofid-13-426', SOY = 'cofid-17-721', SESAME_OIL = 'cofid-17-043', SESAME = 'cofid-14-844', STRAWBERRIES = 'cofid-14-324'
const RASPBERRIES = 'cofid-14-375', PEANUT_BUTTER = 'cofid-14-892', BANANA = 'cofid-14-318', COTTAGE_LIGHT = 'cofid-12-550', PINEAPPLE = 'cofid-14-376', LETTUCE = 'cofid-13-520'
const AVOCADO = 'cofid-14-386', CHEDDAR_LIGHT = 'cofid-12-348', PRAWNS = 'cofid-16-387', EGG_NOODLES = 'cofid-11-724', SPRING_ONION = 'cofid-13-352', COD = 'cofid-16-372'
const NEW_POTATOES = 'cofid-13-495', PEAS = 'cofid-13-536', STOCK = 'cofid-17-681', CARROTS = 'cofid-13-496', COURGETTE = 'cofid-13-627', HERBS = 'cofid-13-884'
const MUSHROOMS = 'cofid-13-505', FETA = 'cofid-12-525', BAKED_POTATO = 'cofid-13-491', BAKED_BEANS = 'cofid-13-535', TORTILLA = 'cofid-11-925', HOUMOUS = 'cofid-13-556'
const RUMP = 'cofid-18-043', QUINOA = 'cofid-14-843', EDAMAME = 'cofid-13-667', ROCKET = 'cofid-13-522', GARAM = 'cofid-13-829'

export const RECIPES: Recipe[] = [
  {
    id: 'protein-overnight-oats', title: 'Protein overnight oats', emoji: '🫐', cover: 'day', reviewed: false,
    description: 'Creamy oats made the night before with quark and Greek yoghurt for a protein boost, topped with blueberries.',
    servings: 1, prepMin: 5, cookMin: 0, editorial: ['pre-workout', 'budget'],
    ingredients: [
      { food: OATS, grams: 50, label: 'Porridge oats' },
      { food: QUARK, grams: 100, label: 'Quark' },
      { food: GREEK_YOG, grams: 80, label: 'Greek-style yoghurt' },
      { food: MILK, grams: 100, label: 'Semi-skimmed milk' },
      { food: BLUEBERRIES, grams: 80, label: 'Blueberries' },
      { food: HONEY, grams: 8, label: 'Honey', note: 'about 1 tsp' },
    ],
    steps: [
      { text: 'Stir the oats, quark, yoghurt and milk together in a jar or box until smooth.' },
      { text: 'Cover and refrigerate overnight (at least 4 hours).' },
      { text: 'Top with blueberries and a drizzle of honey before eating.' },
    ],
  },
  {
    id: 'eggs-spinach-toast', title: 'Scrambled eggs, spinach & wholemeal toast', emoji: '🍳', cover: 'dawn', reviewed: false,
    description: 'Three soft-scrambled eggs with wilted spinach on two slices of wholemeal toast.',
    servings: 1, prepMin: 2, cookMin: 6, editorial: ['budget', 'post-workout'],
    ingredients: [
      { food: EGG, grams: 150, label: 'Eggs', note: '3 medium' },
      { food: WHOLEMEAL, grams: 80, label: 'Wholemeal bread', note: '2 slices' },
      { food: SPINACH, grams: 50, label: 'Baby spinach' },
      { food: RAPESEED, grams: 5, label: 'Rapeseed oil', note: '1 tsp' },
    ],
    steps: [
      { text: 'Toast the bread. Warm the oil in a non-stick pan over a medium heat and wilt the spinach for 1 minute.' },
      { text: 'Beat the eggs with a pinch of salt and pepper, add to the pan and stir gently until just set.', timerMin: 3 },
      { text: 'Pile onto the toast and serve straight away.' },
    ],
  },
  {
    id: 'lemon-chicken-rice', title: 'Lemon garlic chicken, rice & broccoli', emoji: '🍗', cover: 'night', reviewed: false,
    description: 'The classic gym bowl, done properly: juicy lemon-garlic chicken breast with basmati rice and broccoli. Doubles as meal prep.',
    servings: 2, prepMin: 10, cookMin: 20, editorial: ['post-workout'],
    ingredients: [
      { food: CHICKEN_RAW, grams: 320, label: 'Chicken breast', note: 'raw weight' },
      { food: BASMATI, grams: 300, label: 'Basmati rice', note: 'cooked weight (about 110 g dry)' },
      { food: BROCCOLI, grams: 240, label: 'Broccoli' },
      { food: OLIVE, grams: 10, label: 'Olive oil', note: '2 tsp' },
      { food: LEMON, grams: 20, label: 'Lemon juice', note: '½ lemon' },
      { food: GARLIC, grams: 6, label: 'Garlic', note: '2 cloves' },
    ],
    steps: [
      { text: 'Mix the oil, lemon juice, crushed garlic, salt and pepper. Coat the chicken and leave for 5 minutes.' },
      { text: 'Cook the rice according to the pack.', timerMin: 12 },
      { text: 'Griddle or pan-fry the chicken over a medium-high heat until cooked through (no pink, juices run clear).', timerMin: 12 },
      { text: 'Steam or boil the broccoli until just tender.', timerMin: 4 },
      { text: 'Slice the chicken and divide everything between two bowls or boxes.' },
    ],
  },
  {
    id: 'lean-beef-chilli', title: 'Lean beef chilli with rice', emoji: '🌶️', cover: 'night', reviewed: false,
    description: 'A big batch of smoky extra-lean beef and kidney bean chilli. Freezes well.',
    servings: 4, prepMin: 15, cookMin: 35, editorial: ['budget', 'post-workout'],
    ingredients: [
      { food: BEEF_MINCE, grams: 500, label: 'Extra-lean beef mince (5% fat)', note: 'raw weight' },
      { food: KIDNEY, grams: 240, label: 'Red kidney beans', note: 'drained, 1 tin' },
      { food: TOMS_CAN, grams: 800, label: 'Chopped tomatoes', note: '2 tins' },
      { food: ONION, grams: 150, label: 'Onion', note: '1 large' },
      { food: RED_PEPPER, grams: 160, label: 'Red pepper', note: '1' },
      { food: PUREE, grams: 30, label: 'Tomato purée' },
      { food: GARLIC, grams: 10, label: 'Garlic', note: '3 cloves' },
      { food: RAPESEED, grams: 10, label: 'Rapeseed oil' },
      { food: BASMATI, grams: 600, label: 'Basmati rice', note: 'cooked weight (about 220 g dry)' },
    ],
    steps: [
      { text: 'Fry the chopped onion and pepper in the oil for 5 minutes, then add the garlic.', timerMin: 5 },
      { text: 'Add the mince and brown it, breaking it up. Stir in the purée and chilli powder, cumin and smoked paprika to taste.' },
      { text: 'Add the tomatoes and beans, season, and simmer with the lid half on.', timerMin: 25 },
      { text: 'Meanwhile cook the rice. Serve the chilli over the rice.' },
    ],
  },
  {
    id: 'salmon-sweet-potato', title: 'Roast salmon, sweet potato & green beans', emoji: '🐟', cover: 'dawn', reviewed: false,
    description: 'Oven-roasted salmon with sweet potato wedges and green beans. Rich in omega-3.',
    servings: 2, prepMin: 5, cookMin: 25, editorial: ['post-workout'],
    ingredients: [
      { food: SALMON, grams: 260, label: 'Salmon fillets', note: '2 × 130 g, raw' },
      { food: SWEET_POTATO, grams: 400, label: 'Sweet potato', note: 'baked weight' },
      { food: GREEN_BEANS, grams: 200, label: 'Green beans' },
      { food: OLIVE, grams: 10, label: 'Olive oil' },
      { food: LEMON, grams: 15, label: 'Lemon juice' },
    ],
    steps: [
      { text: 'Heat the oven to 200°C (180°C fan). Cut the sweet potato into wedges, toss with half the oil and roast.', timerMin: 25 },
      { text: 'After 12 minutes add the salmon to the tray, brush with the rest of the oil and season.', timerMin: 13 },
      { text: 'Boil the green beans for 4 minutes. Squeeze lemon over the salmon and serve.', timerMin: 4 },
    ],
  },
  {
    id: 'tuna-sweetcorn-pasta', title: 'Tuna & sweetcorn pasta salad', emoji: '🍝', cover: 'day', reviewed: false,
    description: 'A lunchbox favourite with tuna, sweetcorn and crunchy veg in a light mayo dressing.',
    servings: 2, prepMin: 10, cookMin: 10, editorial: ['budget', 'post-workout'],
    ingredients: [
      { food: PASTA, grams: 300, label: 'Pasta', note: 'cooked weight (about 130 g dry)' },
      { food: TUNA, grams: 220, label: 'Tuna in spring water or brine', note: '2 tins, drained' },
      { food: SWEETCORN, grams: 120, label: 'Sweetcorn', note: 'drained' },
      { food: MAYO_LIGHT, grams: 30, label: 'Light mayonnaise' },
      { food: CUCUMBER, grams: 100, label: 'Cucumber' },
      { food: CHERRY_TOMS, grams: 120, label: 'Cherry tomatoes' },
    ],
    steps: [
      { text: 'Cook the pasta, then rinse under cold water and drain well.', timerMin: 10 },
      { text: 'Mix the tuna, sweetcorn and mayonnaise. Chop the cucumber and halve the tomatoes.' },
      { text: 'Toss everything together and season with black pepper.' },
    ],
  },
  {
    id: 'red-lentil-dal', title: 'Red lentil & spinach dal', emoji: '🍛', cover: 'dawn', reviewed: false,
    description: 'Comforting, cheap and plant-based: spiced red lentils with spinach and light coconut milk.',
    servings: 4, prepMin: 10, cookMin: 30, editorial: ['budget'],
    ingredients: [
      { food: LENTILS, grams: 250, label: 'Red split lentils', note: 'dry weight' },
      { food: ONION, grams: 150, label: 'Onion' },
      { food: GARLIC, grams: 10, label: 'Garlic' },
      { food: GINGER, grams: 15, label: 'Fresh ginger' },
      { food: TOMS_CAN, grams: 400, label: 'Chopped tomatoes', note: '1 tin' },
      { food: CURRY_POWDER, grams: 15, label: 'Curry powder' },
      { food: GARAM, grams: 5, label: 'Garam masala' },
      { food: COCONUT_LIGHT, grams: 200, label: 'Reduced-fat coconut milk' },
      { food: RAPESEED, grams: 10, label: 'Rapeseed oil' },
      { food: SPINACH, grams: 120, label: 'Spinach' },
      { food: BASMATI, grams: 600, label: 'Basmati rice', note: 'cooked weight' },
    ],
    steps: [
      { text: 'Soften the onion in the oil, then add garlic, ginger and spices for 1 minute.', timerMin: 6 },
      { text: 'Add the rinsed lentils, tomatoes, coconut milk and 500 ml water. Simmer, stirring, until thick.', timerMin: 22 },
      { text: 'Stir in the spinach until wilted, season and serve with rice.' },
    ],
  },
  {
    id: 'tofu-noodle-stir-fry', title: 'Ginger tofu noodle stir-fry', emoji: '🥢', cover: 'night', reviewed: false,
    description: 'Crisp tofu, pak choi and peppers tossed with rice noodles in a ginger-soy sauce.',
    servings: 2, prepMin: 10, cookMin: 10, editorial: ['post-workout'],
    ingredients: [
      { food: TOFU, grams: 300, label: 'Firm tofu', note: 'pressed' },
      { food: RICE_NOODLES, grams: 300, label: 'Rice noodles', note: 'cooked weight' },
      { food: RED_PEPPER, grams: 160, label: 'Red pepper' },
      { food: PAK_CHOI, grams: 150, label: 'Pak choi' },
      { food: BEANSPROUTS, grams: 100, label: 'Beansprouts' },
      { food: SOY, grams: 30, label: 'Soy sauce' },
      { food: GINGER, grams: 10, label: 'Fresh ginger' },
      { food: GARLIC, grams: 6, label: 'Garlic' },
      { food: SESAME_OIL, grams: 8, label: 'Sesame oil' },
      { food: SESAME, grams: 10, label: 'Sesame seeds' },
    ],
    steps: [
      { text: 'Cube the tofu and fry in half the oil until golden on all sides.', timerMin: 6 },
      { text: 'Add the sliced pepper, pak choi, ginger and garlic; stir-fry for 2 minutes.', timerMin: 2 },
      { text: 'Add the noodles, beansprouts and soy sauce, toss until hot, and scatter with sesame seeds.' },
    ],
  },
  {
    id: 'quark-berry-bowl', title: 'Quark & berry protein bowl', emoji: '🍓', cover: 'day', reviewed: false,
    description: 'A high-protein snack or light breakfast: quark and Greek yoghurt with berries and a little honey.',
    servings: 1, prepMin: 3, cookMin: 0, editorial: ['pre-workout'],
    ingredients: [
      { food: QUARK, grams: 150, label: 'Quark' },
      { food: GREEK_YOG, grams: 80, label: 'Greek-style yoghurt' },
      { food: STRAWBERRIES, grams: 100, label: 'Strawberries' },
      { food: RASPBERRIES, grams: 60, label: 'Raspberries' },
      { food: HONEY, grams: 8, label: 'Honey' },
    ],
    steps: [
      { text: 'Whisk the quark and yoghurt together until smooth.' },
      { text: 'Top with the berries and drizzle with honey.' },
    ],
  },
  {
    id: 'banana-pb-toast', title: 'Banana & peanut butter toast', emoji: '🍌', cover: 'dawn', reviewed: false,
    description: 'Quick carbs with a little protein. A classic 60–90 minutes before training.',
    servings: 1, prepMin: 3, cookMin: 2, editorial: ['pre-workout', 'budget'],
    ingredients: [
      { food: WHOLEMEAL, grams: 80, label: 'Wholemeal bread', note: '2 slices' },
      { food: PEANUT_BUTTER, grams: 20, label: 'Smooth peanut butter', note: '1 heaped tbsp' },
      { food: BANANA, grams: 100, label: 'Banana', note: '1 medium, peeled' },
      { food: HONEY, grams: 5, label: 'Honey', note: 'optional' },
    ],
    steps: [
      { text: 'Toast the bread and spread with peanut butter.' },
      { text: 'Top with sliced banana and a little honey.' },
    ],
  },
  {
    id: 'cottage-pineapple', title: 'Cottage cheese & pineapple pot', emoji: '🍍', cover: 'day', reviewed: false,
    description: 'A two-minute, high-protein snack that tastes like a treat.',
    servings: 1, prepMin: 2, cookMin: 0, editorial: ['budget'],
    ingredients: [
      { food: COTTAGE_LIGHT, grams: 200, label: 'Reduced-fat cottage cheese' },
      { food: PINEAPPLE, grams: 100, label: 'Pineapple', note: 'fresh or tinned in juice, drained' },
    ],
    steps: [{ text: 'Spoon the cottage cheese into a bowl or pot and top with chopped pineapple.' }],
  },
  {
    id: 'beef-burrito-bowl', title: 'Lean beef burrito bowl', emoji: '🌯', cover: 'night', reviewed: false,
    description: 'Spiced lean mince with brown rice, beans, sweetcorn, salsa, avocado and a little cheese.',
    servings: 2, prepMin: 10, cookMin: 15, editorial: ['post-workout'],
    ingredients: [
      { food: BEEF_MINCE, grams: 250, label: 'Extra-lean beef mince', note: 'raw weight' },
      { food: BROWN_RICE, grams: 250, label: 'Brown rice', note: 'cooked weight' },
      { food: KIDNEY, grams: 120, label: 'Kidney beans', note: 'drained' },
      { food: SWEETCORN, grams: 100, label: 'Sweetcorn' },
      { food: CHERRY_TOMS, grams: 120, label: 'Cherry tomatoes' },
      { food: LETTUCE, grams: 60, label: 'Lettuce' },
      { food: AVOCADO, grams: 80, label: 'Avocado', note: '½ large' },
      { food: LIME, grams: 15, label: 'Lime juice' },
      { food: CHEDDAR_LIGHT, grams: 30, label: 'Reduced-fat Cheddar' },
    ],
    steps: [
      { text: 'Brown the mince in a dry pan, season with chilli, cumin and paprika, and cook through.', timerMin: 10 },
      { text: 'Warm the rice and beans. Chop the tomatoes and avocado and toss with lime juice.' },
      { text: 'Build bowls: rice, beef, beans, sweetcorn, salsa, lettuce, avocado and grated cheese.' },
    ],
  },
  {
    id: 'garlic-prawn-noodles', title: 'Garlic king prawn noodles', emoji: '🍤', cover: 'dawn', reviewed: false,
    description: 'Fast, light egg noodles with king prawns, peppers and spring onions.',
    servings: 2, prepMin: 8, cookMin: 7, editorial: [],
    ingredients: [
      { food: PRAWNS, grams: 250, label: 'Raw king prawns' },
      { food: EGG_NOODLES, grams: 300, label: 'Egg noodles', note: 'cooked weight' },
      { food: RED_PEPPER, grams: 120, label: 'Red pepper' },
      { food: SPRING_ONION, grams: 40, label: 'Spring onions' },
      { food: BEANSPROUTS, grams: 100, label: 'Beansprouts' },
      { food: SOY, grams: 25, label: 'Soy sauce' },
      { food: GARLIC, grams: 6, label: 'Garlic' },
      { food: GINGER, grams: 10, label: 'Fresh ginger' },
      { food: RAPESEED, grams: 10, label: 'Rapeseed oil' },
    ],
    steps: [
      { text: 'Stir-fry the garlic, ginger and pepper in the oil for 2 minutes.', timerMin: 2 },
      { text: 'Add the prawns and cook until pink all the way through.', timerMin: 3 },
      { text: 'Add the noodles, beansprouts, spring onions and soy sauce; toss until hot.', timerMin: 2 },
    ],
  },
  {
    id: 'lemon-cod-potatoes', title: 'Lemon cod with new potatoes & peas', emoji: '🍋', cover: 'day', reviewed: false,
    description: 'Light, bright and filling: baked cod with lemon, new potatoes and peas.',
    servings: 2, prepMin: 5, cookMin: 20, editorial: [],
    ingredients: [
      { food: COD, grams: 300, label: 'Cod fillets', note: 'raw weight' },
      { food: NEW_POTATOES, grams: 400, label: 'New potatoes', note: 'boiled, skins on' },
      { food: PEAS, grams: 200, label: 'Frozen peas' },
      { food: OLIVE, grams: 10, label: 'Olive oil' },
      { food: LEMON, grams: 20, label: 'Lemon juice' },
    ],
    steps: [
      { text: 'Boil the potatoes until tender.', timerMin: 18 },
      { text: 'Heat the oven to 200°C. Put the cod on a lined tray, drizzle with oil and lemon, season and bake.', timerMin: 12 },
      { text: 'Boil the peas for 3 minutes, then serve with the cod and potatoes.', timerMin: 3 },
    ],
  },
  {
    id: 'chicken-veg-soup', title: 'Chicken & vegetable soup', emoji: '🍲', cover: 'dawn', reviewed: false,
    description: 'A warming, high-volume soup that’s low in calories but still high in protein.',
    servings: 4, prepMin: 15, cookMin: 30, editorial: ['budget'], alsoContains: ['Celery'],
    ingredients: [
      { food: CHICKEN_RAW, grams: 400, label: 'Chicken breast', note: 'raw weight' },
      { food: STOCK, grams: 1200, label: 'Chicken stock', note: '1.2 litres' },
      { food: CARROTS, grams: 200, label: 'Carrots' },
      { food: ONION, grams: 150, label: 'Onion' },
      { food: COURGETTE, grams: 200, label: 'Courgette' },
      { food: PEAS, grams: 150, label: 'Frozen peas' },
      { food: GARLIC, grams: 10, label: 'Garlic' },
      { food: OLIVE, grams: 10, label: 'Olive oil' },
      { food: HERBS, grams: 3, label: 'Dried mixed herbs' },
    ],
    steps: [
      { text: 'Soften the chopped onion and carrot in the oil for 5 minutes, then add garlic and herbs.', timerMin: 5 },
      { text: 'Add the stock and whole chicken breasts. Simmer until the chicken is cooked through.', timerMin: 20 },
      { text: 'Lift out the chicken, shred it, and return it with the courgette and peas. Simmer 5 minutes more.', timerMin: 5 },
    ],
  },
  {
    id: 'egg-white-omelette', title: 'Spinach, mushroom & feta omelette', emoji: '🥚', cover: 'day', reviewed: false,
    description: 'Mostly egg whites with one whole egg for flavour, with mushrooms, spinach and a little feta.',
    servings: 1, prepMin: 4, cookMin: 6, editorial: [],
    ingredients: [
      { food: EGG_WHITE, grams: 200, label: 'Egg whites', note: 'about 6, or carton' },
      { food: EGG, grams: 50, label: 'Egg', note: '1 whole' },
      { food: SPINACH, grams: 40, label: 'Spinach' },
      { food: MUSHROOMS, grams: 80, label: 'Mushrooms' },
      { food: CHERRY_TOMS, grams: 60, label: 'Cherry tomatoes' },
      { food: FETA, grams: 25, label: 'Feta' },
      { food: RAPESEED, grams: 3, label: 'Rapeseed oil' },
    ],
    steps: [
      { text: 'Fry the sliced mushrooms in the oil until golden, then wilt in the spinach.', timerMin: 3 },
      { text: 'Pour in the beaten eggs and whites, cook gently, and add tomatoes and crumbled feta.', timerMin: 3 },
      { text: 'Fold and serve.' },
    ],
  },
  {
    id: 'banana-porridge', title: 'Banana & honey porridge', emoji: '🥣', cover: 'dawn', reviewed: false,
    description: 'Slow-release carbs made with milk. Simple fuel before a morning session.',
    servings: 1, prepMin: 2, cookMin: 5, editorial: ['pre-workout', 'budget'],
    ingredients: [
      { food: OATS, grams: 50, label: 'Porridge oats' },
      { food: MILK, grams: 250, label: 'Semi-skimmed milk' },
      { food: BANANA, grams: 100, label: 'Banana' },
      { food: HONEY, grams: 5, label: 'Honey' },
    ],
    steps: [
      { text: 'Simmer the oats and milk, stirring, until thick and creamy.', timerMin: 5 },
      { text: 'Top with sliced banana and honey.' },
    ],
  },
  {
    id: 'jacket-potato-beans', title: 'Jacket potato, beans & cheese', emoji: '🥔', cover: 'day', reviewed: false,
    description: 'The British classic, made lighter with reduced-sugar beans and reduced-fat Cheddar.',
    servings: 1, prepMin: 2, cookMin: 12, editorial: ['budget'],
    ingredients: [
      { food: BAKED_POTATO, grams: 250, label: 'Baking potato', note: 'baked weight, skin on' },
      { food: BAKED_BEANS, grams: 200, label: 'Reduced sugar & salt baked beans', note: '½ tin' },
      { food: CHEDDAR_LIGHT, grams: 30, label: 'Reduced-fat Cheddar' },
    ],
    steps: [
      { text: 'Prick the potato and microwave until soft, turning halfway (or bake at 200°C for about an hour).', timerMin: 10 },
      { text: 'Heat the beans. Split the potato, top with beans and grated cheese.' },
    ],
  },
  {
    id: 'recovery-smoothie', title: 'Banana oat recovery smoothie', emoji: '🥤', cover: 'dawn', reviewed: false,
    description: 'Milk, banana, oats, quark and peanut butter. Protein and carbs in one glass after training.',
    servings: 1, prepMin: 4, cookMin: 0, editorial: ['post-workout'],
    ingredients: [
      { food: MILK, grams: 300, label: 'Semi-skimmed milk' },
      { food: BANANA, grams: 100, label: 'Banana' },
      { food: OATS, grams: 30, label: 'Porridge oats' },
      { food: QUARK, grams: 100, label: 'Quark' },
      { food: PEANUT_BUTTER, grams: 15, label: 'Peanut butter' },
    ],
    steps: [{ text: 'Blend everything until smooth. Add ice if you like it cold.' }],
  },
  {
    id: 'chicken-houmous-wrap', title: 'Chicken & houmous wrap', emoji: '🌯', cover: 'night', reviewed: false,
    description: 'A packed-lunch wrap using leftover cooked chicken, houmous and crunchy salad.',
    servings: 1, prepMin: 5, cookMin: 0, editorial: [],
    ingredients: [
      { food: TORTILLA, grams: 64, label: 'Soft wheat tortilla', note: '1 large' },
      { food: CHICKEN_COOKED, grams: 100, label: 'Cooked chicken breast', note: 'cooked weight' },
      { food: HOUMOUS, grams: 30, label: 'Houmous' },
      { food: LETTUCE, grams: 30, label: 'Lettuce' },
      { food: CHERRY_TOMS, grams: 50, label: 'Cherry tomatoes' },
      { food: CUCUMBER, grams: 40, label: 'Cucumber' },
    ],
    steps: [
      { text: 'Spread the houmous over the tortilla.' },
      { text: 'Add sliced chicken and salad, roll up tightly and cut in half.' },
    ],
  },
  {
    id: 'steak-sweet-potato', title: 'Rump steak, sweet potato & broccoli', emoji: '🥩', cover: 'night', reviewed: false,
    description: 'Lean rump steak with baked sweet potato and broccoli. A high-protein dinner.',
    servings: 2, prepMin: 5, cookMin: 25, editorial: ['post-workout'],
    ingredients: [
      { food: RUMP, grams: 300, label: 'Lean rump steak', note: 'raw weight, fat trimmed' },
      { food: SWEET_POTATO, grams: 400, label: 'Sweet potato', note: 'baked weight' },
      { food: BROCCOLI, grams: 200, label: 'Broccoli' },
      { food: OLIVE, grams: 8, label: 'Olive oil' },
    ],
    steps: [
      { text: 'Bake the sweet potatoes at 200°C until soft (or microwave for about 8 minutes).', timerMin: 25 },
      { text: 'Rub the steak with oil and seasoning and sear in a very hot pan, 2–3 minutes per side for medium. Rest for 5 minutes.', timerMin: 6 },
      { text: 'Steam the broccoli and serve with the sliced steak.', timerMin: 4 },
    ],
  },
  {
    id: 'edamame-quinoa-salad', title: 'Edamame & quinoa crunch salad', emoji: '🥗', cover: 'day', reviewed: false,
    description: 'Plant protein from edamame and quinoa with crunchy veg and a lime-soy dressing.',
    servings: 2, prepMin: 10, cookMin: 15, editorial: [],
    ingredients: [
      { food: QUINOA, grams: 120, label: 'Quinoa', note: 'dry weight' },
      { food: EDAMAME, grams: 200, label: 'Edamame beans', note: 'frozen, cooked' },
      { food: RED_PEPPER, grams: 120, label: 'Red pepper' },
      { food: CUCUMBER, grams: 100, label: 'Cucumber' },
      { food: SPRING_ONION, grams: 30, label: 'Spring onions' },
      { food: ROCKET, grams: 40, label: 'Rocket' },
      { food: LIME, grams: 20, label: 'Lime juice' },
      { food: SOY, grams: 15, label: 'Soy sauce' },
      { food: SESAME_OIL, grams: 8, label: 'Sesame oil' },
    ],
    steps: [
      { text: 'Rinse the quinoa and simmer in twice its volume of water until the water is absorbed. Cool.', timerMin: 15 },
      { text: 'Cook the edamame for 3 minutes and cool under cold water.', timerMin: 3 },
      { text: 'Chop the veg, whisk lime, soy and sesame oil, and toss everything together.' },
    ],
  },
]
