import { Component, OnInit, ViewChild, Output, EventEmitter, Input, OnDestroy } from '@angular/core';
import { Encode } from 'xrpl-tagged-address-codec';
import { Subscription, Observable } from 'rxjs';
import { XummPostPayloadBodyJson } from 'xumm-api';
import { GoogleAnalyticsService } from '../../services/google-analytics.service';
import { AccountInfoChanged } from 'src/app/utils/types';
import { XRPLWebsocket } from '../../services/xrplWebSocket';

@Component({
  selector: 'accountdelete',
  templateUrl: './accountdelete.html'
})
export class AccountDeleteComponent implements OnInit, OnDestroy {

  constructor(private xrplWebSocket: XRPLWebsocket, private googleAnalytics: GoogleAnalyticsService) { }

  @Input()
  accountInfoChanged: Observable<AccountInfoChanged>;

  @Input()
  transactionSuccessfull: Observable<void>;

  @Output()
  onPayload: EventEmitter<XummPostPayloadBodyJson> = new EventEmitter();

  @ViewChild('inpdestinationaccount') inpdestinationaccount;
  destinationAccountInput: string;

  @ViewChild('inpdestinationtag') inpdestinationtag;
  destinationTagInput: string;

  private accountInfoChangedSubscription: Subscription;
  originalAccountInfo:any;

  private transactionSuccessfullSubscription: Subscription;

  isTestMode:boolean = false;

  destinationAccountExists:boolean = false;
  validDestinationAddress:boolean = false;
  validTag:boolean = false;

  lastKnownDestinationAccount:string;
  loadingDestinationAccount:boolean = false;
  loadingPreconditions:boolean = false;
  preconditionsFullFilled:boolean = true;

  errorMsg:string = null;

  ngOnInit() {
    this.accountInfoChangedSubscription = this.accountInfoChanged.subscribe(accountData => {
      console.log("account info changed received: " + JSON.stringify(accountData.info));
      this.originalAccountInfo = accountData.info;
      this.isTestMode = accountData.mode;
      
      if(this.originalAccountInfo && this.originalAccountInfo.Account) {
        this.checkPreconditions();
      } else if(!this.originalAccountInfo || !this.originalAccountInfo.Account) {
        this.preconditionsFullFilled = true;
        this.loadingPreconditions = false;
      }

      this.checkDestinationAccountExists();

    });

    this.transactionSuccessfullSubscription = this.transactionSuccessfull.subscribe(() => {
      this.clearInputs()
    });
  }

  ngOnDestroy() {
    if(this.transactionSuccessfullSubscription)
      this.transactionSuccessfullSubscription.unsubscribe();

    if(this.accountInfoChangedSubscription)
      this.accountInfoChangedSubscription.unsubscribe();
  }

  async checkPreconditions() {
    //console.log("check preconditions");
    if(this.originalAccountInfo && this.originalAccountInfo.Account) {
      this.googleAnalytics.analyticsEventEmitter('check_delete_preconditions', 'account_delete', 'account_delete_component');
      this.loadingPreconditions = true;

      let accountObjects:any[] = [];

      let account_objects_request:any = {
        command: "account_objects",
        ledger_index: "validated",
        account: this.originalAccountInfo.Account,
        limit: 201
      }

      let message:any = await this.xrplWebSocket.getWebsocketMessage("accountdelete", account_objects_request, this.isTestMode);

      this.handleWebSocketMessagePreconditions(message, accountObjects);
    }
  }

