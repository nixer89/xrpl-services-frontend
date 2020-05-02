import { Component, ViewChild, Output, EventEmitter, Input, OnInit, OnDestroy } from '@angular/core';
import { Encode } from 'xrpl-tagged-address-codec';
import { Observable, Subscription, Subject } from 'rxjs';
import { XummPostPayloadBodyJson } from 'xumm-api';
import { GoogleAnalyticsService } from '../../services/google-analytics.service';
import { AccountInfoChanged, XrplAccountChanged } from 'src/app/utils/types';

@Component({
  selector: 'trustset',
  templateUrl: './trustset.html'
})
export class TrustSetComponent implements OnInit, OnDestroy {

  private TRUST_SET_FLAG_SET_NO_RIPPLE:number = 131072;
  private TRUST_SET_FLAG_CLEAR_NO_RIPPLE:number = 262144;
  private TRUST_SET_FLAG_SET_FREEZE:number = 1048576;
  private TRUST_SET_FLAG_CLEAR_FREEZE:number = 2097152;

  constructor(private googleAnalytics: GoogleAnalyticsService) { }

  @Input()
  accountInfoChanged: Observable<AccountInfoChanged>;

  @Input()
  transactionSuccessfull: Observable<any>;
  
  @Output()
  onPayload: EventEmitter<XummPostPayloadBodyJson> = new EventEmitter();

  @ViewChild('inpisseraccount', {static: false}) inpisseraccount;
  issuerAccountInput: string;

  @ViewChild('inpissuedcurrency', {static: false}) inpissuedcurrency;
  issuedCurrencyInput: string;

  @ViewChild('inplimit', {static: false}) inplimit;
  limitInput: string;

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

  isEditMode:boolean = false;

