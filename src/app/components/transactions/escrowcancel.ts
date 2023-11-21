import { Component, OnInit, ViewChild, Output, EventEmitter, Input, OnDestroy } from '@angular/core';
import { Subscription, Observable, Subject } from 'rxjs';
import { XummTypes } from 'xumm-sdk';
import { AccountInfoChanged, AccountObjectsChanged, XrplAccountChanged } from 'src/app/utils/types';
import { isValidXRPAddress } from 'src/app/utils/utils';

@Component({
  selector: 'escrowcancel',
  templateUrl: './escrowcancel.html'
})
export class EscrowCancelComponent implements OnInit, OnDestroy {

  constructor() { }

  @Input()
  accountInfoChanged: Observable<AccountInfoChanged>;

  @Input()
  accountObjectsChanged: Observable<AccountObjectsChanged>;

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

  allAccountEscrows:any[];
  
  private accountInfoChangedSubscription: Subscription;
  private accountObjectsChangedSubscription: Subscription;
  private transactionSuccessfullSubscription: Subscription;
  escrowAccountChanged: Subject<XrplAccountChanged> = new Subject<XrplAccountChanged>();
  escrowsChanged: Subject<AccountObjectsChanged> = new Subject<AccountObjectsChanged>();

  isValidEscrowCancel = false;
  validAddress = false;
  validSequence = false;

  lastKnownAddress:string = null;
  lastKnownSequence:string = null;

  showEscrowSequenceSelectedStyle:boolean = false;
  escrowSequenceSelected:boolean = false;

  escrowOwnerChangedAutomatically:boolean = false;

  ngOnInit() {
    this.accountInfoChangedSubscription = this.accountInfoChanged.subscribe(accountData => {
      //console.log("account info changed received")
      this.originalAccountInfo = accountData.info;
      this.testMode = accountData.mode;

      this.clearInputs();

      if(this.originalAccountInfo && this.originalAccountInfo.Account) {
        this.escrowOwnerInput = this.originalAccountInfo.Account;
        this.xrplAccountChanged();
      } else {
        this.escrowOwnerInput = null;
        this.xrplAccountChanged();
      }
    });

    this.accountObjectsChangedSubscription = this.accountObjectsChanged.subscribe(accountObjects => {
      //console.log("account objects changed received")
      if(accountObjects && accountObjects.objects) {
        this.allAccountEscrows = accountObjects.objects.filter(object => object.LedgerEntryType === "Escrow");
        this.escrowsChanged.next({objects: this.allAccountEscrows, mode: accountObjects.mode});
      } else {
        this.allAccountEscrows = null;
        this.escrowsChanged.next({objects: null, mode: accountObjects.mode});
      }
    });

    this.transactionSuccessfullSubscription = this.transactionSuccessfull.subscribe(() => {
      this.clearInputs()
    });
  }

  ngOnDestroy() {
    if(this.accountInfoChangedSubscription)
      this.accountInfoChangedSubscription.unsubscribe();

    if(this.accountObjectsChangedSubscription)
      this.accountObjectsChangedSubscription.unsubscribe();

    if(this.transactionSuccessfullSubscription)
      this.transactionSuccessfullSubscription.unsubscribe();
  }

  sendPayloadToXumm() {

    let payload:XummTypes.XummPostPayloadBodyJson = {
      txjson: {
        TransactionType: "EscrowCancel"
      }
    }

    payload.custom_meta = {};

    if(this.escrowOwnerInput && this.escrowOwnerInput.trim().length>0 && this.validAddress) {
      payload.txjson.Owner = this.escrowOwnerInput.trim();
      payload.custom_meta.instruction = "- Escrow Owner: " +this.escrowOwnerInput.trim();
    }

    if(this.escrowSequenceInput && this.validSequence) {
      payload.txjson.OfferSequence = Number(this.escrowSequenceInput);
      payload.custom_meta.instruction += "\n- Escrow Sequence: " + this.escrowSequenceInput;
    }    
    
    this.onPayload.emit(payload);
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
    } else {
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
    this.validAddress = this.escrowOwnerInput && this.escrowOwnerInput.trim().length > 0 && isValidXRPAddress(this.escrowOwnerInput.trim());

    if(this.validSequence)
      this.lastKnownSequence = this.escrowSequenceInput;

    this.isValidEscrowCancel = this.validAddress && this.validSequence;

    this.escrowSequenceSelected = false;

    //console.log("isValidEscrowCancel: " + this.isValidEscrowCancel);
  }

  clearInputs() {
    this.escrowOwnerInput = this.escrowSequenceInput = null;
    this.isValidEscrowCancel = this.validAddress = this.validSequence = this.escrowOwnerChangedAutomatically = this.escrowSequenceSelected = false;
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
    this.escrowSequenceSelected = true;

    this.checkChanges();

    this.showEscrowSequenceSelectedStyle = true;
    setTimeout(() => this.showEscrowSequenceSelectedStyle = false, 1000);
  }
}