  async handleWebSocketMessagePreconditions(message: any, accountObjects:any[]) {
    //console.log("websocket message: " + JSON.stringify(message));
    if(message.status && message.type && message.type === 'response') {
      if(message.status === 'success' && message.result && message.result.account_objects && message.result.account === this.originalAccountInfo.Account) {
        accountObjects = accountObjects.concat(message.result.account_objects);
        //console.log("accountObjects length: " + accountObjects.length);

        //check sequence number
        this.preconditionsFullFilled = (this.originalAccountInfo.Sequence+256) < message.result.ledger_index;
        //console.log("sequence check: " + this.preconditionsFullFilled)

        if(!this.preconditionsFullFilled)
          this.errorMsg = "Your account cannot be deleted. You need to wait " + (this.originalAccountInfo.Sequence+256-message.result.ledger_index) + " more validated ledgers to delete your account."

        if(accountObjects.length > 1000) {
          //console.log("too many objects");
          this.preconditionsFullFilled = false;
          this.errorMsg = "Your account owns too many objects and cannot be deleted."
          this.loadingPreconditions = false;
        } else if(message.result.marker) {
          let marker_command:any = {
            command: "account_objects",
            ledger_index: message.result.ledger_index,
            account: this.originalAccountInfo.Account,
            limit: 400,
            marker: message.result.marker
          };

          let message_marker:any = await this.xrplWebSocket.getWebsocketMessage("accountdelete", marker_command, this.isTestMode);

          this.handleWebSocketMessagePreconditions(message_marker, accountObjects);
        } else {
          //we are finished, check objects:
          let filteredObject:any[] = accountObjects.filter(object => object.LedgerEntryType === "Escrow" || object.LedgerEntryType === "PayChannel" || object.LedgerEntryType === "RippleState" || object.LedgerEntryType === "Check")

          if(filteredObject && filteredObject.length > 1) {
            //console.log("forbidden object detected");
            // we have one of the "forbidden" objects still attached to our account. Preconditions are not met.
            this.preconditionsFullFilled = false;

            let escrows:number = accountObjects.filter(object => object.LedgerEntryType === "Escrow").length;
            let paychans:number = accountObjects.filter(object => object.LedgerEntryType === "PayChannel").length;
            let trustLines:number = accountObjects.filter(object => object.LedgerEntryType === "RippleState").length;
            let checks:number = accountObjects.filter(object => object.LedgerEntryType === "Check").length;

            if(this.errorMsg)
              this.errorMsg += "\n\n"
            else
              this.errorMsg = ""

            this.errorMsg += "Your account still has:"
            if(escrows > 0)
              this.errorMsg += "\n- Escrows: " + escrows;

            if(paychans > 0)
              this.errorMsg += "\n- Payment Channels: " + paychans;

            if(trustLines > 0)
              this.errorMsg += "\n- Trust Lines: " + trustLines;

            if(checks > 0)
              this.errorMsg += "\n- Checks: " + checks;

            this.errorMsg+= "\n\nYou can only delete your account if you have not linked any of the above objects to your account."
          } else {
            this.preconditionsFullFilled = true;
          }

          this.loadingPreconditions = false;
        }
      } else {
        this.preconditionsFullFilled = false;
        this.loadingPreconditions = false;
      }
    } else {
      this.preconditionsFullFilled = false;
      this.loadingPreconditions = false;
    }
  }

  async checkDestinationAccountExists() {
    if(this.destinationAccountInput && this.validDestinationAddress) {
      this.googleAnalytics.analyticsEventEmitter('check_destination_account', 'account_delete', 'account_delete_component');
      this.loadingDestinationAccount = true;

      let account_info_request:any = {
        command: "account_info",
        account: this.destinationAccountInput.trim(),
        "strict": true,
      }

      let message:any = await this.xrplWebSocket.getWebsocketMessage("accountdelete", account_info_request, this.isTestMode);

      if(message.status && message.type && message.type === 'response') {
        if(message.status === 'success') {
          this.destinationAccountExists = message.result && message.result.account_data && message.result.account_data.Account === this.destinationAccountInput.trim();
        } else {
          this.destinationAccountExists = false;
        }

        this.loadingDestinationAccount = false;

      } else {
        this.destinationAccountExists = false;
        this.loadingDestinationAccount = false;
      }
    }
  }

  sendPayloadToXumm() {

    this.googleAnalytics.analyticsEventEmitter('delete_account', 'sendToXumm', 'account_delete_component');

    let payload:XummPostPayloadBodyJson = {
      txjson: {
        TransactionType: "AccountDelete"
      }
    }

    if(this.destinationAccountInput && this.destinationAccountInput.trim().length > 0 && this.validDestinationAddress) {
      payload.txjson.Destination = this.destinationAccountInput.trim();

      if(this.destinationTagInput && this.destinationTagInput.trim().length > 0 && this.validTag) {
        payload.txjson.DestinationTag = parseInt(this.destinationTagInput.trim());
      }

      payload.custom_meta = {}
      payload.custom_meta.instruction = "Delete your XRPL Account\n\n - please sign with the account you want to delete!";
    }

    this.onPayload.emit(payload);
  }

  checkChanges() {   
    this.validDestinationAddress = this.destinationAccountInput && this.destinationAccountInput.trim().length > 0 && this.isValidXRPAddress(this.destinationAccountInput.trim());

    if(this.lastKnownDestinationAccount != this.destinationAccountInput.trim()) {
      this.lastKnownDestinationAccount = this.destinationAccountInput.trim()
      this.checkDestinationAccountExists();
    }

    this.validTag = this.destinationTagInput && /^[0-9]+$/.test(this.destinationTagInput);

    if(this.validTag) {
      let numberTag:number = parseInt(this.destinationTagInput);
      this.validTag = numberTag >= 0 && numberTag <= 4294967295;
    }

    //console.log("validAddress: " + this.validAddress);
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
    this.destinationAccountInput = this.destinationTagInput = null;
    this.validTag = this.validDestinationAddress = false;
  }
}
