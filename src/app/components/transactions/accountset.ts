import { Component, OnInit, Input, ViewChild, Output, EventEmitter } from '@angular/core';
import { Subscription, Observable} from 'rxjs';
import * as md5 from 'md5';
import * as emailValidator from 'email-validator'

@Component({
  selector: 'accountset',
  templateUrl: './accountset.html'
})
export class AccountSetComponent implements OnInit {

  @Input()
  accountInfoChanged: Observable<void>;

  @Output()
  onPayload: EventEmitter<any> = new EventEmitter();

  @ViewChild('inpdomain', {static: false}) inpdomain;
  domainInput: string = "";

  @ViewChild('inpemail', {static: false}) inpemail;
  emailInput: string = "";

  private accountInfoChangedSubscription: Subscription;
  originalAccountInfo:any;
  domainChangeDetected:boolean = false;
  emailChangeDetected:boolean = false;

  validAccountSet:boolean = false;
  validDomain:boolean = false;
  validEmail:boolean = false;

  payload:any = {
    options: {
      expire: 1
    },
    txjson: {
      TransactionType: "AccountSet"
    }
  }

  ngOnInit(){
    this.accountInfoChangedSubscription = this.accountInfoChanged.subscribe(accountData => {
      console.log("account info changed received")
      this.originalAccountInfo = accountData;
      this.reloadData()
    });

    this.initializePayload();    
  }

  ngOnDestroy() {
    this.accountInfoChangedSubscription.unsubscribe();
  }

  initializePayload() {
    this.payload = {
      options: {
        expire: 1
      },
      txjson: {
        TransactionType: "AccountSet"
      }
    }
  }

  reloadData() {
    console.log(JSON.stringify(this.originalAccountInfo));
    if(this.originalAccountInfo)
        this.domainInput = this.hexToString(this.originalAccountInfo.Domain)
    else
      this.domainInput = null;
  
    this.emailInput = "";
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

  sendToXumm() {
    console.log("sending to xumm");
    console.log("originalAccountInfo: " + JSON.stringify(this.originalAccountInfo));
    console.log("domain: " + this.domainInput);
    console.log("domain hex: " + this.stringToHex(this.domainInput.trim()));
    console.log("email: " + this.emailInput);

    if(this.originalAccountInfo && this.originalAccountInfo.Account)
      this.payload.xrplAccount = this.originalAccountInfo.Account;

    if(this.domainInput && (!this.originalAccountInfo || this.stringToHex(this.domainInput.trim()) != this.originalAccountInfo.Domain))
      this.payload.txjson.Domain = this.stringToHex(this.domainInput.trim());

    if(this.emailInput && (!this.originalAccountInfo || md5(this.emailInput.trim()).toUpperCase() != this.originalAccountInfo.EmailHash))
      this.payload.txjson.EmailHash = md5(this.emailInput.trim()).toUpperCase();

    this.onPayload.emit(this.payload);
    this.initializePayload();
  }

  deleteDomain() {
    this.payload.txjson.Domain = '';

    if(this.originalAccountInfo && this.originalAccountInfo.Account)
      this.payload.xrplAccount = this.originalAccountInfo.Account;

    this.onPayload.emit(this.payload);
    this.initializePayload();
  }

  deleteEmailHash() {
    this.payload.txjson.EmailHash = '';

    if(this.originalAccountInfo && this.originalAccountInfo.Account)
      this.payload.xrplAccount = this.originalAccountInfo.Account;

    this.onPayload.emit(this.payload);
    this.initializePayload();
  }

  checkChanges() {
    this.domainChangeDetected = this.domainInput != null && this.domainInput.trim().length > 0 && (!this.originalAccountInfo || (!this.originalAccountInfo.Domain || (this.stringToHex(this.domainInput.trim()) != this.originalAccountInfo.Domain)));
    this.validDomain = !this.domainChangeDetected || this.domainInput && this.domainInput.trim().length > 0;

    this.emailChangeDetected = this.emailInput != null && this.emailInput.trim().length > 0 && (!this.originalAccountInfo || (md5(this.emailInput.trim()).toUpperCase() != this.originalAccountInfo.EmailHash));
    this.validEmail = !this.emailChangeDetected || emailValidator.validate(this.emailInput);

    console.log("domainChangeDetected: " + this.domainChangeDetected);
    console.log("validDomain: " + this.validDomain);
    console.log("emailChangeDetected: " + this.emailChangeDetected);
    console.log("validEmail: " + this.validEmail);
  }

}
