export function iouTokenNormalizer(numberOfTokens: string): string {
    return numberOfTokens.trim().length > 15 ? Number(numberOfTokens).toExponential(15) : numberOfTokens.trim();
}

export function currencyCodeHexToAsciiTrimmed(currencyCode:string): string {
    if(currencyCode && currencyCode.length == 40) { //remove trailing zeros
        while(currencyCode.endsWith("00")) {
            currencyCode = currencyCode.substring(0, currencyCode.length-2);
        }
    }
  
    if(currencyCode && currencyCode.length > 3)
        return Buffer.from(currencyCode, "hex").toString().trim();
    else
        return currencyCode;
}

export function currencyCodeAsciiToHex(currencyCode: string): string {
    if(currencyCode && currencyCode.length == 40) { //remove trailing zeros
        while(currencyCode.endsWith("00")) {
            currencyCode = currencyCode.substring(0, currencyCode.length-2);
        }
      }
  
      //console.log("currency to change: " + currency);
      if(currencyCode.length > 3)
        return Buffer.from(currencyCode.trim(), "ascii").toString("hex").toUpperCase(); 
      else
        return currencyCode;
}

export function getCurrencyCodeForXRPL(currencyCode: string): string {
    if(currencyCode) {
        let currency = currencyCode.trim();

        if(currency && currency.length > 3) {
        currency = Buffer.from(currency, 'ascii').toString('hex').toUpperCase();

        while(currency.length < 40)
            currency+="0";

        return currency

        } else {
        return currency;
        }
    } else {
        return "";
    }
  }