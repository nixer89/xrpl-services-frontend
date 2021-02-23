export const ROOT_FLAG_DEFAULT_RIPPLE:number = 8388608;
export const ROOT_FLAG_DEPOSIT_AUTH:number = 16777216;
export const ROOT_FLAG_DISABLE_MASTER:number = 1048576;
export const ROOT_FLAG_DISALLOW_XRP:number = 524288;
export const ROOT_FLAG_GLOBAL_FREEZE:number = 4194304;
export const ROOT_FLAG_NO_FREEZE:number = 2097152;
export const ROOT_FLAG_PASSWORD_SPENT:number = 65536;
export const ROOT_FLAG_REQUIRE_AUTH:number = 262144;
export const ROOT_FLAG_REQUIREDESTINATION_TAG:number = 131072;

export function isRequireDestinationTagEnabled(flags:number) {
    return flags && (flags & ROOT_FLAG_REQUIREDESTINATION_TAG) == ROOT_FLAG_REQUIREDESTINATION_TAG;
}

export function isMasterKeyDisabled(flags:number) {
    return flags && (flags & ROOT_FLAG_DISABLE_MASTER) == ROOT_FLAG_DISABLE_MASTER;
}

export function isDefaultRippleEnabled(flags:number) {
    return flags && (flags & ROOT_FLAG_DEFAULT_RIPPLE) == ROOT_FLAG_DEFAULT_RIPPLE;
}

export function isDisallowXRPEnabled(flags:number) {
    return flags && (flags & ROOT_FLAG_DISALLOW_XRP) == ROOT_FLAG_DISALLOW_XRP;
}