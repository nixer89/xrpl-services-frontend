import { Component, ViewChild, Output, EventEmitter } from '@angular/core';
import { Encode } from 'xrpl-tagged-address-codec';
import * as cryptoCondition from 'five-bells-condition'

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

  @ViewChild('inpcancelafterdate', {static: false}) inpcancelafterdate;
  cancelafterDateInput: any;

  @ViewChild('inpcancelaftertime', {static: false}) inpcancelaftertime;
  cancelafterTimeInput: any;

  @ViewChild('inpfinishafterdate', {static: false}) inpfinishafterdate;
  finishafterDateInput: any;

  @ViewChild('inpfinishaftertime', {static: false}) inpfinishaftertime;
  finishafterTimeInput: any;

  @ViewChild('inppassword', {static: false}) password;
  passwordInput: string;

  isValidEscrow = false;
  validAmount = false;
  validAddress = false;
  validCancelAfter = false;
  validFinishAfter = false;
  validCondition = false;

  cancelAfterDateTime:Date;
  finishAfterDateTime:Date;

  hidePw = true;

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

    if(this.amountInput && this.amountInput >= 0.000001)
      this.payload.txjson.Amount = this.amountInput*1000000+"";

    if(this.destinationInput && this.destinationInput.trim().length>0 && this.isValidXRPAddress(this.destinationInput))
      this.payload.txjson.Destination = this.destinationInput.trim();

    if(this.validCancelAfter)
      this.payload.txjson.CancelAfter = (this.cancelAfterDateTime.getTime()/1000)-946684800;

    if(this.validFinishAfter)
      this.payload.txjson.FinishAfter = (this.finishAfterDateTime.getTime()/1000)-946684800;

    if(this.validCondition) {
      let fulfillment_bytes:Buffer = Buffer.from(this.passwordInput.trim(), 'utf-8');

      let myFulfillment = new cryptoCondition.PreimageSha256()
      myFulfillment.setPreimage(fulfillment_bytes);

      let fulfillment = myFulfillment.serializeBinary().toString('hex').toUpperCase()
      console.log('Fulfillment: ', fulfillment)
      console.log('             ', myFulfillment.serializeUri())

      var condition = myFulfillment.getConditionBinary().toString('hex').toUpperCase()
      console.log('Condition  : ', condition)
        // 'A0258020' + sha256(fulfillment_bytes) + '810102'
      console.log('             ', myFulfillment.getCondition().serializeUri())

      console.log()

      console.log(
        'Fulfillment valid for Condition?      ',
          cryptoCondition.validateFulfillment(
          cryptoCondition.Fulfillment.fromBinary(Buffer.from(fulfillment, 'hex')).serializeUri(), 
          cryptoCondition.Condition.fromBinary(Buffer.from(condition, 'hex')).serializeUri()
        )
      )

      this.payload.txjson.Condition = condition
    }

    this.onPayload.emit(this.payload);
  }

  checkChanges() {
    //console.log("amountInput: " + this.amountInput);
    //console.log("destinationInput: " + this.destinationInput);
    
    if(this.cancelafterDateInput && this.cancelafterTimeInput)
      this.cancelAfterDateTime = new Date(this.cancelafterDateInput + " " + this.cancelafterTimeInput)
    else
      this.cancelAfterDateTime = null;

    this.validCancelAfter = this.cancelAfterDateTime != null;

    if(this.finishafterDateInput && this.finishafterTimeInput)
      this.finishAfterDateTime = new Date(this.finishafterDateInput + " " + this.finishafterTimeInput)
    else
      this.finishAfterDateTime = null;
    
    this.validFinishAfter = this.finishAfterDateTime != null;

    this.validAmount = this.amountInput && this.amountInput >= 0.000001;
    this.validAddress = this.destinationInput && this.destinationInput.trim().length > 0 && this.isValidXRPAddress(this.destinationInput.trim());

    this.validCondition = this.passwordInput && this.passwordInput.trim().length > 0;

    if(this.validAmount && this.validAddress && (this.validFinishAfter || this.validCondition)) {
      if(this.validCondition)
        this.isValidEscrow = this.validFinishAfter || this.validCancelAfter
      else
        this.isValidEscrow = this.validFinishAfter 
    }
    else
      this.isValidEscrow = false;

    if(this.isValidEscrow && this.validFinishAfter && this.validCancelAfter)
      this.isValidEscrow = this.finishAfterDateTime.getTime() < this.cancelAfterDateTime.getTime();

    console.log("isValidEscrow: " + this.isValidEscrow);
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

  isValidDateCombination() {
    if(!this.validCancelAfter || !this.validFinishAfter)
      return true;
    else
      return this.validAmount && this.validAddress && (this.validFinishAfter && this.validCancelAfter && ((this.finishAfterDateTime.getTime() - this.cancelAfterDateTime.getTime()) < 0));
  }
}
