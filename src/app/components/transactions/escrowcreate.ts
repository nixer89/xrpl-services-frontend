import { Component, ViewChild, Output, EventEmitter, OnInit, OnDestroy, Input } from '@angular/core';
import { Subscription, Observable, Subject } from 'rxjs';
import { DeviceDetectorService } from 'ngx-device-detector';
import { XummTypes } from 'xumm-sdk';
import { GoogleAnalyticsService } from '../../services/google-analytics.service';
import { AccountInfoChanged, XrplAccountChanged } from 'src/app/utils/types';
import * as normalizer from '../../utils/normalizers'
import { isValidXRPAddress } from 'src/app/utils/utils';

@Component({
  selector: 'escrowcreate',
  templateUrl: './escrowcreate.html'
})
export class EscrowCreateComponent implements OnInit, OnDestroy{

  constructor(private device:DeviceDetectorService, private googleAnalytics: GoogleAnalyticsService) {}

  @Input()
  accountInfoChanged: Observable<AccountInfoChanged>;

  @Input()
  transactionSuccessfull: Observable<any>;

  @Output()
  onPayload: EventEmitter<XummTypes.XummPostPayloadBodyJson> = new EventEmitter();

  @ViewChild('inpamount') inpamount;
  amountInput: string;

  @ViewChild('inpdestination') inpdestination;
  destinationInput: string;

  @ViewChild('inpcancelafterdate') inpcancelafterdate;
  cancelafterDateInput: any;

  @ViewChild('inpcancelaftertime') inpcancelaftertime;
  cancelafterTimeInput: any;

  @ViewChild('inpfinishafterdate') inpfinishafterdate;
  finishafterDateInput: any;

  @ViewChild('inpfinishaftertime') inpfinishaftertime;
  finishafterTimeInput: any;

  @ViewChild('inppassword') password;
  passwordInput: string;

  originalAccountInfo:any;
  private accountInfoChangedSubscription: Subscription;
  private transactionSuccessfullSubscription: Subscription;
  escrowAccountChanged: Subject<XrplAccountChanged> = new Subject<XrplAccountChanged>();

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

  escrowYears:number = 0;
  maxSixDigits:boolean = false;

  dateTimePickerSupported:boolean = true;

  hidePw = true;

  ngOnInit() {
    this.accountInfoChangedSubscription = this.accountInfoChanged.subscribe(accountData => {
      //console.log("account info changed received")
      this.originalAccountInfo = accountData.info;
      if(this.originalAccountInfo && this.originalAccountInfo.Account && isValidXRPAddress(this.originalAccountInfo.Account)) {
        this.escrowAccountChanged.next({account: this.originalAccountInfo.Account, mode: accountData.mode});
      }

    });

    this.transactionSuccessfullSubscription = this.transactionSuccessfull.subscribe(() => {
      this.clearInputs()
    });

    this.dateTimePickerSupported = !(this.device && this.device.getDeviceInfo() && this.device.getDeviceInfo().os_version && (this.device.getDeviceInfo().os_version.toLowerCase().includes('ios') || this.device.getDeviceInfo().browser.toLowerCase().includes('safari') || this.device.getDeviceInfo().browser.toLowerCase().includes('edge')));
  }

  ngOnDestroy() {
    if(this.accountInfoChangedSubscription)
      this.accountInfoChangedSubscription.unsubscribe();

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
    
    if(this.finishAfterDateTime)
      this.escrowYears = this.finishAfterDateTime.getFullYear() - (new Date()).getFullYear();
    

    if(this.validCancelAfter && this.validFinishAfter)
      this.cancelDateBeforeFinishDate = this.finishAfterDateTime.getTime() >= this.cancelAfterDateTime.getTime();
    else
      this.cancelDateBeforeFinishDate = false;

    if(this.amountInput) {
      this.validAmount = !(/[^.0-9]|\d*\.\d{7,}/.test(this.amountInput));

      if(!this.validAmount) {
        this.maxSixDigits = this.amountInput.includes('.') && this.amountInput.split('.')[1].length > 6;
      } else {
        this.maxSixDigits = false;
      }
    }

    if(this.validAmount)
      this.validAmount = this.amountInput && parseFloat(this.amountInput) >= 0.000001 && !this.escrowBiggerThanAvailable();

    this.validAddress = this.destinationInput && this.destinationInput.trim().length > 0 && isValidXRPAddress(this.destinationInput.trim());

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
    let xummPayload:XummTypes.XummPostPayloadBodyJson = {
      txjson: {
        TransactionType: "EscrowCreate"
      }, custom_meta: {
        instruction: ""
      }
    }

    if(this.escrowYears > 10) {
      xummPayload.custom_meta.instruction += "ATTENTION: Your XRP will be inaccessible for " + this.escrowYears + "years!\n\n";
    }

    if(this.destinationInput && this.destinationInput.trim().length>0 && isValidXRPAddress(this.destinationInput)) {
      xummPayload.txjson.Destination = this.destinationInput.trim();
      xummPayload.custom_meta.instruction += "- Escrow Destination: " + this.destinationInput.trim();
    }

    if(this.amountInput && parseFloat(this.amountInput) >= 0.000001) {
      xummPayload.txjson.Amount = parseFloat(this.amountInput)*1000000+"";
      xummPayload.custom_meta.instruction += "\n- Escrow Amount: " + this.amountInput;
    }
 
    if(this.validCancelAfter) {
      xummPayload.txjson.CancelAfter = normalizer.utcToRippleEpocheTime(this.cancelAfterDateTime.getTime());
      xummPayload.custom_meta.instruction += "\n- Cancel After (UTC): " + this.cancelAfterDateTime.toUTCString();
    }

    if(this.validFinishAfter) {
      xummPayload.txjson.FinishAfter = normalizer.utcToRippleEpocheTime(this.finishAfterDateTime.getTime());
      xummPayload.custom_meta.instruction += "\n- Finish After (UTC): " + this.finishAfterDateTime.toUTCString();
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

        xummPayload.txjson.Condition = condition
        xummPayload.custom_meta.instruction += "\n- With a password ✓"

        this.onPayload.emit(xummPayload);
      });      
    } else {
      this.onPayload.emit(xummPayload);
    }
  }

  getAvailableBalanceForEscrow(): number {
    if(this.originalAccountInfo && this.originalAccountInfo.Balance) {
      let balance:number = Number(this.originalAccountInfo.Balance);
      balance = balance - (20*1000000); //deduct acc reserve
      balance = balance - (this.originalAccountInfo.OwnerCount * 5 * 1000000); //deduct owner count
      balance = balance - 5 * 1000000; //deduct account reserve for escrow
      balance = balance/1000000;

      if(balance >= 0.000001)
        return balance
      else
        return 0;
      
    } else {
      return 0;
    }
  }

  escrowBiggerThanAvailable(): boolean {
    return this.originalAccountInfo && this.amountInput && parseFloat(this.amountInput) > this.getAvailableBalanceForEscrow();
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