  ngOnInit() {
    this.accountInfoChangedSubscription = this.accountInfoChanged.subscribe(accountData => {
      console.log("account info changed received: " + JSON.stringify(accountData));
      this.originalAccountInfo = accountData.info;
      this.testMode = accountData.mode;

      if(this.originalAccountInfo && this.originalAccountInfo.Account)
        this.xrplAccountInfoChangedSubject.next(accountData);
      else
        this.xrplAccountInfoChangedSubject.next(null);
      setTimeout(() => {
        this.issuerAccountChangedSubject.next({account: this.lastKnownAddress, mode: this.testMode});
      },500);
    });

    this.transactionSuccessfullSubscription = this.transactionSuccessfull.subscribe(() => {
      this.clearInputs()
    });
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

  sendPayloadToXumm() {

    this.googleAnalytics.analyticsEventEmitter('trust_set', 'sendToXumm', 'trust_set_component');

    let payload:XummPostPayloadBodyJson = {
      txjson: {
        TransactionType: "TrustSet",
        Flags: this.TRUST_SET_FLAG_SET_NO_RIPPLE
      }
    }

    payload.txjson.LimitAmount = {};
    payload.custom_meta = {};

    if(this.issuerAccountInput && this.issuerAccountInput.trim().length>0 && this.validAddress) {
      payload.txjson.LimitAmount.issuer = this.issuerAccountInput.trim();
      payload.custom_meta.instruction = "- Issuer Address: " +this.issuerAccountInput.trim();
    }

    if(this.issuedCurrencyInput && this.validCurrency) {
      payload.txjson.LimitAmount.currency = this.issuedCurrencyInput.trim();
      payload.custom_meta.instruction += "\n- IOU currency code: " + this.issuedCurrencyInput.trim();
    }

    if(this.limitInput && this.validLimit) {
      payload.txjson.LimitAmount.value = this.limitInput.trim()
      payload.custom_meta.instruction += "\n- Limit: " + this.limitInput.trim();
    }

    this.onPayload.emit(payload);
  }

  issuerAccountChanged() {
    this.checkChanges();

    if(this.validAddress && (this.issuerAccountInput.trim() != this.lastKnownAddress)) {
      this.lastKnownAddress = this.issuerAccountInput.trim();
      //console.log("emitting issuerAccountChanged event");
      this.issuerAccountChangedSubject.next({account: this.lastKnownAddress, mode: this.testMode});
    } else if(!this.validAddress) {
      this.lastKnownAddress = null;
      this.issuerAccountChangedSubject.next({account: this.lastKnownAddress, mode: this.testMode});
    }
  }

  currencyChanged() {
    this.checkChanges();

    if(!this.validCurrency && this.lastKnownCurrency && this.validAddress) {
      //currency changed
      console.log("send currency changed");
      this.issuerAccountChangedSubject.next({account: this.issuerAccountInput.trim(), mode: this.testMode});
    }

  }

  checkChanges() {
    //console.log("amountInput: " + this.amountInput);
    //console.log("destinationInput: " + this.destinationInput);
    //console.log(this.issuerAccountInput);

    this.validCurrency = this.issuedCurrencyInput && this.issuedCurrencyInput.trim().length > 0;
    this.validAddress = this.issuerAccountInput && this.issuerAccountInput.trim().length > 0 && this.isValidXRPAddress(this.issuerAccountInput.trim());

    if(this.validCurrency) {
      if((!this.lastKnownCurrency || this.lastKnownCurrency.trim().length == 0 ) && (!this.limitInput || this.limitInput.trim().length == 0))
        this.limitInput = "1000000";
    }

    this.lastKnownCurrency = this.issuedCurrencyInput;

    
    if(this.limitInput) {
      this.validLimit = !(/[^.0-9]|\d*\.\d{16,}/.test(this.limitInput));

      if(!this.validLimit) {
        this.maxFifthteenDigits = this.limitInput.includes('.') && this.limitInput.split('.')[1].length > 15;
      } else {
        this.maxFifthteenDigits = false;
      }
    }

    if(this.validLimit)
      this.validLimit = this.limitInput && parseFloat(this.limitInput) >= 0;

    this.isValidTrustSet = this.validAddress && this.validCurrency && this.validLimit;

    this.issuedCurrencySelected = false;


    //console.log("isValidTrustSet: " + this.isValidTrustSet);
  }

  isValidXRPAddress(address: string): boolean {
    try {
      //console.log("encoding address: " + address);
      let xAddress = Encode({account: address});
      //console.log("xAddress: " + xAddress);
      return xAddress && xAddress.length > 0;
    } catch(err) {
      //no valid address
      //console.log("err encoding " + err);
      return false;
    }
  }

  clearInputs() {
    this.issuerAccountInput = this.issuedCurrencyInput = this.limitInput = null;
    this.isValidTrustSet = this.validAddress = this.validCurrency = this.validLimit = false;
    this.lastKnownAddress = null;
    this.isEditMode = false;
    
    this.issuerAccountChangedSubject.next({account: null, mode: this.testMode});
  }

  onTrustLineEdit(trustline:any) {
    this.isEditMode = true;
    this.issuerAccountInput = trustline.account;
    this.issuedCurrencyInput = trustline.currency;
    this.limitInput = trustline.limit;
    this.checkChanges();
  }

  onDisableRippling(trustline:any) {
    console.log("onDisableRippling");
    this.googleAnalytics.analyticsEventEmitter('trust_set', 'onDisableRippling', 'trust_set_component');

    let payload:XummPostPayloadBodyJson = {
      txjson: {
        TransactionType: "TrustSet",
        Flags: this.TRUST_SET_FLAG_SET_NO_RIPPLE
      }
    }

    payload.txjson.LimitAmount = {};
    payload.custom_meta = {
      instruction: "Set 'NoRipple' Flag on this TrustLine\n\n"
    };

    payload.txjson.LimitAmount.issuer = trustline.account;
    payload.custom_meta.instruction += "- Counterparty: " + trustline.account;

    payload.txjson.LimitAmount.currency = trustline.currency;
    payload.custom_meta.instruction += "\n- IOU currency code: " + trustline.currency;

    payload.txjson.LimitAmount.value = trustline.limit
    payload.custom_meta.instruction += "\n- Limit: " + trustline.limit;

    payload.custom_meta.instruction += "\n- Disable Rippling: true";

    this.onPayload.emit(payload);
  }

  onIssuedCurrencyFound(iou:any) {
    this.issuedCurrencyInput = iou.currency;
    this.checkChanges();

    this.issuedCurrencySelected = true;

    this.showIssuedCurrencySelectedStyle = true;
    setTimeout(() => this.showIssuedCurrencySelectedStyle = false, 1000);
  }

  deleteTrustLine(trustline: any) {
    this.googleAnalytics.analyticsEventEmitter('trust_set', 'deleteTrustLine', 'trust_set_component');

    let payload:XummPostPayloadBodyJson = {
      txjson: {
        TransactionType: "TrustSet",
        Flags: this.TRUST_SET_FLAG_SET_NO_RIPPLE
      }
    }

    payload.txjson.LimitAmount = {};
    payload.custom_meta = {
      instruction: "Deleting TrustLine\n\n"
    };

    payload.txjson.LimitAmount.issuer = trustline.account;
    payload.custom_meta.instruction += "- Counterparty: " + trustline.account;

    payload.txjson.LimitAmount.currency = trustline.currency;
    payload.custom_meta.instruction += "\n- IOU currency code: " + trustline.currency;

    payload.txjson.LimitAmount.value = "0"
    payload.custom_meta.instruction += "\n- Limit: 0";

    this.onPayload.emit(payload);
  }

  cancelEdit() {
    this.issuerAccountInput = this.limitInput = this.issuedCurrencyInput = null;
    this.checkChanges();
    this.isEditMode = false;
  }
}
