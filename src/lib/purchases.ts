/**
 * Buying Breeze Plus through the App Store or Google Play.
 *
 * Apple and Google take the payment; RevenueCat (react-native-purchases)
 * talks to both and tells the app whether the person has Plus. Its keys are
 * public app keys (EXPO_PUBLIC_REVENUECAT_IOS_KEY and
 * EXPO_PUBLIC_REVENUECAT_ANDROID_KEY), made to ship inside an app. Until they
 * are set, and in Expo Go where the store is not there, nothing can be bought
 * and `storeReady()` is false.
 */
import { Platform } from 'react-native'
import { PLUS } from './plan'

type Lib = typeof import('react-native-purchases')
type Package = import('react-native-purchases').PurchasesPackage

let lib: Lib | null = null
try {
  // the module throws on import when its native half is not in the build
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  lib = require('react-native-purchases') as Lib
} catch {
  lib = null
}

const KEY = Platform.OS === 'ios' ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY : Platform.OS === 'android' ? process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY : undefined

/** True when this build can sell: the store module is in it and a key is set. */
export const storeReady = () => !!lib && !!KEY

export const STORE: 'ios' | 'android' | 'other' = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'other'
/** Where the person manages or cancels the subscription. */
export const MANAGE_URL = Platform.OS === 'ios' ? 'https://apps.apple.com/account/subscriptions' : 'https://play.google.com/store/account/subscriptions?package=com.m3xi.breeze'

let configured = false
function store() {
  if (!lib || !KEY) return null
  if (!configured) { lib.default.configure({ apiKey: KEY }); configured = true }
  return lib.default
}

export interface Offer {
  period: 'monthly' | 'yearly'
  /** the store's own price for this person's country, e.g. "£12.99" */
  price: string
  /** days free before the first charge, when the store offers a trial */
  trialDays: number
  pkg: Package
}

const offerOf = (period: Offer['period'], pkg: Package | null | undefined): Offer | undefined => {
  if (!pkg) return undefined
  const intro = pkg.product.introPrice
  const days = intro && intro.price === 0 ? intro.periodNumberOfUnits * ({ DAY: 1, WEEK: 7, MONTH: 30, YEAR: 365 }[intro.periodUnit as 'DAY' | 'WEEK' | 'MONTH' | 'YEAR'] ?? 0) : 0
  return { period, price: pkg.product.priceString, trialDays: days, pkg }
}

/** What is on sale, with the store's prices. Empty when nothing can be bought here. */
export async function offers(): Promise<{ monthly?: Offer; yearly?: Offer }> {
  try {
    const current = (await store()?.getOfferings())?.current
    return { monthly: offerOf('monthly', current?.monthly), yearly: offerOf('yearly', current?.annual) }
  } catch {
    return {}
  }
}

export type BuyResult = { ok: true } | { ok: false; reason: 'cancelled' | 'failed' | 'unavailable' }

/** Start the store's own purchase sheet. The person confirms and pays there. */
export async function buy(offer: Offer): Promise<BuyResult> {
  const s = store()
  if (!s) return { ok: false, reason: 'unavailable' }
  try {
    const { customerInfo } = await s.purchasePackage(offer.pkg)
    return customerInfo.entitlements.active[PLUS.entitlement] ? { ok: true } : { ok: false, reason: 'failed' }
  } catch (e) {
    return { ok: false, reason: (e as { userCancelled?: boolean })?.userCancelled ? 'cancelled' : 'failed' }
  }
}

/** Whether the store says this person has Plus: true, false, or null when it could not be asked. */
export async function hasPlus(restore = false): Promise<boolean | null> {
  const s = store()
  if (!s) return null
  try {
    const info = restore ? await s.restorePurchases() : await s.getCustomerInfo()
    return !!info.entitlements.active[PLUS.entitlement]
  } catch {
    return null
  }
}
