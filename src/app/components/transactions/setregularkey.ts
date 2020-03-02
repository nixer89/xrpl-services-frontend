import { Component, OnInit, ViewChild, Output, EventEmitter, Input, OnDestroy } from '@angular/core';
import { Encode } from 'xrpl-tagged-address-codec';
import { Subscription, Observable } from 'rxjs';
import * as flagsutil from '../../utils/flagutils';
import { XummPostPayloadBodyJson } from 'xumm-api';
import { GoogleAnalyticsService } from '../../services/google-analytics.service';

@Component({
  selector: 'setregularkey',
  templateUrl: './setregularkey.html'
})
export class SetRegularKeyComponent implements OnInit, OnDestroy {

  constructor(private googleAnalytics: GoogleAnalyticsService) { }

  @Input()
  accountInfoChanged: Observable<any>;

  @Input()
  accountObjectsChanged: Observable<any>;

  @Input()
  transactionSuccessfull: Observable<void>;

  @Output()
  onPayload: EventEmitter<any> = new EventEmitter();

  @ViewChild('inpregularkey', {static: false}) inpregularkey;
  regularKeyInput: string;

  private accountInfoChangedSubscription: Subscription;
  private accountObjectsChangedSubscription: Subscription;
  originalAccountInfo:any;
  originalAccountObjects:any;

  private transactionSuccessfullSubscription: Subscription;

  validAddress = false;

  private payload:XummPostPayloadBodyJson = {
    options: {
      expire: 5
    },
    txjson: {
      TransactionType: "SetRegularKey"
    }
  }

  ngOnInit() {
    this.accountInfoChangedSubscription = this.accountInfoChanged.subscribe(accountData => {
      //console.log("account info changed received")
      this.originalAccountInfo = accountData;
      if(this.originalAccountInfo && this.originalAccountInfo.RegularKey) {
        this.regularKeyInput = this.originalAccountInfo.RegularKey;
        this.checkChanges();
      } else {
        this.clearInputs();
      }
    });

    this.accountObjectsChangedSubscription = this.accountObjectsChanged.subscribe(accountObjects => {
      //console.log("account objects changed received")
      this.originalAccountObjects = accountObjects;
    });

    this.transactionSuccessfullSubscription = this.transactionSuccessfull.subscribe(() => {
      this.clearInputs()
    });
  }

  ngOnDestroy() {
    if(this.transactionSuccessfullSubscription)
      this.transactionSuccessfullSubscription.unsubscribe();

    if(this.accountInfoChangedSubscription)
      this.accountInfoChangedSubscription.unsubscribe();

    if(this.accountObjectsChangedSubscription)
      this.accountObjectsChangedSubscription.unsubscribe();
  }

  sendPayloadToXumm() {

    this.googleAnalytics.analyticsEventEmitter('set_regular_key', 'sendToXumm', 'set_regular_key');

    if(this.regularKeyInput && this.regularKeyInput.trim().length>0 && this.validAddress)
      this.payload.txjson.RegularKey = this.regularKeyInput.trim();

    this.onPayload.emit(this.payload);
  }

  checkChanges() {
    //console.log("amountInput: " + this.amountInput);
    //console.log("destinationInput: " + this.destinationInput);
    
    this.validAddress = this.regularKeyInput && this.regularKeyInput.trim().length > 0 && this.isValidXRPAddress(this.regularKeyInput.trim());

    //console.log("isValidEscrowCancel: " + this.isValidEscrowCancel);
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

  hasAlternativeSigningMethod() {
    return this.originalAccountInfo && this.originalAccountObjects && (!flagsutil.isMasterKeyDisabled(this.originalAccountInfo.Flags) || (this.originalAccountObjects[0] && this.originalAccountObjects[0].LedgerEntryType === "SignerList" && this.originalAccountObjects[0].SignerEntries.length > 0));
  }

  clearInputs() {
    this.regularKeyInput = null;
    this.payload = {
      options: {
        expire: 5
      },
      txjson: {
        TransactionType: "SetRegularKey"
      }
    }
  }

  deleteRegularKey() {
    this.googleAnalytics.analyticsEventEmitter('delete_regular_key', 'sendToXumm', 'set_regular_key_component');
    this.onPayload.emit({
      options: {
        expire: 5
      },
      txjson: {
        TransactionType: "SetRegularKey"
      }
    });
  }
}
