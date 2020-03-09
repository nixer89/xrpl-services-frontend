import { Component, OnInit, OnDestroy, Input, ViewChild, Output, EventEmitter } from '@angular/core';
import { Subscription, Observable} from 'rxjs';
import * as md5 from 'md5';
import * as emailValidator from 'email-validator'
import * as flagsutil from '../../utils/flagutils';
import { GoogleAnalyticsService } from '../../services/google-analytics.service';
import { XummPostPayloadBodyJson } from 'xumm-api';

@Component({
  selector: 'accountset',
  templateUrl: './accountset.html'
})
export class AccountSetComponent implements OnInit, OnDestroy {

  private ACCOUNT_FLAG_REQUIRE_DESTINATION_TAG:number = 1;
  private ACCOUNT_FLAG_DISABLE_MASTER_KEY:number = 4;

  constructor(private googleAnalytics: GoogleAnalyticsService) { }

  @Input()
  accountInfoChanged: Observable<any>;

  @Input()
  accountObjectsChanged: Observable<any>;

  @Output()
  onPayload: EventEmitter<XummPostPayloadBodyJson> = new EventEmitter();

  @ViewChild('inpdomain', {static: false}) inpdomain;
  domainInput: string = "";

  @ViewChild('inpemail', {static: false}) inpemail;
  emailInput: string = "";

  @ViewChild('inprequiredesttag', {static: false}) inprequiredesttag;
  requireDestTagInput: boolean = false;

  @ViewChild('inpdisablemasterkey', {static: false}) inpdisablemasterkey;
  disableMasterKeyInput: boolean = false;

  private accountInfoChangedSubscription: Subscription;
  private accountObjectsChangedSubscription: Subscription;
  originalAccountInfo:any;
  originalAccountObjects:any;

  domainChangeDetected:boolean = false;
  emailChangeDetected:boolean = false;
  requireDestTagChangeDetected:boolean = false;
  disableMasterKeyChangeDetected:boolean = false;

  isValidAccountSet:boolean = false;

  validAccountSet:boolean = false;
  validDomain:boolean = false;
  validEmail:boolean = false;

  payload:XummPostPayloadBodyJson = {
    options: {
      expire: 1
    },
    txjson: {
      TransactionType: "AccountSet"
    }
  }

  ngOnInit(){
    this.accountInfoChangedSubscription = this.accountInfoChanged.subscribe(accountData => {
      //console.log("account info changed received: " + JSON.stringify(accountData));
      this.originalAccountInfo = accountData;
      this.reloadData()
    });

    this.accountObjectsChangedSubscription = this.accountObjectsChanged.subscribe(accountObjects => {
      //console.log("account objects changed received")
      this.originalAccountObjects = accountObjects;
      this.reloadData()
    });

    this.initializePayload();    
  }

  ngOnDestroy() {
    if(this.accountInfoChangedSubscription)
      this.accountInfoChangedSubscription.unsubscribe();

    if(this.accountObjectsChangedSubscription)
      this.accountObjectsChangedSubscription.unsubscribe();
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
    //console.log(JSON.stringify(this.originalAccountInfo));
    if(this.originalAccountInfo)
        this.domainInput = this.hexToString(this.originalAccountInfo.Domain)
    else
      this.domainInput = null;
  
    this.emailInput = "";

    if(this.originalAccountInfo && this.originalAccountInfo.Flags && this.originalAccountInfo.Flags > 0) {
      this.requireDestTagInput = flagsutil.isRequireDestinationTagEnabled(this.originalAccountInfo.Flags);
      this.disableMasterKeyInput = flagsutil.isMasterKeyDisabled(this.originalAccountInfo.Flags);
    } else {
      this.requireDestTagInput = false;
      this.disableMasterKeyInput = false;
    }

    this.requireDestTagChangeDetected = this.disableMasterKeyChangeDetected = this.domainChangeDetected = this.emailChangeDetected = false;
    
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
    //console.log("sending to xumm");
    //console.log("originalAccountInfo: " + JSON.stringify(this.originalAccountInfo));
    //console.log("domain: " + this.domainInput);
    //console.log("domain hex: " + this.stringToHex(this.domainInput.trim()));
    //console.log("email: " + this.emailInput);

    this.payload.custom_meta = {};
    this.payload.custom_meta.instruction = "";

    if(this.domainInput && this.validDomain && (!this.originalAccountInfo || this.stringToHex(this.domainInput.trim()) != this.originalAccountInfo.Domain)) {
      this.payload.txjson.Domain = this.stringToHex(this.domainInput.trim());
      this.payload.custom_meta.instruction += "- Set Domain to '"+this.domainInput.trim()
    }

    if(this.emailInput && this.validEmail && (!this.originalAccountInfo || md5(this.emailInput.trim()).toUpperCase() != this.originalAccountInfo.EmailHash)) {
      this.payload.txjson.EmailHash = md5(this.emailInput.trim()).toUpperCase();
      this.payload.custom_meta.instruction += "- Set Email to'"+this.emailInput.trim()
    }

    if(this.requireDestTagChangeDetected) {
      if(this.requireDestTagInput) {
        this.payload.txjson.SetFlag = this.ACCOUNT_FLAG_REQUIRE_DESTINATION_TAG;
        this.payload.custom_meta.instruction += "\n- Set 'Require Destination Tag'"
      } else {
        this.payload.txjson.ClearFlag = this.ACCOUNT_FLAG_REQUIRE_DESTINATION_TAG;
        this.payload.custom_meta.instruction += "\n- Unset 'Require Destination Tag'"
      }
    }

    if(this.disableMasterKeyChangeDetected) {
      if(this.disableMasterKeyInput) {
        this.payload.txjson.SetFlag = this.ACCOUNT_FLAG_DISABLE_MASTER_KEY;
        this.payload.custom_meta.instruction += "\n- Deactivate Master Key"
      }
      else {
        this.payload.txjson.ClearFlag = this.ACCOUNT_FLAG_DISABLE_MASTER_KEY;
        this.payload.custom_meta.instruction += "\n- Reactivate Master Key"
      }
    }    

    this.onPayload.emit(this.payload);
    this.initializePayload();
  }

