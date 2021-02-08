import { Component, OnInit, ViewChild, Output, EventEmitter, Input, OnDestroy } from '@angular/core';
import { Encode } from 'xrpl-tagged-address-codec';
import { Subscription, Observable, Subject } from 'rxjs';
import { XummTypes } from 'xumm-sdk';
import { GoogleAnalyticsService } from '../../services/google-analytics.service';
import { AccountInfoChanged, AccountObjectsChanged, XrplAccountChanged } from 'src/app/utils/types';

@Component({
  selector: 'escrowcancel',
  templateUrl: './escrowcancel.html'
})
export class EscrowCancelComponent implements OnInit, OnDestroy {

  constructor(private googleAnalytics: GoogleAnalyticsService) { }

  @Input()
  accountInfoChanged: Observable<AccountInfoChanged>;

  @Input()
  transactionSuccessfull: Observable<AccountObjectsChanged>;

  @Output()
  onPayload: EventEmitter<XummTypes.XummPostPayloadBodyJson> = new EventEmitter();

  @ViewChild('inpescrowowner') inpescrowowner;
  escrowOwnerInput: string;

  @ViewChild('inpescrowsequence') inpescrowsequence;
  escrowSequenceInput: any;

  originalAccountInfo:any;
  testMode: boolean = false;
  
  private accountInfoChangedSubscription: Subscription;
  private transactionSuccessfullSubscription: Subscription;
  escrowAccountChanged: Subject<XrplAccountChanged> = new Subject<XrplAccountChanged>();

  isValidEscrowCancel = false;
  validAddress = false;
  validSequence = false;

  lastKnownAddress:string = null;
  lastKnownSequence:string = null;

  showEscrowSequenceSelectedStyle:boolean = false;
  escrowSequenceSelected:boolean = false;

  escrowOwnerChangedAutomatically:boolean = false;

  private payload:XummTypes.XummPostPayloadBodyJson = {
    txjson: {
      TransactionType: "EscrowCancel"
    }
  }

  ngOnInit() {
    this.accountInfoChangedSubscription = this.accountInfoChanged.subscribe(accountData => {
      //console.log("account info changed received")
      this.originalAccountInfo = accountData.info;
      this.testMode = accountData.mode

      if(this.originalAccountInfo && this.originalAccountInfo.Account) {
        this.escrowOwnerInput = this.originalAccountInfo.Account;
        this.xrplAccountChanged();
      } else {
        this.escrowOwnerInput = null;
        this.xrplAccountChanged();
      }
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

    this.payload.custom_meta = {};

    if(this.escrowOwnerInput && this.escrowOwnerInput.trim().length>0 && this.validAddress) {
      this.payload.txjson.Owner = this.escrowOwnerInput.trim();
      this.payload.custom_meta.instruction = "- Escrow Owner: " +this.escrowOwnerInput.trim();
    }

    if(this.escrowSequenceInput && this.validSequence) {
      this.payload.txjson.OfferSequence = Number(this.escrowSequenceInput);
      this.payload.custom_meta.instruction += "\n- Escrow Sequence: " + this.escrowSequenceInput;
    }    
    
    this.onPayload.emit(this.payload);
  }

  xrplAccountChanged() {
    this.checkChanges();

    if(this.validAddress && (this.escrowOwnerInput.trim() != this.lastKnownAddress)) {
      this.lastKnownAddress = this.escrowOwnerInput.trim();
      //console.log("emitting escrowAccountChanged event");
      this.escrowAccountChanged.next({account: this.lastKnownAddress, mode: this.testMode});
    } else if(!this.validAddress) {
      this.lastKnownAddress = null;
      this.escrowAccountChanged.next({account: this.lastKnownAddress, mode: this.testMode});
    }
  }

  sequenceChanged() {
    this.checkChanges();

    if(!this.validSequence && this.lastKnownSequence && this.validAddress) {
      //sequence change
      //console.log("send sequence changed");
      this.escrowAccountChanged.next({account: this.escrowOwnerInput.trim(), mode: this.testMode});
    }

  }

  checkChanges() {
    //console.log("amountInput: " + this.amountInput);
    //console.log("destinationInput: " + this.destinationInput);
    //console.log(this.escrowSequenceInput);

    this.validSequence = Number.isInteger(Number(this.escrowSequenceInput)) && parseInt(this.escrowSequenceInput) > 0;
    this.validAddress = this.escrowOwnerInput && this.escrowOwnerInput.trim().length > 0 && this.isValidXRPAddress(this.escrowOwnerInput.trim());

    if(this.validSequence)
      this.lastKnownSequence = this.escrowSequenceInput;

    this.isValidEscrowCancel = this.validAddress && this.validSequence;

    this.escrowSequenceSelected = false;

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
    this.isValidEscrowCancel = this.validAddress = this.validSequence = this.escrowOwnerChangedAutomatically = false;
    this.lastKnownAddress = null;
    
    this.escrowAccountChanged.next({account: this.lastKnownAddress, mode: this.testMode});
  }

  onEscrowSequenceFound(escrowInfo:any) {
    if(this.escrowOwnerInput && this.escrowOwnerInput.trim() != escrowInfo.owner) {
      this.escrowOwnerInput = escrowInfo.owner;
      this.escrowOwnerChangedAutomatically = true;
      setTimeout(() => this.escrowOwnerChangedAutomatically = false, 5000);
    }
    this.escrowSequenceInput = escrowInfo.sequence;
    this.checkChanges();

    this.escrowSequenceSelected = true;

    this.showEscrowSequenceSelectedStyle = true;
    setTimeout(() => this.showEscrowSequenceSelectedStyle = false, 1000);
  }
}
