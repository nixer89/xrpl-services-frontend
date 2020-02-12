import { Component, OnInit, Input, ViewChild, Output, EventEmitter } from '@angular/core';
import { Subscription, Observable} from 'rxjs';
import * as md5 from 'md5';

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
  changesDetected = false;

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

    if(this.domainInput && (!this.originalAccountInfo || this.stringToHex(this.domainInput.trim()) != this.originalAccountInfo.Domain))
      this.payload.txjson.Domain = this.stringToHex(this.domainInput.trim());

    if(this.emailInput && (!this.originalAccountInfo || md5(this.emailInput.trim()).toUpperCase() != this.originalAccountInfo.EmailHash))
      this.payload.txjson.EmailHash = md5(this.emailInput.trim()).toUpperCase();

    console.log("submitting payload: " + JSON.stringify(this.payload));

    this.onPayload.emit(this.payload);
    this.initializePayload();
  }

  deleteDomain() {
    this.payload.txjson.Domain = '';
    this.onPayload.emit(this.payload);
    this.initializePayload();
  }

  deleteEmailHash() {
    this.payload.txjson.EmailHash = '';
    this.onPayload.emit(this.payload);
    this.initializePayload();
  }

  checkChanges() {
    this.changesDetected = this.domainInput && this.domainInput.trim().length > 0 && (!this.originalAccountInfo || (!this.originalAccountInfo.Domain || (this.stringToHex(this.domainInput.trim()) != this.originalAccountInfo.Domain)));

    if(!this.changesDetected)
      this.changesDetected = this.emailInput && this.emailInput.trim().length > 0 && (!this.originalAccountInfo || (md5(this.emailInput.trim()) != this.originalAccountInfo.EmailHash));
  }

}