  deleteDomain() {
    this.googleAnalytics.analyticsEventEmitter('delete_domain', 'sendToXumm', 'account_set_component');
    this.payload.txjson.Domain = '';

    this.payload.custom_meta = {};
    this.payload.custom_meta.instruction = "Delete Domain attached to the XRPL account";

    if(this.originalAccountInfo && this.originalAccountInfo.Domain)
      this.payload.custom_meta.instruction+= ": " + this.hexToString(this.originalAccountInfo.Domain);
    else
      this.payload.custom_meta.instruction+= ".";

    this.onPayload.emit(this.payload);
    this.initializePayload();
  }

  deleteEmailHash() {
    this.googleAnalytics.analyticsEventEmitter('delete_emailhash', 'sendToXumm', 'account_set_component');

    this.payload.txjson.EmailHash = "00000000000000000000000000000000";
    this.payload.custom_meta = {};
    this.payload.custom_meta.instruction = "Delete Email attached to the XRPL account";

    this.onPayload.emit(this.payload);
    this.initializePayload();
  }

  checkChanges() {

    this.domainChangeDetected = this.domainInput != null && this.domainInput.trim().length > 0 && (!this.originalAccountInfo || (!this.originalAccountInfo.Domain || (this.stringToHex(this.domainInput.trim()) != this.originalAccountInfo.Domain)));
    this.validDomain = !this.domainChangeDetected || this.domainInput && this.domainInput.trim().length > 0;

    this.emailChangeDetected = this.emailInput != null && this.emailInput.trim().length > 0 && (!this.originalAccountInfo || (md5(this.emailInput.trim()).toUpperCase() != this.originalAccountInfo.EmailHash));
    this.validEmail = !this.emailChangeDetected || emailValidator.validate(this.emailInput);

    if((!this.originalAccountInfo || !this.originalAccountInfo.Flags || this.originalAccountInfo.Flags == 0) && this.requireDestTagInput)
      this.requireDestTagChangeDetected = true;
    else if(this.originalAccountInfo && this.originalAccountInfo.Flags && (flagsutil.isRequireDestinationTagEnabled(this.originalAccountInfo.Flags) != this.requireDestTagInput))
      this.requireDestTagChangeDetected = true;
    else
      this.requireDestTagChangeDetected = false;

    if((!this.originalAccountInfo || !this.originalAccountInfo.Flags || this.originalAccountInfo.Flags == 0) && this.disableMasterKeyInput)
      this.disableMasterKeyChangeDetected = true;
    else if(this.originalAccountInfo && this.originalAccountInfo.Flags && (flagsutil.isMasterKeyDisabled(this.originalAccountInfo.Flags) != this.disableMasterKeyInput))
      this.disableMasterKeyChangeDetected = true;
    else
      this.disableMasterKeyChangeDetected = false;

    this.isValidAccountSet = this.validDomain && this.validEmail && (this.domainChangeDetected || this.emailChangeDetected || this.requireDestTagChangeDetected || this.disableMasterKeyChangeDetected) && !(this.requireDestTagChangeDetected && this.disableMasterKeyChangeDetected);

    //console.log("domainChangeDetected: " + this.domainChangeDetected);
    //console.log("validDomain: " + this.validDomain);
    //console.log("emailChangeDetected: " + this.emailChangeDetected);
    //console.log("validEmail: " + this.validEmail);
  }

  hasAlternativeSigningMethod() {
    //console.log("this.originalAccountInfo: " + JSON.stringify(this.originalAccountInfo));
    //console.log("this.originalAccountObjects: " + JSON.stringify(this.originalAccountObjects));
    return (this.originalAccountInfo && this.originalAccountInfo.RegularKey) || (this.originalAccountObjects && (this.originalAccountObjects[0] && this.originalAccountObjects[0].LedgerEntryType === "SignerList" && this.originalAccountObjects[0].SignerEntries.length > 0));
  }
}
