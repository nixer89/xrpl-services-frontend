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
  originalTestModeValue:boolean = false;
  isTestMode:boolean = false;

  accountNotFound:boolean = false;
  isGateway:boolean = false;

  private accountInfoChangedSubscription: Subscription;
  private transactionSuccessfullSubscription: Subscription;

  validAddress:boolean = false;
  loadingProblems:boolean = false;

  displayedColumns: string[] = ['problem', 'fix'];
  problemsAndTransactions:NoRippleCheck[] = [];
  obligations:any;

  websocket: WebSocketSubject<any>;

  ngOnInit() {
    this.accountInfoChangedSubscription = this.accountInfoChanged.subscribe(accountData => {
      console.log("account info changed received: " + JSON.stringify(accountData));
      if(accountData) {
        this.originalAccountInfo = accountData.info;
        this.isTestMode = accountData.mode;

        if(this.originalAccountInfo && this.originalAccountInfo.Account)
          this.xrplAccountInput = this.originalAccountInfo.Account;

        this.checkChanges();
      } else {
        this.originalAccountInfo = null;
        this.checkChanges();
      }
    });

    this.transactionSuccessfullSubscription = this.transactionSuccessfull.subscribe(() => {
      this.checkChanges();
    });
  }

  ngOnDestroy() {
    if(this.accountInfoChangedSubscription)
      this.accountInfoChangedSubscription.unsubscribe();

    if(this.transactionSuccessfullSubscription)
      this.transactionSuccessfullSubscription.unsubscribe();

    if(this.websocket) {
      this.websocket.unsubscribe();
      this.websocket.complete();
      this.websocket = null;
    }
  }

  setupWebsocket() {
    this.originalTestModeValue = this.isTestMode;
    console.log("connecting websocket");
    //console.log("connecting websocket");
    this.websocket = webSocket(this.isTestMode ? 'wss://testnet.xrpl-labs.com' : 'wss://xrpl.ws');

    this.websocket.asObservable().subscribe(async message => {
      console.log("websocket message: " + JSON.stringify(message));
      if(message && message.status && message.status === 'success' && message.type && message.type === 'response' && message.result) {

        this.accountNotFound = false;
        
        if(message.result.problems && message.result.transactions) {
          let problems:string[] = message.result.problems;
          let transactions:any[] = message.result.transactions;

          for(let i = 0; i < problems.length; i++) {
            if(transactions[i] && transactions[i].Account === this.xrplAccountInput.trim() && transactions[i].TransactionType === 'TrustSet'
                && transactions[i].Flags == 262144 && transactions[i].LimitAmount.issuer != this.xrplAccountInput.trim()) {
                  //skip entry
                  break;
            }

            this.problemsAndTransactions.push({problem: problems[i], txJson: transactions[i] ? transactions[i] : null});
          }

          console.log("problemsAndTransactions: " + JSON.stringify(this.problemsAndTransactions));

          this.loadingProblems = false;
        } else {
          console.log("account has obligations: " + JSON.stringify(message.result.obligations));

          this.isGateway = message.result.obligations != null;
          this.obligations = message.result.obligations;
          
          let noripple_check_command:any = {
            command: "noripple_check",
            account: this.xrplAccountInput.trim(),
            role: this.isGateway ? "gateway" : "user",
            ledger_index: "validated",
            transactions: true
          }

          this.websocket.next(noripple_check_command);
        }
      } else if(message && message.error === 'actNotFound') {
        this.accountNotFound = true
        this.problemsAndTransactions = [];
        this.obligations = null;
        this.loadingProblems = false;
      } else {
        this.problemsAndTransactions = [];
        this.obligations = null;
        this.loadingProblems = false;
      }
    });
  }

  loadProblems() {
    if(this.xrplAccountInput && this.validAddress) {
      this.googleAnalytics.analyticsEventEmitter('load_noripple_check', 'noripple_check', 'noripple_check_component');
      this.loadingProblems = true;

      if(this.websocket && this.originalTestModeValue != this.isTestMode) {
        this.websocket.unsubscribe();
        this.websocket.complete();
        this.websocket = null;
      }

      if(!this.websocket || this.websocket.closed)
          this.setupWebsocket();

      this.loadingProblems = true;

      let gateway_balances_request:any = {
        command: "gateway_balances",
        account: this.xrplAccountInput.trim(),
        ledger_index: "validated",
      }

      this.websocket.next(gateway_balances_request);
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
    this.problemsAndTransactions = [];
    this.obligations = {};
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
    this.validAddress = false;
  }
}
