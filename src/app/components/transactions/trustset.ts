import { Component, ViewChild, Output, EventEmitter, Input, OnInit, OnDestroy } from '@angular/core';
import { Encode } from 'xrpl-tagged-address-codec';
import { Observable, Subscription, Subject } from 'rxjs';
import { XummPostPayloadBodyJson } from 'xumm-api';
import { GoogleAnalyticsService } from '../../services/google-analytics.service';

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
  accountInfoChanged: Observable<any>;

  @Input()
  transactionSuccessfull: Observable<void>;
  
  @Output()
  onPayload: EventEmitter<XummPostPayloadBodyJson> = new EventEmitter();

  @Input()
  testMode: boolean;

  @ViewChild('inpisseraccount', {static: false}) inpisseraccount;
  issuerAccountInput: string;

  @ViewChild('inpissuedcurrency', {static: false}) inpissuedcurrency;
  issuedCurrencyInput: string;

  @ViewChild('inplimit', {static: false}) inplimit;
  limitInput: string;

  maxFifthteenDigits:boolean = false;

  originalAccountInfo:any;
  private accountInfoChangedSubscription: Subscription;
  private transactionSuccessfullSubscription: Subscription;
  issuerAccountChanged: Subject<string> = new Subject<string>();

  showIssuedCurrencySelectedStyle:boolean = false;
  issuedCurrencySelected:boolean = false;
  
  isValidTrustSet:boolean = false;
  validAddress:boolean = false;
  validCurrency:boolean = false;
  validLimit:boolean = false;

  lastKnownAddress:string = null;
  lastKnownCurrency:string = null;

  private payload:XummPostPayloadBodyJson = {
    txjson: {
      TransactionType: "TrustSet",
      Flags: this.TRUST_SET_FLAG_SET_NO_RIPPLE
    }
  }

  ngOnInit() {
    this.accountInfoChangedSubscription = this.accountInfoChanged.subscribe(accountData => {
      //console.log("account info changed received")
      this.originalAccountInfo = accountData;
      setTimeout(() => {
        this.issuerAccountChanged.next(this.lastKnownAddress);
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
  }

  sendPayloadToXumm() {

    this.googleAnalytics.analyticsEventEmitter('trust_set', 'sendToXumm', 'trust_set_component');

    this.payload.txjson.LimitAmount = {};
    this.payload.custom_meta = {};

    if(this.issuerAccountInput && this.issuerAccountInput.trim().length>0 && this.validAddress) {
      this.payload.txjson.LimitAmount.issuer = this.issuerAccountInput.trim();
      this.payload.custom_meta.instruction = "- Issuer Address: " +this.issuerAccountInput.trim();
    }

    if(this.issuedCurrencyInput && this.validCurrency) {
      this.payload.txjson.LimitAmount.currency = this.issuedCurrencyInput.trim();
      this.payload.custom_meta.instruction += "\n- IOU currency code: " + this.issuedCurrencyInput.trim();
    }

    if(this.limitInput && this.validLimit) {
      this.payload.txjson.LimitAmount.value = this.limitInput.trim()
      this.payload.custom_meta.instruction += "\n- Limit: " + this.limitInput.trim();
    }

    this.onPayload.emit(this.payload);
  }

  xrplAccountChanged() {
    this.checkChanges();

    if(this.validAddress && (this.issuerAccountInput.trim() != this.lastKnownAddress)) {
      this.lastKnownAddress = this.issuerAccountInput.trim();
      //console.log("emitting issuerAccountChanged event");
      this.issuerAccountChanged.next(this.lastKnownAddress);
    } else if(!this.validAddress) {
      this.lastKnownAddress = null;
      this.issuerAccountChanged.next(null);
    }
  }

  sequenceChanged() {
    this.checkChanges();

    if(!this.validCurrency && this.lastKnownCurrency && this.validAddress) {
      //sequence change
      console.log("send sequence changed");
      this.issuerAccountChanged.next(this.issuerAccountInput.trim());
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
      this.validLimit = this.limitInput && parseFloat(this.limitInput) >= 0.000000000000001;

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
    
    this.issuerAccountChanged.next(null);
  }

  onIssuedCurrencyFound(iou:any) {
    this.issuedCurrencyInput = iou.currency;
    this.checkChanges();

    this.issuedCurrencySelected = true;

    this.showIssuedCurrencySelectedStyle = true;
    setTimeout(() => this.showIssuedCurrencySelectedStyle = false, 1000);
  }
}
