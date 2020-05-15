import { Component, ViewChild, Output, EventEmitter, Input, OnInit, OnDestroy } from '@angular/core';
import { Encode } from 'xrpl-tagged-address-codec';
import { Observable, Subscription, Subject } from 'rxjs';
import { XummPostPayloadBodyJson } from 'xumm-api';
import { GoogleAnalyticsService } from '../../services/google-analytics.service';
import { AccountInfoChanged, XrplAccountChanged } from 'src/app/utils/types';

@Component({
  selector: 'escrowfinish',
  templateUrl: './escrowfinish.html'
})
export class EscrowFinishComponent implements OnInit, OnDestroy {

  constructor(private googleAnalytics: GoogleAnalyticsService) { }

  @Input()
  accountInfoChanged: Observable<AccountInfoChanged>;

  @Input()
  transactionSuccessfull: Observable<void>;
  
  @Output()
  onPayload: EventEmitter<XummPostPayloadBodyJson> = new EventEmitter();

  @ViewChild('inpescrowowner', {static: false}) inpescrowowner;
  escrowOwnerInput: string;

  @ViewChild('inpescrowsequence', {static: false}) inpescrowsequence;
  escrowSequenceInput: any;

  @ViewChild('inppassword', {static: false}) password;
  passwordInput: string;

  originalAccountInfo:any;
  isTestMode:boolean = false;

  private accountInfoChangedSubscription: Subscription;
  private transactionSuccessfullSubscription: Subscription;
  escrowAccountChanged: Subject<XrplAccountChanged> = new Subject<XrplAccountChanged>();

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

  private payload:XummPostPayloadBodyJson = {
    txjson: {
      TransactionType: "EscrowFinish"
    }
  }

  ngOnInit() {
    this.accountInfoChangedSubscription = this.accountInfoChanged.subscribe(accountData => {
      //console.log("account info changed received")
      this.originalAccountInfo = accountData.info;
      this.isTestMode = accountData.mode
      
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

    this.googleAnalytics.analyticsEventEmitter('escrow_finish', 'sendToXumm', 'escrow_finish_component');

    this.payload.custom_meta = {};

    if(this.escrowOwnerInput && this.escrowOwnerInput.trim().length>0 && this.validAddress) {
      this.payload.txjson.Owner = this.escrowOwnerInput.trim();
      this.payload.custom_meta.instruction = "- Escrow Owner: " +this.escrowOwnerInput.trim();
    }

    if(this.escrowSequenceInput && this.validSequence) {
      this.payload.txjson.OfferSequence = Number(this.escrowSequenceInput);
      this.payload.custom_meta.instruction += "\n- Escrow Sequence: " + this.escrowSequenceInput;
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

        this.payload.txjson.Condition = condition
        this.payload.txjson.Fulfillment = fulfillment;
        this.payload.txjson.Fee = (330 + (10 * Math.ceil(Buffer.byteLength(fulfillment_bytes)/16))).toString();

        this.payload.custom_meta.instruction += "\n- With a password ✓"

        this.onPayload.emit(this.payload);
      });
    } else {
      this.onPayload.emit(this.payload);
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
    this.validAddress = this.escrowOwnerInput && this.escrowOwnerInput.trim().length > 0 && this.isValidXRPAddress(this.escrowOwnerInput.trim());

    if(this.validSequence)
      this.lastKnownSequence = this.escrowSequenceInput;

    this.validCondition = this.passwordInput && this.passwordInput.trim().length > 0;

    this.isValidEscrowFinish = this.validAddress && this.validSequence && (!this.passwordInput || this.validCondition);

    this.escrowSequenceSelected = false;
    this.showPassword = true;

    //console.log("isValidEscrowFinish: " + this.isValidEscrowFinish);
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
    this.escrowOwnerInput = this.escrowSequenceInput = this.passwordInput = null;
    this.isValidEscrowFinish = this.validAddress = this.validSequence = this.escrowOwnerChangedAutomatically = false;
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
    this.checkChanges();

    this.escrowSequenceSelected = true;
    this.showPassword = escrowInfo.condition;

    this.showEscrowSequenceSelectedStyle = true;
    setTimeout(() => this.showEscrowSequenceSelectedStyle = false, 1000);
  }
}
