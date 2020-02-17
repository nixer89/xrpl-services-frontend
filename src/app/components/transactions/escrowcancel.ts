import { Component, OnInit, ViewChild, Output, EventEmitter, Input, OnDestroy } from '@angular/core';
import { Encode } from 'xrpl-tagged-address-codec';
import { Subscription, Observable } from 'rxjs';

@Component({
  selector: 'escrowcancel',
  templateUrl: './escrowcancel.html'
})
export class EscrowCancelComponent implements OnInit, OnDestroy {

  @Input()
  transactionSuccessfull: Observable<void>;

  @Output()
  onPayload: EventEmitter<any> = new EventEmitter();

  @ViewChild('inpescrowowner', {static: false}) inpescrowowner;
  escrowOwnerInput: string;

  @ViewChild('inpescrowsequence', {static: false}) inpescrowsequence;
  escrowSequenceInput: any;

  private transactionSuccessfullSubscription: Subscription;

  isValidEscrowCancel = false;
  validAddress = false;
  validSequence = false;

  private payload:any = {
    options: {
      expire: 5
    },
    txjson: {
      TransactionType: "EscrowCancel"
    }
  }

  ngOnInit() {
    this.transactionSuccessfullSubscription = this.transactionSuccessfull.subscribe(() => {
      console.log("transaction was successfull")
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

    this.onPayload.emit(this.payload);
  }

  checkChanges() {
    //console.log("amountInput: " + this.amountInput);
    //console.log("destinationInput: " + this.destinationInput);
    
    this.validSequence = this.escrowSequenceInput && Number.isInteger(Number(this.escrowSequenceInput));
    this.validAddress = this.escrowOwnerInput && this.escrowOwnerInput.trim().length > 0 && this.isValidXRPAddress(this.escrowOwnerInput.trim());

    this.isValidEscrowCancel = this.validAddress && this.validSequence;

    console.log("isValidEscrowCancel: " + this.isValidEscrowCancel);
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
  }
}
