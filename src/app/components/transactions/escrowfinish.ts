import { Component, ViewChild, Output, EventEmitter, Input, OnInit, OnDestroy } from '@angular/core';
import { Observable, Subscription, Subject } from 'rxjs';
import { XummTypes } from 'xumm-sdk';
import { AccountInfoChanged, AccountObjectsChanged, XrplAccountChanged } from 'src/app/utils/types';
import { isValidXRPAddress } from 'src/app/utils/utils';

@Component({
  selector: 'escrowfinish',
  templateUrl: './escrowfinish.html'
})
export class EscrowFinishComponent implements OnInit, OnDestroy {

  constructor() { }

  @Input()
  accountInfoChanged: Observable<AccountInfoChanged>;

  @Input()
  accountObjectsChanged: Observable<AccountObjectsChanged>;

  @Input()
  transactionSuccessfull: Observable<void>;
  
  @Output()
  onPayload: EventEmitter<XummTypes.XummPostPayloadBodyJson> = new EventEmitter();

  @ViewChild('inpescrowowner') inpescrowowner;
  escrowOwnerInput: string;

  @ViewChild('inpescrowsequence') inpescrowsequence;
  escrowSequenceInput: any;

  @ViewChild('inppassword') password;
  passwordInput: string;

  originalAccountInfo:any;
  isTestMode:boolean = false;

  allAccountEscrows:any[];

  private accountInfoChangedSubscription: Subscription;
  private accountObjectsChangedSubscription: Subscription;
  private transactionSuccessfullSubscription: Subscription;
  escrowAccountChanged: Subject<XrplAccountChanged> = new Subject<XrplAccountChanged>();
  escrowsChanged: Subject<AccountObjectsChanged> = new Subject<AccountObjectsChanged>();

  showEscrowSequenceSelectedStyle:boolean = false;
  escrowSequenceSelected:boolean = false;
  showPassword:boolean = true;

  isValidEscrowFinish = false;
  validAddress = false;
  validSequence = false;
  validCondition = false;

  hidePw = true;

  escrowOwnerChangedAutomatically:boolean = false;

  lastKnownAddress:string = null;
  lastKnownSequence:string = null;
  showPwField:boolean = true;

  ngOnInit() {
    this.accountInfoChangedSubscription = this.accountInfoChanged.subscribe(accountData => {
      //console.log("account info changed received")
      this.originalAccountInfo = accountData.info;
      this.isTestMode = accountData.mode;

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
      this.clearInputs();
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
        TransactionType: "EscrowFinish"
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

    if(this.validCondition) {
      let fulfillment_bytes:Buffer = Buffer.from(this.passwordInput.trim(), 'utf-8');

      import('five-bells-condition').then( cryptoCondition => {
        let myFulfillment = new cryptoCondition.PreimageSha256();

        myFulfillment.setPreimage(fulfillment_bytes);

        let fulfillment = myFulfillment.serializeBinary().toString('hex').toUpperCase()
        //console.log('Fulfillment: ', fulfillment)
        //console.log('             ', myFulfillment.serializeUri())

        var condition = myFulfillment.getConditionBinary().toString('hex').toUpperCase()
        //console.log('Condition  : ', condition)
        // 'A0258020' + sha256(fulfillment_bytes) + '810102'
        //console.log('             ', myFulfillment.getCondition().serializeUri())

        //console.log()

        //console.log(
        //  'Fulfillment valid for Condition?      ',
        //    cryptoCondition.validateFulfillment(
        //    cryptoCondition.Fulfillment.fromBinary(Buffer.from(fulfillment, 'hex')).serializeUri(), 
        //    cryptoCondition.Condition.fromBinary(Buffer.from(condition, 'hex')).serializeUri()
        //  )
        //)

        //console.log("fulfillment_bytes.length: " + fulfillment_bytes.length);

        payload.txjson.Condition = condition
        payload.txjson.Fulfillment = fulfillment;

        payload.txjson.Fee = (330 + (10 * Math.ceil(Buffer.byteLength(fulfillment_bytes)/16))).toString();

        payload.custom_meta.instruction += "\n- With a password ✓"

        this.onPayload.emit(payload);
      });
    } else {
      this.onPayload.emit(payload);
    }
  }

  xrplAccountChanged() {
    this.checkChanges();

    if(this.validAddress && (this.escrowOwnerInput.trim() != this.lastKnownAddress)) {
      this.lastKnownAddress = this.escrowOwnerInput.trim();
      //console.log("emitting escrowAccountChanged event");
      this.escrowAccountChanged.next({account: this.lastKnownAddress, mode: this.isTestMode});
    } else if(!this.validAddress) {
      this.lastKnownAddress = null;
      this.escrowAccountChanged.next({account: this.lastKnownAddress, mode: this.isTestMode});
    } else {
      this.escrowAccountChanged.next({account: this.lastKnownAddress, mode: this.isTestMode});
    }
  }

  sequenceChanged() {
    this.checkChanges();

    if(!this.validSequence && this.lastKnownSequence && this.validAddress) {
      //sequence change
      //console.log("send sequence changed");
      this.escrowAccountChanged.next({account: this.escrowOwnerInput.trim(), mode: this.isTestMode});
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

    this.validCondition = this.passwordInput && this.passwordInput.trim().length > 0;

    this.isValidEscrowFinish = this.validAddress && this.validSequence && (!this.showPassword || this.validCondition);

    this.escrowSequenceSelected = false;

    //console.log("isValidEscrowFinish: " + this.isValidEscrowFinish);
  }

  clearInputs() {
    this.escrowOwnerInput = this.escrowSequenceInput = this.passwordInput = null;
    this.isValidEscrowFinish = this.validAddress = this.validSequence = this.escrowOwnerChangedAutomatically = this.validCondition = false;
    this.lastKnownAddress = null;
    
    this.escrowAccountChanged.next({account: null, mode: this.isTestMode});
  }

  onEscrowSequenceFound(escrowInfo:any) {
    if(this.escrowOwnerInput && this.escrowOwnerInput.trim() != escrowInfo.owner) {
      this.escrowOwnerInput = escrowInfo.owner;
      this.escrowOwnerChangedAutomatically = true;
      setTimeout(() => this.escrowOwnerChangedAutomatically = false, 5000);
    }
    this.escrowSequenceInput = escrowInfo.sequence;
    
    this.escrowSequenceSelected = true;
    this.showPassword = escrowInfo.condition;
    
    this.checkChanges();

    this.showEscrowSequenceSelectedStyle = true;
    setTimeout(() => this.showEscrowSequenceSelectedStyle = false, 1000);
  }
}
