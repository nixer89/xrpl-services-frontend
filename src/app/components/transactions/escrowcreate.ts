import { Component, ViewChild, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'escrowcreate',
  templateUrl: './escrowcreate.html'
})
export class EscrowCreateComponent {

  @Output()
  onPayload: EventEmitter<any> = new EventEmitter();

  @ViewChild('inpamount', {static: false}) inpamount;
  amountInput: number;

  @ViewChild('inpdestination', {static: false}) inpdestination;
  destinationInput: string;

  @ViewChild('inpcancelafter', {static: false}) inpcancelafter;
  cancelafterInput: Date;

  @ViewChild('inpfinishafter', {static: false}) finishafter;
  finishafterInput: Date;

  @ViewChild('inppassword', {static: false}) password;
  passwordInput: string;

  isValidEscrow = false;

  private payload:any = {
    options: {
      expire: 5
    },
    txjson: {
      TransactionType: "EscrowCreate"
    }
  }

  hexToString(hexValue: string):string {
    if(hexValue) {
      let str = '';
      for (var i = 0; (i < hexValue.length && hexValue.substr(i, 2) !== '00'); i += 2)
          str += String.fromCharCode(parseInt(hexValue.substr(i, 2), 16));

      return str;
    }

    return "";
  }

  stringToHex(stringValue: string): string {
    let arr = [];

    for (var i = 0, l = stringValue.length; i < l; i ++) {
      var hex = Number(stringValue.charCodeAt(i)).toString(16);
      arr.push(hex);
    }
    return arr.join('').toUpperCase();
  }

  sendPayloadToXumm() {

    if(this.amountInput && this.amountInput > 0)
      this.payload.txjson.Amount = this.amountInput*1000000+"";

    if(this.destinationInput && this.destinationInput.trim().length>0)
      this.payload.txjson.Destination = this.destinationInput.trim();

    if(this.cancelafterInput)
      this.payload.txjson.FinishAfter = (new Date(this.cancelafterInput).getTime()/1000)-946684800;

    if(this.finishafter)
      this.payload.txjson.FinishAfter = (new Date(this.finishafter).getTime()/1000)-946684800;

    this.onPayload.emit(this.payload);
  }

  checkChanges() {
    console.log("amountInput: " + this.amountInput);
    console.log("destinationInput: " + this.destinationInput);
    console.log("cancelafterInput: " + this.cancelafterInput);
    console.log("finishafterInput: " + this.finishafterInput);
    console.log("passwordInput: " + this.passwordInput);

    this.isValidEscrow = this.amountInput && this.amountInput > 0 && this.destinationInput && this.destinationInput.trim().length > 0;
  }

}
