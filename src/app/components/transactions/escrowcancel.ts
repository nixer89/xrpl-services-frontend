import { Component, OnInit, ViewChild, Output, EventEmitter, Input, OnDestroy } from '@angular/core';
import { Encode } from 'xrpl-tagged-address-codec';
import { Subscription, Observable, Subject } from 'rxjs';
import { XummPostPayloadBodyJson } from 'xumm-api';
import { GoogleAnalyticsService } from '../../services/google-analytics.service';

@Component({
  selector: 'escrowcancel',
  templateUrl: './escrowcancel.html'
})
export class EscrowCancelComponent implements OnInit, OnDestroy {

  constructor(private googleAnalytics: GoogleAnalyticsService) { }

  @Input()
  accountInfoChanged: Observable<any>;

  @Input()
  transactionSuccessfull: Observable<void>;

  @Output()
  onPayload: EventEmitter<XummPostPayloadBodyJson> = new EventEmitter();

  @ViewChild('inpescrowowner', {static: false}) inpescrowowner;
  escrowOwnerInput: string;

  @ViewChild('inpescrowsequence', {static: false}) inpescrowsequence;
  escrowSequenceInput: any;

  @Input()
  testMode: boolean;

  originalAccountInfo:any;
  private accountInfoChangedSubscription: Subscription;
  private transactionSuccessfullSubscription: Subscription;
  escrowAccountChanged: Subject<any> = new Subject<any>();

  isValidEscrowCancel = false;
  validAddress = false;
  validSequence = false;
  
  lastKnownAddress:string = null;

  escrowSequenceSelected:boolean = false;

  private payload:XummPostPayloadBodyJson = {
    options: {
      expire: 5
    },
    txjson: {
      TransactionType: "EscrowCancel"
    }
  }

  ngOnInit() {
    this.accountInfoChangedSubscription = this.accountInfoChanged.subscribe(accountData => {
      //console.log("account info changed received")
      this.originalAccountInfo = accountData;
      setTimeout(() => {
        this.escrowAccountChanged.next(this.lastKnownAddress);
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
    this.googleAnalytics.analyticsEventEmitter('escrow_cancel', 'sendToXumm', 'escrow_cancel_component');

    if(this.escrowOwnerInput && this.escrowOwnerInput.trim().length>0 && this.validAddress)
      this.payload.txjson.Owner = this.escrowOwnerInput.trim();

    if(this.escrowSequenceInput && this.validSequence)
      this.payload.txjson.OfferSequence = Number(this.escrowSequenceInput);

    this.onPayload.emit(this.payload);
  }

  checkChanges() {
    //console.log("amountInput: " + this.amountInput);
    //console.log("destinationInput: " + this.destinationInput);
    
    this.validSequence = this.escrowSequenceInput && Number.isInteger(Number(this.escrowSequenceInput));
    this.validAddress = this.escrowOwnerInput && this.escrowOwnerInput.trim().length > 0 && this.isValidXRPAddress(this.escrowOwnerInput.trim());

    if(this.validAddress && (this.escrowOwnerInput.trim() != this.lastKnownAddress)) {
      this.lastKnownAddress = this.escrowOwnerInput.trim();
      //console.log("emitting escrowAccountChanged event");
      this.escrowAccountChanged.next(this.lastKnownAddress);
    } else if(!this.validAddress) {
      this.lastKnownAddress = null;
      this.escrowAccountChanged.next(null);
    }

    this.isValidEscrowCancel = this.validAddress && this.validSequence;

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

  clearInputs() {
    this.escrowOwnerInput = this.escrowSequenceInput = null;
    this.isValidEscrowCancel = this.validAddress = this.validSequence = false;
    this.lastKnownAddress = null;
    this.escrowAccountChanged.next(null);
  }

  onEscrowSequenceFound(escrowInfo:any) {
    this.escrowSequenceInput = escrowInfo.sequence;

    this.escrowSequenceSelected = true;
    setTimeout(() => this.escrowSequenceSelected = false, 1000);

    this.checkChanges();
  }
}
