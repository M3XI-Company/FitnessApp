import type { FoodSource } from './types'

/** Every nutrition source Breeze uses, with the attribution its licence requires. */
export const SOURCES: Record<FoodSource, { name: string; short: string; licence: string; attribution: string; url?: string }> = {
  cofid: {
    name: "McCance and Widdowson's Composition of Foods Integrated Dataset (CoFID) 2021",
    short: 'UK CoFID',
    licence: 'Open Government Licence v3.0',
    attribution: 'Contains public sector information licensed under the Open Government Licence v3.0. Source: Office for Health Improvement and Disparities / Public Health England, CoFID 2021.',
    url: 'https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid',
  },
  off: {
    name: 'Open Food Facts',
    short: 'Open Food Facts',
    licence: 'Open Database Licence (ODbL) 1.0; contents DbCL 1.0; images CC BY-SA',
    attribution: 'Product data from Open Food Facts contributors, available under the Open Database Licence. Product images © Open Food Facts contributors, CC BY-SA. Breeze looks products up live and does not redistribute the database.',
    url: 'https://world.openfoodfacts.org',
  },
  manual: { name: 'Entered by you', short: 'Your entry', licence: '—', attribution: 'Values you entered yourself.' },
  ai: {
    name: 'AI photo estimate',
    short: 'AI estimate',
    licence: '—',
    attribution: 'Food identified from your photo by an AI model; nutrition from the databases above. Portions are estimates — please check them.',
  },
  boxed: { name: 'Breeze boxed meals', short: 'Breeze recipe', licence: '© M3XI', attribution: 'Recipe nutrition calculated by Breeze; values are estimates.' },
}
