import { Component, OnInit, ViewChild, Output, EventEmitter, Input, OnDestroy } from '@angular/core';
import { Encode } from 'xrpl-tagged-address-codec';
import { Subscription, Observable } from 'rxjs';

@Component({
  selector: 'setregularkey',
  templateUrl: './setregularkey.html'
})
export class SetRegularKeyComponent implements OnInit, OnDestroy {

  @Input()
  transactionSuccessfull: Observable<void>;

  @Output()
  onPayload: EventEmitter<any> = new EventEmitter();

  @ViewChild('inpregularkey', {static: false}) inpregularkey;
  regularKeyInput: string;

  private transactionSuccessfullSubscription: Subscription;

  validAddress = false;

  private payload:any = {
    options: {
      expire: 5
    },
    txjson: {
      TransactionType: "SetRegularKey"
    }
  }

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
