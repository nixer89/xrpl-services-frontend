import { Component, ViewChild, Output, EventEmitter, OnInit, OnDestroy, Input } from '@angular/core';
import { Encode } from 'xrpl-tagged-address-codec';
import * as cryptoCondition from 'five-bells-condition'
import { Subscription, Observable } from 'rxjs';
import { DeviceDetectorService } from 'ngx-device-detector';
import { XummPostPayloadBodyJson } from 'xumm-api';
import { GoogleAnalyticsService } from '../../services/google-analytics.service';

@Component({
  selector: 'escrowcreate',
  templateUrl: './escrowcreate.html'
})
export class EscrowCreateComponent implements OnInit, OnDestroy{

  constructor(private device:DeviceDetectorService, private googleAnalytics: GoogleAnalyticsService) {}

  @Input()
  transactionSuccessfull: Observable<void>;

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

  private transactionSuccessfullSubscription: Subscription;

  isValidEscrow:boolean = false;
  validAmount:boolean = false;
  validAddress:boolean = false;
  validCancelAfter:boolean = false;
  validFinishAfter:boolean = false;
  validCondition:boolean = false;

  cancelAfterDateTime:Date;
  finishAfterDateTime:Date;

  cancelDateInFuture:boolean = false;
  finishDateInFuture:boolean = false;
  cancelDateBeforeFinishDate:boolean = false;

  dateTimePickerSupported:boolean = true;

  hidePw = true;

  private xummPayload:XummPostPayloadBodyJson = {
    options: {
      expire: 5
    },
    txjson: {
      TransactionType: "EscrowCreate"
    }
  }

  ngOnInit() {
    this.transactionSuccessfullSubscription = this.transactionSuccessfull.subscribe(() => {
      this.clearInputs()
    });

    this.dateTimePickerSupported = !(this.device && this.device.getDeviceInfo() && this.device.getDeviceInfo().os_version && (this.device.getDeviceInfo().os_version.toLowerCase().includes('ios') || this.device.getDeviceInfo().browser.toLowerCase().includes('safari') || this.device.getDeviceInfo().browser.toLowerCase().includes('edge')));
  }

  ngOnDestroy() {
    if(this.transactionSuccessfullSubscription)
      this.transactionSuccessfullSubscription.unsubscribe();
  }

  checkChanges() {
    //console.log("amountInput: " + this.amountInput);
    //console.log("destinationInput: " + this.destinationInput);
    
    if(this.dateTimePickerSupported) {
      if(this.cancelafterDateInput && this.cancelafterTimeInput)
        this.cancelAfterDateTime = new Date(this.cancelafterDateInput.trim() + " " + this.cancelafterTimeInput.trim())
      else
        this.cancelAfterDateTime = null;
    } else {
      this.cancelAfterDateTime = this.handleDateAndTimeNonPicker(this.cancelafterDateInput, this.cancelafterTimeInput);
    }

    this.cancelDateInFuture = this.cancelAfterDateTime != null && this.cancelAfterDateTime.getTime() < Date.now();
    this.validCancelAfter = this.cancelAfterDateTime != null && this.cancelAfterDateTime.getTime() > 0;

    if(this.dateTimePickerSupported) {
      if(this.finishafterDateInput && this.finishafterTimeInput)
        this.finishAfterDateTime = new Date(this.finishafterDateInput.trim() + " " + this.finishafterTimeInput.trim());
      else
        this.finishAfterDateTime = null;
    } else {
      this.finishAfterDateTime = this.handleDateAndTimeNonPicker(this.finishafterDateInput, this.finishafterTimeInput);
    }
    
    this.finishDateInFuture = this.finishAfterDateTime != null && this.finishAfterDateTime.getTime() < Date.now();
    this.validFinishAfter = this.finishAfterDateTime != null && this.finishAfterDateTime.getTime() > 0;
    

    if(this.validCancelAfter && this.validFinishAfter)
      this.cancelDateBeforeFinishDate = this.finishAfterDateTime.getTime() >= this.cancelAfterDateTime.getTime();
    else
      this.cancelDateBeforeFinishDate = false;


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

    if(this.isValidEscrow && this.validFinishAfter && this.validCancelAfter) {
      this.isValidEscrow = !this.cancelDateBeforeFinishDate && !this.cancelDateInFuture && !this.finishDateInFuture;
    }

    //console.log("isValidEscrow: " + this.isValidEscrow);
  }

  handleDateAndTimeNonPicker(dateInput: string, timeInput: string): Date {
    let dateTime:Date = null;
    if(dateInput && dateInput.trim().length > 0)
      dateTime = new Date(dateInput.trim());
    else
      dateTime = null;

    if(timeInput && timeInput.trim().length > 0 && dateTime) {
      let splitValues:string[] = timeInput.trim().split(':');

      if(splitValues) {
        if(splitValues[0] && Number.isInteger(Number.parseInt(splitValues[0])))
          dateTime.setHours(Number.parseInt(splitValues[0]));

        if(splitValues[1] && Number.isInteger(Number.parseInt(splitValues[1])))
          dateTime.setMinutes(Number.parseInt(splitValues[1]));

        if(splitValues[2] && Number.isInteger(Number.parseInt(splitValues[2])))
          dateTime.setSeconds(Number.parseInt(splitValues[2]));
      }
    }

    return dateTime;
  }

  sendPayloadToXumm() {

    this.googleAnalytics.analyticsEventEmitter('escrow_create', 'sendToXumm', 'escrow_create_component');

    if(this.amountInput && this.amountInput >= 0.000001)
      this.xummPayload.txjson.Amount = this.amountInput*1000000+"";

    if(this.destinationInput && this.destinationInput.trim().length>0 && this.isValidXRPAddress(this.destinationInput))
      this.xummPayload.txjson.Destination = this.destinationInput.trim();

    if(this.validCancelAfter)
      this.xummPayload.txjson.CancelAfter = (this.cancelAfterDateTime.getTime()/1000)-946684800;

    if(this.validFinishAfter)
      this.xummPayload.txjson.FinishAfter = (this.finishAfterDateTime.getTime()/1000)-946684800;

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

      this.xummPayload.txjson.Condition = condition
    }

    this.onPayload.emit(this.xummPayload);
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
    this.destinationInput = this.amountInput = null;
    this.cancelafterDateInput = this.cancelafterTimeInput = this.cancelAfterDateTime = null;
    this.finishafterDateInput = this.finishafterTimeInput = this.finishAfterDateTime = null;

    this.cancelDateInFuture =  this.finishDateInFuture = this.cancelDateBeforeFinishDate = false;

    this.isValidEscrow = this.validAddress = this.validAmount = this.validCancelAfter = this.validFinishAfter = this.validCondition = false;

    this.passwordInput = null;
  }
}
