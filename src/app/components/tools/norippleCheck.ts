import { Component, ViewChild, Output, EventEmitter, Input, OnInit, OnDestroy } from '@angular/core';
import { Encode } from 'xrpl-tagged-address-codec';
import { Observable, Subscription, Subject } from 'rxjs';
import { XummPostPayloadBodyJson, XummJsonTransaction } from 'xumm-api';
import { GoogleAnalyticsService } from '../../services/google-analytics.service';
import { AccountInfoChanged } from 'src/app/utils/types';
import { WebSocketSubject, webSocket } from 'rxjs/webSocket';

interface NoRippleCheck {
  problem: string,
  txJson: XummJsonTransaction
}

@Component({
  selector: 'norippleCheck',
  templateUrl: './norippleCheck.html',
  styleUrls: ['./norippleCheck.css']
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
  isTestMode:boolean = false;

  isGateWayRole:boolean = false;
  isUserRole:boolean = false;

  private accountInfoChangedSubscription: Subscription;
  private transactionSuccessfullSubscription: Subscription;

  validAddress:boolean = false;
  loadingProblems:boolean = false;

  displayedColumns: string[] = ['problem', 'fix'];
  problemsAndTransactions:NoRippleCheck[] = [];

  ngOnInit() {
    this.accountInfoChangedSubscription = this.accountInfoChanged.subscribe(accountData => {
      console.log("account info changed received: " + JSON.stringify(accountData));
      if(accountData && accountData.info && !accountData.info.error) {
        this.originalAccountInfo = accountData.info;
        this.isTestMode = accountData.mode;

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

  loadProblems() {
    if(this.xrplAccountInput && this.validAddress) {
      this.googleAnalytics.analyticsEventEmitter('load_noripple_check', 'noripple_check', 'noripple_check_component');
      this.loadingProblems = true;

      //console.log("connecting websocket");
      let websocket:WebSocketSubject<any> = webSocket(this.isTestMode ? 'wss://testnet.xrpl-labs.com' : 'wss://xrpl.ws');

      websocket.asObservable().subscribe(async message => {
        console.log("websocket message: " + JSON.stringify(message));
        if(message && message.status && message.status === 'success' && message.type && message.type === 'response' && message.result && message.result.problems && message.result.transactions) {
          let problems:string[] = message.result.problems;
          let transactions:any[] = message.result.transactions;

          for(let i = 0; i < problems.length; i++) {
            this.problemsAndTransactions.push({problem: problems[i], txJson: transactions[i]});
          }

          console.log("problemsAndTransactions: " + JSON.stringify(this.problemsAndTransactions));

          websocket.unsubscribe();
          websocket.complete();
          websocket = null;

          this.loadingProblems = false;
        } else {
          this.problemsAndTransactions = [];

          websocket.unsubscribe();
          websocket.complete();
          websocket = null;

          this.loadingProblems = false;
        }
      });

      let noripple_check_command:any = {
        command: "noripple_check",
        account: this.xrplAccountInput.trim(),
        role: this.isGateWayRole ? 'gateway' : 'user',
        ledger_index: "validated",
        transactions: true
      }

      websocket.next(noripple_check_command);
    }
  }

  sendPayloadToXumm(txJson: XummJsonTransaction) {

    this.googleAnalytics.analyticsEventEmitter('no_ripple_check', 'sendToXumm', 'no_ripple_check_component');

    if(txJson) {
      delete txJson.Sequence;
      delete txJson.Fee;

      let payload:XummPostPayloadBodyJson = {
        txjson: txJson
      }
  
      payload.custom_meta = {};
      payload.custom_meta.instruction = "- Sign with: " +this.xrplAccountInput.trim();
  
      this.onPayload.emit(payload);
    }
  }

  checkChanges() {
    this.validAddress = this.xrplAccountInput && this.xrplAccountInput.trim().length > 0 && this.isValidXRPAddress(this.xrplAccountInput.trim());

    if(this.validAddress)
      this.loadProblems();
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
