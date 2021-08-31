import Debug from 'debug'
import {Trade, Amount, Offer} from '../types/XrplObjects'
import {RatesInCurrency as Rates} from '../types/Reader'
import BigNumber from 'bignumber.js'

const log = Debug('orderbook:parser')

export interface ParseResult {
  _ExchangeRate: number
  _I_Spend_Capped: number
  _I_Get_Capped: number
  _CumulativeRate: number
  _CumulativeRate_Cap: number
  _Capped: boolean
}

export interface ParseResultVerbose extends ParseResult {
  account: string
  _I_Spend: number
  _I_Get: number
  TakerGets?: number
  TakerGetsFunded?: number
  TakerPays?: number
  TakerPaysFunded?: number
  Funds?: number
}

interface Options {
  rates?: Rates
  verbose: boolean
}

interface ParserOptions {
  books: Array<Offer[]>
  trade: Trade
  options?: Options
}

enum BookType {
  SOURCE = 'SOURCE',
  RETURN = 'RETURN'
}

function parseAmount (amount?: Amount | string): BigNumber | undefined {
  if (typeof amount === 'object' && amount !== null) {
    return new BigNumber(amount.value)
  }
  if (typeof amount === 'string') {
    return (new BigNumber(amount)).dividedBy(1000000)
  }
  return undefined
}

