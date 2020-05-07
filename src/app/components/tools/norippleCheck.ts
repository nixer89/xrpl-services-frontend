import { Component, ViewChild, Output, EventEmitter, Input, OnInit, OnDestroy } from '@angular/core';
import { Encode } from 'xrpl-tagged-address-codec';
import { Observable, Subscription, Subject } from 'rxjs';
import { XummPostPayloadBodyJson, XummJsonTransaction } from 'xumm-api';
import { GoogleAnalyticsService } from '../../services/google-analytics.service';
import { AccountInfoChanged, XrplAccountChanged } from 'src/app/utils/types';

interface NoRippleCheck {
  problem: string,
  txJson: XummJsonTransaction
}

@Component({
  selector: 'norippleCheck',
  templateUrl: './norippleCheck.html'
})
export class NoRippleCheckComponent implements OnInit, OnDestroy {

  constructor(private googleAnalytics: GoogleAnalyticsService) { }

  @Input()
  accountInfoChanged: Observable<AccountInfoChanged>;

  @Input()
  transactionSuccessfull: Observable<any>;
  
  @Output()
  onPayload: EventEmitter<XummPostPayloadBodyJson> = new EventEmitter();

  @ViewChild('inpxrplaccount', {static: false}) inpxrplaccount;
  xrplAccountInput: string;

  originalAccountInfo:any;
  testMode:boolean = false;

  isGateWayRole:boolean = false;

  private accountInfoChangedSubscription: Subscription;
  private transactionSuccessfullSubscription: Subscription;

  validAddress:boolean = false;

  problems:NoRippleCheck[];

  ngOnInit() {
    this.accountInfoChangedSubscription = this.accountInfoChanged.subscribe(accountData => {
      console.log("account info changed received: " + JSON.stringify(accountData));
      if(accountData && accountData.info && !accountData.info.error) {
        this.originalAccountInfo = accountData.info;
        this.testMode = accountData.mode;

        this.xrplAccountInput = this.originalAccountInfo.Account;
      } else {
        this.originalAccountInfo = null;
      }
    });

    this.transactionSuccessfullSubscription = this.transactionSuccessfull.subscribe(() => {
      this.clearInputs()
    });
  }

  ngOnDestroy() {
    if(this.accountInfoChangedSubscription)
      this.accountInfoChangedSubscription.unsubscribe();

    if(this.transactionSuccessfullSubscription)
      this.transactionSuccessfullSubscription.unsubscribe();
  }

  sendPayloadToXumm(txJson: XummJsonTransaction) {

    this.googleAnalytics.analyticsEventEmitter('no_ripple_check', 'sendToXumm', 'no_ripple_check_component');

    if(txJson) {
      delete txJson.Account;
      delete txJson.Sequence;
      delete txJson.Fee;

      let payload:XummPostPayloadBodyJson = {
        txjson: txJson
      }
  
      payload.custom_meta = {};
      payload.custom_meta.instruction = "- Issuer Address: " +this.issuerAccountInput.trim();
  
      this.onPayload.emit(payload);
    }
  }

  checkChanges() {
    this.validAddress = this.xrplAccountInput && this.xrplAccountInput.trim().length > 0 && this.isValidXRPAddress(this.xrplAccountInput.trim());
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
    this.xrplAccountInput = null;
    this.isGateWayRole = this.validAddress = false;
  }

  solveProblem(problem: NoRippleCheck) {
  }
}
