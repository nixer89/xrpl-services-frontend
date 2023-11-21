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
    const year_seconds = 31536000; // By convention, the Xahau  Network's interest/demurrage rules use a fixed number of seconds per year (31536000), which is not adjusted for leap days or leap seconds
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
    let returnString = "";
    if(currencyCode) {
        let currency = currencyCode.trim();

        if(currency && currency.length > 3) {

            if(!isHex(currency))
                currency = Buffer.from(currency, 'utf-8').toString('hex');

            while(currency.length < 40)
                currency+="0";

            returnString = currency.toUpperCase();

        } else {
            returnString = currency;
        }
    }

    return returnString;
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
    if (!currencyCode) return '';

    // Native XAH
    if (currencyCode === 'XAH') {
        return currencyCode;
    }

    // IOU claims as XAH which consider as fake XAH
    if (currencyCode.toLowerCase() === 'xah') {
        return 'FakeXAH';
    }

    // IOU
    // currency code is hex try to decode it
    if (currencyCode.match(/^[A-F0-9]{40}$/)) {
        let decoded = '';

        //check for demurrage
        if(currencyCode.startsWith('01'))
            decoded = convertDemurrageToUTF8(currencyCode);
        // check for XLS15d
        else if (currencyCode.startsWith('02')) {
            try {
                const binary = HexEncoding.toBinary(currencyCode);
                decoded = binary.slice(8).toString('utf-8');
            } catch {
                decoded = HexEncoding.toString(currencyCode);
            }
        } else {
            decoded = HexEncoding.toString(currencyCode);
        }

        if (decoded) {
            // cleanup break lines and null bytes
            const clean = decoded.replace(/\0/g, '').replace(/(\r\n|\n|\r)/gm, ' ');

            // check if decoded contains xah
            if (clean.toLowerCase().trim() === 'xah') {
                return 'FakeXAH';
            }
            return clean;
        }

        // if not decoded then return truncated hex value
        return `${currencyCode.slice(0, 4)}...`;
    }

    return currencyCode;
};

/* Hex Encoding  ==================================================================== */
const HexEncoding = {
    toBinary: (hex: string): Buffer => {
        return hex ? Buffer.from(hex, 'hex') : undefined;
    },

    toString: (hex: string): string | undefined => {
        return hex ? Buffer.from(hex, 'hex').toString('utf8') : undefined;
    },

    toHex: (text: string): string | undefined => {
        return text ? Buffer.from(text).toString('hex') : undefined;
    },

    toUTF8: (hex: string): string | undefined => {
        if (!hex) return undefined;

        const buffer = Buffer.from(hex, 'hex');
        const isValid = Buffer.compare(Buffer.from(buffer.toString(), 'utf8'), buffer) === 0;

        if (isValid) {
            return buffer.toString('utf8');
        }
        return hex;
    },
};

/**
 * Convert Xahau value to NFT value
 * @param value number
 * @returns number in NFT value or false if Xahau value is not NFT
 */
 export const XRPLValueToNFT = (value: number): number | boolean => {

    try {
        const data = String(Number(value)).split(/e/i);
        let shift = 81 - (Number(data[1])*-1);
        let firstDigits = data[0].split('.');

        let first = Number(firstDigits[0] + (firstDigits[1] ? firstDigits[1].substring(0,shift) : ""));

        let newNumber = Number(first + (firstDigits[1] ? "." + firstDigits[1].substring(shift) : ""));

        return Math.round(newNumber);
    } catch(err) {
        console.log(JSON.stringify(err));
        return false;
    }
    
};

/**
 * Convert Xahau value to NFT value
 * @param value number
 * @returns number in NFT value or false if Xahau value is not NFT
 */
 export const normalizeBalance = (value: number): number => {

    try {
        if(value > 1000000000000000e-85)
            return value;

        const data = String(Number(value)).split(/e/i);
        let shift = 81 - (Number(data[1])*-1);
        let firstDigits = data[0].split('.');

        let first = Number(firstDigits[0] + (firstDigits[1] ? firstDigits[1].substring(0,shift) : ""));

        let newNumber = Number(first + (firstDigits[1] ? "." + firstDigits[1].substring(shift) : ""));

        return Math.round(newNumber);
    } catch(err) {
        console.log(JSON.stringify(err));
        return value;
    }
    
};