function LiquidityParser (ParserData: ParserOptions): ParseResult[] | ParseResultVerbose[] {
  const bookData = ParserData.books[0]
  if (bookData.length < 1) {
    return []
  }

  /**
   * Determine Book Direction.
   *  If opposite (RETURN) direction: cap at
   *  _I_Get_Capped
   * instead of
   *  _I_Spend_Capped
   */

  const fromCurrency = ParserData.trade.from
  const fromIsXrp = fromCurrency.currency.toUpperCase() === 'XRP' && (fromCurrency.issuer ?? '') === ''

  let bookType: BookType

  // log({
  //   trade: ParserData.trade,
  //   book0: bookData[0]
  // })
  if (typeof bookData[0].TakerPays === 'string') {
    // Taker pays XRP
    if (fromIsXrp) {
      bookType = BookType.SOURCE
    } else {
      bookType = BookType.RETURN
    }
  } else {
    // Taker pays IOU
    if (
      fromCurrency.currency.toUpperCase() === bookData[0].TakerPays.currency.toUpperCase() &&
      fromCurrency.issuer === bookData[0].TakerPays.issuer
    ) {
      bookType = BookType.SOURCE
    } else {
      bookType = BookType.RETURN
    }
  }

  const tradeAmount = new BigNumber(ParserData.trade.amount)

  let linesPresent = 0
  const data: ParseResultVerbose[] = bookData.map((offer: Offer) => {
    return Object.assign(<ParseResultVerbose>{}, {
      account: offer.Account,
      TakerGets: parseAmount(offer.TakerGets),
      TakerGetsFunded: parseAmount(offer.taker_gets_funded),
      TakerPays: parseAmount(offer.TakerPays),
      TakerPaysFunded: parseAmount(offer.taker_pays_funded),
      Funds: parseAmount(offer.owner_funds)
    })
  }).filter(a => {
    const allowed = linesPresent > 0 || (
      (a.TakerGetsFunded === undefined || (a.TakerGetsFunded && a.TakerGetsFunded.toNumber() > 0))
      &&
      (a.TakerPaysFunded === undefined || (a.TakerPaysFunded && a.TakerPaysFunded.toNumber() > 0))
    )

    if (allowed) {
      linesPresent++
    } else {
      // log({suppressed: a})
    }

    return allowed
  }).reduce((a: ParseResultVerbose[], b: ParseResultVerbose, i: number) => {
    const _PaysEffective = b.TakerGetsFunded === undefined
      ? Number(b.TakerGets)
      : Number(b.TakerGetsFunded)

    const _GetsEffective = b.TakerPaysFunded === undefined
      ? Number(b.TakerPays)
      : Number(b.TakerPaysFunded)

    const _GetsSum = _GetsEffective + (i > 0 ? a[i - 1]._I_Spend : 0)
    const _PaysSum = _PaysEffective + (i > 0 ? a[i - 1]._I_Get : 0)

    const _cmpField = bookType === BookType.SOURCE
      ? '_I_Spend_Capped'
      : '_I_Get_Capped'

    let _GetsSumCapped: BigNumber | undefined = new BigNumber(
      i > 0 && a[i - 1][_cmpField] >= ParserData.trade.amount
        ? a[i - 1]._I_Spend_Capped
        : _GetsSum
      )

    let _PaysSumCapped: BigNumber | undefined = new BigNumber(
      i > 0 && a[i - 1][_cmpField] >= ParserData.trade.amount
        ? a[i - 1]._I_Get_Capped
        : _PaysSum
    )

    let _CumulativeRate_Cap: BigNumber | undefined
    let _Capped: boolean | undefined = i > 0 ? a[i - 1]._Capped : false

    if (bookType === BookType.SOURCE) {
      if (
        _Capped === false &&
        _GetsSumCapped !== undefined &&
        _GetsSumCapped.gt(tradeAmount)
      ) {
        const _GetsCap = new BigNumber(1).minus(_GetsSumCapped.minus(tradeAmount).dividedBy(_GetsSumCapped))
        _GetsSumCapped = _GetsSumCapped.multipliedBy(_GetsCap)
        _PaysSumCapped = _PaysSumCapped.multipliedBy(_GetsCap)
        _Capped = true
      }
    }

    if (bookType === BookType.RETURN) {
      if (
        _Capped === false &&
        _PaysSumCapped !== undefined &&
        _PaysSumCapped.gt(tradeAmount)
      ) {
        const _PaysCap = new BigNumber(1).minus(_PaysSumCapped.minus(tradeAmount).dividedBy(_PaysSumCapped))
        _GetsSumCapped = _GetsSumCapped.multipliedBy(_PaysCap)
        _PaysSumCapped = _PaysSumCapped.multipliedBy(_PaysCap)
        _Capped = true
      }
    }

    if (_Capped !== undefined) {
      // _CumulativeRate_Cap = _GetsSumCapped / _PaysSumCapped
      _CumulativeRate_Cap = _GetsSumCapped.dividedBy(_PaysSumCapped)
    }

    if (i > 0 && (a[i - 1]._Capped === true || a[i - 1]._Capped === undefined)) {
      _GetsSumCapped = undefined
      _PaysSumCapped = undefined
      _CumulativeRate_Cap = undefined
      _Capped = undefined
    }

    // log ({_GetsSum, _PaysSum})

    if (_GetsSum > 0 && _PaysSum > 0) {
      Object.assign(b, {
        // _PaysEffective,
        // _GetsEffective,
        _I_Spend: _GetsSum,
        _I_Get: _PaysSum,
        _ExchangeRate: _PaysEffective === 0
          ? undefined
          : _GetsEffective / _PaysEffective,
        _CumulativeRate: _GetsSum / _PaysSum,
        _I_Spend_Capped: _GetsSumCapped?.toNumber(),
        _I_Get_Capped: _PaysSumCapped?.toNumber(),
        _CumulativeRate_Cap: _CumulativeRate_Cap?.toNumber(),
        _Capped
      })

      if (ParserData.options?.rates?.toLowerCase().trim() === 'to') {
        if (!isNaN(b._ExchangeRate)) {
          b._ExchangeRate = 1 / b._ExchangeRate
        }
        if (!isNaN(b._CumulativeRate_Cap)) {
          b._CumulativeRate_Cap = 1 / b._CumulativeRate_Cap
        }
        if (!isNaN(b._CumulativeRate)) {
          b._CumulativeRate = 1 / b._CumulativeRate
        }
      }
    } else {
      // One side of the offer is empty
      return a
    }

    return a.concat(b)
  }, <ParseResultVerbose[]>[]).filter(line => {
    let _return = true

    if (!ParserData.options?.verbose) {
      if (line._Capped === undefined || line._ExchangeRate === undefined) {
        _return = false
      }
    }

    return _return
  }).map(line => {
    if (!ParserData.options?.verbose) {
      delete line.account
      delete line._I_Spend
      delete line._I_Get
      delete line._ExchangeRate
      delete line.TakerGets
      delete line.TakerGetsFunded
      delete line.TakerPays
      delete line.TakerPaysFunded
      delete line.Funds
    }

    return line
  })

  return data
}

export {LiquidityParser}
