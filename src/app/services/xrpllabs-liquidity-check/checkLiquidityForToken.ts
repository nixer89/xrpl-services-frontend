  import { Errors } from 'xrpl-orderbook-reader';
  import { LedgerExchange } from './ledgerExchange'


  export class CheckLiquidityClass {

    private static _instance: CheckLiquidityClass;

    private isRunning:boolean = false;

    private constructor() { }

    public static get Instance(): CheckLiquidityClass
    {
        // Do you need arguments? Make it a regular static method instead.
        return this._instance || (this._instance = new this());
    }
  
    async checkLiquidity(issuer:string, currency: string): Promise<number> {

      let liquidityIndex = -1;

      try {

        if(!this.isRunning) {

          this.isRunning = true;

          const pair = {issuer: issuer, currency: currency, displayName: currency};
          
        
          let data = await Promise.all(
                await Promise.all([100, 1000, 2500, 5000, 10000].map(async a => {
                        
                  const Check = new LedgerExchange(pair)
                  Check.initialize();
                  const r = await Check.getLiquidity('sell', a);
        
                  return {
                    name: pair.displayName,
                    amount: a,
                    rate: r.rate,
                    errors: r.errors
                  }
                }
              )
            )
          );
        
          liquidityIndex = 5;
          data.forEach(d => {
            if(d && d.errors) {
              if(d.errors.includes(Errors.REQUESTED_LIQUIDITY_NOT_AVAILABLE))
                liquidityIndex -= 1;
              else if(d.errors.length == 1)
                liquidityIndex -= 0.5;
              else if(d.errors.length > 1)
                liquidityIndex -= 1;
            } else {
              liquidityIndex = -1
            }
            console.log(d)
          })

          this.isRunning = false;
        }
      } catch(err) {
        console.log(err)
        return -1;
      }

      return liquidityIndex;
    
    }
}