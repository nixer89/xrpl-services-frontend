import { Component, ViewChild, Output, EventEmitter, Input, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { Observable, Subscription, Subject } from 'rxjs';
import { XummTypes } from 'xumm-sdk';
import { GoogleAnalyticsService } from '../../services/google-analytics.service';
import { AccountInfoChanged, XrplAccountChanged, Token, TrustLine } from 'src/app/utils/types';
import * as normalizer from '../../utils/normalizers';
import { ActivatedRoute } from '@angular/router';
import { MatExpansionPanel } from '@angular/material/expansion';
import { isValidXRPAddress } from 'src/app/utils/utils';
import { XRPLWebsocket } from 'src/app/services/xrplWebSocket';
import * as flagUtil from '../../utils/flagutils'

@Component({
  selector: 'trustset',
  templateUrl: './trustset.html'
})
export class TrustSetComponent implements OnInit, OnDestroy, AfterViewInit {

  private TRUST_SET_FLAG_SET_NO_RIPPLE:number = 131072;
  private TRUST_SET_FLAG_CLEAR_NO_RIPPLE:number = 262144;
  private TRUST_SET_FLAG_SET_FREEZE:number = 1048576;
  private TRUST_SET_FLAG_CLEAR_FREEZE:number = 2097152;

  constructor(private xrplWebSocket: XRPLWebsocket,
              private route: ActivatedRoute,
              private googleAnalytics: GoogleAnalyticsService) { }

  @Input()
  accountInfoChanged: Observable<AccountInfoChanged>;

  @Input()
  transactionSuccessfull: Observable<any>;
  
  @Output()
  onPayload: EventEmitter<XummTypes.XummPostPayloadBodyJson> = new EventEmitter();

  @ViewChild('inpisseraccount') inpisseraccount;
  issuerAccountInput: string;

  @ViewChild('inplimit') inplimit;
  limitInput: string;

  @ViewChild('mep') mep: MatExpansionPanel

  issuedCurrencyInput: string;

  maxFifthteenDigits:boolean = false;

  originalAccountInfo:any;
  testMode:boolean = false;

  private accountInfoChangedSubscription: Subscription;
  private transactionSuccessfullSubscription: Subscription;
  issuerAccountChangedSubject: Subject<XrplAccountChanged> = new Subject<XrplAccountChanged>();
  xrplAccountInfoChangedSubject: Subject<AccountInfoChanged> = new Subject<AccountInfoChanged>();

  showIssuedCurrencySelectedStyle:boolean = false;
  issuedCurrencySelected:boolean = false;
  
  isValidTrustSet:boolean = false;
  validAddress:boolean = false;
  validCurrency:boolean = false;
  validLimit:boolean = false;

  lastKnownAddress:string = null;
  lastKnownCurrency:string = null;

  loadingIssuerData:boolean = false;
  issuerHasDefaultRipple:boolean = false;
  currencyExists:boolean = false;

  allFieldsSet:boolean = false;

  isEditMode:boolean = false;

  async ngOnInit() {
    this.accountInfoChangedSubscription = this.accountInfoChanged.subscribe(accountData => {
      //console.log("account info changed received: " + JSON.stringify(accountData));
      this.originalAccountInfo = accountData.info;
      this.testMode = accountData.mode;

      this.xrplAccountInfoChangedSubject.next(accountData);
      
      setTimeout(() => {
        this.issuerAccountChangedSubject.next({account: this.lastKnownAddress, mode: this.testMode});
      },500);
    });

    //this.transactionSuccessfullSubscription = this.transactionSuccessfull.subscribe(() => {
    //  this.clearInputs()
    //});

    this.route.queryParams.subscribe(async params => {
      if(params.issuer && params.currency && params.limit) {

        this.issuerAccountInput = params.issuer;
        //console.log("subscribe received: " + params.currency);
        this.issuedCurrencyInput = normalizer.currencyCodeUTF8ToHexIfUTF8(params.currency);
        //console.log("subscribe set: " + this.issuedCurrencyInput);
        this.limitInput = params.limit;

        this.testMode = params.testmode ? params.testmode : (params.testnet ? params.testnet : false);
        //console.log("testmode: " + this.testMode);

        await this.issuerAccountChanged(true);

        if(this.isValidTrustSet) {
          setTimeout(() => {
            this.sendPayloadToXumm(true)
          });
        }
      }
    });
  }

  ngAfterViewInit() {
    if(this.issuerAccountInput != null && this.issuedCurrencyInput != null && this.limitInput != null)
      this.mep.open();
  }

  ngOnDestroy() {
    if(this.accountInfoChangedSubscription)
      this.accountInfoChangedSubscription.unsubscribe();

    if(this.transactionSuccessfullSubscription)
      this.transactionSuccessfullSubscription.unsubscribe();

    if(this.xrplAccountInfoChangedSubject)
      this.xrplAccountInfoChangedSubject.unsubscribe();

    if(this.issuerAccountChangedSubject)
      this.issuerAccountChangedSubject.unsubscribe();
  }

  async loadAccountDataIssuer(xrplAccount: string) {
    //this.infoLabel = "loading " + xrplAccount;
    if(xrplAccount && isValidXRPAddress(xrplAccount)) {
      
      let account_info_request:any = {
        command: "account_info",
        account: xrplAccount,
        "strict": true,
      }

      let message_acc_info:any = await this.xrplWebSocket.getWebsocketMessage("set-trustline", account_info_request, this.testMode);
      //console.log("xrpl-transactions account info: " + JSON.stringify(message_acc_info));
      //this.infoLabel = JSON.stringify(message_acc_info);
      if(message_acc_info && message_acc_info.status && message_acc_info.type && message_acc_info.type === 'response') {
        if(message_acc_info.status === 'success' && message_acc_info.result && message_acc_info.result.account_data) {
          let issuer_account_info = message_acc_info.result.account_data;

          //console.log(JSON.stringify(issuer_account_info));

          this.issuerHasDefaultRipple = flagUtil.isDefaultRippleEnabled(issuer_account_info.Flags);

        } else {
          this.issuerHasDefaultRipple = false;
        }
      } else {
        this.issuerHasDefaultRipple = false;
      }
    } else {
      this.issuerHasDefaultRipple = false;
    }
  }

  async checkCurrencyExists() {
    //this.infoLabel = "loading " + xrplAccount;
    if(this.issuerAccountInput && this.issuedCurrencyInput && this.limitInput && isValidXRPAddress(this.issuerAccountInput)) {

      this.allFieldsSet = true;

      //settings ok, now check for the actual currenxy!
      let gateway_balances_request:any = {
        command: "gateway_balances",
        account: this.issuerAccountInput,
        ledger_index: "validated",
      }

      let message:any = await this.xrplWebSocket.getWebsocketMessage("set-trustline", gateway_balances_request, this.testMode);

      if(message && message.status && message.status === 'success' && message.type && message.type === 'response' && message.result && message.result.obligations) {
          let tokenList:string[] = [];
          let obligations:any = message.result.obligations;
          
          if(obligations) {
              for (var currency in obligations) {
                  if (obligations.hasOwnProperty(currency)) {
                      tokenList.push(currency);
                  }
              }
          }
          
          let currencyToCheck = normalizer.getCurrencyCodeForXRPL(this.currencyCodeAsAscii);

          if(tokenList && tokenList.length > 0) {
            for(let i = 0; i < tokenList.length; i++) {
              if(tokenList[i] === currencyToCheck) {
                this.currencyExists = true;
                //console.log("currency exsists")
                break;
              }
            }
          }
      } else {                
        this.currencyExists = false;
      }
    } else {
      this.allFieldsSet = false;
    }
  }

  sendPayloadToXumm(isDirectLink?: boolean) {

    //console.log("sendPayloadToXumm: " + this.issuedCurrencyInput);

    this.googleAnalytics.analyticsEventEmitter('trust_set', 'sendToXumm', 'trust_set_component');

    let payload:XummTypes.XummPostPayloadBodyJson = {
      txjson: {
        TransactionType: "TrustSet",
        Flags: this.TRUST_SET_FLAG_SET_NO_RIPPLE
      }
    }

    payload.txjson.LimitAmount = {};
    payload.custom_meta = {};

    if(this.issuerAccountInput && this.issuerAccountInput.trim().length>0 && this.validAddress) {
      payload.txjson.LimitAmount['issuer'] = this.issuerAccountInput.trim();
      payload.custom_meta.instruction = "- Issuer Address: " +this.issuerAccountInput.trim();
    }

    if(this.issuedCurrencyInput && this.validCurrency) {
      let currencyCode = this.issuedCurrencyInput;
      if(currencyCode.length > 3) {
        while(currencyCode.length < 40)
          currencyCode+="0";
      }
      payload.txjson.LimitAmount['currency'] = currencyCode.toUpperCase();
      payload.custom_meta.instruction += "\n- Token currency code: " + this.currencyCodeAsAscii;
    }

    if(this.limitInput && this.validLimit) {
      payload.txjson.LimitAmount['value'] = normalizer.tokenNormalizer(this.limitInput.trim());
      payload.custom_meta.instruction += "\n- Limit: " + this.limitInput.trim();
    }

    if(isDirectLink) {
      payload.custom_meta.blob = {noSignIn: isDirectLink};
    }

    this.onPayload.emit(payload);
  }

  async issuerAccountChanged(isDirectLink?:boolean) {
    //console.log("issuerAccountChanged: " + this.issuedCurrencyInput);
    if(this.issuerAccountInput.trim() != this.lastKnownAddress) {
      await this.checkChanges();

      if(this.validAddress) {
        this.lastKnownAddress = this.issuerAccountInput.trim();
        //console.log("emitting issuerAccountChanged event");
        if(!isDirectLink) {
          this.issuerAccountChangedSubject.next({account: this.lastKnownAddress, mode: this.testMode});
        }
      } else if(!this.validAddress) {
        this.lastKnownAddress = null;
        this.issuerHasDefaultRipple = false;
        if(!isDirectLink) {
          this.issuerAccountChangedSubject.next({account: this.lastKnownAddress, mode: this.testMode});
        }
      }
    }
  }

  async currencyChanged() {
    await this.checkChanges();

    if(!this.validCurrency && this.lastKnownCurrency && this.validAddress) {
      //currency changed
      //console.log("send currency changed");
      this.issuerAccountChangedSubject.next({account: this.issuerAccountInput.trim(), mode: this.testMode});
    }

    //console.log("currencyChanged: " + this.issuedCurrencyInput);

  }

  async checkChanges() {
    //console.log("amountInput: " + this.amountInput);
    //console.log("destinationInput: " + this.destinationInput);
    //console.log(this.issuerAccountInput);

    this.loadingIssuerData = true;

    this.validCurrency = this.issuedCurrencyInput && this.issuedCurrencyInput.trim().length >= 3 && this.issuedCurrencyInput.length <= 40;
    this.validAddress = this.issuerAccountInput && this.issuerAccountInput.trim().length > 0 && isValidXRPAddress(this.issuerAccountInput.trim());

    if(this.validCurrency) {
      if((!this.lastKnownCurrency || this.lastKnownCurrency.trim().length == 0 ) && (!this.limitInput || this.limitInput.trim().length == 0))
        this.limitInput = "1000000";
    }

    this.lastKnownCurrency = this.issuedCurrencyInput;

    
    if(this.limitInput) {

      if(!this.limitInput.includes("e")) {
        this.validLimit = !(/[^.0-9]|\d*\.\d{16,}/.test(this.limitInput));

        if(!this.validLimit) {
          this.maxFifthteenDigits = this.limitInput.includes('.') && this.limitInput.split('.')[1].length > 15;
        } else {
          this.maxFifthteenDigits = false;
        }
      } else {
        //console.log("checking scientific notation");
        try {
          //console.log("string first: " + this.limitInput.substring(0, this.limitInput.indexOf('e')))
          //console.log("string second: " + this.limitInput.substring(this.limitInput.indexOf('e')+1))

          let first:number = Number(this.limitInput.substring(0, this.limitInput.indexOf('e')));
          let second:number = Number(this.limitInput.substring(this.limitInput.indexOf('e')+1));

          //console.log("first: " + first);
          //console.log("second: " + second);

          if(!Number.isNaN(first) && Number.isInteger(second)) {
            this.validLimit = first > 0 && first <= 9999999999999999 && second >= -96 && second <= 80
          } else {
            this.validLimit = false;
          }
        } catch(err) {
          this.validLimit = false;
        }
      }
    }

    //console.log("is valid limit: " + this.validLimit);

    if(this.validLimit)
      this.validLimit = this.limitInput && parseFloat(this.limitInput) >= 0;

    if(this.validAddress && (this.issuerAccountInput.trim() != this.lastKnownAddress)) {
      //console.log("issuerAccountInput: " +this.issuerAccountInput)
      //console.log("lastKnownAddress: " +this.lastKnownAddress)
      //load new issuer data!
      await this.loadAccountDataIssuer(this.issuerAccountInput);
    }

    await this.checkCurrencyExists();

    this.isValidTrustSet = this.validAddress && this.validCurrency && this.validLimit && this.issuerHasDefaultRipple && this.currencyExists;

    this.loadingIssuerData = false;

    this.issuedCurrencySelected = false;


    //console.log("isValidTrustSet: " + this.isValidTrustSet);
    //console.log("checkChanges: " + this.issuedCurrencyInput);
  }

  clearInputs() {
    this.issuerAccountInput = this.issuedCurrencyInput = this.limitInput = null;
    this.isValidTrustSet = this.validAddress = this.validCurrency = this.validLimit = false;
    this.lastKnownAddress = null;
    this.isEditMode = false;
    
    this.issuerAccountChangedSubject.next({account: null, mode: this.testMode});
  }

  async onTrustLineEdit(trustline:TrustLine) {
    this.isEditMode = true;
    this.issuerAccountInput = trustline.account;
    this.issuedCurrencyInput = trustline.currency;
    this.limitInput = trustline.limit;
    //console.log("onTrustLineEdit: " + this.issuedCurrencyInput);
    await this.checkChanges();
  }

  onDisableRippling(trustline:TrustLine) {
    //console.log("onDisableRippling");
    //console.log("onDisableRippling: " + this.issuedCurrencyInput);
    this.googleAnalytics.analyticsEventEmitter('trust_set', 'onDisableRippling', 'trust_set_component');

    let payload:XummTypes.XummPostPayloadBodyJson = {
      txjson: {
        TransactionType: "TrustSet",
        Flags: this.TRUST_SET_FLAG_SET_NO_RIPPLE
      }
    }

    payload.txjson.LimitAmount = {};
    payload.custom_meta = {
      instruction: "Set 'NoRipple' Flag on this TrustLine\n\n"
    };

    payload.txjson.LimitAmount['issuer'] = trustline.account;
    payload.custom_meta.instruction += "- Counterparty: " + trustline.account;

    let currencyCode = trustline.currency;
    let humanReadableCode = normalizer.normalizeCurrencyCodeXummImpl(trustline.currency);
    if(currencyCode.length > 3) {
      while(currencyCode.length < 40)
        currencyCode+="0";
    }
    payload.txjson.LimitAmount['currency'] = currencyCode;
    payload.custom_meta.instruction += "\n- Token currency code: " + humanReadableCode;

    payload.txjson.LimitAmount['value'] = trustline.limit
    payload.custom_meta.instruction += "\n- Limit: " + trustline.limit;

    payload.custom_meta.instruction += "\n- Disable Rippling: true";

    this.onPayload.emit(payload);
  }

  async onIssuedCurrencyFound(token:Token) {

    this.issuedCurrencyInput = token.currency;
    this.limitInput = token.amount;

    //console.log("onIssuedCurrencyFound: " + this.issuedCurrencyInput);

    await this.checkChanges();

    this.issuedCurrencySelected = true;

    this.showIssuedCurrencySelectedStyle = true;
    setTimeout(() => this.showIssuedCurrencySelectedStyle = false, 1000);
  }

  deleteTrustLine(trustline: TrustLine) {
    //console.log("deleteTrustLine: " + this.issuedCurrencyInput);
    this.googleAnalytics.analyticsEventEmitter('trust_set', 'deleteTrustLine', 'trust_set_component');

    let payload:XummTypes.XummPostPayloadBodyJson = {
      txjson: {
        TransactionType: "TrustSet",
        Flags: this.TRUST_SET_FLAG_SET_NO_RIPPLE
      }
    }

    payload.txjson.LimitAmount = {};
    payload.custom_meta = {
      instruction: "Deleting TrustLine\n\n"
    };

    payload.txjson.LimitAmount['issuer'] = trustline.account;
    payload.custom_meta.instruction += "- Counterparty: " + trustline.account;

    let currencyCode = trustline.currency;
    let humenReadableCode = normalizer.normalizeCurrencyCodeXummImpl(trustline.currency);
    if(currencyCode.length > 3) {
      while(currencyCode.length < 40)
        currencyCode+="0";
    }
    payload.txjson.LimitAmount['currency'] = currencyCode;
    payload.custom_meta.instruction += "\n- Token currency code: " + humenReadableCode;

    payload.txjson.LimitAmount['value'] = "0"
    payload.custom_meta.instruction += "\n- Limit: 0";

    this.onPayload.emit(payload);
  }

  async cancelEdit() {
    this.issuerAccountInput = this.limitInput = this.issuedCurrencyInput = null;
    await this.checkChanges();
    this.isEditMode = false;
  }

  get currencyCodeAsAscii() {
    return normalizer.normalizeCurrencyCodeXummImpl(this.issuedCurrencyInput);
  }

  set currencyCodeAsAscii(currency: string) {
    this.issuedCurrencyInput = normalizer.currencyCodeUTF8ToHex(currency);
  }

}
