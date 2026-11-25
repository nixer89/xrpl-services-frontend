import { Component, OnInit, ViewChild, Output, EventEmitter, Input, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { Subscription, Observable } from 'rxjs';
import * as flagsutil from '../../utils/flagutils';
import { XummTypes } from 'xumm-sdk';
import { AccountInfoChanged, AccountObjectsChanged } from '../../utils/types';
import { isValidXRPAddress } from '../../utils/utils';

@Component({
    selector: 'setregularkey',
    templateUrl: './setregularkey.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class SetRegularKeyComponent implements OnInit, OnDestroy {

  @Input()
  accountInfoChanged: Observable<AccountInfoChanged>;

  @Input()
  accountObjectsChanged: Observable<AccountObjectsChanged>;

  @Input()
  transactionSuccessfull: Observable<void>;

  @Output()
  onPayload: EventEmitter<XummTypes.XummPostPayloadBodyJson> = new EventEmitter();

  @ViewChild('inpregularkey') inpregularkey;
  regularKeyInput: string;

  private accountInfoChangedSubscription: Subscription;
  private accountObjectsChangedSubscription: Subscription;
  originalAccountInfo:any;
  signerList:any;

  private transactionSuccessfullSubscription: Subscription;

  validAddress = false;

  private payload:XummTypes.XummPostPayloadBodyJson = {
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
      if(accountObjects && accountObjects.objects) {
        this.signerList = accountObjects.objects.filter(object => object.LedgerEntryType === "SignerList")[0];
      } else {
        this.signerList = null;
      }
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

    if(this.regularKeyInput && this.regularKeyInput.trim().length>0 && this.validAddress) {
      this.payload.txjson.RegularKey = this.regularKeyInput.trim();
      this.payload.custom_meta = {}
      this.payload.custom_meta.instruction = "Set RegularKey to: " + this.regularKeyInput.trim();
    }

    //send a copy: the dialog changes the object (memo, account, options) and it must not be reused for the next try
    this.onPayload.emit(JSON.parse(JSON.stringify(this.payload)));
  }

  checkChanges() {   
    this.validAddress = this.regularKeyInput && this.regularKeyInput.trim().length > 0 && isValidXRPAddress(this.regularKeyInput.trim());

    //console.log("validAddress: " + this.validAddress);
  }

  hasAlternativeSigningMethod() {
    return (this.originalAccountInfo && !flagsutil.isMasterKeyDisabled(this.originalAccountInfo.Flags)) || (this.signerList && this.signerList.SignerEntries && this.signerList.SignerEntries.length > 0);
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
    
    let payloadToSend:XummTypes.XummPostPayloadBodyJson = {
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
