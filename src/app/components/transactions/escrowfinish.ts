import { Component, ViewChild, Output, EventEmitter, Input, OnInit, OnDestroy } from '@angular/core';
import { Encode } from 'xrpl-tagged-address-codec';
import * as cryptoCondition from 'five-bells-condition'
import { Observable, Subscription, Subject } from 'rxjs';

@Component({
  selector: 'escrowfinish',
  templateUrl: './escrowfinish.html'
})
export class EscrowFinishComponent implements OnInit, OnDestroy {

  @Input()
  transactionSuccessfull: Observable<void>;
  
  @Output()
  onPayload: EventEmitter<any> = new EventEmitter();

  @Input()
  testMode: boolean;

  @ViewChild('inpescrowowner', {static: false}) inpescrowowner;
  escrowOwnerInput: string;

  @ViewChild('inpescrowsequence', {static: false}) inpescrowsequence;
  escrowSequenceInput: any;

  @ViewChild('inppassword', {static: false}) password;
  passwordInput: string;

  private transactionSuccessfullSubscription: Subscription;
  escrowAccountChanged: Subject<string> = new Subject<string>();

  escrowSequenceSelected:boolean = false;

  isValidEscrowFinish = false;
  validAddress = false;
  validSequence = false;
  validCondition = false;

  hidePw = true;

  lastKnownAddress:string = null;
  showPwField:boolean = true;

  private payload:any = {
    options: {
      expire: 5
    },
    txjson: {
      TransactionType: "EscrowFinish"
    }
  }

  constructor() {}

  ngOnInit() {
    this.transactionSuccessfullSubscription = this.transactionSuccessfull.subscribe(() => {
      this.clearInputs()
    });
  }

  ngOnDestroy() {
    if(this.transactionSuccessfullSubscription)
      this.transactionSuccessfullSubscription.unsubscribe();
  }

  sendPayloadToXumm() {

    if(this.escrowOwnerInput && this.escrowOwnerInput.trim().length>0 && this.validAddress)
      this.payload.txjson.Owner = this.escrowOwnerInput.trim();

    if(this.escrowSequenceInput && this.validSequence)
      this.payload.txjson.OfferSequence = Number(this.escrowSequenceInput);

    if(this.validCondition) {
      let fulfillment_bytes:Buffer = Buffer.from(this.passwordInput.trim(), 'utf-8');

      let myFulfillment = new cryptoCondition.PreimageSha256()
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
      this.payload.txjson.Fee = (330 + (10 * Math.ceil(fulfillment_bytes.length/16))).toString();
    }

    this.onPayload.emit(this.payload);
  }

  checkChanges() {
    //console.log("amountInput: " + this.amountInput);
    //console.log("destinationInput: " + this.destinationInput);
    
    //console.log(this.escrowSequenceInput);

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


    this.validCondition = this.passwordInput && this.passwordInput.trim().length > 0;

    this.isValidEscrowFinish = this.validAddress && this.validSequence && (!this.passwordInput || this.validCondition);

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
    this.escrowOwnerInput = this.escrowSequenceInput = null;
    this.isValidEscrowFinish = this.validAddress = this.validSequence = false;
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
