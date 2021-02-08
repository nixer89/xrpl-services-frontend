import { Component, OnInit, OnDestroy, Input, ViewChild, Output, EventEmitter } from '@angular/core';
import { Subscription, Observable} from 'rxjs';
import * as md5 from 'md5';
import * as emailValidator from 'email-validator'
import * as flagsutil from '../../utils/flagutils';
import { GoogleAnalyticsService } from '../../services/google-analytics.service';
import { XummTypes } from 'xumm-sdk';
import { AccountObjectsChanged, AccountInfoChanged } from 'src/app/utils/types';

@Component({
  selector: 'accountset',
  templateUrl: './accountset.html'
})
export class AccountSetComponent implements OnInit, OnDestroy {

  private ACCOUNT_FLAG_REQUIRE_DESTINATION_TAG:number = 1;
  private ACCOUNT_FLAG_DISABLE_MASTER_KEY:number = 4;
  private ACCOUNT_FLAG_DEFAULT_RIPPLE:number = 8;

  constructor(private googleAnalytics: GoogleAnalyticsService) { }

  @Input()
  accountInfoChanged: Observable<AccountInfoChanged>;

  @Input()
  accountObjectsChanged: Observable<AccountObjectsChanged>;

  @Output()
  onPayload: EventEmitter<XummTypes.XummPostPayloadBodyJson> = new EventEmitter();

  @ViewChild('inpdomain') inpdomain;
  domainInput: string = "";

  @ViewChild('inpemail') inpemail;
  emailInput: string = "";

  @ViewChild('inprequiredesttag') inprequiredesttag;
  requireDestTagInput: boolean = false;

  @ViewChild('inpdisablemasterkey') inpdisablemasterkey;
  disableMasterKeyInput: boolean = false;

  @ViewChild('inpdefaultripple') inpdefaultripple;
  defaultRippleInput: boolean = false;

  private accountInfoChangedSubscription: Subscription;
  private accountObjectsChangedSubscription: Subscription;
  originalAccountInfo:any;
  originalAccountObjects:any;

  domainChangeDetected:boolean = false;
  emailChangeDetected:boolean = false;
  requireDestTagChangeDetected:boolean = false;
  disableMasterKeyChangeDetected:boolean = false;
  defaultRippleChangeDetected:boolean = false;

  isValidAccountSet:boolean = false;

  validAccountSet:boolean = false;
  validDomain:boolean = false;
  validEmail:boolean = false;

  payload:XummTypes.XummPostPayloadBodyJson = {
    txjson: {
      TransactionType: "AccountSet"
    }
  }

  ngOnInit(){
    this.accountInfoChangedSubscription = this.accountInfoChanged.subscribe(accountData => {
      //console.log("account info changed received: " + JSON.stringify(accountData));
      this.originalAccountInfo = accountData.info;
      this.reloadData()
    });

    this.accountObjectsChangedSubscription = this.accountObjectsChanged.subscribe(accountObjects => {
      //console.log("account objects changed received")
      this.originalAccountObjects = accountObjects.object;
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
      this.defaultRippleInput = flagsutil.isDefaultRippleEnabled(this.originalAccountInfo.Flags);
    } else {
      this.requireDestTagInput = false;
      this.disableMasterKeyInput = false;
      this.defaultRippleInput = false;
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

    this.googleAnalytics.analyticsEventEmitter('set_account_data', 'sendToXumm', 'account_set_component');

    this.payload.custom_meta = {};
    this.payload.custom_meta.instruction = "";

    if(this.domainInput && this.validDomain && (!this.originalAccountInfo || this.stringToHex(this.domainInput.trim()) != this.originalAccountInfo.Domain)) {
      this.payload.txjson.Domain = this.stringToHex(this.domainInput.trim());
      this.payload.custom_meta.instruction += "- Set Domain to '"+this.domainInput.trim()+"'\n"
    }

    if(this.emailInput && this.validEmail && (!this.originalAccountInfo || md5(this.emailInput.trim()).toUpperCase() != this.originalAccountInfo.EmailHash)) {
      this.payload.txjson.EmailHash = md5(this.emailInput.trim()).toUpperCase();
      this.payload.custom_meta.instruction += "- Set Email to '"+this.emailInput.trim()+"'\n"
    }

    if(this.requireDestTagChangeDetected) {
      if(this.requireDestTagInput) {
        this.payload.txjson.SetFlag = this.ACCOUNT_FLAG_REQUIRE_DESTINATION_TAG;
        this.payload.custom_meta.instruction += "- Set 'Require Destination Tag'\n"
      } else {
        this.payload.txjson.ClearFlag = this.ACCOUNT_FLAG_REQUIRE_DESTINATION_TAG;
        this.payload.custom_meta.instruction += "- Unset 'Require Destination Tag'\n"
      }
    }

    if(this.disableMasterKeyChangeDetected) {
      if(this.disableMasterKeyInput) {
        this.payload.txjson.SetFlag = this.ACCOUNT_FLAG_DISABLE_MASTER_KEY;
        this.payload.custom_meta.instruction += "- Disable Master Key\n"
      }
      else {
        this.payload.txjson.ClearFlag = this.ACCOUNT_FLAG_DISABLE_MASTER_KEY;
        this.payload.custom_meta.instruction += "- Enable Master Key\n"
      }
    }

    if(this.defaultRippleChangeDetected) {
      if(this.defaultRippleInput) {
        this.payload.txjson.SetFlag = this.ACCOUNT_FLAG_DEFAULT_RIPPLE;
        this.payload.custom_meta.instruction += "- Set 'Default Ripple' flag\n"
      }
      else {
        this.payload.txjson.ClearFlag = this.ACCOUNT_FLAG_DEFAULT_RIPPLE;
        this.payload.custom_meta.instruction += "- Unset 'Default Ripple' flag\n"
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

    if((!this.originalAccountInfo || !this.originalAccountInfo.Flags || this.originalAccountInfo.Flags == 0) && this.defaultRippleInput)
      this.defaultRippleChangeDetected = true;
    else if(this.originalAccountInfo && this.originalAccountInfo.Flags && (flagsutil.isDefaultRippleEnabled(this.originalAccountInfo.Flags) != this.defaultRippleInput))
      this.defaultRippleChangeDetected = true;
    else
      this.defaultRippleChangeDetected = false;

    this.isValidAccountSet = this.validDomain && this.validEmail && (this.domainChangeDetected || this.emailChangeDetected || this.requireDestTagChangeDetected || this.disableMasterKeyChangeDetected || this.defaultRippleChangeDetected) && !(this.requireDestTagChangeDetected && this.disableMasterKeyChangeDetected) && !(this.requireDestTagChangeDetected && this.defaultRippleChangeDetected) && !(this.disableMasterKeyChangeDetected && this.defaultRippleChangeDetected);

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
