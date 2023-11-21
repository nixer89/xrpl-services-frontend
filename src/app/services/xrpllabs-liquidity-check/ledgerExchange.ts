import {
    LiquidityCheck,
    Params as LiquidityCheckParams,
    Result as LiquidityResult,
    RatesInCurrency,
    Options,
} from 'xrpl-orderbook-reader';

import { XRPLWebsocket } from '../xrplWebSocket';

const xrplClient = new XRPLWebsocket();

/* types ==================================================================== */
export type ExchangePair = {
    currency: string;
    issuer?: string;
};

/* Class ==================================================================== */
export class LedgerExchange {
    private liquidityCheck: LiquidityCheck;
    private pair: ExchangePair;
    public boundaryOptions: Options;
    public errors: any;

    constructor(pair: ExchangePair) {
        this.pair = pair;
        this.liquidityCheck = undefined;

        this.boundaryOptions = {
            rates: RatesInCurrency.to,
            timeoutSeconds: 10,
            maxSpreadPercentage: 4,
            maxSlippagePercentage: 3,
            maxSlippagePercentageReverse: 3,
        };
    }

    initialize = () => {

        // build default params
        const params = this.getLiquidityCheckParams('sell', 0);
        this.liquidityCheck = new LiquidityCheck(params);
    };

    getLiquidityCheckParams = (direction: 'sell' | 'buy', amount: number): LiquidityCheckParams => {
        const pair = {
            currency: this.pair.currency,
            issuer: this.pair.issuer,
        };

        const from = direction === 'sell' ? { currency: 'XAH' } : pair;
        const to = direction === 'sell' ? pair : { currency: 'XAH' };

        return {
            trade: {
                from,
                to,
                amount,
            },
            options: this.boundaryOptions,
            method: xrplClient.send,
        };
    };

    getLiquidity = (direction: 'sell' | 'buy', amount: number): Promise<LiquidityResult> => {
        try {
            const params = this.getLiquidityCheckParams(direction, amount);

            if (this.liquidityCheck) {
                // update params
                this.liquidityCheck.refresh(params);

                return this.liquidityCheck.get();
            }
            return Promise.reject(new Error('Liquidity check is not initialized yet!'));
        } catch (e) {
            return Promise.reject(e);
        }
    };
}

export default LedgerExchange;