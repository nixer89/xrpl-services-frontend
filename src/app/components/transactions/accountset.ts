import { Component, OnInit, OnDestroy, Input, ViewChild, Output, EventEmitter } from '@angular/core';
import { Subscription, Observable} from 'rxjs';
import * as md5 from 'md5';
import * as emailValidator from 'email-validator'

@Component({
  selector: 'accountset',
  templateUrl: './accountset.html'
})
export class AccountSetComponent implements OnInit, OnDestroy {

  @Input()
  accountInfoChanged: Observable<void>;

  @Output()
  onPayload: EventEmitter<any> = new EventEmitter();

  @ViewChild('inpdomain', {static: false}) inpdomain;
  domainInput: string = "";

  @ViewChild('inpemail', {static: false}) inpemail;
  emailInput: string = "";

  @ViewChild('inprequiredesttag', {static: false}) inprequiredesttag;
  requireDestTagInput: boolean = false;

  private accountInfoChangedSubscription: Subscription;
  originalAccountInfo:any;
  domainChangeDetected:boolean = false;
  emailChangeDetected:boolean = false;
  requireDestTagChangeDetected:boolean = false;

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
    if(this.accountInfoChangedSubscription)
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

    let trxFlags:number = this.originalAccountInfo && this.originalAccountInfo.Flags;

    this.requireDestTagInput = (trxFlags & 131072) == 131072;
    
    this.checkChanges();
  }

  hexToString(hexValue: string): string {
    if(hexValue)
      return Buffer.from(hexValue, 'hex').toString('utf8');
    else
      return "";
  }

  stringToHex(stringValue: string): string {
    if(stringValue)
      return Buffer.from(stringValue, 'utf8').toString('hex').toUpperCase();
    else
      return "";
  }

  sendToXumm() {
    console.log("sending to xumm");
    console.log("originalAccountInfo: " + JSON.stringify(this.originalAccountInfo));
    console.log("domain: " + this.domainInput);
    console.log("domain hex: " + this.stringToHex(this.domainInput.trim()));
    console.log("email: " + this.emailInput);

    this.payload.custom_meta = {};
    this.payload.custom_meta.instructions = "";

    if(this.originalAccountInfo && this.originalAccountInfo.Account)
      this.payload.xrplAccount = this.originalAccountInfo.Account;

    if(this.domainInput && this.validDomain && (!this.originalAccountInfo || this.stringToHex(this.domainInput.trim()) != this.originalAccountInfo.Domain))
      this.payload.txjson.Domain = this.stringToHex(this.domainInput.trim());

    if(this.emailInput && this.validEmail && (!this.originalAccountInfo || md5(this.emailInput.trim()).toUpperCase() != this.originalAccountInfo.EmailHash))
      this.payload.txjson.EmailHash = md5(this.emailInput.trim()).toUpperCase();

    if(this.requireDestTagChangeDetected) {
      if(this.requireDestTagInput)
        this.payload.txjson.SetFlag = 1;
      else
        this.payload.txjson.ClearFlag = 1;
    }

    if(this.payload.txjson.Domain)
      this.payload.custom_meta.instructions+= "Set a new Domain"

    if(this.payload.txjson.EmailHash)
    this.payload.custom_meta.instructions+= "Set a new Domain"

    this.onPayload.emit(this.payload);
    this.initializePayload();
  }

  deleteDomain() {
    this.payload.txjson.Domain = '';

    this.payload.custom_meta = {};
    this.payload.custom_meta.instructions = "Delete your Domain attached to this account";

    if(this.originalAccountInfo && this.originalAccountInfo.Domain)
      this.payload.custom_meta.instructions+= ": " + this.hexToString(this.originalAccountInfo.Domain);
    else
      this.payload.custom_meta.instructions+= ".";

    if(this.originalAccountInfo && this.originalAccountInfo.Account)
      this.payload.xrplAccount = this.originalAccountInfo.Account;

    this.onPayload.emit(this.payload);
    this.initializePayload();
  }

  deleteEmailHash() {
    this.payload.txjson.EmailHash = "00000000000000000000000000000000";

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

    this.requireDestTagChangeDetected = ((!this.originalAccountInfo || !this.originalAccountInfo.Flags) && this.requireDestTagInput) || (this.originalAccountInfo && this.originalAccountInfo.Flags && (((this.originalAccountInfo.Flags & 131072) == 131072) != this.requireDestTagInput));

    //console.log("domainChangeDetected: " + this.domainChangeDetected);
    //console.log("validDomain: " + this.validDomain);
    //console.log("emailChangeDetected: " + this.emailChangeDetected);
    //console.log("validEmail: " + this.validEmail);
  }

}
