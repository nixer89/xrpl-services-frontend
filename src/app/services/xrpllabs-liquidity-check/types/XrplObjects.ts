export interface TradeAmount {
  currency: string
  issuer?: string
}

export interface IssuedAmount extends TradeAmount {
  value: string
}

export interface Trade {
  from: TradeAmount
  amount: number
  to: TradeAmount
}

export type Amount = string | IssuedAmount

export interface OfferLedgerEntry {
  LedgerEntryType: 'Offer'
  Flags: number
  Account: string
  Sequence: number
  TakerPays: Amount
  TakerGets: Amount
  BookDirectory: string
  BookNode: string
  OwnerNode: string
  PreviousTxnID: string
  PreviousTxnLgrSeq: number
  Expiration?: number
}

export interface Offer extends OfferLedgerEntry {
  quality?: string
  owner_funds?: string
  taker_gets_funded?: Amount
  taker_pays_funded?: Amount
}
