import { Component, OnInit, ViewChild, Output, EventEmitter, Input, OnDestroy } from '@angular/core';
import { Encode } from 'xrpl-tagged-address-codec';
import { Subscription, Observable } from 'rxjs';
import * as flagsutil from '../../utils/flagutils';
import { XummPostPayloadBodyJson } from 'xumm-sdk';
import { GoogleAnalyticsService } from '../../services/google-analytics.service';
import { AccountInfoChanged, AccountObjectsChanged } from 'src/app/utils/types';

@Component({
  selector: 'setregularkey',
  templateUrl: './setregularkey.html'
})
export class SetRegularKeyComponent implements OnInit, OnDestroy {

  constructor(private googleAnalytics: GoogleAnalyticsService) { }

  @Input()
  accountInfoChanged: Observable<AccountInfoChanged>;

  @Input()
  accountObjectsChanged: Observable<AccountObjectsChanged>;

  @Input()
  transactionSuccessfull: Observable<void>;

  @Output()
  onPayload: EventEmitter<XummPostPayloadBodyJson> = new EventEmitter();

  @ViewChild('inpregularkey') inpregularkey;
  regularKeyInput: string;

  private accountInfoChangedSubscription: Subscription;
  private accountObjectsChangedSubscription: Subscription;
  originalAccountInfo:any;
  originalAccountObjects:any;

  private transactionSuccessfullSubscription: Subscription;

  validAddress = false;

  private payload:XummPostPayloadBodyJson = {
    txjson: {
      TransactionType: "SetRegularKey"
    }
  }

  ngOnInit() {
    this.accountInfoChangedSubscription = this.accountInfoChanged.subscribe(accountData => {
      //console.log("account info changed received")
      this.originalAccountInfo = accountData.info;

      if(this.originalAccountInfo && this.originalAccountInfo.RegularKey) {
        this.regularKeyInput = this.originalAccountInfo.RegularKey;
        this.checkChanges();
      } else {
        this.clearInputs();
      }
    });

    this.accountObjectsChangedSubscription = this.accountObjectsChanged.subscribe(accountObjects => {
      //console.log("account objects changed received")
      this.originalAccountObjects = accountObjects.object;
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

    this.googleAnalytics.analyticsEventEmitter('set_regular_key', 'sendToXumm', 'set_regular_key_component');

    if(this.regularKeyInput && this.regularKeyInput.trim().length>0 && this.validAddress) {
      this.payload.txjson.RegularKey = this.regularKeyInput.trim();
      this.payload.custom_meta = {}
      this.payload.custom_meta.instruction = "Set RegularKey to: " + this.regularKeyInput.trim();
    }

    this.onPayload.emit(this.payload);
  }

  checkChanges() {   
    this.validAddress = this.regularKeyInput && this.regularKeyInput.trim().length > 0 && this.isValidXRPAddress(this.regularKeyInput.trim());

    //console.log("validAddress: " + this.validAddress);
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
    return (this.originalAccountInfo && !flagsutil.isMasterKeyDisabled(this.originalAccountInfo.Flags)) || (this.originalAccountObjects && (this.originalAccountObjects[0] && this.originalAccountObjects[0].LedgerEntryType === "SignerList" && this.originalAccountObjects[0].SignerEntries.length > 0));
  }

  clearInputs() {
    this.regularKeyInput = null;
    this.payload = {
      txjson: {
        TransactionType: "SetRegularKey"
      }
    }
  }

  deleteRegularKey() {
    this.googleAnalytics.analyticsEventEmitter('delete_regular_key', 'sendToXumm', 'set_regular_key_component');
    let payloadToSend:XummPostPayloadBodyJson = {
      txjson: {
        TransactionType: "SetRegularKey"
      },
      custom_meta: {
        instruction: 'Delete Regular Key.'
      }
    }
    this.onPayload.emit(payloadToSend);
  }
}
