import * as ieee754Float from './IEEE754Float';

export function tokenNormalizer(numberOfTokens: string): string {
    return numberOfTokens.trim().length > 15 ? Number(numberOfTokens).toExponential(15) : numberOfTokens.trim();
}

export function currencyCodeUTF8ToHexIfUTF8(currencyCode: string) {
    if(currencyCode) {
        if(currencyCode.length == 3)
            return currencyCode;
        else if(currencyCode.length == 40 && isHex(currencyCode))
            return currencyCode;
        else
            return Buffer.from(currencyCode, 'utf-8').toString('hex');
    } else {
        return "";
    }
}

export function currencyCodeHexToUTF8Trimmed(currencyCode:string): string {
        if(currencyCode && currencyCode.length == 40 && isHex(currencyCode)) { //remove trailing zeros
        while(currencyCode.endsWith("00")) {
            currencyCode = currencyCode.substring(0, currencyCode.length-2);
        }
    }

    if(currencyCode) {
        if(currencyCode.length > 3 && isHex(currencyCode)) {
            if(currencyCode.startsWith("01"))
                return convertDemurrageToUTF8(currencyCode);
            else
                return Buffer.from(currencyCode, "hex").toString('utf-8').trim();
        } else {
            return currencyCode;
        }
    } else {
        return "";
    }
}

export function convertDemurrageToUTF8(demurrageCode: string): string {

    let bytes = Buffer.from(demurrageCode, "hex")
    let code = String.fromCharCode(bytes[1]) + String.fromCharCode(bytes[2]) + String.fromCharCode(bytes[3]);
    let interest_start = (bytes[4] << 24) + (bytes[5] << 16) + (bytes[6] <<  8) + (bytes[7]);
    let interest_period = ieee754Float.fromBytes(bytes.slice(8, 16));
    const year_seconds = 31536000; // By convention, the XRP Ledger's interest/demurrage rules use a fixed number of seconds per year (31536000), which is not adjusted for leap days or leap seconds
    let interest_after_year = precision(Math.pow(Math.E, (interest_start+year_seconds - interest_start) / interest_period), 14);
    let interest = (interest_after_year * 100) - 100;

    return(`${code} (${interest}% pa)`)
}

function precision(num, precision): number {
    return +(Math.round(Number(num + 'e+'+precision))  + 'e-'+precision);
}

export function currencyCodeUTF8ToHex(currencyCode: string): string {
    //console.log("NORMALIZER INPUT: " + currencyCode);
    if(currencyCode && currencyCode.length == 40) { //remove trailing zeros
        while(currencyCode.endsWith("00")) {
            currencyCode = currencyCode.substring(0, currencyCode.length-2);
        }
    }
  
    let output: string;
    //console.log("currency to change: " + currency);
    if(currencyCode.length > 3)
        output = Buffer.from(currencyCode.trim(), "utf-8").toString("hex");
    else
        output = currencyCode;

    //console.log("NORMALIZER OUTPUT: " + output);

    return output;
}

export function getCurrencyCodeForXRPL(currencyCode: string): string {
    if(currencyCode) {
        let currency = currencyCode.trim();

        if(currency && currency.length > 3) {
            currency = Buffer.from(currency, 'utf-8').toString('hex');

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

export function rippleEpocheTimeToUTC(rippleEpocheTime: number): number {
    return (rippleEpocheTime+946684800)*1000;
}

export function utcToRippleEpocheTime(utcTime: number): number {
    return (utcTime/1000)-946684800
}

export function isHex(string: string): boolean {
    return /^[0-9A-Fa-f]*$/.test(string);
}

export function normalizeCurrencyCodeXummImpl(currencyCode: string, maxLength = 20): string {
    if(!currencyCode) return "";

    if(currencyCode.length === 3 && currencyCode.trim().toLowerCase() !== 'xrp') {
        // Normal currency code
        return currencyCode.trim()
    }

    if(currencyCode.match(/^[a-fA-F0-9]{40}$/) && !isNaN(parseInt(currencyCode, 16))) {
    // HEX currency code
    const hex = currencyCode.toString().replace(/(00)+$/g, '')
    if (hex.startsWith('01')) {
        return convertDemurrageToUTF8(currencyCode);
    }
    if (hex.startsWith('02')) {
        const xlf15d = Buffer.from(hex, 'hex').slice(8).toString('utf-8').slice(0, maxLength).trim()
        if (xlf15d.match(/[a-zA-Z0-9]{3,}/) && xlf15d.toLowerCase() !== 'xrp') {
        return xlf15d
        }
    }
    const decodedHex = Buffer.from(hex, 'hex').toString('utf-8').slice(0, maxLength).trim()
    if (decodedHex.match(/[a-zA-Z0-9]{3,}/) && decodedHex.toLowerCase() !== 'xrp') {
        return decodedHex
    }
    }
    return "";
};