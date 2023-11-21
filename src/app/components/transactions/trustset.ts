import { Component, ViewChild, Output, EventEmitter, Input, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { Observable, Subscription, Subject } from 'rxjs';
import { XummTypes } from 'xumm-sdk';
import { AccountInfoChanged, XrplAccountChanged, Token, SimpleTrustLine, XrplCurrency, AccountObjectsChanged } from 'src/app/utils/types';
import * as normalizer from '../../utils/normalizers';
import { ActivatedRoute } from '@angular/router';
import { MatExpansionPanel } from '@angular/material/expansion';
import { isValidXRPAddress } from 'src/app/utils/utils';
import { XRPLWebsocket } from 'src/app/services/xrplWebSocket';
import * as flagUtil from '../../utils/flagutils'
import { AppService } from 'src/app/services/app.service';

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
              private app: AppService,
              private route: ActivatedRoute) { }

  @Input()
  accountInfoChanged: Observable<AccountInfoChanged>;

  @Input()
  accountObjectsChanged: Observable<AccountObjectsChanged>;

  @Input()
  transactionSuccessfull: Observable<any>;
  
  @Output()
  onPayload: EventEmitter<XummTypes.XummPostPayloadBodyJson> = new EventEmitter();

  @ViewChild('inpisseraccount') inpisseraccount;
  issuerAccountInput: string;

  @ViewChild('inplimit') inplimit;
  limitInput: string;

  @ViewChild('mep') mep: MatExpansionPanel

  selectedCurrency: XrplCurrency;

  maxFifthteenDigits:boolean = false;

  originalAccountInfo:any;
  testMode:boolean = false;

  private accountInfoChangedSubscription: Subscription;
  private accountObjectsChangedSubscription: Subscription;
  private transactionSuccessfullSubscription: Subscription;
  issuerAccountChangedSubject: Subject<XrplAccountChanged> = new Subject<XrplAccountChanged>();
  xrplAccountInfoChangedSubject: Subject<AccountInfoChanged> = new Subject<AccountInfoChanged>();
  trustlinesChangedSubject: Subject<AccountObjectsChanged> = new Subject<AccountObjectsChanged>();

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
  ignoreWarning:boolean = false

  allFieldsSet:boolean = false;

  isEditMode:boolean = false;

  async ngOnInit() {
    this.accountInfoChangedSubscription = this.accountInfoChanged.subscribe(async accountData => {
      //console.log("account info changed received: " + JSON.stringify(accountData));
      this.originalAccountInfo = accountData.info;
      this.testMode = accountData.mode;

      await this.checkChanges(true);

      this.xrplAccountInfoChangedSubject.next(accountData);
      
      setTimeout(() => {
        this.issuerAccountChangedSubject.next({account: this.lastKnownAddress, mode: this.testMode});
      },500);
    });

    this.accountObjectsChangedSubscription = this.accountObjectsChanged.subscribe(accountObjects => {
      //console.log("account objects changed received")
      if(accountObjects && accountObjects.objects) {
        let allTrustlines = accountObjects.objects.filter(object => object.LedgerEntryType === "RippleState");
        this.trustlinesChangedSubject.next({objects: allTrustlines, mode: accountObjects.mode});
      } else {
        this.trustlinesChangedSubject.next({objects: null, mode: accountObjects.mode});
      }
    });

    //this.transactionSuccessfullSubscription = this.transactionSuccessfull.subscribe(() => {
    //  this.clearInputs()
    //});

    this.route.queryParams.subscribe(async params => {
      if(params.issuer && params.currency && params.limit) {

        this.issuerAccountInput = params.issuer;
        //console.log("subscribe received: " + params.currency);

        this.selectedCurrency = {
          currencyCode: normalizer.getCurrencyCodeForXRPL(params.currency),
          currencyCodeUTF8: normalizer.normalizeCurrencyCodeXummImpl(params.currency)
        }

       //console.log("subscribe set: " + JSON.stringify(this.selectedCurrency));
        this.limitInput = params.limit;

        if(params && ((params.testmode && params.testmode.toLowerCase() === 'true') || (params.testnet && params.testnet.toLowerCase() === 'true') || (params.test && params.test.toLowerCase() === 'true'))) {
          this.testMode = true;
        }

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
    if(this.issuerAccountInput != null && this.selectedCurrency != null && this.limitInput != null)
      this.mep.open();
  }

  ngOnDestroy() {
    if(this.accountInfoChangedSubscription)
      this.accountInfoChangedSubscription.unsubscribe();

    if(this.accountObjectsChangedSubscription)
      this.accountObjectsChangedSubscription.unsubscribe();

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
      //console.log("xahau-transactions account info: " + JSON.stringify(message_acc_info));
      //this.infoLabel = JSON.stringify(message_acc_info);
      if(message_acc_info && message_acc_info.status && message_acc_info.type && message_acc_info.type === 'response') {
        if(message_acc_info.status === 'success' && message_acc_info.result && message_acc_info.result.account_data) {
          let issuer_account_info = message_acc_info.result.account_data;

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
    if(this.issuerAccountInput && this.selectedCurrency && this.selectedCurrency.currencyCode && this.limitInput && isValidXRPAddress(this.issuerAccountInput)) {

      this.allFieldsSet = true;

      try {
        if(!this.testMode) {
          let xrpscanResponse:any = await this.app.get("https://api.xrpscan.com/api/v1/account/"+this.issuerAccountInput+"/obligations?origin=https://xahau.services")
              
          let currencyToCheck = this.selectedCurrency.currencyCode;

          if(xrpscanResponse && xrpscanResponse.length > 0) {
            for(let i = 0; i < xrpscanResponse.length; i++) {
              if(xrpscanResponse[i].currency === currencyToCheck && parseFloat(xrpscanResponse[i].value) > 0) {
                this.currencyExists = true;
                //console.log("currency exsists")
                break;
              }
            }
          }
        } else {
          //use old method on test net
          //settings ok, now check for the actual currenxy!
          let gateway_balances_request:any = {
            command: "gateway_balances",
            account: this.issuerAccountInput,
            ledger_index: "validated",
          }

          let message:any = await this.xrplWebSocket.getWebsocketMessage("set-trustline-gateway", gateway_balances_request, this.testMode);

          console.log("gateway message: " + JSON.stringify(message));
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
              
              let currencyToCheck = this.selectedCurrency.currencyCode;
              console.log("currencyToCheck: " + currencyToCheck);
              console.log("tokenList: " + JSON.stringify(tokenList));

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
        }
      } catch(err) {
        console.log(err);
        //set to true in case of error!
        this.currencyExists = true;
      }
    } else {
      this.allFieldsSet = false;
    }
  }

  sendPayloadToXumm(isDirectLink?: boolean) {

    //console.log("sendPayloadToXumm: " + this.issuedCurrencyInput);

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

    if(this.selectedCurrency && this.selectedCurrency.currencyCode && this.validCurrency) {
      let currencyCode = this.selectedCurrency.currencyCode;
      if(currencyCode.length > 3) {
        while(currencyCode.length < 40)
          currencyCode+="0";

        currencyCode = currencyCode.toUpperCase();
      }

      payload.txjson.LimitAmount['currency'] = currencyCode;
      payload.custom_meta.instruction += "\n- Token currency code: " + this.selectedCurrency.currencyCodeUTF8;
    }

    if(this.limitInput && this.validLimit) {
      payload.txjson.LimitAmount['value'] = normalizer.tokenNormalizer(this.limitInput.trim());
      payload.custom_meta.instruction += "\n- Limit: " + this.limitInput.trim();
    }

    if(isDirectLink) {
      payload.custom_meta.blob = {noSignIn: isDirectLink};
    }

    if(this.selectedCurrency.currencyCodeUTF8.toLowerCase().includes("xum")) {
      payload.custom_meta.blob = {addWarningXumm: true};
    }

    this.onPayload.emit(payload);
  }

  async issuerAccountChanged(isDirectLink?:boolean) {
    //console.log("issuerAccountChanged: " + this.issuedCurrencyInput);
    if(this.issuerAccountInput && this.issuerAccountInput.trim() != this.lastKnownAddress) {
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

  async checkChanges(modeChanged? :boolean) {
    //console.log(this.issuerAccountInput);

    this.loadingIssuerData = true;

    this.validCurrency = this.selectedCurrency && this.selectedCurrency.currencyCode && this.selectedCurrency.currencyCode.trim().length >= 3 && this.selectedCurrency.currencyCode.length <= 40;
    this.validAddress = this.issuerAccountInput && this.issuerAccountInput.trim().length > 0 && isValidXRPAddress(this.issuerAccountInput.trim());

    if(this.validCurrency) {
      if((!this.lastKnownCurrency || this.lastKnownCurrency.trim().length == 0 ) && (!this.limitInput || this.limitInput.trim().length == 0))
        this.limitInput = "1000000";
    }

    this.lastKnownCurrency = this.selectedCurrency ? this.selectedCurrency.currencyCode : null;

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

    if(this.validAddress && (this.issuerAccountInput.trim() != this.lastKnownAddress || modeChanged)) {
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
    this.issuerAccountInput = this.selectedCurrency = this.limitInput = null;
    this.isValidTrustSet = this.validAddress = this.validCurrency = this.validLimit = false;
    this.lastKnownAddress = null;
    this.isEditMode = false;
    
    this.issuerAccountChangedSubject.next({account: null, mode: this.testMode});
  }

  async onTrustLineEdit(trustline:SimpleTrustLine) {
    this.isEditMode = true;
    this.issuerAccountInput = trustline.account;
    this.selectedCurrency = {
      currencyCode: trustline.currency,
      currencyCodeUTF8: trustline.currencyN
    }
    this.limitInput = trustline.limit;
    //console.log("onTrustLineEdit: " + this.issuedCurrencyInput);
    await this.checkChanges();
  }

  onDisableRippling(trustline:SimpleTrustLine) {
    //console.log("onDisableRippling");
    //console.log("onDisableRippling: " + this.issuedCurrencyInput);

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
    let humanReadableCode = trustline.currencyN;
    if(currencyCode.length > 3) {
      while(currencyCode.length < 40)
        currencyCode+="0";

      currencyCode = currencyCode.toUpperCase();
    }
    payload.txjson.LimitAmount['currency'] = currencyCode;
    payload.custom_meta.instruction += "\n- Token currency code: " + humanReadableCode;

    payload.txjson.LimitAmount['value'] = trustline.limit
    payload.custom_meta.instruction += "\n- Limit: " + trustline.limit;

    payload.custom_meta.instruction += "\n- Disable Rippling: true";

    this.onPayload.emit(payload);
  }

  async onIssuedCurrencyFound(token:Token) {

    this.selectedCurrency = {
      currencyCode: normalizer.getCurrencyCodeForXRPL(token.currency),
      currencyCodeUTF8: normalizer.normalizeCurrencyCodeXummImpl(token.currency)
    }

    this.limitInput = token.amount+"";

    //console.log("onIssuedCurrencyFound: " + this.issuedCurrencyInput);

    await this.checkChanges();

    this.issuedCurrencySelected = true;

    this.showIssuedCurrencySelectedStyle = true;
    setTimeout(() => this.showIssuedCurrencySelectedStyle = false, 1000);
  }

  deleteTrustLine(trustline: SimpleTrustLine) {
    //console.log("deleteTrustLine: " + this.issuedCurrencyInput);

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
    let humenReadableCode = trustline.currencyN;
    if(currencyCode.length > 3) {
      while(currencyCode.length < 40)
        currencyCode+="0";

      currencyCode = currencyCode.toUpperCase();
    }
    payload.txjson.LimitAmount['currency'] = currencyCode;
    payload.custom_meta.instruction += "\n- Token currency code: " + humenReadableCode;

    payload.txjson.LimitAmount['value'] = "0"
    payload.custom_meta.instruction += "\n- Limit: 0";

    this.onPayload.emit(payload);
  }

  async cancelEdit() {
    this.issuerAccountInput = this.limitInput = this.selectedCurrency = null;
    await this.checkChanges();
    this.isEditMode = false;
  }
}
