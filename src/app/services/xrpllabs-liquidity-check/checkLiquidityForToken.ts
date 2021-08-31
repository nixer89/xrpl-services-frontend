import {
    LiquidityCheck,
    Params as LiquidityCheckParams,
    RatesInCurrency
  } from "./liquidity"
  
  const options = {
    timeoutSeconds: 10,
    rates: RatesInCurrency.to,
    maxSpreadPercentage: 6,
    maxSlippagePercentage: 4,
    maxSlippagePercentageReverse: 4,
    maxBookLines: 500
  }

  export class CheckLiquidityClass {

    private static _instance: CheckLiquidityClass;

    private isRunning:boolean = false;

    private constructor() { }

    public static get Instance(): CheckLiquidityClass
    {
        // Do you need arguments? Make it a regular static method instead.
        return this._instance || (this._instance = new this());
    }
  
    async checkLiquidity(issuer:string, currency: string) {

      if(!this.isRunning) {

        this.isRunning = true;

        const pairs = [
          {issuer: issuer, currency: currency},
        ]
      
        const data = await Promise.all(
          pairs.map(
            async p => {
              return await Promise.all([100].map(async a => {
                const Params: LiquidityCheckParams = {
                  trade: {
                    from: {currency: 'XRP'},
                    amount: a,
                    to: {currency: p.currency, issuer: p.issuer}
                  },
                  options
                }
      
                const Check = new LiquidityCheck(Params)
                const r = await Check.get()
      
                return {
                  amount: a,
                  rate: r.rate,
                  errors: r.errors
                }
              }
            )
          )
        }))
      
        // console.table(data.reduce((a, b) => {
        //   b.forEach(r => a.push(r))
        //   return a
        // }, []))
        data.forEach(d => console.table(d))

        this.isRunning = false;
      }
    
    }
}